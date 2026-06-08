#!/usr/bin/env node
/**
 * Fetch Provider Images - Obtiene imágenes directamente desde las APIs de los proveedores
 * 
 * 1. Air Intra: Re-paginar la API de articulos para obtener imágenes
 * 2. Invid: Re-fetch productos para obtener IMAGE_URL
 * 3. Elit: Re-fetch productos para obtener imagenes
 */

import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env')
const envContent = readFileSync(envPath, 'utf-8')
const envVars = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) envVars[match[1].trim()] = match[2].trim()
}

const db = createClient({ url: envVars.DATABASE_URL, authToken: envVars.TURSO_AUTH_TOKEN })

function stripPhpNotices(text) {
  return text.replace(/<br\s*\/?>\s*<b>[\s\S]*?<\/b>\s*[\s\S]*?<br\s*\/?>/g, '')
    .replace(/<b>[\s\S]*?<\/b>:\s*[\s\S]*?(?=\n|[{[])/g, '')
}

// ============================================
// AIR INTRA
// ============================================
async function airIntraLogin() {
  try {
    const res = await fetch('https://api.air-intra.com/v2/?q=login&user=c4078&pass=buA4XNOAAB', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    })
    const text = await res.text()
    const jsonStart = text.indexOf('{')
    if (jsonStart === -1) return null
    const data = JSON.parse(text.substring(jsonStart))
    return data.token || null
  } catch (e) {
    console.error('Air Intra login failed:', e)
    return null
  }
}

async function fetchAirIntraImages(token, targetSkus) {
  const imageMap = new Map()
  let page = 1
  let hasMore = true
  let totalProcessed = 0

  while (hasMore) {
    try {
      const res = await fetch(`https://api.air-intra.com/v2/?q=articulos&page=${page}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ pagina: page }),
      })

      const text = await res.text()
      let cleaned = stripPhpNotices(text)
      const jsonStart = cleaned.indexOf('[')
      if (jsonStart === -1) { hasMore = false; break }
      cleaned = cleaned.substring(jsonStart)

      let products
      try {
        products = JSON.parse(cleaned)
      } catch {
        let depth = 0, endIdx = -1
        for (let i = 0; i < cleaned.length; i++) {
          if (cleaned[i] === '[') depth++
          else if (cleaned[i] === ']') { depth--; if (depth === 0) { endIdx = i; break } }
        }
        if (endIdx === -1) { hasMore = false; break }
        try { products = JSON.parse(cleaned.substring(0, endIdx + 1)) }
        catch { hasMore = false; break }
      }

      if (!Array.isArray(products) || products.length === 0) { hasMore = false; break }

      for (const p of products) {
        const sku = p.codigo || p.codiart
        if (!sku) continue
        const skuStr = String(sku)
        
        // Only process if this SKU is in our target list
        if (!targetSkus.has(skuStr)) continue

        // Extract images
        const images = []
        if (p.imagenes && Array.isArray(p.imagenes)) {
          for (const img of p.imagenes) {
            if (typeof img === 'string' && img.startsWith('http')) images.push(img)
            else if (img?.url) images.push(img.url)
            else if (img?.imagen) images.push(img.imagen)
          }
        }
        if (p.imagen && typeof p.imagen === 'string' && p.imagen.startsWith('http')) images.push(p.imagen)
        if (p.foto && typeof p.foto === 'string' && p.foto.startsWith('http')) images.push(p.foto)
        if (p.imagen_url && typeof p.imagen_url === 'string' && p.imagen_url.startsWith('http')) images.push(p.imagen_url)
        if (p.img && typeof p.img === 'string' && p.img.startsWith('http')) images.push(p.img)

        if (images.length > 0) {
          imageMap.set(skuStr, images)
        }
      }

      totalProcessed += products.length
      if (page % 3 === 0) {
        console.log(`  Pagina ${page}: ${products.length} productos procesados, ${imageMap.size} con imagen encontrados`)
      }
      
      page++
      await new Promise(r => setTimeout(r, 300))
    } catch (e) {
      console.error(`Error pagina ${page}:`, e.message)
      hasMore = false
    }
  }

  console.log(`  Total paginas: ${page - 1}, productos procesados: ${totalProcessed}`)
  return imageMap
}

// ============================================
// INVID
// ============================================
async function fetchInvidImages(targetSkus) {
  const imageMap = new Map()
  
  try {
    // Get Invid API credentials
    const supplierResult = await db.execute({
      sql: "SELECT * FROM suppliers WHERE name = ?",
      args: ["Invid Computers"]
    })
    const supplier = supplierResult.rows[0]
    if (!supplier) {
      console.log('  Invid supplier not found in DB')
      return imageMap
    }

    const apiBaseUrl = supplier.apiBaseUrl || 'https://api.invidcomputers.com'
    const apiUserId = supplier.apiUserId
    const apiToken = supplier.apiToken

    if (!apiUserId || !apiToken) {
      console.log('  Invid API credentials not configured')
      return imageMap
    }

    // Fetch all products from Invid API
    const res = await fetch(`${apiBaseUrl}/productos`, {
      headers: {
        'user-id': apiUserId,
        'token': apiToken,
        'Accept': 'application/json',
      },
    })

    if (!res.ok) {
      console.log(`  Invid API error: ${res.status}`)
      return imageMap
    }

    const data = await res.json()
    const products = Array.isArray(data) ? data : data.productos || data.data || []

    for (const p of products) {
      const sku = p.codigo || p.sku || p.id
      if (!sku) continue
      const skuStr = String(sku)
      
      if (!targetSkus.has(skuStr)) continue

      const imageUrl = p.IMAGE_URL || p.image_url || p.imagen || p.foto
      if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
        imageMap.set(skuStr, [imageUrl])
      }
    }
  } catch (e) {
    console.error('  Invid fetch error:', e.message)
  }

  return imageMap
}

// ============================================
// ELIT
// ============================================
async function fetchElitImages(targetSkus) {
  const imageMap = new Map()
  
  try {
    const supplierResult = await db.execute({
      sql: "SELECT * FROM suppliers WHERE name = ?",
      args: ["Elit"]
    })
    const supplier = supplierResult.rows[0]
    if (!supplier) {
      console.log('  Elit supplier not found in DB')
      return imageMap
    }

    const apiBaseUrl = supplier.apiBaseUrl
    const apiUserId = supplier.apiUserId
    const apiToken = supplier.apiToken

    if (!apiBaseUrl || !apiUserId || !apiToken) {
      console.log('  Elit API credentials not configured')
      return imageMap
    }

    // Elit uses a different API format - try to fetch products
    const res = await fetch(`${apiBaseUrl}/productos`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json',
      },
    })

    if (!res.ok) {
      console.log(`  Elit API error: ${res.status}`)
      return imageMap
    }

    const data = await res.json()
    const products = Array.isArray(data) ? data : data.productos || data.data || []

    for (const p of products) {
      const sku = p.codigo || p.sku || p.id
      if (!sku) continue
      const skuStr = String(sku)
      
      if (!targetSkus.has(skuStr)) continue

      if (p.imagenes && Array.isArray(p.imagenes) && p.imagenes.length > 0) {
        imageMap.set(skuStr, p.imagenes)
      }
    }
  } catch (e) {
    console.error('  Elit fetch error:', e.message)
  }

  return imageMap
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('============================================')
  console.log('  FETCH PROVIDER IMAGES')
  console.log('============================================\n')

  // Get current stats
  const before = await db.execute({
    sql: "SELECT COUNT(*) as c FROM products WHERE (images = '[]' OR images IS NULL OR images = '') AND isActive = 1 AND stock > 0",
    args: [],
  })
  console.log(`Productos sin imagen (con stock) antes: ${before.rows[0].c}\n`)

  // ==========================================
  // AIR INTRA
  // ==========================================
  console.log('=== AIR INTRA ===')
  const airIntraNoImages = await db.execute({
    sql: "SELECT id, name, providerSku FROM products WHERE providerId = 'air-intra-1780331633566' AND (images = '[]' OR images IS NULL OR images = '') AND isActive = 1 AND stock > 0",
    args: [],
  })
  console.log(`  Productos Air Intra sin imagen: ${airIntraNoImages.rows.length}`)

  if (airIntraNoImages.rows.length > 0) {
    const skuToId = new Map()
    const targetSkus = new Set()
    for (const r of airIntraNoImages.rows) {
      if (r.providerSku) {
        skuToId.set(String(r.providerSku), r.id)
        targetSkus.add(String(r.providerSku))
      }
    }
    console.log(`  SKUs para buscar: ${targetSkus.size}`)

    console.log('  Login a Air Intra...')
    const token = await airIntraLogin()
    if (token) {
      console.log('  Token obtenido, buscando imágenes...')
      const imageMap = await fetchAirIntraImages(token, targetSkus)
      console.log(`  Imágenes encontradas: ${imageMap.size}`)

      // Apply updates
      let applied = 0
      for (const [sku, images] of imageMap) {
        const productId = skuToId.get(sku)
        if (productId) {
          try {
            await db.execute({
              sql: "UPDATE products SET images = ?, updatedAt = datetime('now') WHERE id = ?",
              args: [JSON.stringify(images), productId],
            })
            applied++
          } catch (e) {
            console.log(`  Error actualizando ${sku}: ${e.message}`)
          }
        }
      }
      console.log(`  Air Intra: ${applied} productos actualizados con imágenes`)
    } else {
      console.log('  No se pudo obtener token de Air Intra')
    }
  }

  // ==========================================
  // INVID
  // ==========================================
  console.log('\n=== INVID ===')
  const invidNoImages = await db.execute({
    sql: "SELECT p.id, p.name, p.providerSku, s.id as supplierId FROM products p JOIN suppliers s ON p.providerId = s.id WHERE s.name = ? AND (p.images = '[]' OR p.images IS NULL OR p.images = '') AND p.isActive = 1 AND p.stock > 0",
    args: ["Invid Computers"],
  })
  console.log(`  Productos Invid sin imagen: ${invidNoImages.rows.length}`)

  if (invidNoImages.rows.length > 0) {
    const skuToId = new Map()
    const targetSkus = new Set()
    for (const r of invidNoImages.rows) {
      if (r.providerSku) {
        skuToId.set(String(r.providerSku), r.id)
        targetSkus.add(String(r.providerSku))
      }
    }

    const imageMap = await fetchInvidImages(targetSkus)
    console.log(`  Imágenes encontradas: ${imageMap.size}`)

    let applied = 0
    for (const [sku, images] of imageMap) {
      const productId = skuToId.get(sku)
      if (productId) {
        try {
          await db.execute({
            sql: "UPDATE products SET images = ?, updatedAt = datetime('now') WHERE id = ?",
            args: [JSON.stringify(images), productId],
          })
          applied++
        } catch (e) {
          console.log(`  Error: ${e.message}`)
        }
      }
    }
    console.log(`  Invid: ${applied} productos actualizados`)
  }

  // ==========================================
  // ELIT
  // ==========================================
  console.log('\n=== ELIT ===')
  const elitNoImages = await db.execute({
    sql: "SELECT p.id, p.name, p.providerSku, s.id as supplierId FROM products p JOIN suppliers s ON p.providerId = s.id WHERE s.name = ? AND (p.images = '[]' OR p.images IS NULL OR p.images = '') AND p.isActive = 1 AND p.stock > 0",
    args: ["Elit"],
  })
  console.log(`  Productos Elit sin imagen: ${elitNoImages.rows.length}`)

  if (elitNoImages.rows.length > 0) {
    const skuToId = new Map()
    const targetSkus = new Set()
    for (const r of elitNoImages.rows) {
      if (r.providerSku) {
        skuToId.set(String(r.providerSku), r.id)
        targetSkus.add(String(r.providerSku))
      }
    }

    const imageMap = await fetchElitImages(targetSkus)
    console.log(`  Imágenes encontradas: ${imageMap.size}`)

    let applied = 0
    for (const [sku, images] of imageMap) {
      const productId = skuToId.get(sku)
      if (productId) {
        try {
          await db.execute({
            sql: "UPDATE products SET images = ?, updatedAt = datetime('now') WHERE id = ?",
            args: [JSON.stringify(images), productId],
          })
          applied++
        } catch (e) {
          console.log(`  Error: ${e.message}`)
        }
      }
    }
    console.log(`  Elit: ${applied} productos actualizados`)
  }

  // ==========================================
  // FINAL STATS
  // ==========================================
  const after = await db.execute({
    sql: "SELECT COUNT(*) as c FROM products WHERE (images = '[]' OR images IS NULL OR images = '') AND isActive = 1 AND stock > 0",
    args: [],
  })
  console.log('\n============================================')
  console.log(`  Antes: ${before.rows[0].c} sin imagen`)
  console.log(`  Después: ${after.rows[0].c} sin imagen`)
  console.log(`  Mejora: ${before.rows[0].c - after.rows[0].c} productos con imagen`)
  console.log('============================================')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
