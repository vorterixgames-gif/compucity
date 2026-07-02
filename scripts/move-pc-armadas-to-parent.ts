/**
 * Script: Move all products from PC Armadas subcategories to the parent category
 * and disable the subcategories.
 * 
 * This follows the same pattern as notebooks - products live in the parent
 * category and users filter via the sidebar (type, brand, GPU, RAM, processor).
 * 
 * Run: npx tsx scripts/move-pc-armadas-to-parent.ts
 */

import { createClient } from '@libsql/client'

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

async function main() {
  console.log('=== PC Armadas: Moving products to parent category ===\n')

  // 1. Find the parent category ID
  const parentResult = await db.execute({
    sql: "SELECT id, name FROM categories WHERE slug = 'pc-armadas'",
    args: [],
  })
  const parent = parentResult.rows[0] as any
  if (!parent) {
    console.error('ERROR: pc-armadas category not found!')
    process.exit(1)
  }
  console.log(`Parent category: ${parent.name} (${parent.id})`)

  // 2. Find subcategories
  const subResult = await db.execute({
    sql: "SELECT id, name, slug FROM categories WHERE parentId = ?",
    args: [parent.id],
  })
  const subs = subResult.rows as any[]
  console.log(`\nSubcategories found: ${subs.length}`)
  const subIds: string[] = []
  for (const sub of subs) {
    console.log(`  - ${sub.name} (${sub.slug}) = ${sub.id}`)
    subIds.push(sub.id)
  }

  if (subIds.length === 0) {
    console.log('\nNo subcategories found. Nothing to do.')
    process.exit(0)
  }

  // 3. Count products in each subcategory
  console.log('\n--- Product counts before move ---')
  let totalToMove = 0
  for (const sub of subs) {
    const countResult = await db.execute({
      sql: "SELECT COUNT(*) as cnt FROM products WHERE categoryId = ?",
      args: [sub.id],
    })
    const count = (countResult.rows[0] as any).cnt
    console.log(`  ${sub.name}: ${count} products`)
    totalToMove += Number(count)
  }
  console.log(`  Total to move: ${totalToMove}`)

  // 4. Move products from subcategories to parent
  if (totalToMove > 0) {
    console.log('\nMoving products to parent category...')
    const placeholders = subIds.map(() => '?').join(',')
    const moveResult = await db.execute({
      sql: `UPDATE products SET categoryId = ? WHERE categoryId IN (${placeholders})`,
      args: [parent.id, ...subIds],
    })
    console.log(`  Moved ${moveResult.rowsAffected} products`)
  }

  // 5. Disable subcategories (don't delete - safe rollback)
  console.log('\nDisabling subcategories...')
  for (const sub of subs) {
    await db.execute({
      sql: "UPDATE categories SET enabled = 0 WHERE id = ?",
      args: [sub.id],
    })
    console.log(`  Disabled: ${sub.name} (${sub.slug})`)
  }

  // 6. Verify
  console.log('\n--- Verification ---')
  const parentCount = await db.execute({
    sql: "SELECT COUNT(*) as cnt FROM products WHERE categoryId = ?",
    args: [parent.id],
  })
  console.log(`Products in pc-armadas: ${(parentCount.rows[0] as any).cnt}`)
  
  for (const sub of subs) {
    const countResult = await db.execute({
      sql: "SELECT COUNT(*) as cnt FROM products WHERE categoryId = ?",
      args: [sub.id],
    })
    console.log(`Products in ${sub.name}: ${(countResult.rows[0] as any).cnt} (should be 0)`)
  }

  console.log('\n=== Done! ===')
  console.log('Next steps:')
  console.log('1. Update sync code to not assign subcategories')
  console.log('2. Add filters to CategoryProducts.tsx')
  console.log('3. Deploy')
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
