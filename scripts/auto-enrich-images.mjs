#!/usr/bin/env node
/**
 * Auto Enrich Images - Busca y asigna imágenes a productos sin imagen
 * 
 * Estrategia:
 * 1. Cross-provider matching: copia imágenes de productos de Elit/Invid que coincidan por marca+modelo
 * 2. Web search: busca imágenes en la web usando el nombre del producto
 * 3. Descarga, convierte a WebP, y almacena en product_images
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

// ============================================
// CONFIG
// ============================================
const MAX_IMAGE_WIDTH = 800
const WEBP_QUALITY = 75
const MAX_IMAGE_SIZE_KB = 150
const BATCH_SIZE = parseInt(process.argv[2]) || 50 // productos por tanda
const DRY_RUN = process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('--verbose')

// ============================================
// BRAND EXTRACTION
// ============================================
const BRANDS = [
  'LOGITECH', 'CORSAIR', 'RAZER', 'HYPERX', 'KINGSTON', 'COOLER MASTER',
  'ASUS ROG', 'ASUS TUF', 'ASUS', 'MSI', 'GIGABYTE', 'LENOVO', 'HP', 'DELL',
  'TP-LINK', 'TP-LINK', 'GENIUS', 'SAMSUNG', 'SEAGATE', 'ADATA', 'CRUCIAL',
  'BE QUIET', 'THERMALTAKE', 'NZXT', 'STEELSERIES', 'REDRAGON', 'NOCTUA',
  'DEEPCOOL', 'GAMEMAX', 'KLIPXTREME', 'VERBATIM', 'SANDISK', 'INTEL', 'AMD',
  'WESTERN DIGITAL', 'WESTERN', 'NVIDIA', 'BROTHER', 'EPSON', 'CANON',
  'HIKVISION', 'DAHUA', 'EZVIZ', 'ARUBA', 'HPE', 'PHILIPS', 'LG',
  'XPG', 'KELYX', 'NACEB', 'VALIANT', 'URBANO', 'ICIDU', 'CABLETECH',
  'SATELLITE', 'LEIYON', 'FOXBOX', 'THERMALTAKE', 'AOC', 'BENQ', 'VIEWSONIC',
  'KOORUI', 'ACER', 'DELL', 'POLY', 'PLANTRONICS', 'JABRA',
  'RAPTOR', 'TEROS', 'CX', 'SENTVEY', 'SENTEY', 'NOBREAK', 'APC',
  'MARVO', 'X-TECH', 'ENERMAX', 'FSP', 'SEASONIC', 'EVGA',
  'MICROSOFT', 'APPLE', 'GOOGLE', 'SONY', 'BOSE',
]

function extractBrand(name) {
  const upper = name.toUpperCase()
  // Try multi-word brands first (sorted by length descending)
  for (const brand of BRANDS.sort((a, b) => b.length - a.length)) {
    if (upper.includes(brand)) return brand
  }
  return ''
}

// ============================================
// NAME SIMILARITY (Jaccard)
// ============================================
function normalizeForMatch(name) {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function nameSimilarity(name1, name2) {
  const words1 = new Set(normalizeForMatch(name1).split(' ').filter(w => w.length > 2))
  const words2 = new Set(normalizeForMatch(name2).split(' ').filter(w => w.length > 2))
  
  let intersection = 0
  for (const w of words1) {
    if (words2.has(w)) intersection++
  }
  
  const union = new Set([...words1, ...words2]).size
  if (union === 0) return 0
  return intersection / union
}

// ============================================
// STEP 1: CROSS-PROVIDER MATCHING
// ============================================
async function crossProviderMatch(productsNeedingImages) {
  console.log('\n=== PASO 1: Cross-Provider Matching ===\n')
  
  // Get all products with images from Elit/Invid
  const donors = await db.execute({
    sql: `SELECT p.id, p.name, p.images, p.categoryId, s.name as supplier 
          FROM products p JOIN suppliers s ON p.providerId = s.id 
          WHERE s.name IN ('Elit', 'Invid Computers') 
          AND p.images != '[]' AND p.images IS NOT NULL AND p.images != '' AND p.isActive = 1`,
    args: [],
  })
  
  console.log(`  Donantes con imágenes: ${donors.rows.length}`)
  
  // Build brand -> [donor] map
  const donorByBrand = new Map()
  for (const row of donors.rows) {
    const images = JSON.parse(row.images || '[]')
    if (images.length === 0) continue
    const brand = extractBrand(row.name)
    if (!brand) continue
    if (!donorByBrand.has(brand)) donorByBrand.set(brand, [])
    donorByBrand.get(brand).push({
      name: row.name,
      images,
      categoryId: row.categoryId,
      supplier: row.supplier,
      brand,
    })
  }
  
  console.log(`  Marcas donantes únicas: ${donorByBrand.size}`)
  
  let enriched = 0
  const remaining = []
  
  for (const product of productsNeedingImages) {
    const brand = extractBrand(product.name)
    if (!brand) {
      remaining.push(product)
      continue
    }
    
    const brandDonors = donorByBrand.get(brand)
    if (!brandDonors || brandDonors.length === 0) {
      remaining.push(product)
      continue
    }
    
    // Find best match by name similarity, prioritizing same category
    let bestDonor = null
    let bestScore = 0
    
    // First try same category
    const sameCatDonors = brandDonors.filter(d => d.categoryId === product.categoryId)
    const pool = sameCatDonors.length > 0 ? sameCatDonors : brandDonors
    
    for (const donor of pool) {
      const sim = nameSimilarity(product.name, donor.name)
      // Boost score for same category
      const adjustedSim = (donor.categoryId === product.categoryId ? 0.1 : 0) + sim
      if (adjustedSim > bestScore) {
        bestScore = adjustedSim
        bestDonor = donor
      }
    }
    
    // Accept matches with similarity >= 0.15 (lower threshold than before)
    if (bestDonor && bestScore >= 0.15) {
      const imageUrl = bestDonor.images[0]
      
      if (!DRY_RUN) {
        // For /api/image/ URLs, just reference the same ID
        // For external URLs, download and convert
        if (imageUrl.startsWith('/api/image/')) {
          await db.execute({
            sql: `UPDATE products SET images = ?, updatedAt = datetime('now') WHERE id = ?`,
            args: [JSON.stringify([imageUrl]), product.id],
          })
        } else {
          // Try to download and convert external URL
          const imageData = await downloadAndConvertToWebp(imageUrl)
          if (imageData) {
            const imageId = crypto.randomUUID()
            await db.execute({
              sql: `INSERT OR IGNORE INTO product_images (id, data, size, width, height, createdAt) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
              args: [imageId, imageData.data, imageData.size, imageData.width, imageData.height],
            })
            await db.execute({
              sql: `UPDATE products SET images = ?, updatedAt = datetime('now') WHERE id = ?`,
              args: [JSON.stringify([`/api/image/${imageId}`]), product.id],
            })
          } else {
            // Fallback: just reference the external URL
            await db.execute({
              sql: `UPDATE products SET images = ?, updatedAt = datetime('now') WHERE id = ?`,
              args: [JSON.stringify([imageUrl]), product.id],
            })
          }
        }
      }
      
      enriched++
      if (VERBOSE || enriched <= 20) {
        console.log(`  ✓ [${enriched}] ${product.name}`)
        console.log(`    ← ${bestDonor.supplier}: ${bestDonor.name} (sim=${bestScore.toFixed(3)})`)
      }
      
      // Small delay
      await new Promise(r => setTimeout(r, 20))
    } else {
      remaining.push(product)
    }
  }
  
  console.log(`\n  Cross-provider: ${enriched} enriquecidos, ${remaining.length} restantes`)
  return { enriched, remaining }
}

// ============================================
// STEP 2: WEB SEARCH ENRICHMENT
// ============================================
async function webSearchEnrich(products, batchSize) {
  console.log('\n=== PASO 2: Web Search Enrichment ===\n')
  
  let ZAI
  try {
    ZAI = (await import('z-ai-web-dev-sdk')).default
  } catch (e) {
    console.log('  z-ai-web-dev-sdk no disponible, saltando web search')
    return { enriched: 0, failed: products.length }
  }
  
  const zai = await ZAI.create()
  const toProcess = products.slice(0, batchSize)
  console.log(`  Procesando ${toProcess.length} de ${products.length} productos restantes`)
  
  let enriched = 0
  let failed = 0
  const stillRemaining = []
  
  for (const product of toProcess) {
    try {
      // Build search query
      let searchQuery = product.name
      // Add category for better results
      if (product.catName && !product.name.toLowerCase().includes(product.catName.toLowerCase())) {
        searchQuery = product.name
      }
      
      if (VERBOSE || enriched + failed < 5) {
        console.log(`  Buscando: "${searchQuery}"`)
      }
      
      // Search the web
      const searchResults = await zai.functions.invoke('web_search', {
        query: `${searchQuery} product image buy`,
        num: 5,
      })
      
      if (!searchResults || !Array.isArray(searchResults) || searchResults.length === 0) {
        failed++
        stillRemaining.push(product)
        continue
      }
      
      // Strategy: Find an image URL from search results
      let imageUrl = null
      
      // Priority domains for product images
      const preferredDomains = [
        'mercadolibre.com.ar', 'amazon.com', 'newegg.com', 'fravega.com',
        'asus.com', 'rog.asus.com', 'logitech.com', 'corsair.com', 'razer.com',
        'msi.com', 'gigabyte.com', 'lenovo.com', 'hp.com', 'dell.com',
        'kingston.com', 'hyperx.com', 'steelseries.com', 'coolermaster.com',
        'samsung.com', 'lg.com', 'philips.com', 'tp-link.com',
        'adata.com', 'crucial.com', 'wd.com', 'seagate.com',
        'bequiet.com', 'thermaltake.com', 'nzxt.com', 'noctua.at',
        'deepcool.com', 'gamemax.com', 'aoc.com', 'viewsonic.com',
        'garbarino.com', 'comeros.com.ar', 'maxihogar.com.ar',
      ]
      
      // Skip these domains
      const skipDomains = [
        'youtube.com', 'facebook.com', 'twitter.com', 'instagram.com',
        'tiktok.com', 'pinterest.com', 'reddit.com', 'wikipedia.org',
      ]
      
      // Try preferred domains first
      for (const result of searchResults) {
        const url = result.url || ''
        const hostName = result.host_name || ''
        if (!url.startsWith('http')) continue
        if (skipDomains.some(d => hostName.includes(d))) continue
        
        const isPreferred = preferredDomains.some(d => hostName.includes(d))
        if (!isPreferred) continue
        
        try {
          const pageResult = await zai.functions.invoke('page_reader', { url })
          const html = pageResult?.data?.html || pageResult?.html || ''
          
          if (html) {
            imageUrl = extractImageFromHtml(html, hostName)
            if (imageUrl) break
          }
        } catch (err) {
          // Skip this result
        }
      }
      
      // Try any domain if no preferred match
      if (!imageUrl) {
        for (const result of searchResults) {
          const url = result.url || ''
          const hostName = result.host_name || ''
          if (!url.startsWith('http')) continue
          if (skipDomains.some(d => hostName.includes(d))) continue
          if (preferredDomains.some(d => hostName.includes(d))) continue // Already tried
          
          try {
            const pageResult = await zai.functions.invoke('page_reader', { url })
            const html = pageResult?.data?.html || pageResult?.html || ''
            
            if (html) {
              imageUrl = extractImageFromHtml(html, hostName)
              if (imageUrl) break
            }
          } catch (err) {
            // Skip
          }
        }
      }
      
      if (!imageUrl) {
        failed++
        stillRemaining.push(product)
        if (VERBOSE) console.log(`    ✗ Sin imagen encontrada`)
        continue
      }
      
      // Download and convert to WebP
      const imageData = await downloadAndConvertToWebp(imageUrl)
      
      if (!imageData) {
        failed++
        stillRemaining.push(product)
        if (VERBOSE) console.log(`    ✗ Error descargando imagen`)
        continue
      }
      
      // Store in product_images table
      if (!DRY_RUN) {
        const imageId = crypto.randomUUID()
        await db.execute({
          sql: `INSERT OR IGNORE INTO product_images (id, data, size, width, height, createdAt) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          args: [imageId, imageData.data, imageData.size, imageData.width, imageData.height],
        })
        await db.execute({
          sql: `UPDATE products SET images = ?, updatedAt = datetime('now') WHERE id = ?`,
          args: [JSON.stringify([`/api/image/${imageId}`]), product.id],
        })
      }
      
      enriched++
      if (VERBOSE || enriched <= 10) {
        console.log(`  ✓ [${enriched}] ${product.name} (${imageData.width}x${imageData.height}, ${(imageData.size / 1024).toFixed(1)}KB)`)
      }
      
      // Be respectful with delays
      await new Promise(r => setTimeout(r, 500))
      
    } catch (err) {
      failed++
      stillRemaining.push(product)
      if (VERBOSE) console.log(`    ✗ Error: ${err.message}`)
    }
  }
  
  // Products not processed in this batch
  const notProcessed = products.slice(batchSize)
  
  console.log(`\n  Web search: ${enriched} enriquecidos, ${failed} fallidos, ${notProcessed.length} no procesados (lote)`)
  
  return { enriched, failed, remaining: [...stillRemaining, ...notProcessed] }
}

// ============================================
// HTML IMAGE EXTRACTION
// ============================================
function extractImageFromHtml(html, hostName) {
  // Try og:image first (most reliable)
  const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
  
  if (ogMatch && ogMatch[1]) {
    let url = ogMatch[1].replace(/&amp;/g, '&')
    if (isValidProductImageUrl(url)) return url
  }
  
  // Fallback: look for product images in img tags
  const imgMatches = [...html.matchAll(/<img[^>]*src=["']([^"']+)["']/gi)]
  for (const imgMatch of imgMatches) {
    let src = imgMatch[1].replace(/&amp;/g, '&')
    // Skip non-product images
    if (
      src.includes('icon') || src.includes('logo') ||
      src.includes('banner') || src.includes('pixel') ||
      src.includes('avatar') || src.includes('favicon') ||
      src.includes('sprite') || src.includes('1x1') ||
      src.endsWith('.svg') || src.endsWith('.gif')
    ) continue
    
    // Prefer product-like image URLs
    if (
      src.includes('product') || src.includes('gallery') ||
      src.includes('zoom') || src.includes('large') ||
      src.includes('full') || src.includes('original') ||
      (src.includes('.jpg') && src.length > 30) ||
      src.includes('image') || src.includes('photo')
    ) {
      if (src.startsWith('//')) src = 'https:' + src
      else if (src.startsWith('/')) src = `https://${hostName}${src}`
      else if (!src.startsWith('http')) continue
      
      if (isValidProductImageUrl(src)) return src
    }
  }
  
  return null
}

function isValidProductImageUrl(url) {
  if (!url || url.length < 15) return false
  if (url.includes('logo') || url.includes('icon') || url.includes('avatar')) return false
  if (url.endsWith('.svg') || url.endsWith('.gif')) return false
  if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.webp')) return true
  if (url.includes('/image') || url.includes('/img') || url.includes('/photo') || url.includes('/product')) return true
  if (url.includes('format=') || url.includes('cdn')) return true
  return false
}

// ============================================
// IMAGE DOWNLOAD & CONVERT
// ============================================
async function downloadAndConvertToWebp(imageUrl) {
  try {
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*',
      },
      signal: AbortSignal.timeout(15000),
    })
    
    if (!res.ok) return null
    
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.startsWith('image/') && !contentType.startsWith('application/octet-stream')) {
      return null
    }
    
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    if (buffer.length > 5 * 1024 * 1024) return null // Skip > 5MB
    
    const sharp = (await import('sharp')).default
    
    let pipeline = sharp(buffer)
      .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_WIDTH, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY, effort: 6 })
    
    let webpBuffer = await pipeline.toBuffer()
    const metadata = await sharp(webpBuffer).metadata()
    
    // If too large, reduce quality
    if (webpBuffer.length > MAX_IMAGE_SIZE_KB * 1024) {
      const reducedBuffer = await sharp(buffer)
        .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_WIDTH, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 50, effort: 6 })
        .toBuffer()
      
      if (reducedBuffer.length < webpBuffer.length) {
        webpBuffer = reducedBuffer
      }
    }
    
    return {
      data: webpBuffer.toString('base64'),
      size: webpBuffer.length,
      width: metadata.width || 0,
      height: metadata.height || 0,
    }
  } catch (err) {
    if (VERBOSE) console.log(`    Download error: ${err.message}`)
    return null
  }
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('============================================')
  console.log('  AUTO ENRICH IMAGES - CompuCity')
  console.log('============================================')
  if (DRY_RUN) console.log('  ** MODO DRY-RUN (no se guardan cambios) **')
  console.log(`  Lote: ${BATCH_SIZE} productos`)
  console.log()
  
  // Ensure product_images table exists
  await db.execute(`
    CREATE TABLE IF NOT EXISTS product_images (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  
  // Get all products without images (with stock)
  const result = await db.execute({
    sql: `SELECT p.id, p.name, p.sku, p.providerSku, p.specs, p.categoryId, c.name as catName 
          FROM products p 
          LEFT JOIN categories c ON p.categoryId = c.id
          WHERE (p.images = '[]' OR p.images IS NULL OR p.images = '') 
          AND p.isActive = 1 AND p.stock > 0 
          ORDER BY p.price DESC`,
    args: [],
  })
  
  const products = result.rows.map(r => ({
    id: r.id,
    name: r.name,
    sku: r.sku,
    providerSku: r.providerSku,
    specs: r.specs,
    categoryId: r.categoryId,
    catName: r.catName,
  }))
  
  console.log(`Productos sin imagen (con stock): ${products.length}`)
  
  // STEP 1: Cross-provider matching
  const step1 = await crossProviderMatch(products)
  
  // STEP 2: Web search for remaining
  const step2 = await webSearchEnrich(step1.remaining, BATCH_SIZE)
  
  // Final stats
  const finalStats = await db.execute({
    sql: `SELECT 
            COUNT(CASE WHEN images = '[]' OR images IS NULL OR images = '' THEN 1 END) as withoutImages,
            COUNT(CASE WHEN images != '[]' AND images IS NOT NULL AND images != '' THEN 1 END) as withImages,
            COUNT(*) as total
          FROM products WHERE isActive = 1 AND stock > 0`,
    args: [],
  })
  
  console.log('\n============================================')
  console.log('  RESULTADO FINAL')
  console.log('============================================')
  console.log(`  Cross-provider: ${step1.enriched} productos enriquecidos`)
  console.log(`  Web search: ${step2.enriched} productos enriquecidos`)
  console.log(`  Fallidos web: ${step2.failed}`)
  console.log(`  Restantes sin imagen: ${step2.remaining.length}`)
  console.log(`  Total con stock con imagen: ${(finalStats.rows[0]).withImages}`)
  console.log(`  Total con stock sin imagen: ${(finalStats.rows[0]).withoutImages}`)
  console.log('============================================')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
