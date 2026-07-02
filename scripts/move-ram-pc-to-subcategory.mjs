/**
 * One-time migration: Create "Memoria RAM PC" subcategory under memorias-ram
 * and move all desktop RAM products from parent to this new subcategory.
 * 
 * Before:
 *   memorias-ram (parent) -> 245 desktop RAM products
 *   memoria-ram-notebook (sub) -> 63 SODIMM products
 * 
 * After:
 *   memorias-ram (parent) -> 0 products (just a container)
 *   memoria-ram-pc (sub) -> 245 desktop RAM products
 *   memoria-ram-notebook (sub) -> 63 SODIMM products
 */

import { createClient } from '@libsql/client';

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw',
});

const PARENT_ID = '8fec8068-83c9-43a9-a972-9eeafe9e0bda'; // memorias-ram

async function migrate() {
  console.log('=== MEMORIA RAM PC SUBCATEGORY MIGRATION ===\n');

  // 1. Verify parent exists
  const parent = await db.execute({ sql: 'SELECT id, name, slug FROM categories WHERE id = ?', args: [PARENT_ID] });
  if (parent.rows.length === 0) {
    console.error('ERROR: Parent category memorias-ram not found!');
    process.exit(1);
  }
  console.log(`Parent: ${parent.rows[0].name} (${parent.rows[0].slug})`);

  // 2. Check if subcategory already exists
  const existing = await db.execute({ 
    sql: "SELECT id, name, slug, enabled FROM categories WHERE slug = 'memoria-ram-pc' AND parentId = ?", 
    args: [PARENT_ID] 
  });
  
  let pcSubcatId;
  
  if (existing.rows.length > 0) {
    pcSubcatId = existing.rows[0].id;
    console.log(`\nSubcategory already exists: ${existing.rows[0].name} (${existing.rows[0].slug}) id=${pcSubcatId} enabled=${existing.rows[0].enabled}`);
  } else {
    // 3. Create the "Memoria RAM PC" subcategory
    // Generate a unique ID
    pcSubcatId = 'cat-ram-pc-desktop';
    const orderResult = await db.execute({ 
      sql: 'SELECT COALESCE(MAX("order"), 0) + 1 as nextOrder FROM categories WHERE parentId = ?', 
      args: [PARENT_ID] 
    });
    const sort = orderResult.rows[0].nextOrder;
    
    await db.execute({
      sql: `INSERT INTO categories (id, name, slug, parentId, enabled, "order", createdAt, updatedAt)
            VALUES (?, 'Memoria RAM PC', 'memoria-ram-pc', ?, 1, ?, datetime('now'), datetime('now'))`,
      args: [pcSubcatId, PARENT_ID, sort]
    });
    console.log(`\nCreated subcategory: Memoria RAM PC (memoria-ram-pc) id=${pcSubcatId}`);
  }

  // 4. Make sure it's enabled
  await db.execute({
    sql: 'UPDATE categories SET enabled = 1 WHERE id = ?',
    args: [pcSubcatId]
  });
  console.log('Ensured subcategory is enabled');

  // 5. Move desktop RAM products from parent to new subcategory
  // Desktop RAM = products in parent that do NOT have SODIMM in name
  const desktopProducts = await db.execute({
    sql: `SELECT COUNT(*) as cnt FROM products 
          WHERE categoryId = ? AND isActive = 1 
          AND name NOT LIKE '%SODIMM%' AND name NOT LIKE '%Sodimm%' AND name NOT LIKE '%sodimm%'`,
    args: [PARENT_ID]
  });
  console.log(`\nDesktop RAM products in parent: ${desktopProducts.rows[0].cnt}`);

  const moveResult = await db.execute({
    sql: `UPDATE products SET categoryId = ? 
          WHERE categoryId = ? AND isActive = 1 
          AND name NOT LIKE '%SODIMM%' AND name NOT LIKE '%Sodimm%' AND name NOT LIKE '%sodimm%'`,
    args: [pcSubcatId, PARENT_ID]
  });
  console.log(`Moved ${moveResult.rowsAffected} desktop RAM products to Memoria RAM PC`);

  // 6. Verification
  console.log('\n=== VERIFICATION ===');
  
  const parentCount = await db.execute({ 
    sql: 'SELECT COUNT(*) as cnt FROM products WHERE categoryId = ? AND isActive = 1', 
    args: [PARENT_ID] 
  });
  console.log(`Parent memorias-ram: ${parentCount.rows[0].cnt} active products`);
  
  const pcCount = await db.execute({ 
    sql: 'SELECT COUNT(*) as cnt FROM products WHERE categoryId = ? AND isActive = 1', 
    args: [pcSubcatId] 
  });
  console.log(`Subcategory memoria-ram-pc: ${pcCount.rows[0].cnt} active products`);
  
  const notebookCount = await db.execute({
    sql: "SELECT COUNT(*) as cnt FROM products WHERE categoryId = (SELECT id FROM categories WHERE slug = 'memoria-ram-notebook') AND isActive = 1"
  });
  console.log(`Subcategory memoria-ram-notebook: ${notebookCount.rows[0].cnt} active products`);

  // 7. Show all subcategories
  const allSubcats = await db.execute({
    sql: 'SELECT id, name, slug, enabled FROM categories WHERE parentId = ?',
    args: [PARENT_ID]
  });
  console.log('\nAll subcategories under memorias-ram:');
  for (const s of allSubcats.rows) {
    const cnt = await db.execute({ sql: 'SELECT COUNT(*) as cnt FROM products WHERE categoryId = ?', args: [s.id] });
    console.log(`  ${s.name} (${s.slug}) enabled=${s.enabled} products=${cnt.rows[0].cnt}`);
  }

  console.log('\n✅ Migration complete!');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
