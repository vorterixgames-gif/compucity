#!/usr/bin/env node
/**
 * Batch Image Enrichment Script for Air Intra products
 * 
 * Uses z-ai-web-dev-sdk web search to find product images,
 * downloads them, converts to WebP, and stores in DB.
 * 
 * Usage: node scripts/batch-images.mjs [batchSize]
 *   - batchSize: products to process per run (default: 20, max: 50)
 */

import { createClient } from '@libsql/client'
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import ZAI from 'z-ai-web-dev-sdk'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env
const envPath = join(__dirname, '..', '.env')
const envContent = readFileSync(envPath, 'utf-8')
const envVars = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) envVars[match[1].trim()] = match[2].trim()
}

const db = createClient({ url: envVars.DATABASE_URL, authToken: envVars.TURSO_AUTH_TOKEN })

const MAX_IMAGE_WIDTH = 800
const WEBP_QUALITY = 75
const MAX_SOURCE_SIZE = 5 * 1024 * 1024

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

async function downloadAndConvert(imageUrl) {
  try {
    const { execSync } = await import('child_process')
    const buffer = execSync(`curl -s -m 15 -L -A "Mozilla/5.0" "${imageUrl}"`, {
      maxBuffer: 10 * 1024 * 1024,
    })
    if (!buffer || buffer.length < 100 || buffer.length > MAX_SOURCE_SIZE) return null

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
  } catch { return null }
}

async function main() {
  const batchSize = Math.min(parseInt(process.argv[2] || '20'), 50)

  console.log('=== Batch Image Enrichment for Air Intra ===')
  console.log(`Batch size: ${batchSize}`)
  console.log()

  await ensureImageTable()

  // Get products needing images (prioritize in-stock with category)
  const products = await db.execute({
    sql: `SELECT p.id, p.name, p.providerSku, p.specs FROM products p
          WHERE p.providerId = 'air-intra-1780331633566'
            AND (p.images = '[]' OR p.images IS NULL)
            AND p.isActive = 1 AND p.stock > 0 AND p.categoryId IS NOT NULL
          ORDER BY p.price DESC
          LIMIT ?`,
    args: [batchSize],
  })

  if (products.rows.length === 0) {
    console.log('No products need images!')
    return
  }

  // Count remaining
  const remaining = await db.execute(
    `SELECT COUNT(*) as count FROM products WHERE providerId = 'air-intra-1780331633566' AND (images = '[]' OR images IS NULL) AND isActive = 1 AND stock > 0`
  )
  console.log(`Remaining: ${(remaining.rows[0]).count} products need images`)
  console.log()

  const zai = await ZAI.create()
  let enriched = 0
  let failed = 0

  for (const product of products.rows) {
    const { id, name, specs } = product

    try {
      // Parse brand from specs
      let brand = ''
      try {
        const specsObj = JSON.parse(specs || '{}')
        brand = specsObj['Marca'] || ''
      } catch {}

      // Build search query
      let searchQuery = name
      if (brand && !name.toUpperCase().includes(brand.toUpperCase())) {
        searchQuery = `${brand} ${name}`
      }

      console.log(`Searching: "${searchQuery.substring(0, 60)}..."`)

      // Search the web with retry on rate limit
      let searchResults = null
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          searchResults = await zai.functions.invoke('web_search', {
            query: `${searchQuery} product image buy`,
            num: 5,
          })
          break
        } catch (err) {
          if (err.message?.includes('429') || err.message?.includes('Too many')) {
            const waitMs = (attempt + 1) * 10000 // 10s, 20s, 30s
            console.log(`  Rate limited, waiting ${waitMs/1000}s...`)
            await new Promise(r => setTimeout(r, waitMs))
          } else {
            throw err
          }
        }
      }

      if (!searchResults || !Array.isArray(searchResults) || searchResults.length === 0) {
        failed++
        console.log(`  ✗ No search results`)
        continue
      }

      // Try to find an image from search results
      let imageUrl = null

      // Try each result page to find og:image
      for (const result of searchResults) {
        const url = result.url || ''
        if (!url.startsWith('http')) continue

        // Skip social media
        const hostName = result.host_name || ''
        if (['youtube', 'facebook', 'twitter', 'instagram', 'tiktok'].some(s => hostName.includes(s))) continue

        try {
          const pageResult = await zai.functions.invoke('page_reader', { url })
          const html = pageResult?.data?.html || pageResult?.html || ''

          if (!html) continue

          // Look for og:image
          const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)

          if (ogMatch && ogMatch[1]) {
            const candidate = ogMatch[1].replace(/&amp;/g, '&')
            if (!candidate.includes('logo') && !candidate.includes('icon') && !candidate.endsWith('.svg')) {
              imageUrl = candidate
              console.log(`  Found og:image from ${hostName}`)
              break
            }
          }

          // Fallback: img tags with product-like URLs
          if (!imageUrl) {
            const imgMatches = [...html.matchAll(/<img[^>]*src=["']([^"']+)["']/gi)]
            for (const imgMatch of imgMatches) {
              const src = imgMatch[1].replace(/&amp;/g, '&')
              if (src.includes('icon') || src.includes('logo') || src.endsWith('.svg') || src.endsWith('.gif')) continue
              if (src.includes('product') || src.includes('gallery') || src.includes('zoom') || (src.includes('.jpg') && src.length > 30)) {
                imageUrl = src.startsWith('//') ? 'https:' + src : src.startsWith('/') ? `https://${hostName}${src}` : src
                if (imageUrl.startsWith('http')) break
                imageUrl = null
              }
            }
            if (imageUrl) {
              console.log(`  Found img from ${hostName}`)
              break
            }
          }
        } catch {
          // Skip this page
        }
      }

      if (!imageUrl) {
        failed++
        console.log(`  ✗ No image found`)
        continue
      }

      // Download and convert to WebP
      const imageData = await downloadAndConvert(imageUrl)

      if (!imageData) {
        failed++
        console.log(`  ✗ Download/conversion failed`)
        continue
      }

      // Store in product_images
      const imageId = crypto.randomUUID()
      await db.execute({
        sql: `INSERT INTO product_images (id, data, size, width, height, createdAt) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        args: [imageId, imageData.data, imageData.size, imageData.width, imageData.height],
      })

      // Update product
      const imagePath = `/api/image/${imageId}`
      await db.execute({
        sql: 'UPDATE products SET images = ?, updatedAt = datetime(\'now\') WHERE id = ?',
        args: [JSON.stringify([imagePath]), id],
      })

      enriched++
      const sizeKB = (imageData.size / 1024).toFixed(1)
      console.log(`  ✓ ${imageData.width}x${imageData.height}, ${sizeKB}KB WebP`)

      // Delay between products (longer to avoid rate limits)
      await new Promise(r => setTimeout(r, 2000))

    } catch (err) {
      failed++
      console.log(`  ✗ Error: ${err.message}`)
    }
  }

  console.log('\n========================================')
  console.log(`Enriched: ${enriched}`)
  console.log(`Failed: ${failed}`)
  console.log(`Remaining: ${(remaining.rows[0]).count - enriched}`)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
