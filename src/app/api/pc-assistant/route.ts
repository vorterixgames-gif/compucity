import { NextRequest, NextResponse } from 'next/server'
import { grokChat } from '@/lib/grok'
import { db } from '@/lib/db'
import { fetchDollarRate, calculateProductPrices } from '@/lib/dollar'
import { extractCompatibility, applyCompatibilityFilters } from '@/lib/compatibility'

// ============================================
// Types
// ============================================

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface BuildComponent {
  slot: string
  label: string
  productId: string
  productName: string
  productPrice: number
  productComparePrice: number
  productSlug: string
  productImages: string
  productStock: number
  productSpecs: string
  quantity: number
}

interface SuggestedBuild {
  name: string
  description: string
  totalPrice: number
  totalListPrice: number
  components: BuildComponent[]
}

// Slot definitions matching the frontend
const SLOTS = [
  { slot: 'processor', label: 'Microprocesador', categorySlug: 'microprocesadores', required: true },
  { slot: 'motherboard', label: 'Motherboard', categorySlug: 'motherboards', required: true },
  { slot: 'ram', label: 'Memoria RAM', categorySlug: 'memorias-ram', required: true },
  { slot: 'gpu', label: 'Placa de Video', categorySlug: 'placas-de-video', required: false },
  { slot: 'ssd', label: 'Disco SSD', categorySlug: 'discos-ssd', required: true },
  { slot: 'psu', label: 'Fuente', categorySlug: 'fuentes', required: true },
  { slot: 'case', label: 'Gabinete', categorySlug: 'gabinetes', additionalSlugs: ['gabinetes-con-fuente'], required: true },
  { slot: 'cooling', label: 'Refrigeración', categorySlug: 'refrigeracion', required: false },
]

// Budget allocation profiles per use case
const BUDGET_PROFILES: Record<string, Record<string, number>> = {
  gaming: {
    processor: 0.16,
    motherboard: 0.08,
    ram: 0.08,
    gpu: 0.32,
    ssd: 0.10,
    psu: 0.07,
    case: 0.06,
    cooling: 0.04,
  },
  oficina: {
    processor: 0.22,
    motherboard: 0.12,
    ram: 0.15,
    gpu: 0,
    ssd: 0.18,
    psu: 0.08,
    case: 0.08,
    cooling: 0.02,
  },
  edicion: {
    processor: 0.20,
    motherboard: 0.08,
    ram: 0.14,
    gpu: 0.20,
    ssd: 0.14,
    psu: 0.07,
    case: 0.06,
    cooling: 0.04,
  },
  general: {
    processor: 0.18,
    motherboard: 0.10,
    ram: 0.12,
    gpu: 0.18,
    ssd: 0.14,
    psu: 0.07,
    case: 0.07,
    cooling: 0.03,
  },
}

// Build tier multipliers (fraction of total budget)
const BUILD_TIERS = [
  { name: 'Económica', multiplier: 0.65, emoji: '🟢' },
  { name: 'Recomendada', multiplier: 0.90, emoji: '🟡' },
  { name: 'Premium', multiplier: 1.0, emoji: '🔴' },
]

// ============================================
// Feature Flag
// ============================================

async function isAiEnabled(): Promise<boolean> {
  try {
    const result = await db.execute({
      sql: 'SELECT value FROM store_config WHERE key = ?',
      args: ['ai_enabled'],
    })
    const rows = result.rows as any[]
    if (rows.length > 0) {
      try {
        return JSON.parse(rows[0].value).value === true
      } catch {
        return false
      }
    }
    return false
  } catch {
    return false
  }
}

// ============================================
// JSON Parser (same as validate-build)
// ============================================

function parseLlmJson(raw: string): any | null {
  try {
    return JSON.parse(raw)
  } catch {}

  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim())
    } catch {}
  }

  const braceStart = raw.indexOf('{')
  const braceEnd = raw.lastIndexOf('}')
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(raw.substring(braceStart, braceEnd + 1))
    } catch {}
  }

  return null
}

// ============================================
// Product Fetching
// ============================================

interface ProductRow {
  id: string
  name: string
  slug: string
  price: number
  comparePrice: number | null
  costPrice: number | null
  images: string | null
  specs: string | null
  stock: number
  categoryId: string
  markup: number | null
  cashDiscount: number | null
  ivaRate: number | null
  salePrice: number | null
  saleStart: string | null
  saleEnd: string | null
}

// Include/exclude patterns (same as pc-builder endpoint)
const BUILDER_INCLUDE_PATTERNS: Record<string, string[]> = {
  processor: ['RYZEN', 'INTEL I3', 'INTEL I5', 'INTEL I7', 'INTEL I9', 'CORE I3', 'CORE I5', 'CORE I7', 'CORE I9', 'PENTIUM', 'CORE ULTRA', 'CELERON', 'ATHLON', 'XEON', 'I3-', 'I5-', 'I7-', 'I9-', 'CPU '],
  motherboard: ['MOTHER', 'MB ', 'H610', 'B760', 'H810', 'A520', 'A620', 'B650', 'B550', 'H510', 'Z790', 'Z690', 'B660', 'H670', 'X670', 'A320', 'B450', 'X570', 'X870', 'X870E', 'B860', 'AM4', 'AM5', 'LGA'],
  ram: ['DDR3', 'DDR4', 'DDR5', 'DIMM', 'MEMORIA RAM', 'CORSAIR VENGEANCE', 'CORSAIR MEMORY', 'KINGSTON FURY', 'G.SKILL', 'XPG', 'RAM'],
  gpu: ['RTX', 'GTX', 'RADEON RX', 'GEFORCE', 'GRAPHICS CARD', 'QUADRO RTX', 'PLACA DE VIDEO', 'VGA', 'RX ', 'ARC ', 'GT 1030', 'PLACA POWERCOLOR', 'PLACA SAPPHIRE'],
  ssd: ['SSD', 'NVME', 'M.2', 'GEN4', 'GEN3', 'SOLID STATE', 'DISCO INTERNO SSD', 'DISCO CRUCIAL'],
  psu: ['FUENTE', 'POWER SUPPLY', 'PSU', 'CORSAIR RM', 'CORSAIR CX', 'SEASONIC', 'EVGA ', 'COUGAR', 'THERMALTAKE SMART', 'NOX ', 'AEROCOOL', 'XPG CORE', 'GAMEMAX', 'COOLER MASTER', 'WATT', 'GIGABYTE UD', 'GIGABYTE GP', 'GIGABYTE P', 'GIGABYTE AORUS', 'ASUS TUF', 'ASUS ROG', 'ASUS PRIME', 'XPG KYBER', 'MSI MPG', '80 PLUS', '80+', 'CX ATX', 'PERFORMANCE '],
  case: ['GABINETE', 'CHASSIS', 'TOWER', 'CASE ', 'CTE ', '5000T', '4500X', 'BLAZE FORCE', 'INFINITY GLASS', 'CORSAIR ', 'COOLER MASTER ', 'NZXT ', 'FRONTAL ', 'GAB ', 'XPG ', 'GAMEMAX', 'THERMALTAKE', 'AEROCOOL', 'DEEPCOOL', 'BITFENIX', 'SENTEY', 'NACEB', 'NOX', 'KEPLERTEK', 'GAMING', 'KIT KELYX', 'RAPTOR', 'CON FUENTE', 'C/FUENTE', 'CF ', 'INCLUYE FUENTE'],
  cooling: ['COOLER', 'WATER COOL', 'LIQUID COOL', 'DISIPADOR', 'HEATSINK', 'SWAFAN', 'FAN COOLER', 'ICUE LINK', 'AIO ', 'AK620', 'NH-D15', 'NH-U12', 'DARK ROCK', 'HYPER ', 'FAN ', 'LIQUID', 'ASUS LIQUID', 'THERMALTAKE', 'ARCTIC', 'GAMEMAX', 'CORSAIR', 'NOCTUA', 'BE QUIET', 'TT ', 'WATERFORCE', 'XPG LEVANTE', 'AORUS WATER'],
}

const BUILDER_EXCLUDE_PATTERNS: Record<string, string[]> = {
  processor: ['NOTEBOOK', 'LAPTOP', 'PC GAMER', 'PC KELYX', 'PC LENOVO', 'SIST.', 'MINI PC', 'BAREBONE'],
  motherboard: ['NOTEBOOK', 'LAPTOP', 'PC GAMER', 'PC KELYX', 'PC LENOVO', 'SIST.', 'MINI PC', 'BAREBONE'],
  ram: ['SIMM', 'SODIMM', 'P/DELL SERVER', 'P/HP SERVER', 'P/LENOVO SERVER', 'MOTHER', 'MB ', 'NOTEBOOK', 'LAPTOP', 'PC GAMER', 'PC KELYX', 'PC LENOVO', 'SIST.', 'MINI PC', 'BAREBONE'],
  gpu: ['DELL P2', 'DELL E2', 'HP Z', 'MONITOR', 'M/M', 'MTS', 'IP CAM', 'REPUESTO', '(RMA)', 'MB ', 'NOTEBOOK', 'LAPTOP', 'PC GAMER', 'PC KELYX', 'PC LENOVO', 'SIST.', 'MINI PC', 'BAREBONE', 'CABLE', 'ADAPTADOR'],
  ssd: ['EXTERNO', 'EXTERNA', 'PORTABLE', 'XS1000', 'SXS1000', 'SHIELD', 'SC750', 'DUAL', 'DELL', 'TARJETA DE MEMORIA', 'EXTENSION', 'DISK P/', 'MIRRORING', 'THINKSYSTEM', 'NAS', 'CONSOLA', 'P/SERVER', 'DVR/NVR', 'NOTEBOOK', 'LAPTOP', 'PC GAMER', 'PC KELYX', 'PC LENOVO', 'SIST.', 'MINI PC', 'BAREBONE'],
  psu: ['MAENI', '5V CARGA', 'DE ALIMENTACION', 'DE EPL', 'REDUNDANTE', 'AUXILIAR', 'LENOVO', 'ENCHUFE', 'HP FUENTE REDUNDANTE', 'HP RPS', 'HPX311', 'NOTEBOOK', 'LAPTOP', 'PC GAMER', 'PC KELYX', 'PC LENOVO', 'SIST.', 'MINI PC', 'BAREBONE', 'GABINETE', 'S/FUENTE'],
  case: ['HP X421', 'FUENTE DE ALIMENTACI', 'NOTEBOOK', 'LAPTOP', 'PC KELYX', 'PC LENOVO', 'SIST.', 'MINI PC', 'BAREBONE'],
  cooling: ['PRINTER', 'DELL', 'AIO 24', 'HP SMART', 'NOTEBOOK', 'LAPTOP', 'PC GAMER', 'PC KELYX', 'PC LENOVO', 'SIST.', 'MINI PC', 'BAREBONE'],
}

function isExcludedFromBuilder(slot: string, name: string): boolean {
  const upper = name.toUpperCase()
  const includePatterns = BUILDER_INCLUDE_PATTERNS[slot]
  if (includePatterns && includePatterns.length > 0) {
    if (!includePatterns.some(p => upper.includes(p.toUpperCase()))) return true
  }
  const excludePatterns = BUILDER_EXCLUDE_PATTERNS[slot]
  if (excludePatterns) {
    if (excludePatterns.some(p => upper.includes(p.toUpperCase()))) return true
  }
  return false
}

async function fetchProductsForSlot(
  slotKey: string,
  categorySlug: string,
  additionalSlugs: string[] = [],
  _minPrice?: number,  // unused — price filtering done in ARS after calculatePrices
  _maxPrice?: number,  // unused — price filtering done in ARS after calculatePrices
  compatFilters?: { socket?: string; ddr?: string }
): Promise<ProductRow[]> {
  try {
    // Find category IDs
    const catResult = await db.execute({
      sql: 'SELECT id FROM categories WHERE slug = ?',
      args: [categorySlug],
    })
    const catRows = catResult.rows as any[]
    if (catRows.length === 0) return []

    const categoryId = catRows[0].id
    const subCatResult = await db.execute({
      sql: 'SELECT id FROM categories WHERE parentId = ?',
      args: [categoryId],
    })
    let categoryIds = [categoryId, ...(subCatResult.rows as any[]).map(r => r.id)]

    // Include additional category slugs
    for (const slug of additionalSlugs) {
      const addResult = await db.execute({
        sql: 'SELECT id FROM categories WHERE slug = ?',
        args: [slug],
      })
      const addRows = addResult.rows as any[]
      if (addRows.length > 0) {
        const addSubResult = await db.execute({
          sql: 'SELECT id FROM categories WHERE parentId = ?',
          args: [addRows[0].id],
        })
        categoryIds = [...categoryIds, addRows[0].id, ...(addSubResult.rows as any[]).map(r => r.id)]
      }
    }

    const placeholders = categoryIds.map(() => '?').join(',')
    let query = `
      SELECT p.id, p.name, p.slug, p.price, p.comparePrice, p.costPrice, p.images, p.specs, p.stock,
             p.markup, p.cashDiscount, p.ivaRate, p.salePrice, p.saleStart, p.saleEnd, p.categoryId
      FROM products p
      WHERE p.categoryId IN (${placeholders}) AND p.isActive = 1 AND p.stock > 0 AND p.categoryId IS NOT NULL
    `
    const args: any[] = [...categoryIds]

    // NOTE: Price filtering is done AFTER calculatePrices() converts USD → ARS.
    // The p.price column stores USD values, so SQL-level price filters would
    // compare ARS budgets against USD prices and exclude everything.

    // Compatibility filters for motherboards
    if (slotKey === 'motherboard' && compatFilters?.socket) {
      const socketPatterns: Record<string, string[]> = {
        AM4: ['AM4', 'B550', 'A520', 'X570', 'B450'],
        AM5: ['AM5', 'B650', 'B850', 'A620', 'X670', 'X870'],
        '1700': ['1700', 'B760', 'H610', 'B660', 'Z690', 'Z790'],
        '1851': ['1851', 'B860', 'Z890', 'H810'],
      }
      const patterns = socketPatterns[compatFilters.socket]
      if (patterns) {
        const likeClauses = patterns.map(() => `p.name LIKE ?`).join(' OR ')
        query += ` AND (${likeClauses})`
        patterns.forEach(p => args.push(`%${p}%`))
      }
    }

    // Compatibility filter for RAM
    if (slotKey === 'ram' && compatFilters?.ddr) {
      query += ' AND p.name LIKE ?'
      args.push(`%${compatFilters.ddr}%`)
    }

    query += ' ORDER BY p.price ASC LIMIT 60'

    const result = await db.execute({ sql: query, args })
    const products = (result.rows as any[]).filter(p => !isExcludedFromBuilder(slotKey, p.name))

    return products
  } catch (error) {
    console.error('[pc-assistant] Error fetching products for slot:', slotKey, error)
    return []
  }
}

// ============================================
// Calculate Prices
// ============================================

async function calculatePrices(products: ProductRow[]): Promise<Map<string, { price: number; comparePrice: number }>> {
  const priceMap = new Map<string, { price: number; comparePrice: number }>()

  try {
    const dollar = await fetchDollarRate()

    const markupResult = await db.execute({ sql: "SELECT value FROM store_config WHERE key = 'markup'", args: [] })
    const markupRows = markupResult.rows as any[]
    const globalMarkup = markupRows.length > 0 ? (JSON.parse(markupRows[0].value).value ?? 30) : 30

    const cashDiscountResult = await db.execute({ sql: "SELECT value FROM store_config WHERE key = 'cash_discount'", args: [] })
    const cashDiscountRows = cashDiscountResult.rows as any[]
    const globalCashDiscount = cashDiscountRows.length > 0 ? (JSON.parse(cashDiscountRows[0].value).value ?? 10) : 10

    const catMarkupResult = await db.execute('SELECT id, markup, cashDiscount, ivaRate FROM categories')
    const catMarkupMap = new Map<string, any>()
    for (const row of (catMarkupResult.rows as any[])) {
      catMarkupMap.set(row.id, row)
    }

    for (const p of products) {
      const catMarkup = catMarkupMap.get(p.categoryId)
      const calculated = calculateProductPrices(p, dollar.rate, globalMarkup, globalCashDiscount, catMarkup || null)
      priceMap.set(p.id, {
        price: calculated.price || p.price || 0,
        comparePrice: calculated.comparePrice || p.comparePrice || calculated.price || 0,
      })
    }
  } catch (error) {
    console.error('[pc-assistant] Error calculating prices:', error)
    // Fallback: use raw prices
    for (const p of products) {
      priceMap.set(p.id, {
        price: p.price || 0,
        comparePrice: p.comparePrice || p.price || 0,
      })
    }
  }

  return priceMap
}

// ============================================
// ARS Price Filtering (after calculatePrices)
// ============================================

function filterByArsPrice(
  products: ProductRow[],
  priceMap: Map<string, { price: number; comparePrice: number }>,
  minArs?: number,
  maxArs?: number
): ProductRow[] {
  return products.filter(p => {
    const prices = priceMap.get(p.id)
    if (!prices) return false
    const arsPrice = prices.comparePrice || prices.price
    if (minArs && arsPrice < minArs) return false
    if (maxArs && arsPrice > maxArs) return false
    return true
  })
}

// ============================================
// Build Configuration
// ============================================

async function buildConfiguration(
  useCase: string,
  budget: number,
  tierMultiplier: number,
  profile: Record<string, number>
): Promise<BuildComponent[] | null> {
  const effectiveBudget = budget * tierMultiplier
  const components: BuildComponent[] = []

  // Track compatibility constraints as we build
  let processorSocket: string | null = null
  let motherboardDdr: string | null = null
  let gpuMinWattage: number | null = null

  // Calculate price allocations
  const allocations: Record<string, { min: number; max: number }> = {}
  for (const [slot, pct] of Object.entries(profile)) {
    if (pct === 0) continue // Skip slots not needed (e.g., GPU for office)
    const allocated = effectiveBudget * pct
    allocations[slot] = {
      min: allocated * 0.6,  // Allow going a bit below allocation
      max: allocated * 1.3,  // Allow going a bit above
    }
  }

  // Step 1: Pick processor
  const processorAlloc = allocations['processor']
  if (!processorAlloc) return null

  const processorProductsRaw = await fetchProductsForSlot(
    'processor', 'microprocesadores', []
  )

  if (processorProductsRaw.length === 0) {
    console.warn('[pc-assistant] No processor products found in DB')
    return null
  }

  const processorPrices = await calculatePrices(processorProductsRaw)
  // Filter by ARS price range AFTER conversion
  const processorProducts = filterByArsPrice(processorProductsRaw, processorPrices, processorAlloc.min * 0.5, processorAlloc.max)
  console.log(`[pc-assistant] Processors: ${processorProductsRaw.length} raw → ${processorProducts.length} in ARS range [${Math.round(processorAlloc.min * 0.5)}-${Math.round(processorAlloc.max)}]`)

  // Pick the product closest to our allocation; if none in ideal range, relax constraints
  const processor = processorProducts.length > 0
    ? pickBestProduct(processorProducts, processorPrices, processorAlloc.min, processorAlloc.max)
    : (() => {
        // Fallback: pick cheapest available within 1.5x max
        const relaxed = filterByArsPrice(processorProductsRaw, processorPrices, undefined, processorAlloc.max * 1.5)
        return relaxed.length > 0 ? relaxed[0] : null
      })()
  if (!processor) return null

  const processorPriceInfo = processorPrices.get(processor.id)!
  const procCompat = extractCompatibility('processor', processor.name)
  processorSocket = procCompat.socket || null

  components.push({
    slot: 'processor',
    label: 'Microprocesador',
    productId: processor.id,
    productName: processor.name,
    productPrice: processorPriceInfo.price,
    productComparePrice: processorPriceInfo.comparePrice,
    productSlug: processor.slug || '',
    productImages: processor.images || '[]',
    productStock: processor.stock || 0,
    productSpecs: processor.specs || '{}',
    quantity: 1,
  })

  // Step 2: Pick motherboard (compatible with processor socket)
  const mbAlloc = allocations['motherboard']
  if (!mbAlloc) return null

  const mbProductsRaw = await fetchProductsForSlot(
    'motherboard', 'motherboards', [],
    undefined, undefined,
    processorSocket ? { socket: processorSocket } : undefined
  )

  if (mbProductsRaw.length === 0) {
    console.warn('[pc-assistant] No motherboard products found for socket:', processorSocket)
    return null
  }

  const mbPrices = await calculatePrices(mbProductsRaw)
  const mbProducts = filterByArsPrice(mbProductsRaw, mbPrices, mbAlloc.min * 0.3, mbAlloc.max)
  console.log(`[pc-assistant] Motherboards: ${mbProductsRaw.length} raw → ${mbProducts.length} in ARS range`)

  const motherboard = mbProducts.length > 0
    ? pickBestProduct(mbProducts, mbPrices, mbAlloc.min * 0.3, mbAlloc.max)
    : (() => {
        const relaxed = filterByArsPrice(mbProductsRaw, mbPrices, undefined, mbAlloc.max * 1.5)
        return relaxed.length > 0 ? relaxed[0] : null
      })()
  if (!motherboard) return null

  const mbPriceInfo = mbPrices.get(motherboard.id)!
  const mbCompat = extractCompatibility('motherboard', motherboard.name)
  motherboardDdr = mbCompat.ddr || null

  components.push({
    slot: 'motherboard',
    label: 'Motherboard',
    productId: motherboard.id,
    productName: motherboard.name,
    productPrice: mbPriceInfo.price,
    productComparePrice: mbPriceInfo.comparePrice,
    productSlug: motherboard.slug || '',
    productImages: motherboard.images || '[]',
    productStock: motherboard.stock || 0,
    productSpecs: motherboard.specs || '{}',
    quantity: 1,
  })

  // Step 3: Pick RAM (compatible with motherboard DDR)
  const ramAlloc = allocations['ram']
  if (!ramAlloc) return null

  const ramProductsRaw = await fetchProductsForSlot(
    'ram', 'memorias-ram', [],
    undefined, undefined,
    motherboardDdr ? { ddr: motherboardDdr } : undefined
  )

  if (ramProductsRaw.length === 0) {
    console.warn('[pc-assistant] No RAM products found for DDR:', motherboardDdr)
    return null
  }

  const ramPrices = await calculatePrices(ramProductsRaw)
  const ramProducts = filterByArsPrice(ramProductsRaw, ramPrices, ramAlloc.min * 0.2, ramAlloc.max)
  console.log(`[pc-assistant] RAM: ${ramProductsRaw.length} raw → ${ramProducts.length} in ARS range`)

  const ram = ramProducts.length > 0
    ? pickBestProduct(ramProducts, ramPrices, ramAlloc.min * 0.2, ramAlloc.max)
    : (() => {
        const relaxed = filterByArsPrice(ramProductsRaw, ramPrices, undefined, ramAlloc.max * 1.5)
        return relaxed.length > 0 ? relaxed[0] : null
      })()
  if (!ram) return null

  const ramPriceInfo = ramPrices.get(ram.id)!

  components.push({
    slot: 'ram',
    label: 'Memoria RAM',
    productId: ram.id,
    productName: ram.name,
    productPrice: ramPriceInfo.price,
    productComparePrice: ramPriceInfo.comparePrice,
    productSlug: ram.slug || '',
    productImages: ram.images || '[]',
    productStock: ram.stock || 0,
    productSpecs: ram.specs || '{}',
    quantity: 1, // Default 1 stick; could add 2 for dual channel
  })

  // Step 4: Pick GPU (if use case needs it)
  if (profile.gpu > 0) {
    const gpuAlloc = allocations['gpu']
    if (!gpuAlloc) return null

    const gpuProductsRaw = await fetchProductsForSlot(
      'gpu', 'placas-de-video', []
    )

    if (gpuProductsRaw.length > 0) {
      const gpuPrices = await calculatePrices(gpuProductsRaw)
      const gpuProducts = filterByArsPrice(gpuProductsRaw, gpuPrices, gpuAlloc.min * 0.2, gpuAlloc.max)
      console.log(`[pc-assistant] GPU: ${gpuProductsRaw.length} raw → ${gpuProducts.length} in ARS range`)

      const gpu = gpuProducts.length > 0
        ? pickBestProduct(gpuProducts, gpuPrices, gpuAlloc.min * 0.2, gpuAlloc.max)
        : (() => {
            const relaxed = filterByArsPrice(gpuProductsRaw, gpuPrices, undefined, gpuAlloc.max * 1.5)
            return relaxed.length > 0 ? relaxed[0] : null
          })()

      if (gpu) {
        const gpuPriceInfo = gpuPrices.get(gpu.id)!
        const gpuCompat = extractCompatibility('gpu', gpu.name)
        gpuMinWattage = gpuCompat.gpuTdp ? gpuCompat.gpuTdp * 1.5 + 100 : null // Estimate PSU wattage needed

        components.push({
          slot: 'gpu',
          label: 'Placa de Video',
          productId: gpu.id,
          productName: gpu.name,
          productPrice: gpuPriceInfo.price,
          productComparePrice: gpuPriceInfo.comparePrice,
          productSlug: gpu.slug || '',
          productImages: gpu.images || '[]',
          productStock: gpu.stock || 0,
          productSpecs: gpu.specs || '{}',
          quantity: 1,
        })
      }
    }
  }

  // Step 5: Pick SSD
  const ssdAlloc = allocations['ssd']
  if (!ssdAlloc) return null

  const ssdProductsRaw = await fetchProductsForSlot(
    'ssd', 'discos-ssd', []
  )

  if (ssdProductsRaw.length === 0) return null

  const ssdPrices = await calculatePrices(ssdProductsRaw)
  const ssdProducts = filterByArsPrice(ssdProductsRaw, ssdPrices, ssdAlloc.min * 0.2, ssdAlloc.max)
  console.log(`[pc-assistant] SSD: ${ssdProductsRaw.length} raw → ${ssdProducts.length} in ARS range`)

  const ssd = ssdProducts.length > 0
    ? pickBestProduct(ssdProducts, ssdPrices, ssdAlloc.min * 0.2, ssdAlloc.max)
    : (() => {
        const relaxed = filterByArsPrice(ssdProductsRaw, ssdPrices, undefined, ssdAlloc.max * 1.5)
        return relaxed.length > 0 ? relaxed[0] : null
      })()
  if (!ssd) return null

  const ssdPriceInfo = ssdPrices.get(ssd.id)!

  components.push({
    slot: 'ssd',
    label: 'Disco SSD',
    productId: ssd.id,
    productName: ssd.name,
    productPrice: ssdPriceInfo.price,
    productComparePrice: ssdPriceInfo.comparePrice,
    productSlug: ssd.slug || '',
    productImages: ssd.images || '[]',
    productStock: ssd.stock || 0,
    productSpecs: ssd.specs || '{}',
    quantity: 1,
  })

  // Step 6: Pick PSU
  const psuAlloc = allocations['psu']
  if (!psuAlloc) return null

  const psuProductsRaw = await fetchProductsForSlot(
    'psu', 'fuentes', []
  )

  if (psuProductsRaw.length === 0) return null

  const psuPrices = await calculatePrices(psuProductsRaw)
  const psuProducts = filterByArsPrice(psuProductsRaw, psuPrices, psuAlloc.min * 0.3, psuAlloc.max)
  console.log(`[pc-assistant] PSU: ${psuProductsRaw.length} raw → ${psuProducts.length} in ARS range`)

  // If we know the GPU wattage, prefer PSUs that can handle it
  const psu = gpuMinWattage
    ? pickPsuWithWattage(psuProducts.length > 0 ? psuProducts : psuProductsRaw, psuPrices, psuAlloc.min * 0.3, psuAlloc.max, gpuMinWattage)
    : (psuProducts.length > 0
        ? pickBestProduct(psuProducts, psuPrices, psuAlloc.min * 0.3, psuAlloc.max)
        : (() => {
            const relaxed = filterByArsPrice(psuProductsRaw, psuPrices, undefined, psuAlloc.max * 1.5)
            return relaxed.length > 0 ? relaxed[0] : null
          })()
      )

  if (!psu) return null

  const psuPriceInfo = psuPrices.get(psu.id)!

  components.push({
    slot: 'psu',
    label: 'Fuente',
    productId: psu.id,
    productName: psu.name,
    productPrice: psuPriceInfo.price,
    productComparePrice: psuPriceInfo.comparePrice,
    productSlug: psu.slug || '',
    productImages: psu.images || '[]',
    productStock: psu.stock || 0,
    productSpecs: psu.specs || '{}',
    quantity: 1,
  })

  // Step 7: Pick case
  const caseAlloc = allocations['case']
  if (!caseAlloc) return null

  const caseProductsRaw = await fetchProductsForSlot(
    'case', 'gabinetes', ['gabinetes-con-fuente']
  )

  if (caseProductsRaw.length > 0) {
    const casePrices = await calculatePrices(caseProductsRaw)
    const caseProducts = filterByArsPrice(caseProductsRaw, casePrices, caseAlloc.min * 0.2, caseAlloc.max)
    console.log(`[pc-assistant] Case: ${caseProductsRaw.length} raw → ${caseProducts.length} in ARS range`)

    const caseProduct = caseProducts.length > 0
      ? pickBestProduct(caseProducts, casePrices, caseAlloc.min * 0.2, caseAlloc.max)
      : (() => {
          const relaxed = filterByArsPrice(caseProductsRaw, casePrices, undefined, caseAlloc.max * 1.5)
          return relaxed.length > 0 ? relaxed[0] : null
        })()

    if (caseProduct) {
      const casePriceInfo = casePrices.get(caseProduct.id)!

      components.push({
        slot: 'case',
        label: 'Gabinete',
        productId: caseProduct.id,
        productName: caseProduct.name,
        productPrice: casePriceInfo.price,
        productComparePrice: casePriceInfo.comparePrice,
        productSlug: caseProduct.slug || '',
        productImages: caseProduct.images || '[]',
        productStock: caseProduct.stock || 0,
        productSpecs: caseProduct.specs || '{}',
        quantity: 1,
      })
    }
  }

  // Step 8: Pick cooling (optional)
  if (profile.cooling > 0) {
    const coolingAlloc = allocations['cooling']
    if (coolingAlloc) {
      const coolingProductsRaw = await fetchProductsForSlot(
        'cooling', 'refrigeracion', []
      )

      if (coolingProductsRaw.length > 0) {
        const coolingPrices = await calculatePrices(coolingProductsRaw)
        const coolingProducts = filterByArsPrice(coolingProductsRaw, coolingPrices, coolingAlloc.min * 0.1, coolingAlloc.max)

        const cooling = coolingProducts.length > 0
          ? pickBestProduct(coolingProducts, coolingPrices, coolingAlloc.min * 0.1, coolingAlloc.max)
          : (() => {
              const relaxed = filterByArsPrice(coolingProductsRaw, coolingPrices, undefined, coolingAlloc.max * 1.5)
              return relaxed.length > 0 ? relaxed[0] : null
            })()

        if (cooling) {
          const coolingPriceInfo = coolingPrices.get(cooling.id)!

          components.push({
            slot: 'cooling',
            label: 'Refrigeración',
            productId: cooling.id,
            productName: cooling.name,
            productPrice: coolingPriceInfo.price,
            productComparePrice: coolingPriceInfo.comparePrice,
            productSlug: cooling.slug || '',
            productImages: cooling.images || '[]',
            productStock: cooling.stock || 0,
            productSpecs: cooling.specs || '{}',
            quantity: 1,
          })
        }
      }
    }
  }

  return components
}

// Pick the best product within a price range
// Strategy: prefer the product closest to the middle of the range (best value)
// All prices (minPrice, maxPrice, priceMap values) are in ARS
function pickBestProduct(
  products: ProductRow[],
  priceMap: Map<string, { price: number; comparePrice: number }>,
  minPrice: number,
  maxPrice: number
): ProductRow | null {
  if (products.length === 0) return null

  // Score each product by how close it is to the midpoint of the allocation
  const midPrice = (minPrice + maxPrice) / 2
  let bestProduct: ProductRow | null = null
  let bestScore = Infinity

  // Also track the cheapest as a fallback
  let cheapestProduct: ProductRow | null = null
  let cheapestPrice = Infinity

  for (const p of products) {
    const prices = priceMap.get(p.id)
    if (!prices) continue

    const price = prices.comparePrice || prices.price

    // Track cheapest product as fallback
    if (price < cheapestPrice) {
      cheapestPrice = price
      cheapestProduct = p
    }

    // Skip products that are way too cheap (probably wrong category match)
    if (minPrice > 0 && price < minPrice * 0.15) continue

    // Skip products over the max budget (but with 20% tolerance)
    if (maxPrice > 0 && price > maxPrice * 1.2) continue

    // Score: prefer products near the midpoint, slightly favoring higher-priced (better quality)
    const score = Math.abs(price - midPrice * 0.9)

    if (score < bestScore) {
      bestScore = score
      bestProduct = p
    }
  }

  // If no product scored well, use the cheapest available
  if (!bestProduct) {
    bestProduct = cheapestProduct
  }

  return bestProduct
}

// Pick a PSU with sufficient wattage
function pickPsuWithWattage(
  products: ProductRow[],
  priceMap: Map<string, { price: number; comparePrice: number }>,
  minPrice: number,
  maxPrice: number,
  minWattage: number
): ProductRow | null {
  // Filter PSUs by wattage first
  const sufficientPsus = products.filter(p => {
    const wattMatch = p.name.match(/(\d{3,4})\s*W/i)
    return wattMatch ? parseInt(wattMatch[1]) >= minWattage : false
  })

  // If we have sufficient PSUs, pick from those; otherwise fall back to all
  const pool = sufficientPsus.length > 0 ? sufficientPsus : products
  return pickBestProduct(pool, priceMap, minPrice, maxPrice)
}

// ============================================
// Generate Build Descriptions with AI
// ============================================

async function generateBuildDescriptions(
  builds: SuggestedBuild[],
  useCase: string,
  budget: number
): Promise<void> {
  try {
    const buildsInfo = builds.map(b => ({
      name: b.name,
      totalPrice: b.totalPrice,
      components: b.components.map(c => `${c.label}: ${c.productName} ($${c.productComparePrice.toLocaleString('es-AR')} efectivo)`).join(', '),
    }))

    const prompt = `Sos un asistente de ventas de Compucity, una tienda de informática en Argentina. El cliente busca una PC para ${useCase} con un presupuesto de $${budget.toLocaleString('es-AR')} ARS.

Se le armaron ${builds.length} opciones. Escribí un mensaje corto y amigable (máximo 3 oraciones) describiendo brevemente las opciones, destacando las diferencias principales entre ellas. No uses markdown ni formato especial, solo texto plano. Hablá en argentino familiar (vos, no tú).`

    const result = await grokChat({
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Opciones:\n${buildsInfo.map(b => `${b.name}: ${b.components} - Total: $${b.totalPrice.toLocaleString('es-AR')}`).join('\n\n')}` },
      ],
      temperature: 0.7,
      maxTokens: 300,
    })

    if (result.content) {
      // Set the description on the first build (the main message)
      builds[0].description = result.content.trim()
    }
  } catch (error) {
    console.error('[pc-assistant] Error generating descriptions:', error)
    // Fallback description
    builds[0].description = `Armé ${builds.length} opciones para tu PC ${useCase}. La Económica te entra justo en presupuesto, la Recomendada es la mejor relación precio/rendimiento, y la Premium apreta un poco más pero con los mejores componentes.`
  }
}

// ============================================
// System Prompt for Chat
// ============================================

const CHAT_SYSTEM_PROMPT = `Sos un asistente virtual de Compucity, una tienda de componentes de PC en Argentina. Tu trabajo es ayudar al cliente a elegir la PC ideal.

Reglas:
- Hablá en argentino familiar (usá "vos", no "tú")
- Sé amable y entusiasta
- Respondé SIEMPRE en JSON válido sin markdown
- Si no tenés suficiente info, preguntá
- No inventes productos ni precios

Formato de respuesta JSON:
{
  "message": "Tu mensaje al cliente en texto plano",
  "ready": false,
  "use_case": null | "gaming" | "oficina" | "edicion" | "general",
  "budget": null | número (en ARS, sin símbolo)
}

- "ready" es true cuando ya sabés el uso Y el presupuesto
- Si el cliente da un presupuesto en dólares, convertilo estimando que 1 USD ≈ 1200 ARS (aproximado)
- Si el cliente dice algo como "para juegos", "para jugar", "gamer" → use_case = "gaming"
- Si dice "para trabajar", "oficina", "administrar" → use_case = "oficina"
- Si dice "para editar video", "diseño", "render", "photoshop" → use_case = "edicion"
- Si no está claro → use_case = "general"

Ejemplos:
- Cliente: "Quiero una PC para jugar" → message: "¡Buena onda! ¿Cuál es tu presupuesto aproximado? Decime en pesos si podés.", ready: false, use_case: "gaming", budget: null
- Cliente: "Tengo 500000 pesos para gaming" → message: "¡Perfecto! Voy a armar unas opciones para vos.", ready: true, use_case: "gaming", budget: 500000`

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Check feature flag
    const aiEnabled = await isAiEnabled()
    if (!aiEnabled) {
      return NextResponse.json({ error: 'IA deshabilitada' }, { status: 403 })
    }

    // Parse request
    let body: { messages: ChatMessage[] }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    const { messages } = body
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Se requiere un array de mensajes' }, { status: 400 })
    }

    // Call Groq for chat response
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    let chatResult: any = null
    try {
      const result = await grokChat({
        messages: [
          { role: 'system', content: CHAT_SYSTEM_PROMPT },
          ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ],
        temperature: 0.5,
        maxTokens: 400,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!result.content) {
        return NextResponse.json({
          message: 'Disculpá, no pude procesar tu mensaje. ¿Podés repetirlo?',
          ready: false,
          builds: null,
        })
      }

      chatResult = parseLlmJson(result.content)
      if (!chatResult) {
        // If JSON parsing failed, treat the raw content as a plain message
        return NextResponse.json({
          message: result.content,
          ready: false,
          builds: null,
        })
      }
    } catch (error) {
      clearTimeout(timeoutId)
      console.error('[pc-assistant] Groq chat error:', error)
      return NextResponse.json({
        message: 'Disculpá, estoy teniendo problemas para conectarme. ¿Podés intentar de nuevo?',
        ready: false,
        builds: null,
      })
    }

    const responseMessage = chatResult.message || '¿En qué más te puedo ayudar?'
    const isReady = chatResult.ready === true
    const useCase = chatResult.use_case || null
    const budget = typeof chatResult.budget === 'number' ? chatResult.budget : null

    // If not ready yet, just return the chat message
    if (!isReady || !useCase || !budget) {
      return NextResponse.json({
        message: responseMessage,
        ready: false,
        builds: null,
      })
    }

    // Ready to build! Generate configurations
    console.log(`[pc-assistant] Building configs for useCase=${useCase}, budget=${budget}`)

    const profile = BUDGET_PROFILES[useCase] || BUDGET_PROFILES.general
    const builds: SuggestedBuild[] = []

    for (const tier of BUILD_TIERS) {
      try {
        const components = await buildConfiguration(useCase, budget, tier.multiplier, profile)
        if (components && components.length >= 5) { // Need at least 5 components for a valid build
          const totalPrice = components.reduce((sum, c) => sum + c.productComparePrice * c.quantity, 0)
          const totalListPrice = components.reduce((sum, c) => sum + c.productPrice * c.quantity, 0)

          builds.push({
            name: `${tier.emoji} ${tier.name}`,
            description: '',
            totalPrice,
            totalListPrice,
            components,
          })
        }
      } catch (error) {
        console.error(`[pc-assistant] Error building tier ${tier.name}:`, error)
      }
    }

    if (builds.length === 0) {
      return NextResponse.json({
        message: `Disculpá, no pude armar una configuración con ese presupuesto. ¿Podrías aumentar un poco el presupuesto o probar con otro uso?`,
        ready: false,
        builds: null,
      })
    }

    // Generate friendly AI descriptions for the builds
    await generateBuildDescriptions(builds, useCase, budget)

    return NextResponse.json({
      message: responseMessage,
      ready: true,
      builds,
    })
  } catch (error) {
    console.error('[pc-assistant] Unexpected error:', error)
    return NextResponse.json({
      message: 'Ocurrió un error inesperado. Intentá de nuevo.',
      ready: false,
      builds: null,
    })
  }
}
