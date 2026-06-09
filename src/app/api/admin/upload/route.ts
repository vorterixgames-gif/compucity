import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

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

// POST — Upload an image
export async function POST(request: NextRequest) {
  try {
    await ensureTable()

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ ok: false, error: 'No se envió ningún archivo' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: 'El archivo no es una imagen válida' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'La imagen es muy grande (máx 10MB)' }, { status: 400 })
    }

    // Convert to base64
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Data = buffer.toString('base64')

    // Generate unique ID
    const id = randomUUID()

    // Get image dimensions if possible
    let width: number | null = null
    let height: number | null = null

    // Simple dimension extraction from WebP/PNG/JPEG headers
    try {
      if (file.type === 'image/webp') {
        // WebP: width and height are at offset 26-29 (little-endian)
        if (buffer.length > 29) {
          const riff = buffer.toString('ascii', 0, 4)
          if (riff === 'RIFF') {
            width = buffer.readUInt16LE(26)
            height = buffer.readUInt16LE(28)
          }
        }
      } else if (file.type === 'image/png') {
        // PNG: width and height are at offset 16-23 (big-endian)
        if (buffer.length > 23) {
          width = buffer.readUInt32BE(16)
          height = buffer.readUInt32BE(20)
        }
      } else if (file.type === 'image/jpeg') {
        // JPEG: need to find SOF marker
        let offset = 2 // Skip SOI marker
        while (offset < buffer.length - 1) {
          if (buffer[offset] !== 0xFF) break
          const marker = buffer[offset + 1]
          // SOF0, SOF1, SOF2 markers
          if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
            if (offset + 8 < buffer.length) {
              height = buffer.readUInt16BE(offset + 5)
              width = buffer.readUInt16BE(offset + 7)
            }
            break
          }
          // Skip to next marker
          const segLen = buffer.readUInt16BE(offset + 2)
          offset += 2 + segLen
        }
      }
    } catch {
      // Ignore dimension extraction errors
    }

    // Save to database
    await db.execute({
      sql: 'INSERT INTO product_images (id, data, size, width, height) VALUES (?, ?, ?, ?, ?)',
      args: [id, base64Data, buffer.length, width, height],
    })

    return NextResponse.json({
      ok: true,
      url: `/api/image/${id}`,
      id,
      size: buffer.length,
      width,
      height,
    })
  } catch (error: any) {
    console.error('[upload] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al subir la imagen' },
      { status: 500 }
    )
  }
}

// DELETE — Remove an image
export async function DELETE(request: NextRequest) {
  try {
    await ensureTable()

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ ok: false, error: 'ID de imagen requerido' }, { status: 400 })
    }

    // Validate ID format to prevent SQL injection
    const cleanId = String(id).replace(/[^a-zA-Z0-9\-]/g, '')

    await db.execute({
      sql: 'DELETE FROM product_images WHERE id = ?',
      args: [cleanId],
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[upload] Delete error:', error)
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al eliminar la imagen' },
      { status: 500 }
    )
  }
}
