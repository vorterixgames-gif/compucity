#!/usr/bin/env node
/**
 * Sync Air Intra → Turso (corre en GitHub Actions, no en Vercel).
 *
 * Ventajas sobre el cron de Vercel:
 * - Sin límite de 60s (puede tardar lo que necesite)
 * - Sin consumir Vercel Fluid CPU
 * - Procesa TODAS las páginas (16) en cada ejecución
 * - Respeta rate limit de Air Intra con delays entre páginas
 *
 * Variables de entorno (configuradas en GitHub Secrets):
 * - TURSO_URL: libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io
 * - TURSO_TOKEN: eyJ...
 * - AIR_INTRA_USER: c4078
 * - AIR_INTRA_PASS: ********
 *
 * Uso local: node scripts/sync-air-intra-external.mjs
 * Uso GitHub Actions: automático via .github/workflows/sync-air-intra.yml
 */

const TURSO_URL = process.env.TURSO_URL || 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io'
const TURSO_TOKEN = process.env.TURSO_TOKEN || ''
const AIR_INTRA_USER = process.env.AIR_INTRA_USER || 'c4078'
const AIR_INTRA_PASS = process.env.AIR_INTRA_PASS || ''
const AIR_INTRA_BASE = 'https://api.air-intra.com/v2'

// ============================================
// Filtro de rubros permitidos (sesión 43 día 4)
// ============================================
// Solo se sincronizan productos cuyo rubro está en esta lista.
// Los productos con rubro NO listado se saltan (no se guardan ni actualizan).
// Lista extraída del portal de Air Intra el 19/6/2026.
// Para modificar: editar esta lista y pushear a GitHub.
const ALLOWED_RUBROS = new Set([
  '000-0299',  // MONOPATINES Y SCOOTERS
  '001-0002',  // CPU COOLER
  '001-0003',  // PASTA TERMICA
  '001-0010',  // ACCESORIOS
  '001-0014',  // PC
  '001-0015',  // SILLAS GAMERS
  '001-0016',  // DISCOS RIGIDOS USB
  '001-0018',  // TV SMART
  '001-0023',  // DISCO RIGIDO SSD EXTERNO
  '001-0030',  // ACCESORIOS CABLES
  '001-0055',  // CONECTIVIDAD
  '001-0102',  // PLACAS DE RED
  '001-0132',  // VENTILADOR
  '001-0134',  // DISCOS RIGIDOS IDE/SATA
  '001-0137',  // DISCOS RIGIDOS SSD
  '001-0160',  // ESTABILIZADORES
  '001-0168',  // VIDEO PROYECTORES
  '001-0190',  // GABINETES
  '001-0212',  // Domotica - SMART HOUSE
  '001-0231',  // IMP. CHORRO DE TINTA CANON
  '001-0252',  // CARTUCHOS CANON
  '001-0255',  // CARTUCHOS EPSON
  '001-0258',  // TONERS
  '001-0279',  // ROTULADORAS
  '001-0280',  // MEMORIAS
  '001-0281',  // MEMORIAS USB
  '001-0282',  // MEMORIAS FLASH
  '001-0290',  // MUEBLES DE OFICINA
  '001-0291',  // SILLAS DE OFICINA
  '001-0300',  // SERVIDORES
  '001-0304',  // SEGURIDAD CAMARAS Y ACCESORIOS
  '001-0305',  // WEBCAMS
  '001-0306',  // VIDEO PORTEROS
  '001-0320',  // MONITORES
  '001-0330',  // MICROPROCESADORES
  '001-0332',  // FAN COOLER
  '001-0341',  // JOYSTICK
  '001-0351',  // AURICULARES Y MICROFONOS
  '001-0352',  // PLACAS VARIAS
  '001-0355',  // PARLANTES
  '001-0360',  // NOTEBOOKS
  '001-0363',  // NOTEBOOKS ACCESORIOS
  '001-0368',  // TABLETS
  '001-0390',  // PLOTTERS
  '001-0430',  // CONECTIVIDAD HUBS Y SWITCHS
  '001-0432',  // CONECTIVIDAD PLACAS DE RED
  '001-0490',  // SCANNERS
  '001-0500',  // SERVIDORES ACCESORIOS
  '001-0521',  // SERVIDORES STORAGE
  '001-0530',  // TECLADOS
  '001-0540',  // UPS
  '001-0556',  // FUENTES DE ALIMENTACION
  '001-0555',  // BOLSOS FUNDAS Y MALETINES
  '001-0560',  // PLACAS VIDEO EDICION
  '001-0566',  // TV
  '001-0580',  // ELECTRODOMESTICOS
  '001-0600',  // IMP MF INKJET
  '001-0601',  // IMP INKJET
  '001-0602',  // IMP MF LASER COLOR
  '001-0603',  // IMP MF LASER NEGRO
  '001-0604',  // IMP LASER COLOR
  '001-0605',  // IMP LASER NEGRO
  '001-0606',  // IMP MF C/SIST. CONT.
  '001-0607',  // IMP C/SIST. CONT.
  '001-0608',  // CARTUCHO
  '001-0609',  // BOTELLA
  '001-0612',  // CONECTIVIDAD WI-FI ANTENAS
  '001-1001',  // IMP. ACCESORIOS
  '001-1055',  // CONECTIVIDAD CABLES CONECTORES
  '001-1212',  // ASPIRADORA
  '001-1261',  // ALL IN ONE
  '001-1616',  // MINI PC
  '001-3560',  // UPS ACCESORIOS
  '001-900',   // IMPRESORA TERMICA
  '002-0015',  // PC
  '002-0137',  // DISCOS RIGIDOS SSD
  '002-0190',  // GABINETES
  '002-0280',  // MEMORIAS
  '002-0299',  // MONOPATINES Y SCOOTERS
  '002-0304',  // SEGURIDAD CAMARAS Y ACCESORIOS
  '002-0320',  // MONITORES
  '002-0361',  // NOTEBOOKS
  '002-0553',  // PLACAS VGA
  '002-0566',  // TV
  '002-0997',  // COMPUTADORAS PC PROMOS
  '002-1262',  // ALL IN ONE
  '002-1263',  // 2EN1 CX
  '002-1616',  // MINI PC
  '003-1000',  // MAQUINAS, HERRAM. Y REPUESTOS
  '569',       // STREAMING
  '907-1555',  // SMARTWATCH
])

// ============================================
// Mapeo rubro Air Intra → categoría Compucity (sesión 44)
// ============================================
// Asigna automáticamente la categoría de Compucity basándose en el rubro de Air Intra.
// Si el rubro no está en este mapeo, el producto se guarda sin categoryId (NULL).
const RUBRO_TO_CATEGORY = {
  '001-0002': '57b1e5cc-59e6-49f0-a9d1-b3f388c19b79',

  '001-0003': 'b8cc805f-10f4-4bb1-b4d2-dacc0ad395c4',

  '001-0010': 'cat5',

  '001-0014': '9e696a46-81f8-4753-a51f-6dd9d933fbea',

  '001-0015': 'bdf7ba10-c068-4b61-845c-5d38e2b87a61',

  '001-0016': '404bbe6d-bc9a-471c-b264-fcf18d693295',

  '001-0023': '404bbe6d-bc9a-471c-b264-fcf18d693295',

  '001-0030': '3f166420-a367-43a9-96d6-55760385bbb5',

  '001-0055': '0b090bb2-5761-4bfb-8337-f6e217c8e7a5',

  '001-0134': '63761dd5-d992-4bab-b9a6-fb95c3ff2cef',

  '001-0137': '18b32130-e146-4843-95c5-860142417306',

  '001-0160': 'b854e149-1790-4cad-abc6-0a4fb187740b',

  '001-0168': 'd7e69825-b005-4405-83e3-fb4d221fba87',

  '001-0190': 'b24872b5-c02e-4969-892b-aa03f1acdae8',

  '001-0212': 'cat5',

  '001-0252': '66f20839-0487-433a-930f-9705ca43365d',

  '001-0255': '66f20839-0487-433a-930f-9705ca43365d',

  '001-0258': '66f20839-0487-433a-930f-9705ca43365d',

  '001-0280': '8fec8068-83c9-43a9-a972-9eeafe9e0bda',

  '001-0281': 'f78dc8a5-69e0-4097-b4f9-c928fd90069f',

  '001-0282': '797adcdf-c7ae-4aa0-9b14-18b3a5b8ea45',

  '001-0290': '9a877f10-5486-4918-97e1-654f457c7420',

  '001-0300': '9e696a46-81f8-4753-a51f-6dd9d933fbea',

  '001-0305': '8e03c174-cb16-4b19-b920-73fc96236fbd',

  '001-0320': 'cat4',

  '001-0330': 'b4211f62-d18d-430e-a918-8dadafde4723',

  '001-0331': '50aed4ad-61dd-4d9b-8337-3e69f5163847',

  '001-0332': '57b1e5cc-59e6-49f0-a9d1-b3f388c19b79',

  '001-0340': 'ac551783-8734-4858-a316-d0a54701e437',

  '001-0341': '964647bd-67e5-4483-91ea-fb74f8f49ca4',

  '001-0351': 'f1f9d31f-9482-4429-a7d2-4208668e3ba3',

  '001-0352': '9e696a46-81f8-4753-a51f-6dd9d933fbea',

  '001-0355': 'a4ca4e17-7730-4feb-a6c6-a7a8b96075ac',

  '001-0360': 'cat1',

  '001-0368': '4ab6e5e7-f724-4ead-96d2-a169fe41d372',

  '001-0430': '2624baab-e1ba-4f28-aa2f-2d4d1b726b84',

  '001-0432': 'be240fd6-301f-405a-a42d-e6937fa9bcf9',

  '001-0490': '18191d04-ecf3-412c-b627-7674c148013c',

  '001-0500': '9e696a46-81f8-4753-a51f-6dd9d933fbea',

  '001-0521': '9e696a46-81f8-4753-a51f-6dd9d933fbea',

  '001-0530': 'dede1e27-d8b0-44b1-9ac0-8112ad91a57d',

  '001-0540': 'b854e149-1790-4cad-abc6-0a4fb187740b',

  '001-0555': '4e82d540-2eb2-4d4b-b349-44fe6af49e00',

  '001-0556': 'bce97e5d-3ccf-4e49-9c23-1af8ece63612',

  '001-0560': '9e696a46-81f8-4753-a51f-6dd9d933fbea',

  '001-0600': '18191d04-ecf3-412c-b627-7674c148013c',

  '001-0601': '18191d04-ecf3-412c-b627-7674c148013c',

  '001-0602': '18191d04-ecf3-412c-b627-7674c148013c',

  '001-0603': '18191d04-ecf3-412c-b627-7674c148013c',

  '001-0604': '18191d04-ecf3-412c-b627-7674c148013c',

  '001-0605': '18191d04-ecf3-412c-b627-7674c148013c',

  '001-0606': '18191d04-ecf3-412c-b627-7674c148013c',

  '001-0607': '18191d04-ecf3-412c-b627-7674c148013c',

  '001-0608': '66f20839-0487-433a-930f-9705ca43365d',

  '001-0609': '66f20839-0487-433a-930f-9705ca43365d',

  '001-0612': '172af915-f189-476c-a735-e9a7b05bd16c',

  '001-1055': '3f166420-a367-43a9-96d6-55760385bbb5',

  '001-1616': '00176d39-d1cb-4f68-a01e-617fb37679cb',

  '001-3560': 'b854e149-1790-4cad-abc6-0a4fb187740b',

  '002-0015': '9e696a46-81f8-4753-a51f-6dd9d933fbea',

  '002-0137': '18b32130-e146-4843-95c5-860142417306',

  '002-0190': 'b24872b5-c02e-4969-892b-aa03f1acdae8',

  '002-0280': '8fec8068-83c9-43a9-a972-9eeafe9e0bda',

  '002-0320': 'cat4',

  '002-0361': 'cat1',

  '002-0553': 'cfbf9b6c-5d7b-4d42-aaa3-066a52848fbd',

  '002-0997': '9e696a46-81f8-4753-a51f-6dd9d933fbea',

  '002-1616': '00176d39-d1cb-4f68-a01e-617fb37679cb',
}

// ============================================
// Helpers de Turso (HTTP API directa, sin libsql client)
// ============================================
const TURSO_HTTP = TURSO_URL.replace('libsql://', 'https://') + '/v2/pipeline'

async function tursoExecute(sql) {
  const body = JSON.stringify({
    requests: [
      { type: 'execute', stmt: { sql } },
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
  if (!result) return { rows: [], cols: [] }
  const cols = (result.cols || []).map(c => c.name)
  const rows = (result.rows || []).map(row =>
    row.reduce((obj, cell, i) => {
      obj[cols[i] || `col_${i}`] = cell.type === 'null' ? null : cell.value
      return obj
    }, {})
  )
  return { rows, cols }
}

async function tursoBatch(statements) {
  // Turso pipeline soporta múltiples statements en 1 request
  const body = JSON.stringify({
    requests: [
      ...statements.map(sql => ({ type: 'execute', stmt: { sql } })),
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
// Helpers de Air Intra
// ============================================
function stripPhpNotices(text) {
  return text
    .replace(/<\/?b>/gi, '')
    .replace(/<br\s*\/?>\s*/gi, '')
    .replace(/(?:Notice|Warning|Fatal error|Parse error|Deprecated):\s*[\s\S]*?on line\s+\d+\s*/gi, '')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/}\s*{/g, '},{')
    .replace(/,\s*,/g, ',')
    .trim()
}

function safeParseAirIntra(rawText) {
  const cleaned = stripPhpNotices(rawText)
  let jsonStart = -1
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{' || cleaned[i] === '[') { jsonStart = i; break }
  }
  if (jsonStart === -1) return { data: null, error: 'No JSON found' }
  try {
    return { data: JSON.parse(cleaned.substring(jsonStart)), error: null }
  } catch {
    // Aggressive cleanup
    let aggressive = cleaned.substring(jsonStart)
      .replace(/<[^>]*>/g, '')
      .replace(/,\s*,/g, ',')
      .replace(/}\s*{/g, '},{')
      .replace(/,\s*([}\]])/g, '$1')
    try {
      return { data: JSON.parse(aggressive), error: null }
    } catch (e2) {
      return { data: null, error: e2.message }
    }
  }
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
      else if (ch === '}') { depth--; if (depth === 0) { objEnd = j; break } }
    }
    if (objEnd === -1) { i++; continue }
    const objText = text.substring(i, objEnd + 1)
    if (objText.includes('"codigo"') || objText.includes('"codiart"')) {
      try { products.push(JSON.parse(objText)) } catch {}
    }
    i = objEnd + 1
  }
  return products
}

// ============================================
// Función principal
// ============================================
async function main() {
  const startTime = Date.now()
  console.log('═'.repeat(70))
  console.log(' 🔄 Sync Air Intra → Turso (GitHub Actions)')
  console.log('═'.repeat(70))
  console.log(`Inicio: ${new Date().toISOString()}`)
  console.log()

  if (!TURSO_TOKEN) {
    console.error('✗ TURSO_TOKEN no configurado')
    process.exit(1)
  }

  // ─── 1. Login Air Intra ───
  console.log('▸ Login Air Intra...')
  const loginRes = await fetch(`${AIR_INTRA_BASE}/?q=login&user=${encodeURIComponent(AIR_INTRA_USER)}&pass=${encodeURIComponent(AIR_INTRA_PASS)}`)
  if (!loginRes.ok) {
    console.error(`✗ Login HTTP ${loginRes.status}`)
    process.exit(1)
  }
  const loginRaw = await loginRes.text()
  const loginCleaned = stripPhpNotices(loginRaw)
  let jsonStart = -1
  for (let i = 0; i < loginCleaned.length; i++) {
    if (loginCleaned[i] === '{' || loginCleaned[i] === '[') { jsonStart = i; break }
  }
  const loginData = JSON.parse(loginCleaned.substring(jsonStart))
  const token = loginData.token
  const exchangeRate = parseFloat(loginData.cotiza || '0')
  console.log(`  ✓ Login OK. Cotización: $${exchangeRate}`)

  // ─── 2. Cargar productos existentes de Turso ───
  console.log('▸ Cargando productos existentes de Turso...')
  const existingResult = await tursoExecute(
    "SELECT id, providerSku, costPrice, stock, price FROM products WHERE providerId = 'air-intra-1780331633566'"
  )
  const existingBySku = new Map()
  for (const row of existingResult.rows) {
    if (row.providerSku) existingBySku.set(row.providerSku, row)
  }
  console.log(`  ✓ ${existingBySku.size} productos existentes en DB`)

  // ─── 3. Recorrer TODAS las páginas de Air Intra ───
  console.log('▸ Sincronizando productos...')
  const SUPPLIER_ID = 'air-intra-1780331633566'
  const SUPPLIER_MARKUP = 30
  let totalFetched = 0
  let created = 0
  let updated = 0
  let skipped = 0
  let filteredByRubro = 0
  let errors = 0
  let allApiSkus = new Set()

  for (let page = 0; page < 20; page++) {
    console.log(`  ▸ Página ${page}...`)
    let products = null
    let retryCount = 0
    const MAX_RETRIES = 3

    while (!products && retryCount <= MAX_RETRIES) {
      try {
        const res = await fetch(`${AIR_INTRA_BASE}/?q=articulos&page=${page}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: '{}',
        })

        if (!res.ok) {
          const errText = await res.text().catch(() => '')
          if (errText.includes('Too many queries') || errText.includes('error_id":403')) {
            const wait = 90 + retryCount * 60
            console.log(`    ⏳ Rate limited. Esperando ${wait}s (intento ${retryCount + 1}/${MAX_RETRIES})...`)
            await new Promise(r => setTimeout(r, wait * 1000))
            // Re-login
            const reauthRes = await fetch(`${AIR_INTRA_BASE}/?q=login&user=${encodeURIComponent(AIR_INTRA_USER)}&pass=${encodeURIComponent(AIR_INTRA_PASS)}`)
            if (reauthRes.ok) {
              const rText = await reauthRes.text()
              const rClean = stripPhpNotices(rText)
              let rStart = -1
              for (let i = 0; i < rClean.length; i++) {
                if (rClean[i] === '{' || rClean[i] === '[') { rStart = i; break }
              }
              if (rStart >= 0) {
                const rData = JSON.parse(rClean.substring(rStart))
                if (rData.token) token = rData.token
              }
            }
            retryCount++
            continue
          }
          console.error(`    ✗ HTTP ${res.status}`)
          break
        }

        const rawText = await res.text()
        const cleaned = stripPhpNotices(rawText)
        const parsed = safeParseAirIntra(rawText)

        if (parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
          products = parsed.data
          // Verificación doble con extractor
          if (rawText) {
            const extracted = extractProductsFromCorruptedJson(cleaned)
            if (extracted.length > products.length) {
              const parsedSkus = new Set(products.map(p => p.codigo || p.codiart || '').filter(Boolean))
              for (const ext of extracted) {
                const sku = ext.codigo || ext.codiart || ''
                if (sku && !parsedSkus.has(sku)) products.push(ext)
              }
            }
          }
        } else if (parsed.data && Array.isArray(parsed.data) && parsed.data.length === 0) {
          console.log(`    ✓ Página ${page} vacía — fin del catálogo`)
          products = []
          break
        } else {
          // Fallback: extractor
          if (rawText) {
            const extracted = extractProductsFromCorruptedJson(cleaned)
            if (extracted.length > 0) {
              products = extracted
            } else {
              console.log(`    ✓ Página ${page} vacía o corrupta — fin del catálogo`)
              products = []
              break
            }
          } else {
            products = []
            break
          }
        }
      } catch (err) {
        console.error(`    ✗ Error: ${err.message}`)
        if (retryCount < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 5000))
          retryCount++
          continue
        }
        products = []
        break
      }
    }

    if (!products || products.length === 0) break

    console.log(`    ✓ ${products.length} productos en página ${page}`)

    // Procesar productos
    const batchStmts = []
    const now = new Date().toISOString()

    for (const p of products) {
      const providerSku = p.codigo || p.codiart || ''
      if (!providerSku) { skipped++; continue }
      if (allApiSkus.has(providerSku)) { skipped++; continue }
      allApiSkus.add(providerSku)

      const costPrice = parseFloat(p.precio || '0')
      if (costPrice <= 0) { skipped++; continue }

      // Filtro de rubros (sesión 43 día 4): solo sincronizar productos
      // cuyo rubro está en la lista de permitidos.
      const rubro = String(p.rubro || p.grupo || '').trim()
      if (!ALLOWED_RUBROS.has(rubro)) {
        filteredByRubro++
        continue
      }

      const productName = p.descrip || p.descripcion || p.titulo || ''
      if (!productName) { skipped++; continue }

      totalFetched++

      // Stock total (suma de todos los depósitos)
      const stockByWarehouse = {
        air: p.air?.disponible || 0,
        lug: p.lug?.disponible || 0,
        ros: p.ros?.disponible || 0,
        cba: p.cba?.disponible || 0,
        mza: p.mza?.disponible || 0,
      }
      const totalStock = Object.values(stockByWarehouse).reduce((a, b) => a + b, 0)
      const sellingPrice = costPrice * (1 + SUPPLIER_MARKUP / 100)
      const supplierCategory = p.rubro || p.grupo || ''
      const stockByWarehouseJson = JSON.stringify(stockByWarehouse)

      // Specs
      const specs = {}
      if (p.garantia) specs['Garantía'] = p.garantia
      if (p.moneda) specs['Moneda'] = p.moneda
      if (p.marca) specs['Marca'] = p.marca
      if (p.rubro) specs['Rubro'] = p.rubro
      if (p.grupo) specs['Grupo'] = p.grupo

      const existing = existingBySku.get(providerSku)
      if (existing) {
        // UPDATE
        const needsUpdate =
          Math.abs(costPrice - parseFloat(existing.costPrice || 0)) > 0.01 ||
          totalStock !== parseInt(existing.stock || 0)
        if (needsUpdate) {
          batchStmts.push(
            `UPDATE products SET costPrice = ${costPrice}, price = ${sellingPrice}, stock = ${totalStock}, stockByWarehouse = '${stockByWarehouseJson}', supplierCategory = '${supplierCategory}', ${RUBRO_TO_CATEGORY[rubro] ? `categoryId = '${RUBRO_TO_CATEGORY[rubro]}', ` : ''}isActive = 1, updatedAt = '${now}' WHERE id = '${existing.id}'`
          )
          updated++
        }
      } else {
        // INSERT (simplified — sin category mapping, se hace después desde el admin)
        const newId = crypto.randomUUID()
        const escapedName = productName.replace(/'/g, "''")
        const slug = providerSku.toLowerCase().replace(/[^a-z0-9]/g, '-')
        const specsJson = JSON.stringify(specs).replace(/'/g, "''")

        batchStmts.push(
          `INSERT INTO products (id, name, slug, description, price, costPrice, sku, stock, stockByWarehouse, isActive, isFeatured, images, specs, providerId, providerSku, supplierCategory) VALUES ('${newId}', '${escapedName}', '${slug}', '', ${sellingPrice}, ${costPrice}, '${providerSku}', ${totalStock}, '${stockByWarehouseJson}', 1, 0, '[]', '${specsJson}', '${SUPPLIER_ID}', '${providerSku}', '${supplierCategory}')`
        )
        created++
      }
    }

    // Ejecutar batch (en grupos de 50)
    for (let i = 0; i < batchStmts.length; i += 50) {
      const chunk = batchStmts.slice(i, i + 50)
      try {
        await tursoBatch(chunk)
      } catch (e) {
        console.error(`    ✗ Batch error: ${e.message}`)
        errors += chunk.length
      }
    }

    console.log(`    ✓ Página ${page} procesada — acumulado: ${totalFetched} (${created} nuevos, ${updated} actualizados)`)

    // Delay entre páginas (2s para no rate-limit)
    if (products.length > 0) {
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  // ─── 4. Actualizar lastSyncAt ───
  const now = new Date().toISOString()
  try {
    await tursoExecute(`UPDATE suppliers SET lastSyncAt = '${now}', updatedAt = '${now}' WHERE id = '${SUPPLIER_ID}'`)
  } catch {}

  // ─── 5. Resumen ───
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log()
  console.log('═'.repeat(70))
  console.log(' ✅ SYNC COMPLETADA')
  console.log('═'.repeat(70))
  console.log(`  Tiempo: ${elapsed}s`)
  console.log(`  Productos fetched: ${totalFetched}`)
  console.log(`  Nuevos: ${created}`)
  console.log(`  Actualizados: ${updated}`)
  console.log(`  Saltados: ${skipped}`)
  console.log(`  Filtrados por rubro: ${filteredByRubro}`)
  console.log(`  Errores: ${errors}`)
  console.log(`  Cotización Air Intra: $${exchangeRate}`)
  console.log('═'.repeat(70))

  // Llamar a revalidateTag via Vercel API (opcional)
  if (process.env.VERCEL_REVALIDATE_URL) {
    try {
      await fetch(process.env.VERCEL_REVALIDATE_URL, { method: 'POST' })
      console.log('  ✓ Cache invalidado en Vercel')
    } catch {}
  }
}

main().catch(err => {
  console.error('✗ Error fatal:', err)
  process.exit(1)
})
