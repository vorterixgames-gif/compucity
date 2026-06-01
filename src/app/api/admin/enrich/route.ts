import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================
// ALLOWED SLUGS — only peripherals + components + cables
// (Store only sells: mouse, teclados, parlantes, joysticks, cables, componentes de PC)
// ============================================
const ALLOWED_SLUGS = new Set([
  'perifericos', 'teclados', 'mouse', 'parlantes', 'auriculares', 'mousepads',
  'webcams', 'microfonos', 'joysticks', 'kits-gamer',
  'componentes-de-pc', 'placas-de-video', 'microprocesadores', 'motherboards',
  'memorias-ram', 'discos-ssd', 'discos-hdd', 'fuentes', 'gabinetes',
  'refrigeracion', 'pastas-termicas',
  'cables-y-adaptadores', 'placas-de-red',
])

// ============================================
// KEYWORD MAP — only for allowed categories, order matters
// ============================================
const KEYWORD_MAP: [string, string[]][] = [
  // === PERIFERICOS ===
  ['auriculares', ['AURICULAR', 'HEADSET', 'HEADPHONE', 'JBL QUANTUM']],
  ['mouse', ['MOUSE']],
  ['teclados', ['TECLADO', 'KEYBOARD']],
  ['parlantes', ['PARLANTE', 'SPEAKER', 'BARRA DE SONIDO', 'SOUND BAR']],
  ['mousepads', ['MOUSEPAD', 'PAD GAMER', 'ALFOMBRILLA']],
  ['microfonos', ['MICROFONO', 'MICROPHONE']],
  ['webcams', ['WEBCAM', 'CAM WEB', 'WEB CAM', 'BRIO', 'FACECAM']],
  ['joysticks', ['JOYSTICK', 'GAMEPAD', 'CONTROLLER', 'GAME PAD', 'VOLANTE', 'G29', 'G923', 'F710']],
  ['kits-gamer', ['KIT GABINETE', 'KIT TECLADO', 'KIT GAMER']],
  // === COMPONENTES ===
  ['memorias-ram', ['MEMORIA DDR', 'DDR3', 'DDR4', 'DDR5', 'SODIMM', 'CORSAIR MEMORY', 'RAM DDR']],
  ['discos-ssd', ['SSD', 'NVME', 'M.2', 'GEN4', 'GEN3']],
  ['discos-hdd', ['DISCO RIGIDO', 'HDD', 'IRONWOLF', 'SKYHAWK', 'HD 2TB', 'HD 4TB', 'HD 8TB', 'HD 10TB', 'HD 12TB', 'BARRACUDA', 'WD BLUE', 'WD BLACK', 'WD RED', 'WD PURPLE']],
  ['microprocesadores', ['RYZEN', 'INTEL I3', 'INTEL I5', 'INTEL I7', 'INTEL I9', 'CORE I', 'PENTIUM', 'CORE ULTRA']],
  ['motherboards', ['MOTHER', 'H610', 'B760', 'H810', 'A520', 'A620', 'B650', 'B550', 'H510']],
  ['placas-de-video', ['RTX', 'GTX', 'RADEON RX', 'GEFORCE', 'GRAPHICS CARD', 'QUADRO RTX', 'VGA ', 'GT 1030', 'RX 9060', 'RX 9070']],
  ['fuentes', ['FUENTE', 'POWER SUPPLY', 'PSU']],
  ['gabinetes', ['GABINETE', 'GAB GAMEMAX', 'GAB ARKHAM', 'GAB PERF', 'GAB NZXT', 'TOWER', 'GAMEMAX', 'ARKHAM ']],
  ['refrigeracion', ['COOLER', 'WATER COOL', 'LIQUID COOL', 'DISIPADOR', 'HEATSINK', 'SWAFAN', 'FAN COOLER', 'AIO']],
  ['pastas-termicas', ['PASTA TERMICA', 'THERMAL PASTE']],
  // === CABLES Y CONECTIVIDAD ===
  ['cables-y-adaptadores', ['CABLE', 'ADAPTADOR', 'FICHA RJ45', 'CONVERTER', 'UTP CAT', 'HUB USB', 'CAT.5E', 'CAT.6', 'CAT.5', 'RJ45', 'GLC CAT', 'PLUG RJ', 'HDMI', 'DISPLAYPORT', 'USB-C', 'USBC', 'HUB TP-LINK UH', 'HUB GENIUS', 'FURUKAWA']],
  ['placas-de-red', ['TP-LINK WN7', 'TP-LINK WN8', 'TP-LINK TG-3', 'RED PCI-E TP', 'RED USB TP', 'PLACA DE RED', 'P.REDW', 'TL-WN']],
]

// ============================================
// Build category lookup from DB
// ============================================
interface CategoryLookup {
  slugToId: Map<string, string>
  idToParentId: Map<string, string | null>
  idToSlug: Map<string, string>
  parentSlugToChildSlugs: Map<string, string[]>
  allowedCatIds: Set<string>
}

async function buildCategoryLookup(): Promise<CategoryLookup> {
  const result = await db.execute('SELECT id, slug, parentId FROM categories')
  const slugToId = new Map<string, string>()
  const idToParentId = new Map<string, string | null>()
  const idToSlug = new Map<string, string>()
  const parentSlugToChildSlugs = new Map<string, string[]>()

  for (const row of result.rows as any[]) {
    slugToId.set(row.slug, row.id)
    idToParentId.set(row.id, row.parentId)
    idToSlug.set(row.id, row.slug)
  }

  for (const row of result.rows as any[]) {
    if (row.parentId) {
      const parentSlug = idToSlug.get(row.parentId)
      if (parentSlug) {
        const children = parentSlugToChildSlugs.get(parentSlug) || []
        children.push(row.slug)
        parentSlugToChildSlugs.set(parentSlug, children)
      }
    }
  }

  // Build allowed category IDs set
  const allowedCatIds = new Set<string>()
  for (const [slug, id] of slugToId) {
    if (ALLOWED_SLUGS.has(slug)) allowedCatIds.add(id)
  }
  // Add parent IDs for allowed children, and children IDs for allowed parents
  for (const [slug, id] of slugToId) {
    const parentId = idToParentId.get(id)
    if (parentId && allowedCatIds.has(id)) allowedCatIds.add(parentId)
    if (parentId && allowedCatIds.has(parentId)) allowedCatIds.add(id)
  }

  return { slugToId, idToParentId, idToSlug, parentSlugToChildSlugs, allowedCatIds }
}

// ============================================
// Map product name to category slug
// ============================================
function mapNameToCategorySlug(name: string): string | null {
  const n = name.toUpperCase()

  let matchedSlug: string | null = null
  for (const [slug, keywords] of KEYWORD_MAP) {
    for (const kw of keywords) {
      if (n.includes(kw)) {
        matchedSlug = slug
        break
      }
    }
    if (matchedSlug) break
  }

  if (!matchedSlug) return null

  // Corrections
  if (matchedSlug === 'microprocesadores' && n.includes('MOTHER')) matchedSlug = 'motherboards'
  if (matchedSlug === 'fuentes' && (n.includes('GAB') || n.includes('GABINETE'))) matchedSlug = 'gabinetes'
  if (matchedSlug === 'cables-y-adaptadores' && (n.includes('GAB') || n.includes('GABINETE'))) matchedSlug = 'gabinetes'

  if (!ALLOWED_SLUGS.has(matchedSlug)) return null

  return matchedSlug
}

// ============================================
// MAIN HANDLER
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const action = body.action || 'all' // 'categories' | 'dates' | 'all'

    const results: any = { categories: null, dates: null }

    // ==========================================
    // 1. ENRICH CATEGORIES + DEACTIVATE NON-ALLOWED
    // ==========================================
    if (action === 'categories' || action === 'all') {
      console.log('[enrich] Starting category enrichment (peripherals + components only)...')

      const lookup = await buildCategoryLookup()
      const allProducts = await db.execute(
        `SELECT id, name, categoryId, isActive FROM products`
      )

      const rows = allProducts.rows as any[]
      const toDeactivate: string[] = []
      const toCategorize: Record<string, string[]> = {}
      let alreadyCorrect = 0

      for (const product of rows) {
        const matchedSlug = mapNameToCategorySlug(product.name)

        if (matchedSlug) {
          const catId = lookup.slugToId.get(matchedSlug)
          if (catId && catId !== product.categoryId) {
            if (!toCategorize[matchedSlug]) toCategorize[matchedSlug] = []
            toCategorize[matchedSlug].push(product.id)
          } else if (catId === product.categoryId) {
            alreadyCorrect++
          }
        } else {
          // No keyword match — check if it has an allowed category already
          if (product.categoryId && lookup.allowedCatIds.has(product.categoryId)) {
            alreadyCorrect++
          } else {
            // Not allowed — deactivate if active
            if (product.isActive === 1) {
              toDeactivate.push(product.id)
            }
          }
        }
      }

      // Batch deactivate
      for (let i = 0; i < toDeactivate.length; i += 100) {
        const batch = toDeactivate.slice(i, i + 100)
        const placeholders = batch.map(() => '?').join(',')
        await db.execute({
          sql: `UPDATE products SET isActive = 0, updatedAt = datetime('now') WHERE id IN (${placeholders})`,
          args: batch,
        })
      }

      // Batch categorize
      for (const [slug, ids] of Object.entries(toCategorize)) {
        const catId = lookup.slugToId.get(slug)
        if (!catId) continue
        for (let i = 0; i < ids.length; i += 100) {
          const batch = ids.slice(i, i + 100)
          const placeholders = batch.map(() => '?').join(',')
          await db.execute({
            sql: `UPDATE products SET categoryId = ?, isActive = 1, updatedAt = datetime('now') WHERE id IN (${placeholders})`,
            args: [catId, ...batch],
          })
        }
      }

      results.categories = {
        totalProducts: rows.length,
        categorized: Object.values(toCategorize).flat().length,
        deactivated: toDeactivate.length,
        alreadyCorrect,
        byCategory: Object.fromEntries(
          Object.entries(toCategorize).map(([slug, ids]) => [slug, ids.length])
        ),
      }
      console.log(`[enrich] Categories: ${results.categories.categorized} assigned, ${results.categories.deactivated} deactivated`)
    }

    // ==========================================
    // 2. FIX CREATED AT DATES
    // ==========================================
    if (action === 'dates' || action === 'all') {
      console.log('[enrich] Fixing createdAt dates...')

      const result = await db.execute(
        `UPDATE products SET createdAt = COALESCE(createdAt, updatedAt, datetime('now')) WHERE createdAt IS NULL`
      )

      results.dates = {
        fixed: result.rowsAffected,
      }
      console.log(`[enrich] Fixed ${result.rowsAffected} products with null createdAt`)
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

// GET — stats preview
export async function GET(request: NextRequest) {
  try {
    const lookup = await buildCategoryLookup()

    const [totalProducts, activeProducts, visibleProducts, uncategorized] = await Promise.all([
      db.execute(`SELECT COUNT(*) as c FROM products`),
      db.execute(`SELECT COUNT(*) as c FROM products WHERE isActive = 1`),
      db.execute(`SELECT COUNT(*) as c FROM products WHERE isActive = 1 AND stock > 0 AND categoryId IS NOT NULL`),
      db.execute(`SELECT COUNT(*) as c FROM products WHERE categoryId IS NULL AND isActive = 1`),
    ])

    // Category distribution
    const byCategory = await db.execute(`
      SELECT c.slug, c.name, COUNT(*) as count,
        SUM(CASE WHEN p.stock > 0 THEN 1 ELSE 0 END) as with_stock
      FROM products p
      JOIN categories c ON p.categoryId = c.id
      WHERE p.isActive = 1
      GROUP BY c.slug, c.name
      ORDER BY count DESC
    `)

    return NextResponse.json({
      totalProducts: (totalProducts.rows as any[])[0].c,
      activeProducts: (activeProducts.rows as any[])[0].c,
      visibleProducts: (visibleProducts.rows as any[])[0].c,
      uncategorizedActive: (uncategorized.rows as any[])[0].c,
      allowedCategories: [...ALLOWED_SLUGS],
      categoryDistribution: (byCategory.rows as any[]).map(r => ({
        slug: r.slug,
        name: r.name,
        total: r.count,
        withStock: r.with_stock,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
