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

console.log('=== Aplicando migración #27: internalTaxRate REAL ===\n')

// Check if already exists
const cols = await db.execute({ sql: "PRAGMA table_info(products)", args: [] })
const exists = cols.rows.some(c => c.name === 'internalTaxRate')

if (exists) {
  console.log('✓ La columna internalTaxRate YA EXISTE. No se requiere migración.')
  process.exit(0)
}

console.log('✗ La columna NO existe. Aplicando ALTER TABLE...')

try {
  await db.execute({ sql: 'ALTER TABLE products ADD COLUMN internalTaxRate REAL', args: [] })
  console.log('✓ Columna internalTaxRate REAL agregada a products')
} catch (e) {
  console.error(`✗ Error al aplicar migración: ${e.message}`)
  process.exit(1)
}

// Verify
const cols2 = await db.execute({ sql: "PRAGMA table_info(products)", args: [] })
const nowExists = cols2.rows.some(c => c.name === 'internalTaxRate')
console.log(`\nVerificación: columna presente = ${nowExists ? '✓ SÍ' : '✗ NO'}`)

// Try the SELECT from admin API
console.log('\n=== Probando SELECT del admin API ===')
try {
  const r = await db.execute({
    sql: `SELECT p.id, p.name, p.internalTaxRate FROM products p LIMIT 3`,
    args: []
  })
  console.log(`✓ SELECT OK — ${r.rows.length} filas devueltas`)
  for (const row of r.rows) {
    console.log(`  ${row.name?.substring(0, 40)}: internalTaxRate=${row.internalTaxRate}`)
  }
} catch (e) {
  console.error(`✗ SELECT aún falla: ${e.message}`)
  process.exit(1)
}

console.log('\n=== MIGRACIÓN COMPLETADA ===')
