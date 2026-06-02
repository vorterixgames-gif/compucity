import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { action } = await request.json()

    if (action === 'clean-categories') {
      const results: string[] = []

      // 1. Get all parent categories
      const parents = await db.execute('SELECT id, name, slug FROM categories WHERE parentId IS NULL ORDER BY "order", name')

      // 2. Find and remove duplicate parents (keep the one we want)
      // We want: notebooks, pc-armadas, componentes-de-pc, monitores, perifericos, impresion, conectividad-y-redes, almacenamiento-externo, accesorios
      const wantedSlugs = new Set([
        'notebooks', 'pc-armadas', 'componentes-de-pc', 'monitores',
        'perifericos', 'impresion', 'conectividad-y-redes',
        'almacenamiento-externo', 'accesorios'
      ])

      // Map slug -> list of parent IDs
      const slugToParents: Record<string, string[]> = {}
      for (const p of parents.rows as any[]) {
        if (!slugToParents[p.slug]) slugToParents[p.slug] = []
        slugToParents[p.slug].push(p.id)
      }

      // For each slug, keep only one parent (prefer UUID-style IDs over cat-style)
      const parentsToDelete: string[] = []
      for (const [slug, ids] of Object.entries(slugToParents)) {
        if (!wantedSlugs.has(slug)) {
          // Delete unwanted parent categories entirely
          parentsToDelete.push(...ids)
          results.push(`Removing unwanted category: ${slug} (${ids.length} IDs)`)
        } else if (ids.length > 1) {
          // Duplicate - keep the UUID-style one, delete the cat-style one
          const toKeep = ids.find(id => id.includes('-')) || ids[0]
          const toRemove = ids.filter(id => id !== toKeep)
          parentsToDelete.push(...toRemove)
          results.push(`Duplicate ${slug}: keeping ${toKeep.substring(0, 8)}, removing ${toRemove.map(id => id.substring(0, 8)).join(', ')}`)

          // Move children from removed parent to kept parent
          for (const oldParentId of toRemove) {
            await db.execute({
              sql: 'UPDATE categories SET parentId = ? WHERE parentId = ?',
              args: [toKeep, oldParentId],
            })
          }
        }
      }

      // Delete unwanted parent categories
      for (const pid of parentsToDelete) {
        // First nullify products
        await db.execute({
          sql: 'UPDATE products SET categoryId = NULL WHERE categoryId = ?',
          args: [pid],
        })
        // Then delete
        await db.execute({
          sql: 'DELETE FROM categories WHERE id = ?',
          args: [pid],
        })
        results.push(`Deleted parent: ${pid.substring(0, 8)}`)
      }

      // 3. Now fix children - remove duplicates (same name under same parent)
      const allChildren = await db.execute('SELECT id, name, slug, parentId FROM categories WHERE parentId IS NOT NULL ORDER BY parentId, name')

      // Group by parentId + name to find duplicates
      const childMap: Record<string, any[]> = {}
      for (const child of allChildren.rows as any[]) {
        const key = `${child.parentId}_${child.name}`
        if (!childMap[key]) childMap[key] = []
        childMap[key].push(child)
      }

      // For duplicate names under same parent, keep the one with the shorter/cleaner slug
      for (const [key, duplicates] of Object.entries(childMap)) {
        if (duplicates.length > 1) {
          // Sort: prefer shorter slug (cleaner name)
          duplicates.sort((a, b) => a.slug.length - b.slug.length)
          const toKeep = duplicates[0]
          const toRemove = duplicates.slice(1)

          for (const dup of toRemove) {
            // Move products to the kept category
            await db.execute({
              sql: 'UPDATE products SET categoryId = ? WHERE categoryId = ?',
              args: [toKeep.id, dup.id],
            })
            await db.execute({
              sql: 'DELETE FROM categories WHERE id = ?',
              args: [dup.id],
            })
            results.push(`Removed duplicate child: ${dup.name} (${dup.slug}), kept ${toKeep.slug}`)
          }
        }
      }

      // 4. Rename children to short names (the ones the admin wants)
      const renames: Record<string, string> = {
        'notebooks-gamer': 'Gamer',
        'notebooks-oficina': 'Oficina',
        'notebooks-diseno': 'Diseño',
        'pc-gamer': 'Gamer',
        'pc-oficina': 'Oficina',
        'pc-diseno': 'Diseño',
        'fuentes-de-alimentacion': 'Fuentes',
        'combos-de-actualizacion': 'Combos',
        'monitores-gamer': 'Gamer',
        'monitores-oficina': 'Oficina',
        'monitores-diseno': 'Diseño',
        'joysticks-y-volantes': 'Joysticks',
        'impresoras-laser': 'Láser',
        'impresoras-inyeccion': 'Inyección',
        'impresoras-sistema-continuo': 'Sistema Continuo',
        'memorias-micro-sd': 'Micro SD',
        'cargadores-de-notebook': 'Cargadores',
        'bases-de-notebook': 'Bases',
        'fundas-y-mochilas': 'Fundas/Mochilas',
        'estabilizadores-y-ups': 'UPS',
      }

      for (const [slug, newName] of Object.entries(renames)) {
        const result = await db.execute({
          sql: 'UPDATE categories SET name = ? WHERE slug = ?',
          args: [newName, slug],
        })
        if (result.rowsAffected > 0) {
          results.push(`Renamed ${slug} → ${newName}`)
        }
      }

      // 5. Also fix slugs for renamed categories
      const slugRenames: Record<string, string> = {
        'notebooks-gamer': 'gamer',
        'notebooks-oficina': 'oficina',
        'notebooks-diseno': 'diseno',
        'pc-gamer': 'gamer-pc',
        'pc-oficina': 'oficina-pc',
        'pc-diseno': 'diseno-pc',
        'fuentes-de-alimentacion': 'fuentes',
        'combos-de-actualizacion': 'combos',
        'monitores-gamer': 'gamer-mon',
        'monitores-oficina': 'oficina-mon',
        'monitores-diseno': 'diseno-mon',
        'joysticks-y-volantes': 'joysticks',
        'impresoras-laser': 'laser',
        'impresoras-inyeccion': 'inyeccion',
        'impresoras-sistema-continuo': 'sistema-continuo',
        'memorias-micro-sd': 'micro-sd',
        'cargadores-de-notebook': 'cargadores',
        'bases-de-notebook': 'bases',
        'fundas-y-mochilas': 'fundas-mochilas',
        'estabilizadores-y-ups': 'ups',
      }

      for (const [oldSlug, newSlug] of Object.entries(slugRenames)) {
        try {
          await db.execute({
            sql: 'UPDATE categories SET slug = ? WHERE slug = ?',
            args: [newSlug, oldSlug],
          })
        } catch (e: any) {
          // Slug might already exist (duplicate), skip
          results.push(`Slug rename ${oldSlug}→${newSlug} skipped: ${e.message?.substring(0, 50)}`)
        }
      }

      // 6. Fix "Componentes" (slug: componentes) → should be deleted or renamed
      // "Perifericos" → should be "Periféricos" with accent
      await db.execute({
        sql: 'UPDATE categories SET name = ? WHERE slug = ? AND name != ?',
        args: ['Periféricos', 'perifericos', 'Periféricos'],
      })

      // Verify final state
      const finalCount = await db.execute('SELECT COUNT(*) as cnt FROM categories')
      const finalParents = await db.execute('SELECT id, name, slug FROM categories WHERE parentId IS NULL ORDER BY "order", name')

      results.push(`\nFinal count: ${finalCount.rows[0].cnt} categories, ${finalParents.rows.length} parents`)

      return NextResponse.json({ ok: true, results })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json({ error: 'Error del servidor', details: String(error) }, { status: 500 })
  }
}
