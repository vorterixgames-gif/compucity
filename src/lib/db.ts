import { createClient, type Client } from '@libsql/client/web'

const globalForDb = globalThis as unknown as {
  turso: Client | undefined
  migrationRan: boolean | undefined
}

function createTursoClient() {
  const url = process.env.DATABASE_URL || ''
  
  if (url.startsWith('libsql://') || url.startsWith('https://') || url.startsWith('http://')) {
    return createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }
  
  // Fallback: use Turso URL if no valid URL configured
  const fallbackUrl = 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io'
  console.warn(`[db] DATABASE_URL "${url}" not supported, falling back to Turso`)
  return createClient({
    url: fallbackUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })
}

export const db = globalForDb.turso ?? createTursoClient()

if (process.env.NODE_ENV !== 'production') globalForDb.turso = db

/**
 * Auto-migrate: ensure all required columns exist.
 * Runs once per process lifetime (cached in globalThis).
 */
export async function ensureMigrations() {
  if (globalForDb.migrationRan) return
  globalForDb.migrationRan = true

  // 1. Add shippingDetails column to orders
  try {
    await db.execute({ sql: 'SELECT shippingDetails FROM orders LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({ sql: 'ALTER TABLE orders ADD COLUMN shippingDetails TEXT', args: [] })
      console.log('[migration] Added shippingDetails column to orders')
    } catch (e) {
      console.warn('[migration] Could not add shippingDetails:', e)
    }
  }

  // 2. Add customerId column to orders
  try {
    await db.execute({ sql: 'SELECT customerId FROM orders LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({ sql: 'ALTER TABLE orders ADD COLUMN customerId TEXT', args: [] })
      console.log('[migration] Added customerId column to orders')
    } catch (e) {
      console.warn('[migration] Could not add customerId:', e)
    }
  }

  // 3. Ensure customers table exists
  try {
    await db.execute({ sql: 'SELECT id FROM customers LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({
        sql: `CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          phone TEXT,
          password TEXT NOT NULL,
          dni TEXT,
          address TEXT,
          city TEXT,
          province TEXT,
          postalCode TEXT,
          createdAt TEXT DEFAULT (datetime('now')),
          updatedAt TEXT DEFAULT (datetime('now'))
        )`,
        args: [],
      })
      console.log('[migration] Created customers table')
    } catch (e) {
      console.warn('[migration] Could not create customers table:', e)
    }
  }

  // 4. Ensure suppliers table exists
  try {
    await db.execute({ sql: 'SELECT id FROM suppliers LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({
        sql: `CREATE TABLE IF NOT EXISTS suppliers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          contactName TEXT,
          contactEmail TEXT,
          contactPhone TEXT,
          website TEXT,
          apiType TEXT,
          apiBaseUrl TEXT,
          apiUserId TEXT,
          apiToken TEXT,
          apiUsername TEXT,
          apiPassword TEXT,
          markup INTEGER DEFAULT 30,
          currency TEXT,
          isActive INTEGER DEFAULT 1,
          lastSyncAt TEXT,
          notes TEXT,
          createdAt TEXT,
          updatedAt TEXT
        )`,
        args: [],
      })
      console.log('[migration] Created suppliers table')
    } catch (e) {
      console.warn('[migration] Could not create suppliers table:', e)
    }
  }

  // 5. Add allowedCategories column to suppliers (JSON array of category slugs)
  try {
    await db.execute({ sql: 'SELECT allowedCategories FROM suppliers LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({ sql: 'ALTER TABLE suppliers ADD COLUMN allowedCategories TEXT' })
      console.log('[migration] Added allowedCategories column to suppliers')
    } catch (e) {
      console.warn('[migration] Could not add allowedCategories:', e)
    }
  }

  // 5b. Add supplierCategory column to products
  try {
    await db.execute({ sql: 'SELECT supplierCategory FROM products LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({ sql: 'ALTER TABLE products ADD COLUMN supplierCategory TEXT' })
      console.log('[migration] Added supplierCategory column to products')
    } catch (e) {
      console.warn('[migration] Could not add supplierCategory:', e)
    }
  }

  // 6. Ensure new subcategories exist (Tablets, Smart Home, Hogar Inteligente)
  try {
    const existingSlugs = ['tablets', 'smart-home', 'hogar-inteligente']
    for (const slug of existingSlugs) {
      const check = await db.execute({ sql: 'SELECT id FROM categories WHERE slug = ?', args: [slug] })
      if ((check.rows as any[]).length === 0) {
        // Determine parent ID based on slug
        let parentId = 'cat1' // Notebooks for tablets
        let name = 'Tablets'
        if (slug === 'smart-home') { parentId = 'cat5'; name = 'Smart Home' }
        if (slug === 'hogar-inteligente') { parentId = 'cat5'; name = 'Hogar Inteligente' }
        const id = crypto.randomUUID()
        await db.execute({
          sql: 'INSERT INTO categories (id, name, slug, parentId) VALUES (?, ?, ?, ?)',
          args: [id, name, slug, parentId],
        })
        console.log(`[migration] Created subcategory: ${name} (${slug})`)
      }
    }
  } catch (e) {
    console.warn('[migration] Could not create subcategories:', e)
  }

  // 7. Add markup column to products (individual product markup, null = use global)
  try {
    await db.execute({ sql: 'SELECT markup FROM products LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({ sql: 'ALTER TABLE products ADD COLUMN markup INTEGER' })
      console.log('[migration] Added markup column to products')
    } catch (e) {
      console.warn('[migration] Could not add markup column:', e)
    }
  }

  // 8. Add cashDiscount column to products (individual product cash discount, null = use global)
  try {
    await db.execute({ sql: 'SELECT cashDiscount FROM products LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({ sql: 'ALTER TABLE products ADD COLUMN cashDiscount INTEGER' })
      console.log('[migration] Added cashDiscount column to products')
    } catch (e) {
      console.warn('[migration] Could not add cashDiscount column:', e)
    }
  }

  // 9. Ensure supplier_category_mappings table exists
  try {
    await db.execute({ sql: 'SELECT id FROM supplier_category_mappings LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({
        sql: `CREATE TABLE IF NOT EXISTS supplier_category_mappings (
          id TEXT PRIMARY KEY,
          supplierId TEXT NOT NULL,
          supplierCategory TEXT NOT NULL,
          storeCategoryId TEXT NOT NULL,
          createdAt TEXT,
          updatedAt TEXT
        )`,
        args: [],
      })
      console.log('[migration] Created supplier_category_mappings table')
    } catch (e) {
      console.warn('[migration] Could not create supplier_category_mappings table:', e)
    }
  }

  // 10. Add ivaRate column to products (IVA percentage, default 10.5)
  try {
    await db.execute({ sql: 'SELECT ivaRate FROM products LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({ sql: 'ALTER TABLE products ADD COLUMN ivaRate REAL DEFAULT 10.5' })
      console.log('[migration] Added ivaRate column to products (default 10.5%)')
    } catch (e) {
      console.warn('[migration] Could not add ivaRate column:', e)
    }
  }

  // 11. Add salePrice column to products
  try {
    await db.execute({ sql: 'SELECT salePrice FROM products LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({ sql: 'ALTER TABLE products ADD COLUMN salePrice REAL' })
      console.log('[migration] Added salePrice column to products')
    } catch (e) {
      console.warn('[migration] Could not add salePrice column:', e)
    }
  }

  // 12. Add saleStart column to products
  try {
    await db.execute({ sql: 'SELECT saleStart FROM products LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({ sql: 'ALTER TABLE products ADD COLUMN saleStart TEXT' })
      console.log('[migration] Added saleStart column to products')
    } catch (e) {
      console.warn('[migration] Could not add saleStart column:', e)
    }
  }

  // 13. Add saleEnd column to products
  try {
    await db.execute({ sql: 'SELECT saleEnd FROM products LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({ sql: 'ALTER TABLE products ADD COLUMN saleEnd TEXT' })
      console.log('[migration] Added saleEnd column to products')
    } catch (e) {
      console.warn('[migration] Could not add saleEnd column:', e)
    }
  }

  // 14. Ensure coupons table exists
  try {
    await db.execute({ sql: 'SELECT id FROM coupons LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({
        sql: `CREATE TABLE IF NOT EXISTS coupons (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL UNIQUE,
          description TEXT,
          discountType TEXT NOT NULL DEFAULT 'percentage',
          discountValue REAL NOT NULL,
          minPurchase REAL DEFAULT 0,
          maxUses INTEGER DEFAULT 0,
          usedCount INTEGER DEFAULT 0,
          validFrom TEXT,
          validUntil TEXT,
          isActive INTEGER DEFAULT 1,
          createdAt TEXT DEFAULT (datetime('now')),
          updatedAt TEXT DEFAULT (datetime('now'))
        )`,
        args: [],
      })
      console.log('[migration] Created coupons table')
    } catch (e) {
      console.warn('[migration] Could not create coupons table:', e)
    }
  }

  // 15. Ensure banners table exists
  try {
    await db.execute({ sql: 'SELECT id FROM banners LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({
        sql: `CREATE TABLE IF NOT EXISTS banners (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          subtitle TEXT,
          buttonText TEXT,
          buttonLink TEXT,
          bgColor TEXT DEFAULT '#3A8B68',
          textColor TEXT DEFAULT '#FFFFFF',
          position TEXT DEFAULT 'top',
          isActive INTEGER DEFAULT 1,
          "order" INTEGER DEFAULT 0,
          createdAt TEXT DEFAULT (datetime('now')),
          updatedAt TEXT DEFAULT (datetime('now'))
        )`,
        args: [],
      })
      console.log('[migration] Created banners table')
    } catch (e) {
      console.warn('[migration] Could not create banners table:', e)
    }
  }

  // 16. Add couponCode column to orders
  try {
    await db.execute({ sql: 'SELECT couponCode FROM orders LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({ sql: 'ALTER TABLE orders ADD COLUMN couponCode TEXT' })
      console.log('[migration] Added couponCode column to orders')
    } catch (e) {
      console.warn('[migration] Could not add couponCode:', e)
    }
  }

  // 17. Add couponDiscount column to orders
  try {
    await db.execute({ sql: 'SELECT couponDiscount FROM orders LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({ sql: 'ALTER TABLE orders ADD COLUMN couponDiscount REAL DEFAULT 0' })
      console.log('[migration] Added couponDiscount column to orders')
    } catch (e) {
      console.warn('[migration] Could not add couponDiscount:', e)
    }
  }

  // 18. Add imageUrl column to banners
  try {
    await db.execute({ sql: 'SELECT imageUrl FROM banners LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({ sql: 'ALTER TABLE banners ADD COLUMN imageUrl TEXT' })
      console.log('[migration] Added imageUrl column to banners')
    } catch (e) {
      console.warn('[migration] Could not add imageUrl to banners:', e)
    }
  }

  // 19. Add markup column to categories (category-level markup, null = use global)
  try {
    await db.execute({ sql: 'SELECT markup FROM categories LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({ sql: 'ALTER TABLE categories ADD COLUMN markup INTEGER' })
      console.log('[migration] Added markup column to categories')
    } catch (e) {
      console.warn('[migration] Could not add markup column to categories:', e)
    }
  }

  // 20. Add cashDiscount column to categories (category-level cash discount, null = use global)
  try {
    await db.execute({ sql: 'SELECT cashDiscount FROM categories LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({ sql: 'ALTER TABLE categories ADD COLUMN cashDiscount INTEGER' })
      console.log('[migration] Added cashDiscount column to categories')
    } catch (e) {
      console.warn('[migration] Could not add cashDiscount column to categories:', e)
    }
  }

  // 21. Add ivaRate column to categories (category-level IVA, null = use default 10.5%)
  try {
    await db.execute({ sql: 'SELECT ivaRate FROM categories LIMIT 1', args: [] })
  } catch {
    try {
      await db.execute({ sql: 'ALTER TABLE categories ADD COLUMN ivaRate REAL' })
      console.log('[migration] Added ivaRate column to categories')
    } catch (e) {
      console.warn('[migration] Could not add ivaRate column to categories:', e)
    }
  }
}
