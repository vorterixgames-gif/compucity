import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { db } from '@/lib/db'
// Sesión 43 día 2: revalidateTag para invalidar cache de products on-demand.
// Después de que el cron actualiza productos (precios/stock), llamamos
// revalidateTag('products', 'default') para que los visitantes vean los datos frescos
// instantáneamente. Sin esto, los cambios del cron tardarían hasta 5 min.
import { revalidateTag } from 'next/cache'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for Vercel

/**
 * Cron endpoint for automated daily supplier sync (stock + price updates only).
 * Secured via CRON_SECRET env variable.
 * 
 * This does a lightweight sync: fetches current stock/prices from supplier APIs
 * and updates existing products. Does NOT create new products or recategorize.
 * For full sync (with new products), use the admin panel manually.
 * 
 * Call with: GET /api/cron/sync?secret=YOUR_CRON_SECRET
 */
export async function GET(request: Request) {
  const startTime = Date.now()
  logger.debug('[cron-sync] Starting daily stock/price sync...')

  // Verify cron secret
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[cron-sync] CRON_SECRET not configured')
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  if (secret !== cronSecret) {
    console.warn('[cron-sync] Invalid cron secret')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, { ok: boolean; updated: number; errors: number; message: string }> = {}

  // ─── Sync Elit ─────────────────────────────────────────────────────────────
  try {
    const elitResult = await syncElitStock()
    results['Elit'] = elitResult
    logger.debug(`[cron-sync] Elit: ${elitResult.updated} updated, ${elitResult.errors} errors`)
  } catch (err: any) {
    console.error('[cron-sync] Elit error:', err.message)
    results['Elit'] = { ok: false, updated: 0, errors: 1, message: err.message }
  }

  // ─── Sync Invid ────────────────────────────────────────────────────────────
  try {
    const invidResult = await syncInvidStock()
    results['Invid'] = invidResult
    logger.debug(`[cron-sync] Invid: ${invidResult.updated} updated, ${invidResult.errors} errors`)
  } catch (err: any) {
    console.error('[cron-sync] Invid error:', err.message)
    results['Invid'] = { ok: false, updated: 0, errors: 1, message: err.message }
  }

  // ─── Air Intra: desactivado en Vercel (sesión 43 día 4) ──────────────────
  // Air Intra ahora se sincroniza via GitHub Actions cada 12h.
  // Script: scripts/sync-air-intra-external.mjs
  // Workflow: .github/workflows/sync-air-intra.yml
  // GitHub Actions procesa TODAS las páginas (16) y filtra por rubros permitidos.
  // Esto libera Vercel Fluid CPU y evita duplicar trabajo.
  results['Air Intra'] = { ok: true, updated: 0, errors: 0, message: 'Sincronizado via GitHub Actions (cada 12h)' }

  // ─── Update lastSyncAt for both ────────────────────────────────────────────
  const now = new Date().toISOString()
  try {
    await db.execute({
      sql: `UPDATE suppliers SET lastSyncAt = ?, updatedAt = ? WHERE apiType IN ('elit', 'invid', 'air_intra') AND isActive = 1`,
      args: [now, now],
    })
  } catch { /* non-critical */ }

  // ─── Brands: NO se re-detectan acá (sesión 44) ────────────────────────────
  // Antes este bloque hacía re-detección de brands con ~14.000 queries a Turso
  // por ejecución, consumiendo 1.5-2.5h/mes de Fluid Active CPU (37-62% del
  // límite Hobby de 4h). Como las brands casi no cambian (solo cuando entran
  // productos nuevos, lo cual NO pasa en este cron diario — solo en syncs
  // manuales o en el sync de Air Intra que corre en GitHub Actions), el bloque
  // era 100% desperdicio en la mayoría de las ejecuciones.
  //
  // Ahora la re-detección de brands corre en GitHub Actions:
  //   - Workflow: .github/workflows/sync-brands.yml
  //   - Script:   scripts/sync-brands-external.mjs
  //   - Schedule: 1 vez por día (12:30 UTC = 09:30 AR)
  //   - Costo: $0 (GitHub Actions free tier, ~15-30 min/mes de 2000 disponibles)
  //
  // Para disparar manualmente: GitHub repo → Actions tab → "Sync Brands" → Run workflow
  // O desde el admin: botón "Inicializar marcas" en /admin/proveedores (manual, con auth)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  logger.debug(`[cron-sync] Daily stock/price sync completed in ${elapsed}s`)

  // Sesión 43 día 2: invalidar cache de products para que los cambios de
  // precios/stock del cron se reflejen instantáneamente en el storefront.
  try { revalidateTag('products', 'default') } catch (e) { /* revalidateTag puede fallar si se llama fuera de request scope */ }

  return NextResponse.json({
    ok: true,
    elapsed: `${elapsed}s`,
    timestamp: now,
    suppliers: results,
  })
}

// ─── Elit lightweight sync ────────────────────────────────────────────────────

async function syncElitStock(): Promise<{ ok: boolean; updated: number; errors: number; message: string }> {
  // Get supplier credentials
  const supplierResult = await db.execute({
    sql: 'SELECT * FROM suppliers WHERE apiType = ? AND isActive = 1',
    args: ['elit'],
  })
  const supplier = (supplierResult.rows as any[])[0]
  if (!supplier) return { ok: false, updated: 0, errors: 0, message: 'Elit supplier not found' }

  const baseUrl = supplier.apiBaseUrl || 'https://clientes.elit.com.ar'
  const userId = parseInt(supplier.apiUserId || '0')
  const token = supplier.apiToken || ''
  const markup = supplier.markup || 30

  if (!userId || !token) return { ok: false, updated: 0, errors: 0, message: 'Missing credentials' }

  // Load existing Elit products from DB
  const dbResult = await db.execute({
    sql: 'SELECT id, providerSku, stock, price, costPrice FROM products WHERE providerId = ?',
    args: [supplier.id],
  })
  const dbMap = new Map<string, { id: string; stock: number; price: number; costPrice: number }>()
  for (const row of dbResult.rows as any[]) {
    if (row.providerSku) dbMap.set(row.providerSku, row)
  }
  logger.debug(`[cron-sync] Elit: ${dbMap.size} products in DB`)

  // Fetch all products from Elit API (paginated)
  const apiProducts: Map<string, { stock: number; price: number; costPrice: number }> = new Map()
  let offset = 1
  const pageSize = 100

  while (true) {
    try {
      const url = `${baseUrl}/v1/api/productos?limit=${pageSize}&offset=${offset}`
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, token }),
      })

      if (!resp.ok) {
        console.error(`[cron-sync] Elit API error: HTTP ${resp.status}`)
        break
      }

      const data = await resp.json()
      const products = data.resultado || []
      if (!Array.isArray(products) || products.length === 0) break

      for (const p of products) {
        const sku = p.codigo_alfa
        if (!sku) continue
        const stock = parseInt(p.stock_total || '0')
        const costPrice = parseFloat(p.precio || '0')
        if (costPrice <= 0) continue
        const price = costPrice * (1 + markup / 100)
        apiProducts.set(sku, { stock, price, costPrice })
      }

      if (products.length < pageSize) break
      offset += pageSize
    } catch (err: any) {
      console.error(`[cron-sync] Elit fetch error at offset ${offset}:`, err.message)
      break
    }
  }

  logger.debug(`[cron-sync] Elit: ${apiProducts.size} products from API`)

  // Compare and build updates
  const now = new Date().toISOString()
  const updates: { id: string; stock: number; price: number; costPrice: number }[] = []

  for (const [sku, apiData] of apiProducts) {
    const dbData = dbMap.get(sku)
    if (!dbData) continue // Skip new products (full sync needed)

    if (apiData.stock !== dbData.stock || Math.abs(apiData.price - dbData.price) > 1) {
      updates.push({ id: dbData.id, stock: apiData.stock, price: apiData.price, costPrice: apiData.costPrice })
    }
  }

  // Apply updates in batches
  let applied = 0
  let errors = 0
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50)
    const stmts = batch.map(u => ({
      sql: 'UPDATE products SET stock = ?, price = ?, costPrice = ?, updatedAt = ? WHERE id = ?',
      args: [u.stock, u.price, u.costPrice, now, u.id],
    }))
    try {
      await db.batch(stmts)
      applied += batch.length
    } catch {
      for (const stmt of stmts) {
        try { await db.execute(stmt); applied++ } catch { errors++ }
      }
    }
  }

  return { ok: true, updated: applied, errors, message: `Updated ${applied} of ${updates.length} changes` }
}

// ─── Invid lightweight sync ───────────────────────────────────────────────────

async function syncInvidStock(): Promise<{ ok: boolean; updated: number; errors: number; message: string }> {
  // Get supplier credentials
  const supplierResult = await db.execute({
    sql: 'SELECT * FROM suppliers WHERE apiType = ? AND isActive = 1',
    args: ['invid'],
  })
  const supplier = (supplierResult.rows as any[])[0]
  if (!supplier) return { ok: false, updated: 0, errors: 0, message: 'Invid supplier not found' }

  const baseUrl = supplier.apiBaseUrl || 'https://www.invidcomputers.com'
  const username = supplier.apiUsername
  const password = supplier.apiPassword
  const markup = supplier.markup || 30

  if (!username || !password) return { ok: false, updated: 0, errors: 0, message: 'Missing Invid credentials (username/password)' }

  // Step 1: Authenticate to get token
  let token: string
  try {
    const authRes = await fetch(`${baseUrl}/api/v1/auth.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (!authRes.ok) {
      return { ok: false, updated: 0, errors: 1, message: `Invid auth failed: HTTP ${authRes.status}` }
    }

    const authData = await authRes.json()
    if (!authData.access_token) {
      return { ok: false, updated: 0, errors: 1, message: 'No access_token from Invid' }
    }
    token = authData.access_token
  } catch (err: any) {
    return { ok: false, updated: 0, errors: 1, message: `Invid auth error: ${err.message}` }
  }

  // Load existing Invid products from DB
  const dbResult = await db.execute({
    sql: 'SELECT id, providerSku, stock, price, costPrice FROM products WHERE providerId = ?',
    args: [supplier.id],
  })
  const dbMap = new Map<string, { id: string; stock: number; price: number; costPrice: number }>()
  for (const row of dbResult.rows as any[]) {
    if (row.providerSku) dbMap.set(row.providerSku, row)
  }
  logger.debug(`[cron-sync] Invid: ${dbMap.size} products in DB`)

  // Step 2: Fetch all products from Invid API (paginated)
  const apiProducts = new Map<string, { stock: number; price: number; costPrice: number }>()
  let offset = 0
  const pageSize = 100

  while (true) {
    try {
      const url = `${baseUrl}/api/v1/articulo.php?offset=${offset}`
      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (!resp.ok) {
        console.error(`[cron-sync] Invid API error at offset ${offset}: HTTP ${resp.status}`)
        break
      }

      const data = await resp.json()
      const products = data.data || []
      if (!Array.isArray(products) || products.length === 0) break

      for (const p of products) {
        const sku = p.codigo_alfa || p.sku || ''
        if (!sku) continue
        const stock = parseInt(p.stock_total || p.stock || '0')
        const costPrice = parseFloat(p.precio || p.pvp || p.price || '0')
        if (costPrice <= 0) continue
        const price = costPrice * (1 + markup / 100)
        apiProducts.set(sku, { stock, price, costPrice })
      }

      if (products.length < pageSize) break
      offset += pageSize
    } catch (err: any) {
      console.error(`[cron-sync] Invid fetch error at offset ${offset}:`, err.message)
      break
    }
  }

  logger.debug(`[cron-sync] Invid: ${apiProducts.size} products from API`)

  // Compare and build updates
  const now = new Date().toISOString()
  const updates: { id: string; stock: number; price: number; costPrice: number }[] = []

  for (const [sku, apiData] of apiProducts) {
    const dbData = dbMap.get(sku)
    if (!dbData) continue

    if (apiData.stock !== dbData.stock || Math.abs(apiData.price - dbData.price) > 1) {
      updates.push({ id: dbData.id, stock: apiData.stock, price: apiData.price, costPrice: apiData.costPrice })
    }
  }

  // Apply updates
  let applied = 0
  let errors = 0
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50)
    const stmts = batch.map(u => ({
      sql: 'UPDATE products SET stock = ?, price = ?, costPrice = ?, updatedAt = ? WHERE id = ?',
      args: [u.stock, u.price, u.costPrice, now, u.id],
    }))
    try {
      await db.batch(stmts)
      applied += batch.length
    } catch {
      for (const stmt of stmts) {
        try { await db.execute(stmt); applied++ } catch { errors++ }
      }
    }
  }

  return { ok: true, updated: applied, errors, message: `Updated ${applied} of ${updates.length} changes` }
}

// ─── Air Intra lightweight sync ────────────────────────────────────────────────

/**
 * Strip PHP notices/warnings from Air Intra API response text.
 * Copy of the function in admin sync route — needed here for standalone cron.
 */
function stripPhpNotices(text: string): string {
  return text
    .replace(/(?:<br\s*\/?>\s*)?<b>(?:Notice|Warning|Fatal error|Parse error|Deprecated)<\/b>:\s*[\s\S]*?on line \d+\s*/gi, '')
    .replace(/(?:^|\n)\s*(?:Notice|Warning|Fatal error|Parse error|Deprecated):\s*[\s\S]*?on line \d+\s*/gi, '')
    .replace(/<br\s*\/?>\s*/gi, '')
    .replace(/<\/?b>/gi, '')
    .replace(/,\s*([}\]])/g, '$1')
    .trim()
}

/**
 * Safely parse Air Intra JSON response handling PHP notice corruption.
 * Returns parsed array of products or null with error message.
 */
async function safeParseAirIntraProducts(res: Response): Promise<{ products: any[] | null; error: string | null }> {
  const rawText = await res.text()
  const text = stripPhpNotices(rawText)

  // Find JSON start
  let jsonStart = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{' || text[i] === '[') { jsonStart = i; break }
  }
  if (jsonStart === -1) return { products: null, error: `No JSON found in response` }

  const jsonText = text.substring(jsonStart)

  // Try direct parse
  try {
    const data = JSON.parse(jsonText)
    if (data && typeof data === 'object' && !Array.isArray(data) && data.error_id) {
      if (data.error_id === 403) return { products: null, error: `Rate limit (403): ${data.error_detail || ''}` }
      if (data.error_id === 401) return { products: null, error: `Token expired (401): ${data.error_detail || ''}` }
      return { products: null, error: `API error ${data.error_id}: ${data.error_name || ''}` }
    }
    const products = Array.isArray(data) ? data : (data.articulos || data.data || [])
    return { products, error: null }
  } catch {}

  // Try aggressive cleanup
  try {
    const cleaned = jsonText
      .replace(/<[^>]*>/g, '')
      .replace(/,\s*,/g, ',')
      .replace(/}\s*{/g, '},{')
      .replace(/,\s*([}\]])/g, '$1')
    const data = JSON.parse(cleaned)
    const products = Array.isArray(data) ? data : (data.articulos || data.data || [])
    return { products, error: null }
  } catch {}

  // Fallback: extract individual product objects using brace-depth parser
  const products: any[] = []
  let i = 0
  while (i < text.length) {
    if (text[i] !== '{') { i++; continue }
    let depth = 0, inStr = false, esc = false, objEnd = -1
    for (let j = i; j < text.length; j++) {
      const ch = text[j]
      if (esc) { esc = false; continue }
      if (ch === '\\' && inStr) { esc = true; continue }
      if (ch === '"') { inStr = !inStr; continue }
      if (inStr) continue
      if (ch === '{') depth++
      else if (ch === '}') { depth--; if (depth === 0) { objEnd = j; break } }
    }
    if (objEnd === -1) { i++; continue }
    const objText = text.substring(i, objEnd + 1)
    if (objText.includes('"codigo"') || objText.includes('"codiart"')) {
      try { products.push(JSON.parse(objText)) } catch { /* skip corrupted */ }
    }
    i = objEnd + 1
  }
  if (products.length > 0) return { products, error: null }
  return { products: null, error: `Could not parse response (${jsonText.length} chars)` }
}

// ─── Air Intra lightweight sync (CHUNKED + RESUME, sesión 43) ──────────────
//
// PROBLEMA ANTERIOR: el cron hacía fetch de 16 páginas seguidas sin delays, Air
// Intra rate-limit-eaba (HTTP 403 "Too many queries") en página 2-3, el cron
// hacía break y nunca procesaba las páginas siguientes. Resultado: 5000-7000
// productos de Air Intra quedaban con precios desactualizados por semanas.
//
// NUEVA ESTRATEGIA (sesion 43):
//   1. Por cada ejecución del cron, procesar SOLO 3 páginas (1500 productos).
//   2. Rotación circular: arrancar desde `airintra_cron_next_page` (store_config)
//      y persistir `airintra_cron_next_page = última página + 1` al final.
//      Si `airintra_cron_next_page` llegar a 16 (fin de catálogo), volver a 0.
//   3. Delay de 1.5s entre fetches para evitar rate limit.
//   4. En HTTP 403, 1 retry esperando 30s. Si sigue fallando, parar sin perder
//      el progreso (la próxima ejecución arranca desde la misma página).
//   5. Time budget de 50s para dejar margen al timeout de 60s de Vercel Hobby.
//
// Con 3 páginas/día y 16 páginas totales, cada producto se actualiza cada ~5 días.
// Para sync completa inmediata, usar /admin/proveedores (batched sync con retries).
//
// Air Intra deposits: air (Buenos Aires), lug (Lugo), ros (Rosario), cba (Córdoba),
// mza (Mendoza). El stock del producto = SUMA de todos los depósitos (sesión 43).
async function syncAirIntraStock(): Promise<{ ok: boolean; updated: number; errors: number; message: string }> {
  const t0 = Date.now()
  const TIME_BUDGET_MS = 50_000 // 50s — deja margen al timeout de 60s de Vercel Hobby

  // Get supplier credentials
  const supplierResult = await db.execute({
    sql: 'SELECT * FROM suppliers WHERE apiType = ? AND isActive = 1',
    args: ['air_intra'],
  })
  const supplier = (supplierResult.rows as any[])[0]
  if (!supplier) return { ok: false, updated: 0, errors: 0, message: 'Air Intra supplier not found' }

  const baseUrl = supplier.apiBaseUrl || 'https://api.air-intra.com/v2'
  const markup = supplier.markup || 30

  if (!supplier.apiUsername || !supplier.apiPassword) {
    return { ok: false, updated: 0, errors: 0, message: 'Missing Air Intra credentials (username/password)' }
  }

  // ─── Helper: leer/escribir airintra_cron_next_page en store_config ──────
  const getNextPage = async (): Promise<number> => {
    try {
      const r = await db.execute({
        sql: "SELECT value FROM store_config WHERE key = 'airintra_cron_next_page'",
        args: [],
      })
      if (r.rows.length === 0) return 0
      const v = (r.rows[0] as any).value
      const n = parseInt(typeof v === 'string' ? v.replace(/["']/g, '') : String(v), 10)
      return Number.isFinite(n) && n >= 0 ? n : 0
    } catch { return 0 }
  }
  const setNextPage = async (page: number): Promise<void> => {
    const safe = Math.max(0, Math.min(page, 100))
    try {
      const existing = await db.execute({
        sql: "SELECT id FROM store_config WHERE key = 'airintra_cron_next_page'",
        args: [],
      })
      if (existing.rows.length > 0) {
        await db.execute({
          sql: "UPDATE store_config SET value = ? WHERE key = 'airintra_cron_next_page'",
          args: [String(safe)],
        })
      } else {
        await db.execute({
          sql: "INSERT INTO store_config (id, key, value) VALUES (?, 'airintra_cron_next_page', ?)",
          args: [crypto.randomUUID(), String(safe)],
        })
      }
    } catch (e) {
      console.warn('[cron-sync] Air Intra: no se pudo persistir airintra_cron_next_page:', (e as Error).message)
    }
  }

  // Step 1: Login to get token + exchange rate
  let loginToken = ''
  let loginExchangeRate = 0
  try {
    const authRes = await fetch(`${baseUrl}/?q=login&user=${encodeURIComponent(supplier.apiUsername)}&pass=${encodeURIComponent(supplier.apiPassword)}`)
    if (!authRes.ok) {
      return { ok: false, updated: 0, errors: 1, message: `Air Intra auth failed: HTTP ${authRes.status}` }
    }
    const rawText = await authRes.text()
    const cleaned = stripPhpNotices(rawText)
    let jsonStart = -1
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i] === '{' || cleaned[i] === '[') { jsonStart = i; break }
    }
    if (jsonStart === -1) {
      return { ok: false, updated: 0, errors: 1, message: 'Air Intra auth: no JSON in response' }
    }
    const authData = JSON.parse(cleaned.substring(jsonStart))
    if (!authData.token) {
      return { ok: false, updated: 0, errors: 1, message: 'Air Intra auth: no token received' }
    }
    loginToken = authData.token
    loginExchangeRate = parseFloat(authData.cotiza || '0')
    logger.debug(`[cron-sync] Air Intra: Login OK. Cotización: ${loginExchangeRate}`)
  } catch (err: any) {
    return { ok: false, updated: 0, errors: 1, message: `Air Intra auth error: ${err.message}` }
  }

  // Load existing Air Intra products from DB
  const dbResult = await db.execute({
    sql: 'SELECT id, providerSku, stock, price, costPrice, stockByWarehouse FROM products WHERE providerId = ?',
    args: [supplier.id],
  })
  const dbMap = new Map<string, { id: string; stock: number; price: number; costPrice: number; stockByWarehouse: string | null }>()
  for (const row of dbResult.rows as any[]) {
    if (row.providerSku) dbMap.set(row.providerSku, row)
  }
  logger.debug(`[cron-sync] Air Intra: ${dbMap.size} products in DB`)

  // Step 2: Fetch CHUNK of pages (rotación circular con persistencia)
  const PAGES_PER_RUN = 6
  const PAGE_SIZE = 500
  const ESTIMATED_TOTAL_PAGES = 16 // 7900 productos / 500 por página, con margen
  const startPage = await getNextPage()
  const endPageExclusive = Math.min(startPage + PAGES_PER_RUN, ESTIMATED_TOTAL_PAGES)
  const pagesToFetch: number[] = []
  for (let p = startPage; p < endPageExclusive; p++) pagesToFetch.push(p)

  logger.debug(`[cron-sync] Air Intra: procesando páginas ${startPage}..${endPageExclusive - 1} (rotación circular desde store_config)`)

  const apiProducts = new Map<string, { stock: number; price: number; costPrice: number; stockByWarehouse: string }>()
  let pagesProcessed = 0
  let reachedEndOfCatalog = false
  let rateLimitedAt: number | null = null

  for (const page of pagesToFetch) {
    if (Date.now() - t0 > TIME_BUDGET_MS) {
      logger.debug(`[cron-sync] Air Intra: time budget agotado (${Date.now() - t0}ms). Pausando en página ${page}.`)
      break
    }

    let pageSucceeded = false
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const productsRes = await fetch(`${baseUrl}/?q=articulos&page=${page}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${loginToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })

        if (!productsRes.ok) {
          const errText = await productsRes.text().catch(() => '')
          if (errText.includes('Too many queries') || errText.includes('error_id":403')) {
            if (attempt === 0) {
              logger.debug(`[cron-sync] Air Intra: Rate limited en página ${page}. Esperando 30s antes de retry...`)
              await new Promise(r => setTimeout(r, 30_000))
              // Re-login por si el token expiró
              try {
                const reauth = await fetch(`${baseUrl}/?q=login&user=${encodeURIComponent(supplier.apiUsername)}&pass=${encodeURIComponent(supplier.apiPassword)}`)
                if (reauth.ok) {
                  const rText = await reauth.text()
                  const rClean = stripPhpNotices(rText)
                  let rStart = -1
                  for (let i = 0; i < rClean.length; i++) {
                    if (rClean[i] === '{' || rClean[i] === '[') { rStart = i; break }
                  }
                  if (rStart !== -1) {
                    const rData = JSON.parse(rClean.substring(rStart))
                    if (rData.token) loginToken = rData.token
                  }
                }
              } catch { /* ignore re-login errors */ }
              continue
            }
            rateLimitedAt = page
            logger.debug(`[cron-sync] Air Intra: rate limit persiste en página ${page} tras retry. Deteniendo chunk.`)
            break
          }
          console.error(`[cron-sync] Air Intra API error: HTTP ${productsRes.status} on page ${page}`)
          break
        }

        const { products, error } = await safeParseAirIntraProducts(productsRes)

        if (error || !products || !Array.isArray(products) || products.length === 0) {
          // Empty page = end of catalog
          logger.debug(`[cron-sync] Air Intra: página ${page} vacía → fin de catálogo. Reset a página 0.`)
          reachedEndOfCatalog = true
          pageSucceeded = true
          break
        }

        for (const p of products) {
          const sku = p.codigo || p.codiart || ''
          if (!sku) continue
          const costPrice = parseFloat(p.precio || '0')
          if (costPrice <= 0) continue

          // Stock total de todos los depósitos (sesión 43: sumar TODOS)
          const stockByWarehouse = {
            air: p.air?.disponible || 0,
            lug: p.lug?.disponible || 0,
            ros: p.ros?.disponible || 0,
            cba: p.cba?.disponible || 0,
            mza: p.mza?.disponible || 0,
          }
          const totalStock = Object.values(stockByWarehouse).reduce((a: number, b: number) => a + b, 0)
          const price = costPrice * (1 + markup / 100)

          apiProducts.set(sku, {
            stock: totalStock,
            price,
            costPrice,
            stockByWarehouse: JSON.stringify(stockByWarehouse),
          })
        }

        pagesProcessed++
        pageSucceeded = true
        break
      } catch (err: any) {
        console.error(`[cron-sync] Air Intra fetch error on page ${page}:`, err.message)
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 5_000))
          continue
        }
        break
      }
    }

    if (!pageSucceeded) break
    if (reachedEndOfCatalog) break

    // Delay entre páginas (no después de la última del chunk)
    if (pagesToFetch.indexOf(page) < pagesToFetch.length - 1) {
      await new Promise(r => setTimeout(r, 1_500))
    }
  }

  // Persistir próxima página (rotación circular)
  let nextPage: number
  if (reachedEndOfCatalog) {
    nextPage = 0
  } else if (rateLimitedAt !== null || pagesProcessed < pagesToFetch.length) {
    // Mantener la misma startPage para reintentar desde ahí la próxima vez
    nextPage = startPage
  } else {
    nextPage = startPage + pagesProcessed
    if (nextPage >= ESTIMATED_TOTAL_PAGES) nextPage = 0
  }
  await setNextPage(nextPage)
  logger.debug(`[cron-sync] Air Intra: próxima ejecución arrancará en página ${nextPage}`)

  logger.debug(`[cron-sync] Air Intra: ${apiProducts.size} products fetched en ${pagesProcessed}/${pagesToFetch.length} páginas`)

  // Step 3: Compare and build updates (only existing products, no new ones)
  const now = new Date().toISOString()
  const updates: { id: string; stock: number; price: number; costPrice: number; stockByWarehouse: string }[] = []

  for (const [sku, apiData] of apiProducts) {
    const dbData = dbMap.get(sku)
    if (!dbData) continue // Skip products not in DB (need full sync)

    if (apiData.stock !== dbData.stock || Math.abs(apiData.price - dbData.price) > 1 || Math.abs(apiData.costPrice - dbData.costPrice) > 1) {
      updates.push({
        id: dbData.id,
        stock: apiData.stock,
        price: apiData.price,
        costPrice: apiData.costPrice,
        stockByWarehouse: apiData.stockByWarehouse,
      })
    }
  }

  // Apply updates in batches
  let applied = 0
  let errors = 0
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50)
    const stmts = batch.map(u => ({
      sql: 'UPDATE products SET stock = ?, price = ?, costPrice = ?, stockByWarehouse = ?, updatedAt = ? WHERE id = ?',
      args: [u.stock, u.price, u.costPrice, u.stockByWarehouse, now, u.id],
    }))
    try {
      await db.batch(stmts)
      applied += batch.length
    } catch {
      for (const stmt of stmts) {
        try { await db.execute(stmt); applied++ } catch { errors++ }
      }
    }
  }

  // Also update isActive based on price (Air Intra rule: price > 0 = active)
  // NOTA: Esto es global a TODOS los productos Air Intra, no solo a los del chunk.
  // Es intencional: si un producto pasó de tener precio a no tenerlo (o viceversa)
  // fuera del chunk procesado, también hay que actualizarlo. Es una query barata.
  let activated = 0
  let deactivated = 0
  try {
    const activateResult = await db.execute({
      sql: `UPDATE products SET isActive = 1, updatedAt = ? WHERE providerId = ? AND isActive = 0 AND costPrice > 0`,
      args: [now, supplier.id],
    })
    activated = (activateResult.rowsAffected as number) || 0

    const deactivateResult = await db.execute({
      sql: `UPDATE products SET isActive = 0, updatedAt = ? WHERE providerId = ? AND isActive = 1 AND costPrice <= 0`,
      args: [now, supplier.id],
    })
    deactivated = (deactivateResult.rowsAffected as number) || 0
  } catch { /* non-critical */ }

  const extraInfo: string[] = []
  if (activated > 0) extraInfo.push(`${activated} activated`)
  if (deactivated > 0) extraInfo.push(`${deactivated} deactivated`)

  const chunkInfo = `chunk páginas ${startPage}..${startPage + pagesProcessed - 1} (${pagesProcessed} procesadas, próxima=${nextPage})`
  return {
    ok: true,
    updated: applied,
    errors,
    message: `Updated ${applied} of ${updates.length} changes${extraInfo.length > 0 ? ` (${extraInfo.join(', ')})` : ''}. ${chunkInfo}${rateLimitedAt !== null ? ` [RATE LIMITED en página ${rateLimitedAt}]` : ''}`,
  }
}
