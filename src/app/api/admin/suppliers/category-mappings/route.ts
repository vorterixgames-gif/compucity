import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/suppliers/category-mappings?supplierId=xxx
 * Returns:
 *   - mappings: existing mappings for this supplier
 *   - supplierCategories: unique supplierCategory values from products of this supplier (with count)
 *   - storeCategories: all store categories for the dropdown
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supplierId = request.nextUrl.searchParams.get('supplierId')
    if (!supplierId) {
      return NextResponse.json({ error: 'supplierId requerido' }, { status: 400 })
    }

    // 1. Get existing mappings for this supplier
    const mappingsResult = await db.execute({
      sql: 'SELECT m.id, m.supplierId, m.supplierCategory, m.storeCategoryId, c.name as storeCategoryName FROM supplier_category_mappings m LEFT JOIN categories c ON m.storeCategoryId = c.id WHERE m.supplierId = ?',
      args: [supplierId],
    })

    // 2. Get unique supplierCategory values from products of this supplier
    const supplierCategoriesResult = await db.execute({
      sql: 'SELECT supplierCategory, COUNT(*) as productCount FROM products WHERE providerId = ? AND supplierCategory IS NOT NULL AND supplierCategory != "" GROUP BY supplierCategory ORDER BY productCount DESC',
      args: [supplierId],
    })

    // 3. Get all store categories (for the dropdown)
    const storeCategoriesResult = await db.execute(
      'SELECT id, name, slug, parentId FROM categories ORDER BY name ASC'
    )

    // Build a parent map for display
    const storeCategories = (storeCategoriesResult.rows as any[]).map((cat: any) => {
      if (cat.parentId) {
        const parent = (storeCategoriesResult.rows as any[]).find((p: any) => p.id === cat.parentId)
        return {
          ...cat,
          displayName: parent ? `${parent.name} > ${cat.name}` : cat.name,
        }
      }
      return {
        ...cat,
        displayName: cat.name,
      }
    })

    return NextResponse.json({
      ok: true,
      mappings: mappingsResult.rows,
      supplierCategories: supplierCategoriesResult.rows,
      storeCategories,
    })
  } catch (error) {
    console.error('Get category mappings error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

/**
 * POST /api/admin/suppliers/category-mappings
 * Create or update a mapping
 * Body: { supplierId, supplierCategory, storeCategoryId }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { supplierId, supplierCategory, storeCategoryId } = await request.json()

    if (!supplierId || !supplierCategory || !storeCategoryId) {
      return NextResponse.json(
        { error: 'supplierId, supplierCategory y storeCategoryId son requeridos' },
        { status: 400 }
      )
    }

    // Check if mapping already exists for this supplier+supplierCategory
    const existing = await db.execute({
      sql: 'SELECT id FROM supplier_category_mappings WHERE supplierId = ? AND supplierCategory = ?',
      args: [supplierId, supplierCategory],
    })

    const now = new Date().toISOString()

    if (existing.rows.length > 0) {
      // Update existing mapping
      const mappingId = (existing.rows[0] as any).id
      await db.execute({
        sql: 'UPDATE supplier_category_mappings SET storeCategoryId = ?, updatedAt = ? WHERE id = ?',
        args: [storeCategoryId, now, mappingId],
      })

      return NextResponse.json({ ok: true, action: 'updated', id: mappingId })
    } else {
      // Create new mapping
      const id = crypto.randomUUID()
      await db.execute({
        sql: 'INSERT INTO supplier_category_mappings (id, supplierId, supplierCategory, storeCategoryId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        args: [id, supplierId, supplierCategory, storeCategoryId, now, now],
      })

      return NextResponse.json({ ok: true, action: 'created', id })
    }
  } catch (error) {
    console.error('Create/update category mapping error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/suppliers/category-mappings?id=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    await db.execute({
      sql: 'DELETE FROM supplier_category_mappings WHERE id = ?',
      args: [id],
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete category mapping error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
