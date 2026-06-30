// Quick probe: test pages 26-40 to see if data resumes after the broken 20-25 range.
// Also tests a few "far" pages (50, 100, 200) to estimate catalog size.

import { createClient } from '@libsql/client'

const TURSO_URL = 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io'
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw'

const db = createClient({ url: TURSO_URL, authToken: TURSO_AUTH_TOKEN })

const pagesToTest = [26, 27, 28, 29, 30, 35, 40, 50, 100, 200]

async function main() {
  const r = await db.execute({
    sql: `SELECT apiBaseUrl, apiUsername, apiPassword FROM suppliers WHERE apiType = ?`,
    args: ['air_intra'],
  })
  const supplier = r.rows[0]
  const baseUrl = supplier.apiBaseUrl || 'https://api.air-intra.com/v2'

  // Login
  console.log('Logging in...')
  const authRes = await fetch(
    `${baseUrl}/?q=login&user=${encodeURIComponent(supplier.apiUsername)}&pass=${encodeURIComponent(supplier.apiPassword)}`
  )
  const authRaw = await authRes.text()
  let token
  try { token = JSON.parse(authRaw).token } catch { token = authRaw.match(/"token"\s*:\s*"([^"]+)"/)?.[1] }
  if (!token) { console.error('No token'); process.exit(1) }
  console.log(`Token OK\n`)

  const results = []
  for (const page of pagesToTest) {
    process.stdout.write(`Page ${page}... `.padEnd(15))
    try {
      const t0 = Date.now()
      const res = await fetch(`${baseUrl}/?q=articulos&page=${page}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const dt = Date.now() - t0
      const raw = await res.text()
      const cleaned = stripPhpNotices(raw)
      let parsed = null
      try { parsed = JSON.parse(cleaned) } catch {}

      if (Array.isArray(parsed)) {
        console.log(`HTTP ${res.status} | ${dt}ms | raw=${raw.length}B | array of ${parsed.length} items`)
        results.push({ page, status: 'ok', count: parsed.length, raw: raw.length })
      } else {
        const isNoticeOnly = cleaned.length < 50 || /^:\s*Undefined/.test(cleaned)
        console.log(`HTTP ${res.status} | ${dt}ms | raw=${raw.length}B | ${isNoticeOnly ? 'NOTICES ONLY' : 'other'}`)
        results.push({ page, status: 'broken', count: 0, raw: raw.length })
      }
    } catch (e) {
      console.log(`FETCH ERROR: ${e.message.substring(0, 80)}`)
      results.push({ page, status: 'error', count: 0, raw: 0 })
    }
    await new Promise(r => setTimeout(r, 2000))
  }

  console.log('\n=== SUMMARY ===')
  console.log('page | status  | products | raw bytes')
  console.log('-----+---------+----------+----------')
  for (const r of results) {
    console.log(`${String(r.page).padStart(4)} | ${r.status.padEnd(7)} | ${String(r.count).padStart(8)} | ${r.raw}`)
  }

  const okCount = results.filter(r => r.status === 'ok' && r.count > 0).length
  const brokenCount = results.filter(r => r.status === 'broken').length
  console.log(`\n${okCount}/${results.length} pages returned data; ${brokenCount} were broken`)

  db.close()
}

function stripPhpNotices(text) {
  let cleaned = text.replace(/<b>[^<]*<\/b>/gi, '')
  cleaned = cleaned.replace(/(?:<br\s*\/?>\s*)?(?:PHP (?:Notice|Warning|Parse error|Deprecated|Fatal error|Strict Standards)|Notice:|Warning:|Deprecated:)[^\n\r]*(\r?\n)?/gi, '')
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n')
  return cleaned.trim()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
