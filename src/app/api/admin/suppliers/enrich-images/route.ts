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

        // Build search query - keep it focused on product image search
        let searchQuery = name
        if (brand && !name.toUpperCase().includes(brand.toUpperCase())) {
          searchQuery = `${brand} ${name}`
        }

        console.log(`[enrich-images] Searching: "${searchQuery}"`)

        // Search the web for product images
        const searchResults = await zai.functions.invoke('web_search', {
          query: `${searchQuery} product image`,
          num: 5,
        })

        if (!searchResults || !Array.isArray(searchResults) || searchResults.length === 0) {
          failed++
          errors.push(`${name}: sin resultados de búsqueda`)
          continue
        }

        // Strategy: Find an image URL from search results
        // First try og:image from official brand pages, then from retail sites
        let imageUrl: string | null = null

        // Priority 1: Try official brand domains
        const brandDomains = [
          'asus.com', 'rog.asus.com', 'logitech.com', 'corsair.com', 'razer.com',
          'msi.com', 'gigabyte.com', 'lenovo.com', 'hp.com', 'dell.com',
          'kingston.com', 'hyperx.com', 'steelseries.com', 'coolermaster.com',
          'nzxt.com', 'bequiet.com', 'thermaltake.com', 'tplink.com', 'netgear.com',
          'intel.com', 'amd.com', 'nvidia.com', 'asrock.com', 'adata.com',
          'crucial.com', 'wd.com', 'seagate.com', 'samsung.com', 'lg.com',
          'tp-link.com', 'apc.com', 'geniusnet.com', 'gamemax.com',
        ]

        // Priority 2: Retail sites with good images
        const retailDomains = [
          'mercadolibre.com.ar', 'amazon.com', 'newegg.com', 'linio.com',
          'fravega.com', 'garbarino.com', 'comeros.com.ar',
        ]

        const allPreferredDomains = [...brandDomains, ...retailDomains]

        for (const result of searchResults as any[]) {
          const url = result.url || ''
          const hostName = result.host_name || ''

          const isPreferred = allPreferredDomains.some(d => hostName.includes(d))
          if (!isPreferred) continue

          try {
            // Use web-reader to get page content and extract og:image
            const pageResult = await zai.functions.invoke('page_reader', { url })
            const html = pageResult?.data?.html || pageResult?.html || ''

            if (html) {
              // Look for og:image meta tag (most reliable)
              const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
                || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)

              if (ogMatch && ogMatch[1]) {
                imageUrl = ogMatch[1].replace(/&amp;/g, '&')
                // Validate it's an image URL
                if (
                  imageUrl.includes('.jpg') || imageUrl.includes('.jpeg') ||
                  imageUrl.includes('.png') || imageUrl.includes('.webp') ||
                  imageUrl.includes('/image') || imageUrl.includes('/img') ||
                  imageUrl.includes('/photo') || imageUrl.includes('/product') ||
                  imageUrl.includes('format=') || imageUrl.includes('cdn')
                ) {
                  console.log(`[enrich-images] Found og:image from ${hostName}: ${imageUrl}`)
                  break
                }
                imageUrl = null // Not a valid image URL, reset
              }

              // Fallback: look for product images in img tags
              if (!imageUrl) {
                const imgMatches = [...html.matchAll(/<img[^>]*src=["']([^"']+)["']/gi)]
                for (const imgMatch of imgMatches) {
                  const src = imgMatch[1].replace(/&amp;/g, '&')
                  // Skip logos, icons, banners, tracking pixels
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
                    (src.includes('.jpg') && src.length > 30)
                  ) {
                    if (src.startsWith('//')) imageUrl = 'https:' + src
                    else if (src.startsWith('/')) imageUrl = `https://${hostName}${src}`
                    else if (src.startsWith('http')) imageUrl = src
                    if (imageUrl) break
                  }
                }
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

        // Priority 3: Try any search result if no image from preferred domains
        if (!imageUrl) {
          for (const result of searchResults as any[]) {
            const url = result.url || ''
            const hostName = result.host_name || ''

            // Skip non-HTTP results
            if (!url.startsWith('http')) continue
            // Skip already tried preferred domains
            if (allPreferredDomains.some(d => hostName.includes(d))) continue
            // Skip irrelevant domains
            if (
              hostName.includes('youtube') || hostName.includes('facebook') ||
              hostName.includes('twitter') || hostName.includes('instagram') ||
              hostName.includes('tiktok') || hostName.includes('pinterest')
            ) continue

            try {
              const pageResult = await zai.functions.invoke('page_reader', { url })
              const html = pageResult?.data?.html || pageResult?.html || ''

              if (html) {
                const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
                  || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)

                if (ogMatch && ogMatch[1]) {
                  const candidate = ogMatch[1].replace(/&amp;/g, '&')
                  // Validate it looks like a product image
                  if (
                    !candidate.includes('logo') && !candidate.includes('icon') &&
                    !candidate.includes('avatar') && !candidate.endsWith('.svg')
                  ) {
                    imageUrl = candidate
                    console.log(`[enrich-images] Found og:image from ${hostName}: ${imageUrl}`)
                    break
                  }
                }
              }
            } catch {
              // Skip this result
            }
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
