import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/admin/suppliers/recategorize
 * Re-assigns categories to all products of a supplier based on the category mappings.
 * Body: { supplierId }
 *
 * This is used after the admin maps supplier categories to store categories.
 * It updates the categoryId of all products that have a supplierCategory matching a mapping.
 */
export async function POST(request: Request) {
  try {
    const { supplierId } = await request.json()

    if (!supplierId) {
      return NextResponse.json({ error: 'supplierId requerido' }, { status: 400 })
    }

    // Get all mappings for this supplier
    const mappingsResult = await db.execute({
      sql: 'SELECT supplierCategory, storeCategoryId FROM supplier_category_mappings WHERE supplierId = ?',
      args: [supplierId],
    })

    const mappings = mappingsResult.rows as any[]

    if (mappings.length === 0) {
      return NextResponse.json({
        ok: false,
        message: 'No hay mapeos de categorías configurados para este proveedor. Configure los mapeos primero.',
      })
    }

    let totalUpdated = 0

    for (const mapping of mappings) {
      const result = await db.execute({
        sql: 'UPDATE products SET categoryId = ?, updatedAt = ? WHERE providerId = ? AND supplierCategory = ?',
        args: [mapping.storeCategoryId, new Date().toISOString(), supplierId, mapping.supplierCategory],
      })
      totalUpdated += (result.rowsAffected as number) || 0
    }

    return NextResponse.json({
      ok: true,
      message: `Se recategorizaron ${totalUpdated} productos usando ${mappings.length} mapeos de categorías.`,
      totalUpdated,
      mappingsUsed: mappings.length,
    })
  } catch (error) {
    console.error('Recategorize error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
