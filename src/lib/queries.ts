import { db } from './db'
import { fetchDollarRate, getStoreConfigNumber, calculateProductPrices } from './dollar'

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
  createdAt: string
  updatedAt: string
  // Joined
  category?: { id: string; name: string; slug: string } | null
  // Calculated
  _calculated?: boolean
  _costUsd?: number
}

export async function getAllActiveProducts(limit = 50): Promise<Product[]> {
  const [result, dollar, markup, cashDiscount] = await Promise.all([
    db.execute({
      sql: 'SELECT * FROM products WHERE isActive = 1 ORDER BY createdAt DESC LIMIT ?',
      args: [limit],
    }),
    fetchDollarRate(),
    getStoreConfigNumber('markup', 30),
    getStoreConfigNumber('cash_discount', 10),
  ])

  return (result.rows as any[]).map(p =>
    calculateProductPrices(p, dollar.rate, markup, cashDiscount)
  ) as Product[]
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const [result, dollar, markup, cashDiscount] = await Promise.all([
    db.execute("SELECT * FROM products WHERE isFeatured = 1 AND isActive = 1 ORDER BY createdAt DESC LIMIT 8"),
    fetchDollarRate(),
    getStoreConfigNumber('markup', 30),
    getStoreConfigNumber('cash_discount', 10),
  ])

  return (result.rows as any[]).map(p =>
    calculateProductPrices(p, dollar.rate, markup, cashDiscount)
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

  const [result, dollar, markup, cashDiscount] = await Promise.all([
    db.execute({
      sql: `SELECT p.* FROM products p
            WHERE p.categoryId IN (${placeholders}) AND p.isActive = 1
            ORDER BY p.createdAt DESC`,
      args: allIds,
    }),
    fetchDollarRate(),
    getStoreConfigNumber('markup', 30),
    getStoreConfigNumber('cash_discount', 10),
  ])

  return (result.rows as any[]).map(p =>
    calculateProductPrices(p, dollar.rate, markup, cashDiscount)
  ) as Product[]
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const [result, dollar, markup, cashDiscount] = await Promise.all([
    db.execute({
      sql: `SELECT p.*, c.name as categoryName, c.slug as categorySlug
            FROM products p
            LEFT JOIN categories c ON p.categoryId = c.id
            WHERE p.slug = ?`,
      args: [slug],
    }),
    fetchDollarRate(),
    getStoreConfigNumber('markup', 30),
    getStoreConfigNumber('cash_discount', 10),
  ])

  const rows = result.rows as any[]
  if (!rows[0]) return null

  const row = calculateProductPrices(rows[0], dollar.rate, markup, cashDiscount)

  return {
    ...row,
    category: row.categoryName ? {
      id: row.categoryId,
      name: row.categoryName,
      slug: row.categorySlug,
    } : null,
  } as Product
}

export async function searchProducts(query: string): Promise<Product[]> {
  const searchTerm = `%${query}%`
  const [result, dollar, markup, cashDiscount] = await Promise.all([
    db.execute({
      sql: `SELECT * FROM products
            WHERE isActive = 1
            AND (name LIKE ? OR description LIKE ? OR sku LIKE ?)
            LIMIT 20`,
      args: [searchTerm, searchTerm, searchTerm],
    }),
    fetchDollarRate(),
    getStoreConfigNumber('markup', 30),
    getStoreConfigNumber('cash_discount', 10),
  ])

  return (result.rows as any[]).map(p =>
    calculateProductPrices(p, dollar.rate, markup, cashDiscount)
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
    sql: 'SELECT id FROM categories WHERE parentId = ? AND enabled = 1',
    args: [categoryId],
  })
  const subIds = (subResult.rows as any[]).map(r => r.id)
  const allIds = [categoryId, ...subIds]
  const placeholders = allIds.map(() => '?').join(',')

  const [result, dollar, markup, cashDiscount] = await Promise.all([
    db.execute({
      sql: `SELECT p.* FROM products p
            WHERE p.categoryId IN (${placeholders}) AND p.isActive = 1
            ORDER BY p.price DESC LIMIT ?`,
      args: [...allIds, limit],
    }),
    fetchDollarRate(),
    getStoreConfigNumber('markup', 30),
    getStoreConfigNumber('cash_discount', 10),
  ])

  return (result.rows as any[]).map(p =>
    calculateProductPrices(p, dollar.rate, markup, cashDiscount)
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
