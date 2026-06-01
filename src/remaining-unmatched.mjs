import { createClient } from '@libsql/client';
const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw'
});

const [withStock, noStock] = await Promise.all([
  db.execute(`SELECT COUNT(*) as c, GROUP_CONCAT(name, '|||') as names FROM products WHERE categoryId IS NULL AND stock > 0`),
  db.execute(`SELECT COUNT(*) as c FROM products WHERE categoryId IS NULL AND stock <= 0`),
]);

console.log(`Still uncategorized WITH stock: ${withStock.rows[0].c}`);
console.log(`Still uncategorized WITHOUT stock: ${noStock.rows[0].c}`);

// Show all WITH stock
const stockProducts = await db.execute(
  `SELECT name, stock, price FROM products WHERE categoryId IS NULL AND stock > 0 ORDER BY stock DESC`
);
console.log(`\n--- All uncategorized WITH stock (${stockProducts.rows.length}) ---`);
for (const r of stockProducts.rows) {
  console.log(`  [${r.stock}] $${r.price?.toFixed(0)} | ${r.name}`);
}

process.exit(0);
