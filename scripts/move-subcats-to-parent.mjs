import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'

const envContent = readFileSync('.env', 'utf-8')
const envVars = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) envVars[match[1].trim()] = match[2].trim()
}

const TURSO_URL = 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io'
const TURSO_AUTH_TOKEN = envVars.TURSO_AUTH_TOKEN || envVars.AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw'

const db = createClient({ url: TURSO_URL, authToken: TURSO_AUTH_TOKEN })

console.log('=== MOVER SUB-CATEGORÍAS A PADRE ===\n')

// 1. Mover productos de sub-categorías de Monitores al padre
const monitoresResult = await db.execute({ sql: "SELECT id FROM categories WHERE slug = 'monitores'" })
const monitoresId = monitoresResult.rows[0].id

const monitoresSubcats = await db.execute({
  sql: 'SELECT id, name, slug FROM categories WHERE parentId = ?',
  args: [monitoresId]
})

console.log(`Monitores (padre ID: ${monitoresId}):`)
console.log(`  Sub-categorías a desactivar: ${monitoresSubcats.rows.length}`)

for (const sub of monitoresSubcats.rows) {
  // Mover productos al padre
  const moveResult = await db.execute({
    sql: 'UPDATE products SET categoryId = ?, updatedAt = ? WHERE categoryId = ?',
    args: [monitoresId, new Date().toISOString(), sub.id]
  })
  console.log(`  ${sub.name} (${sub.slug}): ${moveResult.rowsAffected} productos movidos`)
  
  // Desactivar sub-categoría
  await db.execute({
    sql: 'UPDATE categories SET enabled = 0, updatedAt = ? WHERE id = ?',
    args: [new Date().toISOString(), sub.id]
  })
  console.log(`    → Desactivada`)
}

// 2. Mover productos de sub-categorías de Notebooks al padre
const notebooksResult = await db.execute({ sql: "SELECT id FROM categories WHERE slug = 'notebooks'" })
const notebooksId = notebooksResult.rows[0].id

const notebooksSubcats = await db.execute({
  sql: 'SELECT id, name, slug FROM categories WHERE parentId = ?',
  args: [notebooksId]
})

console.log(`\nNotebooks (padre ID: ${notebooksId}):`)
console.log(`  Sub-categorías a desactivar: ${notebooksSubcats.rows.length}`)

for (const sub of notebooksSubcats.rows) {
  // Mover productos al padre
  const moveResult = await db.execute({
    sql: 'UPDATE products SET categoryId = ?, updatedAt = ? WHERE categoryId = ?',
    args: [notebooksId, new Date().toISOString(), sub.id]
  })
  console.log(`  ${sub.name} (${sub.slug}): ${moveResult.rowsAffected} productos movidos`)
  
  // Desactivar sub-categoría
  await db.execute({
    sql: 'UPDATE categories SET enabled = 0, updatedAt = ? WHERE id = ?',
    args: [new Date().toISOString(), sub.id]
  })
  console.log(`    → Desactivada`)
}

console.log('\n✓ Sub-categorías desactivadas y productos movidos al padre')

process.exit(0)
