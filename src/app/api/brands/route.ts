import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Public API: returns all active brands, ordered by order then name
export async function GET() {
  try {
    const result = await db.execute(
      `SELECT id, name, slug, logoUrl, logoWidth, logoHeight, isActive, "order", productCount, createdAt, updatedAt
       FROM brands
       WHERE isActive = 1
       ORDER BY "order" ASC, name ASC`
    )

    let brands = result.rows as any[]

    // If no brands exist yet, trigger init-brands and re-fetch
    if (brands.length === 0) {
      try {
        await fetch(new URL('/api/admin/init-brands', 'http://localhost:3000'), { method: 'POST' })
        const result2 = await db.execute(
          `SELECT id, name, slug, logoUrl, logoWidth, logoHeight, isActive, "order", productCount, createdAt, updatedAt
           FROM brands
           WHERE isActive = 1
           ORDER BY "order" ASC, name ASC`
        )
        brands = result2.rows as any[]
      } catch (initErr) {
        console.warn('[brands] Init-brands failed, returning empty:', initErr)
      }
    }

    return NextResponse.json({ ok: true, brands })
  } catch (error) {
    console.error('Get public brands error:', error)
    // If table doesn't exist yet, return empty array
    return NextResponse.json({ ok: true, brands: [] })
  }
}
