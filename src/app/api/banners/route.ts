import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Sesión 43 día 2: cache 1h en CDN. Los banners cambian muy raramente
// (solo desde /admin/promociones). 1h de staleness OK.
export const revalidate = 3600

export async function GET() {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM banners WHERE isActive = 1 ORDER BY "order" ASC, createdAt DESC',
      args: [],
    })
    return NextResponse.json({ ok: true, banners: result.rows }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Get public banners error:', error)
    return NextResponse.json({ ok: true, banners: [] })
  }
}
