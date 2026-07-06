import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function GET(request: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let customers: any[]
    let total: number

    if (search) {
      const countResult = await db.execute({
        sql: `SELECT COUNT(*) as count FROM customers 
              WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? OR dni LIKE ?`,
        args: [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`],
      })
      total = (countResult.rows as any[])[0]?.count ?? 0

      const result = await db.execute({
        sql: `SELECT id, name, email, phone, dni, address, city, province, postalCode, createdAt, updatedAt 
              FROM customers 
              WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? OR dni LIKE ?
              ORDER BY createdAt DESC
              LIMIT ? OFFSET ?`,
        args: [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, limit, offset],
      })
      customers = result.rows as any[]
    } else {
      const countResult = await db.execute('SELECT COUNT(*) as count FROM customers')
      total = (countResult.rows as any[])[0]?.count ?? 0

      const result = await db.execute({
        sql: `SELECT id, name, email, phone, dni, address, city, province, postalCode, createdAt, updatedAt 
              FROM customers 
              ORDER BY createdAt DESC
              LIMIT ? OFFSET ?`,
        args: [limit, offset],
      })
      customers = result.rows as any[]
    }

    // Get order counts for each customer
    const customerIds = customers.map(c => c.id)
    let orderCounts: Record<string, number> = {}

    if (customerIds.length > 0) {
      const placeholders = customerIds.map(() => '?').join(',')
      const ordersResult = await db.execute({
        sql: `SELECT customerId, COUNT(*) as count FROM orders WHERE customerId IN (${placeholders}) GROUP BY customerId`,
        args: customerIds,
      })
      for (const row of ordersResult.rows as any[]) {
        orderCounts[row.customerId] = row.count
      }
    }

    const enrichedCustomers = customers.map(c => ({
      ...c,
      orderCount: orderCounts[c.id] || 0,
    }))

    return NextResponse.json({
      ok: true,
      customers: enrichedCustomers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id, name, email, phone, dni, address, city, province, postalCode } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // Validaciones básicas
    const trimmedName = typeof name === 'string' ? name.trim() : ''
    const trimmedEmail = typeof email === 'string' ? email.trim() : ''

    if (!trimmedName) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }
    if (!trimmedEmail) {
      return NextResponse.json({ error: 'El email es obligatorio' }, { status: 400 })
    }
    // Validación simple de formato de email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json({ error: 'El email no tiene un formato válido' }, { status: 400 })
    }

    // Verificar que el cliente existe
    const existing = await db.execute({
      sql: 'SELECT id FROM customers WHERE id = ?',
      args: [id],
    })
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // Verificar unicidad de email (excluir el propio cliente)
    const emailConflict = await db.execute({
      sql: 'SELECT id FROM customers WHERE email = ? AND id != ?',
      args: [trimmedEmail, id],
    })
    if (emailConflict.rows.length > 0) {
      return NextResponse.json({ error: 'Ya existe otro cliente con ese email' }, { status: 400 })
    }

    // UPDATE dinámico (mismo patrón que el PUT de orders)
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: any[] = []

    fields.push('name = ?'); values.push(trimmedName)
    fields.push('email = ?'); values.push(trimmedEmail)
    // Los campos opcionales: si vienen undefined los dejamos como están, si vienen null/string los seteamos
    if (phone !== undefined) { fields.push('phone = ?'); values.push(phone || null) }
    if (dni !== undefined) { fields.push('dni = ?'); values.push(dni || null) }
    if (address !== undefined) { fields.push('address = ?'); values.push(address || null) }
    if (city !== undefined) { fields.push('city = ?'); values.push(city || null) }
    if (province !== undefined) { fields.push('province = ?'); values.push(province || null) }
    if (postalCode !== undefined) { fields.push('postalCode = ?'); values.push(postalCode || null) }

    fields.push('updatedAt = ?')
    values.push(now)
    values.push(id)

    await db.execute({
      sql: `UPDATE customers SET ${fields.join(', ')} WHERE id = ?`,
      args: values,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error updating customer:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // Nullify customer reference in orders
    await db.execute({
      sql: 'UPDATE orders SET customerId = NULL WHERE customerId = ?',
      args: [id],
    })

    // Delete customer
    await db.execute({
      sql: 'DELETE FROM customers WHERE id = ?',
      args: [id],
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting customer:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
