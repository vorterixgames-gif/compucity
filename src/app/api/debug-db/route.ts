import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Public diagnostic endpoint - will be removed after debugging
export async function GET() {
  try {
    const results: Record<string, any> = {}

    // Test 1: Simple count
    try {
      const countRes = await db.execute('SELECT COUNT(*) as count FROM products')
      results.totalProducts = (countRes.rows as any[])[0]?.count
    } catch (e: any) {
      results.countError = e.message
    }

    // Test 2: Active + stock count
    try {
      const activeRes = await db.execute('SELECT COUNT(*) as count FROM products WHERE isActive = 1 AND stock > 0')
      results.activeWithStock = (activeRes.rows as any[])[0]?.count
    } catch (e: any) {
      results.activeError = e.message
    }

    // Test 3: LIKE prefix search
    try {
      const prefixRes = await db.execute({
        sql: "SELECT id, name FROM products WHERE isActive = 1 AND stock > 0 AND name LIKE ? LIMIT 5",
        args: ['notebook%'],
      })
      results.prefixSearchCount = prefixRes.rows.length
      results.prefixSearchSample = (prefixRes.rows as any[]).map(r => r.name)
    } catch (e: any) {
      results.prefixError = e.message
    }

    // Test 4: LIKE anywhere search
    try {
      const anyRes = await db.execute({
        sql: "SELECT id, name FROM products WHERE isActive = 1 AND stock > 0 AND name LIKE ? LIMIT 5",
        args: ['%notebook%'],
      })
      results.anySearchCount = anyRes.rows.length
      results.anySearchSample = (anyRes.rows as any[]).map(r => r.name)
    } catch (e: any) {
      results.anyError = e.message
    }

    // Test 5: Sample active products
    try {
      const sampleRes = await db.execute({
        sql: 'SELECT id, name, isActive, stock FROM products WHERE isActive = 1 AND stock > 0 LIMIT 5',
        args: [],
      })
      results.sampleCount = sampleRes.rows.length
      results.sampleNames = (sampleRes.rows as any[]).map(r => r.name)
    } catch (e: any) {
      results.sampleError = e.message
    }

    // Test 6: Raw LIKE without filters
    try {
      const rawRes = await db.execute({
        sql: "SELECT id, name, isActive, stock FROM products WHERE name LIKE ? LIMIT 5",
        args: ['%notebook%'],
      })
      results.rawLikeCount = rawRes.rows.length
      results.rawLikeSample = (rawRes.rows as any[]).map(r => ({ name: r.name, isActive: r.isActive, stock: r.stock }))
    } catch (e: any) {
      results.rawLikeError = e.message
    }

    // Test 7: DB URL type
    const dbUrl = process.env.DATABASE_URL || '(not set)'
    results.dbUrlType = dbUrl.startsWith('libsql://') ? 'libsql (remote)' : dbUrl.startsWith('file:') ? 'file (local)' : 'other'
    results.hasAuthToken = !!process.env.TURSO_AUTH_TOKEN

    // Test 8: LOWER() + LIKE
    try {
      const lowerRes = await db.execute({
        sql: "SELECT id, name FROM products WHERE LOWER(name) LIKE LOWER(?) LIMIT 5",
        args: ['%notebook%'],
      })
      results.lowerLikeCount = lowerRes.rows.length
      results.lowerLikeSample = (lowerRes.rows as any[]).map(r => r.name)
    } catch (e: any) {
      results.lowerLikeError = e.message
    }

    return NextResponse.json({ ok: true, diagnostics: results })
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
  }
}
