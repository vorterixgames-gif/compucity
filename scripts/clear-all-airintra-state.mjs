// Clear ALL airintra_* state from store_config (clean slate).
import { createClient } from '@libsql/client'

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw',
})

const r = await db.execute({
  sql: `DELETE FROM store_config WHERE key LIKE 'airintra_%'`,
})

console.log(`Cleared ${r.rowsAffected} airintra_* rows`)

const remaining = await db.execute({
  sql: `SELECT key FROM store_config WHERE key LIKE 'airintra_%'`,
})
console.log(`Remaining: ${remaining.rows.length}`)

db.close()
