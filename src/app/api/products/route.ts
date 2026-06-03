import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchDollarRate, getStoreConfigNumber, calculateProductPrices, CategoryMarkup } from '@/lib/dollar'

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ ok: false, error: 'Missing id parameter' }, { status: 400 })
  }

  try {
    const [result, dollar, markup, cashDiscount, catMarkupResult] = await Promise.all([
      db.execute({
        sql: 'SELECT * FROM products WHERE id = ? AND isActive = 1',
        args: [id],
      }),
      fetchDollarRate(),
      getStoreConfigNumber('markup', 30),
      getStoreConfigNumber('cash_discount', 10),
      db.execute('SELECT id, markup, cashDiscount FROM categories'),
    ])

    const catMarkupMap = new Map<string, CategoryMarkup>()
    for (const row of catMarkupResult.rows as any[]) {
      catMarkupMap.set(row.id, {
        markup: row.markup != null ? Number(row.markup) : null,
        cashDiscount: row.cashDiscount != null ? Number(row.cashDiscount) : null,
      })
    }

    const rows = result.rows as any[]
    if (!rows[0]) {
      return NextResponse.json({ ok: false, error: 'Product not found' }, { status: 404 })
    }

    const catMarkup = rows[0].categoryId ? catMarkupMap.get(rows[0].categoryId) : null
    const product = calculateProductPrices(rows[0], dollar.rate, markup, cashDiscount, catMarkup)

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
        salePrice: product.salePrice ?? null,
        saleStart: product.saleStart ?? null,
        saleEnd: product.saleEnd ?? null,
      },
    })
  } catch (error) {
    console.error('Product API error:', error)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
