import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
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

export async function DELETE(request: Request) {
  try {
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
