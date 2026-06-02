import { db } from './db'
import { cookies } from 'next/headers'

// ============================================
// HMAC Token Signing (Edge-compatible)
// ============================================

// HMAC secret: prioritize ADMIN_SECRET env var.
// In development: use a fixed dev secret.
// In production without ADMIN_SECRET: derive from DATABASE_URL (stable, unique per deployment, NOT in source code).
// WARNING: Always set ADMIN_SECRET in production for best security.
function deriveHmacSecret(): string {
  if (process.env.ADMIN_SECRET) return process.env.ADMIN_SECRET
  if (process.env.NODE_ENV !== 'production') return 'compucity_hmac_dev_secret'
  // Production fallback: derive from DATABASE_URL (unique per deployment, not in source)
  const dbUrl = process.env.DATABASE_URL || ''
  // Simple deterministic hash of DATABASE_URL
  let hash = 0
  for (let i = 0; i < dbUrl.length; i++) {
    const chr = dbUrl.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0 // Convert to 32bit integer
  }
  return `compucity_hmac_derived_${Math.abs(hash).toString(36)}_prod`
}

const HMAC_SECRET = deriveHmacSecret()

/**
 * Sign a value with HMAC-SHA256, including a timestamp for expiration.
 * Format: `timestamp.value.signature`
 * Compatible with Edge Runtime (uses Web Crypto API).
 */
const TOKEN_MAX_AGE_MS = 8 * 60 * 60 * 1000 // 8 hours

export async function signToken(value: string): Promise<string> {
  const timestamp = Date.now().toString(36)
  const payload = `${timestamp}.${value}`
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  const hex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `${payload}.${hex}`
}

/**
 * Verify a signed token including expiration check.
 * Returns the original value if valid and not expired, or null otherwise.
 * Compatible with Edge Runtime (uses Web Crypto API).
 */
export async function verifyToken(token: string): Promise<string | null> {
  const lastDotIndex = token.lastIndexOf('.')
  if (lastDotIndex === -1) return null

  const payload = token.substring(0, lastDotIndex)
  const providedSig = token.substring(lastDotIndex + 1)

  // Verify HMAC signature
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const expectedSig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  const expectedHex = Array.from(new Uint8Array(expectedSig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // Constant-time comparison to prevent timing attacks
  if (providedSig.length !== expectedHex.length) return null
  let mismatch = 0
  for (let i = 0; i < providedSig.length; i++) {
    mismatch |= providedSig.charCodeAt(i) ^ expectedHex.charCodeAt(i)
  }
  if (mismatch !== 0) return null

  // Check expiration — payload format is: timestamp.value
  const firstDotIndex = payload.indexOf('.')
  if (firstDotIndex === -1) return null

  const timestampStr = payload.substring(0, firstDotIndex)
  const value = payload.substring(firstDotIndex + 1)

  const timestamp = parseInt(timestampStr, 36)
  if (isNaN(timestamp)) return null

  if (Date.now() - timestamp > TOKEN_MAX_AGE_MS) return null

  return value
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
