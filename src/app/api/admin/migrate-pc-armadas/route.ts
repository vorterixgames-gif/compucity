import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * One-time migration: Move all products from PC Armadas subcategories 
 * to the parent category and disable subcategories.
 * DELETE this route after running it once.
 */
export async function POST() {
  try {
    console.log('=== PC Armadas: Moving products to parent category ===')

    // 1. Find the parent category ID
    const parentResult = await db.execute({
      sql: "SELECT id, name FROM categories WHERE slug = 'pc-armadas'",
      args: [],
    })
    const parent = parentResult.rows[0] as any
    if (!parent) {
      return NextResponse.json({ error: 'pc-armadas category not found' }, { status: 404 })
    }

    // 2. Find subcategories
    const subResult = await db.execute({
      sql: "SELECT id, name, slug FROM categories WHERE parentId = ? AND enabled = 1",
      args: [parent.id],
    })
    const subs = subResult.rows as any[]
    const subIds = subs.map((s: any) => s.id)

    if (subIds.length === 0) {
      return NextResponse.json({ message: 'No active subcategories found. Already migrated?' })
    }

    // 3. Count products before move
    const countsBefore: Record<string, number> = {}
    let totalToMove = 0
    for (const sub of subs) {
      const countResult = await db.execute({
        sql: "SELECT COUNT(*) as cnt FROM products WHERE categoryId = ?",
        args: [sub.id],
      })
      const count = Number((countResult.rows[0] as any).cnt)
      countsBefore[sub.slug] = count
      totalToMove += count
    }

    // 4. Move products from subcategories to parent
    let movedCount = 0
    if (totalToMove > 0) {
      const placeholders = subIds.map(() => '?').join(',')
      const moveResult = await db.execute({
        sql: `UPDATE products SET categoryId = ? WHERE categoryId IN (${placeholders})`,
        args: [parent.id, ...subIds],
      })
      movedCount = moveResult.rowsAffected
    }

    // 5. Disable subcategories (don't delete - safe rollback)
    for (const sub of subs) {
      await db.execute({
        sql: "UPDATE categories SET enabled = 0 WHERE id = ?",
        args: [sub.id],
      })
    }

    // 6. Verify
    const parentCount = await db.execute({
      sql: "SELECT COUNT(*) as cnt FROM products WHERE categoryId = ?",
      args: [parent.id],
    })

    return NextResponse.json({
      ok: true,
      message: `Moved ${movedCount} products to pc-armadas parent. Disabled ${subs.length} subcategories.`,
      details: {
        parentCategory: parent.name,
        subcategoriesDisabled: subs.map((s: any) => s.slug),
        productsPerSubcategory: countsBefore,
        totalMoved: movedCount,
        parentProductCount: Number((parentCount.rows[0] as any).cnt),
      },
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
