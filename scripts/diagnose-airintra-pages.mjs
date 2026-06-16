// Diagnostic script: fetches the raw response of specific Air Intra pages
// to understand exactly what's coming back from pages 20-25 (the broken ones).
//
// Usage:
//   node scripts/diagnose-airintra-pages.mjs
//   node scripts/diagnose-airintra-pages.mjs 20 21 22 23 24 25
//   node scripts/diagnose-airintra-pages.mjs 20 25   # range
//
// Output: prints raw bytes, cleaned text, and detection of product-like JSON objects.

import { createClient } from '@libsql/client'

const TURSO_URL = 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io'
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw'

const db = createClient({ url: TURSO_URL, authToken: TURSO_AUTH_TOKEN })

// Parse CLI args: support both list (20 21 22) and range (20 25)
const args = process.argv.slice(2)
let pagesToTest = []
if (args.length === 0) {
  pagesToTest = [20, 21, 22, 23, 24, 25]
} else if (args.length === 2 && !args[0].includes(',')) {
  // Range: start end
  const start = parseInt(args[0], 10)
  const end = parseInt(args[1], 10)
  for (let p = start; p <= end; p++) pagesToTest.push(p)
} else {
  pagesToTest = args.flatMap(a => a.split(',').map(n => parseInt(n, 10)))
}

console.log(`\n=== Air Intra Diagnostic ===`)
console.log(`Pages to test: ${pagesToTest.join(', ')}\n`)

async function main() {
  // 1. Find Air Intra supplier
  const r = await db.execute({
    sql: `SELECT id, name, apiType, apiBaseUrl, apiUsername, apiPassword FROM suppliers WHERE apiType = ? OR name LIKE ?`,
    args: ['air_intra', '%Air Intra%'],
  })

  if (r.rows.length === 0) {
    console.error('ERROR: No Air Intra supplier found in DB')
    process.exit(1)
  }

  const supplier = r.rows[0]
  console.log(`Supplier: ${supplier.name} (id=${supplier.id})`)
  console.log(`API Type: ${supplier.apiType}`)
  console.log(`Base URL: ${supplier.apiBaseUrl}`)
  console.log(`Username: ${supplier.apiUsername}`)
  console.log(`Password: ${'*'.repeat(String(supplier.apiPassword).length)}\n`)

  const baseUrl = supplier.apiBaseUrl || 'https://api.air-intra.com/v2'

  // 2. Login
  console.log(`Logging in...`)
  const authRes = await fetch(
    `${baseUrl}/?q=login&user=${encodeURIComponent(supplier.apiUsername)}&pass=${encodeURIComponent(supplier.apiPassword)}`
  )
  console.log(`  Login HTTP ${authRes.status}`)
  const authRaw = await authRes.text()
  console.log(`  Login raw response (${authRaw.length} bytes): ${authRaw.substring(0, 200)}`)

  let token = null
  let exchangeRate = null
  try {
    const authJson = JSON.parse(authRaw)
    token = authJson.token || authJson.data?.token
    exchangeRate = authJson.cotiza || authJson.data?.cotiza
  } catch (e) {
    // try to extract token via regex
    const m = authRaw.match(/"token"\s*:\s*"([^"]+)"/)
    if (m) token = m[1]
  }

  if (!token) {
    console.error('FATAL: Could not extract token from login response')
    db.close()
    process.exit(1)
  }

  console.log(`  Token: ${token.substring(0, 20)}...`)
  console.log(`  Exchange rate: ${exchangeRate}\n`)

  // 3. Fetch each requested page and dump diagnostics
  for (const page of pagesToTest) {
    console.log(`\n--- Page ${page} ---`)
    const t0 = Date.now()
    try {
      const res = await fetch(`${baseUrl}/?q=articulos&page=${page}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      const dt = Date.now() - t0
      console.log(`  HTTP ${res.status} in ${dt}ms`)

      const raw = await res.text()
      console.log(`  Raw length: ${raw.length} bytes`)

      // Show first 800 bytes
      console.log(`  Raw preview (first 800 chars):`)
      console.log('  ' + raw.substring(0, 800).replace(/\n/g, '\n  '))

      // Try to detect product objects via the same extractor logic
      const objStarts = []
      for (let i = 0; i < raw.length; i++) {
        if (raw[i] === '{') objStarts.push(i)
      }
      console.log(`  Total '{' chars in raw: ${objStarts.length}`)

      // Try parsing as JSON directly
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          console.log(`  ✓ Parsed as JSON array of ${parsed.length} items`)
          if (parsed.length > 0) {
            console.log(`  First item keys: ${Object.keys(parsed[0]).join(', ')}`)
          }
        } else {
          console.log(`  ✓ Parsed as JSON ${typeof parsed} (not array)`)
        }
      } catch (e) {
        console.log(`  ✗ Direct JSON.parse failed: ${e.message.substring(0, 100)}`)

        // Try stripPhpNotices + JSON.parse
        const cleaned = stripPhpNotices(raw)
        console.log(`  After stripPhpNotices: ${cleaned.length} bytes`)
        try {
          const parsed = JSON.parse(cleaned)
          if (Array.isArray(parsed)) {
            console.log(`  ✓ Cleaned+parsed: array of ${parsed.length} items`)
            if (parsed.length > 0) {
              console.log(`  First item keys: ${Object.keys(parsed[0]).join(', ')}`)
            }
          }
        } catch (e2) {
          console.log(`  ✗ Cleaned parse also failed: ${e2.message.substring(0, 100)}`)
          console.log(`  Cleaned preview: ${cleaned.substring(0, 300)}`)

          // Run extractor
          const extracted = extractProductsFromCorruptedJson(cleaned)
          console.log(`  Extractor found ${extracted.length} product-like objects`)
          if (extracted.length > 0) {
            console.log(`  First extracted keys: ${Object.keys(extracted[0]).join(', ')}`)
          }
        }
      }
    } catch (e) {
      console.log(`  FETCH ERROR: ${e.message}`)
    }

    // Small delay between requests to be polite
    await new Promise(r => setTimeout(r, 1500))
  }

  // 4. Bonus: try fetching the SAME pages via syp endpoint
  console.log(`\n\n=== BONUS: same pages via 'syp' endpoint ===`)
  for (const page of pagesToTest.slice(0, 3)) {
    console.log(`\n--- syp page ${page} ---`)
    try {
      const res = await fetch(`${baseUrl}/?q=syp&page=${page}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      const raw = await res.text()
      console.log(`  HTTP ${res.status}, raw ${raw.length} bytes`)
      console.log(`  Preview: ${raw.substring(0, 300).replace(/\n/g, ' ')}`)
      try {
        const parsed = JSON.parse(stripPhpNotices(raw))
        if (Array.isArray(parsed)) {
          console.log(`  ✓ array of ${parsed.length} items`)
        }
      } catch (e) {
        const extracted = extractProductsFromCorruptedJson(stripPhpNotices(raw))
        console.log(`  Extractor: ${extracted.length} products`)
      }
    } catch (e) {
      console.log(`  ERROR: ${e.message}`)
    }
    await new Promise(r => setTimeout(r, 1500))
  }

  // 5. Bonus 2: try smaller page size param (variations)
  console.log(`\n\n=== BONUS 2: try alternate pagination params on page 20 ===`)
  const paramVariations = [
    '&por_pagina=100',
    '&perPage=100',
    '&limit=100',
    '&items=100',
    '&size=100',
    '&por_pagina=50',
  ]
  for (const param of paramVariations) {
    console.log(`\n--- articulos page=20 ${param} ---`)
    try {
      const res = await fetch(`${baseUrl}/?q=articulos&page=20${param}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      const raw = await res.text()
      console.log(`  HTTP ${res.status}, raw ${raw.length} bytes`)
      const cleaned = stripPhpNotices(raw)
      try {
        const parsed = JSON.parse(cleaned)
        if (Array.isArray(parsed)) {
          console.log(`  ✓ array of ${parsed.length} items`)
          if (parsed.length > 0 && parsed[0].codigo) {
            console.log(`  First codigo: ${parsed[0].codigo}`)
          }
        }
      } catch (e) {
        const extracted = extractProductsFromCorruptedJson(cleaned)
        console.log(`  Extractor: ${extracted.length} products`)
      }
    } catch (e) {
      console.log(`  ERROR: ${e.message}`)
    }
    await new Promise(r => setTimeout(r, 1500))
  }

  db.close()
  console.log('\n=== Done ===')
}

function stripPhpNotices(text) {
  // Mirror of the production stripPhpNotices
  // 1. Remove <b>...</b> tags
  let cleaned = text.replace(/<b>[^<]*<\/b>/gi, '')
  // 2. Remove PHP Notice/Warning/Parse error lines (multiline-aware)
  cleaned = cleaned.replace(/(?:<br\s*\/?>\s*)?(?:PHP (?:Notice|Warning|Parse error|Deprecated|Fatal error|Strict Standards)|Notice:|Warning:|Deprecated:)[^\n\r]*(\r?\n)?/gi, '')
  // 3. Remove stray <br> tags
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n')
  return cleaned.trim()
}

function extractProductsFromCorruptedJson(text) {
  const products = []
  let i = 0
  while (i < text.length) {
    if (text[i] !== '{') { i++; continue }
    let depth = 0, inStr = false, esc = false, objEnd = -1
    for (let j = i; j < text.length; j++) {
      const ch = text[j]
      if (esc) { esc = false; continue }
      if (ch === '\\' && inStr) { esc = true; continue }
      if (ch === '"') { inStr = !inStr; continue }
      if (inStr) continue
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) { objEnd = j; break }
      }
    }
    if (objEnd === -1) { i++; continue }
    const objText = text.substring(i, objEnd + 1)
    if (objText.includes('"codigo"') || objText.includes('"codiart"')) {
      try {
        const obj = JSON.parse(objText)
        products.push(obj)
      } catch {}
    }
    i = objEnd + 1
  }
  return products
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
