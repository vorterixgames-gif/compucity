import { createClient, type Client } from '@libsql/client'

const globalForDb = globalThis as unknown as {
  turso: Client | undefined
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
