import { createClient } from '@libsql/client';
const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw'
});

// Check image status for active products
const [activeWithImages, activeWithoutImages, totalActive] = await Promise.all([
  db.execute(`SELECT COUNT(*) as c FROM products WHERE isActive = 1 AND images != '[]' AND images IS NOT NULL`),
  db.execute(`SELECT COUNT(*) as c FROM products WHERE isActive = 1 AND (images = '[]' OR images IS NULL)`),
  db.execute(`SELECT COUNT(*) as c FROM products WHERE isActive = 1`),
]);

console.log(`=== IMAGE STATUS (Active Products) ===`);
console.log(`Total active: ${totalActive.rows[0].c}`);
console.log(`With images: ${activeWithImages.rows[0].c}`);
console.log(`Without images: ${activeWithoutImages.rows[0].c}`);
console.log(`% with images: ${((activeWithImages.rows[0].c / totalActive.rows[0].c) * 100).toFixed(1)}%`);

// Breakdown by category
const byCategory = await db.execute(`
  SELECT c.slug, c.name,
    COUNT(*) as total,
    SUM(CASE WHEN p.images != '[]' AND p.images IS NOT NULL THEN 1 ELSE 0 END) as with_images,
    SUM(CASE WHEN p.images = '[]' OR p.images IS NULL THEN 1 ELSE 0 END) as without_images
  FROM products p
  JOIN categories c ON p.categoryId = c.id
  WHERE p.isActive = 1
  GROUP BY c.slug, c.name
  ORDER BY without_images DESC
`);

console.log(`\n=== BY CATEGORY ===`);
for (const r of byCategory.rows) {
  const pct = ((r.with_images / r.total) * 100).toFixed(0);
  console.log(`  ${r.slug}: ${r.with_images}/${r.total} (${pct}%) con imagen, ${r.without_images} sin imagen`);
}

// Check by provider
const byProvider = await db.execute(`
  SELECT p.providerId,
    COUNT(*) as total,
    SUM(CASE WHEN p.images != '[]' AND p.images IS NOT NULL THEN 1 ELSE 0 END) as with_images,
    SUM(CASE WHEN p.images = '[]' OR p.images IS NULL THEN 1 ELSE 0 END) as without_images
  FROM products p
  WHERE p.isActive = 1
  GROUP BY p.providerId
`);
console.log(`\n=== BY PROVIDER ===`);
for (const r of byProvider.rows) {
  console.log(`  ${r.providerId}: ${r.with_images}/${r.total} con imagen, ${r.without_images} sin imagen`);
}

// Sample of products without images (visible ones with stock)
const sample = await db.execute(`
  SELECT p.name, c.slug as category, p.stock, p.price
  FROM products p
  JOIN categories c ON p.categoryId = c.id
  WHERE p.isActive = 1 AND stock > 0 AND (p.images = '[]' OR p.images IS NULL)
  ORDER BY p.stock DESC
  LIMIT 20
`);
console.log(`\n=== VISIBLE PRODUCTS WITHOUT IMAGES (top 20 by stock) ===`);
for (const r of sample.rows) {
  console.log(`  [${r.stock}] $${r.price?.toFixed(0)} | ${r.category} | ${r.name}`);
}

process.exit(0);
