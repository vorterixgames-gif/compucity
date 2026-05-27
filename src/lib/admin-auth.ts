import { db } from './db'
import { cookies } from 'next/headers'

// ============================================
// HMAC Token Signing (Edge-compatible)
// ============================================

const HMAC_SECRET = process.env.ADMIN_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'compucity_hmac_dev_secret')

/**
 * Sign a value with HMAC-SHA256.
 * Returns `value.signature` (hex).
 * Compatible with Edge Runtime (uses Web Crypto API).
 */
export async function signToken(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  const hex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `${value}.${hex}`
}

/**
 * Verify a signed token.
 * Returns the original value if valid, or null if tampered.
 * Compatible with Edge Runtime (uses Web Crypto API).
 */
export async function verifyToken(token: string): Promise<string | null> {
  const dotIndex = token.lastIndexOf('.')
  if (dotIndex === -1) return null

  const value = token.substring(0, dotIndex)
  const providedSig = token.substring(dotIndex + 1)

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const expectedSig = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  const expectedHex = Array.from(new Uint8Array(expectedSig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // Constant-time comparison to prevent timing attacks
  if (providedSig.length !== expectedHex.length) return false as unknown as string | null
  let mismatch = 0
  for (let i = 0; i < providedSig.length; i++) {
    mismatch |= providedSig.charCodeAt(i) ^ expectedHex.charCodeAt(i)
  }
  return mismatch === 0 ? value : null
}

// ============================================
// Password Hashing
// ============================================

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'compucity_salt_2026')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const hash = await hashPassword(password)
  return hash === hashedPassword
}

// ============================================
// Admin User
// ============================================

export interface AdminUser {
  id: string
  email: string
  name: string
  role: string
}

export async function getAdminByEmail(email: string): Promise<AdminUser & { password: string } | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM admins WHERE email = ?',
    args: [email],
  })
  const rows = result.rows as any[]
  return rows[0] || null
}

/**
 * Get the currently authenticated admin from the signed cookie.
 * The cookie format is: `email.hmac_signature`
 */
export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  if (!token) return null

  try {
    const email = await verifyToken(token)
    if (!email) return null

    const admin = await getAdminByEmail(email)
    if (!admin) return null
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    }
  } catch {
    return null
  }
}

// ============================================
// Helpers
// ============================================

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function generateId(): string {
  return crypto.randomUUID()
}
