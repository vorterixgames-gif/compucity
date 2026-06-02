import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { code, cartTotal } = await request.json()

    if (!code || !cartTotal || cartTotal <= 0) {
      return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 })
    }

    // Find the coupon by code
    const result = await db.execute({
      sql: 'SELECT * FROM coupons WHERE code = ?',
      args: [code.toUpperCase().trim()],
    })

    const rows = result.rows as any[]
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'Cupón no encontrado' })
    }

    const coupon = rows[0]

    // Check if active
    if (!coupon.isActive || coupon.isActive !== 1) {
      return NextResponse.json({ ok: false, error: 'Este cupón no está activo' })
    }

    // Check dates
    const now = new Date()
    if (coupon.validFrom) {
      const start = new Date(coupon.validFrom)
      start.setHours(0, 0, 0, 0)
      if (now < start) {
        return NextResponse.json({ ok: false, error: 'Este cupón aún no está vigente' })
      }
    }
    if (coupon.validUntil) {
      const end = new Date(coupon.validUntil)
      end.setHours(23, 59, 59, 999)
      if (now > end) {
        return NextResponse.json({ ok: false, error: 'Este cupón ya expiró' })
      }
    }

    // Check max uses
    if (coupon.maxUses && coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json({ ok: false, error: 'Este cupón ya alcanzó el máximo de usos' })
    }

    // Check minimum purchase
    if (coupon.minPurchase && coupon.minPurchase > 0 && cartTotal < coupon.minPurchase) {
      return NextResponse.json({
        ok: false,
        error: `Compra mínima de $${Number(coupon.minPurchase).toLocaleString('es-AR')} para usar este cupón`,
      })
    }

    // Calculate discount
    let discountAmount = 0
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.round(cartTotal * (coupon.discountValue / 100))
    } else {
      // Fixed amount
      discountAmount = Math.min(coupon.discountValue, cartTotal)
    }

    return NextResponse.json({
      ok: true,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        description: coupon.description,
      },
      discountAmount,
    })
  } catch (error) {
    console.error('Coupon validation error:', error)
    return NextResponse.json({ ok: false, error: 'Error del servidor' }, { status: 500 })
  }
}
