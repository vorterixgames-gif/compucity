import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const result = await db.execute(
      'SELECT * FROM orders ORDER BY createdAt DESC'
    )

    const orders = result.rows as any[]

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await db.execute({
          sql: 'SELECT * FROM order_items WHERE orderId = ?',
          args: [order.id],
        })
        return { ...order, items: items.rows }
      })
    )

    return NextResponse.json({ ok: true, orders: ordersWithItems })
  } catch (error) {
    console.error('Get orders error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id, status, trackingNumber, notes } = body

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const fields: string[] = []
    const values: any[] = []

    if (status !== undefined) { fields.push('status = ?'); values.push(status) }
    if (trackingNumber !== undefined) { fields.push('trackingNumber = ?'); values.push(trackingNumber) }
    if (notes !== undefined) { fields.push('notes = ?'); values.push(notes) }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    fields.push('updatedAt = ?')
    values.push(now)
    values.push(id)

    await db.execute({
      sql: `UPDATE orders SET ${fields.join(', ')} WHERE id = ?`,
      args: values,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Update order error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    // Verify order exists
    const existing = await db.execute({
      sql: 'SELECT id, orderNumber FROM orders WHERE id = ?',
      args: [id],
    })

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    // Delete order items first (foreign key constraint)
    await db.execute({
      sql: 'DELETE FROM order_items WHERE orderId = ?',
      args: [id],
    })

    // Delete the order
    await db.execute({
      sql: 'DELETE FROM orders WHERE id = ?',
      args: [id],
    })

    return NextResponse.json({ ok: true, deletedOrderNumber: (existing.rows[0] as any).orderNumber })
  } catch (error) {
    console.error('Delete order error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
