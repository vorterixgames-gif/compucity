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
    // Sesión 51: agregar JOIN con brands para buscar también por marca
    // (ej: "Redragon" ahora encuentra productos cuyo name no tiene "Redragon"
    // pero están asignados a esa marca vía brandId).
    const searchTermLike = `%${searchTerm}%`
    const result = await db.execute({
      sql: `SELECT p.id, p.name, p.slug, p.price, p.comparePrice, p.costPrice, p.images,
                   p.categoryId, p.brandId, p.isActive, p.stock, p.markup, p.cashDiscount, p.ivaRate,
                   p.internalTaxRate, p.salePrice, p.saleStart, p.saleEnd
            FROM products p
            LEFT JOIN brands b ON p.brandId = b.id
            WHERE p.isActive = 1 AND p.stock > 0
              AND (p.name LIKE ? OR p.sku LIKE ? OR b.name LIKE ?)
            ORDER BY CASE WHEN p.images IS NOT NULL AND p.images != '[]' THEN 0 ELSE 1 END,
                     COALESCE(p.createdAt, p.updatedAt) DESC
            LIMIT ?`,
      args: [searchTermLike, searchTermLike, searchTermLike, limit],
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
