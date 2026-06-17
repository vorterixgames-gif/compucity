import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchDollarRate, getStoreConfigNumber, CategoryMarkup } from '@/lib/dollar'
import { getCurrentAdmin } from '@/lib/admin-auth'

// Sesión 43 día 2 FINAL: exportación de productos a CSV (Excel-compatible).
//
// Formato de columnas (orden solicitado por el dueño):
//   NOMBRE | SKU | PROVEEDOR | CATEGORIA | COSTO USD | %IVA |
//   PRECIO LISTA (IVA INCL) | PRECIO EFECTIVO (IVA INCL) | STOCK |
//   ACTIVO | DESTACADO | PROVEEDOR ID | PROVEEDOR SKU
//
// Parámetros query:
//   - sinCategoria=true → exporta SOLO productos sin categoría (para revisión manual)
//   - (sin parámetros) → exporta TODOS los productos
//
// Productos sin categoría se muestran con "Sin categoría" en la columna CATEGORIA
// (antes salía vacío y el dueño pensaba que faltaban productos).
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Leer parámetro sinCategoria
    const { searchParams } = new URL(request.url)
    const soloSinCategoria = searchParams.get('sinCategoria') === 'true'

    // Get current dollar rate, config, and category markup map
    const [dollar, markup, cashDiscount, catMarkupResult] = await Promise.all([
      fetchDollarRate(),
      getStoreConfigNumber('markup', 30),
      getStoreConfigNumber('cash_discount', 10),
      db.execute('SELECT id, markup, cashDiscount, ivaRate FROM categories'),
    ])

    // Build category markup map for 3-tier priority: product → category → global
    const catMarkupMap = new Map<string, CategoryMarkup>()
    for (const row of catMarkupResult.rows as any[]) {
      catMarkupMap.set(row.id, {
        markup: row.markup != null ? Number(row.markup) : null,
        cashDiscount: row.cashDiscount != null ? Number(row.cashDiscount) : null,
        ivaRate: row.ivaRate != null ? Number(row.ivaRate) : null,
      })
    }

    // Query con JOIN a suppliers para traer el nombre del proveedor.
    // Sesión 43 día 2 FINAL: agregado s.name AS providerName para que el dueño
    // pueda filtrar por nombre de proveedor en Excel (antes solo tenía el ID).
    const whereClause = soloSinCategoria ? 'WHERE p.categoryId IS NULL' : ''
    const result = await db.execute(
      `SELECT p.name, p.sku, p.costPrice, p.price, p.comparePrice, p.stock,
              p.isActive, p.isFeatured, p.providerId, p.providerSku,
              p.markup, p.cashDiscount, p.ivaRate, p.categoryId,
              c.name as categoryName,
              s.name as providerName
       FROM products p
       LEFT JOIN categories c ON p.categoryId = c.id
       LEFT JOIN suppliers s ON p.providerId = s.id
       ${whereClause}
       ORDER BY p.createdAt DESC`
    )

    const products = result.rows as any[]

    // CSV header — orden solicitado por el dueño
    const headers = [
      'Nombre',
      'SKU',
      'Proveedor',
      'Categoría',
      'Costo USD',
      '% IVA',
      'Precio Lista (IVA incl.)',
      'Precio Efectivo (IVA incl.)',
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
      let ivaRate = p.ivaRate != null ? Number(p.ivaRate) : 10.5

      // Auto-calculate from USD cost if costPrice > 0 (3-tier: product → category → global)
      if (p.costPrice && Number(p.costPrice) > 0) {
        // Get category markup for 3-tier priority
        const catMarkup = p.categoryId ? catMarkupMap.get(p.categoryId) : null
        const catMarkupVal = catMarkup?.markup ?? null
        const catCashDiscountVal = catMarkup?.cashDiscount ?? null
        const catIvaRateVal = catMarkup?.ivaRate ?? null

        // Priority: product individual → category → global
        const effectiveMarkup = p.markup != null ? Number(p.markup) : (catMarkupVal != null ? catMarkupVal : markup)
        const effectiveCashDiscount = p.cashDiscount != null ? Number(p.cashDiscount) : (catCashDiscountVal != null ? catCashDiscountVal : cashDiscount)
        const effectiveIvaRate = p.ivaRate != null ? Number(p.ivaRate) : (catIvaRateVal != null ? catIvaRateVal : 10.5)
        ivaRate = effectiveIvaRate
        // costUSD × (1+IVA) × (1+markup) × dollarRate
        listPrice = Math.ceil(Number(p.costPrice) * (1 + effectiveIvaRate / 100) * (1 + effectiveMarkup / 100) * dollar.rate)
        cashPrice = Math.ceil(Number(p.costPrice) * (1 + effectiveIvaRate / 100) * (1 + (effectiveMarkup - effectiveCashDiscount) / 100) * dollar.rate)
      }

      return [
        escapeCsv(String(p.name || '')),
        escapeCsv(String(p.sku || '')),
        escapeCsv(String(p.providerName || '')),  // Sesión 43 día 2: nombre del proveedor (antes no estaba)
        escapeCsv(String(p.categoryName || 'Sin categoría')),  // Sesión 43 día 2: mostrar "Sin categoría" si no tiene
        p.costPrice && Number(p.costPrice) > 0 ? Number(p.costPrice).toFixed(2) : '',
        ivaRate + '%',
        listPrice > 0 ? String(listPrice) : '',
        cashPrice > 0 ? String(cashPrice) : '',
        String(p.stock ?? 0),
        p.isActive ? 'Sí' : 'No',
        p.isFeatured ? 'Sí' : 'No',
        escapeCsv(String(p.providerId || '')),
        escapeCsv(String(p.providerSku || '')),
      ].join(';')
    })

    // Assemble CSV with BOM (para que Excel reconozca UTF-8 y los acentos)
    const bom = '\uFEFF'
    const csv = bom + [headers.join(';'), ...rows].join('\n')

    // Nombre de archivo según el modo
    const filename = soloSinCategoria
      ? `productos-sin-categoria-compucity-${new Date().toISOString().slice(0, 10)}.csv`
      : `productos-compucity-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
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
