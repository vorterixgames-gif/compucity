import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Sesión 44: N+1 fix — antes hacía 1 query por order para obtener sus items
    // (1 + N queries). Ahora traemos todo en 2 queries paralelas y armamos el
    // map en memoria. Para 50 pedidos: 51 queries → 2 queries (96% reducción).
    //
    // Sesión 45 hotfix: la tabla order_items NO tiene columna createdAt.
    // El ORDER BY createdAt DESC rompía con SQL_INPUT_ERROR, hacía que el
    // Promise.all rechazara, el endpoint retornaba 500, y /admin/pedidos
    // mostraba "No hay pedidos aún" aunque existieran. Cambiado a ORDER BY orderId.
    const [ordersResult, itemsResult] = await Promise.all([
      db.execute('SELECT * FROM orders ORDER BY createdAt DESC'),
      db.execute('SELECT * FROM order_items ORDER BY orderId'),
    ])

    // Agrupar items por orderId en memoria
    const itemsByOrderId = new Map<string, any[]>()
    for (const item of itemsResult.rows as any[]) {
      if (!itemsByOrderId.has(item.orderId)) itemsByOrderId.set(item.orderId, [])
      itemsByOrderId.get(item.orderId)!.push(item)
    }

    const ordersWithItems = (ordersResult.rows as any[]).map(order => ({
      ...order,
      items: itemsByOrderId.get(order.id) || [],
    }))

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
    const {
      id, status, trackingNumber, notes,
      // Sesión 51: campos del snapshot del cliente en el pedido.
      // Se actualizan cuando se edita el cliente vinculado desde /admin/pedidos
      // para que el pedido refleje los datos actuales del cliente.
      customerName, customerEmail, customerPhone, customerDni,
      shippingAddress, shippingCity, shippingProvince, shippingZip,
    } = body

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const fields: string[] = []
    const values: any[] = []

    if (status !== undefined) { fields.push('status = ?'); values.push(status) }
    if (trackingNumber !== undefined) { fields.push('trackingNumber = ?'); values.push(trackingNumber) }
    if (notes !== undefined) { fields.push('notes = ?'); values.push(notes) }
    // Sesión 51: snapshot del cliente
    if (customerName !== undefined) { fields.push('customerName = ?'); values.push(customerName) }
    if (customerEmail !== undefined) { fields.push('customerEmail = ?'); values.push(customerEmail) }
    if (customerPhone !== undefined) { fields.push('customerPhone = ?'); values.push(customerPhone) }
    if (customerDni !== undefined) { fields.push('customerDni = ?'); values.push(customerDni) }
    if (shippingAddress !== undefined) { fields.push('shippingAddress = ?'); values.push(shippingAddress) }
    if (shippingCity !== undefined) { fields.push('shippingCity = ?'); values.push(shippingCity) }
    if (shippingProvince !== undefined) { fields.push('shippingProvince = ?'); values.push(shippingProvince) }
    if (shippingZip !== undefined) { fields.push('shippingZip = ?'); values.push(shippingZip) }

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
