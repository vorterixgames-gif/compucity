import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/orders?orderNumber=CP-XXXX — Buscar un pedido por número
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderNumber = searchParams.get('orderNumber')

    if (!orderNumber) {
      return NextResponse.json(
        { error: 'Número de pedido requerido' },
        { status: 400 }
      )
    }

    const result = await db.execute({
      sql: 'SELECT * FROM orders WHERE orderNumber = ?',
      args: [orderNumber.trim()],
    })

    const order = result.rows[0] as any
    if (!order) {
      return NextResponse.json(
        { error: 'Pedido no encontrado' },
        { status: 404 }
      )
    }

    // Get order items
    const itemsResult = await db.execute({
      sql: 'SELECT * FROM order_items WHERE orderId = ?',
      args: [order.id],
    })

    return NextResponse.json({
      ok: true,
      order: {
        ...order,
        items: itemsResult.rows,
      },
    })
  } catch (error) {
    console.error('Get order error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

/**
 * POST /api/orders — Crear un nuevo pedido
 * Guarda el pedido + items en la DB, valida stock, descuenta inventario
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      customerName,
      customerDni,
      customerEmail,
      customerPhone,
      customerId,
      shippingAddress,
      shippingCity,
      shippingProvince,
      shippingZip,
      shippingMethod,
      shippingCost,
      // Shipping detail stored as JSON in notes if needed
      shippingDetails,
      notes,
      items,
      total,
    } = body

    // Validar campos obligatorios
    if (!customerName || !customerPhone || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Faltan datos obligatorios (nombre, teléfono o productos)' },
        { status: 400 }
      )
    }

    // Generar ID y número de pedido
    const id = crypto.randomUUID()
    const orderNumber = `CP-${Date.now().toString(36).toUpperCase()}`
    const now = new Date().toISOString()

    // ── Validar stock de cada producto (server-side) ──
    for (const item of items) {
      const productResult = await db.execute({
        sql: 'SELECT id, name, stock, isActive FROM products WHERE id = ?',
        args: [item.productId],
      })
      const product = productResult.rows[0] as any

      if (!product) {
        return NextResponse.json(
          { error: `Producto no encontrado: ${item.name}` },
          { status: 400 }
        )
      }

      if (!product.isActive) {
        return NextResponse.json(
          { error: `Producto no disponible: ${product.name}` },
          { status: 400 }
        )
      }

      if (product.stock >= 0 && product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Stock insuficiente para "${product.name}". Disponible: ${product.stock}` },
          { status: 400 }
        )
      }
    }

    // ── Crear el pedido ──
    // Store shippingDetails in its own column, keep notes clean
    await db.execute({
      sql: `INSERT INTO orders (
        id, orderNumber, customerName, customerDni, customerEmail, customerPhone,
        customerId,
        shippingAddress, shippingCity, shippingProvince, shippingZip,
        shippingMethod, shippingCost, shippingDetails,
        status, paymentMethod, total, notes, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        orderNumber,
        customerName,
        customerDni || null,
        customerEmail || null,
        customerPhone,
        customerId || null,
        shippingAddress || null,
        shippingCity || null,
        shippingProvince || null,
        shippingZip || null,
        shippingMethod || 'retiro',
        shippingCost || 0,
        shippingDetails || null,
        'pendiente',
        'whatsapp',
        total,
        notes || null,
        now,
        now,
      ],
    })

    // ── Crear los items del pedido y descontar stock ──
    for (const item of items) {
      const itemId = crypto.randomUUID()
      await db.execute({
        sql: `INSERT INTO order_items (id, orderId, productId, name, price, quantity)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [itemId, id, item.productId, item.name, item.price, item.quantity],
      })

      // Descontar stock del producto
      await db.execute({
        sql: `UPDATE products SET stock = stock - ?, updatedAt = ? WHERE id = ? AND stock > 0`,
        args: [item.quantity, now, item.productId],
      })
    }

    return NextResponse.json({
      ok: true,
      orderId: id,
      orderNumber,
    })
  } catch (error) {
    console.error('Create order error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
