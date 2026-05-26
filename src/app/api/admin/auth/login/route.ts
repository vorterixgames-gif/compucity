import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, signToken } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      )
    }

    const result = await db.execute({
      sql: 'SELECT * FROM admins WHERE email = ?',
      args: [email],
    })

    const admin = result.rows as any[]
    if (!admin.length) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      )
    }

    const valid = await verifyPassword(password, admin[0].password)
    if (!valid) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      )
    }

    // Sign the email with HMAC to prevent cookie forgery
    const signedToken = await signToken(email)

    const response = NextResponse.json({
      ok: true,
      admin: {
        id: admin[0].id,
        email: admin[0].email,
        name: admin[0].name,
        role: admin[0].role,
      },
    })

    // Set cookie with HMAC-signed token (email.signature)
    response.cookies.set('admin_token', signedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Error del servidor' },
      { status: 500 }
    )
  }
}
