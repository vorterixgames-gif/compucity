#!/usr/bin/env node
/**
 * Web Search Image Enrichment - Batch processing
 * Processes products in small batches to find images via web search
 * 
 * Usage: node web-enrich-batch.mjs [batchSize] [offset]
 *   batchSize: number of products to process (default: 10)
 *   offset: skip first N products (default: 0)
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

const BATCH_SIZE = parseInt(process.argv[2]) || 10
const OFFSET = parseInt(process.argv[3]) || 0
const MAX_IMAGE_WIDTH = 800
const WEBP_QUALITY = 75

async function downloadAndConvert(imageUrl) {
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
    if (!contentType.startsWith('image/') && !contentType.startsWith('application/octet-stream')) return null
    
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length > 5 * 1024 * 1024) return null
    
    const sharp = (await import('sharp')).default
    let webpBuffer = await sharp(buffer)
      .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_WIDTH, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 6 })
      .toBuffer()
    
    if (webpBuffer.length > 150 * 1024) {
      const reduced = await sharp(buffer)
        .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_WIDTH, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 50, effort: 6 })
        .toBuffer()
      if (reduced.length < webpBuffer.length) webpBuffer = reduced
    }
    
    const metadata = await sharp(webpBuffer).metadata()
    return {
      data: webpBuffer.toString('base64'),
      size: webpBuffer.length,
      width: metadata.width || 0,
      height: metadata.height || 0,
    }
  } catch (e) {
    return null
  }
}

function extractImageFromHtml(html, hostName) {
  // og:image
  const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
  if (ogMatch?.[1]) {
    let url = ogMatch[1].replace(/&amp;/g, '&')
    if (url && !url.includes('logo') && !url.includes('icon') && !url.endsWith('.svg')) return url
  }
  
  // img tags
  const imgs = [...html.matchAll(/<img[^>]*src=["']([^"']+)["']/gi)]
  for (const m of imgs) {
    let src = m[1].replace(/&amp;/g, '&')
    if (src.includes('icon') || src.includes('logo') || src.includes('banner') || src.includes('pixel') || src.includes('favicon') || src.endsWith('.svg') || src.endsWith('.gif')) continue
    if (src.includes('product') || src.includes('gallery') || src.includes('zoom') || src.includes('large') || src.includes('full') || (src.includes('.jpg') && src.length > 30) || src.includes('image')) {
      if (src.startsWith('//')) src = 'https:' + src
      else if (src.startsWith('/')) src = `https://${hostName}${src}`
      else if (!src.startsWith('http')) continue
      return src
    }
  }
  return null
}

async function main() {
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()
  
  // Ensure table
  await db.execute(`CREATE TABLE IF NOT EXISTS product_images (id TEXT PRIMARY KEY, data TEXT NOT NULL, size INTEGER NOT NULL, width INTEGER, height INTEGER, createdAt TEXT NOT NULL DEFAULT (datetime('now')))`)
  
  // Get products needing images
  const result = await db.execute({
    sql: `SELECT p.id, p.name, p.sku, p.specs, p.categoryId, c.name as catName 
          FROM products p LEFT JOIN categories c ON p.categoryId = c.id
          WHERE (p.images = '[]' OR p.images IS NULL OR p.images = '') 
          AND p.isActive = 1 AND p.stock > 0 
          ORDER BY p.price DESC LIMIT ? OFFSET ?`,
    args: [BATCH_SIZE, OFFSET],
  })
  
  console.log(`Procesando ${result.rows.length} productos (offset: ${OFFSET})`)
  
  let enriched = 0, failed = 0
  
  for (const product of result.rows) {
    const { id, name, specs, catName } = product
    console.log(`\n[${enriched + failed + 1}/${result.rows.length}] ${name}`)
    
    try {
      // Build search query
      let searchQuery = name
      try {
        const specsObj = JSON.parse(specs || '{}')
        const brand = specsObj['Marca'] || ''
        if (brand && !name.toUpperCase().includes(brand.toUpperCase())) {
          searchQuery = `${brand} ${name}`
        }
      } catch {}
      
      // Search
      const searchResults = await zai.functions.invoke('web_search', {
        query: `${searchQuery} imagen producto`,
        num: 5,
      })
      
      if (!searchResults?.length) {
        console.log('  ✗ Sin resultados')
        failed++
        continue
      }
      
      let imageUrl = null
      
      // Try to get image from search results
      const skipDomains = ['youtube.com', 'facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com', 'pinterest.com', 'reddit.com', 'wikipedia.org']
      
      for (const sr of searchResults) {
        const url = sr.url || ''
        const hostName = sr.host_name || ''
        if (!url.startsWith('http')) continue
        if (skipDomains.some(d => hostName.includes(d))) continue
        
        try {
          const pageResult = await zai.functions.invoke('page_reader', { url })
          const html = pageResult?.data?.html || pageResult?.html || ''
          if (html) {
            imageUrl = extractImageFromHtml(html, hostName)
            if (imageUrl) {
              console.log(`  Encontrada imagen en ${hostName}`)
              break
            }
          }
        } catch {}
      }
      
      if (!imageUrl) {
        console.log('  ✗ Sin imagen encontrada')
        failed++
        continue
      }
      
      // Download and convert
      const imageData = await downloadAndConvert(imageUrl)
      if (!imageData) {
        console.log('  ✗ Error descargando')
        failed++
        continue
      }
      
      // Store
      const imageId = crypto.randomUUID()
      await db.execute({
        sql: 'INSERT OR IGNORE INTO product_images (id, data, size, width, height, createdAt) VALUES (?, ?, ?, ?, ?, datetime("now"))',
        args: [imageId, imageData.data, imageData.size, imageData.width, imageData.height],
      })
      await db.execute({
        sql: 'UPDATE products SET images = ?, updatedAt = datetime("now") WHERE id = ?',
        args: [JSON.stringify([`/api/image/${imageId}`]), id],
      })
      
      enriched++
      console.log(`  ✓ ${imageData.width}x${imageData.height}, ${(imageData.size / 1024).toFixed(1)}KB`)
      
      // Delay between products
      await new Promise(r => setTimeout(r, 300))
      
    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`)
      failed++
    }
  }
  
  // Final stats
  const remaining = await db.execute({
    sql: "SELECT COUNT(*) as c FROM products WHERE (images = '[]' OR images IS NULL OR images = '') AND isActive = 1 AND stock > 0",
    args: [],
  })
  
  console.log(`\n=== RESULTADO ===`)
  console.log(`Enriquecidos: ${enriched}`)
  console.log(`Fallidos: ${failed}`)
  console.log(`Restantes sin imagen: ${remaining.rows[0].c}`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
