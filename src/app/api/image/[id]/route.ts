import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { put } from '@vercel/blob'

// Servir imagen desde product_images por ID.
// Sesión 44: migración gradual a Vercel Blob.
// - Si la imagen ya está en Blob (store_config tiene la URL), redirige 302 al CDN.
// - Si no está en Blob, la sirve desde Turso Y la sube a Blob en background.
// - Esto elimina las llamadas serverless para imágenes ya migradas.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Verificar si ya tenemos una URL de Blob para esta imagen
    // Usamos store_config con key 'blob_image_<id>' para cachear las URLs
    const blobUrlResult = await db.execute({
      sql: "SELECT value FROM store_config WHERE key = ?",
      args: [`blob_image_${id}`],
    })
    const blobUrlRows = blobUrlResult.rows as any[]
    if (blobUrlRows[0]?.value) {
      // Ya está en Blob — redirigir al CDN (0 serverless en futuras requests)
      const redirectResponse = NextResponse.redirect(blobUrlRows[0].value, 302)
      redirectResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      return redirectResponse
    }

    // 2. No está en Blob — servir desde Turso
    const result = await db.execute({
      sql: 'SELECT data, size FROM product_images WHERE id = ?',
      args: [id],
    })

    const rows = result.rows as any[]
    if (!rows[0]) {
      return new NextResponse('Imagen no encontrada', { status: 404 })
    }

    const buffer = Buffer.from(rows[0].data, 'base64')

    // 3. Subir a Blob en background (no bloquear la respuesta)
    // Solo si tenemos el token de Blob configurado
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const blob = await put(`products/${id}.webp`, buffer, {
          access: 'public',
          contentType: 'image/webp',
          addRandomSuffix: false,
        })
        // Guardar la URL en store_config para futuras requests
        const now = new Date().toISOString()
        await db.execute({
          sql: "INSERT OR REPLACE INTO store_config (id, key, value, updatedAt) VALUES (?, ?, ?, ?)",
          args: [crypto.randomUUID(), `blob_image_${id}`, blob.url, now],
        })
      } catch (e) {
        // Si falla la subida a Blob, no importa — seguimos sirviendo desde Turso
        console.error('[image] Error uploading to Blob:', e)
      }
    }

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
