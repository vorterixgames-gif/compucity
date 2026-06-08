import { createClient } from '@libsql/client'

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw'
})

// All categories
const cats = await db.execute('SELECT id, name, slug, parentId FROM categories ORDER BY slug')
console.log('=== ALL CATEGORIES ===')
console.table(cats.rows)

// Count products per supplier (current state)
const suppliers = await db.execute(`
  SELECT s.id, s.name, s.apiType, COUNT(p.id) as productCount 
  FROM suppliers s 
  LEFT JOIN products p ON p.providerId = s.id 
  GROUP BY s.id, s.name, s.apiType
`)
console.log('\n=== SUPPLIERS ===')
console.table(suppliers.rows)

// Check how many Elit products have images
const elitImages = await db.execute(`
  SELECT 
    SUM(CASE WHEN p.images != '[]' AND p.images IS NOT NULL THEN 1 ELSE 0 END) as with_images,
    SUM(CASE WHEN p.images = '[]' OR p.images IS NULL THEN 1 ELSE 0 END) as without_images,
    COUNT(*) as total
  FROM products p
  JOIN suppliers s ON p.providerId = s.id
  WHERE s.name = 'Elit'
`)
console.log('\n=== ELIT IMAGE STATS ===')
console.table(elitImages.rows)

// Check how many Invid products have images
const invidImages = await db.execute(`
  SELECT 
    SUM(CASE WHEN p.images != '[]' AND p.images IS NOT NULL THEN 1 ELSE 0 END) as with_images,
    SUM(CASE WHEN p.images = '[]' OR p.images IS NULL THEN 1 ELSE 0 END) as without_images,
    COUNT(*) as total
  FROM products p
  JOIN suppliers s ON p.providerId = s.id
  WHERE s.name = 'Invid Computers'
`)
console.log('\n=== INVID IMAGE STATS ===')
console.table(invidImages.rows)

await db.close()
