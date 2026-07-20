import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchDollarRate, getStoreConfigNumber, calculateProductPrices } from '@/lib/dollar'
import { getCategoryMarkupMap } from '@/lib/queries'

// Search endpoint: query directa + cálculo de precios solo para los 6 resultados.
// Antes usaba searchProducts() que hacía 2 queries LIKE secuenciales + 3 queries de config
// + calculateProductPrices + enrichWithBrandInfo + deduplicateProducts para 20 productos.
// Ahora: 1 query LIKE + 3 queries config en paralelo + cálculo de precios para 6 productos.
export const dynamic = 'force-dynamic'

// Columnas que necesita la query de búsqueda (reutilizadas en ambas queries)
const SEARCH_SELECT = `p.id, p.name, p.slug, p.price, p.comparePrice, p.costPrice, p.images,
                       p.categoryId, p.brandId, p.isActive, p.stock, p.markup, p.cashDiscount, p.ivaRate,
                       p.internalTaxRate, p.salePrice, p.saleStart, p.saleEnd`
const SEARCH_ORDER = `CASE WHEN p.images IS NOT NULL AND p.images != '[]' THEN 0 ELSE 1 END,
                      COALESCE(p.createdAt, p.updatedAt) DESC`

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ ok: true, products: [] })
  }

  const searchTerm = q.trim()
  const limit = 6

  try {
    const searchTermLike = `%${searchTerm}%`

    // Sesión 54: búsqueda paralela sin LEFT JOIN.
    // ANTES: LEFT JOIN brands + OR b.name LIKE causaba nested loop scan ~8300×112 = timeout.
    // AHORA: 2 queries en paralelo + merge en JS. Cada query es simple y rápida:
    //   1) LIKE en name/sku (full scan inevitable pero sin JOIN)
    //   2) brandId IN (...) si hay marcas que coincidan (usa índice, rapidísimo)
    // Ambas corren en paralelo, se mergear y toman los mejores 6.
    const [nameResult, brandResult] = await Promise.all([
      // Query 1: buscar por nombre o SKU (sin JOIN)
      db.execute({
        sql: `SELECT ${SEARCH_SELECT}
              FROM products p
              WHERE p.isActive = 1 AND p.stock > 0
                AND (p.name LIKE ? OR p.sku LIKE ?)
              ORDER BY ${SEARCH_ORDER}
              LIMIT ?`,
        args: [searchTermLike, searchTermLike, limit],
      }),
      // Query 2: buscar marcas que coincidan (tabla chica, ~112 filas)
      db.execute({
        sql: 'SELECT id FROM brands WHERE name LIKE ?',
        args: [searchTermLike],
      }),
    ])

    // Buscar productos por brandId si hay marcas que coincidan
    let byBrandResult: any[] = []
    const brandIds = (brandResult.rows as any[]).map(r => r.id)
    if (brandIds.length > 0) {
      const placeholders = brandIds.map(() => '?').join(',')
      const brandProducts = await db.execute({
        sql: `SELECT ${SEARCH_SELECT}
              FROM products p
              WHERE p.isActive = 1 AND p.stock > 0
                AND p.brandId IN (${placeholders})
              ORDER BY ${SEARCH_ORDER}
              LIMIT ?`,
        args: [...brandIds, limit],
      })
      byBrandResult = brandProducts.rows as any[]
    }

    // Merge: productos por nombre primero (más relevantes), luego por marca, deduplicar por id
    const seen = new Set<string>()
    const merged: any[] = []
    for (const row of [...(nameResult.rows as any[]), ...byBrandResult]) {
      if (!seen.has(row.id) && merged.length < limit) {
        seen.add(row.id)
        merged.push(row)
      }
    }

    if (merged.length === 0) {
      return NextResponse.json({ ok: true, products: [] })
    }

    // Calcular precios con cotización actual (en paralelo con config)
    const [dollar, markup, cashDiscount, catMarkupMap] = await Promise.all([
      fetchDollarRate(),
      getStoreConfigNumber('markup', 30),
      getStoreConfigNumber('cash_discount', 10),
      getCategoryMarkupMap(),
    ])

    // Aplicar calculateProductPrices a cada resultado
    const products = merged.map((p) => {
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

    // Cache en CDN 30s: búsquedas repetidas por el mismo término no golpean la DB
    return NextResponse.json(
      { ok: true, products },
      { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } }
    )
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ ok: true, products: [] })
  }
}
