import { createClient, type Client } from '@libsql/client'

const globalForDb = globalThis as unknown as {
  turso: Client | undefined
  migrationRan: boolean | undefined
}

function createTursoClient() {
  const url = process.env.DATABASE_URL || ''
  
  if (url.startsWith('libsql://')) {
    return createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }
  
  // Local fallback
  return createClient({
    url: url || 'file:./prisma/dev.db',
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

  try {
    // Check if shippingDetails column exists in orders
    await db.execute({
      sql: 'SELECT shippingDetails FROM orders LIMIT 1',
      args: [],
    })
  } catch {
    // Column doesn't exist — add it
    try {
      await db.execute({
        sql: 'ALTER TABLE orders ADD COLUMN shippingDetails TEXT',
        args: [],
      })
      console.log('[migration] Added shippingDetails column to orders')
    } catch (alterError) {
      // Might fail if already added by another instance — that's fine
      console.warn('[migration] Could not add shippingDetails column:', alterError)
    }
  }
}
