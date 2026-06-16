// One-off script to clear the existing Air Intra cooldown + reset broken page counter.
// Run this after deploying the broken-page-skip fix so the user can retry immediately
// without waiting for the old 10-min cooldown to expire.
//
// Optionally accepts a catalog end page as first arg, which sets
// airintra_catalog_end_page so the next sync probes only that page+1
// (1 request) instead of re-walking from page 0.
//
//   node scripts/clear-airintra-cooldown.mjs            # just clear cooldown
//   node scripts/clear-airintra-cooldown.mjs 23         # also set catalog end = 23

import { createClient } from '@libsql/client'
import 'dotenv/config'

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN

if (!url) {
  console.error('ERROR: TURSO_DATABASE_URL or DATABASE_URL not set in env')
  process.exit(1)
}

const db = createClient({ url, authToken })

const catalogEndArg = process.argv[2] ? parseInt(process.argv[2], 10) : null

async function main() {
  console.log('Clearing Air Intra sync state...')

  // 1. Clear cooldown
  const r1 = await db.execute({
    sql: `DELETE FROM store_config WHERE key = ?`,
    args: ['airintra_rate_limited_until'],
  })
  console.log(`  Cooldown cleared. Rows affected: ${r1.rowsAffected}`)

  // 2. Reset broken page counter
  const r2 = await db.execute({
    sql: `DELETE FROM store_config WHERE key = ?`,
    args: ['airintra_broken_page_count'],
  })
  console.log(`  Broken page counter cleared. Rows affected: ${r2.rowsAffected}`)

  // 3. Show current last sync page (KEEP this — so the next sync resumes from where it left off)
  const r3 = await db.execute({
    sql: `SELECT value FROM store_config WHERE key = ?`,
    args: ['airintra_last_sync_page'],
  })
  const lastPage = r3.rows[0]?.value
  if (lastPage !== undefined) {
    console.log(`  Last sync page preserved: ${lastPage} (next sync will resume from page ${parseInt(lastPage, 10) + 1})`)
  } else {
    console.log(`  No last sync page recorded — next sync will start from page 0`)
  }

  // 4. Catalog end page: set if arg provided, otherwise show current
  if (catalogEndArg !== null && Number.isFinite(catalogEndArg)) {
    await db.execute({
      sql: `INSERT INTO store_config (id, key, value, updatedAt) VALUES (?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
      args: ['cfg_airintra_catalog_end_page', 'airintra_catalog_end_page', String(catalogEndArg), new Date().toISOString()],
    })
    console.log(`  Catalog end page SET to ${catalogEndArg}. Next sync will probe page ${catalogEndArg + 1} (1 request to detect new products).`)
  } else {
    const r4 = await db.execute({
      sql: `SELECT value FROM store_config WHERE key = ?`,
      args: ['airintra_catalog_end_page'],
    })
    const cep = r4.rows[0]?.value
    if (cep !== undefined) {
      console.log(`  Catalog end page: ${cep} (next sync will probe page ${parseInt(cep, 10) + 1})`)
    } else {
      console.log(`  Catalog end page: not set (next sync will start from page 0 or lastSyncPage+1)`)
    }
  }

  // 5. Show current state for verification
  const r5 = await db.execute({
    sql: `SELECT key, value FROM store_config WHERE key LIKE 'airintra_%'`,
  })
  console.log(`\nFinal Air Intra state in store_config:`)
  if (r5.rows.length === 0) {
    console.log('  (no airintra_* keys — clean slate)')
  } else {
    for (const row of r5.rows) {
      console.log(`  ${row.key} = ${row.value}`)
    }
  }

  db.close()
  console.log('\nDone. The user can now retry the sync immediately.')
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
