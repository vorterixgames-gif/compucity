#!/usr/bin/env node
/**
 * Sync Invid → Turso (corre en GitHub Actions, no en Vercel).
 *
 * Sesión 47: migrado del cron de Vercel a GitHub Actions.
 *
 * Variables de entorno (en GitHub Secrets):
 * - TURSO_URL: libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io
 * - TURSO_TOKEN: eyJ...
 * - INVID_USER: pmariavirgina
 * - INVID_PASS: ********
 *
 * Uso local: node scripts/sync-invid-external.mjs
 * GitHub Actions: automático via .github/workflows/sync-elit-invid.yml
 */

const TURSO_URL = process.env.TURSO_URL || 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io'
const TURSO_TOKEN = process.env.TURSO_TOKEN || ''
const INVID_BASE = 'https://www.invidcomputers.com'
const INVID_USER = process.env.INVID_USER || ''
const INVID_PASS = process.env.INVID_PASS || ''
const INVID_SUPPLIER_ID = '8c7b9e2c-c004-4f70-9e17-abda903395af'
const MARKUP = 30

// ============================================
// Helpers de Turso (HTTP API directa, sin libsql client)
// ============================================
const TURSO_HTTP = TURSO_URL.replace('libsql://', 'https://') + '/v2/pipeline'

async function tursoExecute(sql, args = []) {
  const body = JSON.stringify({
    requests: [
      { type: 'execute', stmt: { sql, args: args.map(a => ({ type: 'text', value: String(a) })) } },
      { type: 'close' },
    ],
  })
  const res = await fetch(TURSO_HTTP, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body,
  })
  if (!res.ok) {
    throw new Error(`Turso HTTP ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  const result = data.results?.[0]?.response?.result
  if (!result) return { rows: [] }
  const cols = (result.cols || []).map(c => c.name)
  const rows = (result.rows || []).map(row =>
    row.reduce((obj, cell, i) => {
      obj[cols[i] || `col_${i}`] = cell.type === 'null' ? null : cell.value
      return obj
    }, {})
  )
  return { rows }
}

async function tursoBatch(statements) {
  const body = JSON.stringify({
    requests: [
      ...statements.map(s => ({
        type: 'execute',
        stmt: { sql: s.sql, args: (s.args || []).map(a => ({ type: 'text', value: String(a) })) }
      })),
      { type: 'close' },
    ],
  })
  const res = await fetch(TURSO_HTTP, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body,
  })
  if (!res.ok) {
    throw new Error(`Turso batch HTTP ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  return data.results || []
}

// ============================================
// Lista negra de productos eliminados (sesión 52)
// ============================================
async function loadDeletedBlacklist(supplierId) {
  try {
    const result = await tursoExecute(
      `SELECT providerSku FROM deleted_products WHERE providerId = '${supplierId}'`
    )
    const blacklist = new Set()
    for (const row of result.rows) {
      if (row.providerSku) blacklist.add(String(row.providerSku))
    }
    console.log(`  ✓ Lista negra: ${blacklist.size} productos eliminados para ${supplierId}`)
    return blacklist
  } catch (e) {
    console.warn('  ⚠ Could not load deleted blacklist:', e.message)
    return new Set()
  }
}

// Mapear STOCK_STATUS (texto) a número
// Consistente con cron de Vercel (syncInvidStock en /api/cron/sync/route.ts)
function parseInvidStock(stockStatus) {
  if (!stockStatus) return 0
  const status = String(stockStatus).toUpperCase().trim()
  if (status === 'STOCK OK' || status === 'EN STOCK') return 10
  if (status === 'BAJO STOCK') return 3
  if (status === 'SIN STOCK' || status === 'OUT OF STOCK') return 0
  return 0
}

// ============================================
// Función principal
// ============================================
async function main() {
  const startTime = Date.now()
  console.log('═'.repeat(70))
  console.log(' 🔄 Sync Invid → Turso (GitHub Actions)')
  console.log('═'.repeat(70))
  console.log(`Inicio: ${new Date().toISOString()}`)
  console.log()

  if (!TURSO_TOKEN) {
    console.error('✗ TURSO_TOKEN no configurado')
    process.exit(1)
  }
  if (!INVID_USER || !INVID_PASS) {
    console.error('✗ INVID_USER o INVID_PASS no configurados')
    process.exit(1)
  }

  // ─── 1. Autenticación (con retry, igual que Air Intra) ───
  const AUTH_MAX_RETRIES = 3
  const AUTH_RETRY_DELAY_MS = 30_000
  let token = null

  for (let attempt = 1; attempt <= AUTH_MAX_RETRIES; attempt++) {
    console.log(`▸ Auth Invid (intento ${attempt}/${AUTH_MAX_RETRIES})...`)
    try {
      const authRes = await fetch(`${INVID_BASE}/api/v1/auth.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: INVID_USER, password: INVID_PASS }),
      })
      if (!authRes.ok) {
        const errText = await authRes.text().catch(() => '')
        console.error(`  ✗ Auth HTTP ${authRes.status} — ${errText.substring(0, 200)}`)
        if (attempt < AUTH_MAX_RETRIES) {
          console.log(`  ⏳ Esperando ${AUTH_RETRY_DELAY_MS / 1000}s...`)
          await new Promise(r => setTimeout(r, AUTH_RETRY_DELAY_MS))
          continue
        }
        console.error(`✗ Auth falló después de ${AUTH_MAX_RETRIES} intentos. Abortando.`)
        process.exit(1)
      }
      const authData = await authRes.json()
      if (!authData.access_token) {
        console.error(`  ✗ Auth: sin access_token — ${JSON.stringify(authData).substring(0, 200)}`)
        if (attempt < AUTH_MAX_RETRIES) {
          await new Promise(r => setTimeout(r, AUTH_RETRY_DELAY_MS))
          continue
        }
        process.exit(1)
      }
      token = authData.access_token
      console.log('  ✓ Auth OK')
      break
    } catch (err) {
      console.error(`  ✗ Auth error: ${err.message}`)
      if (attempt < AUTH_MAX_RETRIES) {
        await new Promise(r => setTimeout(r, AUTH_RETRY_DELAY_MS))
        continue
      }
      console.error(`✗ Auth falló después de ${AUTH_MAX_RETRIES} intentos. Abortando.`)
      process.exit(1)
    }
  }

  // ─── 2a. Cargar lista negra de productos eliminados (sesión 52) ───
  console.log('▸ Cargando lista negra de productos eliminados...')
  const deletedBlacklist = await loadDeletedBlacklist(INVID_SUPPLIER_ID)

  // ─── 2. Cargar productos Invid existentes en DB ───
  console.log('▸ Cargando productos Invid desde DB...')
  const dbResult = await tursoExecute(
    'SELECT id, providerSku, stock, price, costPrice FROM products WHERE providerId = ?',
    [INVID_SUPPLIER_ID]
  )
  const dbMap = new Map()
  for (const row of dbResult.rows) {
    if (row.providerSku) dbMap.set(row.providerSku, row)
  }
  console.log(`  ✓ ${dbMap.size} productos en DB`)

  // ─── 3. Fetch paginado de la API de Invid ───
  console.log('▸ Obteniendo productos desde API Invid...')
  const apiProducts = new Map()
  let offset = 0
  const pageSize = 100
  let totalFetched = 0
  let emptyPageCount = 0
  const MAX_EMPTY_PAGES = 3

  while (true) {
    try {
      const url = `${INVID_BASE}/api/v1/articulo.php?offset=${offset}`
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!resp.ok) {
        console.error(`  ✗ HTTP ${resp.status} at offset ${offset}`)
        if (resp.status === 401) {
          console.error('    Token expirado. Re-autenticando...')
          // Re-auth
          const reauthRes = await fetch(`${INVID_BASE}/api/v1/auth.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: INVID_USER, password: INVID_PASS }),
          })
          if (reauthRes.ok) {
            const rData = await reauthRes.json()
            if (rData.access_token) {
              token = rData.access_token
              continue
            }
          }
        }
        break
      }

      const data = await resp.json()
      const products = data.data || []
      if (!Array.isArray(products) || products.length === 0) {
        emptyPageCount++
        if (emptyPageCount >= MAX_EMPTY_PAGES) {
          console.log(`\n  ✓ ${MAX_EMPTY_PAGES} páginas vacías consecutivas — fin del catálogo`)
          break
        }
        offset += pageSize
        continue
      }
      emptyPageCount = 0

      for (const p of products) {
        totalFetched++
        // Invid usa campos UPPERCASE (fix sesión 45)
        const sku = p.ID || p.codigo_alfa || p.sku || ''
        if (!sku) continue
        const costPrice = parseFloat(p.PRICE || p.precio || p.pvp || p.price || '0')
        if (costPrice <= 0) continue
        const stock = parseInvidStock(p.STOCK_STATUS)
        const price = costPrice * (1 + MARKUP / 100)
        apiProducts.set(sku, { stock, price, costPrice })
      }

      process.stdout.write(`\r  API: ${totalFetched} productos procesados`)

      if (products.length < pageSize) {
        break
      }
      offset += pageSize
    } catch (err) {
      console.error(`\n  ✗ Error en offset ${offset}: ${err.message}`)
      break
    }
  }
  console.log('\n')
  console.log(`  ✓ ${apiProducts.size} productos válidos en API`)

  // ─── 4. Comparar y armar updates ───
  const now = new Date().toISOString()
  const updates = []
  let stockChangedCount = 0
  let priceChangedCount = 0
  let wasZeroNowGt = 0
  let wasGtNowZero = 0

  for (const [sku, apiData] of apiProducts) {
    const dbData = dbMap.get(sku)
    if (!dbData) {
      // Producto nuevo — no se crea acá, solo en sync manual.
      // Sesión 52: log si está en la lista negra (para auditoría)
      if (deletedBlacklist.has(sku)) console.log(`  ⛔ SKU ${sku} en lista negra, no se crearía`)
      continue
    }

    const stockChanged = apiData.stock !== Number(dbData.stock)
    const priceChanged = Math.abs(apiData.price - Number(dbData.price)) > 1

    if (stockChanged || priceChanged) {
      updates.push({
        id: dbData.id,
        stock: apiData.stock,
        price: apiData.price,
        costPrice: apiData.costPrice,
        sku
      })
      if (stockChanged) {
        stockChangedCount++
        if (Number(dbData.stock) === 0 && apiData.stock > 0) wasZeroNowGt++
        if (Number(dbData.stock) > 0 && apiData.stock === 0) wasGtNowZero++
      }
      if (priceChanged) priceChangedCount++
    }
  }

  console.log(`\n=== RESUMEN ===`)
  console.log(`Productos en API: ${apiProducts.size}`)
  console.log(`Productos en DB: ${dbMap.size}`)
  console.log(`Productos que cambiaron: ${updates.length}`)
  console.log(`  - Stock cambió: ${stockChangedCount}`)
  console.log(`    * 0 → con stock: ${wasZeroNowGt}`)
  console.log(`    * con stock → 0: ${wasGtNowZero}`)
  console.log(`  - Price cambió > $1: ${priceChangedCount}`)

  // ─── 5. Aplicar updates en batches de 50 ───
  if (updates.length === 0) {
    console.log('\n✓ No hay cambios que aplicar.')
  } else {
    console.log(`\n▸ Aplicando ${updates.length} updates...`)
    let applied = 0
    let errors = 0
    for (let i = 0; i < updates.length; i += 50) {
      const batch = updates.slice(i, i + 50)
      const stmts = batch.map(u => ({
        sql: 'UPDATE products SET stock = ?, price = ?, costPrice = ?, updatedAt = ? WHERE id = ?',
        args: [u.stock, u.price, u.costPrice, now, u.id],
      }))
      try {
        await tursoBatch(stmts)
        applied += batch.length
        process.stdout.write(`\r  Aplicados: ${applied}/${updates.length}`)
      } catch (e) {
        console.error(`\n  Batch error: ${e.message}. Probando individual...`)
        for (const stmt of stmts) {
          try { await tursoExecute(stmt.sql, stmt.args); applied++ } catch (e2) { errors++ }
        }
      }
    }
    console.log('\n')
    console.log(`  ✓ Aplicados: ${applied}, Errores: ${errors}`)
  }

  // ─── 6. Actualizar lastSyncAt ───
  try {
    await tursoExecute(
      'UPDATE suppliers SET lastSyncAt = ?, updatedAt = ? WHERE id = ?',
      [now, now, INVID_SUPPLIER_ID]
    )
    console.log('  ✓ lastSyncAt actualizado')
  } catch (e) {
    console.error(`  ✗ No se pudo actualizar lastSyncAt: ${e.message}`)
  }

  // ─── 7. Resumen final ───
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log()
  console.log('═'.repeat(70))
  console.log(' ✅ SYNC INVID COMPLETADA')
  console.log('═'.repeat(70))
  console.log(`  Tiempo: ${elapsed}s`)
  console.log(`  Productos fetched: ${totalFetched}`)
  console.log(`  Updates aplicados: ${updates.length}`)
  console.log(`  0 → con stock: ${wasZeroNowGt}`)
  console.log(`  con stock → 0: ${wasGtNowZero}`)
  console.log('═'.repeat(70))
}

main().catch(err => {
  console.error('✗ Error fatal:', err)
  process.exit(1)
})
