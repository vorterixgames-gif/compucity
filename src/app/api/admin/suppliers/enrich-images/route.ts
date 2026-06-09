import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

const MAX_IMAGE_WIDTH = 800
const WEBP_QUALITY = 75
const MAX_IMAGE_SIZE_KB = 150 // Target max size in KB

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

/**
 * Download an image from a URL and convert it to WebP.
 * Returns base64-encoded WebP data, or null on failure.
 */
async function downloadAndConvertToWebp(imageUrl: string): Promise<{
  data: string
  size: number
  width: number
  height: number
} | null> {
  try {
    // Fetch the image
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    })

    if (!res.ok) return null

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.startsWith('image/') && !contentType.startsWith('application/octet-stream')) {
      return null
    }

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Skip if the source image is too large (> 5MB)
    if (buffer.length > 5 * 1024 * 1024) return null

    // Convert to WebP using sharp
    const sharp = (await import('sharp')).default

    let pipeline = sharp(buffer)
      .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_WIDTH, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY, effort: 6 })

    const webpBuffer = await pipeline.toBuffer()
    const metadata = await sharp(webpBuffer).metadata()

    // If still too large, reduce quality
    let finalBuffer = webpBuffer
    if (webpBuffer.length > MAX_IMAGE_SIZE_KB * 1024) {
      const reducedBuffer = await sharp(buffer)
        .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_WIDTH, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 50, effort: 6 })
        .toBuffer()

      if (reducedBuffer.length < webpBuffer.length) {
        finalBuffer = reducedBuffer
      }
    }

    return {
      data: finalBuffer.toString('base64'),
      size: finalBuffer.length,
      width: metadata.width || 0,
      height: metadata.height || 0,
    }
  } catch (err: any) {
    console.log(`[enrich-images] Download/convert error for ${imageUrl}: ${err.message}`)
    return null
  }
}

/**
 * POST /api/admin/suppliers/enrich-images
 *
 * Enriches products that have no images by searching the web
 * for product images using the product name and brand.
 * Images are downloaded, converted to WebP, compressed, and stored
 * in the product_images table for local serving.
 *
 * Body: { batchSize?: number, providerType?: string }
 *   - batchSize: number of products to process (default: 10, max: 30)
 *   - providerType: 'air_intra' | 'all' (default: 'air_intra')
 */
export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const batchSize = Math.min(Math.max(body.batchSize || 10, 1), 30)
    const providerType = body.providerType || 'air_intra'

    await ensureImageTable()

    // Build query based on input: specific productIds, or search by provider
    let query: string
    let args: any[]

    if (body.productIds && Array.isArray(body.productIds) && body.productIds.length > 0) {
      // Specific products requested by ID
      const placeholders = body.productIds.map(() => '?').join(',')
      query = `SELECT p.id, p.name, p.sku, p.providerSku, p.specs, s.apiType
               FROM products p
               JOIN suppliers s ON p.providerId = s.id
               WHERE p.id IN (${placeholders})
               LIMIT ?`
      args = [...body.productIds, body.productIds.length]
    } else if (providerType === 'all') {
      query = `SELECT p.id, p.name, p.sku, p.providerSku, p.specs, s.apiType
               FROM products p
               JOIN suppliers s ON p.providerId = s.id
               WHERE (p.images = '[]' OR p.images IS NULL OR p.images = '')
                 AND p.isActive = 1
                 AND p.stock > 0
                 AND p.categoryId IS NOT NULL
               ORDER BY p.updatedAt ASC
               LIMIT ?`
      args = [batchSize]
    } else {
      query = `SELECT p.id, p.name, p.sku, p.providerSku, p.specs, s.apiType
               FROM products p
               JOIN suppliers s ON p.providerId = s.id
               WHERE s.apiType = ?
                 AND (p.images = '[]' OR p.images IS NULL OR p.images = '')
                 AND p.isActive = 1
                 AND p.stock > 0
                 AND p.categoryId IS NOT NULL
               ORDER BY p.updatedAt ASC
               LIMIT ?`
      args = [providerType, batchSize]
    }

    const products = await db.execute({ sql: query, args })

    if (products.rows.length === 0) {
      return NextResponse.json({
        ok: true,
        enriched: 0,
        remaining: 0,
        message: 'Todos los productos ya tienen imágenes',
      })
    }

    // Count remaining products without images
    let countQuery: string
    let countArgs: any[]

    if (body.productIds && Array.isArray(body.productIds) && body.productIds.length > 0) {
      // For specific product IDs, use the global count
      countQuery = `SELECT COUNT(*) as total FROM products
                    WHERE (images = '[]' OR images IS NULL OR images = '')
                      AND isActive = 1`
      countArgs = []
    } else if (providerType === 'all') {
      countQuery = `SELECT COUNT(*) as total FROM products p
                    JOIN suppliers s ON p.providerId = s.id
                    WHERE s.apiType = ?
                      AND (p.images = '[]' OR p.images IS NULL OR p.images = '')
                      AND p.isActive = 1 AND p.stock > 0 AND p.categoryId IS NOT NULL`
      countArgs = [providerType]
    }

    const remaining = await db.execute({ sql: countQuery, args: countArgs })
    const totalRemaining = (remaining.rows[0] as any).total

    let enriched = 0
    let failed = 0
    const errors: string[] = []

    // Use z-ai-web-dev-sdk for web search (configured via env vars)
    const ZAIMod = (await import('z-ai-web-dev-sdk')).default
    const zai = new ZAIMod({
      baseUrl: process.env.ZAI_BASE_URL || '',
      apiKey: process.env.ZAI_API_KEY || '',
      chatId: process.env.ZAI_CHAT_ID || '',
      userId: process.env.ZAI_USER_ID || '',
      token: process.env.ZAI_TOKEN || '',
    })

    for (const product of products.rows as any[]) {
      try {
        const { id, name, providerSku, specs } = product

        // Parse specs to get brand/part number for better search
        let brand = ''
        let partNumber = ''
        try {
          const specsObj = JSON.parse(specs || '{}')
          brand = specsObj['Marca'] || ''
          partNumber = specsObj['Part Number'] || ''
        } catch {}

        // Clean product name: remove supplier suffix like "(Elit)", "(Air Intra)"
        const cleanName = name.replace(/\s*\((Elit|Air Intra|Invid|Vorterix)\)\s*/g, '').trim()

        let imageUrl: string | null = null

        // Strategy 1: Search with multiple queries, try all results
        const searchQueries = [
          `${cleanName} comprar`,
          `${cleanName} ${brand} product`,
          cleanName,
        ]

        // Domains to skip entirely
        const skipDomains = ['youtube.com', 'facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com', 'pinterest.com', 'reddit.com', 'wikipedia.org']

        for (const searchQuery of searchQueries) {
          if (imageUrl) break
          console.log(`[enrich-images] Searching: "${searchQuery}"`)

          let searchResults: any[]
          try {
            const raw = await zai.functions.invoke('web_search', { query: searchQuery, num: 10 })
            searchResults = Array.isArray(raw) ? raw : []
          } catch {
            continue
          }

          if (searchResults.length === 0) continue

          // Try each result page
          for (const result of searchResults) {
            if (imageUrl) break
            const url = result.url || ''
            const hostName = result.host_name || ''

            if (!url.startsWith('http')) continue
            if (skipDomains.some(d => hostName.includes(d))) continue

            try {
              const pageResult = await zai.functions.invoke('page_reader', { url })
              const html = pageResult?.data?.html || pageResult?.html || ''
              if (!html) continue

              // Try og:image first (most reliable)
              const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
                || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)

              if (ogMatch && ogMatch[1]) {
                const candidate = ogMatch[1].replace(/&amp;/g, '&')
                // Skip obviously non-product images
                if (
                  !candidate.includes('logo') && !candidate.includes('icon') &&
                  !candidate.includes('avatar') && !candidate.includes('favicon') &&
                  !candidate.endsWith('.svg') && !candidate.endsWith('.gif') &&
                  candidate.length > 20
                ) {
                  imageUrl = candidate
                  console.log(`[enrich-images] Found og:image from ${hostName}: ${imageUrl}`)
                  break
                }
              }

              // Fallback: look for any large product image in img tags
              const imgMatches = [...html.matchAll(/<img[^>]*src=["']([^"']+)["']/gi)]
              for (const imgMatch of imgMatches) {
                const src = imgMatch[1].replace(/&amp;/g, '&')
                if (
                  src.includes('icon') || src.includes('logo') ||
                  src.includes('banner') || src.includes('pixel') ||
                  src.includes('avatar') || src.includes('favicon') ||
                  src.includes('sprite') || src.includes('1x1') ||
                  src.endsWith('.svg') || src.endsWith('.gif') ||
                  src.length < 25
                ) continue

                // Accept any image that looks like a product photo
                if (
                  src.includes('product') || src.includes('gallery') ||
                  src.includes('zoom') || src.includes('large') ||
                  src.includes('full') || src.includes('original') ||
                  src.includes('/image') || src.includes('/img') ||
                  src.includes('/photo') || src.includes('cdn') ||
                  src.includes('format=') || src.includes('catalog') ||
                  src.includes('.jpg') || src.includes('.jpeg') ||
                  src.includes('.png') || src.includes('.webp')
                ) {
                  if (src.startsWith('//')) imageUrl = 'https:' + src
                  else if (src.startsWith('/')) imageUrl = `https://${hostName}${src}`
                  else if (src.startsWith('http')) imageUrl = src
                  if (imageUrl) {
                    console.log(`[enrich-images] Found img from ${hostName}: ${imageUrl}`)
                    break
                  }
                }
              }
            } catch (err: any) {
              console.log(`[enrich-images] Error reading ${url}: ${err.message}`)
            }
          }
        }

        // Strategy 2: If no image found, ask AI to help find an image URL
        if (!imageUrl) {
          try {
            console.log(`[enrich-images] Asking AI for image URL: "${cleanName}"`)
            const aiResult = await zai.chat.completions.create({
              messages: [
                {
                  role: 'system',
                  content: 'You help find product image URLs. Given a product name, return ONLY a direct URL to a product image from the official brand site or a major retailer. If you cannot find one, respond with "NONE". No explanations, no markdown, just the URL or NONE.',
                },
                {
                  role: 'user',
                  content: `Find an image URL for: ${cleanName}${brand ? ` (Brand: ${brand})` : ''}`,
                },
              ],
              temperature: 0.3,
              max_tokens: 200,
            })

            const aiContent = aiResult.choices?.[0]?.message?.content?.trim() || ''
            if (aiContent && aiContent !== 'NONE' && aiContent.startsWith('http')) {
              imageUrl = aiContent.replace(/[\s"]/g, '')
              console.log(`[enrich-images] AI suggested image: ${imageUrl}`)
            }
          } catch (err: any) {
            console.log(`[enrich-images] AI image search failed: ${err.message}`)
          }
        }

        if (!imageUrl) {
          failed++
          errors.push(`${name}: no se encontró imagen`)
          continue
        }

        // Download and convert to WebP
        const imageData = await downloadAndConvertToWebp(imageUrl)

        if (!imageData) {
          failed++
          errors.push(`${name}: error descargando/convirtiendo imagen`)
          continue
        }

        // Store in product_images table
        const imageId = crypto.randomUUID()
        await db.execute({
          sql: `INSERT INTO product_images (id, data, size, width, height, createdAt)
                VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          args: [imageId, imageData.data, imageData.size, imageData.width, imageData.height],
        })

        // Update the product with the local image path
        const imagePath = `/api/image/${imageId}`
        await db.execute({
          sql: 'UPDATE products SET images = ?, updatedAt = ? WHERE id = ?',
          args: [JSON.stringify([imagePath]), new Date().toISOString(), id],
        })

        enriched++
        console.log(`[enrich-images] ✓ ${name}: ${imageData.width}x${imageData.height}, ${(imageData.size / 1024).toFixed(1)}KB WebP`)

        // Small delay between products to be respectful
        await new Promise(resolve => setTimeout(resolve, 300))

      } catch (err: any) {
        failed++
        errors.push(`${product.name}: ${err.message}`)
        console.error(`[enrich-images] Error processing product:`, err)
      }
    }

    return NextResponse.json({
      ok: true,
      processed: products.rows.length,
      enriched,
      failed,
      remaining: totalRemaining - enriched,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      message: `${enriched} productos enriquecidos con imágenes WebP, ${failed} sin resultado. Quedan ${totalRemaining - enriched} productos sin imagen.`,
    })

  } catch (error: any) {
    console.error('[enrich-images] Fatal error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

// ============================================
// CROSS-PROVIDER IMAGE COPY
// Copies images from Elit/Invid to matching Air Intra products
// using brand + model keyword matching
// ============================================

function extractBrandAndModelTerms(name: string): { brand: string; tokens: string[] } {
  const upper = name.toUpperCase()
  const brands = ['LOGITECH', 'CORSAIR', 'RAZER', 'HYPERX', 'KINGSTON', 'COOLER MASTER', 'ASUS ROG', 'ASUS TUF', 'ASUS', 'MSI', 'GIGABYTE', 'LENOVO', 'HP', 'DELL', 'TP-LINK', 'GENIUS', 'SAMSUNG', 'SEAGATE', 'ADATA', 'CRUCIAL', 'BE QUIET', 'THERMALTAKE', 'NZXT', 'STEELSERIES', 'REDRAGON', 'NOCTUA', 'DEEPCOOL', 'GAMEMAX', 'KLIPXTREME', 'VERBATIM', 'SANDISK', 'INTEL', 'AMD']
  let brand = ''
  for (const b of brands) { if (upper.includes(b)) { brand = b; break } }

  const tokens: string[] = []
  const patterns = [
    /(RTX\s?\d{4})/gi, /(GTX\s?\d{4})/gi,
    /(R[3579]\s?\d{3,4}[XG]?)/gi, /(I[3579][- ]?\d{4,5}[KF]?)/gi,
    /(B\d{3}|H\d{3}|Z\d{3}|X\d{3})/gi,
    /(DDR[45])/gi, /(\d+GB)/gi, /(\d+TB)/gi, /(\d+MBPS)/gi,
    /(GX-\d+|HS-\d+|G-\d+)/gi, /(NX-\d+)/gi, /(WN\d{4})/gi,
    /(G923|G29|F710)/gi, /(K\d{3,4})/gi,
    /(NVME|M\.2|SATA)/gi,
  ]
  for (const p of patterns) {
    const m = upper.match(p)
    if (m) m.forEach(t => tokens.push(t.toUpperCase().replace(/\s+/g, '')))
  }

  return { brand, tokens }
}

export async function PUT(request: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    await ensureImageTable()
    const body = await request.json().catch(() => ({}))
    const batchSize = Math.min(Math.max(body.batchSize || 20, 1), 50)

    // Step 1: Get Air Intra products needing images (in stock, with category)
    const airIntra = await db.execute({
      sql: `SELECT id, name FROM products
            WHERE providerId = 'air-intra-1780331633566'
              AND (images = '[]' OR images IS NULL OR images = '')
              AND isActive = 1 AND stock > 0 AND categoryId IS NOT NULL
            ORDER BY price DESC LIMIT ?`,
      args: [batchSize],
    })

    if (airIntra.rows.length === 0) {
      return NextResponse.json({ ok: true, enriched: 0, message: 'Todos los productos tienen imágenes' })
    }

    // Step 2: Build inverted index from Elit/Invid
    const withImages = await db.execute({
      sql: `SELECT p.name, p.images FROM products p
            JOIN suppliers s ON p.providerId = s.id
            WHERE s.name IN ('Elit', 'Invid Computers')
              AND p.images != '[]' AND p.images IS NOT NULL AND p.isActive = 1`,
    })

    // token -> [{ url, brand, name }]
    const invertedIndex = new Map<string, { url: string; brand: string; name: string }[]>()

    for (const row of withImages.rows as any[]) {
      const images = JSON.parse(row.images || '[]')
      if (images.length === 0) continue
      const { brand, tokens } = extractBrandAndModelTerms(row.name)
      for (const token of tokens) {
        if (!invertedIndex.has(token)) invertedIndex.set(token, [])
        invertedIndex.get(token)!.push({ url: images[0], brand, name: row.name })
      }
    }

    // Step 3: Match and process
    let enriched = 0
    let noMatch = 0
    let failed = 0

    for (const ai of airIntra.rows as any[]) {
      const { brand: aiBrand, tokens: aiTokens } = extractBrandAndModelTerms(ai.name)
      if (aiTokens.length === 0) { noMatch++; continue }

      // Find best match
      const candidateScores = new Map<string, { score: number; url: string; brand: string }>()
      for (const token of aiTokens) {
        const candidates = invertedIndex.get(token)
        if (!candidates) continue
        for (const c of candidates) {
          const key = c.url
          const prev = candidateScores.get(key) || { score: 0, url: c.url, brand: c.brand }
          prev.score += (c.brand === aiBrand && aiBrand) ? 4 : 1
          candidateScores.set(key, prev)
        }
      }

      // Get best candidate (score >= 2)
      let bestMatch: { url: string; brand: string; score: number } | null = null
      for (const c of candidateScores.values()) {
        if (c.score >= 2 && (!bestMatch || c.score > bestMatch.score)) bestMatch = c
      }

      if (!bestMatch) { noMatch++; continue }

      // Download and convert
      const imageData = await downloadAndConvertToWebp(bestMatch.url)
      if (!imageData) { failed++; continue }

      // Store
      const imageId = crypto.randomUUID()
      await db.execute({
        sql: `INSERT INTO product_images (id, data, size, width, height, createdAt) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        args: [imageId, imageData.data, imageData.size, imageData.width, imageData.height],
      })
      await db.execute({
        sql: `UPDATE products SET images = ?, updatedAt = datetime('now') WHERE id = ?`,
        args: [JSON.stringify([`/api/image/${imageId}`]), ai.id],
      })

      enriched++
    }

    // Count remaining
    const remaining = await db.execute({
      sql: `SELECT COUNT(*) as c FROM products WHERE providerId = 'air-intra-1780331633566' AND (images = '[]' OR images IS NULL OR images = '') AND isActive = 1`,
    })

    return NextResponse.json({
      ok: true,
      enriched,
      noMatch,
      failed,
      remaining: (remaining.rows[0] as any).c,
      message: `Cross-copy: ${enriched} enriquecidos, ${noMatch} sin match, ${failed} fallidos. Quedan ${(remaining.rows[0] as any).c} sin imagen.`,
    })

  } catch (error: any) {
    console.error('[enrich-images] Cross-copy error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
