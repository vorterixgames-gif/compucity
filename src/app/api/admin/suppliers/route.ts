import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let suppliers: any[]
    let total: number

    if (search) {
      const countResult = await db.execute({
        sql: `SELECT COUNT(*) as count FROM suppliers
              WHERE name LIKE ? OR contactName LIKE ? OR contactEmail LIKE ?`,
        args: [`%${search}%`, `%${search}%`, `%${search}%`],
      })
      total = (countResult.rows as any[])[0]?.count ?? 0

      const result = await db.execute({
        sql: `SELECT * FROM suppliers
              WHERE name LIKE ? OR contactName LIKE ? OR contactEmail LIKE ?
              ORDER BY name ASC
              LIMIT ? OFFSET ?`,
        args: [`%${search}%`, `%${search}%`, `%${search}%`, limit, offset],
      })
      suppliers = result.rows as any[]
    } else {
      const countResult = await db.execute('SELECT COUNT(*) as count FROM suppliers')
      total = (countResult.rows as any[])[0]?.count ?? 0

      const result = await db.execute({
        sql: `SELECT * FROM suppliers ORDER BY name ASC LIMIT ? OFFSET ?`,
        args: [limit, offset],
      })
      suppliers = result.rows as any[]
    }

    // Get product counts for each supplier
    const supplierIds = suppliers.map(s => s.id)
    let productCounts: Record<string, number> = {}

    if (supplierIds.length > 0) {
      const placeholders = supplierIds.map(() => '?').join(',')
      const productsResult = await db.execute({
        sql: `SELECT providerId, COUNT(*) as count FROM products WHERE providerId IN (${placeholders}) GROUP BY providerId`,
        args: supplierIds,
      })
      for (const row of productsResult.rows as any[]) {
        productCounts[row.providerId] = row.count
      }
    }

    const enrichedSuppliers = suppliers.map(s => ({
      ...s,
      productCount: productCounts[s.id] || 0,
    }))

    return NextResponse.json({
      ok: true,
      suppliers: enrichedSuppliers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name,
      contactName,
      contactEmail,
      contactPhone,
      website,
      apiType,
      apiBaseUrl,
      apiUserId,
      apiToken,
      apiUsername,
      apiPassword,
      markup,
      currency,
      isActive,
      notes,
    } = body

    if (!name) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    const id = crypto.randomUUID()

    const now = new Date().toISOString()

    await db.execute({
      sql: `INSERT INTO suppliers (id, name, contactName, contactEmail, contactPhone, website, apiType, apiBaseUrl, apiUserId, apiToken, apiUsername, apiPassword, markup, currency, isActive, notes, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        name,
        contactName || null,
        contactEmail || null,
        contactPhone || null,
        website || null,
        apiType || 'none',
        apiBaseUrl || null,
        apiUserId || null,
        apiToken || null,
        apiUsername || null,
        apiPassword || null,
        markup ?? 30,
        currency || 'USD',
        isActive !== undefined ? (isActive ? 1 : 0) : 1,
        notes || null,
        now,
        now,
      ],
    })

    const result = await db.execute({
      sql: 'SELECT * FROM suppliers WHERE id = ?',
      args: [id],
    })

    return NextResponse.json({ ok: true, supplier: (result.rows as any[])[0] })
  } catch (error) {
    console.error('Error creating supplier:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name, contactName, contactEmail, contactPhone, website, apiType, apiBaseUrl, apiUserId, apiToken, apiUsername, apiPassword, markup, currency, isActive, notes } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const existing = await db.execute({ sql: 'SELECT id FROM suppliers WHERE id = ?', args: [id] })
    if ((existing.rows as any[]).length === 0) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    await db.execute({
      sql: `UPDATE suppliers SET
        name = ?, contactName = ?, contactEmail = ?, contactPhone = ?,
        website = ?, apiType = ?, apiBaseUrl = ?, apiUserId = ?,
        apiToken = ?, apiUsername = ?, apiPassword = ?,
        markup = ?, currency = ?, isActive = ?, notes = ?,
        updatedAt = ?
      WHERE id = ?`,
      args: [
        name || null,
        contactName || null,
        contactEmail || null,
        contactPhone || null,
        website || null,
        apiType || 'none',
        apiBaseUrl || null,
        apiUserId || null,
        apiToken || null,
        apiUsername || null,
        apiPassword || null,
        markup ?? 30,
        currency || 'USD',
        isActive !== undefined ? (isActive ? 1 : 0) : 1,
        notes || null,
        new Date().toISOString(),
        id,
      ],
    })

    const result = await db.execute({ sql: 'SELECT * FROM suppliers WHERE id = ?', args: [id] })

    return NextResponse.json({ ok: true, supplier: (result.rows as any[])[0] })
  } catch (error) {
    console.error('Error updating supplier:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // Nullify supplier reference in products
    await db.execute({
      sql: 'UPDATE products SET providerId = NULL WHERE providerId = ?',
      args: [id],
    })

    // Delete supplier
    await db.execute({
      sql: 'DELETE FROM suppliers WHERE id = ?',
      args: [id],
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting supplier:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
