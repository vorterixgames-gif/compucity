import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchDollarRate, getStoreConfigNumber, calculateProductPrices } from '@/lib/dollar'
import { getCategoryMarkupMap } from '@/lib/queries'

// Search index: JSON con todos los productos activos para búsqueda client-side.
// Los precios ya vienen calculados — el cliente solo filtra por nombre y muestra.
// Cacheado 1 hora en CDN via Cache-Control headers.
// Tamaño estimado: ~300KB sin comprimir, ~80KB gzipped para ~5000 productos.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Cargar productos + config en paralelo
    const [result, dollar, markup, cashDiscount, catMarkupMap] = await Promise.all([
      db.execute({
        sql: `SELECT p.id, p.name, p.slug, p.price, p.comparePrice, p.costPrice, p.images,
                     p.categoryId, p.brandId, p.isActive, p.stock, p.markup, p.cashDiscount,
                     p.ivaRate, p.internalTaxRate, p.salePrice, p.saleStart, p.saleEnd
              FROM products p
              WHERE p.isActive = 1 AND p.stock > 0`,
        args: [],
      }),
      fetchDollarRate(),
      getStoreConfigNumber('markup', 30),
      getStoreConfigNumber('cash_discount', 10),
      getCategoryMarkupMap(),
    ])

    // Mapear a formato liviano con precios calculados
    const products = (result.rows as any[]).map((p) => {
      const calculated = calculateProductPrices(p, dollar.rate, markup, cashDiscount, p.categoryId ? catMarkupMap.get(p.categoryId) : null)
      // Solo los campos que necesita el dropdown de búsqueda
      const effectivePrice = calculated.salePrice != null &&
        calculated.saleStart != null && calculated.saleEnd != null &&
        new Date(calculated.saleStart) <= new Date() &&
        new Date(calculated.saleEnd) >= new Date()
        ? calculated.salePrice
        : calculated.comparePrice && calculated.comparePrice < (calculated.price ?? 0)
          ? calculated.comparePrice
          : calculated.price
      return {
        id: calculated.id,
        n: calculated.name,           // n = name
        s: calculated.slug,           // s = slug
        p: effectivePrice,            // p = price (ya calculado)
      }
    })

    return NextResponse.json(
      { ok: true, products, count: products.length, updatedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 's-maxage=3600, stale-while-revalidate=3600',
        },
      }
    )
  } catch (error) {
    console.error('Search index error:', error)
    return NextResponse.json({ ok: false, products: [], count: 0 })
  }
}
