import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const productCount = await db.execute('SELECT COUNT(*) as count FROM products')
    const totalProducts = (productCount.rows as any[])[0]?.count ?? 0

    const orderCount = await db.execute('SELECT COUNT(*) as count FROM orders')
    const totalOrders = (orderCount.rows as any[])[0]?.count ?? 0

    const revenueResult = await db.execute(
      "SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status IN ('paid', 'preparing', 'shipped', 'delivered')"
    )
    const totalRevenue = (revenueResult.rows as any[])[0]?.total ?? 0

    let dollarRate = 0
    let dollarSource = ''
    let dollarCompra: number | null = null
    let dollarVenta: number | null = null
    let dollarUpdatedAt = ''

    try {
      const dollarResult = await db.execute(
        'SELECT rate, source, compra, venta, updatedAt FROM dollar_rates ORDER BY updatedAt DESC LIMIT 1'
      )
      const dollarRow = (dollarResult.rows as any[])[0]
      dollarRate = dollarRow?.rate ?? 0
      dollarSource = dollarRow?.source ?? ''
      dollarCompra = dollarRow?.compra ?? null
      dollarVenta = dollarRow?.venta ?? null
      dollarUpdatedAt = dollarRow?.updatedAt ?? ''
    } catch {
      // Fallback: try without compra/venta columns
      try {
        const dollarResult = await db.execute(
          'SELECT rate, source, updatedAt FROM dollar_rates ORDER BY updatedAt DESC LIMIT 1'
        )
        const dollarRow = (dollarResult.rows as any[])[0]
        dollarRate = dollarRow?.rate ?? 0
        dollarSource = dollarRow?.source ?? ''
        dollarUpdatedAt = dollarRow?.updatedAt ?? ''
      } catch {}
    }

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

    const supplierCount = await db.execute('SELECT COUNT(*) as count FROM suppliers WHERE isActive = 1')
    const totalSuppliers = (supplierCount.rows as any[])[0]?.count ?? 0

    return NextResponse.json({
      ok: true,
      stats: {
        totalProducts,
        totalOrders,
        totalRevenue,
        dollarRate,
        dollarSource,
        dollarCompra,
        dollarVenta,
        dollarUpdatedAt,
        totalCustomers,
        totalSuppliers,
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
