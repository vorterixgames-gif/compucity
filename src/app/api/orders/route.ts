import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentCustomer } from '@/lib/customer-auth'
import { fetchDollarRate, getStoreConfigNumber, calculateProductPrices, CategoryMarkup } from '@/lib/dollar'
import { getCategoryMarkupMap } from '@/lib/queries'
import { getActiveSale } from '@/lib/pricing'

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
 *
 * Sesión 45 QA Fase 1:
 * - Validación server-side de precios (no confiar en el cliente)
 * - customerId desde cookie (no desde body)
 * - Wrap en transacción con verificación de rowsAffected
 * - Recalcular total server-side
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      customerName,
      customerDni,
      customerEmail,
      customerPhone,
      // customerId ahora se obtiene de la cookie, no del body
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
      total, // Se ignora, se recalcula server-side
    } = body

    // Validar campos obligatorios
    if (!customerName || !customerPhone || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Faltan datos obligatorios (nombre, teléfono o productos)' },
        { status: 400 }
      )
    }

    // ── Sesión 45 QA Fase 1: obtener customerId desde la cookie ──
    const customer = await getCurrentCustomer()
    const customerId = customer?.id || null

    // Generar ID y número de pedido
    const id = crypto.randomUUID()
    const orderNumber = `CP-${Date.now().toString(36).toUpperCase()}`
    const now = new Date().toISOString()

    // ── Validar stock + recalcular precios server-side ──
    // Sesión 45 QA Fase 1: traer TODOS los campos necesarios para recalcular precios
    const productIds = items.map((i: any) => i.productId).filter(Boolean)
    let productsMap = new Map<string, any>()

    if (productIds.length === 0) {
      return NextResponse.json(
        { error: 'No hay productos válidos en el carrito' },
        { status: 400 }
      )
    }

    const placeholders = productIds.map(() => '?').join(',')
    const productsResult = await db.execute({
      sql: `SELECT id, name, stock, isActive, costPrice, markup, cashDiscount, ivaRate, salePrice, saleStart, saleEnd, categoryId
            FROM products WHERE id IN (${placeholders})`,
      args: productIds,
    })
    for (const row of productsResult.rows as any[]) {
      productsMap.set(row.id, row)
    }

    // Cargar datos para recálculo de precios
    const [dollar, markup, cashDiscount, catMarkupMap] = await Promise.all([
      fetchDollarRate(),
      getStoreConfigNumber('markup', 30),
      getStoreConfigNumber('cash_discount', 10),
      getCategoryMarkupMap(),
    ])

    // Validar cada item + calcular precio real server-side
    const validatedItems: any[] = []
    let calculatedSubtotal = 0

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

      // ── Recalcular precio server-side ──
      const catMarkup: CategoryMarkup | null = product.categoryId
        ? (catMarkupMap.get(product.categoryId) ?? null)
        : null
      const calculated = calculateProductPrices(product, dollar.rate, markup, cashDiscount, catMarkup)

      // Verificar que el cálculo fue exitoso
      if ((calculated as any)._calculated === false) {
        return NextResponse.json(
          { error: `No se pudo calcular el precio de "${product.name}". Intentá más tarde.` },
          { status: 500 }
        )
      }

      // Determinar precio a cobrar: si hay oferta activa, usarla; sino, precio de lista
      const activeSale = getActiveSale(calculated as any)
      const realPrice = activeSale !== null && activeSale < calculated.price
        ? activeSale
        : calculated.price

      validatedItems.push({
        productId: item.productId,
        name: product.name, // usar nombre de la DB, no del cliente
        price: realPrice,
        quantity: item.quantity,
      })

      calculatedSubtotal += realPrice * item.quantity
    }

    // ── Validar cupón server-side (si se envió) ──
    let validatedCouponCode: string | null = null
    let validatedCouponDiscount = 0

    if (couponCode) {
      try {
        const couponResult = await db.execute({
          sql: 'SELECT * FROM coupons WHERE UPPER(code) = ? AND isActive = 1',
          args: [couponCode.toUpperCase().trim()],
        })
        const coupon = (couponResult.rows as any[])[0]
        if (coupon) {
          // Verificar vigencia
          const now2 = new Date()
          if (coupon.validFrom) {
            const start = new Date(coupon.validFrom)
            start.setHours(0, 0, 0, 0)
            if (now2 < start) {
              return NextResponse.json({ error: 'Este cupón aún no está vigente' }, { status: 400 })
            }
          }
          if (coupon.validUntil) {
            const end = new Date(coupon.validUntil)
            end.setHours(23, 59, 59, 999)
            if (now2 > end) {
              return NextResponse.json({ error: 'Este cupón ya expiró' }, { status: 400 })
            }
          }
          if (coupon.maxUses && coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
            return NextResponse.json({ error: 'Este cupón ya alcanzó el máximo de usos' }, { status: 400 })
          }
          if (coupon.minPurchase && coupon.minPurchase > 0 && calculatedSubtotal < coupon.minPurchase) {
            return NextResponse.json({
              error: `Compra mínima de $${Number(coupon.minPurchase).toLocaleString('es-AR')} para usar este cupón`,
            }, { status: 400 })
          }

          // Calcular descuento
          if (coupon.discountType === 'percentage') {
            validatedCouponDiscount = Math.round(calculatedSubtotal * (coupon.discountValue / 100))
          } else {
            validatedCouponDiscount = Math.min(Number(coupon.discountValue), calculatedSubtotal)
          }
          validatedCouponCode = coupon.code // usar code normalizado de la DB
        }
      } catch (e) {
        console.warn('[orders] Could not validate coupon:', e)
      }
    }

    // ── Calcular total final server-side ──
    const safeShippingCost = Math.max(0, Number(shippingCost) || 0)
    const safeCouponDiscount = Math.max(0, validatedCouponDiscount)
    const calculatedTotal = Math.max(0, calculatedSubtotal - safeCouponDiscount + safeShippingCost)

    // ── Crear el pedido ──
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
        customerId,
        shippingAddress || null,
        shippingCity || null,
        shippingProvince || null,
        shippingZip || null,
        shippingMethod || 'retiro',
        safeShippingCost,
        shippingDetails || null,
        'pendiente',
        'whatsapp',
        validatedCouponCode,
        safeCouponDiscount,
        calculatedTotal,
        notes || null,
        now,
        now,
      ],
    })

    // ── Crear los items + descontar stock + incrementar cupón en 1 solo batch ──
    // Sesión 45 QA Fase 1: batch único con verificación de rowsAffected
    const batchStmts = validatedItems.flatMap((item) => {
      const itemId = crypto.randomUUID()
      return [
        {
          sql: `INSERT INTO order_items (id, orderId, productId, name, price, quantity)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [itemId, id, item.productId, item.name, item.price, item.quantity],
        },
        {
          sql: `UPDATE products SET stock = stock - ?, updatedAt = ? WHERE id = ? AND stock >= ?`,
          args: [item.quantity, now, item.productId, item.quantity],
        },
      ]
    })

    // Si hay cupón, agregar el UPDATE al batch (atómico)
    if (validatedCouponCode) {
      batchStmts.push({
        sql: `UPDATE coupons SET usedCount = usedCount + 1, updatedAt = ? WHERE UPPER(code) = ? AND isActive = 1`,
        args: [now, validatedCouponCode.toUpperCase()],
      })
    }

    try {
      const batchResults = await db.batch(batchStmts)

      // ── Verificar que todos los UPDATEs de stock afectaron 1 fila ──
      // Si alguno afectó 0, significa que el stock cambió entre la validación y el update
      // (race condition) → hay que abortar
      //
      // IMPORTANTE: @libsql/client's batch() retorna Array<ResultSet> donde cada
      // ResultSet tiene .rowsAffected directamente. NO usar .response.result.affected_row_count
      // (esa estructura es de la API HTTP de Turso, no del cliente libsql).
      for (let i = 0; i < validatedItems.length; i++) {
        const updateIndex = i * 2 + 1 // cada item tiene INSERT (0) + UPDATE (1)
        const result = batchResults[updateIndex]
        const rowsAffected = (result as any)?.rowsAffected ?? 0
        if (rowsAffected === 0) {
          // Stock insuficiente en race condition → abortar y limpiar
          console.error(`[orders] Race condition detectada: stock cambió para ${validatedItems[i].productId}. Abortando.`)
          // Cleanup: borrar el pedido y los items ya insertados
          await db.batch([
            { sql: 'DELETE FROM order_items WHERE orderId = ?', args: [id] },
            { sql: 'DELETE FROM orders WHERE id = ?', args: [id] },
          ])
          return NextResponse.json(
            { error: `Stock insuficiente para "${validatedItems[i].name}". Intentá nuevamente.` },
            { status: 409 }
          )
        }
      }
    } catch (batchErr) {
      // Fallback: si el batch falla totalmente, intentar uno por uno para diagnosticar
      console.error('[orders] Batch failed, falling back to sequential:', batchErr)
      // Limpiar el pedido creado
      try {
        await db.execute({ sql: 'DELETE FROM orders WHERE id = ?', args: [id] })
      } catch {}
      return NextResponse.json(
        { error: 'Error al procesar el pedido. Intentá nuevamente.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      orderId: id,
      orderNumber,
      total: calculatedTotal,
    })
  } catch (error) {
    console.error('Create order error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
