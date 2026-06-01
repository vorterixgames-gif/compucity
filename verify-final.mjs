import { createClient } from '@libsql/client'

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw'
})

// Products by supplier
const bySupplier = await db.execute(`
  SELECT s.name as supplier, 
    COUNT(*) as total,
    SUM(CASE WHEN p.isActive = 1 THEN 1 ELSE 0 END) as active,
    SUM(CASE WHEN p.stock > 0 AND p.categoryId IS NOT NULL AND p.isActive = 1 THEN 1 ELSE 0 END) as visible
  FROM products p
  JOIN suppliers s ON p.providerId = s.id
  GROUP BY s.name
  ORDER BY s.name
`)
console.log('=== PRODUCTS BY SUPPLIER ===')
console.table(bySupplier.rows)

// Category distribution - all active products
const byCategory = await db.execute(`
  SELECT c.slug, c.name, COUNT(*) as count,
    SUM(CASE WHEN p.stock > 0 THEN 1 ELSE 0 END) as with_stock
  FROM products p
  JOIN categories c ON p.categoryId = c.id
  WHERE p.isActive = 1
  GROUP BY c.slug, c.name
  ORDER BY count DESC
`)
console.log('\n=== ACTIVE PRODUCTS BY CATEGORY ===')
console.table(byCategory.rows)

// Non-peripheral categories that Elit and Invid now have
const nonPeriph = await db.execute(`
  SELECT c.slug, c.name, s.name as supplier, COUNT(*) as count
  FROM products p
  JOIN categories c ON p.categoryId = c.id
  JOIN suppliers s ON p.providerId = s.id
  WHERE p.isActive = 1
  AND c.slug NOT IN ('perifericos', 'teclados', 'mouse', 'parlantes', 'auriculares', 'mousepads',
    'webcams', 'microfonos', 'joysticks', 'kits-gamer',
    'componentes-de-pc', 'placas-de-video', 'microprocesadores', 'motherboards',
    'memorias-ram', 'discos-ssd', 'discos-hdd', 'fuentes', 'gabinetes',
    'refrigeracion', 'pastas-termicas', 'cables-y-adaptadores', 'placas-de-red')
  GROUP BY c.slug, c.name, s.name
  ORDER BY count DESC
`)
console.log('\n=== NON-PERIPHERAL CATEGORIES (Elit/Invid - restored) ===')
console.table(nonPeriph.rows)

// Total counts
const totals = await db.execute(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) as active,
    SUM(CASE WHEN isActive = 0 THEN 1 ELSE 0 END) as inactive,
    SUM(CASE WHEN stock > 0 AND categoryId IS NOT NULL AND isActive = 1 THEN 1 ELSE 0 END) as visible
  FROM products
`)
console.log('\n=== TOTALS ===')
console.table(totals.rows)

await db.close()
