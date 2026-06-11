import { db } from './db'
import { fetchDollarRate, getStoreConfigNumber, calculateProductPrices, CategoryMarkup } from './dollar'

// ============================================
// CATEGORÍAS
// ============================================

export interface Category {
  id: string
  name: string
  slug: string
  image: string | null
  parentId: string | null
  enabled: number
  order: number
  markup: number | null
  cashDiscount: number | null
  ivaRate: number | null
  createdAt: string
  updatedAt: string
}

export async function getCategories(): Promise<Category[]> {
  try {
    const result = await db.execute('SELECT * FROM categories ORDER BY "order" ASC, name ASC')
    return result.rows as unknown as Category[]
  } catch (error) {
    console.error('getCategories error:', error)
    return []
  }
}

export async function getEnabledCategories(): Promise<Category[]> {
  try {
    const result = await db.execute(
      'SELECT * FROM categories WHERE enabled = 1 ORDER BY "order" ASC, name ASC'
    )
    return result.rows as unknown as Category[]
  } catch (error) {
    console.error('getEnabledCategories error:', error)
    return []
  }
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM categories WHERE slug = ? AND enabled = 1',
    args: [slug],
  })
  const rows = result.rows as unknown as Category[]
  return rows[0] || null
}

// ============================================
// DEDUPLICACIÓN DE PRODUCTOS
// ============================================

/**
 * Normaliza un nombre de producto para agrupar duplicados:
 * - Convierte a minúsculas
 * - Elimina espacios múltiples
 * - Elimina caracteres especiales al final (puntos, comillas)
 */
function normalizeProductName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/['.]+$/, '')
}

/**
 * Deduplica productos por nombre normalizado.
 * Para cada grupo de duplicados:
 * 1. Primero elige el más barato que tenga stock
 * 2. Si ninguno tiene stock, elige el más barato
 */
export function deduplicateProducts<T extends { name: string; costPrice: number | null; stock: number }>(products: T[]): T[] {
  if (products.length <= 1) return products

  const groups = new Map<string, T[]>()

  for (const product of products) {
    const key = normalizeProductName(product.name)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(product)
  }

  const result: T[] = []
  for (const [, group] of groups) {
    if (group.length === 1) {
      result.push(group[0])
      continue
    }

    // Sort: stock > 0 first, then by costPrice ascending
    const sorted = [...group].sort((a, b) => {
      const aHasStock = a.stock > 0 ? 1 : 0
      const bHasStock = b.stock > 0 ? 1 : 0
      if (aHasStock !== bHasStock) return bHasStock - aHasStock // stock first
      const aCost = a.costPrice ?? 0
      const bCost = b.costPrice ?? 0
      return aCost - bCost // cheapest first
    })

    result.push(sorted[0]) // Keep only the best one
  }

  return result
}

// ============================================
// PRODUCTOS
// ============================================

export interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  comparePrice: number | null
  costPrice: number | null
  sku: string | null
  stock: number
  isActive: number
  isFeatured: number
  images: string
  specs: string
  providerId: string | null
  providerSku: string | null
  categoryId: string | null
  brandId: string | null
  ivaRate: number | null
  salePrice: number | null
  saleStart: string | null
  saleEnd: string | null
  createdAt: string
  updatedAt: string
  // Joined
  category?: { id: string; name: string; slug: string } | null
  brandName?: string | null
  // Calculated
  _calculated?: boolean
  _costUsd?: number
}

// Helper: build a map of categoryId -> CategoryMarkup for fast lookup
// Includes parent inheritance: if subcategory has null, inherits from parent
async function getCategoryMarkupMap(): Promise<Map<string, CategoryMarkup>> {
  const catResult = await db.execute('SELECT id, parentId, markup, cashDiscount, ivaRate FROM categories')
  const rawMap = new Map<string, { parentId: string | null; markup: number | null; cashDiscount: number | null; ivaRate: number | null }>()
  for (const row of catResult.rows as any[]) {
    rawMap.set(row.id, {
      parentId: row.parentId,
      markup: row.markup != null ? Number(row.markup) : null,
      cashDiscount: row.cashDiscount != null ? Number(row.cashDiscount) : null,
      ivaRate: row.ivaRate != null ? Number(row.ivaRate) : null,
    })
  }

  // Build resolved map with parent inheritance
  const map = new Map<string, CategoryMarkup>()
  const resolve = (id: string, field: 'markup' | 'cashDiscount' | 'ivaRate'): number | null => {
    const entry = rawMap.get(id)
    if (!entry) return null
    if (entry[field] != null) return entry[field]
    if (entry.parentId) return resolve(entry.parentId, field)
    return null
  }

  for (const [id] of rawMap) {
    map.set(id, {
      markup: resolve(id, 'markup'),
      cashDiscount: resolve(id, 'cashDiscount'),
      ivaRate: resolve(id, 'ivaRate'),
    })
  }
  return map
}

// Helper: enrich products with brandName from brands table
async function enrichWithBrandInfo<T extends { brandId?: string | null }>(products: T[]): Promise<(T & { brandName?: string | null })[]> {
  const brandIds = [...new Set(products.map(p => p.brandId).filter(Boolean))] as string[]
  if (brandIds.length === 0) return products

  const placeholders = brandIds.map(() => '?').join(',')
  const brandResult = await db.execute({
    sql: `SELECT id, name FROM brands WHERE id IN (${placeholders})`,
    args: brandIds,
  })
  const brandMap = new Map<string, string>()
  for (const row of brandResult.rows as any[]) {
    brandMap.set(row.id, row.name)
  }

  return products.map(p => ({
    ...p,
    brandName: p.brandId ? (brandMap.get(p.brandId) ?? null) : null,
  }))
}

export async function getAllActiveProducts(limit = 50): Promise<Product[]> {
  const [result, dollar, markup, cashDiscount, catMarkupMap] = await Promise.all([
    db.execute({
      sql: "SELECT * FROM products WHERE isActive = 1 AND stock > 0 ORDER BY CASE WHEN images IS NOT NULL AND images != '[]' THEN 0 ELSE 1 END, COALESCE(createdAt, updatedAt) DESC LIMIT ?",
      args: [limit],
    }),
    fetchDollarRate(),
    getStoreConfigNumber('markup', 30),
    getStoreConfigNumber('cash_discount', 10),
    getCategoryMarkupMap(),
  ])

  const mapped = (result.rows as any[]).map(p =>
    calculateProductPrices(p, dollar.rate, markup, cashDiscount, p.categoryId ? catMarkupMap.get(p.categoryId) : null)
  ) as Product[]
  return enrichWithBrandInfo(deduplicateProducts(mapped))
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const [result, dollar, markup, cashDiscount, catMarkupMap] = await Promise.all([
    db.execute("SELECT * FROM products WHERE isFeatured = 1 AND isActive = 1 AND stock > 0 ORDER BY CASE WHEN images IS NOT NULL AND images != '[]' THEN 0 ELSE 1 END, COALESCE(createdAt, updatedAt) DESC LIMIT 8"),
    fetchDollarRate(),
    getStoreConfigNumber('markup', 30),
    getStoreConfigNumber('cash_discount', 10),
    getCategoryMarkupMap(),
  ])

  const mapped2 = (result.rows as any[]).map(p =>
    calculateProductPrices(p, dollar.rate, markup, cashDiscount, p.categoryId ? catMarkupMap.get(p.categoryId) : null)
  ) as Product[]
  return enrichWithBrandInfo(deduplicateProducts(mapped2))
}

export async function getProductsByCategory(slug: string): Promise<Product[]> {
  // First, find the category (only enabled)
  const catResult = await db.execute({
    sql: 'SELECT id FROM categories WHERE slug = ? AND enabled = 1',
    args: [slug],
  })
  const catRows = catResult.rows as any[]

  if (catRows.length === 0) {
    return []
  }

  const categoryId = catRows[0].id

  // Get subcategory IDs (only enabled children)
  const subResult = await db.execute({
    sql: 'SELECT id FROM categories WHERE parentId = ? AND enabled = 1',
    args: [categoryId],
  })
  const subIds = (subResult.rows as any[]).map(r => r.id)

  // Build query: products in this category OR any enabled subcategory
  const allIds = [categoryId, ...subIds]
  const placeholders = allIds.map(() => '?').join(',')

  const [result, dollar, markup, cashDiscount, catMarkupMap] = await Promise.all([
    db.execute({
      sql: `SELECT p.* FROM products p
            WHERE p.categoryId IN (${placeholders}) AND p.isActive = 1 AND p.stock > 0
            ORDER BY CASE WHEN p.images IS NOT NULL AND p.images != '[]' THEN 0 ELSE 1 END, COALESCE(p.createdAt, p.updatedAt) DESC`,
      args: allIds,
    }),
    fetchDollarRate(),
    getStoreConfigNumber('markup', 30),
    getStoreConfigNumber('cash_discount', 10),
    getCategoryMarkupMap(),
  ])

  const mapped3 = (result.rows as any[]).map(p =>
    calculateProductPrices(p, dollar.rate, markup, cashDiscount, p.categoryId ? catMarkupMap.get(p.categoryId) : null)
  ) as Product[]
  return enrichWithBrandInfo(deduplicateProducts(mapped3))
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const [result, dollar, markup, cashDiscount, catMarkupMap] = await Promise.all([
    db.execute({
      sql: `SELECT p.*, c.name as categoryName, c.slug as categorySlug, c.markup as categoryMarkup, c.cashDiscount as categoryCashDiscount
            FROM products p
            LEFT JOIN categories c ON p.categoryId = c.id
            WHERE p.slug = ?`,
      args: [slug],
    }),
    fetchDollarRate(),
    getStoreConfigNumber('markup', 30),
    getStoreConfigNumber('cash_discount', 10),
    getCategoryMarkupMap(),
  ])

  const rows = result.rows as any[]
  if (!rows[0]) return null

  const catMarkup: CategoryMarkup | null = rows[0].categoryId
    ? (catMarkupMap.get(rows[0].categoryId) ?? null)
    : null

  const row = calculateProductPrices(rows[0], dollar.rate, markup, cashDiscount, catMarkup)

  return {
    ...row,
    category: row.categoryName ? {
      id: row.categoryId,
      name: row.categoryName,
      slug: row.categorySlug,
    } : null,
  } as Product
}

export async function searchProducts(query: string, limit = 20): Promise<Product[]> {
  const searchTerm = `%${query}%`
  const [result, dollar, markup, cashDiscount, catMarkupMap] = await Promise.all([
    db.execute({
      sql: `SELECT * FROM products
            WHERE isActive = 1 AND stock > 0
            AND (name LIKE ? OR description LIKE ? OR sku LIKE ?)
            ORDER BY CASE WHEN images IS NOT NULL AND images != '[]' THEN 0 ELSE 1 END, CASE WHEN name LIKE ? THEN 0 ELSE 1 END, COALESCE(createdAt, updatedAt) DESC
            LIMIT ?`,
      args: [searchTerm, searchTerm, searchTerm, searchTerm, limit],
    }),
    fetchDollarRate(),
    getStoreConfigNumber('markup', 30),
    getStoreConfigNumber('cash_discount', 10),
    getCategoryMarkupMap(),
  ])

  const mapped4 = (result.rows as any[]).map(p =>
    calculateProductPrices(p, dollar.rate, markup, cashDiscount, p.categoryId ? catMarkupMap.get(p.categoryId) : null)
  ) as Product[]
  return enrichWithBrandInfo(deduplicateProducts(mapped4))
}

export async function getTopProductsByCategorySlug(slug: string, limit = 8): Promise<Product[]> {
  // Find the category and its enabled subcategories
  const catResult = await db.execute({
    sql: 'SELECT id FROM categories WHERE slug = ? AND enabled = 1',
    args: [slug],
  })
  const catRows = catResult.rows as any[]
  if (catRows.length === 0) return []

  const categoryId = catRows[0].id
  const subResult = await db.execute({
    sql: 'SELECT id, slug FROM categories WHERE parentId = ? AND enabled = 1',
    args: [categoryId],
  })
  const subcats = subResult.rows as any[]
  const subIds = subcats.map(r => r.id)
  const allIds = [categoryId, ...subIds]
  const placeholders = allIds.map(() => '?').join(',')

  // If there are subcategories, pick products evenly from each (with images first)
  // This ensures variety (e.g., gamer-pc, oficina-pc, mini-pc all represented)
  if (subcats.length >= 2 && limit <= 8) {
    const perSubcat = Math.ceil(limit / subcats.length)
    const productPromises = subcats.map(sub =>
      db.execute({
        sql: `SELECT p.* FROM products p
              WHERE p.categoryId = ? AND p.isActive = 1 AND p.stock > 0
              ORDER BY CASE WHEN p.images IS NOT NULL AND p.images != '[]' THEN 0 ELSE 1 END, p.price DESC LIMIT ?`,
        args: [sub.id, perSubcat],
      })
    )

    const [results, dollar, markup, cashDiscount, catMarkupMap] = await Promise.all([
      Promise.all(productPromises),
      fetchDollarRate(),
      getStoreConfigNumber('markup', 30),
      getStoreConfigNumber('cash_discount', 10),
      getCategoryMarkupMap(),
    ])

    // Interleave: take 1 from each subcat in round-robin, prioritizing those with images
    const pools = results.map(r => (r.rows as any[]))
    const selected: any[] = []
    const usedIds = new Set<string>()
    let round = 0

    while (selected.length < limit && round < 20) {
      for (const pool of pools) {
        if (selected.length >= limit) break
        // Find next unused product in this pool
        const product = pool.find(p => !usedIds.has(p.id))
        if (product) {
          usedIds.add(product.id)
          selected.push(product)
        }
      }
      round++
    }

    return deduplicateProducts(selected.map(p =>
      calculateProductPrices(p, dollar.rate, markup, cashDiscount, p.categoryId ? catMarkupMap.get(p.categoryId) : null)
    ) as Product[])
  }

  // Fallback: single category, just sort by images first then price
  const [result, dollar, markup, cashDiscount, catMarkupMap] = await Promise.all([
    db.execute({
      sql: `SELECT p.* FROM products p
            WHERE p.categoryId IN (${placeholders}) AND p.isActive = 1 AND p.stock > 0
            ORDER BY CASE WHEN p.images IS NOT NULL AND p.images != '[]' THEN 0 ELSE 1 END, p.price DESC LIMIT ?`,
      args: [...allIds, limit],
    }),
    fetchDollarRate(),
    getStoreConfigNumber('markup', 30),
    getStoreConfigNumber('cash_discount', 10),
    getCategoryMarkupMap(),
  ])

  const mapped5 = (result.rows as any[]).map(p =>
    calculateProductPrices(p, dollar.rate, markup, cashDiscount, p.categoryId ? catMarkupMap.get(p.categoryId) : null)
  ) as Product[]
  return enrichWithBrandInfo(deduplicateProducts(mapped5))
}

// ============================================
// DÓLAR
// ============================================

export async function getDollarRate(): Promise<number> {
  const dollar = await fetchDollarRate()
  return dollar.rate
}

// ============================================
// CONFIG TIENDA
// ============================================

export async function getStoreConfig(key: string): Promise<string | null> {
  const result = await db.execute({
    sql: 'SELECT value FROM store_config WHERE key = ?',
    args: [key],
  })
  const rows = result.rows as any[]
  return rows[0]?.value ?? null
}
