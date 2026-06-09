import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

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

/**
 * POST /api/admin/upload
 * Upload an image and store it in product_images as base64 WebP.
 * Expects FormData with a 'file' field (image/webp).
 * Returns { ok: true, url: '/api/image/{id}' }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    await ensureTable()

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'El archivo debe ser una imagen' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'La imagen es muy grande (máx 10MB)' }, { status: 400 })
    }

    // Read file as ArrayBuffer and convert to base64
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Data = buffer.toString('base64')

    // Generate unique ID
    const imageId = crypto.randomUUID()

    // Try to get image dimensions (best effort)
    let width: number | null = null
    let height: number | null = null
    try {
      // Simple WebP dimension parsing from header
      // WebP format: RIFF....WEBP + VP8/VP8L/VP8X
      if (buffer.length > 30 && buffer.toString('ascii', 0, 4) === 'RIFF') {
        const chunkType = buffer.toString('ascii', 8, 12)
        if (chunkType === 'VP8 ') {
          // Lossy WebP: width/height at offset 26-29 (little-endian 14 bits each)
          if (buffer.length > 29) {
            const w = buffer.readUInt16LE(26) & 0x3FFF
            const h = buffer.readUInt16LE(28) & 0x3FFF
            if (w > 0 && h > 0) { width = w; height = h }
          }
        } else if (chunkType === 'VP8L') {
          // Lossless WebP: width/height at offset 21-24 (little-endian 14 bits)
          if (buffer.length > 24) {
            const bits = buffer.readUInt32LE(21)
            width = (bits & 0x3FFF) + 1
            height = ((bits >> 14) & 0x3FFF) + 1
          }
        } else if (chunkType === 'VP8X') {
          // Extended WebP: width/height at offset 24-29 (24-bit little-endian + 1)
          if (buffer.length > 29) {
            width = (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)) + 1
            height = (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)) + 1
          }
        }
      }
    } catch {
      // Dimension parsing failed, continue without dimensions
    }

    // Store in product_images table
    await db.execute({
      sql: `INSERT INTO product_images (id, data, size, width, height, createdAt) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      args: [imageId, base64Data, buffer.length, width, height],
    })

    const imageUrl = `/api/image/${imageId}`

    return NextResponse.json({
      ok: true,
      url: imageUrl,
      id: imageId,
      size: buffer.length,
      width,
      height,
    })
  } catch (error) {
    console.error('Image upload error:', error)
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/upload
 * Delete an image from product_images by ID.
 * Expects JSON { id: string }
 * Also removes the reference from any product's images array.
 * Returns { ok: true }
 */
export async function DELETE(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'ID de imagen requerido' }, { status: 400 })
    }

    // Check that the image exists
    const existing = await db.execute({
      sql: 'SELECT id FROM product_images WHERE id = ?',
      args: [id],
    })
    if ((existing.rows as any[]).length === 0) {
      return NextResponse.json({ error: 'Imagen no encontrada' }, { status: 404 })
    }

    // Find all products that reference this image and remove the reference
    const imagePath = `/api/image/${id}`
    const productsWithImage = await db.execute({
      sql: `SELECT id, images FROM products WHERE images LIKE ?`,
      args: [`%${imagePath}%`],
    })

    for (const row of productsWithImage.rows as any[]) {
      try {
        let images: string[] = []
        try {
          images = JSON.parse(row.images || '[]')
        } catch { continue }

        const filtered = images.filter((url: string) => url !== imagePath)
        if (filtered.length !== images.length) {
          await db.execute({
            sql: 'UPDATE products SET images = ?, updatedAt = datetime(\'now\') WHERE id = ?',
            args: [JSON.stringify(filtered), row.id],
          })
        }
      } catch {
        // Skip this product if there's an error
      }
    }

    // Delete the image from product_images
    await db.execute({
      sql: 'DELETE FROM product_images WHERE id = ?',
      args: [id],
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Image delete error:', error)
    return NextResponse.json({ error: 'Error al eliminar la imagen' }, { status: 500 })
  }
}
