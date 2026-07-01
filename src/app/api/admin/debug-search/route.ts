import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

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
      results.prefixSearch = prefixRes.rows
    } catch (e: any) {
      results.prefixError = e.message
    }

    // Test 4: LIKE anywhere search
    try {
      const anyRes = await db.execute({
        sql: "SELECT id, name FROM products WHERE isActive = 1 AND stock > 0 AND name LIKE ? LIMIT 5",
        args: ['%notebook%'],
      })
      results.anySearch = anyRes.rows
    } catch (e: any) {
      results.anyError = e.message
    }

    // Test 5: Sample active products (no LIKE)
    try {
      const sampleRes = await db.execute({
        sql: 'SELECT id, name, isActive, stock FROM products WHERE isActive = 1 AND stock > 0 LIMIT 5',
        args: [],
      })
      results.sampleProducts = sampleRes.rows
    } catch (e: any) {
      results.sampleError = e.message
    }

    // Test 6: Raw LIKE without isActive/stock filter
    try {
      const rawRes = await db.execute({
        sql: "SELECT id, name, isActive, stock FROM products WHERE name LIKE ? LIMIT 5",
        args: ['%notebook%'],
      })
      results.rawLikeSearch = rawRes.rows
    } catch (e: any) {
      results.rawLikeError = e.message
    }

    // Test 7: Check DATABASE_URL (masked)
    const dbUrl = process.env.DATABASE_URL || '(not set)'
    results.databaseUrl = dbUrl.startsWith('libsql://') ? 'libsql://***' : dbUrl.startsWith('file:') ? 'file:***' : dbUrl.substring(0, 20) + '...'
    results.hasAuthToken = !!process.env.TURSO_AUTH_TOKEN

    return NextResponse.json({ ok: true, diagnostics: results })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
