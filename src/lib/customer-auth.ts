import { db } from './db'
import { cookies } from 'next/headers'
import { hashPassword, verifyPassword, signToken, verifyToken } from './admin-auth'

// Re-export crypto utilities from admin-auth
export { hashPassword, verifyPassword, signToken, verifyToken }

// ============================================
// Customer User
// ============================================

export interface CustomerUser {
  id: string
  name: string
  email: string
  phone: string | null
  dni: string | null
  address: string | null
  city: string | null
  province: string | null
  postalCode: string | null
  createdAt: string
  updatedAt: string
}

const CUSTOMER_COOKIE_NAME = 'customer_token'

/**
 * Get a customer by email from the customers table.
 */
export async function getCustomerByEmail(email: string): Promise<(CustomerUser & { password: string }) | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM customers WHERE email = ?',
    args: [email],
  })
  const rows = result.rows as any[]
  return rows[0] || null
}

/**
 * Get a customer by ID from the customers table.
 */
export async function getCustomerById(id: string): Promise<(CustomerUser & { password: string }) | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM customers WHERE id = ?',
    args: [id],
  })
  const rows = result.rows as any[]
  return rows[0] || null
}

/**
 * Create a new customer with hashed password.
 */
export async function createCustomer(data: {
  name: string
  email: string
  phone?: string
  password: string
  dni?: string
}): Promise<CustomerUser> {
  const hashedPassword = await hashPassword(data.password)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await db.execute({
    sql: `INSERT INTO customers (id, name, email, phone, password, dni, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, data.name, data.email, data.phone || null, hashedPassword, data.dni || null, now, now],
  })

  return {
    id,
    name: data.name,
    email: data.email,
    phone: data.phone || null,
    dni: data.dni || null,
    address: null,
    city: null,
    province: null,
    postalCode: null,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Get the currently authenticated customer from the signed cookie.
 * The cookie format is: `email.hmac_signature`
 */
export async function getCurrentCustomer(): Promise<CustomerUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(CUSTOMER_COOKIE_NAME)?.value
  if (!token) return null

  try {
    const email = await verifyToken(token)
    if (!email) return null

    const customer = await getCustomerByEmail(email)
    if (!customer) return null

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      dni: customer.dni,
      address: customer.address,
      city: customer.city,
      province: customer.province,
      postalCode: customer.postalCode,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    }
  } catch {
    return null
  }
}

/**
 * Get the customer cookie name for setting/clearing.
 */
export function getCustomerCookieName(): string {
  return CUSTOMER_COOKIE_NAME
}
