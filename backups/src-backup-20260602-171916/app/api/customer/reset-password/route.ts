import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/customer-auth'

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token y contraseña son requeridos' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    // Find the token
    const tokenResult = await db.execute({
      sql: `SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0`,
      args: [token],
    })

    const tokenRows = tokenResult.rows as any[]
    if (tokenRows.length === 0) {
      return NextResponse.json(
        { error: 'El enlace es inválido o ya expiró. Solicitá uno nuevo.' },
        { status: 400 }
      )
    }

    const resetToken = tokenRows[0]

    // Check if token expired
    if (new Date(resetToken.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'El enlace expiró. Solicitá uno nuevo para restablecer tu contraseña.' },
        { status: 400 }
      )
    }

    // Hash the new password
    const hashedPassword = await hashPassword(password)

    // Update the customer's password
    await db.execute({
      sql: `UPDATE customers SET password = ?, updatedAt = datetime('now') WHERE id = ?`,
      args: [hashedPassword, resetToken.customerId],
    })

    // Mark token as used
    await db.execute({
      sql: `UPDATE password_reset_tokens SET used = 1 WHERE id = ?`,
      args: [resetToken.id],
    })

    // Invalidate all other tokens for this customer too
    await db.execute({
      sql: `UPDATE password_reset_tokens SET used = 1 WHERE customerId = ? AND used = 0`,
      args: [resetToken.customerId],
    })

    return NextResponse.json({
      ok: true,
      message: 'Contraseña actualizada correctamente.',
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'Error del servidor' },
      { status: 500 }
    )
  }
}

// Verify token validity (GET)
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token no proporcionado' }, { status: 400 })
    }

    const tokenResult = await db.execute({
      sql: `SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0`,
      args: [token],
    })

    const tokenRows = tokenResult.rows as any[]
    if (tokenRows.length === 0) {
      return NextResponse.json({ valid: false, error: 'Token inválido o ya usado' })
    }

    const resetToken = tokenRows[0]
    if (new Date(resetToken.expiresAt) < new Date()) {
      return NextResponse.json({ valid: false, error: 'Token expirado' })
    }

    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error('Verify token error:', error)
    return NextResponse.json({ valid: false, error: 'Error del servidor' }, { status: 500 })
  }
}
