import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'
import { BRAND_PATTERNS } from '@/lib/brand-patterns'

// Sesión 44: agregado auth — antes este endpoint era público y cualquiera podía
// disparar 7K+ queries a Turso (DoS potencial). Ahora requiere admin autenticado.
// Para re-detección automática de brands sin auth, usar GitHub Actions:
//   .github/workflows/sync-brands.yml (corre 1 vez por día)

export async function POST(request: NextRequest) {
  try {
    // Verificar auth de admin
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const now = new Date().toISOString()

    // Fetch all products including specs (for supplier marca field)
    const productResult = await db.execute({
      sql: 'SELECT id, name, specs FROM products WHERE isActive = 1',
      args: [],
    })
    const products = productResult.rows as unknown as { id: string; name: string; specs: string }[]

    // Track brand -> product count and brand -> product IDs
    const brandProductCounts = new Map<string, number>()
    const brandProductIds = new Map<string, string[]>()

    // Step 1: Match each product against brand patterns (first match wins)
    for (const product of products) {
      for (const bp of BRAND_PATTERNS) {
        if (bp.pattern.test(product.name)) {
          const key = bp.slug
          brandProductCounts.set(key, (brandProductCounts.get(key) || 0) + 1)
          if (!brandProductIds.has(key)) brandProductIds.set(key, [])
          brandProductIds.get(key)!.push(product.id)
          break
        }
      }
    }

    // Step 2: Detect brands from supplier "marca" field in specs (catches new/unknown brands)
    for (const product of products) {
      // Skip products already matched by regex patterns
      const alreadyMatched = [...brandProductIds.values()].some(ids => ids.includes(product.id))
      if (alreadyMatched) continue

      try {
        const specs = typeof product.specs === 'string' ? JSON.parse(product.specs) : product.specs
        const marca = specs?.['Marca']
        if (!marca || typeof marca !== 'string' || marca.trim().length < 2) continue

        const brandName = marca.trim()
        const slug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        if (!slug) continue

        brandProductCounts.set(slug, (brandProductCounts.get(slug) || 0) + 1)
        if (!brandProductIds.has(slug)) brandProductIds.set(slug, [])
        brandProductIds.get(slug)!.push(product.id)
      } catch { /* invalid specs JSON, skip */ }
    }

    // Upsert brands into the brands table
    let created = 0
    let updated = 0

    for (const [slug, count] of brandProductCounts) {
      // Check if brand exists
      const existing = await db.execute({
        sql: 'SELECT id FROM brands WHERE slug = ?',
        args: [slug],
      })

      if (existing.rows.length > 0) {
        // Update product count
        await db.execute({
          sql: 'UPDATE brands SET productCount = ?, updatedAt = ? WHERE slug = ?',
          args: [count, now, slug],
        })
        updated++
      } else if (count > 0) {
        // Only create brands that have at least one product
        // Find brand name: from patterns first, then generate from slug
        const pattern = BRAND_PATTERNS.find(bp => bp.slug === slug)
        const brandName = pattern?.name || slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        const id = crypto.randomUUID()
        await db.execute({
          sql: `INSERT INTO brands (id, name, slug, logoUrl, logoWidth, logoHeight, isActive, "order", productCount, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`,
          args: [
            id,
            brandName,
            slug,
            `https://cdn.simpleicons.org/${slug}/9ca3af`,
            80,
            24,
            count,
            now,
            now,
          ],
        })
        created++
      }
    }

    // Update brandId on products (batch)
    let brandIdUpdates = 0
    for (const [slug, productIds] of brandProductIds) {
      const brandRow = await db.execute({
        sql: 'SELECT id FROM brands WHERE slug = ?',
        args: [slug],
      })
      if (brandRow.rows.length === 0) continue

      const brandId = (brandRow.rows[0] as any).id
      if (!productIds || productIds.length === 0) continue

      // Only update products that don't have a brandId set yet
      for (const pid of productIds) {
        try {
          const result = await db.execute({
            sql: 'UPDATE products SET brandId = ? WHERE id = ? AND brandId IS NULL',
            args: [brandId, pid],
          })
          if ((result.rowsAffected ?? 0) > 0) brandIdUpdates++
        } catch {
          // Skip if brandId column doesn't exist yet
        }
      }
    }

    // Count totals
    const countResult = await db.execute('SELECT COUNT(*) as total FROM brands')
    const activeResult = await db.execute('SELECT COUNT(*) as total FROM brands WHERE isActive = 1')
    const total = (countResult.rows[0] as any).total
    const active = (activeResult.rows[0] as any).total

    return NextResponse.json({
      ok: true,
      summary: {
        productsScanned: products.length,
        brandsCreatedByPatterns: [...brandProductCounts.keys()].filter(slug => BRAND_PATTERNS.some(bp => bp.slug === slug)).length,
        brandsCreatedByMarca: [...brandProductCounts.keys()].filter(slug => !BRAND_PATTERNS.some(bp => bp.slug === slug)).length,
        brandsCreated: created,
        brandsUpdated: updated,
        brandIdUpdates,
        totalBrands: total,
        activeBrands: active,
      },
    })
  } catch (error) {
    console.error('Init brands error:', error)
    return NextResponse.json({ error: 'Error del servidor', details: String(error) }, { status: 500 })
  }
}
