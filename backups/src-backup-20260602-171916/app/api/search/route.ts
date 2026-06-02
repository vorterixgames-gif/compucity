import { NextRequest, NextResponse } from 'next/server'
import { searchProducts } from '@/lib/queries'

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

    return NextResponse.json({ ok: true, products })
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ ok: true, products: [] })
  }
}
