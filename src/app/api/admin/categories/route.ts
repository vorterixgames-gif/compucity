import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const result = await db.execute(
      'SELECT * FROM categories ORDER BY "order" ASC, name ASC'
    )
    return NextResponse.json({ ok: true, categories: result.rows })
  } catch (error) {
    console.error('Get categories error:', error)
    // If table doesn't exist, return empty array
    return NextResponse.json({ ok: true, categories: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { name, image, parentId, enabled, order } = body

    if (!name) {
      return NextResponse.json({ error: 'Nombre es requerido' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    const existing = await db.execute({
      sql: 'SELECT id FROM categories WHERE slug = ?',
      args: [slug],
    })
    const finalSlug = existing.rows.length > 0 ? `${slug}-${Date.now()}` : slug

    const now = new Date().toISOString()

    await db.execute({
      sql: 'INSERT INTO categories (id, name, slug, image, parentId, enabled, "order", createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [
        id,
        name,
        finalSlug,
        image || null,
        parentId || null,
        enabled !== undefined ? (enabled ? 1 : 0) : 1,
        order || 0,
        now,
        now,
      ],
    })

    return NextResponse.json({ ok: true, category: { id, slug: finalSlug } })
  } catch (error) {
    console.error('Create category error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id, name, image, parentId, enabled, order } = body

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const fields: string[] = []
    const values: any[] = []

    if (name !== undefined) {
      fields.push('name = ?')
      values.push(name)
    }
    if (image !== undefined) {
      fields.push('image = ?')
      values.push(image)
    }
    if (parentId !== undefined) {
      fields.push('parentId = ?')
      values.push(parentId || null)
    }
    if (enabled !== undefined) {
      fields.push('enabled = ?')
      values.push(enabled ? 1 : 0)
    }
    if (order !== undefined) {
      fields.push('"order" = ?')
      values.push(order)
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    // If name is changing, also update slug
    if (name !== undefined) {
      const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      fields.push('slug = ?')
      values.push(slug)
    }

    fields.push('updatedAt = ?')
    values.push(now)
    values.push(id)

    await db.execute({
      sql: `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`,
      args: values,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Update category error:', error)
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

    // Remove category reference from products
    await db.execute({
      sql: 'UPDATE products SET categoryId = NULL WHERE categoryId = ?',
      args: [id],
    })

    // Set children's parentId to null (orphan them rather than cascade delete)
    await db.execute({
      sql: 'UPDATE categories SET parentId = NULL WHERE parentId = ?',
      args: [id],
    })

    await db.execute({
      sql: 'DELETE FROM categories WHERE id = ?',
      args: [id],
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete category error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
