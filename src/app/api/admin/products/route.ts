import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchDollarRate, getStoreConfigNumber, calculateProductPrices, CategoryMarkup } from '@/lib/dollar'
import { getCurrentAdmin } from '@/lib/admin-auth'
// Sesión 43 día 2: revalidateTag para invalidar cache de products on-demand.
// Después de cualquier escritura (POST/PUT/DELETE), llamamos revalidateTag('products', 'default')
// para que el siguiente visitante vea el cambio INSTANTANEAMENTE en home,
// categorías, detalle, etc. Sin esto, los cambios tardarían hasta 5 min en verse.
import { revalidateTag } from 'next/cache'

/**
 * Resolve a providerId to a valid supplier UUID.
 * If the providerId is already a valid supplier UUID, return it as-is.
 * If it matches a supplier name (case-insensitive), return the supplier's UUID.
 * If no match is found, return null (no supplier).
 *
 * This prevents orphan products when providerId is set to a supplier name instead of UUID.
 */
async function resolveProviderId(providerId: string | null | undefined): Promise<string | null> {
  if (!providerId || providerId.trim() === '') return null

  // Check if it's a valid supplier UUID directly
  const directMatch = await db.execute({
    sql: 'SELECT id FROM suppliers WHERE id = ?',
    args: [providerId],
  })
  if (directMatch.rows.length > 0) return providerId

  // Try to match by supplier name (case-insensitive)
  const nameMatch = await db.execute({
    sql: 'SELECT id FROM suppliers WHERE LOWER(name) = LOWER(?)',
    args: [providerId],
  })
  if (nameMatch.rows.length > 0) {
    const resolvedId = (nameMatch.rows[0] as any).id
    console.warn(`[resolveProviderId] Resolved providerId "${providerId}" to supplier UUID "${resolvedId}"`)
    return resolvedId
  }

  // No match found — this is an invalid providerId, set to null
  console.warn(`[resolveProviderId] No supplier found for providerId "${providerId}", setting to null`)
  return null
}

async function getConfig(key: string, defaultValue: number): Promise<number> {
  const result = await db.execute({
    sql: 'SELECT value FROM store_config WHERE key = ?',
    args: [key],
  })
  const rows = result.rows as any[]
  if (rows.length > 0) {
    try {
      const raw = rows[0].value
      try {
        const parsed = JSON.parse(raw)
        if (typeof parsed === 'object' && parsed !== null && 'value' in parsed) {
          return Number(parsed.value) || defaultValue
        }
        if (typeof parsed === 'number') return parsed || defaultValue
      } catch {
        // Not valid JSON, treat as plain string number
      }
      return Number(raw) || defaultValue
    } catch {
      return defaultValue
    }
  }
  return defaultValue
}

// Module-level dollar rate cache (avoid calling external API on every request)
let cachedDollarRate = { rate: 0, fetchedAt: 0 }
const DOLLAR_CACHE_TTL = 15 * 60 * 1000 // 15 minutes in ms

async function getDollarRate(): Promise<number> {
  const now = Date.now()
  // Use cached rate if still fresh
  if (cachedDollarRate.rate > 0 && (now - cachedDollarRate.fetchedAt) < DOLLAR_CACHE_TTL) {
    return cachedDollarRate.rate
  }

  // Try reading from database first (fast, no external call)
  try {
    const dbResult = await db.execute('SELECT rate, updatedAt FROM dollar_rates ORDER BY updatedAt DESC LIMIT 1')
    const rows = dbResult.rows as any[]
    if (rows.length > 0 && rows[0].rate) {
      const dbRate = Number(rows[0].rate)
      const dbTime = new Date(rows[0].updatedAt).getTime()
      // If DB rate is fresh enough (< 30 min), use it
      if (dbRate > 0 && (now - dbTime) < DOLLAR_CACHE_TTL) {
        cachedDollarRate = { rate: dbRate, fetchedAt: now }
        return dbRate
      }
      // DB rate exists but is stale — use it as a fallback while we fetch
      if (dbRate > 0 && cachedDollarRate.rate === 0) {
        cachedDollarRate = { rate: dbRate, fetchedAt: dbTime }
      }
    }
  } catch {}

  // Fall back to external API
  try {
    const dollar = await fetchDollarRate()
    if (dollar.rate > 0) {
      cachedDollarRate = { rate: dollar.rate, fetchedAt: now }
      return dollar.rate
    }
  } catch {}

  // Ultimate fallback
  if (cachedDollarRate.rate > 0) return cachedDollarRate.rate
  return 1415
}

// ============================================
// Sesión 43 día 2 — Caché en memoria para lists estáticas del admin
// ============================================
// Estas 3 funciones cachean en memoria (5 min) las queries que se hacen
// en CADA request al listado de productos del admin:
//   - Lista de categorías (id, parentId) — para filtros y subcategorías
//   - Lista de categorías con markup — para cálculo de precios
//   - Lista de suppliers — para el dropdown de filtros
//
// Sin este caché, cada request al admin hacia 3 SELECTs a categories/suppliers
// (73 + 5 + 73 = 151 rows reads) en CADA página del listado.
// Con este caché, solo 1 vez cada 5 min.
//
// Para invalidar el caché cuando se edita una categoría o supplier,
// llamar __clearAdminProductsCache() desde los endpoints de escritura.

const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos
const adminCache = new Map<string, { data: any; expiresAt: number }>()

async function getCached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const entry = adminCache.get(key)
  if (entry && entry.expiresAt > now) {
    return entry.data as T
  }
  const data = await loader()
  adminCache.set(key, { data, expiresAt: now + ADMIN_CACHE_TTL_MS })
  return data
}

// Lista de categorías (id, parentId) para cálculo recursivo de subcategorías
async function getCachedCategories(): Promise<Array<{ id: string; parentId: string | null }>> {
  return getCached('admin_categories_tree', async () => {
    const r = await db.execute('SELECT id, parentId FROM categories')
    return r.rows as unknown as Array<{ id: string; parentId: string | null }>
  })
}

// Lista de categorías con campos de markup (para calculateProductPrices)
async function getCachedCategoryMarkupRows(): Promise<any[]> {
  return getCached('admin_categories_markup', async () => {
    const r = await db.execute('SELECT id, parentId, markup, cashDiscount, ivaRate FROM categories')
    return r.rows as any[]
  })
}

// Lista de suppliers para dropdown de filtros
async function getCachedSuppliers(): Promise<any[]> {
  return getCached('admin_suppliers', async () => {
    const r = await db.execute('SELECT id, name FROM suppliers ORDER BY name')
    return r.rows as any[]
  })
}

// Lista de categorías para dropdown de filtros (con slug)
async function getCachedCategoryFilterList(): Promise<any[]> {
  return getCached('admin_categories_filter', async () => {
    const r = await db.execute('SELECT id, name, slug, parentId FROM categories ORDER BY name')
    return r.rows as any[]
  })
}

// Invalidar el caché del admin (llamar cuando se edita categoría/supplier)
export function __clearAdminProductsCache(): void {
  adminCache.clear()
}

// Valid sort columns mapping (client name → SQL expression)
const SORT_MAP: Record<string, string> = {
  name: 'p.name',
  categoryName: 'c.name',
  costPrice: 'p.costPrice',
  price: 'p.price',
  comparePrice: 'p.comparePrice',
  stock: 'p.stock',
  isActive: 'p.isActive',
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const sp = request.nextUrl.searchParams

    // Parse pagination params
    const page = Math.max(1, Number(sp.get('page')) || 1)
    const limit = Math.min(200, Math.max(1, Number(sp.get('limit')) || 50))
    const offset = (page - 1) * limit

    // Parse filter params
    const search = sp.get('search')?.trim() || ''
    const categoryId = sp.get('categoryId') || ''
    const supplierId = sp.get('supplierId') || ''
    const stockStatus = sp.get('stockStatus') || ''
    const activeStatus = sp.get('activeStatus') || ''
    const onSale = sp.get('onSale') || ''
    const featuredStatus = sp.get('featuredStatus') || ''

    // Parse sort params
    const sortKey = sp.get('sort') || ''
    const sortDir = sp.get('sortDir') === 'asc' ? 'ASC' : 'DESC'
    const sortExpr = SORT_MAP[sortKey] || ''
    // Default sort: name ASC
    const orderClause = sortExpr ? `ORDER BY ${sortExpr} ${sortDir}` : 'ORDER BY p.name ASC'

    // Build WHERE conditions
    const conditions: string[] = []
    const args: any[] = []
    // Sesión 43 día 2: flag para saber si necesitamos JOIN en COUNT.
    // Solo hacemos JOIN cuando hay búsqueda por nombre de categoría/supplier.
    // Sin búsqueda, el COUNT solo escanea products (10K rows) en vez de
    // products + categories + suppliers (mucho más caro).
    let needsJoinForCount = false

    // Search filter (name, SKU, or category name)
    if (search) {
      conditions.push(`(p.name LIKE ? OR p.sku LIKE ? OR c.name LIKE ?)`)
      const likeTerm = `%${search}%`
      args.push(likeTerm, likeTerm, likeTerm)
      needsJoinForCount = true  // necesitamos JOIN para buscar por c.name
    }

    // Category filter (includes subcategories)
    if (categoryId) {
      if (categoryId === 'none') {
        conditions.push(`p.categoryId IS NULL`)
      } else {
        // Sesión 43 día 2: cachear la lista de categorías en memoria (5 min)
        // en vez de hacer SELECT * FROM categories en cada request al admin.
        // Las categorías cambian muy raramente (solo desde /admin/categorias).
        // __clearQueriesCache() se llama cuando se edita una categoría.
        const catRows = await getCachedCategories()
        const catIds = new Set<string>()
        catIds.add(categoryId)
        const addChildIds = (pid: string) => {
          for (const cat of catRows) {
            if (cat.parentId === pid) {
              catIds.add(cat.id)
              addChildIds(cat.id)
            }
          }
        }
        addChildIds(categoryId)

        const placeholders = Array.from(catIds).map(() => '?').join(',')
        conditions.push(`p.categoryId IN (${placeholders})`)
        args.push(...Array.from(catIds))
      }
    }

    // Supplier filter
    if (supplierId) {
      if (supplierId === 'none') {
        conditions.push(`p.providerId IS NULL`)
      } else {
        conditions.push(`p.providerId = ?`)
        args.push(supplierId)
      }
    }

    // Stock status filter
    if (stockStatus === 'inStock') {
      conditions.push(`p.stock > 5`)
    } else if (stockStatus === 'lowStock') {
      conditions.push(`p.stock > 0 AND p.stock <= 5`)
    } else if (stockStatus === 'outOfStock') {
      conditions.push(`p.stock <= 0`)
    }

    // Active status filter
    if (activeStatus === 'active') {
      conditions.push(`p.isActive = 1`)
    } else if (activeStatus === 'inactive') {
      conditions.push(`p.isActive != 1`)
    }

    // On sale filter
    if (onSale === 'yes') {
      conditions.push(`p.salePrice IS NOT NULL AND p.salePrice > 0`)
    } else if (onSale === 'no') {
      conditions.push(`p.salePrice IS NULL OR p.salePrice = 0`)
    }

    // Featured status filter
    if (featuredStatus === 'featured') {
      conditions.push(`p.isFeatured = 1`)
    } else if (featuredStatus === 'notFeatured') {
      conditions.push(`p.isFeatured != 1`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Run count query + data query + config in parallel
    const selectColumns = `p.id, p.name, p.slug, p.description, p.price, p.comparePrice, p.costPrice,
       p.markup, p.cashDiscount, p.ivaRate, p.sku, p.stock, p.stockByWarehouse, p.isActive, p.isFeatured,
       p.images, p.specs, p.providerId, p.providerSku, p.categoryId, p.supplierCategory,
       p.salePrice, p.saleStart, p.saleEnd, p.createdAt, p.updatedAt,
       c.name as categoryName, c.markup as categoryMarkup, c.cashDiscount as categoryCashDiscount,
       s.name as providerName`

    // Sesión 43 día 2: COUNT sin JOIN cuando no hay búsqueda.
    // Si no hay búsqueda activa, no necesitamos JOIN con categories/suppliers.
    // El COUNT solo escanea products (10K rows) en vez de products+JOINs.
    const countJoinClause = needsJoinForCount
      ? 'LEFT JOIN categories c ON p.categoryId = c.id LEFT JOIN suppliers s ON p.providerId = s.id'
      : ''
    const countSql = `SELECT COUNT(*) as total FROM products p ${countJoinClause} ${whereClause}`

    // Sesión 43 día 2: usar caché para categories y suppliers (cambian poco).
    // Antes: 2 SELECTs a categories + 1 SELECT a suppliers en CADA request.
    // Ahora: 1 vez cada 5 min desde caché en memoria.
    const [countResult, result, markup, cashDiscount, catMarkupResult, suppliersResult, categoriesResult, dollarRate] = await Promise.all([
      db.execute({ sql: countSql, args }),
      db.execute({
        sql: `SELECT ${selectColumns} FROM products p LEFT JOIN categories c ON p.categoryId = c.id LEFT JOIN suppliers s ON p.providerId = s.id ${whereClause} ${orderClause} LIMIT ? OFFSET ?`,
        args: [...args, limit, offset],
      }),
      getStoreConfigNumber('markup', 30),
      getStoreConfigNumber('cash_discount', 10),
      getCachedCategoryMarkupRows(),  // cacheado 5 min
      getCachedSuppliers(),            // cacheado 5 min
      getCachedCategoryFilterList(),   // cacheado 5 min
      getDollarRate(),
    ])

    const total = (countResult.rows[0] as any)?.total || 0
    const totalPages = Math.max(1, Math.ceil(total / limit))

    // Build category markup map with parent inheritance for 3-tier priority
    const rawCatMap = new Map<string, { parentId: string | null; markup: number | null; cashDiscount: number | null; ivaRate: number | null }>()
    for (const row of catMarkupResult as any[]) {
      rawCatMap.set(row.id, {
        parentId: row.parentId,
        markup: row.markup != null ? Number(row.markup) : null,
        cashDiscount: row.cashDiscount != null ? Number(row.cashDiscount) : null,
        ivaRate: row.ivaRate != null ? Number(row.ivaRate) : null,
      })
    }
    const catMarkupMap = new Map<string, CategoryMarkup>()
    const resolveCat = (id: string, field: 'markup' | 'cashDiscount' | 'ivaRate'): number | null => {
      const entry = rawCatMap.get(id)
      if (!entry) return null
      if (entry[field] != null) return entry[field]
      if (entry.parentId) return resolveCat(entry.parentId, field)
      return null
    }
    for (const [id] of rawCatMap) {
      catMarkupMap.set(id, {
        markup: resolveCat(id, 'markup'),
        cashDiscount: resolveCat(id, 'cashDiscount'),
        ivaRate: resolveCat(id, 'ivaRate'),
      })
    }

    // Calculate prices using calculateProductPrices (3-tier: product → category → global)
    const suppliersList = (suppliersResult as any[]).map(s => ({ id: s.id, name: s.name }))
    const categoriesList = (categoriesResult as any[]).map(c => ({ id: c.id, name: c.name, slug: c.slug, parentId: c.parentId }))

    const products = (result.rows as any[]).map(p => {
      const catMarkup = p.categoryId ? catMarkupMap.get(p.categoryId) : null
      const calculated = calculateProductPrices(p, dollarRate, markup, cashDiscount, catMarkup)
      return {
        ...calculated,
        categoryName: p.categoryName,
        providerName: p.providerName,
        _dollarRate: dollarRate,
      }
    })

    return NextResponse.json({
      ok: true,
      products,
      total,
      page,
      totalPages,
      suppliers: suppliersList,
      categories: categoriesList,
      dollarRate,
      markup,
      cashDiscount,
    }, {
      headers: {
        // Sesión 44: admin no debe cachear en CDN (datos privados, cambian seguido).
        // Browser cache: no-store para que F5 siempre traiga datos frescos después de edits.
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('Get products error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const {
      name, description, price, comparePrice, costPrice, sku, stock,
      isActive, isFeatured, images, specs, providerId, providerSku, categoryId,
      markup, cashDiscount, ivaRate, salePrice, saleStart, saleEnd,
    } = body

    console.log('[products POST] Received images:', images, 'type:', typeof images)

    if (!name) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      )
    }

    // Resolve providerId: if it's a supplier name instead of UUID, auto-resolve it
    const resolvedProviderId = await resolveProviderId(providerId)

    // Either costPrice (USD) or price (ARS) must be provided
    const hasCostPrice = costPrice && Number(costPrice) > 0
    const hasManualPrice = price !== undefined && Number(price) > 0

    if (!hasCostPrice && !hasManualPrice) {
      return NextResponse.json(
        { error: 'Debés ingresar el costo en USD o el precio de lista' },
        { status: 400 }
      )
    }

    const id = crypto.randomUUID()
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Check slug uniqueness
    const existing = await db.execute({
      sql: 'SELECT id FROM products WHERE slug = ?',
      args: [slug],
    })
    const finalSlug = existing.rows.length > 0 ? `${slug}-${Date.now()}` : slug

    // Check SKU uniqueness if provided
    if (sku && sku.trim()) {
      const existingSku = await db.execute({
        sql: 'SELECT id FROM products WHERE sku = ?',
        args: [sku.trim()],
      })
      if (existingSku.rows.length > 0) {
        return NextResponse.json(
          { error: `Ya existe un producto con el SKU "${sku.trim()}". Usá un SKU diferente o dejalo vacío.` },
          { status: 400 }
        )
      }
    }

    const now = new Date().toISOString()

    // Calculate prices
    let finalPrice: number
    let finalComparePrice: number | null

    if (hasCostPrice) {
      // Auto-calculate from USD cost + dollar rate + markup
      // 3-tier priority: product → category → global
      const [dollar, globalMarkup, globalCashDiscount, catMarkupResult] = await Promise.all([
        fetchDollarRate(),
        getConfig('markup', 30),
        getConfig('cash_discount', 10),
        categoryId ? db.execute({ sql: 'SELECT markup, cashDiscount, ivaRate FROM categories WHERE id = ?', args: [categoryId] }) : null,
      ])

      // Get category markup if available
      const catRow = catMarkupResult ? (catMarkupResult.rows as any[])[0] : null
      const catMarkupVal = catRow?.markup != null ? Number(catRow.markup) : null
      const catCashDiscountVal = catRow?.cashDiscount != null ? Number(catRow.cashDiscount) : null
      const catIvaRateVal = catRow?.ivaRate != null ? Number(catRow.ivaRate) : null

      // Priority: product individual → category → global/default
      const effectiveMarkup = markup != null && markup !== '' ? Number(markup) : (catMarkupVal != null ? catMarkupVal : globalMarkup)
      const effectiveCashDiscount = cashDiscount != null && cashDiscount !== '' ? Number(cashDiscount) : (catCashDiscountVal != null ? catCashDiscountVal : globalCashDiscount)
      let effectiveIvaRate = ivaRate != null && ivaRate !== '' ? Number(ivaRate) : (catIvaRateVal != null ? catIvaRateVal : 10.5)

      // SAFEGUARD: Only allow valid IVA rates (10.5 or 21)
      if (isNaN(effectiveIvaRate) || ![10.5, 21].includes(effectiveIvaRate)) {
        console.warn(`[PRICE SAFETY] Invalid ivaRate ${ivaRate} for new product, defaulting to 10.5%`)
        effectiveIvaRate = 10.5
      }

      // costUSD × (1+IVA) × (1+markup) × dollarRate
      finalPrice = Math.ceil(Number(costPrice) * (1 + effectiveIvaRate / 100) * (1 + effectiveMarkup / 100) * dollar.rate)
      finalComparePrice = Math.ceil(Number(costPrice) * (1 + effectiveIvaRate / 100) * (1 + (effectiveMarkup - effectiveCashDiscount) / 100) * dollar.rate)
    } else {
      // Manual pricing
      finalPrice = Number(price)
      finalComparePrice = comparePrice ? Number(comparePrice) : null
    }

    await db.execute({
      sql: `INSERT INTO products (id, name, slug, description, price, comparePrice, costPrice, markup, cashDiscount, ivaRate, salePrice, saleStart, saleEnd, sku, stock, isActive, isFeatured, images, specs, providerId, providerSku, categoryId, createdAt, updatedAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, name, finalSlug, description || null,
        finalPrice, finalComparePrice,
        hasCostPrice ? Number(costPrice) : null,
        markup != null && markup !== '' ? Number(markup) : null,
        cashDiscount != null && cashDiscount !== '' ? Number(cashDiscount) : null,
        ivaRate != null && ivaRate !== '' ? Number(ivaRate) : null,
        salePrice ? Number(salePrice) : null,
        saleStart || null,
        saleEnd || null,
        sku || null,
        stock !== undefined ? Number(stock) : 0,
        isActive !== undefined ? (isActive ? 1 : 0) : 1,
        isFeatured !== undefined ? (isFeatured ? 1 : 0) : 0,
        images || '[]', specs || '{}',
        resolvedProviderId, providerSku || null,
        categoryId || null, now, now,
      ],
    })

    // Invalidate dollar cache so next GET fetches fresh rate
    cachedDollarRate = { rate: 0, fetchedAt: 0 }

    // Sesión 43 día 2: invalidar cache de products para que el nuevo producto
    // aparezca instantáneamente en home, categorías, etc.
    try { revalidateTag('products', 'default') } catch (e) { /* revalidateTag puede fallar si se llama fuera de request scope */ }

    return NextResponse.json({ ok: true, product: { id, slug: finalSlug } })
  } catch (error: any) {
    console.error('Create product error:', error)
    if (error?.message?.includes('UNIQUE constraint failed: products.sku')) {
      return NextResponse.json({ error: 'Ya existe un producto con ese SKU. Usá un SKU diferente o dejalo vacío.' }, { status: 400 })
    }
    if (error?.message?.includes('UNIQUE constraint failed: products.slug')) {
      return NextResponse.json({ error: 'Ya existe un producto con ese nombre. Usá un nombre diferente.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error del servidor', detail: error?.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id, name, description, price, comparePrice, costPrice, sku, stock,
      isActive, isFeatured, images, specs, providerId, providerSku, categoryId,
      markup, cashDiscount, ivaRate, salePrice, saleStart, saleEnd, brandId } = body

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    // Resolve providerId: if it's a supplier name instead of UUID, auto-resolve it
    const resolvedProviderId = providerId !== undefined ? await resolveProviderId(providerId) : undefined

    const now = new Date().toISOString()

    // Determine if we need to recalculate prices
    // Recalculate when: costPrice is set OR markup/cashDiscount changed on a product with costPrice
    const hasCostPrice = costPrice && Number(costPrice) > 0
    const markupChanged = markup !== undefined
    const discountChanged = cashDiscount !== undefined
    const needRecalc = hasCostPrice || markupChanged || discountChanged

    let finalPrice: number | undefined = price !== undefined ? Number(price) : undefined
    let finalComparePrice: number | null | undefined = comparePrice !== undefined ? (comparePrice ? Number(comparePrice) : null) : undefined

    if (needRecalc) {
      // Get the product's current costPrice and categoryId if not provided in this request
      let effectiveCostPrice = hasCostPrice ? Number(costPrice) : 0
      let effectiveCategoryId = categoryId || null
      
      if (!hasCostPrice && (markupChanged || discountChanged)) {
        // Fetch current costPrice and categoryId from DB since they weren't sent
        const currentProduct = await db.execute({
          sql: 'SELECT costPrice, markup, cashDiscount, categoryId FROM products WHERE id = ?',
          args: [id],
        })
        const rows = currentProduct.rows as any[]
        if (rows.length > 0 && rows[0].costPrice && Number(rows[0].costPrice) > 0) {
          effectiveCostPrice = Number(rows[0].costPrice)
          if (!effectiveCategoryId) effectiveCategoryId = rows[0].categoryId
        }
      }

      if (effectiveCostPrice > 0) {
        // Auto-calculate from USD cost + dollar rate + markup
        // 3-tier priority: product → category → global
        const [dollar, globalMarkup, globalCashDiscount, catMarkupResult] = await Promise.all([
          fetchDollarRate(),
          getConfig('markup', 30),
          getConfig('cash_discount', 10),
          effectiveCategoryId ? db.execute({ sql: 'SELECT markup, cashDiscount, ivaRate FROM categories WHERE id = ?', args: [effectiveCategoryId] }) : null,
        ])

        // Get category markup if available
        const catRow = catMarkupResult ? (catMarkupResult.rows as any[])[0] : null
        const catMarkupVal = catRow?.markup != null ? Number(catRow.markup) : null
        const catCashDiscountVal = catRow?.cashDiscount != null ? Number(catRow.cashDiscount) : null
        const catIvaRateVal = catRow?.ivaRate != null ? Number(catRow.ivaRate) : null

        // Determine effective markup: product individual → category → global
        let effectiveMarkup = globalMarkup
        if (markup != null && markup !== '') {
          effectiveMarkup = Number(markup)
        } else if (markup === null || markup === '') {
          // User cleared the individual markup, use category → global
          effectiveMarkup = catMarkupVal != null ? catMarkupVal : globalMarkup
        } else if (markup === undefined) {
          // markup not sent in request - check if product has individual value
          if (hasCostPrice) {
            // New costPrice being set, use category → global unless markup was provided
            effectiveMarkup = catMarkupVal != null ? catMarkupVal : globalMarkup
          }
        }

        // Determine effective cashDiscount: product individual → category → global
        let effectiveCashDiscount = globalCashDiscount
        if (cashDiscount != null && cashDiscount !== '') {
          effectiveCashDiscount = Number(cashDiscount)
        } else if (cashDiscount === null || cashDiscount === '') {
          effectiveCashDiscount = catCashDiscountVal != null ? catCashDiscountVal : globalCashDiscount
        }

        const dollarRate = dollar?.rate || 1415
        let effectiveIvaRate = ivaRate != null && ivaRate !== '' ? Number(ivaRate) : (catIvaRateVal != null ? catIvaRateVal : 10.5)

        // SAFEGUARD: Only allow valid IVA rates (10.5 or 21)
        if (isNaN(effectiveIvaRate) || ![10.5, 21].includes(effectiveIvaRate)) {
          console.warn(`[PRICE SAFETY] Invalid ivaRate ${ivaRate} for product ${id}, defaulting to 10.5%`)
          effectiveIvaRate = 10.5
        }

        finalPrice = Math.ceil(effectiveCostPrice * dollarRate * (1 + effectiveMarkup / 100) * (1 + effectiveIvaRate / 100))
        finalComparePrice = Math.ceil(effectiveCostPrice * dollarRate * (1 + (effectiveMarkup - effectiveCashDiscount) / 100) * (1 + effectiveIvaRate / 100))
      }
    }

    const fields: string[] = []
    const values: any[] = []

    if (name !== undefined) { fields.push('name = ?'); values.push(name) }
    if (description !== undefined) { fields.push('description = ?'); values.push(description) }
    if (finalPrice !== undefined) { fields.push('price = ?'); values.push(finalPrice) }
    if (finalComparePrice !== undefined) { fields.push('comparePrice = ?'); values.push(finalComparePrice) }
    if (costPrice !== undefined) { fields.push('costPrice = ?'); values.push(hasCostPrice ? Number(costPrice) : null) }
    if (sku !== undefined) { fields.push('sku = ?'); values.push(sku) }
    if (stock !== undefined) { fields.push('stock = ?'); values.push(Number(stock)) }
    if (isActive !== undefined) { fields.push('isActive = ?'); values.push(isActive ? 1 : 0) }
    if (isFeatured !== undefined) { fields.push('isFeatured = ?'); values.push(isFeatured ? 1 : 0) }
    if (images !== undefined) {
      // Safety check: if images is empty and product had images, PRESERVE existing images
      // This prevents accidental image loss when admin edits a product without touching images
      // To explicitly clear images, the client must send clearImages: true
      if (images === '[]') {
        const currentImages = await db.execute({
          sql: 'SELECT images FROM products WHERE id = ?',
          args: [id],
        })
        const currentRow = (currentImages.rows as any[])[0]
        if (currentRow?.images && currentRow.images !== '[]' && currentRow.images !== 'null') {
          // Check if client explicitly wants to clear images
          if (body.clearImages === true) {
            console.warn(`[products PUT] Product ${id}: images EXPLICITLY cleared (was: ${currentRow.images?.substring(0, 100)}...)`)
            fields.push('images = ?'); values.push(images)
          } else {
            // Preserve existing images - don't include images in the update
            console.warn(`[products PUT] Product ${id}: images would be cleared but PRESERVED (was: ${currentRow.images?.substring(0, 100)}...). Send clearImages: true to explicitly remove.`)
          }
        } else {
          // Product already has no images, safe to set
          fields.push('images = ?'); values.push(images)
        }
      } else {
        // Non-empty images array - always update
        fields.push('images = ?'); values.push(images)
      }
    }
    if (specs !== undefined) { fields.push('specs = ?'); values.push(specs) }
    if (providerId !== undefined) { fields.push('providerId = ?'); values.push(resolvedProviderId) }
    if (providerSku !== undefined) { fields.push('providerSku = ?'); values.push(providerSku) }
    if (categoryId !== undefined) { fields.push('categoryId = ?'); values.push(categoryId) }
    if (markup !== undefined) { fields.push('markup = ?'); values.push(markup != null && markup !== '' ? Number(markup) : null) }
    if (cashDiscount !== undefined) { fields.push('cashDiscount = ?'); values.push(cashDiscount != null && cashDiscount !== '' ? Number(cashDiscount) : null) }
    if (ivaRate !== undefined) {
      if (ivaRate != null && ivaRate !== '') {
        const parsedIva = Number(ivaRate)
        // SAFEGUARD: Only store valid IVA rates in the database
        const safeIva = (isNaN(parsedIva) || ![10.5, 21].includes(parsedIva)) ? null : parsedIva
        fields.push('ivaRate = ?'); values.push(safeIva)
      } else {
        // null/empty = inherit from category
        fields.push('ivaRate = ?'); values.push(null)
      }
    }
    if (salePrice !== undefined) { fields.push('salePrice = ?'); values.push(salePrice ? Number(salePrice) : null) }
    if (saleStart !== undefined) { fields.push('saleStart = ?'); values.push(saleStart || null) }
    if (saleEnd !== undefined) { fields.push('saleEnd = ?'); values.push(saleEnd || null) }
    if (brandId !== undefined) { fields.push('brandId = ?'); values.push(brandId || null) }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    fields.push('updatedAt = ?')
    values.push(now)
    values.push(id)

    console.log('[products PUT] Updating product', id, 'fields:', fields.join(', '))
    await db.execute({
      sql: `UPDATE products SET ${fields.join(', ')} WHERE id = ?`,
      args: values,
    })

    // Invalidate dollar cache so next GET fetches fresh rate
    cachedDollarRate = { rate: 0, fetchedAt: 0 }

    // Sesión 43 día 2: invalidar cache de products para que los cambios se
    // vean instantáneamente en home, categorías, detalle, etc.
    try { revalidateTag('products', 'default') } catch (e) { /* revalidateTag puede fallar si se llama fuera de request scope */ }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Update product error:', error)
    const errorMessage = error?.message || 'Error del servidor'
    return NextResponse.json({ error: 'Error del servidor', detail: errorMessage }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    await db.execute({
      sql: 'DELETE FROM products WHERE id = ?',
      args: [id],
    })

    // Sesión 43 día 2: invalidar cache de products
    try { revalidateTag('products', 'default') } catch (e) { /* revalidateTag puede fallar si se llama fuera de request scope */ }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete product error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
