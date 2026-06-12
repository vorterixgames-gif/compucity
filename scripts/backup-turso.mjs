#!/usr/bin/env node
/**
 * Compucity Turso Database Backup Script
 * 
 * Dumps all tables from the database into a JSON backup file.
 * Works with both local SQLite and remote Turso databases.
 * 
 * Usage: node scripts/backup-turso.mjs
 * 
 * Environment: reads DATABASE_URL and TURSO_AUTH_TOKEN from .env
 */

import { createClient } from '@libsql/client'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env
const envPath = join(__dirname, '..', '.env')
const envContent = readFileSync(envPath, 'utf-8')
const envVars = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) envVars[match[1].trim()] = match[2].trim()
}

// Prefer the remote Turso URL for backup (the local .env points to a local file)
const TURSO_URL = 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io'
const TURSO_AUTH_TOKEN = envVars.TURSO_AUTH_TOKEN || envVars.AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw'

// If .env has a Turso URL, use it; otherwise use the known remote URL
const DATABASE_URL = (envVars.DATABASE_URL && (envVars.DATABASE_URL.startsWith('libsql://') || envVars.DATABASE_URL.startsWith('https://')))
  ? envVars.DATABASE_URL
  : TURSO_URL

// Determine if we're connecting to a local or remote database
const isRemote = DATABASE_URL.startsWith('libsql://') || DATABASE_URL.startsWith('https://') || DATABASE_URL.startsWith('http://')

console.log('=== Compucity Database Backup ===')
console.log(`Database: ${isRemote ? 'Remote (Turso)' : 'Local (SQLite)'}`)
console.log(`URL: ${DATABASE_URL}`)
console.log()

// Create database client
const db = createClient({
  url: DATABASE_URL,
  authToken: isRemote ? TURSO_AUTH_TOKEN : undefined,
})

async function main() {
  // 1. Get all tables
  const tablesResult = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  const tables = tablesResult.rows.map(r => r.name)

  console.log(`Found ${tables.length} tables: ${tables.join(', ')}`)
  console.log()

  // 2. Dump each table
  const backup = {}
  const rowCounts = {}

  for (const table of tables) {
    try {
      const result = await db.execute(`SELECT * FROM "${table}"`)
      backup[table] = result.rows
      rowCounts[table] = result.rows.length
      console.log(`  ✓ ${table}: ${result.rows.length} rows`)
    } catch (e) {
      console.log(`  ✗ ${table}: skipped (${e.message})`)
      backup[table] = []
      rowCounts[table] = 0
    }
  }

  // 3. Write backup file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = '/home/z/my-project/download/backups'
  mkdirSync(backupDir, { recursive: true })

  const filepath = join(backupDir, `compucity_turso_backup_${timestamp}.json`)
  const jsonStr = JSON.stringify(backup, null, 2)
  writeFileSync(filepath, jsonStr)

  // 4. Report
  const sizeBytes = Buffer.byteLength(jsonStr)
  const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2)
  const sizeKB = (sizeBytes / 1024).toFixed(1)

  console.log()
  console.log('=== Backup Complete ===')
  console.log(`File: ${filepath}`)
  console.log(`Size: ${sizeMB} MB (${sizeKB} KB)`)
  console.log(`Tables: ${tables.length}`)
  console.log()
  console.log('Row counts by table:')

  // Key tables requested
  const keyTables = ['products', 'categories', 'brands', 'orders', 'customers', 'suppliers']
  for (const t of keyTables) {
    const count = rowCounts[t]
    console.log(`  ${t}: ${count !== undefined ? count : 'N/A'}`)
  }

  // Other tables
  const otherTables = tables.filter(t => !keyTables.includes(t))
  if (otherTables.length > 0) {
    console.log()
    console.log('Other tables:')
    for (const t of otherTables) {
      console.log(`  ${t}: ${rowCounts[t]}`)
    }
  }

  // Total rows
  const totalRows = Object.values(rowCounts).reduce((a, b) => a + b, 0)
  console.log()
  console.log(`Total rows across all tables: ${totalRows}`)
}

main().catch(e => {
  console.error('Backup failed:', e)
  process.exit(1)
})
