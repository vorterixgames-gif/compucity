import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchDollarRate, getStoreConfigNumber, calculateProductPrices } from '@/lib/dollar'

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ ok: false, error: 'Missing id parameter' }, { status: 400 })
  }

  try {
    const [result, dollar, markup, cashDiscount] = await Promise.all([
      db.execute({
        sql: 'SELECT * FROM products WHERE id = ? AND isActive = 1',
        args: [id],
      }),
      fetchDollarRate(),
      getStoreConfigNumber('markup', 30),
      getStoreConfigNumber('cash_discount', 10),
    ])

    const rows = result.rows as any[]
    if (!rows[0]) {
      return NextResponse.json({ ok: false, error: 'Product not found' }, { status: 404 })
    }

    const product = calculateProductPrices(rows[0], dollar.rate, markup, cashDiscount)

    return NextResponse.json({
      ok: true,
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        comparePrice: product.comparePrice,
        images: product.images,
        stock: product.stock,
      },
    })
  } catch (error) {
    console.error('Product API error:', error)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
