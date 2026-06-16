// Test the cooldown SQL statements against an in-memory libsql DB to make sure
// the UPSERT and DELETE statements are valid SQLite syntax (esp. the ON CONFLICT clause).

import { createClient } from '@libsql/client'

const db = createClient({ url: ':memory:' })

// Mirror the store_config schema from prisma/schema.prisma
await db.execute(`
  CREATE TABLE store_config (
    id        TEXT PRIMARY KEY,
    key       TEXT UNIQUE,
    value     TEXT,
    updatedAt TEXT
  );
`)

// ─── Helpers (copied from sync/route.ts) ──────────────────────────────────
const AIRINTRA_COOLDOWN_KEY = 'airintra_rate_limited_until'
const AIRINTRA_LAST_PAGE_KEY = 'airintra_last_sync_page'

async function setCooldown(msFromNow) {
  const until = new Date(Date.now() + msFromNow).toISOString()
  await db.execute({
    sql: `INSERT INTO store_config (id, key, value, updatedAt) VALUES (?, ?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    args: [`cfg_${AIRINTRA_COOLDOWN_KEY}`, AIRINTRA_COOLDOWN_KEY, until, new Date().toISOString()],
  })
}

async function getCooldown() {
  const r = await db.execute({ sql: `SELECT value FROM store_config WHERE key = ?`, args: [AIRINTRA_COOLDOWN_KEY] })
  const v = r.rows[0]?.value
  if (!v) return 0
  const remaining = new Date(v).getTime() - Date.now()
  return remaining > 0 ? remaining : 0
}

async function clearCooldown() {
  await db.execute({ sql: `DELETE FROM store_config WHERE key = ?`, args: [AIRINTRA_COOLDOWN_KEY] })
}

async function setLastSyncPage(page) {
  await db.execute({
    sql: `INSERT INTO store_config (id, key, value, updatedAt) VALUES (?, ?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    args: [`cfg_${AIRINTRA_LAST_PAGE_KEY}`, AIRINTRA_LAST_PAGE_KEY, String(page), new Date().toISOString()],
  })
}

async function getLastSyncPage() {
  const r = await db.execute({ sql: `SELECT value FROM store_config WHERE key = ?`, args: [AIRINTRA_LAST_PAGE_KEY] })
  const v = r.rows[0]?.value
  const n = v ? parseInt(v, 10) : -1
  return Number.isFinite(n) ? n : -1
}

async function clearLastSyncPage() {
  await db.execute({ sql: `DELETE FROM store_config WHERE key = ?`, args: [AIRINTRA_LAST_PAGE_KEY] })
}

// ─── Test cases ───────────────────────────────────────────────────────────
let pass = 0, fail = 0
const assert = (cond, msg) => {
  if (cond) { pass++; console.log(`  ✓ ${msg}`) }
  else      { fail++; console.error(`  ✗ ${msg}`) }
}

console.log('Test 1: cooldown lifecycle')
assert(await getCooldown() === 0, 'no cooldown initially')
await setCooldown(10 * 60 * 1000)  // 10 min
assert(await getCooldown() > 9 * 60 * 1000, 'cooldown active right after set (~10min)')
assert(await getCooldown() < 11 * 60 * 1000, 'cooldown not over 11min')
await clearCooldown()
assert(await getCooldown() === 0, 'cooldown cleared')

console.log('\nTest 2: last sync page lifecycle')
assert(await getLastSyncPage() === -1, 'no last page initially (-1)')
await setLastSyncPage(16)
assert(await getLastSyncPage() === 16, 'last page = 16 after set')
await setLastSyncPage(17)  // update
assert(await getLastSyncPage() === 17, 'last page updated to 17 (UPSERT works)')
await clearLastSyncPage()
assert(await getLastSyncPage() === -1, 'last page cleared back to -1')

console.log('\nTest 3: expired cooldown returns 0')
// Set cooldown in the past
const past = new Date(Date.now() - 60_000).toISOString()
await db.execute({
  sql: `INSERT INTO store_config (id, key, value, updatedAt) VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
  args: [`cfg_${AIRINTRA_COOLDOWN_KEY}`, AIRINTRA_COOLDOWN_KEY, past, new Date().toISOString()],
})
assert(await getCooldown() === 0, 'expired cooldown treated as 0')
await clearCooldown()

console.log('\nTest 4: UPSERT preserves uniqueness (no duplicate rows)')
await setCooldown(60_000)
await setCooldown(120_000)  // second insert with same key
const r = await db.execute({ sql: `SELECT * FROM store_config WHERE key = ?`, args: [AIRINTRA_COOLDOWN_KEY] })
assert(r.rows.length === 1, `exactly 1 row after 2 upserts (got ${r.rows.length})`)

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`)
db.close()
process.exit(fail > 0 ? 1 : 0)
