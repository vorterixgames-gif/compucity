import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchDollarRate, calculateProductPrices } from '@/lib/dollar'
import { deduplicateProducts } from '@/lib/queries'
import {
  extractCompatibility,
  applyCompatibilityFilters,
  type CompatibilityFilters,
} from '@/lib/compatibility'

async function getConfig(key: string, defaultValue: number): Promise<number> {
  const result = await db.execute({
    sql: 'SELECT value FROM store_config WHERE key = ?',
    args: [key],
  })
  const rows = result.rows as any[]
  if (rows.length > 0) {
    try {
      return Number(JSON.parse(rows[0].value).value) || defaultValue
    } catch {
      return defaultValue
    }
  }
  return defaultValue
}

// Map component slots to category slugs
const COMPONENT_SLOTS: { slot: string; label: string; categorySlug: string }[] = [
  { slot: 'processor', label: 'Microprocesador', categorySlug: 'microprocesadores' },
  { slot: 'motherboard', label: 'Motherboard', categorySlug: 'motherboards' },
  { slot: 'ram', label: 'Memoria RAM', categorySlug: 'memorias-ram' },
  { slot: 'gpu', label: 'Placa de Video', categorySlug: 'placas-de-video' },
  { slot: 'ssd', label: 'Disco SSD', categorySlug: 'discos-ssd' },
  { slot: 'hdd', label: 'Disco HDD', categorySlug: 'discos-hdd' },
  { slot: 'psu', label: 'Fuente', categorySlug: 'fuentes' },
  { slot: 'case', label: 'Gabinete', categorySlug: 'gabinetes' },
  { slot: 'cooling', label: 'Refrigeración', categorySlug: 'refrigeracion' },
  { slot: 'thermal', label: 'Pasta Térmica', categorySlug: 'pastas-termicas' },
]

// Name patterns to EXCLUDE from the PC builder (non-consumer/non-relevant products)
const BUILDER_EXCLUDE_PATTERNS: Record<string, string[]> = {
  ssd: ['EXTERNO', 'EXTERNA', 'PORTABLE', 'XS1000', 'SXS1000', 'SHIELD', 'SC750', 'DUAL', 'DELL', 'TARJETA DE MEMORIA', 'EXTENSION', 'DISK P/', 'MIRRORING', 'THINKSYSTEM', 'NAS', 'CONSOLA', 'P/SERVER', 'DVR/NVR', 'NOTEBOOK', 'LAPTOP', 'PC GAMER', 'PC KELYX', 'PC LENOVO', 'SIST.', 'MINI PC', 'BAREBONE'],
  hdd: ['EXTERNO', 'EXTERNA', 'PORTABLE', 'DELL', 'LENOVO', 'VIDEO RECORDER', 'KIT ', 'SPONGE', 'BAHIA', 'COLOCACION', 'NOTEBOOK', 'LAPTOP', 'PC GAMER', 'PC KELYX', 'PC LENOVO', 'SIST.', 'MINI PC', 'BAREBONE'],
  ram: ['SIMM', 'P/DELL SERVER', 'P/HP SERVER', 'P/LENOVO SERVER', 'MOTHER', 'MB ', 'NOTEBOOK', 'LAPTOP', 'PC GAMER', 'PC KELYX', 'PC LENOVO', 'SIST.', 'MINI PC', 'BAREBONE'],
  gpu: ['DELL P2', 'DELL E2', 'HP Z', 'MONITOR', 'M/M', 'MTS', 'IP CAM', 'REPUESTO', '(RMA)', 'MB ', 'NOTEBOOK', 'LAPTOP', 'PC GAMER', 'PC KELYX', 'PC LENOVO', 'SIST.', 'MINI PC', 'BAREBONE', 'CABLE', 'ADAPTADOR'],
  psu: ['MAENI', 'PERFORMANCE 12V', 'PERFORMANCE 9V', 'PERFORMANCE CARGA', '5V ', 'DE ALIMENTACION', 'DE EPL', 'REDUNDANTE', 'AUXILIAR', 'ATX P3', 'LENOVO', 'ENCHUFE', 'HP FUENTE REDUNDANTE', 'HP RPS', 'HPX311', 'NOTEBOOK', 'LAPTOP', 'PC GAMER', 'PC KELYX', 'PC LENOVO', 'SIST.', 'MINI PC', 'BAREBONE'],
  cooling: ['PRINTER', 'DELL', 'AIO 24', 'HP SMART', 'NOTEBOOK', 'LAPTOP', 'PC GAMER', 'PC KELYX', 'PC LENOVO', 'SIST.', 'MINI PC', 'BAREBONE'],
  case: ['HP X421', 'FUENTE DE ALIMENTACI', 'NOTEBOOK', 'LAPTOP', 'PC KELYX', 'PC LENOVO', 'SIST.', 'MINI PC', 'BAREBONE'],
  processor: ['NOTEBOOK', 'LAPTOP', 'PC GAMER', 'PC KELYX', 'PC LENOVO', 'SIST.', 'MINI PC', 'BAREBONE'],
  motherboard: ['NOTEBOOK', 'LAPTOP', 'PC GAMER', 'PC KELYX', 'PC LENOVO', 'SIST.', 'MINI PC', 'BAREBONE'],
  thermal: ['NOTEBOOK', 'LAPTOP', 'PC GAMER', 'PC KELYX', 'PC LENOVO', 'SIST.', 'MINI PC', 'BAREBONE'],
}

// *** INCLUSION PATTERNS (WHITELIST) - THE KEY PERMANENT FIX ***
// Each PC Builder slot defines what product names MUST contain to be eligible.
// If a product doesn't match ANY inclusion pattern, it's excluded regardless of category.
// This is the primary defense against miscategorization - even if a product is in the
// wrong category in the database, it won't appear in the wrong PC Builder slot.
const BUILDER_INCLUDE_PATTERNS: Record<string, string[]> = {
  processor: ['RYZEN', 'INTEL I3', 'INTEL I5', 'INTEL I7', 'INTEL I9', 'CORE I3', 'CORE I5', 'CORE I7', 'CORE I9', 'PENTIUM', 'CORE ULTRA', 'CELERO', 'ATHLON', 'XEON', 'I3-', 'I5-', 'I7-', 'I9-'],
  motherboard: ['MOTHER', 'H610', 'B760', 'H810', 'A520', 'A620', 'B650', 'B550', 'H510', 'Z790', 'Z690', 'B660', 'H670', 'X670', 'A320', 'B450', 'X570', 'Z590', 'Z490', 'B460', 'H410', 'PLACA BASE', 'MAINBOARD'],
  ram: ['DDR3', 'DDR4', 'DDR5', 'SODIMM', 'DIMM', 'MEMORIA RAM', 'CORSAIR VENGEANCE', 'CORSAIR MEMORY', 'KINGSTON FURY', 'G.SKILL', 'XPG'],
  gpu: ['RTX', 'GTX', 'RADEON RX', 'GEFORCE', 'GRAPHICS CARD', 'QUADRO RTX', 'PLACA DE VIDEO', 'VGA RTX', 'VGA GTX', 'VGA RADEON', 'RX ', 'ARC ', 'TITAN'],
  ssd: ['SSD', 'NVME', 'M.2', 'GEN4', 'GEN3', 'SOLID STATE'],
  hdd: ['DISCO RIGIDO', 'HDD', 'IRONWOLF', 'SKYHAWK', 'HD SEAGATE INTERNO', 'HD TOSHIBA INTERNO', 'BARRACUDA', 'BLUE ', 'HARD DRIVE'],
  psu: ['FUENTE', 'POWER SUPPLY', 'PSU', 'CORSAIR RM', 'CORSAIR CX', 'CORSAIR TX', 'SEASONIC', 'EVGA ', 'COUGAR', 'THERMALTAKE SMART', 'NOX ', 'AEROCOOL', 'XPG CORE'],
  case: ['GABINETE', 'CHASSIS', 'TOWER', 'CASE ', 'CTE ', '5000T', '4500X', 'BLAZE FORCE', 'INFINITY GLASS', 'CORSAIR ', 'COOLER MASTER ', 'NZXT ', 'FRONTAL '],
  cooling: ['COOLER', 'WATER COOL', 'LIQUID COOL', 'DISIPADOR', 'HEATSINK', 'SWAFAN', 'FAN COOLER', 'ICUE LINK', 'AIO ', 'AK620', 'NH-D15', 'NH-U12', 'DARK ROCK', 'HYPER '],
  thermal: ['PASTA TERMICA', 'THERMAL PASTE', 'KRYONAUT', 'MX-', 'ARCTIC SILVER', 'NT-H1', 'NT-H2', 'HYDRONAUT'],
}

/**
 * Check if a product is eligible for a PC Builder slot.
 * Uses BOTH inclusion (whitelist) and exclusion (blacklist) patterns.
 * 
 * Logic:
 * 1. If the slot has inclusion patterns AND the product matches at least one → NOT excluded
 * 2. If the slot has inclusion patterns AND the product matches NONE → EXCLUDED (even if category is correct)
 * 3. If the slot has NO inclusion patterns → fall back to exclusion patterns only
 * 4. If the product matches any exclusion pattern → EXCLUDED
 */
function isExcludedFromBuilder(slot: string, name: string): boolean {
  const upper = name.toUpperCase()

  // Step 1: Check inclusion patterns (whitelist) - the permanent fix
  const includePatterns = BUILDER_INCLUDE_PATTERNS[slot]
  if (includePatterns && includePatterns.length > 0) {
    const matchesInclude = includePatterns.some(p => upper.includes(p.toUpperCase()))
    if (!matchesInclude) {
      // Product doesn't match ANY expected pattern for this slot → excluded
      return true
    }
  }

  // Step 2: Check exclusion patterns (blacklist) - catches edge cases
  const excludePatterns = BUILDER_EXCLUDE_PATTERNS[slot]
  if (excludePatterns) {
    if (excludePatterns.some(p => upper.includes(p.toUpperCase()))) {
      return true
    }
  }

  return false
}

export async function GET(request: NextRequest) {
  try {
    const slot = request.nextUrl.searchParams.get('slot')

    const dollar = await fetchDollarRate()
    const markup = await getConfig('markup', 30)
    const cashDiscount = await getConfig('cash_discount', 10)

    // Build category markup map for price calculation
    const catMarkupResult = await db.execute('SELECT id, markup, cashDiscount, ivaRate FROM categories')
    const catMarkupMap = new Map<string, { markup: number | null; cashDiscount: number | null; ivaRate: number | null }>()
    for (const row of catMarkupResult.rows as any[]) {
      catMarkupMap.set(row.id, {
        markup: row.markup != null ? Number(row.markup) : null,
        cashDiscount: row.cashDiscount != null ? Number(row.cashDiscount) : null,
        ivaRate: row.ivaRate != null ? Number(row.ivaRate) : null,
      })
    }

    // If requesting a specific slot, return products for that component category
    if (slot) {
      const slotConfig = COMPONENT_SLOTS.find(s => s.slot === slot)
      if (!slotConfig) {
        return NextResponse.json({ error: 'Componente no reconocido' }, { status: 400 })
      }

      // Find the category by slug
      const catResult = await db.execute({
        sql: 'SELECT id FROM categories WHERE slug = ?',
        args: [slotConfig.categorySlug],
      })
      const catRows = catResult.rows as any[]
      if (catRows.length === 0) {
        return NextResponse.json({ ok: true, products: [], slot: slotConfig, filters: {} })
      }

      const categoryId = catRows[0].id

      // Get active products in this category
      const result = await db.execute({
        sql: `SELECT p.* FROM products p
              WHERE p.categoryId = ? AND p.isActive = 1 AND p.stock > 0 AND p.categoryId IS NOT NULL
              ORDER BY CASE WHEN p.images IS NOT NULL AND p.images != '[]' THEN 0 ELSE 1 END, p.price ASC`,
        args: [categoryId],
      })

      const products = deduplicateProducts((result.rows as any[]).map(p => {
        const catMarkup = p.categoryId ? catMarkupMap.get(p.categoryId) : null
        const calculated = calculateProductPrices(p, dollar.rate, markup, cashDiscount, catMarkup)
        return calculated
      })).filter(p => !isExcludedFromBuilder(slot, p.name))

      // Parse compatibility filters from query params
      const filters: CompatibilityFilters = {}
      const socketParam = request.nextUrl.searchParams.get('socket')
      const ddrParam = request.nextUrl.searchParams.get('ddr')
      const minWattageParam = request.nextUrl.searchParams.get('minWattage')

      if (socketParam) filters.socket = socketParam
      if (ddrParam) filters.ddr = ddrParam
      if (minWattageParam) filters.minWattage = parseInt(minWattageParam)

      // Apply compatibility filters and enrich products with compat info
      const enrichedProducts = applyCompatibilityFilters(products, slot, filters)

      // Separate compatible and incompatible for sorting (compatible first)
      const compatible = enrichedProducts.filter(e => e.isCompatible)
      const incompatible = enrichedProducts.filter(e => !e.isCompatible)
      const sorted = [...compatible, ...incompatible]

      const finalProducts = sorted.map(({ product, compatInfo, isCompatible }) => ({
        ...product,
        compatInfo,
        isCompatible,
      }))

      return NextResponse.json({
        ok: true,
        products: finalProducts,
        slot: slotConfig,
        filters,
      })
    }

    // If no slot specified, return the list of available slots with counts
    const slotsWithCounts = await Promise.all(
      COMPONENT_SLOTS.map(async (s) => {
        try {
          const catResult = await db.execute({
            sql: 'SELECT id FROM categories WHERE slug = ?',
            args: [s.categorySlug],
          })
          const catRows = catResult.rows as any[]
          if (catRows.length === 0) return { ...s, count: 0 }

          const countResult = await db.execute({
            sql: 'SELECT COUNT(*) as total FROM products WHERE categoryId = ? AND isActive = 1 AND stock > 0 AND categoryId IS NOT NULL',
            args: [catRows[0].id],
          })
          return { ...s, count: (countResult.rows[0] as any).total }
        } catch {
          return { ...s, count: 0 }
        }
      })
    )

    return NextResponse.json({ ok: true, slots: slotsWithCounts })
  } catch (error) {
    console.error('PC Builder API error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
