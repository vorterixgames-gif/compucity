import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchDollarRate, getStoreConfigNumber, calculateProductPrices } from '@/lib/dollar'
import { getCategoryMarkupMap } from '@/lib/queries'

// Search endpoint: query directa + cálculo de precios solo para los 6 resultados.
// Antes usaba searchProducts() que hacía 2 queries LIKE secuenciales + 3 queries de config
// + calculateProductPrices + enrichWithBrandInfo + deduplicateProducts para 20 productos.
// Ahora: 1 query LIKE + 3 queries config en paralelo + cálculo de precios para 6 productos.
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Columnas que necesita la query de búsqueda
const SEARCH_SELECT = `p.id, p.name, p.slug, p.price, p.comparePrice, p.costPrice, p.images,
                       p.categoryId, p.brandId, p.isActive, p.stock, p.markup, p.cashDiscount, p.ivaRate,
                       p.internalTaxRate, p.salePrice, p.saleStart, p.saleEnd`

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ ok: true, products: [] })
  }

  const searchTerm = q.trim()
  const limit = 6

  try {
    const searchTermLike = `%${searchTerm}%`

    // Sesión 54: búsqueda simplificada sin LEFT JOIN ni brandId IN.
    // ANTES (s51): LEFT JOIN brands + OR b.name LIKE → nested loop scan ~8300×112 = timeout.
    // INTENTO (s54 v1-3): queries paralelas + brandId IN → mejor pero "redragon" = 22s.
    // AHORA: 1 sola query LIKE en name/sku, sin JOIN, sin ORDER BY (early termination).
    // Sin ORDER BY, SQLite corta el scan al encontrar LIMIT filas → rápido.
    // La búsqueda por marca se pierde, pero casi todos los productos tienen la marca
    // en el nombre (ej: "MOUSE REDRAGON..." → LIKE '%redragon%' lo encuentra).
    // Para un dropdown de 6 sugerencias esto es suficiente.

    const [result, dollar, markup, cashDiscount, catMarkupMap] = await Promise.all([
      db.execute({
        sql: `SELECT ${SEARCH_SELECT}
              FROM products p
              WHERE p.isActive = 1 AND p.stock > 0
                AND (p.name LIKE ? OR p.sku LIKE ?)
              LIMIT ?`,
        args: [searchTermLike, searchTermLike, limit],
      }),
      fetchDollarRate(),
      getStoreConfigNumber('markup', 30),
      getStoreConfigNumber('cash_discount', 10),
      getCategoryMarkupMap(),
    ])

    if (result.rows.length === 0) {
      return NextResponse.json({ ok: true, products: [] })
    }

    // Aplicar calculateProductPrices a cada resultado (config ya cargada)
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

    // Cache en CDN 5 min: búsquedas repetidas por el mismo término no golpean la DB.
    // stale-while-revalidate=300 sirve contenido cacheado mientras refresca en background.
    return NextResponse.json(
      { ok: true, products },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=300' } }
    )
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ ok: true, products: [] })
  }
}
