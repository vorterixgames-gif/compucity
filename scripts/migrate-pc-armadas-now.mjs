/**
 * One-time migration: Move all products from PC Armadas subcategories to parent,
 * then disable subcategories. Same pattern used for Notebooks.
 * 
 * Subcategories affected:
 *   - gamer-pc (AIO)     -> 12 products
 *   - oficina-pc (Oficina) -> 107 products
 *   - mini-pc (Mini PC)  -> 52 products
 * 
 * diseno-pc does not exist in DB.
 */

import { createClient } from '@libsql/client';

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw',
});

const PARENT_ID = 'cat6'; // pc-armadas

async function migrate() {
  console.log('=== PC ARMADAS MIGRATION ===\n');

  // 1. Verify parent exists
  const parent = await db.execute({ sql: 'SELECT id, name, slug FROM categories WHERE id = ?', args: [PARENT_ID] });
  if (parent.rows.length === 0) {
    console.error('ERROR: Parent category pc-armadas (cat6) not found!');
    process.exit(1);
  }
  console.log(`Parent: ${parent.rows[0].name} (${parent.rows[0].slug})`);

  // 2. Find active subcategories
  const subcats = await db.execute({ sql: 'SELECT id, name, slug, enabled FROM categories WHERE parentId = ? AND enabled = 1', args: [PARENT_ID] });
  console.log(`\nFound ${subcats.rows.length} active subcategories:`);
  
  let totalMoved = 0;
  for (const sub of subcats.rows) {
    // Count products in this subcategory
    const cnt = await db.execute({ sql: 'SELECT COUNT(*) as cnt FROM products WHERE categoryId = ?', args: [sub.id] });
    const count = cnt.rows[0].cnt;
    console.log(`  - ${sub.name} (${sub.slug}): ${count} products`);

    if (count > 0) {
      // Move products to parent
      const result = await db.execute({ sql: 'UPDATE products SET categoryId = ? WHERE categoryId = ?', args: [PARENT_ID, sub.id] });
      console.log(`    Moved ${result.rowsAffected} products to parent`);
      totalMoved += result.rowsAffected;
    }
  }

  // 3. Disable subcategories
  console.log('\nDisabling subcategories...');
  const disableResult = await db.execute({ 
    sql: 'UPDATE categories SET enabled = 0 WHERE parentId = ? AND enabled = 1', 
    args: [PARENT_ID] 
  });
  console.log(`Disabled ${disableResult.rowsAffected} subcategories`);

  // 4. Verify
  console.log('\n=== VERIFICATION ===');
  const parentCount = await db.execute({ sql: 'SELECT COUNT(*) as cnt FROM products WHERE categoryId = ? AND isActive = 1', args: [PARENT_ID] });
  console.log(`Parent pc-armadas now has ${parentCount.rows[0].cnt} active products`);
  
  const remainingSubcats = await db.execute({ sql: 'SELECT id, name, slug, enabled FROM categories WHERE parentId = ?', args: [PARENT_ID] });
  for (const sub of remainingSubcats.rows) {
    const cnt = await db.execute({ sql: 'SELECT COUNT(*) as cnt FROM products WHERE categoryId = ?', args: [sub.id] });
    console.log(`  ${sub.name} (${sub.slug}): enabled=${sub.enabled}, ${cnt.rows[0].cnt} products remaining`);
  }

  console.log(`\n✅ Migration complete! Moved ${totalMoved} products to parent category.`);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
