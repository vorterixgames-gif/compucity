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
    const result = await db.execute({
      sql: `SELECT o.* FROM orders o
            WHERE o.customerEmail = ? OR o.customerId = ?
            ORDER BY o.createdAt DESC`,
      args: [customer.email, customer.id],
    })

    const orders = result.rows as any[]

    // Get items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const itemsResult = await db.execute({
          sql: 'SELECT * FROM order_items WHERE orderId = ?',
          args: [order.id],
        })
        return {
          ...order,
          items: itemsResult.rows,
        }
      })
    )

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
