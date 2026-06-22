#!/usr/bin/env node
/**
 * Sync Brands → Turso (corre en GitHub Actions, no en Vercel).
 *
 * ¿Por qué este script existe?
 * ─────────────────────────────────
 * Sesión 44: antes, el cron diario de Vercel (/api/cron/sync) hacía re-detección
 * de brands después de sincronizar Elit + Invid. Eso consumía 1.5-2.5h/mes de
 * Fluid Active CPU (37-62% del límite Hobby de 4h/mes) en algo que casi nunca
 * cambiaba (las brands solo cambian cuando entran productos nuevos, lo cual
 * no pasa en el cron diario — solo en syncs manuales o en el sync de Air Intra
 * que corre en GitHub Actions).
 *
 * Solución: mover la re-detección de brands a GitHub Actions (gratis, 2000 min/mes)
 * y dejar el cron de Vercel solo con sync de stock/precios.
 *
 * Variables de entorno (ya configuradas en GitHub Secrets):
 * - TURSO_URL: libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io
 * - TURSO_TOKEN: eyJ...
 *
 * Uso local: node scripts/sync-brands-external.mjs
 * Uso GitHub Actions: automático via .github/workflows/sync-brands.yml
 */

const TURSO_URL = process.env.TURSO_URL || 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io'
const TURSO_TOKEN = process.env.TURSO_TOKEN || ''

if (!TURSO_TOKEN) {
  console.error('✗ TURSO_TOKEN no configurado. Setealo en env o GitHub Secrets.')
  process.exit(1)
}

// ============================================
// BRAND_PATTERNS — copia textual de src/lib/brand-patterns.ts
// (GitHub Actions no compila TypeScript, así que lo duplicamos acá en JS)
// IMPORTANTE: si agregás una marca nueva en brand-patterns.ts, agregala acá también.
// ============================================
const BRAND_PATTERNS = [
  { name: 'AMD', slug: 'amd', pattern: /\bAMD\b|\bRYZEN\b|\bATHLON\b|\bRADEON\b|\bRX\s\d/i },
  { name: 'Intel', slug: 'intel', pattern: /\bINTEL\b|\bCORE\s*I[3579]\b|\bPENTIUM\b|\bCELERON\b|\bCORE ULTRA\b|\bARC\s*A[37]\b/i },
  { name: 'NVIDIA', slug: 'nvidia', pattern: /\bNVIDIA\b|\bRTX\b|\bGTX\b|\bGEFORCE\b|\bQUADRO\b|\bGT 1030\b/i },
  { name: 'ASUS', slug: 'asus', pattern: /\bASUS\b|\bROG\b|\bTUF\b|\bPRIME\b|\bPROART\b|\bZENBOOK\b|\bVIVOBOOK\b|\bPN\d/i },
  { name: 'Gigabyte', slug: 'gigabyte', pattern: /\bGIGABYTE\b|\bAORUS\b/i },
  { name: 'MSI', slug: 'msi', pattern: /\bMSI\b|\bSPATIUM\b|\bRAIDER\b|\bTHIN\b|\bCYBORG\b/i },
  { name: 'ASRock', slug: 'asrock', pattern: /\bASROCK\b|\bAS ROCK\b/i },
  { name: 'Biostar', slug: 'biostar', pattern: /\bBIOSTAR\b/i },
  { name: 'Kingston', slug: 'kingstontechnology', pattern: /\bKINGSTON\b|\bDATATRAVELER\b|\bDATA TRAVELER\b|\bA400\b|\bKC3000\b|\bKC600\b|\bDC600\b|\bNV3\b/i },
  { name: 'Corsair', slug: 'corsair', pattern: /\bCORSAIR\b|\bVENGEANCE\b/i },
  { name: 'Samsung', slug: 'samsung', pattern: /\bSAMSUNG\b|\bODYSSEY\b|\bVIEWFINITY\b/i },
  { name: 'Seagate', slug: 'seagate', pattern: /\bSEAGATE\b|\bBARRACUDA\b|\bIRONWOLF\b|\bSKYHAWK\b|\bFIRECUDA\b|\bEXPANSION\b|\bONE TOUCH\b/i },
  { name: 'WD', slug: 'wd', pattern: /\bWESTERN\s*DIGITAL\b|\bWD\b/i },
  { name: 'Toshiba', slug: 'toshiba', pattern: /\bTOSHIBA\b|\bCANVIO\b/i },
  { name: 'Hiksemi', slug: 'hiksemi', pattern: /\bHIKSEMI\b/i },
  { name: 'ADATA / XPG', slug: 'adata', pattern: /\bADATA\b|\bXPG\b|\bGAMMIX\b|\bLEGEND\b|\bSPECTRIX\b|\bSU650\b|\bSU630\b|\bCORE\s*REACTOR\b/i },
  { name: 'Lexar', slug: 'lexar', pattern: /\bLEXAR\b|\bNM610\b|\bNM790\b|\bNQ100\b|\bNQ780\b|\bJUMPDRIVE\b/i },
  { name: 'Crucial', slug: 'crucial', pattern: /\bCRUCIAL\b|\bBX500\b|\bP310\b|\bE100\b/i },
  { name: 'Memox', slug: 'memox', pattern: /\bMEMOX\b/i },
  { name: 'G.Skill', slug: 'gskill', pattern: /\bG\.?SKILL\b|\bTRIDENT\b|\bRIPJAWS\b/i },
  { name: 'Patriot', slug: 'patriot', pattern: /\bPATRIOT\b|\bP300\b|\bP210\b|\bRENEGADE\b/i },
  { name: 'Kioxia', slug: 'kioxia', pattern: /\bKIOXIA\b/i },
  { name: 'Silicon Power', slug: 'silicon-power', pattern: /\bSILICON\s*POWER\b/i },
  { name: 'Leven', slug: 'leven', pattern: /\bLEVEN\b/i },
  { name: 'PNY', slug: 'pny', pattern: /\bPNY\b/i },
  { name: 'SOLIDIGM', slug: 'solidigm', pattern: /\bSOLIDIGM\b/i },
  { name: 'SanDisk', slug: 'sandisk', pattern: /\bSANDISK\b/i },
  { name: 'Team Group', slug: 'teamgroup', pattern: /\bTEAM\s*GROUP\b/i },
  { name: 'Biwin', slug: 'biwin', pattern: /\bBIWIN\b/i },
  { name: 'Cooler Master', slug: 'cooler_master', pattern: /\bCOOLER\s*MASTER\b|\bCM\s*(MASTER|ML|MF)/i },
  { name: 'Thermaltake', slug: 'thermaltake', pattern: /\bTHERMALTAKE\b|\bTt\s*(CT|Liquid|LA|Ring|SWAFAN)/i },
  { name: 'DeepCool', slug: 'deepcool', pattern: /\bDEEPCOOL\b/i },
  { name: 'Noctua', slug: 'noctua', pattern: /\bNOCTUA\b/i },
  { name: 'Arctic', slug: 'arctic', pattern: /\bARCTIC\b/i },
  { name: 'be quiet!', slug: 'be-quiet', pattern: /\bBE\s*QUIET\b|\bDARK\s*POWER\b|\bPURE\s*LOOP\b|\bSILENT\s*LOOP\b/i },
  { name: 'Gamemax', slug: 'gamemax', pattern: /\bGAMEMAX\b/i },
  { name: 'NZXT', slug: 'nzxt', pattern: /\bNZXT\b/i },
  { name: 'Seasonic', slug: 'seasonic', pattern: /\bSEASONIC\b/i },
  { name: 'EVGA', slug: 'evga', pattern: /\bEVGA\b/i },
  { name: 'Aerocool', slug: 'aerocool', pattern: /\bAEROCOOL\b/i },
  { name: 'Sentey', slug: 'sentey', pattern: /\bSENTEY\b/i },
  { name: 'Naceb', slug: 'naceb', pattern: /\bNACEB\b/i },
  { name: 'Kelyx', slug: 'kelyx', pattern: /\bKELYX\b/i },
  { name: 'Arkham', slug: 'arkham', pattern: /\bARKHAM\b/i },
  { name: 'Teros', slug: 'teros', pattern: /\bTEROS\b|\bTE-/i },
  { name: 'Raptor', slug: 'raptor', pattern: /\bRAPTOR\b/i },
  { name: 'E-View', slug: 'e-view', pattern: /\bE[\s\-]?VIEW\b/i },
  { name: 'Cromax', slug: 'cromax', pattern: /\bCROMAX\b/i },
  { name: 'CX', slug: 'cx', pattern: /\bCX\b/i },
  { name: 'Logitech', slug: 'logitech', pattern: /\bLOGITECH\b|\bC920\b|\bC270\b|\bBRIO\b|\bYETI\b/i },
  { name: 'Redragon', slug: 'redragon', pattern: /\bREDRAGON\b/i },
  { name: 'HyperX', slug: 'hyperx', pattern: /\bHYPERX\b|\bCLOUD\b|\bALLOY\b|\bQUADCAST\b/i },
  { name: 'Razer', slug: 'razer', pattern: /\bRAZER\b|\bKRAKEN\b|\bDEATHADDER\b|\bVIPER\b|\bBLACKWIDOW\b|\bHUNSTMAN\b|\bKIYO\b|\bGIGANTUS\b/i },
  { name: 'Genius', slug: 'genius', pattern: /\bGENIUS\b/i },
  { name: 'JBL', slug: 'jbl', pattern: /\bJBL\b|\bQUANTUM\b/i },
  { name: 'Philips', slug: 'philips', pattern: /\bPHILIPS\b|\bEVNIA\b/i },
  { name: 'Klipxtreme', slug: 'klipxtreme', pattern: /\bKLIPXTREME\b/i },
  { name: 'X-tech', slug: 'x-tech', pattern: /\bX[\s\-]?TECH\b/i },
  { name: 'LG', slug: 'lg', pattern: /\bLG\b.*\b(ULTRAGEAR|GRAM|MONITOR|TV|PULGADA|PANTALLA|NOTEBOOK|AIO)\b|\bULTRAGEAR\b|\bLG\s*\d{2}/i },
  { name: 'Dell', slug: 'dell', pattern: /\bDELL\b|\bINSPIRON\b|\bLATITUDE\b|\bALIENWARE\b|\bOPTIPLEX\b/i },
  { name: 'HP', slug: 'hp', pattern: /\bHP\b|\bPAVILION\b|\bOMEN\b|\bVICTUS\b|\bDRAGONFLY\b|\bZBOOK\b|\bELITEDESK\b|\bPRODESK\b/i },
  { name: 'Lenovo', slug: 'lenovo', pattern: /\bLENOVO\b|\bTHINKPAD\b|\bIDEAPAD\b|\bLOQ\b|\bLEGION\b|\bYOGA\b|\bTHINKCENTRE\b|\bIDEACENTRE\b/i },
  { name: 'Acer', slug: 'acer', pattern: /\bACER\b|\bASPIRE\b|\bNITRO\b|\bPREDATOR\b/i },
  { name: 'AOC', slug: 'aoc', pattern: /\bAOC\b|\bAGON\b/i },
  { name: 'BenQ', slug: 'benq', pattern: /\bBENQ\b|\bZOWIE\b/i },
  { name: 'ViewSonic', slug: 'viewsonic', pattern: /\bVIEWSONIC\b/i },
  { name: 'TP-Link', slug: 'tplink', pattern: /\bTP[\s\-]?LINK\b|\bARCHER\b|\bDECO\b|\bTL\s*W\b|\bTAPO\b/i },
  { name: 'Mercusys', slug: 'mercusys', pattern: /\bMERCUSYS\b/i },
  { name: 'Cudy', slug: 'cudy', pattern: /\bCUDY\b/i },
  { name: 'Hikvision', slug: 'hikvision', pattern: /\bHIKVISION\b|\bDS-UPS\b/i },
  { name: 'D-Link', slug: 'dlink', pattern: /\bD[\s\-]?LINK\b/i },
  { name: 'Ubiquiti', slug: 'ubiquiti', pattern: /\bUBIQUITI\b|\bUNIFI\b/i },
  { name: 'Mikrotik', slug: 'mikrotik', pattern: /\bMIKROTIK\b|\bROUTEROS\b/i },
  { name: 'Tenda', slug: 'tenda', pattern: /\bTENDA\b/i },
  { name: 'Aruba', slug: 'aruba', pattern: /\bARUBA\b/i },
  { name: 'GlcFi', slug: 'glcfi', pattern: /\bGlcFi\b/i },
  { name: 'Huawei', slug: 'huawei', pattern: /\bHUAWEI\b|\bEKIT\b/i },
  { name: 'HPE', slug: 'hpe', pattern: /\bHPE\b/i },
  { name: 'Foxbox', slug: 'foxbox', pattern: /\bFOXBOX\b|\bCORVUS\b|\bPYXIS\b|\bWARP\b/i },
  { name: 'Harman Kardon', slug: 'harman', pattern: /\bHARMAN\b|\bKARDON\b/i },
  { name: 'Brother', slug: 'brother', pattern: /\bBROTHER\b/i },
  { name: 'Epson', slug: 'epson', pattern: /\bEPSON\b|\bECOTANK\b|\bWORKFORCE\b|\bPERFECTION\b/i },
  { name: 'Lexmark', slug: 'lexmark', pattern: /\bLEXMARK\b/i },
  { name: 'Canon', slug: 'canon', pattern: /\bCANON\b|\bPIXMA\b/i },
  { name: 'Honeywell', slug: 'honeywell', pattern: /\bHONEYWELL\b/i },
  { name: 'Ocom', slug: 'ocom', pattern: /\bOCOM\b/i },
  { name: 'Pantum', slug: 'pantum', pattern: /\bPANTUM\b/i },
  { name: 'Sapphire', slug: 'sapphire', pattern: /\bSAPPHIRE\b/i },
  { name: 'PowerColor', slug: 'powercolor', pattern: /\bPOWERCOLOR\b|\bPOWER\s*COLOR\b/i },
  { name: 'INNO3D', slug: 'inno3d', pattern: /\bINNO3D\b|\bINNO\s*3D\b/i },
  { name: 'EZVIZ', slug: 'ezviz', pattern: /\bEZVIZ\b/i },
  { name: 'Hilook', slug: 'hilook', pattern: /\bHILOOK\b/i },
  { name: 'Xiaomi', slug: 'xiaomi', pattern: /\bXIAOMI\b|\bROBOROCK\b|\bMI\s*\d{1,2}\b/i },
  { name: 'Nexxt', slug: 'nexxt', pattern: /\bNEXXT\b/i },
  { name: 'Loosafe', slug: 'loosafe', pattern: /\bLOOSAFE\b/i },
  { name: 'Ugreen', slug: 'ugreen', pattern: /\bUGREEN\b/i },
  { name: 'Vention', slug: 'vention', pattern: /\bVENTION\b/i },
  { name: 'APC', slug: 'schneiderelectric', pattern: /\bAPC\b/i },
  { name: 'Eaton', slug: 'eaton', pattern: /\bEATON\b/i },
  { name: 'CyberPower', slug: 'cyberpower', pattern: /\bCYBER\s*POWER\b/i },
  { name: 'Tripp Lite', slug: 'tripp-lite', pattern: /\bTRIPP\s*LITE\b/i },
  { name: 'Targus', slug: 'targus', pattern: /\bTARGUS\b/i },
  { name: 'Noganet', slug: 'noganet', pattern: /\bNOGANET\b|\bXO-/i },
  { name: 'Microsoft', slug: 'microsoft', pattern: /\bMICROSOFT\b|\bXBOX\b/i },
  { name: 'Sony', slug: 'sony', pattern: /\bSONY\b|\bDUALSHOCK\b|\bDUALSENSE\b|\bPS[45]\b/i },
  { name: 'Asustor', slug: 'asustor', pattern: /\bASUSTOR\b/i },
  { name: 'QNAP', slug: 'qnap', pattern: /\bQNAP\b/i },
  { name: 'Synology', slug: 'synology', pattern: /\bSYNOLOGY\b/i },
  { name: 'Intelaid', slug: 'intelaid', pattern: /\bINTELAID\b/i },
  { name: 'Furukawa', slug: 'furukawa', pattern: /\bFURUKAWA\b/i },
  { name: 'Fujitsu', slug: 'fujitsu', pattern: /\bFUJITSU\b|\bFI-/i },
  { name: 'Syx', slug: 'syx', pattern: /\bSYX\b/i },
  { name: 'Thronos', slug: 'thronos', pattern: /\bTHRONOS\b/i },
]

// ============================================
// Helpers de Turso (HTTP API directa, sin libsql client)
// ============================================
const TURSO_HTTP = TURSO_URL.replace('libsql://', 'https://') + '/v2/pipeline'

async function tursoExecute(sql, args = []) {
  const body = JSON.stringify({
    requests: [
      { type: 'execute', stmt: { sql, args } },
      { type: 'close' },
    ],
  })
  const res = await fetch(TURSO_HTTP, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body,
  })
  if (!res.ok) {
    throw new Error(`Turso HTTP ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  const result = data.results?.[0]?.response?.result
  if (!result) return { rows: [], rowsAffected: 0 }
  const cols = (result.cols || []).map(c => c.name)
  const rows = (result.rows || []).map(row =>
    row.reduce((obj, cell, i) => {
      obj[cols[i] || `col_${i}`] = cell.type === 'null' ? null : cell.value
      return obj
    }, {})
  )
  return { rows, rowsAffected: result.affected_row_count || 0 }
}

async function tursoBatch(statements) {
  // Turso pipeline soporta múltiples statements en 1 request
  const body = JSON.stringify({
    requests: [
      ...statements.map(s => ({ type: 'execute', stmt: { sql: s.sql, args: s.args || [] } })),
      { type: 'close' },
    ],
  })
  const res = await fetch(TURSO_HTTP, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body,
  })
  if (!res.ok) {
    throw new Error(`Turso batch HTTP ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  return data.results || []
}

// ============================================
// Helpers de escape (para INSERT/UPDATE con strings)
// ============================================
function sqlEscape(s) {
  if (s == null) return 'NULL'
  return `'${String(s).replace(/'/g, "''")}'`
}

// ============================================
// Lógica principal (mirror del bloque que estaba en el cron de Vercel)
// ============================================
async function syncBrands() {
  const startTime = Date.now()
  console.log('=== Brand sync started ===')
  console.log(`Time: ${new Date().toISOString()}`)
  console.log()

  // 1. Traer todos los productos activos
  console.log('→ Fetching active products...')
  const { rows: products } = await tursoExecute('SELECT id, name, specs FROM products WHERE isActive = 1')
  console.log(`  ✓ ${products.length} active products`)

  const brandProductCounts = new Map()
  const brandProductIds = new Map()

  // 2. Step 1: Matchear contra BRAND_PATTERNS (regex conocidas)
  console.log('→ Matching against brand patterns (regex)...')
  for (const product of products) {
    for (const bp of BRAND_PATTERNS) {
      if (bp.pattern.test(product.name)) {
        const key = bp.slug
        brandProductCounts.set(key, (brandProductCounts.get(key) || 0) + 1)
        if (!brandProductIds.has(key)) brandProductIds.set(key, [])
        brandProductIds.get(key).push(product.id)
        break
      }
    }
  }
  console.log(`  ✓ ${brandProductCounts.size} brands detected via regex`)

  // 3. Step 2: Para los no matcheados, leer specs['Marca']
  console.log('→ Detecting brands from supplier "marca" field in specs...')
  let marcaDetected = 0
  const matchedIds = new Set([...brandProductIds.values()].flat())
  for (const product of products) {
    if (matchedIds.has(product.id)) continue
    try {
      const specs = typeof product.specs === 'string' ? JSON.parse(product.specs) : product.specs
      const marca = specs?.['Marca']
      if (!marca || typeof marca !== 'string' || marca.trim().length < 2) continue

      const brandName = marca.trim()
      const slug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (!slug) continue

      brandProductCounts.set(slug, (brandProductCounts.get(slug) || 0) + 1)
      if (!brandProductIds.has(slug)) brandProductIds.set(slug, [])
      brandProductIds.get(slug).push(product.id)
      marcaDetected++
    } catch { /* invalid specs JSON */ }
  }
  console.log(`  ✓ ${marcaDetected} additional brands detected via specs.Marca`)

  // 4. Upsert brands (en batches para no hacer 1 request por marca)
  console.log('→ Upserting brands...')
  const now = new Date().toISOString()
  let brandsCreated = 0
  let brandsUpdated = 0

  // 4a. Traer todas las brands existentes de una sola vez
  const { rows: existingBrands } = await tursoExecute('SELECT id, slug FROM brands')
  const existingSlugs = new Map(existingBrands.map(b => [b.slug, b.id]))

  // 4b. Para cada brand detectada, armar INSERT o UPDATE
  const inserts = []
  const updates = []
  for (const [slug, count] of brandProductCounts) {
    if (existingSlugs.has(slug)) {
      // UPDATE existente
      updates.push({
        sql: `UPDATE brands SET productCount = ?, updatedAt = ? WHERE slug = ?`,
        args: [count, now, slug],
      })
      brandsUpdated++
    } else if (count > 0) {
      // INSERT nuevo
      const pattern = BRAND_PATTERNS.find(bp => bp.slug === slug)
      const brandName = pattern?.name || slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      const id = crypto.randomUUID()
      inserts.push({
        sql: `INSERT INTO brands (id, name, slug, logoUrl, logoWidth, logoHeight, isActive, "order", productCount, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`,
        args: [id, brandName, slug, `https://cdn.simpleicons.org/${slug}/9ca3af`, 80, 24, count, now, now],
      })
      brandsCreated++
    }
  }

  // 4c. Ejecutar en batches de 50 (límite razonable por request HTTP)
  const BATCH_SIZE = 50
  for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
    const chunk = inserts.slice(i, i + BATCH_SIZE)
    await tursoBatch(chunk)
    console.log(`    ✓ Inserted brands ${i + 1}-${i + chunk.length} of ${inserts.length}`)
  }
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE)
    await tursoBatch(chunk)
  }
  console.log(`  ✓ ${brandsCreated} brands created, ${brandsUpdated} updated`)

  // 5. Asignar brandId a productos que no lo tengan (en batches masivos)
  console.log('→ Assigning brandId to products without one...')
  let brandIdUpdates = 0

  // 5a. Traer slugs → brandId ya resueltos
  const { rows: allBrands } = await tursoExecute('SELECT id, slug FROM brands')
  const slugToBrandId = new Map(allBrands.map(b => [b.slug, b.id]))

  // 5b. Para cada brand, hacer un UPDATE masivo: UPDATE products SET brandId = ? WHERE id IN (...) AND brandId IS NULL
  const brandIdInserts = []
  for (const [slug, pids] of brandProductIds) {
    const brandId = slugToBrandId.get(slug)
    if (!brandId || !pids || pids.length === 0) continue

    // UPDATE masivo en chunks de 500 IDs (limite de placeholders en SQLite)
    const ID_CHUNK = 500
    for (let i = 0; i < pids.length; i += ID_CHUNK) {
      const chunk = pids.slice(i, i + ID_CHUNK)
      const placeholders = chunk.map(() => '?').join(',')
      brandIdInserts.push({
        sql: `UPDATE products SET brandId = ? WHERE id IN (${placeholders}) AND brandId IS NULL`,
        args: [brandId, ...chunk],
      })
    }
  }

  for (let i = 0; i < brandIdInserts.length; i += BATCH_SIZE) {
    const chunk = brandIdInserts.slice(i, i + BATCH_SIZE)
    const results = await tursoBatch(chunk)
    for (const r of results) {
      const affected = r?.response?.result?.affected_row_count || 0
      brandIdUpdates += affected
    }
    console.log(`    ✓ Processed brandId batch ${i + 1}-${i + chunk.length} of ${brandIdInserts.length}`)
  }
  console.log(`  ✓ ${brandIdUpdates} products got brandId assigned`)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log()
  console.log(`=== Brand sync completed in ${elapsed}s ===`)
  console.log(`Summary:`)
  console.log(`  Products scanned: ${products.length}`)
  console.log(`  Brands created: ${brandsCreated}`)
  console.log(`  Brands updated: ${brandsUpdated}`)
  console.log(`  BrandId assignments: ${brandIdUpdates}`)
  console.log(`  Total brands in DB: ${allBrands.length + brandsCreated}`)
}

syncBrands().catch(err => {
  console.error('✗ Brand sync failed:', err)
  process.exit(1)
})
