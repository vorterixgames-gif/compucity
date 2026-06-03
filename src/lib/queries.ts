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
  ivaRate: number | null
  salePrice: number | null
  saleStart: string | null
  saleEnd: string | null
  createdAt: string
  updatedAt: string
  // Joined
  category?: { id: string; name: string; slug: string } | null
  // Calculated
  _calculated?: boolean
  _costUsd?: number
}

// Helper: build a map of categoryId -> CategoryMarkup for fast lookup
async function getCategoryMarkupMap(): Promise<Map<string, CategoryMarkup>> {
  const catResult = await db.execute('SELECT id, markup, cashDiscount FROM categories')
  const map = new Map<string, CategoryMarkup>()
  for (const row of catResult.rows as any[]) {
    map.set(row.id, {
      markup: row.markup != null ? Number(row.markup) : null,
      cashDiscount: row.cashDiscount != null ? Number(row.cashDiscount) : null,
    })
  }
  return map
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

  return (result.rows as any[]).map(p =>
    calculateProductPrices(p, dollar.rate, markup, cashDiscount, p.categoryId ? catMarkupMap.get(p.categoryId) : null)
  ) as Product[]
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const [result, dollar, markup, cashDiscount, catMarkupMap] = await Promise.all([
    db.execute("SELECT * FROM products WHERE isFeatured = 1 AND isActive = 1 AND stock > 0 ORDER BY CASE WHEN images IS NOT NULL AND images != '[]' THEN 0 ELSE 1 END, COALESCE(createdAt, updatedAt) DESC LIMIT 8"),
    fetchDollarRate(),
    getStoreConfigNumber('markup', 30),
    getStoreConfigNumber('cash_discount', 10),
    getCategoryMarkupMap(),
  ])

  return (result.rows as any[]).map(p =>
    calculateProductPrices(p, dollar.rate, markup, cashDiscount, p.categoryId ? catMarkupMap.get(p.categoryId) : null)
  ) as Product[]
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

  return (result.rows as any[]).map(p =>
    calculateProductPrices(p, dollar.rate, markup, cashDiscount, p.categoryId ? catMarkupMap.get(p.categoryId) : null)
  ) as Product[]
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

  return (result.rows as any[]).map(p =>
    calculateProductPrices(p, dollar.rate, markup, cashDiscount, p.categoryId ? catMarkupMap.get(p.categoryId) : null)
  ) as Product[]
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

    return selected.map(p =>
      calculateProductPrices(p, dollar.rate, markup, cashDiscount, p.categoryId ? catMarkupMap.get(p.categoryId) : null)
    ) as Product[]
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

  return (result.rows as any[]).map(p =>
    calculateProductPrices(p, dollar.rate, markup, cashDiscount, p.categoryId ? catMarkupMap.get(p.categoryId) : null)
  ) as Product[]
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
