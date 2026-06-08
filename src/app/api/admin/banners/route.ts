import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const result = await db.execute('SELECT * FROM banners ORDER BY "order" ASC, createdAt DESC')
    return NextResponse.json({ ok: true, banners: result.rows })
  } catch (error) {
    console.error('Get banners error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const {
      title, subtitle, buttonText, buttonLink,
      bgColor, textColor, imageUrl, position, isActive, order,
    } = body

    if (!title) {
      return NextResponse.json({ error: 'El título es requerido' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await db.execute({
      sql: `INSERT INTO banners (id, title, subtitle, buttonText, buttonLink, bgColor, textColor, imageUrl, position, isActive, "order", createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, title, subtitle || null, buttonText || null, buttonLink || null,
        bgColor || '#3A8B68', textColor || '#FFFFFF', imageUrl || null, position || 'top',
        isActive !== false ? 1 : 0, order ? Number(order) : 0,
        now, now,
      ],
    })

    return NextResponse.json({ ok: true, banner: { id } })
  } catch (error) {
    console.error('Create banner error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id, title, subtitle, buttonText, buttonLink,
      bgColor, textColor, imageUrl, position, isActive, order } = body

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const fields: string[] = []
    const values: any[] = []

    if (title !== undefined) { fields.push('title = ?'); values.push(title) }
    if (subtitle !== undefined) { fields.push('subtitle = ?'); values.push(subtitle || null) }
    if (buttonText !== undefined) { fields.push('buttonText = ?'); values.push(buttonText || null) }
    if (buttonLink !== undefined) { fields.push('buttonLink = ?'); values.push(buttonLink || null) }
    if (bgColor !== undefined) { fields.push('bgColor = ?'); values.push(bgColor || '#3A8B68') }
    if (textColor !== undefined) { fields.push('textColor = ?'); values.push(textColor || '#FFFFFF') }
    if (imageUrl !== undefined) { fields.push('imageUrl = ?'); values.push(imageUrl || null) }
    if (position !== undefined) { fields.push('position = ?'); values.push(position || 'top') }
    if (isActive !== undefined) { fields.push('isActive = ?'); values.push(isActive ? 1 : 0) }
    if (order !== undefined) { fields.push('"order" = ?'); values.push(Number(order) || 0) }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    fields.push('updatedAt = ?')
    values.push(new Date().toISOString())
    values.push(id)

    await db.execute({
      sql: `UPDATE banners SET ${fields.join(', ')} WHERE id = ?`,
      args: values,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Update banner error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    await db.execute({
      sql: 'DELETE FROM banners WHERE id = ?',
      args: [id],
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete banner error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
