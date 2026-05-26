import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Ensure the product_images table exists (creates if missing)
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

export async function POST(request: NextRequest) {
  try {
    // Make sure the table exists before doing anything
    await ensureTable()

    let formData: FormData
    try {
      formData = await request.formData()
    } catch (formError: any) {
      console.error('[upload] FormData parse error:', formError.message)
      return NextResponse.json(
        { error: `Error al leer el formulario: ${formError.message}` },
        { status: 400 }
      )
    }

    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Tipo no soportado: ${file.type}. Usá JPG, PNG, WebP o GIF.` },
        { status: 400 }
      )
    }

    // Validate file size (max 4MB)
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: `El archivo es muy grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo 4MB.` },
        { status: 400 }
      )
    }

    // Read file buffer
    let arrayBuffer: ArrayBuffer
    try {
      arrayBuffer = await file.arrayBuffer()
    } catch (bufError: any) {
      console.error('[upload] ArrayBuffer error:', bufError.message)
      return NextResponse.json(
        { error: `Error al leer el archivo: ${bufError.message}` },
        { status: 500 }
      )
    }

    const buffer = Buffer.from(arrayBuffer)
    const base64Data = buffer.toString('base64')

    // Generate unique ID
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    // Store in Turso
    try {
      await db.execute({
        sql: 'INSERT INTO product_images (id, data, size, width, height, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        args: [id, base64Data, buffer.length, null, null, now],
      })
    } catch (dbError: any) {
      console.error('[upload] DB insert error:', dbError.message)
      return NextResponse.json(
        { error: `Error DB: ${dbError.message}` },
        { status: 500 }
      )
    }

    const imageUrl = `/api/image/${id}`

    return NextResponse.json({
      ok: true,
      url: imageUrl,
      id,
      size: buffer.length,
    })
  } catch (error: any) {
    console.error('[upload] Unexpected error:', error?.message || error)
    return NextResponse.json(
      { error: `Error inesperado: ${error?.message || 'desconocido'}` },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Make sure the table exists
    await ensureTable()

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    await db.execute({
      sql: 'DELETE FROM product_images WHERE id = ?',
      args: [id],
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Delete error:', error?.message || error)
    return NextResponse.json(
      { error: 'Error al eliminar la imagen' },
      { status: 500 }
    )
  }
}
