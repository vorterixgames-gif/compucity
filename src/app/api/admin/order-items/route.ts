import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

/**
 * PUT /api/admin/order-items
 * Body: { id: string, name?: string, price?: number, quantity?: number }
 *
 * Actualiza un item del pedido (tabla order_items).
 * NO recalcula el total del pedido acá — el frontend debe hacer un PUT
 * separado a /api/admin/orders con el nuevo total calculado.
 */
export async function PUT(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id, name, price, quantity } = body

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    // Verificar que el item existe
    const existing = await db.execute({
      sql: 'SELECT id, orderId FROM order_items WHERE id = ?',
      args: [id],
    })
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })
    }

    // UPDATE dinámico
    const fields: string[] = []
    const values: any[] = []
    if (name !== undefined) { fields.push('name = ?'); values.push(name) }
    if (price !== undefined) {
      const priceNum = Number(price)
      if (isNaN(priceNum) || priceNum < 0) {
        return NextResponse.json({ error: 'Precio inválido' }, { status: 400 })
      }
      fields.push('price = ?'); values.push(priceNum)
    }
    if (quantity !== undefined) {
      const qtyNum = parseInt(quantity, 10)
      if (isNaN(qtyNum) || qtyNum < 1) {
        return NextResponse.json({ error: 'Cantidad inválida (mínimo 1)' }, { status: 400 })
      }
      fields.push('quantity = ?'); values.push(qtyNum)
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    values.push(id)
    await db.execute({
      sql: `UPDATE order_items SET ${fields.join(', ')} WHERE id = ?`,
      args: values,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Update order item error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/order-items?id=X
 * Elimina un item del pedido. El frontend debe recalcular el total.
 */
export async function DELETE(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const existing = await db.execute({
      sql: 'SELECT id FROM order_items WHERE id = ?',
      args: [id],
    })
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })
    }

    await db.execute({
      sql: 'DELETE FROM order_items WHERE id = ?',
      args: [id],
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete order item error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
