import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { BRAND_PATTERNS } from '@/lib/brand-patterns'

export async function POST() {
  try {
    const now = new Date().toISOString()

    // Fetch all products
    const productResult = await db.execute({
      sql: 'SELECT id, name FROM products WHERE isActive = 1',
      args: [],
    })
    const products = productResult.rows as unknown as { id: string; name: string }[]

    // Track brand -> product count and brand -> product IDs
    const brandProductCounts = new Map<string, number>()
    const brandProductIds = new Map<string, string[]>()

    // Match each product against brand patterns (first match wins)
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

    // Upsert brands into the brands table
    let created = 0
    let updated = 0

    for (const bp of BRAND_PATTERNS) {
      const count = brandProductCounts.get(bp.slug) || 0

      // Check if brand exists
      const existing = await db.execute({
        sql: 'SELECT id FROM brands WHERE slug = ?',
        args: [bp.slug],
      })

      if (existing.rows.length > 0) {
        // Update product count
        await db.execute({
          sql: 'UPDATE brands SET productCount = ?, updatedAt = ? WHERE slug = ?',
          args: [count, now, bp.slug],
        })
        updated++
      } else if (count > 0) {
        // Only create brands that have at least one product
        const id = crypto.randomUUID()
        await db.execute({
          sql: `INSERT INTO brands (id, name, slug, logoUrl, logoWidth, logoHeight, isActive, "order", productCount, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`,
          args: [
            id,
            bp.name,
            bp.slug,
            `https://cdn.simpleicons.org/${bp.slug}/9ca3af`,
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

    // Optionally update brandId on products (batch)
    let brandIdUpdates = 0
    for (const bp of BRAND_PATTERNS) {
      const brandSlug = bp.slug
      const brandRow = await db.execute({
        sql: 'SELECT id FROM brands WHERE slug = ?',
        args: [brandSlug],
      })
      if (brandRow.rows.length === 0) continue

      const brandId = (brandRow.rows[0] as any).id
      const productIds = brandProductIds.get(brandSlug)
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
