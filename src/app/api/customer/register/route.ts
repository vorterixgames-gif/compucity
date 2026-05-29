import { NextRequest, NextResponse } from 'next/server'
import { createCustomer, getCustomerByEmail, signToken, getCustomerCookieName } from '@/lib/customer-auth'
import { db } from '@/lib/db'

// Rate limit: max 3 registrations per IP in 10 minutes
const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW_MINUTES = 10

async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }> {
  try {
    // Ensure rate_limits table exists
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS rate_limits (
        id TEXT PRIMARY KEY,
        ip TEXT NOT NULL,
        action TEXT NOT NULL,
        createdAt TEXT DEFAULT (datetime('now'))
      )`,
      args: [],
    })

    // Clean up old entries (older than 1 hour)
    await db.execute({
      sql: `DELETE FROM rate_limits WHERE createdAt < datetime('now', '-1 hour')`,
      args: [],
    })

    // Count recent registrations from this IP
    const result = await db.execute({
      sql: `SELECT COUNT(*) as count FROM rate_limits 
            WHERE ip = ? AND action = 'register' AND createdAt > datetime('now', '-${RATE_LIMIT_WINDOW_MINUTES} minutes')`,
      args: [ip],
    })

    const count = (result.rows[0] as any)?.count ?? 0
    return {
      allowed: count < RATE_LIMIT_MAX,
      remaining: Math.max(0, RATE_LIMIT_MAX - count),
    }
  } catch (error) {
    console.error('Rate limit check error:', error)
    // If rate limit check fails, allow the request (fail open)
    return { allowed: true, remaining: RATE_LIMIT_MAX }
  }
}

async function recordAttempt(ip: string): Promise<void> {
  try {
    const id = `rl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    await db.execute({
      sql: `INSERT INTO rate_limits (id, ip, action, createdAt) VALUES (?, ?, 'register', datetime('now'))`,
      args: [id, ip],
    })
  } catch (error) {
    console.error('Rate limit record error:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || request.headers.get('x-real-ip') 
      || 'unknown'

    // Check rate limit
    const rateCheck = await checkRateLimit(ip)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Demasiados intentos de registro. Intentá de nuevo en ${RATE_LIMIT_WINDOW_MINUTES} minutos.` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { name, email, phone, password, dni, address, city, province, postalCode, _hp } = body

    // Honeypot check - si el campo oculto tiene contenido, es un bot
    // No le avisamos que fue detectado, simplemente fallamos silenciosamente
    if (_hp) {
      // Simular respuesta exitosa para no alertar al bot
      return NextResponse.json({
        ok: true,
        customer: {
          id: 'bot_detected',
          name: name || 'Bot',
          email: email || 'bot@fake.com',
          phone: null,
          dni: null,
          address: null,
          city: null,
          province: null,
          postalCode: null,
        },
      })
    }

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
      address,
      city,
      province,
      postalCode,
    })

    // Record the registration attempt for rate limiting
    await recordAttempt(ip)

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
        address: customer.address,
        city: customer.city,
        province: customer.province,
        postalCode: customer.postalCode,
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
