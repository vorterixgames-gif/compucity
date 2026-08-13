#!/usr/bin/env node
/**
 * Sync Elit → Turso (corre en GitHub Actions, no en Vercel).
 *
 * Sesión 47: migrado del cron de Vercel a GitHub Actions para mayor
 * confiabilidad. El cron de Vercel Hobby estaba fallando silenciosamente
 * y dejaba productos con stock=0 por días aunque la API reportara stock.
 *
 * Variables de entorno (en GitHub Secrets):
 * - TURSO_URL: libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io
 * - TURSO_TOKEN: eyJ...
 * - ELIT_USER_ID: 18469
 * - ELIT_TOKEN: gksdk48b2at
 *
 * Uso local: node scripts/sync-elit-external.mjs
 * GitHub Actions: automático via .github/workflows/sync-elit-invid.yml
 */

const TURSO_URL = process.env.TURSO_URL || 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io'
const TURSO_TOKEN = process.env.TURSO_TOKEN || ''
const ELIT_BASE = 'https://clientes.elit.com.ar'
const ELIT_USER_ID = process.env.ELIT_USER_ID || ''
const ELIT_TOKEN = process.env.ELIT_TOKEN || ''
const ELIT_SUPPLIER_ID = '97ee58ad-279b-48c4-907d-1db97ae9e15e'
const MARKUP = 30 // hardcoded — debe coincidir con suppliers.markup en DB

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
  // statements: array of { sql, args }
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

// ============================================
// Función principal
// ============================================
async function main() {
  const startTime = Date.now()
  console.log('═'.repeat(70))
  console.log(' 🔄 Sync Elit → Turso (GitHub Actions)')
  console.log('═'.repeat(70))
  console.log(`Inicio: ${new Date().toISOString()}`)
  console.log()

  if (!TURSO_TOKEN) {
    console.error('✗ TURSO_TOKEN no configurado')
    process.exit(1)
  }
  if (!ELIT_USER_ID || !ELIT_TOKEN) {
    console.error('✗ ELIT_USER_ID o ELIT_TOKEN no configurados')
    process.exit(1)
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

  // ─── 1b. Cargar lista negra de productos eliminados (sesión 52) ───
  console.log('▸ Cargando lista negra de productos eliminados...')
  const deletedBlacklist = await loadDeletedBlacklist(ELIT_SUPPLIER_ID)

  // ─── SESIÓN 59: mapeos de categoría + slugs (para crear productos nuevos) ───
  console.log('▸ Cargando mapeos de categoría y slugs existentes...')
  const categoryMappings = new Map()
  try {
    const mapResult = await tursoExecute(
      `SELECT supplierCategory, storeCategoryId FROM supplier_category_mappings WHERE supplierId = ?`,
      [ELIT_SUPPLIER_ID]
    )
    for (const row of mapResult.rows) {
      if (row.supplierCategory && row.storeCategoryId) categoryMappings.set(String(row.supplierCategory), row.storeCategoryId)
    }
    console.log(`  ✓ ${categoryMappings.size} mapeos de categoría para Elit`)
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

  // ─── 1. Cargar productos Elit existentes en DB ───
  console.log('▸ Cargando productos Elit desde DB...')
  const dbResult = await tursoExecute(
    'SELECT id, providerSku, stock, price, costPrice FROM products WHERE providerId = ?',
    [ELIT_SUPPLIER_ID]
  )
  const dbMap = new Map()
  for (const row of dbResult.rows) {
    if (row.providerSku) dbMap.set(row.providerSku, row)
  }
  console.log(`  ✓ ${dbMap.size} productos en DB`)

  // ─── 2. Fetch paginado de la API de Elit ───
  console.log('▸ Obteniendo productos desde API Elit...')
  const apiProducts = new Map()
  let offset = 1
  const pageSize = 100
  let totalFetched = 0
  let retryCount = 0
  const MAX_RETRIES = 3
  const RETRY_DELAY_MS = 30_000

  while (true) {
    let attempts = 0
    let success = false

    while (attempts < MAX_RETRIES && !success) {
      attempts++
      try {
        const url = `${ELIT_BASE}/v1/api/productos?limit=${pageSize}&offset=${offset}`
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: parseInt(ELIT_USER_ID), token: ELIT_TOKEN }),
        })

        if (!resp.ok) {
          const errText = await resp.text().catch(() => '')
          console.error(`  ✗ HTTP ${resp.status} at offset ${offset} (intento ${attempts}/${MAX_RETRIES})`)
          if (errText) console.error(`    ${errText.substring(0, 200)}`)
          if (attempts < MAX_RETRIES) {
            console.log(`    Esperando ${RETRY_DELAY_MS / 1000}s...`)
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
            continue
          }
          break
        }

        const data = await resp.json()
        const products = data.resultado || []
        if (!Array.isArray(products) || products.length === 0) {
          success = true
          offset = -1 // signal end
          break
        }

        for (const p of products) {
          totalFetched++
          const sku = p.codigo_alfa
          if (!sku) continue
          const stock = parseInt(p.stock_total || '0')
          const costPrice = parseFloat(p.precio || '0')
          if (costPrice <= 0) continue
          const price = costPrice * (1 + MARKUP / 100)
          apiProducts.set(sku, { stock, price, costPrice, raw: p })
        }

        success = true
        process.stdout.write(`\r  API: ${totalFetched} productos procesados`)

        if (products.length < pageSize) {
          offset = -1
        } else {
          offset += pageSize
        }
      } catch (err) {
        console.error(`  ✗ Error en offset ${offset} (intento ${attempts}/${MAX_RETRIES}): ${err.message}`)
        if (attempts < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
          continue
        }
        break
      }
    }

    if (!success) {
      console.error(`\n✗ Falló offset ${offset} después de ${MAX_RETRIES} intentos. Continuando con lo recibido.`)
      break
    }
    if (offset === -1) break
  }
  console.log('\n')
  console.log(`  ✓ ${apiProducts.size} productos válidos en API`)

  // ─── 3. Comparar y armar updates ───
  const now = new Date().toISOString()
  const updates = []
  const seenIds = [] // SESIÓN 63: ids verificados para lastSeenAt
  const creations = [] // SESIÓN 59: productos nuevos a crear
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
      const name = String(raw.nombre || '').trim()
      if (!name || apiData.costPrice <= 0) { skippedNewCount++; continue }
      try {
        const supplierCategory = (raw.categoria && raw.sub_categoria)
          ? `${raw.categoria} > ${raw.sub_categoria}`
          : String(raw.categoria || raw.rubro || raw.familia || raw.grupo || raw.linea || '')
        // Categoría SOLO si hay mapeo configurado; si no, NULL (cola "Sin categoría" del admin)
        const categoryId = categoryMappings.get(supplierCategory) || null
        let slug = generateSlug(name) || String(sku).toLowerCase()
        if (existingSlugs.has(slug)) {
          let suffix = 2
          while (existingSlugs.has(`${slug}-${suffix}`) && suffix < 100) suffix++
          slug = `${slug}-${suffix}`
        }
        existingSlugs.add(slug)
        const specs = {}
        if (raw.marca) specs['Marca'] = String(raw.marca)
        if (raw.ean) specs['EAN'] = String(raw.ean)
        if (raw.garantia) specs['Garantía'] = String(raw.garantia)
        const images = Array.isArray(raw.imagenes) && raw.imagenes.length > 0 ? JSON.stringify(raw.imagenes) : '[]'
        const pvpUsd = parseFloat(raw.pvp_usd || '0')
        creations.push({
          id: crypto.randomUUID(),
          name,
          slug,
          description: String(raw.descripcion || ''),
          price: apiData.price,
          comparePrice: pvpUsd > 0 ? pvpUsd * (1 + MARKUP / 100) : null,
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

  // ─── 4. Aplicar updates en batches de 50 ───
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
        // Fallback: individual
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
        args: [c.id, c.name, c.slug, c.description, c.price, c.comparePrice, c.costPrice, c.sku, c.stock, c.images, c.specs, ELIT_SUPPLIER_ID, c.sku, c.categoryId, c.supplierCategory],
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

  // ─── SESIÓN 64: fantasmas Elit — el catálogo completo se ve en cada corrida ───
  if (apiProducts.size >= Math.max(100, dbMap.size * 0.5)) {
    const ghosts = []
    for (const [sku, row] of dbMap) {
      if (!row.providerSku) continue
      if (Number(row.stock) > 0 && !apiProducts.has(sku)) ghosts.push(row)
    }
    if (ghosts.length > 0) {
      const nowG = new Date().toISOString()
      const gStmts = ghosts.map(g => ({ sql: `UPDATE products SET stock = 0, updatedAt = ? WHERE id = ?`, args: [nowG, g.id] }))
      for (let i = 0; i < gStmts.length; i += 100) {
        const batch = gStmts.slice(i, i + 100)
        try { await tursoBatch(batch) } catch (e) { for (const s of batch) { try { await tursoExecute(s.sql, s.args) } catch (e2) {} } }
      }
      console.log(`  ⚠ ${ghosts.length} productos de Elit ya NO están en el catálogo → stock=0 (fantasmas)`)
      for (const g of ghosts.slice(0, 30)) console.log(`     - SKU ${g.providerSku}`)
    }
  } else {
    console.log(`  ⚠ Catálogo Elit sospechosamente chico (${apiProducts.size} vs ${dbMap.size} en DB) — se omite detección de fantasmas`)
  }

  // ─── 5. Actualizar lastSyncAt ───
  try {
    await tursoExecute(
      'UPDATE suppliers SET lastSyncAt = ?, updatedAt = ? WHERE id = ?',
      [now, now, ELIT_SUPPLIER_ID]
    )
    console.log('  ✓ lastSyncAt actualizado')
  } catch (e) {
    console.error(`  ✗ No se pudo actualizar lastSyncAt: ${e.message}`)
  }

  // ─── 6. Resumen final ───
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log()
  console.log('═'.repeat(70))
  console.log(' ✅ SYNC ELIT COMPLETADA')
  console.log('═'.repeat(70))
  console.log(`  Tiempo: ${elapsed}s`)
  console.log(`  Productos fetched: ${totalFetched}`)
  console.log(`  Updates aplicados: ${updates.length}`)
  console.log(`  Productos nuevos: ${createdApplied} creados (${blacklistedCount} en lista negra, ${skippedNewCount} sin nombre/precio)`)
  console.log(`  0 → con stock: ${wasZeroNowGt}`)
  console.log(`  con stock → 0: ${wasGtNowZero}`)
  console.log('═'.repeat(70))
}

main().catch(err => {
  console.error('✗ Error fatal:', err)
  process.exit(1)
})
