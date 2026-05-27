import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const productCount = await db.execute('SELECT COUNT(*) as count FROM products')
    const totalProducts = (productCount.rows as any[])[0]?.count ?? 0

    const orderCount = await db.execute('SELECT COUNT(*) as count FROM orders')
    const totalOrders = (orderCount.rows as any[])[0]?.count ?? 0

    const revenueResult = await db.execute(
      "SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status IN ('paid', 'preparing', 'shipped', 'delivered')"
    )
    const totalRevenue = (revenueResult.rows as any[])[0]?.total ?? 0

    const dollarResult = await db.execute(
      'SELECT rate FROM dollar_rates ORDER BY updatedAt DESC LIMIT 1'
    )
    const dollarRate = (dollarResult.rows as any[])[0]?.rate ?? 0

    const recentOrders = await db.execute(
      'SELECT * FROM orders ORDER BY createdAt DESC LIMIT 5'
    )

    const activeProducts = await db.execute('SELECT COUNT(*) as count FROM products WHERE isActive = 1')
    const featuredProducts = await db.execute('SELECT COUNT(*) as count FROM products WHERE isFeatured = 1')

    const ordersByStatus = await db.execute(
      'SELECT status, COUNT(*) as count FROM orders GROUP BY status'
    )

    const customerCount = await db.execute('SELECT COUNT(*) as count FROM customers')
    const totalCustomers = (customerCount.rows as any[])[0]?.count ?? 0

    return NextResponse.json({
      ok: true,
      stats: {
        totalProducts,
        totalOrders,
        totalRevenue,
        dollarRate,
        totalCustomers,
        activeProducts: (activeProducts.rows as any[])[0]?.count ?? 0,
        featuredProducts: (featuredProducts.rows as any[])[0]?.count ?? 0,
      },
      recentOrders: recentOrders.rows,
      ordersByStatus: ordersByStatus.rows,
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
