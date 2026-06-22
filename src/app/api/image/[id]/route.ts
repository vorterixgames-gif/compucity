import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Servir imagen desde product_images por ID.
//
// Sesión 44: simplificado — sacamos el bloque de Vercel Blob que estaba roto
// (usaba `put()` sin importar `@vercel/blob`, así que tiraba ReferenceError
// silencioso en CADA request, consumiendo CPU sin beneficio).
//
// Ahora servimos directo desde Turso con cache inmutable (1 año).
// Después del primer hit, el browser + CDN de Vercel cachean la imagen
// y no vuelve a tocar esta serverless function → 0 CPU en futuras requests.
//
// Si en el futuro se quiere migrar a Vercel Blob o S3, hacerlo en un script
// de migración separado (no en cada request de imagen).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Buscar la imagen en Turso (1 query)
    const result = await db.execute({
      sql: 'SELECT data, size FROM product_images WHERE id = ?',
      args: [id],
    })

    const rows = result.rows as any[]
    if (!rows[0]) {
      return new NextResponse('Imagen no encontrada', {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const buffer = Buffer.from(rows[0].data, 'base64')

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(buffer.length),
        // Cache inmutable por 1 año — el browser y el CDN de Vercel cachean
        // la imagen. Futuras requests no tocan esta serverless function.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'CDN-Cache-Control': 'public, max-age=31536000',
        // ETag basado en el id para validación condicional
        'ETag': `"${id}"`,
      },
    })
  } catch (error) {
    console.error('Image serve error:', error)
    return new NextResponse('Error del servidor', {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
