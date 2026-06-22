import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentCustomer } from '@/lib/customer-auth'

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

    // Check if the requesting customer owns this order
    const customer = await getCurrentCustomer()
    const isOwner = customer && order.customerId === customer.id

    // Strip sensitive PII unless the customer is the owner
    const { customerDni, customerEmail, customerPhone, shippingAddress, shippingCity, shippingProvince, shippingZip, ...safeOrder } = order

    return NextResponse.json({
      ok: true,
      order: {
        ...safeOrder,
        items: itemsResult.rows,
        ...(isOwner ? { customerDni, customerEmail, customerPhone, shippingAddress, shippingCity, shippingProvince, shippingZip } : {}),
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
      couponCode,
      couponDiscount,
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

    // ── Validar stock de cada producto (sesión 44: 1 query para todos) ──
    // Antes: 1 query por item en loop secuencial (N queries)
    // Ahora: 1 sola query con IN (...) y validación en memoria
    const productIds = items.map((i: any) => i.productId).filter(Boolean)
    let productsMap = new Map<string, any>()

    if (productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(',')
      const productsResult = await db.execute({
        sql: `SELECT id, name, stock, isActive FROM products WHERE id IN (${placeholders})`,
        args: productIds,
      })
      for (const row of productsResult.rows as any[]) {
        productsMap.set(row.id, row)
      }
    }

    for (const item of items) {
      const product = productsMap.get(item.productId)

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
        status, paymentMethod, couponCode, couponDiscount, total, notes, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        couponCode || null,
        couponDiscount || 0,
        total,
        notes || null,
        now,
        now,
      ],
    })

    // ── Crear los items del pedido y descontar stock (sesión 44: en batch) ──
    // Antes: 2 queries por item en loop secuencial (2N queries)
    // Ahora: 1 db.batch() con todos los INSERT + UPDATE (1 request HTTP, 2N statements)
    const batchStmts = items.flatMap((item: any) => {
      const itemId = crypto.randomUUID()
      return [
        {
          sql: `INSERT INTO order_items (id, orderId, productId, name, price, quantity)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [itemId, id, item.productId, item.name, item.price, item.quantity],
        },
        {
          sql: `UPDATE products SET stock = stock - ?, updatedAt = ? WHERE id = ? AND stock > 0`,
          args: [item.quantity, now, item.productId],
        },
      ]
    })

    try {
      await db.batch(batchStmts)
    } catch (batchErr) {
      // Fallback: si el batch falla, intentar uno por uno para diagnosticar
      console.error('[orders] Batch failed, falling back to sequential:', batchErr)
      for (const stmt of batchStmts) {
        try { await db.execute(stmt) } catch (e) { console.error('[orders] Stmt failed:', e) }
      }
    }

    // ── Incrementar uso del cupón ──
    if (couponCode) {
      try {
        await db.execute({
          sql: `UPDATE coupons SET usedCount = usedCount + 1, updatedAt = ? WHERE UPPER(code) = ? AND isActive = 1`,
          args: [now, couponCode.toUpperCase().trim()],
        })
      } catch (e) {
        console.warn('[orders] Could not increment coupon usedCount:', e)
      }
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
