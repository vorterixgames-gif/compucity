import { createClient } from '@libsql/client'

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw'
})

// Check products by provider and isActive status
const result = await db.execute(`
  SELECT s.name as supplier, 
    COUNT(*) as total,
    SUM(CASE WHEN p.isActive = 1 THEN 1 ELSE 0 END) as active,
    SUM(CASE WHEN p.isActive = 0 THEN 1 ELSE 0 END) as inactive
  FROM products p
  JOIN suppliers s ON p.providerId = s.id
  GROUP BY s.name
  ORDER BY s.name
`)
console.log('\n=== PRODUCTS BY SUPPLIER ===')
console.table(result.rows)

// Check deactivated products from Elit and Invid that have categories
const deactivated = await db.execute(`
  SELECT s.name as supplier, p.name as product, c.name as category, p.isActive
  FROM products p
  JOIN suppliers s ON p.providerId = s.id
  LEFT JOIN categories c ON p.categoryId = c.id
  WHERE p.isActive = 0 AND s.name != 'Air Intra'
  ORDER BY s.name, p.name
  LIMIT 30
`)
console.log('\n=== DEACTIVATED PRODUCTS FROM ELIT/INVID (sample) ===')
console.table(deactivated.rows)

// Count of deactivated by provider with category info
const deactivatedStats = await db.execute(`
  SELECT s.name as supplier,
    SUM(CASE WHEN p.categoryId IS NOT NULL THEN 1 ELSE 0 END) as with_category,
    SUM(CASE WHEN p.categoryId IS NULL THEN 1 ELSE 0 END) as without_category,
    COUNT(*) as total_deactivated
  FROM products p
  JOIN suppliers s ON p.providerId = s.id
  WHERE p.isActive = 0
  GROUP BY s.name
  ORDER BY s.name
`)
console.log('\n=== DEACTIVATED STATS BY SUPPLIER ===')
console.table(deactivatedStats.rows)

// Active products by supplier
const activeStats = await db.execute(`
  SELECT s.name as supplier,
    COUNT(*) as active,
    SUM(CASE WHEN p.categoryId IS NOT NULL THEN 1 ELSE 0 END) as with_category,
    SUM(CASE WHEN p.categoryId IS NULL THEN 1 ELSE 0 END) as without_category,
    SUM(CASE WHEN p.stock > 0 AND p.categoryId IS NOT NULL THEN 1 ELSE 0 END) as visible
  FROM products p
  JOIN suppliers s ON p.providerId = s.id
  WHERE p.isActive = 1
  GROUP BY s.name
  ORDER BY s.name
`)
console.log('\n=== ACTIVE PRODUCTS BY SUPPLIER ===')
console.table(activeStats.rows)

await db.close()
