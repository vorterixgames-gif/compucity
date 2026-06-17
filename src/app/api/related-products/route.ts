import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchDollarRate, getStoreConfigNumber, calculateProductPrices, CategoryMarkup } from '@/lib/dollar'
import { deduplicateProducts } from '@/lib/queries'

// Sesión 43: cache 5 min en CDN. Productos relacionados cambian solo cuando
// cambian los productos del catálogo (cron sync diario). 5 min OK.
export const revalidate = 300

export async function GET(request: NextRequest) {
  const categoryId = request.nextUrl.searchParams.get('categoryId')
  const productId = request.nextUrl.searchParams.get('productId')

  if (!productId) {
    return NextResponse.json({ ok: false, error: 'Missing productId parameter' }, { status: 400 })
  }

  try {
    const [dollar, markup, cashDiscount, catMarkupResult] = await Promise.all([
      fetchDollarRate(),
      getStoreConfigNumber('markup', 30),
      getStoreConfigNumber('cash_discount', 10),
      db.execute('SELECT id, markup, cashDiscount, ivaRate FROM categories'),
    ])

    const catMarkupMap = new Map<string, CategoryMarkup>()
    for (const row of catMarkupResult.rows as any[]) {
      catMarkupMap.set(row.id, {
        markup: row.markup != null ? Number(row.markup) : null,
        cashDiscount: row.cashDiscount != null ? Number(row.cashDiscount) : null,
        ivaRate: row.ivaRate != null ? Number(row.ivaRate) : null,
      })
    }

    let result

    if (categoryId) {
      // Fetch products from the same category, excluding the current product
      result = await db.execute({
        sql: `SELECT * FROM products
              WHERE categoryId = ? AND id != ? AND isActive = 1 AND stock > 0 AND categoryId IS NOT NULL
              ORDER BY CASE WHEN images IS NOT NULL AND images != '[]' THEN 0 ELSE 1 END, createdAt DESC
              LIMIT 4`,
        args: [categoryId, productId],
      })
    } else {
      // No category: return latest active products excluding the current one
      result = await db.execute({
        sql: `SELECT * FROM products
              WHERE id != ? AND isActive = 1 AND stock > 0 AND categoryId IS NOT NULL
              ORDER BY CASE WHEN images IS NOT NULL AND images != '[]' THEN 0 ELSE 1 END, createdAt DESC
              LIMIT 4`,
        args: [productId],
      })
    }

    const deduped = deduplicateProducts((result.rows as any[]).map((p) => {
      const catMarkup = p.categoryId ? catMarkupMap.get(p.categoryId) : null
      return calculateProductPrices(p, dollar.rate, markup, cashDiscount, catMarkup)
    }))

    const products = deduped.map((calculated) => {
      const images: string[] = calculated.images ? JSON.parse(calculated.images) : []
      return {
        id: calculated.id,
        name: calculated.name,
        slug: calculated.slug,
        price: calculated.price,
        comparePrice: calculated.comparePrice,
        image: images[0] || null,
        stock: calculated.stock,
        salePrice: calculated.salePrice ?? null,
        saleStart: calculated.saleStart ?? null,
        saleEnd: calculated.saleEnd ?? null,
      }
    })

    return NextResponse.json({ ok: true, products }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    })
  } catch (error) {
    console.error('Related products API error:', error)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
