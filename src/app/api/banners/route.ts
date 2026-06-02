import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM banners WHERE isActive = 1 ORDER BY "order" ASC, createdAt DESC',
      args: [],
    })
    return NextResponse.json({ ok: true, banners: result.rows })
  } catch (error) {
    console.error('Get public banners error:', error)
    return NextResponse.json({ ok: true, banners: [] })
  }
}
