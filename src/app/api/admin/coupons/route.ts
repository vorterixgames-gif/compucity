import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const result = await db.execute('SELECT * FROM coupons ORDER BY createdAt DESC')
    return NextResponse.json({ ok: true, coupons: result.rows })
  } catch (error) {
    console.error('Get coupons error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const {
      code, description, discountType, discountValue,
      minPurchase, maxUses, validFrom, validUntil, isActive,
    } = body

    if (!code || !discountType || discountValue === undefined || discountValue <= 0) {
      return NextResponse.json({ error: 'Código, tipo y valor de descuento son requeridos' }, { status: 400 })
    }

    // Check code uniqueness
    const existing = await db.execute({
      sql: 'SELECT id FROM coupons WHERE code = ?',
      args: [code.toUpperCase().trim()],
    })
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Ya existe un cupón con ese código' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await db.execute({
      sql: `INSERT INTO coupons (id, code, description, discountType, discountValue, minPurchase, maxUses, usedCount, validFrom, validUntil, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      args: [
        id,
        code.toUpperCase().trim(),
        description || null,
        discountType,
        Number(discountValue),
        minPurchase ? Number(minPurchase) : 0,
        maxUses ? Number(maxUses) : 0,
        validFrom || null,
        validUntil || null,
        isActive !== false ? 1 : 0,
        now, now,
      ],
    })

    return NextResponse.json({ ok: true, coupon: { id } })
  } catch (error) {
    console.error('Create coupon error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id, code, description, discountType, discountValue,
      minPurchase, maxUses, validFrom, validUntil, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    // If code is being changed, check uniqueness
    if (code) {
      const existing = await db.execute({
        sql: 'SELECT id FROM coupons WHERE code = ? AND id != ?',
        args: [code.toUpperCase().trim(), id],
      })
      if (existing.rows.length > 0) {
        return NextResponse.json({ error: 'Ya existe un cupón con ese código' }, { status: 400 })
      }
    }

    const fields: string[] = []
    const values: any[] = []

    if (code !== undefined) { fields.push('code = ?'); values.push(code.toUpperCase().trim()) }
    if (description !== undefined) { fields.push('description = ?'); values.push(description || null) }
    if (discountType !== undefined) { fields.push('discountType = ?'); values.push(discountType) }
    if (discountValue !== undefined) { fields.push('discountValue = ?'); values.push(Number(discountValue)) }
    if (minPurchase !== undefined) { fields.push('minPurchase = ?'); values.push(Number(minPurchase) || 0) }
    if (maxUses !== undefined) { fields.push('maxUses = ?'); values.push(Number(maxUses) || 0) }
    if (validFrom !== undefined) { fields.push('validFrom = ?'); values.push(validFrom || null) }
    if (validUntil !== undefined) { fields.push('validUntil = ?'); values.push(validUntil || null) }
    if (isActive !== undefined) { fields.push('isActive = ?'); values.push(isActive ? 1 : 0) }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    fields.push('updatedAt = ?')
    values.push(new Date().toISOString())
    values.push(id)

    await db.execute({
      sql: `UPDATE coupons SET ${fields.join(', ')} WHERE id = ?`,
      args: values,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Update coupon error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    await db.execute({
      sql: 'DELETE FROM coupons WHERE id = ?',
      args: [id],
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete coupon error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
