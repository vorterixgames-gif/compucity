import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Sesión 55: paginación — antes cargaba TODAS las órdenes + TODOS los items
    // sin LIMIT, transfiriendo tablas enteras por HTTP. Ahora paginamos.
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20))
    const status = searchParams.get('status') || null
    const search = searchParams.get('search') || null
    const offset = (page - 1) * limit

    // Build WHERE clause
    const whereClauses: string[] = []
    const whereArgs: any[] = []
    if (status) {
      whereClauses.push('status = ?')
      whereArgs.push(status)
    }
    if (search) {
      whereClauses.push('(orderNumber LIKE ? OR customerName LIKE ? OR customerEmail LIKE ?)')
      const term = `%${search}%`
      whereArgs.push(term, term, term)
    }
    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    // Count + data en paralelo
    const [countResult, ordersResult] = await Promise.all([
      db.execute({
        sql: `SELECT COUNT(*) as total FROM orders ${whereStr}`,
        args: whereArgs,
      }),
      db.execute({
        sql: `SELECT * FROM orders ${whereStr} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        args: [...whereArgs, limit, offset],
      }),
    ])

    const total = (countResult.rows[0] as any)?.total ?? 0

    // Solo traer items de las órdenes de esta página (no TODAS)
    const orderIds = (ordersResult.rows as any[]).map(o => o.id)
    let itemsByOrderId = new Map<string, any[]>()

    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',')
      const itemsResult = await db.execute({
        sql: `SELECT * FROM order_items WHERE orderId IN (${placeholders})`,
        args: orderIds,
      })
      for (const item of itemsResult.rows as any[]) {
        if (!itemsByOrderId.has(item.orderId)) itemsByOrderId.set(item.orderId, [])
        itemsByOrderId.get(item.orderId)!.push(item)
      }
    }

    const ordersWithItems = (ordersResult.rows as any[]).map(order => ({
      ...order,
      items: itemsByOrderId.get(order.id) || [],
    }))

    return NextResponse.json({
      ok: true,
      orders: ordersWithItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
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
      // Sesión 51: total manual — permite sobreescribir el total calculado
      // por si el cálculo automático no está bien (descuentos especiales, etc).
      total,
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
    // Sesión 51: total manual
    if (total !== undefined) {
      const totalNum = Number(total)
      if (isNaN(totalNum) || totalNum < 0) {
        return NextResponse.json({ error: 'Total inválido' }, { status: 400 })
      }
      fields.push('total = ?'); values.push(totalNum)
    }

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
