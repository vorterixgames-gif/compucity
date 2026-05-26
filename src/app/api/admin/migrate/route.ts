import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/admin-auth'

/**
 * POST /api/admin/migrate
 * Adds the shippingDetails column to the orders table if it doesn't exist.
 * Called from admin panel or manually.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin auth
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const email = await verifyToken(token)
    if (!email) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
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
