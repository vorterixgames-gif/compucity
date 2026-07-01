import { NextRequest, NextResponse } from 'next/server'
import { searchProducts } from '@/lib/queries'

// Sesión 49: force-dynamic para evitar timeout en build.
// El search es paramétrico (cada query distinta) y no tiene sentido
// pre-renderizarlo estáticamente.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ ok: true, products: [] })
  }

  try {
    // Timeout de 8 segundos para evitar que una query lenta
    // cuelgue al usuario. Si tarda más, devolvemos vacío.
    const timeoutMs = 8000
    const results = await Promise.race([
      searchProducts(q.trim()),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Search timeout')), timeoutMs)
      ),
    ])

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
