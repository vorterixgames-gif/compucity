import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/admin-auth'

/**
 * POST /api/admin/migrate
 * Adds the shippingDetails column to the orders table if it doesn't exist.
 * 
 * Auth: Admin cookie OR ?key=MIGRATE_SECRET env var
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin auth - either cookie or secret key
    const token = request.cookies.get('admin_token')?.value
    const urlKey = request.nextUrl.searchParams.get('key')
    const migrateSecret = process.env.MIGRATE_SECRET || 'compucity_migrate_2026'

    const isAdminByCookie = token ? !!(await verifyToken(token)) : false
    const isAdminByKey = urlKey === migrateSecret

    if (!isAdminByCookie && !isAdminByKey) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const migrations: string[] = []

    // Check if shippingDetails column exists in orders
    try {
      await db.execute({
        sql: 'SELECT shippingDetails FROM orders LIMIT 1',
        args: [],
      })
    } catch {
      // Column doesn't exist, add it
      await db.execute({
        sql: 'ALTER TABLE orders ADD COLUMN shippingDetails TEXT',
        args: [],
      })
      migrations.push('Added shippingDetails column to orders')
    }

    return NextResponse.json({
      ok: true,
      migrations,
      message: migrations.length > 0
        ? `Migrations applied: ${migrations.join(', ')}`
        : 'All migrations already applied',
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: 'Error running migrations: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}
