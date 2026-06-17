import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Sesión 43: cache 1h en CDN. Las categorías cambian muy raramente (solo cuando
// se agrega/edita una categoría desde /admin/categorias). 1h de staleness OK.
export const revalidate = 3600

// Public API: returns only enabled categories for storefront
export async function GET() {
  try {
    // Get all enabled categories ordered by order
    const result = await db.execute(
      'SELECT id, name, slug, image, parentId, enabled, "order" FROM categories WHERE enabled = 1 ORDER BY "order" ASC, name ASC'
    )
    return NextResponse.json({ ok: true, categories: result.rows }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Get public categories error:', error)
    // If table doesn't exist, return empty array instead of erroring
    return NextResponse.json({ ok: true, categories: [] })
  }
}
