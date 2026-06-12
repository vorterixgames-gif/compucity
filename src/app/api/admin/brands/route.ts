import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

// GET /api/admin/brands - Get all brands (including inactive)
export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const result = await db.execute(
      `SELECT id, name, slug, logoUrl, logoWidth, logoHeight, isActive, "order", productCount, createdAt, updatedAt
       FROM brands
       ORDER BY "order" ASC, name ASC`
    )

    return NextResponse.json({ ok: true, brands: result.rows })
  } catch (error) {
    console.error('Get admin brands error:', error)
    return NextResponse.json({ ok: true, brands: [] })
  }
}

// POST /api/admin/brands - Create a new brand
export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { name, slug, logoUrl, logoWidth, logoHeight, isActive, order } = body

    if (!name || !slug) {
      return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await db.execute({
      sql: `INSERT INTO brands (id, name, slug, logoUrl, logoWidth, logoHeight, isActive, "order", productCount, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [
        id,
        name,
        slug,
        logoUrl || null,
        logoWidth || 80,
        logoHeight || 24,
        isActive !== undefined ? (isActive ? 1 : 0) : 1,
        order || 0,
        now,
        now,
      ],
    })

    return NextResponse.json({ ok: true, brand: { id, name, slug } })
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint') || error.message?.includes('duplicate')) {
      return NextResponse.json({ error: 'Brand slug already exists' }, { status: 409 })
    }
    console.error('Create brand error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

// PUT /api/admin/brands - Update a brand
export async function PUT(request: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id, name, slug, logoUrl, logoWidth, logoHeight, isActive, order } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const now = new Date().toISOString()

    await db.execute({
      sql: `UPDATE brands SET
              name = COALESCE(?, name),
              slug = COALESCE(?, slug),
              logoUrl = COALESCE(?, logoUrl),
              logoWidth = COALESCE(?, logoWidth),
              logoHeight = COALESCE(?, logoHeight),
              isActive = COALESCE(?, isActive),
              "order" = COALESCE(?, "order"),
              updatedAt = ?
            WHERE id = ?`,
      args: [
        name || null,
        slug || null,
        logoUrl !== undefined ? logoUrl : null,
        logoWidth || null,
        logoHeight || null,
        isActive !== undefined ? (isActive ? 1 : 0) : null,
        order !== undefined ? order : null,
        now,
        id,
      ],
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Update brand error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

// DELETE /api/admin/brands - Delete a brand
export async function DELETE(request: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await db.execute({
      sql: 'DELETE FROM brands WHERE id = ?',
      args: [id],
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete brand error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
