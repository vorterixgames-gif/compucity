#!/usr/bin/env node
/**
 * SESIÓN 77 (capas 3-4): Monitor de contratos de feed + reconciliación.
 * Corre en GitHub Actions (NO Vercel) → $0 Vercel.
 * Diario (cron) valida que los feeds de proveedores no hayan cambiado de forma
 * que rompa el catálogo (auth OK, STOCK_STATUS conocido, ratios sanos, sync fresco).
 * Si detecta drift → exit 1 → GitHub Actions manda mail automáticamente.
 *
 * Env (GitHub Secrets): TURSO_URL, TURSO_TOKEN, INVID_USER, INVID_PASS,
 *   AIR_INTRA_USER, AIR_INTRA_PASS, ELIT_USER_ID, ELIT_TOKEN
 * Env opcional: FULL_RECONCILE=1 → reconciliación completa Invid (manual, gasta rate limit).
 */
const TURSO_URL = process.env.TURSO_URL || 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io'
const TURSO_TOKEN = process.env.TURSO_TOKEN || ''
const TURSO_HTTP = TURSO_URL.replace('libsql://', 'https://') + '/v2/pipeline'
const INVID_BASE = 'https://www.invidcomputers.com'
const AIR_BASE = process.env.AIR_INTRA_BASE || 'https://www.airintra.com.ar'
const KNOWN_INVID_STATUS = ['STOCK OK','EN STOCK','DISPONIBLE','BAJO STOCK','STOCK BAJO','MENOS DE 10 UNIDADES','SIN STOCK','OUT OF STOCK','NO DISPONIBLE']

async function tursoQuery(sql, args = []) {
  const body = JSON.stringify({ requests: [
    { type: 'execute', stmt: { sql, args: args.map(a => a === null || a === undefined ? { type: 'null' } : { type: 'text', value: String(a) }) } },
    { type: 'close' },
  ]})
  const res = await fetch(TURSO_HTTP, { method: 'POST', headers: { Authorization: `Bearer ${TURSO_TOKEN}`, 'Content-Type': 'application/json' }, body })
  if (!res.ok) throw new Error(`Turso HTTP ${res.status}`)
  const data = await res.json()
  const result = data.results?.[0]?.response?.result
  if (!result) return []
  const cols = (result.cols || []).map(c => c.name)
  return (result.rows || []).map(row => row.reduce((o, cell, i) => { o[cols[i] || `c${i}`] = cell.type === 'null' ? null : cell.value; return o }, {}))
}

let failures = []
let warnings = []

async function checkInvid() {
  console.log('== INVID ==')
  const authRes = await fetch(`${INVID_BASE}/api/v1/auth.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: process.env.INVID_USER || '', password: process.env.INVID_PASS || '' }) })
  if (!authRes.ok) { failures.push(`Invid auth HTTP ${authRes.status}`); return }
  const auth = await authRes.json()
  if (!auth.access_token) { failures.push('Invid auth sin access_token'); return }
  const pRes = await fetch(`${INVID_BASE}/api/v1/productos.php?offset=0&limit=100`, { headers: { Authorization: `Bearer ${auth.access_token}` } })
  if (!pRes.ok) { failures.push(`Invid productos HTTP ${pRes.status}`); return }
  const items = await pRes.json()
  const arr = Array.isArray(items) ? items : (items.data || items.productos || [])
  if (!arr.length) { warnings.push('Invid devolvió 0 productos en muestra'); }
  const hist = {}
  let priceGt0 = 0
  for (const p of arr) {
    const st = String(p.STOCK_STATUS ?? '').toUpperCase().trim()
    hist[st || '(vacío)'] = (hist[st || '(vacío)'] || 0) + 1
    if (parseFloat(p.PRICE || '0') > 0) priceGt0++
  }
  const unknown = Object.keys(hist).filter(k => !KNOWN_INVID_STATUS.includes(k))
  console.log('  STOCK_STATUS muestra:', JSON.stringify(hist))
  if (unknown.length) failures.push(`Invid STOCK_STATUS desconocido: ${unknown.join(', ')} (el feed cambió; revisar parseInvidStock)`)
  const ratio = arr.length ? priceGt0 / arr.length : 0
  console.log(`  ratio PRICE>0: ${(ratio * 100).toFixed(1)}%`)
  if (arr.length && ratio < 0.05) warnings.push(`Invid ratio PRICE>0 muy bajo (${(ratio * 100).toFixed(1)}%)`)
}

async function checkAir() {
  console.log('== AIR INTRA ==')
  const loginRes = await fetch(`${AIR_BASE}/?q=login&user=${encodeURIComponent(process.env.AIR_INTRA_USER || '')}&pass=${encodeURIComponent(process.env.AIR_INTRA_PASS || '')}`)
  if (!loginRes.ok) { failures.push(`Air Intra login HTTP ${loginRes.status}`); return }
  const txt = await loginRes.text()
  let tok = null
  try { tok = JSON.parse(txt).token } catch {}
  if (!tok) { failures.push('Air Intra login sin token'); return }
  console.log('  login OK')
}

async function checkFreshness() {
  console.log('== FRESCURA DE SYNC (DB) ==')
  const rows = await tursoQuery(`SELECT name, lastSyncAt FROM suppliers WHERE name IN ('Air Intra','Elit','Invid Computers')`)
  const now = Date.now()
  for (const r of rows) {
    const ageH = r.lastSyncAt ? (now - new Date(r.lastSyncAt).getTime()) / 3600000 : Infinity
    console.log(`  ${r.name}: hace ${ageH.toFixed(1)}h`)
    const maxH = r.name === 'Air Intra' ? 24 : 12
    if (ageH > maxH + 2) warnings.push(`${r.name} sin sync hace ${ageH.toFixed(1)}h (>${maxH}h)`)
  }
}

async function fullReconcile() {
  console.log('== RECONCILIACIÓN COMPLETA INVID (manual) ==')
  const authRes = await fetch(`${INVID_BASE}/api/v1/auth.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: process.env.INVID_USER || '', password: process.env.INVID_PASS || '' }) })
  const auth = await authRes.json()
  const supplierStock = new Map()
  let offset = 0
  while (offset < 6000) {
    const pRes = await fetch(`${INVID_BASE}/api/v1/productos.php?offset=${offset}&limit=500`, { headers: { Authorization: `Bearer ${auth.access_token}` } })
    if (!pRes.ok) break
    const arr = await pRes.json()
    const list = Array.isArray(arr) ? arr : (arr.data || [])
    if (!list.length) break
    for (const p of list) supplierStock.set(String(p.ID), String(p.STOCK_STATUS || '').toUpperCase())
    offset += 500
    await new Promise(r => setTimeout(r, 1200))
  }
  const dbStocked = await tursoQuery(`SELECT providerSku FROM products WHERE providerId='8c7b9e2c-c004-4f70-9e17-abda903395af' AND stock>0 AND isActive=1`)
  let weStockSupplierNone = 0
  const samples = []
  for (const row of dbStocked) {
    const st = supplierStock.get(String(row.providerSku))
    if (st === undefined || st === 'SIN STOCK' || st === 'NO DISPONIBLE') {
      weStockSupplierNone++
      if (samples.length < 20) samples.push(row.providerSku)
    }
  }
  console.log(`  Nosotros-con-stock pero Invid-sin-stock/desaparecido: ${weStockSupplierNone}`)
  if (samples.length) console.log('  ejemplos:', samples.join(', '))
  if (weStockSupplierNone > 30) failures.push(`Reconciliación: ${weStockSupplierNone} productos nuestros con stock que Invid no tiene (revisar descatalogados)`)
}

;(async () => {
  try {
    await checkInvid()
    await checkAir()
    await checkFreshness()
    if (process.env.FULL_RECONCILE === '1') await fullReconcile()
  } catch (e) {
    failures.push(`Monitor exception: ${e.message}`)
  }
  if (warnings.length) console.log('\n⚠ WARNINGS:\n - ' + warnings.join('\n - '))
  if (failures.length) {
    console.error('\n✗ FAILURES (drift de feed detectado):\n - ' + failures.join('\n - '))
    process.exit(1)
  }
  console.log('\n✅ Monitor OK: sin drift de feeds.')
})()
