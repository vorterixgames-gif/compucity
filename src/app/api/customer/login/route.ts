import { NextRequest, NextResponse } from 'next/server'
import { getCustomerByEmail, getCustomerCookieName } from '@/lib/customer-auth'
import { verifyPassword, signToken } from '@/lib/admin-auth'
import { db } from '@/lib/db'

// Sesión 45 QA Fase 1: rate limit para prevenir brute force de passwords.
// Copy del patrón de register/route.ts pero con 5 intentos (más permisivo que register que es 3).
const RATE_LIMIT_MAX = 5
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

    // Count recent login attempts from this IP
    const result = await db.execute({
      sql: `SELECT COUNT(*) as count FROM rate_limits
            WHERE ip = ? AND action = 'login' AND createdAt > datetime('now', '-${RATE_LIMIT_WINDOW_MINUTES} minutes')`,
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
      sql: `INSERT INTO rate_limits (id, ip, action, createdAt) VALUES (?, ?, 'login', datetime('now'))`,
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
        { error: `Demasiados intentos de login. Intentá de nuevo en ${RATE_LIMIT_WINDOW_MINUTES} minutos.` },
        { status: 429 }
      )
    }

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      )
    }

    // Sesión 45 QA Fase 1: registrar el intento ANTES de validar, para que cuente
    // incluso los intentos fallidos (típico en brute force).
    await recordAttempt(ip)

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
    console.error('Customer login error:', error)
    return NextResponse.json(
      { error: 'Error del servidor' },
      { status: 500 }
    )
  }
}
