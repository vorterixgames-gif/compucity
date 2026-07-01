import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Sesión 44: paralelizar las 9 queries independientes que antes eran secuenciales.
    // Antes: 9 roundtrips a Turso uno detrás de otro = ~900ms
    // Ahora: 1 solo roundtrip paralelo = ~100-200ms
    const [
      productCountRes,
      orderCountRes,
      revenueRes,
      dollarRes,
      recentOrdersRes,
      activeProductsRes,
      featuredProductsRes,
      ordersByStatusRes,
      customerCountRes,
      supplierCountRes,
    ] = await Promise.all([
      db.execute('SELECT COUNT(*) as count FROM products'),
      db.execute('SELECT COUNT(*) as count FROM orders'),
      db.execute(
        "SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status IN ('paid', 'preparing', 'shipped', 'delivered')"
      ),
      // Dollar: try/catch para tolerar si faltan columnas compra/venta
      db.execute('SELECT rate, source, compra, venta, updatedAt FROM dollar_rates ORDER BY updatedAt DESC LIMIT 1')
        .catch(() => db.execute('SELECT rate, source, updatedAt FROM dollar_rates ORDER BY updatedAt DESC LIMIT 1')),
      db.execute('SELECT id, orderNumber, customerName, total, status, createdAt FROM orders ORDER BY createdAt DESC LIMIT 5'),
      db.execute('SELECT COUNT(*) as count FROM products WHERE isActive = 1'),
      db.execute('SELECT COUNT(*) as count FROM products WHERE isFeatured = 1'),
      db.execute('SELECT status, COUNT(*) as count FROM orders GROUP BY status'),
      db.execute('SELECT COUNT(*) as count FROM customers'),
      db.execute('SELECT COUNT(*) as count FROM suppliers WHERE isActive = 1'),
    ])

    const totalProducts = (productCountRes.rows as any[])[0]?.count ?? 0
    const totalOrders = (orderCountRes.rows as any[])[0]?.count ?? 0
    const totalRevenue = (revenueRes.rows as any[])[0]?.total ?? 0

    const dollarRow = (dollarRes.rows as any[])[0]
    const dollarRate = dollarRow?.rate ?? 0
    const dollarSource = dollarRow?.source ?? ''
    const dollarCompra = dollarRow?.compra ?? null
    const dollarVenta = dollarRow?.venta ?? null
    const dollarUpdatedAt = dollarRow?.updatedAt ?? ''

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
        totalCustomers: (customerCountRes.rows as any[])[0]?.count ?? 0,
        totalSuppliers: (supplierCountRes.rows as any[])[0]?.count ?? 0,
        activeProducts: (activeProductsRes.rows as any[])[0]?.count ?? 0,
        featuredProducts: (featuredProductsRes.rows as any[])[0]?.count ?? 0,
      },
      recentOrders: recentOrdersRes.rows,
      ordersByStatus: ordersByStatusRes.rows,
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
