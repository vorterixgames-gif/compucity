#!/usr/bin/env node
/**
 * SESIÓN 87: Normaliza comparePrice para que TODOS los productos sin descuento
 * efectivo real muestren un único precio (el de lista) en toda la tienda.
 * Regla: si el producto NO tiene cashDiscount individual (>0), su comparePrice
 * debe ser igual a price. Así la ficha/cards/builder no muestran el par
 * "precio de lista + precio en efectivo" cuando no hay ninguna promoción.
 * Los ~productos con cashDiscount individual conservan su precio efectivo.
 * One-shot, workflow_dispatch, loguea cantidad de filas normalizadas.
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
  const before = await q(`SELECT COUNT(*) AS n FROM products WHERE comparePrice IS NOT NULL AND comparePrice != price AND (cashDiscount IS NULL OR cashDiscount = 0)`)
  console.log('Filas con comparePrice distinto de price sin descuento efectivo:', before[0]?.n)
  const res = await q(`UPDATE products SET comparePrice = price, updatedAt = ? WHERE comparePrice IS NOT NULL AND comparePrice != price AND (cashDiscount IS NULL OR cashDiscount = 0)`, [new Date().toISOString()])
  console.log('Normalizadas:', JSON.stringify(res.results?.[0]?.response?.result?.affected_row_count ?? res).substring(0, 200))
  const after = await q(`SELECT COUNT(*) AS n FROM products WHERE comparePrice IS NOT NULL AND comparePrice != price AND (cashDiscount IS NULL OR cashDiscount = 0)`)
  console.log('Restantes después de normalizar:', after[0]?.n)
  const conDto = await q(`SELECT COUNT(*) AS n FROM products WHERE cashDiscount IS NOT NULL AND cashDiscount > 0`)
  console.log('Productos con cashDiscount individual (conservan precio efectivo):', conDto[0]?.n)
})().catch(e => { console.error('ERROR normalize-compareprice:', e); process.exit(1) })
