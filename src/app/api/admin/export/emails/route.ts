import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function GET() {
  try {
    // Auth check
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Query distinct customer emails with aggregation
    const result = await db.execute(
      `SELECT 
        customerEmail,
        MAX(customerName) as customerName,
        MAX(customerPhone) as customerPhone,
        COUNT(*) as orderCount,
        MAX(createdAt) as lastOrderDate
       FROM orders 
       WHERE customerEmail IS NOT NULL 
       GROUP BY customerEmail
       ORDER BY orderCount DESC, lastOrderDate DESC`
    )

    const customers = result.rows as any[]

    // CSV header
    const headers = [
      'Nombre',
      'Email',
      'Teléfono',
      'Cantidad de Pedidos',
      'Fecha Último Pedido',
    ]

    // Build CSV rows
    const rows = customers.map(c => {
      return [
        escapeCsv(String(c.customerName || '')),
        escapeCsv(String(c.customerEmail || '')),
        escapeCsv(String(c.customerPhone || '')),
        String(c.orderCount || 0),
        c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }) : '',
      ].join(';')
    })

    // Assemble CSV with BOM
    const bom = '\uFEFF'
    const csv = bom + [headers.join(';'), ...rows].join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=emails-clientes-compucity.csv',
      },
    })
  } catch (error) {
    console.error('Export emails error:', error)
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
