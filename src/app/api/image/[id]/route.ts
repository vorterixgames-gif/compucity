import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Servir imagen desde product_images por ID.
// Sesión 43: eliminado el `ensureTable()` que ejecutaba CREATE TABLE IF NOT EXISTS
// en CADA request. La tabla ya existe desde hace meses (migración inicial), y
// verificarla en cada request consumía rows reads innecesarios en Turso.
// Si por algún motivo la tabla no existe, el SELECT falla y se devuelve 500
// (mejor que gastar 1 query extra en cada request para verificar algo que ya
// sabemos que existe).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    // Return with strong cache headers (images don't change).
    // Cache-Control: public, max-age=31536000, immutable → navegador cachea 1 año.
    // CDN-Cache-Control → Vercel CDN cachea 1 año.
    // Esto reduce drásticamente los rows reads en Turso: una vez que el navegador
    // o el CDN tienen la imagen, ya no pegan a /api/image/[id] para esa URL.
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
