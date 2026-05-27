import { createClient, type Client } from '@libsql/client/web'

const globalForDb = globalThis as unknown as {
  turso: Client | undefined
  migrationRan: boolean | undefined
}

function createTursoClient() {
  const url = process.env.DATABASE_URL || ''
  
  if (url.startsWith('libsql://') || url.startsWith('https://') || url.startsWith('http://')) {
    return createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }
  
  // Fallback: use Turso URL if no valid URL configured
  const fallbackUrl = 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io'
  console.warn(`[db] DATABASE_URL "${url}" not supported, falling back to Turso`)
  return createClient({
    url: fallbackUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })
}

export const db = globalForDb.turso ?? createTursoClient()

if (process.env.NODE_ENV !== 'production') globalForDb.turso = db

/**
 * Auto-migrate: ensure all required columns exist.
 * Runs once per process lifetime (cached in globalThis).
 */
export async function ensureMigrations() {
  if (globalForDb.migrationRan) return
  globalForDb.migrationRan = true

  // 1. Add shippingDetails column to orders
  try {
    await db.execute({ sql: 'SELECT shippingDetails FROM orders LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({ sql: 'ALTER TABLE orders ADD COLUMN shippingDetails TEXT', args: [] })
      console.log('[migration] Added shippingDetails column to orders')
    } catch (e) {
      console.warn('[migration] Could not add shippingDetails:', e)
    }
  }

  // 2. Add customerId column to orders
  try {
    await db.execute({ sql: 'SELECT customerId FROM orders LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({ sql: 'ALTER TABLE orders ADD COLUMN customerId TEXT', args: [] })
      console.log('[migration] Added customerId column to orders')
    } catch (e) {
      console.warn('[migration] Could not add customerId:', e)
    }
  }

  // 3. Ensure customers table exists
  try {
    await db.execute({ sql: 'SELECT id FROM customers LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({
        sql: `CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          phone TEXT,
          password TEXT NOT NULL,
          dni TEXT,
          address TEXT,
          city TEXT,
          province TEXT,
          postalCode TEXT,
          createdAt TEXT DEFAULT (datetime('now')),
          updatedAt TEXT DEFAULT (datetime('now'))
        )`,
        args: [],
      })
      console.log('[migration] Created customers table')
    } catch (e) {
      console.warn('[migration] Could not create customers table:', e)
    }
  }

  // 4. Ensure suppliers table exists
  try {
    await db.execute({ sql: 'SELECT id FROM suppliers LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({
        sql: `CREATE TABLE IF NOT EXISTS suppliers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          contactName TEXT,
          contactEmail TEXT,
          contactPhone TEXT,
          website TEXT,
          apiType TEXT,
          apiBaseUrl TEXT,
          apiUserId TEXT,
          apiToken TEXT,
          apiUsername TEXT,
          apiPassword TEXT,
          markup INTEGER DEFAULT 30,
          currency TEXT,
          isActive INTEGER DEFAULT 1,
          lastSyncAt TEXT,
          notes TEXT,
          createdAt TEXT,
          updatedAt TEXT
        )`,
        args: [],
      })
      console.log('[migration] Created suppliers table')
    } catch (e) {
      console.warn('[migration] Could not create suppliers table:', e)
    }
  }

  // 5. Add supplierCategory column to products
  try {
    await db.execute({ sql: 'SELECT supplierCategory FROM products LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({ sql: 'ALTER TABLE products ADD COLUMN supplierCategory TEXT' })
      console.log('[migration] Added supplierCategory column to products')
    } catch (e) {
      console.warn('[migration] Could not add supplierCategory:', e)
    }
  }

  // 6. Ensure supplier_category_mappings table exists
  try {
    await db.execute({ sql: 'SELECT id FROM supplier_category_mappings LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({
        sql: `CREATE TABLE IF NOT EXISTS supplier_category_mappings (
          id TEXT PRIMARY KEY,
          supplierId TEXT NOT NULL,
          supplierCategory TEXT NOT NULL,
          storeCategoryId TEXT NOT NULL,
          createdAt TEXT,
          updatedAt TEXT
        )`,
        args: [],
      })
      console.log('[migration] Created supplier_category_mappings table')
    } catch (e) {
      console.warn('[migration] Could not create supplier_category_mappings table:', e)
    }
  }
}
