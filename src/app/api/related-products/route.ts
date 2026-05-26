import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchDollarRate, getStoreConfigNumber, calculateProductPrices } from '@/lib/dollar'

export async function GET(request: NextRequest) {
  const categoryId = request.nextUrl.searchParams.get('categoryId')
  const productId = request.nextUrl.searchParams.get('productId')

  if (!productId) {
    return NextResponse.json({ ok: false, error: 'Missing productId parameter' }, { status: 400 })
  }

  try {
    const [dollar, markup, cashDiscount] = await Promise.all([
      fetchDollarRate(),
      getStoreConfigNumber('markup', 30),
      getStoreConfigNumber('cash_discount', 10),
    ])

    let result

    if (categoryId) {
      // Fetch products from the same category, excluding the current product
      result = await db.execute({
        sql: `SELECT * FROM products
              WHERE categoryId = ? AND id != ? AND isActive = 1
              ORDER BY createdAt DESC
              LIMIT 4`,
        args: [categoryId, productId],
      })
    } else {
      // No category: return latest active products excluding the current one
      result = await db.execute({
        sql: `SELECT * FROM products
              WHERE id != ? AND isActive = 1
              ORDER BY createdAt DESC
              LIMIT 4`,
        args: [productId],
      })
    }

    const products = (result.rows as any[]).map((p) => {
      const calculated = calculateProductPrices(p, dollar.rate, markup, cashDiscount)
      const images: string[] = calculated.images ? JSON.parse(calculated.images) : []
      return {
        id: calculated.id,
        name: calculated.name,
        slug: calculated.slug,
        price: calculated.price,
        comparePrice: calculated.comparePrice,
        image: images[0] || null,
        stock: calculated.stock,
      }
    })

    return NextResponse.json({ ok: true, products })
  } catch (error) {
    console.error('Related products API error:', error)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
