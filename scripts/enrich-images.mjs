/**
 * Image Enrichment Script for Air Intra Products
 * 
 * Searches the web for product images, downloads them, converts to WebP,
 * and stores them locally in the product_images table.
 * 
 * Usage: node scripts/enrich-images.mjs [batchSize] [delayMs]
 * 
 * Examples:
 *   node scripts/enrich-images.mjs 5 2000   # 5 products, 2s delay between each
 *   node scripts/enrich-images.mjs 3 3000   # 3 products, 3s delay (conservative)
 */

import { createClient } from '@libsql/client'
import sharp from 'sharp'
import ZAI from 'z-ai-web-dev-sdk'

const DB_URL = 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io'
const DB_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw'

const MAX_WIDTH = 800
const WEBP_QUALITY = 75
const BATCH_SIZE = parseInt(process.argv[2] || '5')
const DELAY_MS = parseInt(process.argv[3] || '2000')

const db = createClient({ url: DB_URL, authToken: DB_TOKEN })

async function downloadAndConvert(imageUrl) {
  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'image/*,*/*' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.startsWith('image/') && !ct.startsWith('application/octet-stream')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 4 * 1024 * 1024) return null

    const webpBuf = await sharp(buf)
      .resize(MAX_WIDTH, MAX_WIDTH, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 6 })
      .toBuffer()
    const meta = await sharp(webpBuf).metadata()

    if ((meta.width || 0) < 80 || (meta.height || 0) < 80) return null

    return { data: webpBuf.toString('base64'), size: webpBuf.length, width: meta.width || 0, height: meta.height || 0 }
  } catch {
    return null
  }
}

async function main() {
  console.log(`[enrich-images] Starting batch: size=${BATCH_SIZE}, delay=${DELAY_MS}ms`)

  const zai = await ZAI.create()

  // Get products without images - prioritize branded products
  const products = await db.execute({
    sql: `SELECT p.id, p.name, p.providerSku, p.specs 
          FROM products p 
          JOIN suppliers s ON p.providerId = s.id 
          WHERE s.apiType = 'air_intra' 
            AND (p.images = '[]' OR p.images IS NULL OR p.images = '')
            AND p.isActive = 1 AND p.stock > 0 AND p.categoryId IS NOT NULL
          ORDER BY p.updatedAt ASC
          LIMIT ?`,
    args: [BATCH_SIZE]
  })

  if (products.rows.length === 0) {
    console.log('[enrich-images] No products without images. All done!')
    return
  }

  console.log(`[enrich-images] Processing ${products.rows.length} products...`)

  let enriched = 0, failed = 0, skipped = 0

  for (let i = 0; i < products.rows.length; i++) {
    const product = products.rows[i]
    const { id, name, specs } = product
    console.log(`\n[${i + 1}/${products.rows.length}] ${name}`)

    // Parse specs for brand info
    let brand = ''
    try { const s = JSON.parse(specs || '{}'); brand = s['Marca'] || '' } catch {}

    let searchQuery = brand ? `${brand} ${name}` : name

    try {
      // Search with rate limit handling
      const results = await zai.functions.invoke('web_search', { query: searchQuery, num: 3 })
      if (!results || !Array.isArray(results) || results.length === 0) {
        console.log('  ✗ No search results')
        failed++
        await sleep(DELAY_MS)
        continue
      }

      let imageUrl = null
      let imageSource = ''

      // Try to get og:image from search results
      for (const result of results) {
        const host = result.host_name || ''
        if (['youtube', 'facebook', 'twitter', 'instagram', 'tiktok', 'pinterest'].some(d => host.includes(d))) continue

        try {
          const page = await zai.functions.invoke('page_reader', { url: result.url })
          const html = page?.data?.html || page?.html || ''
          if (!html) continue

          const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)

          if (ogMatch) {
            const candidate = ogMatch[1].replace(/&amp;/g, '&')
            if (candidate.includes('logo') || candidate.includes('icon') || candidate.includes('avatar')
              || candidate.includes('favicon') || candidate.endsWith('.svg')) continue

            imageUrl = candidate
            imageSource = host
            break
          }
        } catch {
          // Skip this page
        }
      }

      if (!imageUrl) {
        console.log('  ✗ No image found')
        failed++
        await sleep(DELAY_MS)
        continue
      }

      // Download and convert to WebP
      const imgData = await downloadAndConvert(imageUrl)
      if (!imgData) {
        console.log('  ✗ Download/convert failed')
        failed++
        await sleep(DELAY_MS)
        continue
      }

      // Store in product_images table
      const imageId = crypto.randomUUID()
      const now = new Date().toISOString()
      await db.execute({
        sql: 'INSERT INTO product_images (id, data, size, width, height, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        args: [imageId, imgData.data, imgData.size, imgData.width, imgData.height, now]
      })

      // Update product with local image path
      await db.execute({
        sql: 'UPDATE products SET images = ?, updatedAt = ? WHERE id = ?',
        args: [JSON.stringify(['/api/image/' + imageId]), now, id]
      })

      enriched++
      console.log(`  ✓ ${imgData.width}x${imgData.height}, ${(imgData.size / 1024).toFixed(1)}KB WebP from ${imageSource}`)

    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('429') || msg.includes('Too many')) {
        console.log('  ⏸ Rate limited. Waiting 30s...')
        await sleep(30000)
        // Retry this product
        i--
        continue
      }
      console.log(`  ✗ Error: ${msg.substring(0, 80)}`)
      failed++
    }

    await sleep(DELAY_MS)
  }

  // Report
  const remaining = await db.execute({
    sql: `SELECT COUNT(*) as count FROM products p 
          JOIN suppliers s ON p.providerId = s.id 
          WHERE s.apiType = 'air_intra' 
            AND (p.images = '[]' OR p.images IS NULL OR p.images = '')
            AND p.isActive = 1 AND p.stock > 0 AND p.categoryId IS NOT NULL`,
    args: []
  })
  const totalRemaining = remaining.rows[0].count

  console.log(`\n=== Batch Complete ===`)
  console.log(`Enriched: ${enriched}`)
  console.log(`Failed: ${failed}`)
  console.log(`Remaining: ${totalRemaining}`)
  console.log(`\nRun again to process more: node scripts/enrich-images.mjs ${BATCH_SIZE} ${DELAY_MS}`)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
