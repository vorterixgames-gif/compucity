import { NextRequest, NextResponse } from 'next/server'
import { createCustomer, getCustomerByEmail, signToken, getCustomerCookieName } from '@/lib/customer-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, password, dni } = body

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Nombre, email y contraseña son requeridos' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      )
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existing = await getCustomerByEmail(email)
    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe una cuenta con ese email' },
        { status: 409 }
      )
    }

    // Create customer
    const customer = await createCustomer({
      name,
      email: email.toLowerCase().trim(),
      phone,
      password,
      dni,
    })

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
    console.error('Customer register error:', error)
    return NextResponse.json(
      { error: 'Error del servidor' },
      { status: 500 }
    )
  }
}
