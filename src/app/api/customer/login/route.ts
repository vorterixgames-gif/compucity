import { NextRequest, NextResponse } from 'next/server'
import { getCustomerByEmail, getCustomerCookieName } from '@/lib/customer-auth'
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

    const customer = await getCustomerByEmail(email.toLowerCase().trim())
    if (!customer) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      )
    }

    const valid = await verifyPassword(password, customer.password)
    if (!valid) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      )
    }

    // Sign the email with HMAC to prevent cookie forgery
    const signedToken = await signToken(customer.email)

    const response = NextResponse.json({
      ok: true,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        dni: customer.dni,
      },
    })

    // Set cookie with HMAC-signed token
    response.cookies.set(getCustomerCookieName(), signedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Customer login error:', error)
    return NextResponse.json(
      { error: 'Error del servidor' },
      { status: 500 }
    )
  }
}
