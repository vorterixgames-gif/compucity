import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

const MAX_IMAGE_WIDTH = 800
const WEBP_QUALITY = 75
const MAX_IMAGE_SIZE_KB = 150

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

async function downloadAndConvertToWebp(imageUrl: string): Promise<{
  data: string
  size: number
  width: number
  height: number
} | null> {
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

    if (buffer.length > 5 * 1024 * 1024) return null

    const sharp = (await import('sharp')).default

    const webpBuffer = await sharp(buffer)
      .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_WIDTH, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 6 })
      .toBuffer()

    const metadata = await sharp(webpBuffer).metadata()

    let finalBuffer = webpBuffer
    if (webpBuffer.length > MAX_IMAGE_SIZE_KB * 1024) {
      const reducedBuffer = await sharp(buffer)
        .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_WIDTH, { fit: 'inside', withoutEnlargement: true })
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
    console.log(`[enrich-images] Download error: ${err.message}`)
    return null
  }
}

/**
 * Generate an AI product image and save it to the database.
 * Returns true if successful, false otherwise.
 */
async function generateAndSaveAIImage(
  productName: string,
  brand: string,
  productId: string,
  zai: any
): Promise<{ ok: boolean; width?: number; height?: number; sizeKB?: number; error?: string }> {
  try {
    const prompt = `Professional product photo of ${productName}${brand ? ` by ${brand}` : ''}, isolated on white background, studio lighting, e-commerce style, high quality product photography, no text, no watermark`

    console.log(`[enrich-images] AI generating: "${prompt.substring(0, 80)}..."`)

    const aiImage = await zai.images.generations.create({
      prompt,
      size: '1024x1024',
    })

    const base64Data = aiImage.data?.[0]?.base64
    if (!base64Data) {
      return { ok: false, error: 'No base64 data in AI response' }
    }

    const sharp = (await import('sharp')).default
    const buffer = Buffer.from(base64Data, 'base64')

    const webpBuffer = await sharp(buffer)
      .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_WIDTH, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 6 })
      .toBuffer()

    const metadata = await sharp(webpBuffer).metadata()

    const imageId = crypto.randomUUID()
    await db.execute({
      sql: `INSERT INTO product_images (id, data, size, width, height, createdAt) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      args: [imageId, webpBuffer.toString('base64'), webpBuffer.length, metadata.width || 0, metadata.height || 0],
    })

    const imagePath = `/api/image/${imageId}`
    await db.execute({
      sql: 'UPDATE products SET images = ?, updatedAt = ? WHERE id = ?',
      args: [JSON.stringify([imagePath]), new Date().toISOString(), productId],
    })

    return {
      ok: true,
      width: metadata.width || 0,
      height: metadata.height || 0,
      sizeKB: Math.round(webpBuffer.length / 1024),
    }
  } catch (err: any) {
    console.log(`[enrich-images] AI generation error: ${err.message}`)
    return { ok: false, error: err.message?.substring(0, 100) }
  }
}

/**
 * POST /api/admin/suppliers/enrich-images
 *
 * Strategy: AI FIRST (reliable), web search as bonus (for real photos)
 * This ensures every product gets an image, even if web search fails.
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

    // Build query
    let query: string
    let args: any[]

    if (body.productIds && Array.isArray(body.productIds) && body.productIds.length > 0) {
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
                 AND p.isActive = 1 AND p.stock > 0 AND p.categoryId IS NOT NULL
               ORDER BY p.updatedAt ASC LIMIT ?`
      args = [batchSize]
    } else {
      query = `SELECT p.id, p.name, p.sku, p.providerSku, p.specs, s.apiType
               FROM products p
               JOIN suppliers s ON p.providerId = s.id
               WHERE s.apiType = ?
                 AND (p.images = '[]' OR p.images IS NULL OR p.images = '')
                 AND p.isActive = 1 AND p.stock > 0 AND p.categoryId IS NOT NULL
               ORDER BY p.updatedAt ASC LIMIT ?`
      args = [providerType, batchSize]
    }

    const products = await db.execute({ sql: query, args })

    if (products.rows.length === 0) {
      return NextResponse.json({
        ok: true, enriched: 0, remaining: 0,
        message: 'Todos los productos ya tienen imágenes',
      })
    }

    // Count remaining
    let countQuery: string
    let countArgs: any[]

    if (body.productIds && Array.isArray(body.productIds) && body.productIds.length > 0) {
      countQuery = `SELECT COUNT(*) as total FROM products WHERE (images = '[]' OR images IS NULL OR images = '') AND isActive = 1`
      countArgs = []
    } else if (providerType === 'all') {
      countQuery = `SELECT COUNT(*) as total FROM products p JOIN suppliers s ON p.providerId = s.id
                    WHERE s.apiType = ? AND (p.images = '[]' OR p.images IS NULL OR p.images = '')
                      AND p.isActive = 1 AND p.stock > 0 AND p.categoryId IS NOT NULL`
      countArgs = [providerType]
    } else {
      countQuery = `SELECT COUNT(*) as total FROM products p JOIN suppliers s ON p.providerId = s.id
                    WHERE s.apiType = ? AND (p.images = '[]' OR p.images IS NULL OR p.images = '')
                      AND p.isActive = 1 AND p.stock > 0 AND p.categoryId IS NOT NULL`
      countArgs = [providerType]
    }

    const remaining = await db.execute({ sql: countQuery, args: countArgs })
    const totalRemaining = (remaining.rows[0] as any).total

    let enriched = 0
    let failed = 0
    const errors: string[] = []

    // Init ZAI
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
        const { id, name, specs } = product

        let brand = ''
        try {
          const specsObj = JSON.parse(specs || '{}')
          brand = specsObj['Marca'] || ''
        } catch {}

        const cleanName = name.replace(/\s*\((Elit|Air Intra|Invid|Vorterix)\)\s*/g, '').trim()

        console.log(`[enrich-images] Processing: "${cleanName}"`)

        // ============================================================
        // Strategy 1: AI Image Generation — MOST RELIABLE
        // We know ZAI SDK works on Vercel (descriptions use it daily)
        // ============================================================
        const aiResult = await generateAndSaveAIImage(cleanName, brand, id, zai)

        if (aiResult.ok) {
          enriched++
          console.log(`[enrich-images] ✓ AI: ${name} ${aiResult.width}x${aiResult.height} ${aiResult.sizeKB}KB`)
          continue
        }

        // ============================================================
        // Strategy 2: Web search + Microlink (bonus for real photos)
        // Only try if AI generation failed
        // ============================================================
        let foundRealImage = false
        try {
          const searchQuery = `${cleanName} amazon`
          console.log(`[enrich-images] Trying web search for real photo: "${searchQuery}"`)

          const raw = await zai.functions.invoke('web_search', { query: searchQuery, num: 3 })
          const searchResults = Array.isArray(raw) ? raw : []

          // Sort Amazon URLs first
          const candidates = searchResults
            .filter((r: any) => r.url?.startsWith('http') && !['youtube', 'facebook', 'twitter', 'instagram', 'tiktok', 'reddit'].some(d => (r.host_name || '').includes(d)))
            .sort((a: any, b: any) => ((b.host_name || '').includes('amazon') ? 1 : 0) - ((a.host_name || '').includes('amazon') ? 1 : 0))

          for (const candidate of candidates.slice(0, 2)) {
            try {
              const mlUrl = `https://api.microlink.io/?url=${encodeURIComponent(candidate.url)}`
              const mlRes = await fetch(mlUrl, { signal: AbortSignal.timeout(12000) })
              if (!mlRes.ok) continue

              const mlData = await mlRes.json()
              if (mlData.status !== 'success') continue

              const extractedImage = mlData.data?.image?.url
              if (!extractedImage) continue

              const imgLower = extractedImage.toLowerCase()
              if (imgLower.includes('logo') || imgLower.includes('icon') || imgLower.includes('favicon') ||
                  imgLower.includes('banner') || imgLower.includes('sprite') || imgLower.endsWith('.svg') ||
                  imgLower.includes('meta_banner') || imgLower.includes('placeholder')) continue

              const imageUrl = extractedImage.startsWith('//') ? 'https:' + extractedImage : extractedImage

              // Download and save
              const imageData = await downloadAndConvertToWebp(imageUrl)
              if (imageData) {
                // Remove the AI image we just saved and replace with real photo
                // (the product already has an AI image from strategy 1, but since AI failed, this is fine)
                const imageId = crypto.randomUUID()
                await db.execute({
                  sql: `INSERT INTO product_images (id, data, size, width, height, createdAt) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
                  args: [imageId, imageData.data, imageData.size, imageData.width, imageData.height],
                })
                await db.execute({
                  sql: 'UPDATE products SET images = ?, updatedAt = ? WHERE id = ?',
                  args: [JSON.stringify([`/api/image/${imageId}`]), new Date().toISOString(), id],
                })

                enriched++
                foundRealImage = true
                console.log(`[enrich-images] ✓ Real photo via Microlink/${candidate.host_name}: ${name}`)
                break
              }
            } catch { continue }
          }
        } catch (err: any) {
          console.log(`[enrich-images] Web search error: ${err.message?.substring(0, 60)}`)
        }

        if (!foundRealImage) {
          failed++
          errors.push(`${name}: ${aiResult.error || 'sin imagen'}`)
        }

        // Small delay between products
        await new Promise(resolve => setTimeout(resolve, 300))

      } catch (err: any) {
        failed++
        errors.push(`${product.name}: ${err.message}`)
        console.error(`[enrich-images] Error:`, err)
      }
    }

    return NextResponse.json({
      ok: true,
      processed: products.rows.length,
      enriched,
      failed,
      remaining: totalRemaining - enriched,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      message: `${enriched} productos con imágenes, ${failed} fallidos. Quedan ${totalRemaining - enriched} sin imagen.`,
    })

  } catch (error: any) {
    console.error('[enrich-images] Fatal error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

// ============================================
// CROSS-PROVIDER IMAGE COPY
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

    const withImages = await db.execute({
      sql: `SELECT p.name, p.images FROM products p
            JOIN suppliers s ON p.providerId = s.id
            WHERE s.name IN ('Elit', 'Invid Computers')
              AND p.images != '[]' AND p.images IS NOT NULL AND p.isActive = 1`,
    })

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

    let enriched = 0
    let noMatch = 0
    let failed = 0

    for (const ai of airIntra.rows as any[]) {
      const { brand: aiBrand, tokens: aiTokens } = extractBrandAndModelTerms(ai.name)
      if (aiTokens.length === 0) { noMatch++; continue }

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

      let bestMatch: { url: string; brand: string; score: number } | null = null
      for (const c of candidateScores.values()) {
        if (c.score >= 2 && (!bestMatch || c.score > bestMatch.score)) bestMatch = c
      }

      if (!bestMatch) { noMatch++; continue }

      const imageData = await downloadAndConvertToWebp(bestMatch.url)
      if (!imageData) { failed++; continue }

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

    const remaining = await db.execute({
      sql: `SELECT COUNT(*) as c FROM products WHERE providerId = 'air-intra-1780331633566' AND (images = '[]' OR images IS NULL OR images = '') AND isActive = 1`,
    })

    return NextResponse.json({
      ok: true, enriched, noMatch, failed,
      remaining: (remaining.rows[0] as any).c,
      message: `Cross-copy: ${enriched} enriquecidos, ${noMatch} sin match, ${failed} fallidos. Quedan ${(remaining.rows[0] as any).c} sin imagen.`,
    })

  } catch (error: any) {
    console.error('[enrich-images] Cross-copy error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
