import { createClient } from '@libsql/client'

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw'
})

// Total products
const total = await db.execute('SELECT COUNT(*) as total FROM products')
console.log('Total products:', total.rows[0].total)

// Active vs inactive
const activeCount = await db.execute('SELECT COUNT(*) as c FROM products WHERE isActive = 1')
const inactiveCount = await db.execute('SELECT COUNT(*) as c FROM products WHERE isActive = 0')
console.log('Active:', activeCount.rows[0].c, '| Inactive:', inactiveCount.rows[0].c)

// Products without provider
const noProvider = await db.execute('SELECT COUNT(*) as c FROM products WHERE providerId IS NULL')
console.log('Products without provider:', noProvider.rows[0].c)

// Products by category
const byCategory = await db.execute(`
  SELECT c.slug, c.name, COUNT(*) as count
  FROM products p
  JOIN categories c ON p.categoryId = c.id
  WHERE p.isActive = 1
  GROUP BY c.slug, c.name
  ORDER BY count DESC
`)
console.log('\n=== ACTIVE PRODUCTS BY CATEGORY ===')
console.table(byCategory.rows)

// Image stats
const imageStats = await db.execute(`
  SELECT s.name as supplier,
    SUM(CASE WHEN p.image IS NOT NULL AND p.image != '' THEN 1 ELSE 0 END) as with_image,
    SUM(CASE WHEN p.image IS NULL OR p.image = '' THEN 1 ELSE 0 END) as without_image,
    COUNT(*) as total
  FROM products p
  JOIN suppliers s ON p.providerId = s.id
  WHERE p.isActive = 1
  GROUP BY s.name
`)
console.log('\n=== IMAGE STATS BY SUPPLIER ===')
console.table(imageStats.rows)

// Sample products from each provider
for (const supplier of ['Elit', 'Invid Computers']) {
  const sample = await db.execute({
    sql: `SELECT p.name, c.slug as category, p.stock, p.price FROM products p 
          JOIN suppliers s ON p.providerId = s.id 
          LEFT JOIN categories c ON p.categoryId = c.id
          WHERE s.name = ? AND p.isActive = 1 
          ORDER BY p.name LIMIT 15`,
    args: [supplier]
  })
  console.log(`\n=== SAMPLE ${supplier} PRODUCTS ===`)
  console.table(sample.rows)
}

await db.close()
