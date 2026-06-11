import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
  console.log('[cron-sync] Starting daily stock/price sync...')

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
    console.log(`[cron-sync] Elit: ${elitResult.updated} updated, ${elitResult.errors} errors`)
  } catch (err: any) {
    console.error('[cron-sync] Elit error:', err.message)
    results['Elit'] = { ok: false, updated: 0, errors: 1, message: err.message }
  }

  // ─── Sync Invid ────────────────────────────────────────────────────────────
  try {
    const invidResult = await syncInvidStock()
    results['Invid'] = invidResult
    console.log(`[cron-sync] Invid: ${invidResult.updated} updated, ${invidResult.errors} errors`)
  } catch (err: any) {
    console.error('[cron-sync] Invid error:', err.message)
    results['Invid'] = { ok: false, updated: 0, errors: 1, message: err.message }
  }

  // ─── Update lastSyncAt for both ────────────────────────────────────────────
  const now = new Date().toISOString()
  try {
    await db.execute({
      sql: `UPDATE suppliers SET lastSyncAt = ?, updatedAt = ? WHERE apiType IN ('elit', 'invid') AND isActive = 1`,
      args: [now, now],
    })
  } catch { /* non-critical */ }

  // ─── Re-detect brands after sync ────────────────────────────────────────
  try {
    const { BRAND_PATTERNS } = await import('@/lib/brand-patterns')
    const productResult = await db.execute({ sql: 'SELECT id, name FROM products WHERE isActive = 1', args: [] })
    const allProducts = productResult.rows as { id: string; name: string }[]

    const brandProductCounts = new Map<string, number>()
    const brandProductIds = new Map<string, string[]>()

    for (const product of allProducts) {
      for (const bp of BRAND_PATTERNS) {
        if (bp.pattern.test(product.name)) {
          const key = bp.slug
          brandProductCounts.set(key, (brandProductCounts.get(key) || 0) + 1)
          if (!brandProductIds.has(key)) brandProductIds.set(key, [])
          brandProductIds.get(key)!.push(product.id)
          break
        }
      }
    }

    let brandsCreated = 0
    for (const bp of BRAND_PATTERNS) {
      const count = brandProductCounts.get(bp.slug) || 0
      const existing = await db.execute({ sql: 'SELECT id FROM brands WHERE slug = ?', args: [bp.slug] })
      if (existing.rows.length > 0) {
        await db.execute({ sql: 'UPDATE brands SET productCount = ?, updatedAt = ? WHERE slug = ?', args: [count, now, bp.slug] })
      } else if (count > 0) {
        const id = crypto.randomUUID()
        await db.execute({
          sql: `INSERT INTO brands (id, name, slug, logoUrl, logoWidth, logoHeight, isActive, "order", productCount, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`,
          args: [id, bp.name, bp.slug, `https://cdn.simpleicons.org/${bp.slug}/9ca3af`, 80, 24, count, now, now],
        })
        brandsCreated++
      }
    }

    // Assign brandId to products that don't have one
    for (const bp of BRAND_PATTERNS) {
      const brandRow = await db.execute({ sql: 'SELECT id FROM brands WHERE slug = ?', args: [bp.slug] })
      if (brandRow.rows.length === 0) continue
      const brandId = (brandRow.rows[0] as any).id
      const pids = brandProductIds.get(bp.slug)
      if (!pids) continue
      for (const pid of pids) {
        try { await db.execute({ sql: 'UPDATE products SET brandId = ? WHERE id = ? AND brandId IS NULL', args: [brandId, pid] }) } catch { /* skip */ }
      }
    }

    console.log(`[cron-sync] Brands updated: ${brandsCreated} new brands detected`)
  } catch (err: any) {
    console.error('[cron-sync] Brand update error (non-critical):', err.message)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`[cron-sync] Daily stock/price sync completed in ${elapsed}s`)

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
  console.log(`[cron-sync] Elit: ${dbMap.size} products in DB`)

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

  console.log(`[cron-sync] Elit: ${apiProducts.size} products from API`)

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
  console.log(`[cron-sync] Invid: ${dbMap.size} products in DB`)

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

  console.log(`[cron-sync] Invid: ${apiProducts.size} products from API`)

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
