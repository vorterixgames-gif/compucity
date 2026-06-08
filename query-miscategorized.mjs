import { createClient } from '@libsql/client';

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw',
});

const sep = '='.repeat(80);

function formatRows(rows, columns) {
  if (rows.length === 0) {
    console.log('  (no results)');
    return;
  }
  // Calculate column widths
  const widths = {};
  for (const col of columns) {
    widths[col] = col.length;
    for (const row of rows) {
      const val = String(row[col] ?? 'NULL');
      widths[col] = Math.max(widths[col], Math.min(val.length, 60));
    }
  }
  // Header
  const header = columns.map(c => c.padEnd(widths[c])).join(' | ');
  const divider = columns.map(c => '-'.repeat(widths[c])).join('-+-');
  console.log('  ' + header);
  console.log('  ' + divider);
  // Rows
  for (const row of rows) {
    const line = columns.map(c => {
      const val = String(row[c] ?? 'NULL');
      return val.length > 60 ? val.substring(0, 57) + '...' : val.padEnd(widths[c]);
    }).join(' | ');
    console.log('  ' + line);
  }
  console.log(`  (${rows.length} rows)`);
}

async function run() {
  try {
    // QUERY 1: Products in "PC Armadas" category or subcategories
    console.log('\n' + sep);
    console.log('QUERY 1: Products in "PC Armadas" category (or subcategories)');
    console.log(sep);
    const q1 = await db.execute({
      sql: `SELECT p.name, p.sku, p.supplierCategory, c.name as categoryName, c.slug as categorySlug
FROM products p 
LEFT JOIN categories c ON p.categoryId = c.id
WHERE c.slug IN ('pc-armadas', 'gamer-pc', 'mini-pc', 'diseno-pc', 'oficina-pc')
   OR c.parentId IN (SELECT id FROM categories WHERE slug = 'pc-armadas')
ORDER BY p.name`,
      args: []
    });
    formatRows(q1.rows, ['name', 'sku', 'supplierCategory', 'categoryName', 'categorySlug']);

    // QUERY 2: Products with "SWITCH" in the name
    console.log('\n' + sep);
    console.log('QUERY 2: Products with "SWITCH" in the name');
    console.log(sep);
    const q2 = await db.execute({
      sql: `SELECT p.name, p.sku, c.name as categoryName, c.slug as categorySlug
FROM products p 
LEFT JOIN categories c ON p.categoryId = c.id
WHERE UPPER(p.name) LIKE '%SWITCH%'
ORDER BY p.name`,
      args: []
    });
    formatRows(q2.rows, ['name', 'sku', 'categoryName', 'categorySlug']);

    // QUERY 3: All categories with slugs and parent relationships
    console.log('\n' + sep);
    console.log('QUERY 3: All categories with slugs and parent relationships');
    console.log(sep);
    const q3 = await db.execute({
      sql: `SELECT c.id, c.name, c.slug, c.parentId, p.name as parentName, p.slug as parentSlug
FROM categories c
LEFT JOIN categories p ON c.parentId = p.id
ORDER BY c.name`,
      args: []
    });
    formatRows(q3.rows, ['id', 'name', 'slug', 'parentId', 'parentName', 'parentSlug']);

    // QUERY 4: Products with "DESKTOP" in the name
    console.log('\n' + sep);
    console.log('QUERY 4: Products with "DESKTOP" in the name');
    console.log(sep);
    const q4 = await db.execute({
      sql: `SELECT p.name, p.sku, c.name as categoryName, c.slug as categorySlug
FROM products p 
LEFT JOIN categories c ON p.categoryId = c.id
WHERE UPPER(p.name) LIKE '%DESKTOP%'
ORDER BY p.name`,
      args: []
    });
    formatRows(q4.rows, ['name', 'sku', 'categoryName', 'categorySlug']);

    // QUERY 5: Products that might be networking/switch/router products
    console.log('\n' + sep);
    console.log('QUERY 5: Networking/switch/router products (SWITCH/ROUTER/TP-LINK/ARCHER in name)');
    console.log(sep);
    const q5 = await db.execute({
      sql: `SELECT p.name, p.sku, c.name as categoryName, c.slug as categorySlug
FROM products p 
LEFT JOIN categories c ON p.categoryId = c.id
WHERE (UPPER(p.name) LIKE '%SWITCH%' OR UPPER(p.name) LIKE '%ROUTER%' OR UPPER(p.name) LIKE '%TP-LINK%' OR UPPER(p.name) LIKE '%ARCHER%')
ORDER BY p.name`,
      args: []
    });
    formatRows(q5.rows, ['name', 'sku', 'categoryName', 'categorySlug']);

    console.log('\n' + sep);
    console.log('ALL QUERIES COMPLETED');
    console.log(sep);

  } catch (err) {
    console.error('FATAL ERROR:', err.message);
    console.error(err);
  } finally {
    db.close();
  }
}

run();
