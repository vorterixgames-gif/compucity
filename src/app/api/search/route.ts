import { NextRequest, NextResponse } from 'next/server'
import { searchProducts } from '@/lib/queries'

// Sesión 44: cache corto en CDN (60s) + stale-while-revalidate (10 min).
// Las búsquedas son paramétricas (cada término distinto) pero las populares
// se repiten mucho. 60s de cache evita regenerar resultados idénticos para
// múltiples usuarios buscando lo mismo.
export const revalidate = 60

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ ok: true, products: [] })
  }

  try {
    const results = await searchProducts(q.trim())
    const products = results.slice(0, 6).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      comparePrice: p.comparePrice,
      images: p.images ? JSON.parse(p.images) : [],
    }))

    return NextResponse.json(
      { ok: true, products },
      {
        headers: {
          // Cache CDN 60s, stale 10 min. Busquedas populares se sirven desde CDN.
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600',
        },
      }
    )
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ ok: true, products: [] })
  }
}
