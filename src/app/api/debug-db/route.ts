import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Debug: check if 'currency' column exists in products table
export async function GET() {
  try {
    const results: Record<string, any> = {}

    // Test: SELECT with currency column
    try {
      const res = await db.execute({
        sql: "SELECT id, name, currency FROM products WHERE isActive = 1 AND stock > 0 AND name LIKE ? LIMIT 3",
        args: ['%notebook%'],
      })
      results.withCurrencyCount = res.rows.length
      results.withCurrencySample = (res.rows as any[]).map(r => ({ name: r.name, currency: r.currency }))
    } catch (e: any) {
      results.withCurrencyError = e.message
    }

    // Test: SELECT without currency column  
    try {
      const res = await db.execute({
        sql: "SELECT id, name FROM products WHERE isActive = 1 AND stock > 0 AND name LIKE ? LIMIT 3",
        args: ['%notebook%'],
      })
      results.withoutCurrencyCount = res.rows.length
      results.withoutCurrencySample = (res.rows as any[]).map(r => r.name)
    } catch (e: any) {
      results.withoutCurrencyError = e.message
    }

    // Test: PRAGMA table_info for products
    try {
      const info = await db.execute("PRAGMA table_info(products)")
      results.columns = (info.rows as any[]).map(r => r.name)
      results.hasCurrency = results.columns.includes('currency')
    } catch (e: any) {
      results.pragmaError = e.message
    }

    // Test: The EXACT query from searchProducts
    try {
      const selectCols = `id, name, slug, price, comparePrice, costPrice, currency, images,
                          categoryId, brandId, isActive, stock, markup, cashDiscount, ivaRate,
                          internalTaxRate, salePrice, saleStart, saleEnd, sku, providerId`
      const res = await db.execute({
        sql: `SELECT ${selectCols} FROM products
              WHERE isActive = 1 AND stock > 0 AND name LIKE ?
              ORDER BY COALESCE(createdAt, updatedAt) DESC LIMIT ?`,
        args: ['notebook%', 20],
      })
      results.exactSearchQueryCount = res.rows.length
    } catch (e: any) {
      results.exactSearchQueryError = e.message
    }

    return NextResponse.json({ ok: true, diagnostics: results })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
