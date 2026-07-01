import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchDollarRate, getStoreConfigNumber, calculateProductPrices } from '@/lib/dollar'
import { getCategoryMarkupMap } from '@/lib/queries'

// Search endpoint: query directa + cálculo de precios solo para los 6 resultados.
// Antes usaba searchProducts() que hacía 2 queries LIKE secuenciales + 3 queries de config
// + calculateProductPrices + enrichWithBrandInfo + deduplicateProducts para 20 productos.
// Ahora: 1 query LIKE + 3 queries config en paralelo + cálculo de precios para 6 productos.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ ok: true, products: [] })
  }

  const searchTerm = q.trim()
  const limit = 6

  try {
    // Paso 1: Query directa con LIKE + traer datos para cálculo de precios
    // Seleccionamos columnas necesarias para calculateProductPrices
    const result = await db.execute({
      sql: `SELECT id, name, slug, price, comparePrice, costPrice, images,
                   categoryId, brandId, isActive, stock, markup, cashDiscount, ivaRate,
                   internalTaxRate, salePrice, saleStart, saleEnd
            FROM products
            WHERE isActive = 1 AND stock > 0 AND name LIKE ?
            ORDER BY CASE WHEN images IS NOT NULL AND images != '[]' THEN 0 ELSE 1 END,
                     COALESCE(createdAt, updatedAt) DESC
            LIMIT ?`,
      args: [`%${searchTerm}%`, limit],
    })

    if (result.rows.length === 0) {
      return NextResponse.json({ ok: true, products: [] })
    }

    // Paso 2: Calcular precios con cotización actual (en paralelo con config)
    const [dollar, markup, cashDiscount, catMarkupMap] = await Promise.all([
      fetchDollarRate(),
      getStoreConfigNumber('markup', 30),
      getStoreConfigNumber('cash_discount', 10),
      getCategoryMarkupMap(),
    ])

    // Paso 3: Aplicar calculateProductPrices a cada resultado
    const products = (result.rows as any[]).map((p) => {
      const calculated = calculateProductPrices(p, dollar.rate, markup, cashDiscount, p.categoryId ? catMarkupMap.get(p.categoryId) : null)
      return {
        id: calculated.id,
        name: calculated.name,
        slug: calculated.slug,
        price: calculated.price,
        comparePrice: calculated.comparePrice,
        images: calculated.images ? (() => { try { return JSON.parse(calculated.images) } catch { return [] } })() : [],
      }
    })

    return NextResponse.json({ ok: true, products })
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ ok: true, products: [] })
  }
}
