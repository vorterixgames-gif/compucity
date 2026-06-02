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

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'La imagen es muy grande (máx 10MB)' }, { status: 400 })
    }

    // Convert to base64
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')

    // Store in database
    const id = crypto.randomUUID()
    await db.execute({
      sql: `INSERT INTO product_images (id, data, size, createdAt)
            VALUES (?, ?, ?, datetime('now'))`,
      args: [id, base64, buffer.length],
    })

    return NextResponse.json({
      ok: true,
      url: `/api/image/${id}`,
      id,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    await db.execute({
      sql: 'DELETE FROM product_images WHERE id = ?',
      args: [id],
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete image error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
