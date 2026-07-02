import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

// ============================================
// CATEGORY KEYWORD MAP — Order matters, first match wins
// ============================================
const CATEGORY_KEYWORD_MAP: [string, string[]][] = [
  // PC Armadas — MUST be before component entries so complete PCs aren't mis-categorized
  ['pc-armadas', ['PC GAMER', 'PC LENOVO', 'PC KELYX', 'SIST. KELYX', 'SIST.', 'COMPUTADORA', 'BAREBONE']],
  ['auriculares', ['AURICULAR', 'HEADSET', 'HEADPHONE', 'JBL TOUR', 'JBL QUANTUM']],
  ['mouse', ['MOUSE']],
  ['teclados', ['TECLADO', 'KEYBOARD']],
  ['parlantes', ['PARLANTE', 'SPEAKER', 'BARRA DE SONIDO', 'SOUND BAR', 'PARTY LIGHT']],
  ['mousepads', ['MOUSEPAD', 'PAD GAMER', 'ALFOMBRILLA']],
  ['microfonos', ['MICROFONO', 'MICROPHONE']],
  ['webcams', ['WEBCAM', 'CAM WEB', 'WEB CAM', 'BRIO', 'FACECAM']],
  ['joysticks', ['JOYSTICK', 'GAMEPAD', 'CONTROLLER', 'GAME PAD', 'VOLANTE', 'G29', 'G923', 'F710']],
  ['kits-gamer', ['KIT GABINETE', 'KIT TECLADO', 'KIT GAMER']],
  ['toners-y-cartuchos', ['CARTUCHO', 'TONER', 'INK CARTRIDGE', 'IMAGING DRUM', 'PRINHEAD', 'BOTELLA DE TINTA']],
  ['impresion', ['IMPRESORA', 'SMART TANK', 'LASERJET', 'DESKJET', 'OFFICEJET', 'PROYECTOR EPSON']],
  ['memoria-ram-pc', ['MEMORIA DDR', 'DDR3', 'DDR4', 'DDR5', 'CORSAIR MEMORY']],
  ['memoria-ram-notebook', ['SODIMM']],
  ['discos-ssd', ['SSD', 'NVME', 'M.2', 'GEN4', 'GEN3']],
  ['discos-hdd', ['DISCO RIGIDO', 'HDD', 'IRONWOLF', 'SKYHAWK']],
  ['discos-externos', ['DISCO EXTERNO', 'EXTERNAL', 'PORTABLE DRIVE', 'CANVIO', 'EXPANSION BLACK']],
  ['pendrives', ['PENDRIVE', 'DATA TRAVELER', 'DATATRAVELER', 'FLASH DRIVE', 'PEN DRIVE']],
  ['micro-sd', ['MICRO SD', 'MICROSD', 'SD CARD', 'MICRO MEMORY']],
  ['microprocesadores', ['RYZEN', 'INTEL I3', 'INTEL I5', 'INTEL I7', 'INTEL I9', 'CORE I', 'PENTIUM', 'CORE ULTRA']],
  ['motherboards', ['MOTHER', 'H610', 'B760', 'H810', 'A520', 'A620', 'B650', 'B550', 'H510']],
  ['placas-de-video', ['RTX', 'GTX', 'RADEON RX', 'GEFORCE', 'GRAPHICS CARD', 'QUADRO RTX']],
  ['fuentes', ['FUENTE', 'POWER SUPPLY', 'PSU']],
  ['gabinetes', ['GABINETE', 'CHASSIS', 'TOWER', 'BLAZE FORCE', 'INFINITY GLASS']],
  ['refrigeracion', ['COOLER', 'WATER COOL', 'LIQUID COOL', 'DISIPADOR', 'HEATSINK', 'SWAFAN', 'FAN COOLER', 'AIO']],
  ['pastas-termicas', ['PASTA TERMICA', 'THERMAL PASTE']],
  ['monitores', ['MONITOR', 'ULTRAFINE', 'LED MONITOR']],
  ['notebooks', ['NOTEBOOK', 'LAPTOP', 'PORTATIL']],
  ['routers-wifi', ['ARCHER', 'ROUTER', 'DECO', 'MESH WIFI', 'TL-WR']],
  ['switches', ['SWITCH']],
  ['placas-de-red', ['P.REDW', 'EAP', 'CPE', 'SFP', 'TL-WN', 'PREDW', 'RANGE EXTENDER']],
  ['cables-y-adaptadores', ['CABLE', 'ADAPTADOR', 'FICHA RJ45', 'CONVERTER', 'ROLLO', 'UTP CAT', 'HUB USB']],
  ['ups', ['UPS', 'ESTABILIZADOR', 'NOBREAK', 'SURGE PROTECTION']],
  ['cargadores', ['CARGADOR', 'CHARGER', 'POWER BANK']],
  ['sillas-gamer', ['SILLA', 'GAMING CHAIR']],
  ['soportes-y-brazos', ['SOPORTE', 'BRAZO', 'MOUNT', 'STAND MONITOR']],
  ['fundas-mochilas', ['MOCHILA', 'FUNDA', 'BACKPACK']],
  ['mini-pc', ['MINI PC', 'STICK PC']],
  ['bases', ['BASE CARGADORA', 'DOCK']],
  ['escritorios', ['ESCRITORIO', 'MESA GAMER']],
]

// ============================================
// SUBCATEGORY RULES — refine parent → child
// ============================================
const SUBCATEGORY_RULES: Record<string, { slug: string; keywords: string[] }[]> = {
  'notebooks': [
    { slug: 'gamer', keywords: ['GAMER', 'GAMING', 'LOQ', 'LEGION', 'RTX', 'GEFORCE', 'RADEON', 'TUF GAMING', 'PREDATOR', 'NITRO'] },
    { slug: 'ultrabooks', keywords: ['SLIM', 'ULTRABOOK', 'IDEAPAD SLIM', 'BORDER ULTRA'] },
    { slug: 'diseno', keywords: ['TOUCH', 'XPS', 'SPECTRE', 'ZENBOOK'] },
    { slug: 'oficina', keywords: ['IDEAPAD', 'OFFICE', 'CONSUMO'] },
  ],
  'monitores': [
    { slug: 'gamer-mon', keywords: ['ULTRAGEAR', 'GAMER', 'GAMING', '144HZ', '165HZ', '180HZ', '200HZ', '240HZ', '1MS', '0.5MS', 'FREESYNC', 'G-SYNC', 'CURVO', 'OLED'] },
    { slug: 'diseno-mon', keywords: ['ULTRAFINE', 'ERGO', 'THUNDERBOLT', 'DUAL ERGO'] },
    { slug: 'soportes-y-brazos', keywords: ['SOPORTE', 'BRAZO', 'MOUNT', 'STAND MONITOR'] },
    { slug: 'oficina-mon', keywords: ['MONITOR', 'LED', 'HDMI', 'FULL HD', 'CORPORATIVO'] },
  ],
  'pc-armadas': [
    // NOTA: Subcategorías desactivadas — todos los productos van a la categoría padre.
    // Los usuarios filtran por tipo (Gamer/Oficina/Diseño/Mini PC) desde los filtros laterales.
  ],
  'accesorios': [
    { slug: 'ups', keywords: ['UPS', 'ESTABILIZADOR', 'NOBREAK', 'SURGE PROTECTION'] },
    { slug: 'cargadores', keywords: ['CARGADOR', 'CHARGER', 'POWER BANK'] },
    { slug: 'sillas-gamer', keywords: ['SILLA', 'GAMING CHAIR'] },
    { slug: 'escritorios', keywords: ['ESCRITORIO', 'MESA GAMER'] },
    { slug: 'fundas-mochilas', keywords: ['MOCHILA', 'FUNDA', 'BACKPACK'] },
    { slug: 'bases', keywords: ['BASE CARGADORA', 'DOCK'] },
  ],
}

// ============================================
// CATEGORY CORRECTIONS — fix known misclassifications
// ============================================
function applyCategoryCorrections(nameUpper: string, matchedSlug: string): string {
  // Motherboards mis-categorized as microprocesadores
  if (matchedSlug === 'microprocesadores' && nameUpper.includes('MOTHER')) return 'motherboards'
  // Notebooks mis-categorized as componentes
  if (['placas-de-video', 'memorias-ram', 'discos-ssd'].includes(matchedSlug) && nameUpper.includes('NOTEBOOK')) return 'notebooks'
  // Notebook bases mis-categorized as notebooks
  if (['notebooks'].includes(matchedSlug) && nameUpper.includes('BASE NOTEBOOK')) return 'bases'
  // Mini PCs / Complete PCs mis-categorized as components
  if (nameUpper.includes('MINI PC') || nameUpper.includes('BAREBONE')) {
    if (['microprocesadores', 'memorias-ram', 'discos-ssd', 'fuentes'].includes(matchedSlug)) return 'pc-armadas'
  }
  // Complete PCs (Lenovo Neo, Kelyx) mis-categorized as components
  if ((nameUpper.includes('PC LENOVO') || nameUpper.includes('PC KELYX') || nameUpper.includes('SIST.')) &&
      ['discos-ssd', 'memorias-ram', 'microprocesadores', 'fuentes', 'gabinetes'].includes(matchedSlug)) return 'pc-armadas'
  // PC Gamer mis-categorized as fuentes (e.g. "PC Gamer Raptor con Fuente")
  if (nameUpper.includes('PC GAMER') && ['fuentes', 'gabinetes'].includes(matchedSlug)) return 'pc-armadas'
  // Desktop PCs mis-categorized
  if (nameUpper.includes('DESKTOP') && ['switches', 'discos-ssd'].includes(matchedSlug)) return 'pc-armadas'
  return matchedSlug
}

// ============================================
// Build category lookup from DB
// ============================================
interface CategoryLookup {
  slugToId: Map<string, string>
  idToParentId: Map<string, string | null>
  parentSlugToChildSlugs: Map<string, string[]>
}

async function buildCategoryLookup(): Promise<CategoryLookup> {
  const result = await db.execute('SELECT id, slug, parentId FROM categories')
  const slugToId = new Map<string, string>()
  const idToParentId = new Map<string, string | null>()
  const parentSlugToChildSlugs = new Map<string, string[]>()

  for (const row of result.rows as any[]) {
    slugToId.set(row.slug, row.id)
    idToParentId.set(row.id, row.parentId)
  }

  // Build parent → children mapping
  for (const row of result.rows as any[]) {
    if (row.parentId) {
      const parent = (result.rows as any[]).find((r: any) => r.id === row.parentId)
      if (parent) {
        const children = parentSlugToChildSlugs.get(parent.slug) || []
        children.push(row.slug)
        parentSlugToChildSlugs.set(parent.slug, children)
      }
    }
  }

  return { slugToId, idToParentId, parentSlugToChildSlugs }
}

// ============================================
// Map product name to category
// ============================================
function mapNameToCategory(name: string, lookup: CategoryLookup): string | null {
  const nameUpper = name.toUpperCase()

  // Step 1: Keyword matching
  let matchedSlug: string | null = null
  for (const [slug, keywords] of CATEGORY_KEYWORD_MAP) {
    for (const kw of keywords) {
      if (nameUpper.includes(kw)) {
        matchedSlug = slug
        break
      }
    }
    if (matchedSlug) break
  }

  if (!matchedSlug) return null

  // Step 2: Apply corrections
  matchedSlug = applyCategoryCorrections(nameUpper, matchedSlug)

  // Step 3: Subcategory refinement — if matched slug is a parent category
  if (SUBCATEGORY_RULES[matchedSlug]) {
    for (const sub of SUBCATEGORY_RULES[matchedSlug]) {
      for (const kw of sub.keywords) {
        if (nameUpper.includes(kw)) {
          matchedSlug = sub.slug
          break
        }
      }
      if (matchedSlug !== matchedSlug) break // already changed
    }
  }

  // Also check if the matched slug is itself a parent that has children
  const childSlugs = lookup.parentSlugToChildSlugs.get(matchedSlug)
  if (childSlugs && childSlugs.length > 0) {
    // Try to match a subcategory
    for (const childSlug of childSlugs) {
      const subRules = SUBCATEGORY_RULES[matchedSlug]
      if (subRules) {
        for (const rule of subRules) {
          if (rule.slug === childSlug) {
            for (const kw of rule.keywords) {
              if (nameUpper.includes(kw)) {
                matchedSlug = childSlug
                break
              }
            }
          }
          if (lookup.slugToId.has(matchedSlug) && childSlugs.includes(matchedSlug)) break
        }
      }
    }
  }

  // Resolve slug to ID
  return lookup.slugToId.get(matchedSlug) || null
}

// ============================================
// Air Intra API helpers
// ============================================
// Sesión 45 QA Fase 1: credenciales movidas a env vars (antes hardcodeadas en source).
// IMPORTANTE: rotar las credenciales actuales porque ya están en git history.
// Variables necesarias en Vercel: AIR_INTRA_USER, AIR_INTRA_PASS
async function airIntraLogin(): Promise<string | null> {
  try {
    const user = process.env.AIR_INTRA_USER
    const pass = process.env.AIR_INTRA_PASS
    if (!user || !pass) {
      console.error('[enrich] AIR_INTRA_USER o AIR_INTRA_PASS no configurados')
      return null
    }
    const res = await fetch(`https://api.air-intra.com/v2/?q=login&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    })
    const text = await res.text()
    // Strip PHP notices
    const jsonStart = text.indexOf('{')
    if (jsonStart === -1) return null
    const cleanJson = text.substring(jsonStart)
    const data = JSON.parse(cleanJson)
    return data.token || null
  } catch (e) {
    console.error('Air Intra login failed:', e)
    return null
  }
}

function stripPhpNotices(text: string): string {
  return text.replace(/<br\s*\/?>\s*<b>[\s\S]*?<\/b>\s*[\s\S]*?<br\s*\/?>/g, '')
    .replace(/<b>[\s\S]*?<\/b>:\s*[\s\S]*?(?=\n|[{[])/g, '')
}

async function fetchAirIntraProductImages(token: string, providerSkus: string[]): Promise<Map<string, string[]>> {
  const imageMap = new Map<string, string[]>()
  const pageSize = 500
  let page = 1
  let hasMore = true

  while (hasMore) {
    try {
      const res = await fetch(`https://api.air-intra.com/v2/?q=articulos&page=${page}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ pagina: page }),
      })

      const text = await res.text()
      let cleaned = stripPhpNotices(text)

      // Try to find JSON start
      const jsonStart = cleaned.indexOf('[')
      if (jsonStart === -1) {
        hasMore = false
        break
      }
      cleaned = cleaned.substring(jsonStart)

      // Try to parse
      let products: any[]
      try {
        products = JSON.parse(cleaned)
      } catch {
        // Try extracting valid JSON array
        let depth = 0, endIdx = -1
        for (let i = 0; i < cleaned.length; i++) {
          if (cleaned[i] === '[') depth++
          else if (cleaned[i] === ']') { depth--; if (depth === 0) { endIdx = i; break } }
        }
        if (endIdx === -1) { hasMore = false; break }
        try {
          products = JSON.parse(cleaned.substring(0, endIdx + 1))
        } catch {
          hasMore = false
          break
        }
      }

      if (!Array.isArray(products) || products.length === 0) {
        hasMore = false
        break
      }

      for (const p of products) {
        const sku = p.codigo || p.codiart
        if (!sku) continue

        // Check if this product is in our target list
        const skuStr = String(sku)
        if (!providerSkus.includes(skuStr)) continue

        // Extract images
        const images: string[] = []
        if (p.imagenes && Array.isArray(p.imagenes)) {
          for (const img of p.imagenes) {
            if (typeof img === 'string' && img.startsWith('http')) images.push(img)
            else if (img?.url) images.push(img.url)
            else if (img?.imagen) images.push(img.imagen)
          }
        }
        if (p.imagen && typeof p.imagen === 'string' && p.imagen.startsWith('http')) {
          images.push(p.imagen)
        }
        if (p.foto && typeof p.foto === 'string' && p.foto.startsWith('http')) {
          images.push(p.foto)
        }
        if (p.imagen_url && typeof p.imagen_url === 'string' && p.imagen_url.startsWith('http')) {
          images.push(p.imagen_url)
        }
        if (p.img && typeof p.img === 'string' && p.img.startsWith('http')) {
          images.push(p.img)
        }

        if (images.length > 0) {
          imageMap.set(skuStr, images)
        }
      }

      page++
      // Small delay between pages
      await new Promise(r => setTimeout(r, 500))
    } catch (e) {
      console.error(`Error fetching Air Intra page ${page}:`, e)
      hasMore = false
    }
  }

  return imageMap
}

// ============================================
// MAIN HANDLER
// ============================================
export async function POST(request: NextRequest) {
  try {
    // Sesión 44 fix: agregado auth — antes este endpoint era público y cualquiera podía
    // disparar ~14.000 queries a Turso (DoS potencial, mismo bug que init-brands).
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const action = body.action || 'all' // 'categories' | 'images' | 'dates' | 'all'

    const results: any = { categories: null, images: null, dates: null }

    // ==========================================
    // 1. ENRICH CATEGORIES
    // ==========================================
    if (action === 'categories' || action === 'all') {
      logger.debug('[enrich] Starting category enrichment...')

      const lookup = await buildCategoryLookup()
      const uncategorized = await db.execute(
        `SELECT id, name, providerSku, supplierCategory FROM products WHERE categoryId IS NULL`
      )

      let assigned = 0
      let notMatched = 0
      const batchSize = 100
      const rows = uncategorized.rows as any[]

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        const updates: Promise<any>[] = []

        for (const product of batch) {
          const categoryId = mapNameToCategory(product.name, lookup)
          if (categoryId) {
            updates.push(
              db.execute({
                sql: 'UPDATE products SET categoryId = ?, updatedAt = datetime(\'now\') WHERE id = ?',
                args: [categoryId, product.id],
              })
            )
            assigned++
          } else {
            notMatched++
          }
        }

        await Promise.all(updates)
      }

      results.categories = {
        totalUncategorized: rows.length,
        assigned,
        notMatched,
      }
      logger.debug(`[enrich] Categories: ${assigned} assigned, ${notMatched} not matched`)
    }

    // ==========================================
    // 2. ENRICH IMAGES (from Air Intra API)
    // ==========================================
    if (action === 'images' || action === 'all') {
      logger.debug('[enrich] Starting image enrichment...')

      // Find products without images from Air Intra
      const noImages = await db.execute(
        `SELECT id, name, providerSku, providerId FROM products
         WHERE (images = '[]' OR images IS NULL)
         AND providerId = 'air-intra-1780331633566'`
      )

      const rows = noImages.rows as any[]
      const providerSkus = rows.map((r: any) => String(r.providerSku)).filter(Boolean)

      if (providerSkus.length === 0) {
        results.images = { total: 0, enriched: 0, message: 'No products need image enrichment' }
      } else {
        // Build a lookup from providerSku to product id
        const skuToProductId = new Map<string, string>()
        for (const row of rows) {
          if (row.providerSku) skuToProductId.set(String(row.providerSku), row.id)
        }

        // Try to get images from Air Intra API
        const token = await airIntraLogin()
        let enriched = 0

        if (token) {
          logger.debug(`[enrich] Got Air Intra token, fetching images for ${providerSkus.length} products...`)

          // We need to paginate through all articulos pages to find our products
          // This is expensive but necessary since we can't query by specific SKUs
          const imageMap = await fetchAirIntraProductImages(token, providerSkus)

          for (const [sku, images] of imageMap) {
            const productId = skuToProductId.get(sku)
            if (productId && images.length > 0) {
              await db.execute({
                sql: 'UPDATE products SET images = ?, updatedAt = datetime(\'now\') WHERE id = ?',
                args: [JSON.stringify(images), productId],
              })
              enriched++
            }
          }
        } else {
          logger.debug('[enrich] Could not login to Air Intra, skipping image enrichment')
        }

        results.images = {
          totalWithoutImages: rows.length,
          enriched,
          notFound: rows.length - enriched,
        }
      }
      logger.debug(`[enrich] Images: enriched ${results.images.enriched || 0}`)
    }

    // ==========================================
    // 3. FIX CREATED AT DATES
    // ==========================================
    if (action === 'dates' || action === 'all') {
      logger.debug('[enrich] Fixing createdAt dates...')

      const result = await db.execute(
        `UPDATE products SET createdAt = COALESCE(createdAt, updatedAt, datetime('now')) WHERE createdAt IS NULL`
      )

      results.dates = {
        fixed: result.rowsAffected,
      }
      logger.debug(`[enrich] Fixed ${result.rowsAffected} products with null createdAt`)
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error('[enrich] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET — preview what would be enriched
export async function GET(request: NextRequest) {
  try {
    const lookup = await buildCategoryLookup()

    const [
      uncategorized,
      noImages,
      nullDates,
      totalProducts,
    ] = await Promise.all([
      db.execute(`SELECT id, name, providerSku, supplierCategory FROM products WHERE categoryId IS NULL LIMIT 30`),
      db.execute(`SELECT COUNT(*) as count FROM products WHERE (images = '[]' OR images IS NULL)`),
      db.execute(`SELECT COUNT(*) as count FROM products WHERE createdAt IS NULL`),
      db.execute(`SELECT COUNT(*) as count FROM products`),
    ])

    // Preview category assignments for the first 30 uncategorized products
    const previews = (uncategorized.rows as any[]).map(p => ({
      name: p.name,
      providerSku: p.providerSku,
      suggestedCategory: mapNameToCategory(p.name, lookup),
    }))

    return NextResponse.json({
      totalProducts: (totalProducts.rows as any[])[0].count,
      uncategorized: {
        total: (await db.execute(`SELECT COUNT(*) as count FROM products WHERE categoryId IS NULL`)).rows[0],
        preview: previews,
      },
      withoutImages: (noImages.rows as any[])[0].count,
      nullCreatedAt: (nullDates.rows as any[])[0].count,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
