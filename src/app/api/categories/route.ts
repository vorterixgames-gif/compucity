import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Public API: returns only enabled categories for storefront
export async function GET() {
  try {
    // Get all enabled categories ordered by order
    const result = await db.execute(
      'SELECT id, name, slug, image, parentId, enabled, "order" FROM categories WHERE enabled = 1 ORDER BY "order" ASC, name ASC'
    )
    return NextResponse.json({ ok: true, categories: result.rows })
  } catch (error) {
    console.error('Get public categories error:', error)
    // If table doesn't exist, return empty array instead of erroring
    return NextResponse.json({ ok: true, categories: [] })
  }
}
