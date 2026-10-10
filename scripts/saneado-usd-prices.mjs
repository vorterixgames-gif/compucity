#!/usr/bin/env node
/**
 * SESIÓN 82: Saneado de precios guardados en magnitud USD (s82).
 * Detecta filas de PROVEEDOR cuyo price guardado perdió la multiplicación por el dólar
 * (price/costPrice < 100, cuando en ARS debería ser ~1500-2000) y las recalcula a ARS.
 * - NO toca productos manuales (providerId NULL): el precio manual es autoritativo.
 * - NO borra ni deduplica nada: solo corrige el valor price/comparePrice.
 * - Loguea cada cambio (id, nombre, old, new) para poder revertir.
 * Corre en GitHub Actions ($0 Vercel), una sola vez (workflow_dispatch).
 */
const TURSO_URL = process.env.TURSO_URL || 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io'
const TURSO_TOKEN = process.env.TURSO_TOKEN || ''
const TURSO_HTTP = TURSO_URL.replace('libsql://', 'https://') + '/v2/pipeline'
async function q(sql, args = []) {
  const body = JSON.stringify({ requests: [
    { type: 'execute', stmt: { sql, args: args.map(a => a === null || a === undefined ? { type: 'null' } : { type: 'text', value: String(a) }) } },
    { type: 'close' },
  ]})
  const res = await fetch(TURSO_HTTP, { method: 'POST', headers: { Authorization: `Bearer ${TURSO_TOKEN}`, 'Content-Type': 'application/json' }, body })
  if (!res.ok) throw new Error('Turso HTTP ' + res.status)
  const data = await res.json()
  const result = data.results?.[0]?.response?.result
  if (!result) return []
  const cols = (result.cols || []).map(c => c.name)
  return (result.rows || []).map(row => row.reduce((o, cell, i) => { o[cols[i] || ('c' + i)] = cell.type === 'null' ? null : cell.value; return o }, {}))
}
;(async () => {
  let dollar = 1545
  try { const d = await (await fetch('https://dolarapi.com/v1/dolares/oficial')).json(); if (d && d.venta) dollar = d.venta } catch (e) {}
  console.log('Dólar usado:', dollar)
  const cfg = await q("SELECT value FROM store_config WHERE key='markup'")
  const globalMarkup = Number(cfg[0]?.value || 15)
  const cats = await q('SELECT id, parentId, ivaRate, markup FROM categories')
  const catmap = new Map(cats.map(c => [c.id, c]))
  const resolve = (catId, field, def) => { let cur = catId, seen = new Set(); while (cur && catmap.has(cur) && !seen.has(cur)) { seen.add(cur); const v = catmap.get(cur)[field]; if (v !== null && v !== undefined) return Number(v); cur = catmap.get(cur).parentId } return def }
  const rows = await q(`SELECT id, name, costPrice, price, comparePrice, ivaRate, internalTaxRate, markup, categoryId, providerId
                        FROM products
                        WHERE providerId IS NOT NULL AND costPrice > 0 AND price > 0 AND (price / costPrice) < 100`)
  console.log('Filas con price en magnitud USD (proveedor):', rows.length)
  let fixed = 0
  for (const p of rows) {
    const iva = p.ivaRate !== null && p.ivaRate !== undefined ? Number(p.ivaRate) : resolve(p.categoryId, 'ivaRate', 10.5)
    const internal = p.internalTaxRate ? Number(p.internalTaxRate) : 0
    const markup = p.markup !== null && p.markup !== undefined ? Number(p.markup) : resolve(p.categoryId, 'markup', globalMarkup)
    const newPrice = Math.round(Number(p.costPrice) * (1 + (iva + internal) / 100) * (1 + markup / 100) * dollar)
    if (newPrice <= Number(p.price)) { console.log('  skip (no aumenta):', p.id, p.name); continue }
    await q('UPDATE products SET price = ?, comparePrice = ?, updatedAt = ? WHERE id = ?', [newPrice, newPrice, new Date().toISOString(), p.id])
    console.log(`  FIX ${p.id} | ${(p.name || '').substring(0, 40)} | old ${p.price} -> new ${newPrice}`)
    fixed++
  }
  console.log('Saneado completado. Filas corregidas:', fixed, 'de', rows.length)
})().catch(e => { console.error('ERROR saneado:', e); process.exit(1) })
