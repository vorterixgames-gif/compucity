// Re-sync all suppliers: Elit, Invid Computers, and Air Intra
import { createClient } from '@libsql/client'

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw'
})

const ADMIN_SECRET = 'compucity_hmac_prod_2026_a8f3e1b9c7d2'

async function main() {
  // Get supplier IDs
  const suppliers = await db.execute('SELECT id, name, apiType FROM suppliers')
  console.log('Suppliers:', suppliers.rows)

  // Get admin token first
  const authRes = await fetch('http://localhost:3000/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'compucity2026' })
  })
  console.log('Auth response status:', authRes.status)
  const authData = await authRes.json()
  console.log('Auth data:', authData.ok ? 'OK' : authData.error)

  if (!authData.ok) {
    console.log('Auth failed, trying with ADMIN_SECRET cookie approach...')
  }

  const token = authData.token || ''

  // Sync Elit
  const elitSupplier = suppliers.rows.find(s => s.apiType === 'elit')
  if (elitSupplier) {
    console.log(`\n=== SYNCING ELIT (${elitSupplier.id}) ===`)
    try {
      const syncRes = await fetch('http://localhost:3000/api/admin/suppliers/sync', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': `admin_token=${token}`
        },
        body: JSON.stringify({ supplierId: elitSupplier.id })
      })
      const syncData = await syncRes.json()
      console.log('Elit sync result:', JSON.stringify(syncData, null, 2))
    } catch (err) {
      console.error('Elit sync error:', err.message)
    }
  }

  // Sync Invid
  const invidSupplier = suppliers.rows.find(s => s.apiType === 'invid')
  if (invidSupplier) {
    console.log(`\n=== SYNCING INVID (${invidSupplier.id}) ===`)
    try {
      const syncRes = await fetch('http://localhost:3000/api/admin/suppliers/sync', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': `admin_token=${token}`
        },
        body: JSON.stringify({ supplierId: invidSupplier.id })
      })
      const syncData = await syncRes.json()
      console.log('Invid sync result:', JSON.stringify(syncData, null, 2))
    } catch (err) {
      console.error('Invid sync error:', err.message)
    }
  }

  // Sync Air Intra
  const airIntraSupplier = suppliers.rows.find(s => s.apiType === 'air_intra')
  if (airIntraSupplier) {
    console.log(`\n=== SYNCING AIR INTRA (${airIntraSupplier.id}) ===`)
    try {
      const syncRes = await fetch('http://localhost:3000/api/admin/suppliers/sync', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': `admin_token=${token}`
        },
        body: JSON.stringify({ supplierId: airIntraSupplier.id })
      })
      const syncData = await syncRes.json()
      console.log('Air Intra sync result:', JSON.stringify(syncData, null, 2))
    } catch (err) {
      console.error('Air Intra sync error:', err.message)
    }
  }

  await db.close()
}

main().catch(console.error)
