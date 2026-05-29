import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchDollarRate, getStoreConfigNumber } from '@/lib/dollar'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function GET() {
  try {
    // Auth check
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Get current dollar rate and config
    const dollar = await fetchDollarRate()
    const markup = await getStoreConfigNumber('markup', 30)
    const cashDiscount = await getStoreConfigNumber('cash_discount', 10)

    const result = await db.execute(
      `SELECT p.name, p.sku, p.costPrice, p.price, p.comparePrice, p.stock, p.isActive, p.isFeatured, p.providerId, p.providerSku, c.name as categoryName
       FROM products p 
       LEFT JOIN categories c ON p.categoryId = c.id 
       ORDER BY p.createdAt DESC`
    )

    const products = result.rows as any[]

    // CSV header
    const headers = [
      'Nombre',
      'SKU',
      'Categoría',
      'Costo USD',
      'Precio Lista',
      'Precio Efectivo',
      'Stock',
      'Activo',
      'Destacado',
      'Proveedor ID',
      'Proveedor SKU',
    ]

    // Build CSV rows
    const rows = products.map(p => {
      let listPrice = Number(p.price) || 0
      let cashPrice = p.comparePrice ? Number(p.comparePrice) : 0

      // Auto-calculate from USD cost if costPrice > 0 (same logic as admin products API)
      if (p.costPrice && Number(p.costPrice) > 0) {
        listPrice = Math.ceil(Number(p.costPrice) * dollar.rate * (1 + markup / 100))
        cashPrice = Math.ceil(Number(p.costPrice) * dollar.rate * (1 + (markup - cashDiscount) / 100))
      }

      return [
        escapeCsv(String(p.name || '')),
        escapeCsv(String(p.sku || '')),
        escapeCsv(String(p.categoryName || '')),
        p.costPrice && Number(p.costPrice) > 0 ? Number(p.costPrice).toFixed(2) : '',
        listPrice > 0 ? String(listPrice) : '',
        cashPrice > 0 ? String(cashPrice) : '',
        String(p.stock ?? 0),
        p.isActive ? 'Sí' : 'No',
        p.isFeatured ? 'Sí' : 'No',
        escapeCsv(String(p.providerId || '')),
        escapeCsv(String(p.providerSku || '')),
      ].join(';')
    })

    // Assemble CSV with BOM
    const bom = '\uFEFF'
    const csv = bom + [headers.join(';'), ...rows].join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=productos-compucity.csv',
      },
    })
  } catch (error) {
    console.error('Export products error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

/**
 * Escape a CSV field value for semicolon-delimited format.
 * If the value contains semicolons, double quotes, or newlines, wrap in double quotes
 * and escape any internal double quotes by doubling them.
 */
function escapeCsv(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}
