// Quick check of current Air Intra state in production DB.
import { createClient } from '@libsql/client'

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw',
})

const r = await db.execute({
  sql: `SELECT key, value, updatedAt FROM store_config WHERE key LIKE 'airintra_%' ORDER BY key`,
})

console.log('Current Air Intra state in production DB:')
console.log('---')
for (const row of r.rows) {
  let display = row.value
  if (row.key === 'airintra_last_probe_at') {
    const ts = parseInt(row.value, 10)
    const ago = Math.floor((Date.now() - ts) / 1000)
    display = `${row.value} (${ago}s ago = ${Math.floor(ago/60)}m ${ago%60}s)`
  }
  console.log(`  ${row.key} = ${display}`)
  console.log(`    updatedAt: ${row.updatedAt}`)
}

if (r.rows.length === 0) {
  console.log('  (no airintra_* keys)')
}

// Compute probe cooldown remaining
const probeRow = r.rows.find(r => r.key === 'airintra_last_probe_at')
if (probeRow) {
  const ts = parseInt(probeRow.value, 10)
  const elapsed = Date.now() - ts
  const cooldownMs = 30 * 60 * 1000
  if (elapsed < cooldownMs) {
    const remaining = cooldownMs - elapsed
    console.log(`\nProbe cooldown active: ${Math.floor(remaining/60000)}m ${Math.floor((remaining%60000)/1000)}s remaining`)
    console.log('Next sync should return ALREADY_VERIFIED instantly.')
  } else {
    console.log(`\nProbe cooldown EXPIRED ${Math.floor((elapsed-cooldownMs)/60000)}m ago. Next sync will probe.`)
  }
}

db.close()
