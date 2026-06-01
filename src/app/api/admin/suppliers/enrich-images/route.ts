import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

/**
 * POST /api/admin/suppliers/enrich-images
 *
 * Enriches Air Intra products that have no images by searching the web
 * for product images using the product name and part_number.
 *
 * Body: { batchSize?: number } (default: 20, max: 50)
 *
 * This endpoint processes a batch of products at a time to avoid
 * overwhelming the web search API. Call it repeatedly until all
 * products are enriched.
 */
export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const batchSize = Math.min(Math.max(body.batchSize || 20, 1), 50)

    // Get Air Intra products without images (visible ones only)
    const products = await db.execute({
      sql: `SELECT id, name, sku, providerSku, specs
            FROM products
            WHERE providerId LIKE 'air-intra%'
              AND images = '[]'
              AND stock > 0
              AND categoryId IS NOT NULL
            ORDER BY updatedAt ASC
            LIMIT ?`,
      args: [batchSize],
    })

    if (products.rows.length === 0) {
      return NextResponse.json({
        ok: true,
        enriched: 0,
        remaining: 0,
        message: 'Todos los productos de Air Intra ya tienen imágenes',
      })
    }

    // Count remaining products without images
    const remaining = await db.execute({
      sql: `SELECT COUNT(*) as total FROM products
            WHERE providerId LIKE 'air-intra%'
              AND images = '[]'
              AND stock > 0
              AND categoryId IS NOT NULL`,
      args: [],
    })

    const totalRemaining = (remaining.rows[0] as any).total
    let enriched = 0
    let failed = 0
    const errors: string[] = []

    // Use z-ai-web-dev-sdk for web search
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    for (const product of products.rows as any[]) {
      try {
        const { id, name, providerSku } = product

        // Parse specs to get part_number
        let partNumber = ''
        try {
          const specs = JSON.parse(product.specs || '{}')
          partNumber = specs['Part Number'] || specs['Marca'] || ''
        } catch {}

        // Build search query - use part_number + product name for better results
        const searchQuery = partNumber
          ? `${partNumber} ${name} product image`
          : `${name} product image`

        console.log(`[enrich-images] Searching: "${searchQuery}"`)

        // Search the web for product images
        const searchResults = await zai.functions.invoke('web_search', {
          query: searchQuery,
          num: 5,
        })

        if (!searchResults || !Array.isArray(searchResults) || searchResults.length === 0) {
          failed++
          continue
        }

        // Try to find an image URL from search results
        // Look for URLs from known retailers/manufacturers that typically have product images
        let imageUrl: string | null = null

        // First, try to get image from manufacturer/retailer pages
        const preferredDomains = [
          'asus.com', 'logitech.com', 'corsair.com', 'razer.com', 'msi.com',
          'gigabyte.com', 'lenovo.com', 'hp.com', 'dell.com', 'samsung.com',
          'lg.com', 'benq.com', 'viewsonic.com', 'acer.com', 'apc.com',
          'kingston.com', 'wd.com', 'seagate.com', 'crucial.com', 'adata.com',
          'coolermaster.com', 'nzxt.com', 'bequiet.com', 'thermaltake.com',
          'hyperx.com', 'steelseries.com', 'epson.com', 'brother.com',
          'tplink.com', 'netgear.com', 'ubiquiti.com', 'intel.com', 'amd.com',
          'nvidia.com', 'asrock.com', 'biostar.com', 'evga.com',
          'mercadolibre.com.ar', 'amazon.com', 'newegg.com',
        ]

        for (const result of searchResults as any[]) {
          const url = result.url || ''
          const snippet = result.snippet || ''
          const hostName = result.host_name || ''

          // Check if this is from a preferred domain
          const isPreferred = preferredDomains.some(d => hostName.includes(d))

          if (isPreferred && !imageUrl) {
            // Try to extract an image URL from this page
            // For now, we'll use the web reader to get the page content
            try {
              const pageContent = await zai.functions.invoke('web_reader', {
                url: url,
              })

              if (pageContent && pageContent.html) {
                // Extract the first product image from the HTML
                // Look for og:image meta tag first (most reliable)
                const ogImageMatch = pageContent.html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
                  || pageContent.html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)

                if (ogImageMatch && ogImageMatch[1]) {
                  imageUrl = ogImageMatch[1]
                  console.log(`[enrich-images] Found og:image for ${name}: ${imageUrl}`)
                  break
                }

                // Fallback: look for large product images in img tags
                const imgMatches = pageContent.html.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi)
                if (imgMatches) {
                  for (const imgTag of imgMatches) {
                    const srcMatch = imgTag.match(/src=["']([^"']+)["']/i)
                    if (srcMatch && srcMatch[1]) {
                      const src = srcMatch[1]
                      // Skip tiny icons, logos, and common non-product images
                      if (
                        src.includes('product') ||
                        src.includes('item') ||
                        src.includes('gallery') ||
                        src.includes('zoom') ||
                        (src.includes('.jpg') && !src.includes('icon') && !src.includes('logo') && !src.includes('banner'))
                      ) {
                        // Make URL absolute if needed
                        if (src.startsWith('//')) {
                          imageUrl = 'https:' + src
                        } else if (src.startsWith('/')) {
                          imageUrl = 'https://' + hostName + src
                        } else if (src.startsWith('http')) {
                          imageUrl = src
                        }

                        if (imageUrl) {
                          console.log(`[enrich-images] Found img for ${name}: ${imageUrl}`)
                          break
                        }
                      }
                    }
                  }
                  if (imageUrl) break
                }
              }
            } catch (err) {
              console.log(`[enrich-images] Error reading page ${url}: ${err}`)
            }
          }
        }

        // If no image found from preferred domains, try MercadoLibre results
        if (!imageUrl) {
          for (const result of searchResults as any[]) {
            const url = result.url || ''
            if (url.includes('mercadolibre') || url.includes('amazon') || url.includes('newegg')) {
              try {
                const pageContent = await zai.functions.invoke('web_reader', {
                  url: url,
                })

                if (pageContent && pageContent.html) {
                  const ogImageMatch = pageContent.html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
                    || pageContent.html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)

                  if (ogImageMatch && ogImageMatch[1]) {
                    imageUrl = ogImageMatch[1]
                    console.log(`[enrich-images] Found og:image from ${url}: ${imageUrl}`)
                    break
                  }
                }
              } catch (err) {
                // Skip this result
              }
            }
          }
        }

        if (imageUrl) {
          // Update the product with the found image
          await db.execute({
            sql: 'UPDATE products SET images = ?, updatedAt = ? WHERE id = ?',
            args: [JSON.stringify([imageUrl]), new Date().toISOString(), id],
          })
          enriched++
          console.log(`[enrich-images] Updated ${name} with image: ${imageUrl}`)
        } else {
          failed++
          console.log(`[enrich-images] No image found for ${name}`)
        }

        // Small delay between searches to be respectful
        await new Promise(resolve => setTimeout(resolve, 500))

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
      message: `${enriched} productos enriquecidos con imágenes, ${failed} sin resultado. Quedan ${totalRemaining - enriched} productos sin imagen.`,
    })

  } catch (error: any) {
    console.error('[enrich-images] Fatal error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
