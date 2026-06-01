import { createClient } from '@libsql/client';

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw'
});

// How many uncategorized products have stock?
const [withStock, noStock] = await Promise.all([
  db.execute(`SELECT COUNT(*) as count FROM products WHERE categoryId IS NULL AND stock > 0`),
  db.execute(`SELECT COUNT(*) as count FROM products WHERE categoryId IS NULL AND stock <= 0`),
]);
console.log(`Uncategorized WITH stock: ${withStock.rows[0].count}`);
console.log(`Uncategorized WITHOUT stock: ${noStock.rows[0].count}`);

// Get sample of uncategorized WITH stock
const withStockProducts = await db.execute(
  `SELECT id, name, providerSku, price, stock FROM products WHERE categoryId IS NULL AND stock > 0 ORDER BY stock DESC LIMIT 60`
);
console.log(`\n--- Uncategorized WITH stock (top 60 by stock) ---`);
for (const r of withStockProducts.rows) {
  console.log(`  [stock:${r.stock}] $${r.price?.toFixed(0)} | ${r.name}`);
}

// Check how many of the "other" category products can be matched with broader keywords
const all = await db.execute(`SELECT name FROM products WHERE categoryId IS NULL`);
const brandCounts = {};
for (const r of all.rows) {
  const n = r.name.toUpperCase();
  // Check for brand names and common IT terms
  const brands = ['APC', 'EPSON', 'HP', 'LENOVO', 'DELL', 'LOGITECH', 'MICROSOFT', 'KINGSTON', 'SAMSUNG', 'NOGANET', 'CISCO', 'LINKSYS', 'TPLINK', 'TP-LINK', 'ARUBA', 'CANON', 'BROTHER', 'NOBLEX', 'PHILIPS', 'TOSHIBA', 'SEAGATE', 'WD', 'WESTERN', 'CORSAIR', 'NOCTUA', 'ASUS', 'MSI', 'GIGABYTE', 'ACER', 'BANGHO', 'VIEWSONIC', 'BENQ', 'TARGUS', 'GENIUS', 'NISUTA', 'REDRAGON', 'HYPERX', 'RAZER', 'KOLKE', 'MERCURY'];
  for (const brand of brands) {
    if (n.includes(brand)) {
      brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    }
  }
}

console.log(`\n--- Brand mentions in uncategorized products ---`);
const sortedBrands = Object.entries(brandCounts).sort((a,b) => b[1] - a[1]);
for (const [brand, count] of sortedBrands) {
  console.log(`  ${brand}: ${count}`);
}

process.exit(0);
