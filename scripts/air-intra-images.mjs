#!/usr/bin/env node
/**
 * Air Intra Image Enrichment Script
 * 
 * Loads product images from Air Intra API (articulos endpoint),
 * downloads them, converts to WebP, and stores in the database.
 * 
 * Usage: node scripts/air-intra-images.mjs [batchSize] [startPage]
 *   - batchSize: products per page (default: 500)
 *   - startPage: API page to start from (default: 0)
 * 
 * Environment: reads DATABASE_URL and TURSO_AUTH_TOKEN from .env
 */

import { createClient } from '@libsql/client'
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env
const envPath = join(__dirname, '..', '.env')
const envContent = readFileSync(envPath, 'utf-8')
const envVars = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) envVars[match[1].trim()] = match[2].trim()
}

const DATABASE_URL = envVars.DATABASE_URL || 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io'
const TURSO_AUTH_TOKEN = envVars.TURSO_AUTH_TOKEN || envVars.AUTH_TOKEN || ''
const AIR_INTRA_USER = 'c4078'
const AIR_INTRA_PASS = 'buA4XNOAAB'
const AIR_INTRA_BASE = 'https://api.air-intra.com/v2'

// Image processing settings
const MAX_IMAGE_WIDTH = 800
const WEBP_QUALITY = 75
const MAX_SOURCE_SIZE = 5 * 1024 * 1024 // 5MB

// Stats
let totalProcessed = 0
let totalEnriched = 0
let totalSkipped = 0
let totalFailed = 0
let totalAlreadyHad = 0

// ============================================
// Database
// ============================================
const db = createClient({ url: DATABASE_URL, authToken: TURSO_AUTH_TOKEN })

async function ensureImageTable() {
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
}

// ============================================
// Air Intra API
// ============================================
function stripPhpNotices(text) {
  return text
    .replace(/(?:<br\s*\/?>\s*)?<b>(?:Notice|Warning|Fatal error|Parse error|Deprecated)<\/b>:\s*.*?on line \d+\s*/gis, '')
    .replace(/(?:^|\n)\s*(?:Notice|Warning|Fatal error|Parse error|Deprecated):\s*.*?on line \d+\s*/gis, '')
    .replace(/<br\s*\/?>\s*/gi, '')
    .replace(/<\/?b>/gi, '')
    .replace(/,\s*([}\]])/g, '$1')
    .trim()
}

async function airIntraLogin() {
  try {
    // Use curl for more reliable network access
    const { execSync } = await import('child_process')
    const result = execSync(
      `curl -s -m 30 "${AIR_INTRA_BASE}/?q=login&user=${AIR_INTRA_USER}&pass=${AIR_INTRA_PASS}"`,
      { encoding: 'utf-8' }
    )
    const jsonStart = result.indexOf('{')
    if (jsonStart === -1) return null
    const data = JSON.parse(result.substring(jsonStart))
    return data.token || null
  } catch (e) {
    console.error('[login] Failed:', e.message)
    return null
  }
}

/**
 * Extract individual product objects from potentially corrupted JSON
 */
function extractProductsFromCorruptedJson(text) {
  const products = []
  let i = 0
  while (i < text.length) {
    if (text[i] !== '{') { i++; continue }
    let depth = 0, inStr = false, esc = false, objEnd = -1
    for (let j = i; j < text.length; j++) {
      const ch = text[j]
      if (esc) { esc = false; continue }
      if (ch === '\\' && inStr) { esc = true; continue }
      if (ch === '"') { inStr = !inStr; continue }
      if (inStr) continue
      if (ch === '{') depth++
      else if (ch === '}') { depth--; if (depth === 0) { objEnd = j; break } }
    }
    if (objEnd === -1) { i++; continue }
    const objText = text.substring(i, objEnd + 1)
    if (objText.includes('"codigo"') || objText.includes('"codiart"')) {
      try { products.push(JSON.parse(objText)) } catch {}
    }
    i = objEnd + 1
  }
  return products
}

/**
 * Fetch a page of products from Air Intra API
 */
async function fetchProductPage(token, page, pageSize = 500) {
  try {
    const { execSync } = await import('child_process')
    const result = execSync(
      `curl -s -m 60 -X POST "${AIR_INTRA_BASE}/?q=articulos&page=${page}" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -H "Accept: application/json" -d '{}'`,
      { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }
    )

    const cleaned = stripPhpNotices(result)

    // Try direct parse
    const jsonStart = cleaned.indexOf('[')
    if (jsonStart === -1) return []

    const jsonText = cleaned.substring(jsonStart)
    try {
      const data = JSON.parse(jsonText)
      if (Array.isArray(data)) return data
    } catch {
      // Fallback: extract individual objects
      return extractProductsFromCorruptedJson(cleaned)
    }
    return []
  } catch (e) {
    console.error(`[fetch] Page ${page} error:`, e.message)
    return []
  }
}

// ============================================
// Image processing
// ============================================
async function downloadAndConvertToWebp(imageUrl) {
  try {
    // Use curl for reliable downloads
    const { execSync } = await import('child_process')
    const buffer = execSync(`curl -s -m 15 -L -A "Mozilla/5.0" "${imageUrl}"`, {
      maxBuffer: 10 * 1024 * 1024,
    })

    if (!buffer || buffer.length < 100) return null
    if (buffer.length > MAX_SOURCE_SIZE) return null

    // Convert to WebP
    const webpBuffer = await sharp(buffer)
      .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_WIDTH, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 6 })
      .toBuffer()

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

// ============================================
// Extract images from Air Intra product
// ============================================
function extractImageUrls(product) {
  const images = []

  // Check imagenes array
  if (product.imagenes && Array.isArray(product.imagenes)) {
    for (const img of product.imagenes) {
      if (typeof img === 'string' && img.startsWith('http')) images.push(img)
      else if (img?.url) images.push(img.url)
      else if (img?.imagen) images.push(img.imagen)
    }
  }

  // Check single image fields
  for (const field of ['imagen', 'foto', 'imagen_url', 'img']) {
    if (product[field] && typeof product[field] === 'string' && product[field].startsWith('http')) {
      images.push(product[field])
    }
  }

  return images
}

// ============================================
// Build SKU -> Product ID map from our DB
// ============================================
async function buildSkuMap() {
  const result = await db.execute(
    `SELECT id, providerSku, images FROM products WHERE providerId = 'air-intra-1780331633566' AND isActive = 1`
  )

  const skuToProduct = new Map()
  for (const row of result.rows) {
    const sku = String(row.providerSku)
    const hasImage = row.images && row.images !== '[]' && row.images !== null && row.images !== ''
    skuToProduct.set(sku, { id: row.id, hasImage })
  }

  return skuToProduct
}

// ============================================
// MAIN
// ============================================
async function main() {
  const batchSize = parseInt(process.argv[2] || '500')
  const startPage = parseInt(process.argv[3] || '0')

  console.log('=== Air Intra Image Enrichment ===')
  console.log(`Batch size: ${batchSize}, Start page: ${startPage}`)
  console.log()

  await ensureImageTable()

  // Step 1: Build SKU map of our products that need images
  console.log('[1/3] Building SKU map from database...')
  const skuToProduct = await buildSkuMap()

  const needImages = [...skuToProduct.values()].filter(p => !p.hasImage).length
  const alreadyHave = [...skuToProduct.values()].filter(p => p.hasImage).length
  console.log(`  Products needing images: ${needImages}`)
  console.log(`  Products with images: ${alreadyHave}`)
  console.log()

  // Step 2: Login to Air Intra API
  console.log('[2/3] Logging in to Air Intra API...')
  const token = await airIntraLogin()
  if (!token) {
    console.error('Failed to login to Air Intra API!')
    process.exit(1)
  }
  console.log('  Login successful!')
  console.log()

  // Step 3: Paginate through articulos and match images
  console.log('[3/3] Fetching product images from Air Intra...')
  let page = startPage
  let consecutiveEmptyPages = 0

  while (consecutiveEmptyPages < 3) {
    console.log(`\n  Page ${page}...`)
    const products = await fetchProductPage(token, page, batchSize)

    if (!products || products.length === 0) {
      consecutiveEmptyPages++
      console.log(`  Empty page (${consecutiveEmptyPages}/3)`)
      page++
      await new Promise(r => setTimeout(r, 1000))
      continue
    }

    consecutiveEmptyPages = 0
    let pageEnriched = 0
    let pageSkipped = 0

    for (const product of products) {
      totalProcessed++
      const sku = String(product.codigo || product.codiart || '')

      if (!sku) { totalSkipped++; continue }

      const ourProduct = skuToProduct.get(sku)
      if (!ourProduct) { totalSkipped++; continue } // Not in our catalog
      if (ourProduct.hasImage) { totalAlreadyHad++; continue } // Already has image

      // Extract image URLs from Air Intra data
      const imageUrls = extractImageUrls(product)
      if (imageUrls.length === 0) { totalSkipped++; continue }

      // Try downloading and converting the first available image
      let enriched = false
      for (const imageUrl of imageUrls) {
        const imageData = await downloadAndConvertToWebp(imageUrl)

        if (imageData) {
          // Store in product_images table
          const imageId = crypto.randomUUID()
          await db.execute({
            sql: `INSERT INTO product_images (id, data, size, width, height, createdAt)
                  VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            args: [imageId, imageData.data, imageData.size, imageData.width, imageData.height],
          })

          // Update product
          const imagePath = `/api/image/${imageId}`
          await db.execute({
            sql: 'UPDATE products SET images = ?, updatedAt = datetime(\'now\') WHERE id = ?',
            args: [JSON.stringify([imagePath]), ourProduct.id],
          })

          ourProduct.hasImage = true // Update in-memory map
          totalEnriched++
          pageEnriched++
          enriched = true

          const sizeKB = (imageData.size / 1024).toFixed(1)
          console.log(`    ✓ ${sku}: ${imageData.width}x${imageData.height}, ${sizeKB}KB WebP`)
          break // Only need first successful image
        }
      }

      if (!enriched) totalFailed++

      // Small delay between downloads
      await new Promise(r => setTimeout(r, 100))
    }

    console.log(`  Page ${page}: ${products.length} products, ${pageEnriched} enriched, ${pageSkipped} skipped`)

    page++

    // Progress summary
    if (totalEnriched > 0 && totalEnriched % 50 === 0) {
      const remaining = needImages - totalEnriched
      console.log(`\n  === Progress: ${totalEnriched} enriched, ${remaining} remaining ===\n`)
    }

    // Rate limit: wait 1 second between pages
    await new Promise(r => setTimeout(r, 1000))
  }

  // Final summary
  console.log('\n========================================')
  console.log('         ENRICHMENT COMPLETE')
  console.log('========================================')
  console.log(`Total API products processed: ${totalProcessed}`)
  console.log(`Products enriched: ${totalEnriched}`)
  console.log(`Already had images: ${totalAlreadyHad}`)
  console.log(`Skipped (no match/no image): ${totalSkipped}`)
  console.log(`Failed (download error): ${totalFailed}`)

  // Verify final count
  const remaining = await db.execute(
    `SELECT COUNT(*) as count FROM products WHERE providerId = 'air-intra-1780331633566' AND (images = '[]' OR images IS NULL) AND isActive = 1`
  )
  console.log(`\nAir Intra products still without images: ${(remaining.rows[0]).count}`)
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
