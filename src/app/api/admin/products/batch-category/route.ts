import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'

/**
 * POST /api/admin/products/batch-category
 * Batch update categoryId for multiple products in a single request.
 * Body: { productIds: string[], categoryId: string }
 * Returns: { updated: number }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { productIds, categoryId } = body

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'productIds debe ser un array con al menos un ID' }, { status: 400 })
    }

    if (!categoryId || typeof categoryId !== 'string') {
      return NextResponse.json({ error: 'categoryId es requerido' }, { status: 400 })
    }

    // Verify category exists
    const catResult = await db.execute({
      sql: 'SELECT id FROM categories WHERE id = ?',
      args: [categoryId],
    })
    if (catResult.rows.length === 0) {
      return NextResponse.json({ error: 'La categoría no existe' }, { status: 404 })
    }

    // Build batch update — use a single query with IN clause
    const placeholders = productIds.map(() => '?').join(',')
    const now = new Date().toISOString()

    const result = await db.execute({
      sql: `UPDATE products SET categoryId = ?, updatedAt = ? WHERE id IN (${placeholders})`,
      args: [categoryId, now, ...productIds],
    })

    const updated = Number(result.rowsAffected ?? 0)

    return NextResponse.json({
      updated,
      message: `${updated} producto${updated !== 1 ? 's' : ''} movido${updated !== 1 ? 's' : ''} correctamente`,
    })
  } catch (error: any) {
    console.error('Error batch updating category:', error)
    return NextResponse.json({ error: 'Error del servidor', detail: error?.message }, { status: 500 })
  }
}
