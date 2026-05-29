import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    // Verify admin
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { customerId } = await request.json()

    if (!customerId) {
      return NextResponse.json({ error: 'ID de cliente requerido' }, { status: 400 })
    }

    // Check customer exists
    const customerResult = await db.execute({
      sql: `SELECT id, name, email FROM customers WHERE id = ?`,
      args: [customerId],
    })

    const customerRows = customerResult.rows as any[]
    if (customerRows.length === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    const customer = customerRows[0]

    // Ensure password_reset_tokens table exists
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        customerId TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expiresAt TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT (datetime('now'))
      )`,
      args: [],
    })

    // Invalidate any existing tokens for this customer
    await db.execute({
      sql: `UPDATE password_reset_tokens SET used = 1 WHERE customerId = ? AND used = 0`,
      args: [customerId],
    })

    // Generate a new token
    const token = crypto.randomUUID() + crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours for admin-generated
    const tokenId = crypto.randomUUID()

    await db.execute({
      sql: `INSERT INTO password_reset_tokens (id, customerId, token, expiresAt, used, createdAt)
            VALUES (?, ?, ?, ?, 0, datetime('now'))`,
      args: [tokenId, customerId, token, expiresAt],
    })

    // Build the reset URL
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://compucity.vercel.app'
    const resetUrl = `${baseUrl}/resetear-contrasena?token=${token}`

    return NextResponse.json({
      ok: true,
      resetUrl,
      customer: {
        name: customer.name,
        email: customer.email,
      },
    })
  } catch (error) {
    console.error('Admin reset password error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
