import { createClient } from '@libsql/client'

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw'
})

// Get schema for products table
const schema = await db.execute("PRAGMA table_info(products)")
console.log('=== PRODUCTS TABLE SCHEMA ===')
console.table(schema.rows)

// Check if product_images table exists
const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
console.log('\n=== ALL TABLES ===')
console.table(tables.rows)

// Check product counts over time - sample of Elit products by category
const elitByCat = await db.execute(`
  SELECT c.slug, c.name, COUNT(*) as count
  FROM products p
  JOIN suppliers s ON p.providerId = s.id
  JOIN categories c ON p.categoryId = c.id
  WHERE s.name = 'Elit' AND p.isActive = 1
  GROUP BY c.slug, c.name
  ORDER BY count DESC
`)
console.log('\n=== ELIT PRODUCTS BY CATEGORY ===')
console.table(elitByCat.rows)

// Check Invid products by category
const invidByCat = await db.execute(`
  SELECT c.slug, c.name, COUNT(*) as count
  FROM products p
  JOIN suppliers s ON p.providerId = s.id
  JOIN categories c ON p.categoryId = c.id
  WHERE s.name = 'Invid Computers' AND p.isActive = 1
  GROUP BY c.slug, c.name
  ORDER BY count DESC
`)
console.log('\n=== INVID PRODUCTS BY CATEGORY ===')
console.table(invidByCat.rows)

// Check Air Intra products by category
const airByCat = await db.execute(`
  SELECT c.slug, c.name, COUNT(*) as count
  FROM products p
  JOIN suppliers s ON p.providerId = s.id
  JOIN categories c ON p.categoryId = c.id
  WHERE s.name = 'Air Intra' AND p.isActive = 1
  GROUP BY c.slug, c.name
  ORDER BY count DESC
`)
console.log('\n=== AIR INTRA PRODUCTS BY CATEGORY ===')
console.table(airByCat.rows)

// Check product_images table if it exists
const imgTableCheck = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='product_images'")
if (imgTableCheck.rows.length > 0) {
  const imgStats = await db.execute(`
    SELECT s.name as supplier, COUNT(pi.id) as images
    FROM product_images pi
    JOIN products p ON pi.productId = p.id
    JOIN suppliers s ON p.providerId = s.id
    GROUP BY s.name
  `)
  console.log('\n=== PRODUCT IMAGES BY SUPPLIER ===')
  console.table(imgStats.rows)
}

// Check products with imageUrl field
const schema2 = await db.execute("PRAGMA table_info(products)")
const hasImage = schema2.rows.some(r => r.name === 'imageUrl' || r.name === 'image_url' || r.name === 'image')
console.log('\nHas image column:', hasImage)

await db.close()
