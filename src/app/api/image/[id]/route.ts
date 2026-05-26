import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

async function ensureTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS product_images (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Ensure table exists
    await ensureTable()

    const result = await db.execute({
      sql: 'SELECT data, size FROM product_images WHERE id = ?',
      args: [id],
    })

    const rows = result.rows as any[]
    if (!rows[0]) {
      return new NextResponse('Imagen no encontrada', { status: 404 })
    }

    // Convert base64 back to buffer
    const buffer = Buffer.from(rows[0].data, 'base64')

    // Return with strong cache headers (images don't change)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'CDN-Cache-Control': 'public, max-age=31536000',
      },
    })
  } catch (error) {
    console.error('Image serve error:', error)
    return new NextResponse('Error del servidor', { status: 500 })
  }
}
