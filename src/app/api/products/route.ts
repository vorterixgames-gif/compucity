import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchDollarRate, getStoreConfigNumber, calculateProductPrices } from '@/lib/dollar'
import { getCategoryMarkupMap } from '@/lib/queries'

// Sesión 43: cache 5 min en CDN + navegador para reducir queries Turso.
// Esta API devuelve datos de un producto (precio, stock, etc) que cambian
// como mucho 1-2 veces por día (cron sync). 5 min de staleness es aceptable.
// Para forzar refresh, el admin puede tocar el producto desde /admin/productos
// (ese endpoint no usa este caché).
export const revalidate = 300

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ ok: false, error: 'Missing id parameter' }, { status: 400 })
  }

  try {
    // Sesión 44: getCategoryMarkupMap cachea 5 min las 73 filas de categories,
    // evitando 1 SELECT extra en cada request a este endpoint.
    const [result, dollar, markup, cashDiscount, catMarkupMap] = await Promise.all([
      db.execute({
        sql: 'SELECT * FROM products WHERE id = ? AND isActive = 1',
        args: [id],
      }),
      fetchDollarRate(),
      getStoreConfigNumber('markup', 30),
      getStoreConfigNumber('cash_discount', 10),
      getCategoryMarkupMap(),
    ])

    const rows = result.rows as any[]
    if (!rows[0]) {
      return NextResponse.json({ ok: false, error: 'Product not found' }, { status: 404 })
    }

    const catMarkup = rows[0].categoryId ? catMarkupMap.get(rows[0].categoryId) : null
    const product = calculateProductPrices(rows[0], dollar.rate, markup, cashDiscount, catMarkup)

    // Headers de cache: CDN 5 min, navegador 5 min, stale-while-revalidate 1h
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
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    })
  } catch (error) {
    console.error('Product API error:', error)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
