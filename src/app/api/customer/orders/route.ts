import { NextResponse } from 'next/server'
import { getCurrentCustomer } from '@/lib/customer-auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const customer = await getCurrentCustomer()

    if (!customer) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Query orders where customerEmail = email OR customerId = id
    // Sesión 44: N+1 fix — antes hacía 1 query por order para obtener sus items.
    // Ahora traemos todo en 2 queries paralelas y armamos el map en memoria.
    const [ordersResult, itemsResult] = await Promise.all([
      db.execute({
        sql: `SELECT o.* FROM orders o
              WHERE o.customerEmail = ? OR o.customerId = ?
              ORDER BY o.createdAt DESC`,
        args: [customer.email, customer.id],
      }),
      db.execute({
        sql: `SELECT oi.* FROM order_items oi
              INNER JOIN orders o ON oi.orderId = o.id
              WHERE o.customerEmail = ? OR o.customerId = ?
              ORDER BY oi.orderId`,
        args: [customer.email, customer.id],
      }),
    ])

    const orders = ordersResult.rows as any[]

    // Agrupar items por orderId en memoria
    const itemsByOrderId = new Map<string, any[]>()
    for (const item of itemsResult.rows as any[]) {
      if (!itemsByOrderId.has(item.orderId)) itemsByOrderId.set(item.orderId, [])
      itemsByOrderId.get(item.orderId)!.push(item)
    }

    const ordersWithItems = orders.map(order => ({
      ...order,
      items: itemsByOrderId.get(order.id) || [],
    }))

    return NextResponse.json({
      ok: true,
      orders: ordersWithItems,
    })
  } catch (error) {
    console.error('Customer orders error:', error)
    return NextResponse.json(
      { error: 'Error del servidor' },
      { status: 500 }
    )
  }
}
