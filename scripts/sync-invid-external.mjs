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
      { type: 'execute', stmt: { sql, args: args.map(a => a === null || a === undefined ? { type: 'null' } : { type: 'text', value: String(a) }) } },
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
        stmt: { sql: s.sql, args: (s.args || []).map(a => a === null || a === undefined ? { type: 'null' } : { type: 'text', value: String(a) }) }
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

// SESIÓN 59: generación de slugs (misma lógica que src/lib/format-product.ts)
function generateSlug(name) {
  return String(name)
    .toLowerCase()
    .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 120)
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

  // ─── SESIÓN 59: mapeos de categoría + slugs (para crear productos nuevos) ───
  console.log('▸ Cargando mapeos de categoría y slugs existentes...')
  const categoryMappings = new Map()
  try {
    const mapResult = await tursoExecute(
      `SELECT supplierCategory, storeCategoryId FROM supplier_category_mappings WHERE supplierId = ?`,
      [INVID_SUPPLIER_ID]
    )
    for (const row of mapResult.rows) {
      if (row.supplierCategory && row.storeCategoryId) categoryMappings.set(String(row.supplierCategory), row.storeCategoryId)
    }
    console.log(`  ✓ ${categoryMappings.size} mapeos de categoría para Invid`)
  } catch (e) {
    console.warn(`  ⚠ No se pudieron cargar mapeos: ${e.message}. Los productos nuevos se crearán sin categoría.`)
  }

  const existingSlugs = new Set()
  try {
    const slugResult = await tursoExecute('SELECT slug FROM products')
    for (const row of slugResult.rows) if (row.slug) existingSlugs.add(row.slug)
    console.log(`  ✓ ${existingSlugs.size} slugs existentes cargados`)
  } catch (e) {
    console.warn(`  ⚠ No se pudieron cargar slugs: ${e.message}`)
  }

  // ─── 2. Cargar productos Invid existentes en DB ───
  console.log('▸ Cargando productos Invid desde DB...')
  const dbResult = await tursoExecute(
    'SELECT id, providerSku, stock, price, costPrice, updatedAt FROM products WHERE providerId = ?',
    [INVID_SUPPLIER_ID]
  )
  const dbMap = new Map()
  for (const row of dbResult.rows) {
    if (row.providerSku) dbMap.set(row.providerSku, row)
  }
  console.log(`  ✓ ${dbMap.size} productos en DB`)

  // ─── 3. Fetch paginado de la API de Invid ───
  // SESIÓN 56 FIX CRÍTICO: Rate limit de Invid es 50 req/hora por usuario.
  // Antes, el sync empezaba siempre desde offset 0 y al quedarse sin rate limit
  // cortaba sin guardar progreso → productos después del offset 5000 NUNCA se sincronizaban.
  //
  // Ahora: guardamos el offset en store_config (clave 'invid_sync_offset').
  // Cada corrida arranca desde el último offset guardado y continúa desde ahí.
  // Cuando llega al final del catálogo (página vacía o sin next_page_url),
  // resetea el offset a 0 para empezar de nuevo desde el principio.
  //
  // Con 50 req/hora × 100 productos/req = 5000 productos/hora.
  // 4 corridas/día (cada 6h) × 5000 = 20,000 productos/día.
  // Catálogo Invid ~5000-10000 productos → sync completo en 1-2 días.
  console.log('▸ Obteniendo productos desde API Invid...')

  // Cargar offset guardado
  let startOffset = 0
  try {
    const offsetResult = await tursoExecute(
      `SELECT value FROM store_config WHERE key = 'invid_sync_offset'`
    )
    if (offsetResult.rows.length > 0 && offsetResult.rows[0].value) {
      startOffset = parseInt(offsetResult.rows[0].value, 10) || 0
      console.log(`  ✓ Offset guardado encontrado: ${startOffset} (continuando desde ahí)`)
    } else {
      console.log(`  ✓ Sin offset guardado, empezando desde 0`)
    }
  } catch (e) {
    console.warn(`  ⚠ No se pudo cargar offset guardado: ${e.message}. Empezando desde 0.`)
  }

  // SESIÓN 60: si arrancamos desde offset 0 es un ciclo nuevo → resetear acumulado
  if (startOffset === 0) {
    try {
      const cycleNow = new Date().toISOString()
      await tursoExecute(
        `INSERT INTO store_config (key, value) VALUES ('invid_cycle_skus', '[]')
         ON CONFLICT(key) DO UPDATE SET value = '[]'`
      )
      await tursoExecute(
        `INSERT INTO store_config (key, value) VALUES ('invid_cycle_start', ?)
         ON CONFLICT(key) DO UPDATE SET value = ?`,
        [cycleNow, cycleNow]
      )
      await tursoExecute(
        `INSERT INTO store_config (key, value) VALUES ('invid_cycle_armed', '1')
         ON CONFLICT(key) DO UPDATE SET value = '1'`
      )
      console.log('  ✓ Ciclo nuevo de catálogo iniciado (offset 0)')
    } catch (e) {
      console.warn(`  ⚠ No se pudo resetear el acumulado del ciclo: ${e.message}`)
    }
  }

  const apiProducts = new Map()
  const seenIds = [] // SESIÓN 63: ids verificados para lastSeenAt
  let offset = startOffset
  const pageSize = 100
  let totalFetched = 0
  let emptyPageCount = 0
  const MAX_EMPTY_PAGES = 3
  let rateLimited = false
  let reachedEnd = false

  async function saveOffset(off) {
    try {
      // UPSERT: insertar o actualizar
      await tursoExecute(
        `INSERT INTO store_config (key, value) VALUES ('invid_sync_offset', ?)
         ON CONFLICT(key) DO UPDATE SET value = ?`,
        [String(off), String(off)]
      )
    } catch (e) {
      console.warn(`  ⚠ No se pudo guardar offset ${off}: ${e.message}`)
    }
  }

  while (true) {
    try {
      const url = `${INVID_BASE}/api/v1/articulo.php?offset=${offset}`
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })

      // SESIÓN 56 FIX: manejar 429 (rate limit) guardando el progreso
      if (resp.status === 429) {
        const retryAfter = parseInt(resp.headers.get('retry-after') || '60', 10)
        const remaining = resp.headers.get('x-ratelimit-remaining') || '?'
        const reset = resp.headers.get('x-ratelimit-reset')
        console.log(`\n  ⏳ Rate limit alcanzado en offset ${offset}`)
        console.log(`     Remaining: ${remaining}/50, reset en ${retryAfter}s`)
        console.log(`     Guardando offset ${offset} para continuar en la próxima corrida...`)
        await saveOffset(offset)
        rateLimited = true
        break
      }

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
          reachedEnd = true
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
        apiProducts.set(sku, { stock, price, costPrice, raw: p })
      }

      process.stdout.write(`\r  API: ${totalFetched} productos procesados (offset ${offset})    `)

      if (products.length < pageSize) {
        // Última página — fin del catálogo
        reachedEnd = true
        break
      }
      offset += pageSize
    } catch (err) {
      console.error(`\n  ✗ Error en offset ${offset}: ${err.message}`)
      // Guardar progreso antes de salir
      await saveOffset(offset)
      break
    }
  }
  console.log('\n')
  console.log(`  ✓ ${apiProducts.size} productos válidos en API (fetched ${totalFetched} en esta corrida)`)

  // SESIÓN 56 FIX: manejar el offset al finalizar
  if (reachedEnd) {
    console.log(`  ✓ Fin del catálogo alcanzado. Reseteando offset a 0 para próxima corrida.`)
    await saveOffset(0)
  } else if (rateLimited) {
    console.log(`  ⏳ Sync pausado por rate limit. Continuará desde offset ${offset} en la próxima corrida.`)
  } else {
    // Sync terminó por otra razón (error, etc.) — guardar offset para continuar
    await saveOffset(offset)
    console.log(`  ℹ Offset guardado en ${offset} para próxima corrida.`)
  }

  // ─── SESIÓN 63: marcar lastSeenAt de los productos verificados ───
  if (seenIds.length > 0) {
    const nowSeen = new Date().toISOString()
    let seenWritten = 0
    for (let i = 0; i < seenIds.length; i += 100) {
      const batch = seenIds.slice(i, i + 100).map(id => ({
        sql: `UPDATE products SET lastSeenAt = ? WHERE id = ?`,
        args: [nowSeen, id],
      }))
      try {
        await tursoBatch(batch)
        seenWritten += batch.length
      } catch (e) {
        for (const s of batch) { try { await tursoExecute(s.sql, s.args); seenWritten++ } catch (e2) {} }
      }
    }
    console.log(`  ✓ lastSeenAt marcado en ${seenWritten} productos verificados`)
  }

  // ─── SESIÓN 60: acumular SKUs vistos; al completar el catálogo, ───
  // ─── poner stock=0 a los productos que Invid sacó del catálogo ───
  try {
    const accResult = await tursoExecute(`SELECT value FROM store_config WHERE key = 'invid_cycle_skus'`)
    let seenSkus = new Set()
    if (accResult.rows.length > 0 && accResult.rows[0].value) {
      try { seenSkus = new Set(JSON.parse(accResult.rows[0].value)) } catch (e) { seenSkus = new Set() }
    }
    for (const sku of apiProducts.keys()) seenSkus.add(sku)
    const mergedSkus = JSON.stringify([...seenSkus])
    await tursoExecute(
      `INSERT INTO store_config (key, value) VALUES ('invid_cycle_skus', ?)
       ON CONFLICT(key) DO UPDATE SET value = ?`,
      [mergedSkus, mergedSkus]
    )

    if (reachedEnd) {
      const armedRes = await tursoExecute(`SELECT value FROM store_config WHERE key = 'invid_cycle_armed'`)
      const armed = armedRes.rows[0] && armedRes.rows[0].value === '1'
      if (!armed) {
        console.log('  ℹ Catálogo completado pero acumulado no armado (primera vuelta post-deploy) — no se desactiva nada, se arma el próximo ciclo')
      }
      const startRes = await tursoExecute(`SELECT value FROM store_config WHERE key = 'invid_cycle_start'`)
      const cycleStart = (startRes.rows[0] && startRes.rows[0].value) || '2000-01-01'
      const ghosts = []
      let nullSkuConStock = 0
      for (const [sku, row] of dbMap) {
        if (!row.providerSku) { if (Number(row.stock) > 0) nullSkuConStock++; continue }
        if (!seenSkus.has(sku) && Number(row.stock) > 0 && (row.updatedAt || '') < cycleStart) {
          ghosts.push(row)
        }
      }
      if (armed && ghosts.length > 0) {
        const nowG = new Date().toISOString()
        const gStmts = ghosts.map(g => ({
          sql: `UPDATE products SET stock = 0, updatedAt = ? WHERE id = ?`,
          args: [nowG, g.id],
        }))
        for (let i = 0; i < gStmts.length; i += 100) {
          const batch = gStmts.slice(i, i + 100)
          try {
            await tursoBatch(batch)
          } catch (e) {
            for (const s of batch) { try { await tursoExecute(s.sql, s.args) } catch (e2) {} }
          }
        }
        ghostCount = ghosts.length
        console.log(`  ⚠ ${ghosts.length} productos de Invid ya NO están en el catálogo → stock=0 (fantasmas)`)
        for (const g of ghosts.slice(0, 30)) console.log(`     - SKU ${g.providerSku}`)
      }
      if (armed && nullSkuConStock > 0) {
        console.log(`  ℹ ${nullSkuConStock} productos Invid sin providerSku con stock (no se pueden validar contra la API)`)
      }
      await tursoExecute(
        `INSERT INTO store_config (key, value) VALUES ('invid_cycle_skus', '[]')
         ON CONFLICT(key) DO UPDATE SET value = '[]'`
      )
      if (armed) {
        await tursoExecute(
          `INSERT INTO store_config (key, value) VALUES ('invid_cycle_armed', '0')
           ON CONFLICT(key) DO UPDATE SET value = '0'`
        )
      }
    }
  } catch (e) {
    console.warn(`  ⚠ Detección de productos fantasma: ${e.message}`)
  }

  // ─── 4. Comparar y armar updates ───
  const now = new Date().toISOString()
  const updates = []
  const creations = [] // SESIÓN 59: productos nuevos a crear
  // (seenIds se declara arriba, junto a apiProducts)
  let ghostCount = 0 // SESIÓN 60: productos que Invid sacó del catálogo
  let createdApplied = 0 // SESIÓN 59
  let blacklistedCount = 0 // SESIÓN 59
  let skippedNewCount = 0 // SESIÓN 59
  let stockChangedCount = 0
  let priceChangedCount = 0
  let wasZeroNowGt = 0
  let wasGtNowZero = 0

  for (const [sku, apiData] of apiProducts) {
    const dbData = dbMap.get(sku)
    if (!dbData) {
      // SESIÓN 59: producto nuevo — se crea automáticamente (antes: solo sync manual).
      // La lista negra tiene prioridad (sesión 52).
      if (deletedBlacklist.has(sku)) {
        blacklistedCount++
        continue
      }
      const raw = apiData.raw || {}
      const title = String(raw.TITLE || '').trim()
      if (!title || apiData.costPrice <= 0) { skippedNewCount++; continue }
      try {
        const supplierCategory = String(raw.RUBRO || raw.CATEGORIA || raw.GRUPO || raw.FAMILY || raw.CATEGORY || '')
        // Categoría SOLO si hay mapeo configurado; si no, NULL (cola "Sin categoría" del admin)
        const categoryId = categoryMappings.get(supplierCategory) || null
        let slug = generateSlug(title) || String(sku).toLowerCase()
        if (existingSlugs.has(slug)) {
          let suffix = 2
          while (existingSlugs.has(`${slug}-${suffix}`) && suffix < 100) suffix++
          slug = `${slug}-${suffix}`
        }
        existingSlugs.add(slug)
        const specs = {}
        if (raw.BRAND) specs['Marca'] = String(raw.BRAND)
        if (raw.PART_NUMBER) specs['Part Number'] = String(raw.PART_NUMBER)
        const images = raw.IMAGE_URL ? JSON.stringify([String(raw.IMAGE_URL)]) : '[]'
        const finalPrice = parseFloat(raw.FINAL_PRICE || '0')
        creations.push({
          id: crypto.randomUUID(),
          name: title,
          slug,
          description: String(raw.DESCRIPTION || raw.LONG_DESCRIPTION || ''),
          price: apiData.price,
          comparePrice: finalPrice > 0 ? finalPrice * (1 + MARKUP / 100) : null,
          costPrice: apiData.costPrice,
          sku,
          stock: apiData.stock,
          images,
          specs: JSON.stringify(specs),
          categoryId,
          supplierCategory,
        })
      } catch (e) {
        console.error(`  ✗ Error preparando producto nuevo ${sku}: ${e.message}`)
      }
      continue
    }

    seenIds.push(dbData.id) // SESIÓN 63
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

  // ─── SESIÓN 59: aplicar creaciones en batches de 50 ───
  if (creations.length > 0) {
    console.log(`\n▸ Creando ${creations.length} productos nuevos...`)
    let createErrors = 0
    for (let i = 0; i < creations.length; i += 50) {
      const batch = creations.slice(i, i + 50)
      const stmts = batch.map(c => ({
        sql: `INSERT INTO products (id, name, slug, description, price, comparePrice, costPrice, sku, stock, isActive, isFeatured, images, specs, providerId, providerSku, categoryId, supplierCategory, ivaRate)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?, NULL)`,
        args: [c.id, c.name, c.slug, c.description, c.price, c.comparePrice, c.costPrice, c.sku, c.stock, c.images, c.specs, INVID_SUPPLIER_ID, c.sku, c.categoryId, c.supplierCategory],
      }))
      try {
        await tursoBatch(stmts)
        createdApplied += batch.length
        process.stdout.write(`\r  Creados: ${createdApplied}/${creations.length}`)
      } catch (e) {
        console.error(`\n  Batch de creación error: ${e.message}. Probando individual...`)
        for (const stmt of stmts) {
          try { await tursoExecute(stmt.sql, stmt.args); createdApplied++ } catch (e2) { createErrors++; console.error(`    ✗ SKU ${stmt.args[7]}: ${e2.message}`) }
        }
      }
    }
    console.log('\n')
    console.log(`  ✓ Productos nuevos creados: ${createdApplied}, errores: ${createErrors}`)
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
  console.log(`  Productos nuevos: ${createdApplied} creados (${blacklistedCount} en lista negra, ${skippedNewCount} sin título/precio)`)
  console.log(`  Fantasmas (Invid los sacó del catálogo) stock→0: ${ghostCount}`)
  console.log(`  0 → con stock: ${wasZeroNowGt}`)
  console.log(`  con stock → 0: ${wasGtNowZero}`)
  if (reachedEnd) {
    console.log(`  Offset: reseteado a 0 (fin del catálogo)`)
  } else if (rateLimited) {
    console.log(`  Offset guardado: ${offset} (continuará en próxima corrida)`)
  } else {
    console.log(`  Offset guardado: ${offset}`)
  }
  console.log('═'.repeat(70))
}

main().catch(err => {
  console.error('✗ Error fatal:', err)
  process.exit(1)
})
