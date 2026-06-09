import { NextRequest, NextResponse } from 'next/server'
import { grokChat } from '@/lib/grok'
import { db } from '@/lib/db'
import { fetchDollarRate, calculateProductPrices } from '@/lib/dollar'
import { extractCompatibility } from '@/lib/compatibility'

// ============================================
// Types
// ============================================

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ProductWithArsPrice {
  id: string
  name: string
  slug: string
  priceUsd: number
  comparePriceUsd: number | null
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
  // ARS prices (calculated once)
  arsPrice: number
  arsComparePrice: number
  slot: string
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

// Slot definitions
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
  gaming: { processor: 0.16, motherboard: 0.08, ram: 0.08, gpu: 0.32, ssd: 0.10, psu: 0.07, case: 0.06, cooling: 0.04 },
  oficina: { processor: 0.22, motherboard: 0.12, ram: 0.15, gpu: 0, ssd: 0.18, psu: 0.08, case: 0.08, cooling: 0.02 },
  edicion: { processor: 0.20, motherboard: 0.08, ram: 0.14, gpu: 0.20, ssd: 0.14, psu: 0.07, case: 0.06, cooling: 0.04 },
  general: { processor: 0.18, motherboard: 0.10, ram: 0.12, gpu: 0.18, ssd: 0.14, psu: 0.07, case: 0.07, cooling: 0.03 },
}

const BUILD_TIERS = [
  { name: 'Económica', multiplier: 0.65, emoji: '🟢' },
  { name: 'Recomendada', multiplier: 0.90, emoji: '🟡' },
  { name: 'Premium', multiplier: 1.0, emoji: '🔴' },
]

// Include/exclude patterns
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
      try { return JSON.parse(rows[0].value).value === true } catch { return false }
    }
    return false
  } catch { return false }
}

// ============================================
// JSON Parser
// ============================================

function parseLlmJson(raw: string): any | null {
  try { return JSON.parse(raw) } catch {}
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) { try { return JSON.parse(codeBlockMatch[1].trim()) } catch {} }
  const braceStart = raw.indexOf('{')
  const braceEnd = raw.lastIndexOf('}')
  if (braceStart !== -1 && braceEnd > braceStart) { try { return JSON.parse(raw.substring(braceStart, braceEnd + 1)) } catch {} }
  return null
}

// ============================================
// Fetch ALL Products for ALL Slots at Once
// ============================================

async function fetchAllProductsWithArsPrices(): Promise<Map<string, ProductWithArsPrice[]>> {
  const slotProducts = new Map<string, ProductWithArsPrice[]>()

  try {
    // 1. Collect all category IDs for all slots
    const allCategoryIds = new Map<string, string[]>() // slug -> [categoryId, ...subCategoryIds]

    for (const slotDef of SLOTS) {
      const slugs = [slotDef.categorySlug, ...(slotDef.additionalSlugs || [])]
      const ids: string[] = []

      for (const slug of slugs) {
        if (allCategoryIds.has(slug)) {
          ids.push(...allCategoryIds.get(slug)!)
          continue
        }
        const catResult = await db.execute({
          sql: 'SELECT id FROM categories WHERE slug = ?',
          args: [slug],
        })
        const catRows = catResult.rows as any[]
        if (catRows.length === 0) {
          console.warn(`[pc-assistant] Category slug not found: ${slug}`)
          allCategoryIds.set(slug, [])
          continue
        }

        const catId = catRows[0].id
        const subResult = await db.execute({
          sql: 'SELECT id FROM categories WHERE parentId = ?',
          args: [catId],
        })
        const catIds = [catId, ...(subResult.rows as any[]).map(r => r.id)]
        allCategoryIds.set(slug, catIds)
        ids.push(...catIds)
      }

      if (ids.length === 0) {
        slotProducts.set(slotDef.slot, [])
        continue
      }

      // 2. Fetch products for this slot
      const placeholders = ids.map(() => '?').join(',')
      const query = `
        SELECT p.id, p.name, p.slug, p.price, p.comparePrice, p.costPrice, p.images, p.specs, p.stock,
               p.markup, p.cashDiscount, p.ivaRate, p.salePrice, p.saleStart, p.saleEnd, p.categoryId
        FROM products p
        WHERE p.categoryId IN (${placeholders}) AND p.isActive = 1 AND p.stock > 0
        ORDER BY p.price ASC
        LIMIT 100
      `
      const result = await db.execute({ sql: query, args: ids })
      const products = (result.rows as any[]).filter(p => !isExcludedFromBuilder(slotDef.slot, p.name))

      slotProducts.set(slotDef.slot, products.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        priceUsd: p.price,
        comparePriceUsd: p.comparePrice,
        costPrice: p.costPrice,
        images: p.images,
        specs: p.specs,
        stock: p.stock,
        categoryId: p.categoryId,
        markup: p.markup,
        cashDiscount: p.cashDiscount,
        ivaRate: p.ivaRate,
        salePrice: p.salePrice,
        saleStart: p.saleStart,
        saleEnd: p.saleEnd,
        arsPrice: 0,   // will be filled below
        arsComparePrice: 0,
        slot: slotDef.slot,
      })))
    }

    // 3. Calculate ARS prices for ALL products at once
    const allProducts = [...slotProducts.values()].flat()

    if (allProducts.length === 0) {
      console.warn('[pc-assistant] No products found in any category')
      return slotProducts
    }

    try {
      const dollar = await fetchDollarRate()
      console.log(`[pc-assistant] Dollar rate: ${dollar.rate}`)

      const markupResult = await db.execute({ sql: "SELECT value FROM store_config WHERE key = 'markup'", args: [] })
      const markupRows = markupResult.rows as any[]
      const globalMarkup = markupRows.length > 0 ? (JSON.parse(markupRows[0].value).value ?? 30) : 30

      const cashDiscountResult = await db.execute({ sql: "SELECT value FROM store_config WHERE key = 'cash_discount'", args: [] })
      const cashDiscountRows = cashDiscountResult.rows as any[]
      const globalCashDiscount = cashDiscountRows.length > 0 ? (JSON.parse(cashDiscountRows[0].value).value ?? 10) : 10

      const catMarkupResult = await db.execute('SELECT id, markup, cashDiscount, ivaRate FROM categories')
      const catMarkupMap = new Map<string, any>()
      for (const row of (catMarkupResult.rows as any[])) { catMarkupMap.set(row.id, row) }

      for (const p of allProducts) {
        const catMarkup = catMarkupMap.get(p.categoryId)
        const calculated = calculateProductPrices(p, dollar.rate, globalMarkup, globalCashDiscount, catMarkup || null)
        p.arsPrice = calculated.price || p.priceUsd || 0
        p.arsComparePrice = calculated.comparePrice || p.comparePriceUsd || calculated.price || 0
      }
    } catch (error) {
      console.error('[pc-assistant] Error calculating ARS prices, using USD fallback:', error)
      // Fallback: estimate ARS as USD * 1200 (rough estimate)
      for (const p of allProducts) {
        p.arsPrice = (p.priceUsd || 0) * 1200
        p.arsComparePrice = (p.comparePriceUsd || p.priceUsd || 0) * 1200
      }
    }

    // Log product counts and price ranges per slot
    for (const [slot, products] of slotProducts) {
      if (products.length === 0) {
        console.warn(`[pc-assistant] ${slot}: 0 products`)
      } else {
        const prices = products.map(p => p.arsComparePrice).filter(p => p > 0)
        const minP = prices.length > 0 ? Math.min(...prices) : 0
        const maxP = prices.length > 0 ? Math.max(...prices) : 0
        console.log(`[pc-assistant] ${slot}: ${products.length} products, ARS range: $${Math.round(minP).toLocaleString()} - $${Math.round(maxP).toLocaleString()}`)
      }
    }

  } catch (error) {
    console.error('[pc-assistant] Error fetching products:', error)
  }

  return slotProducts
}

// ============================================
// Pick Best Product for a Slot
// ============================================

function pickProductForSlot(
  products: ProductWithArsPrice[],
  idealMin: number,
  idealMax: number,
  compatFilter?: (p: ProductWithArsPrice) => boolean
): ProductWithArsPrice | null {
  if (products.length === 0) return null

  // Apply compatibility filter if provided
  let pool = compatFilter ? products.filter(compatFilter) : products

  // If compatibility filter removed everything, fall back to unfiltered
  if (pool.length === 0) {
    console.warn('[pc-assistant] Compatibility filter removed all products, using unfiltered pool')
    pool = products
  }

  if (pool.length === 0) return null

  // Score products: prefer products near the midpoint of the ideal range
  // but allow significant flexibility (up to 2x idealMax for expensive components)
  const midPrice = (idealMin + idealMax) / 2

  // First try: products within ideal range
  let candidates = pool.filter(p => {
    const price = p.arsComparePrice || p.arsPrice
    return price >= idealMin * 0.3 && price <= idealMax * 1.5
  })

  // Second try: just cap at 2x max, no min
  if (candidates.length === 0) {
    candidates = pool.filter(p => {
      const price = p.arsComparePrice || p.arsPrice
      return price <= idealMax * 2
    })
  }

  // Third try: any product, sorted by price
  if (candidates.length === 0) {
    candidates = pool
  }

  if (candidates.length === 0) return null

  // Score: closest to the midpoint, slightly favoring higher quality (closer to midpoint than to min)
  candidates.sort((a, b) => {
    const priceA = a.arsComparePrice || a.arsPrice
    const priceB = b.arsComparePrice || b.arsPrice
    const scoreA = Math.abs(priceA - midPrice * 0.85)  // slightly below midpoint = good value
    const scoreB = Math.abs(priceB - midPrice * 0.85)
    return scoreA - scoreB
  })

  return candidates[0]
}

// ============================================
// Build Configuration (Simplified & Robust)
// ============================================

function buildConfiguration(
  allProducts: Map<string, ProductWithArsPrice[]>,
  useCase: string,
  budget: number,
  tierMultiplier: number,
  profile: Record<string, number>
): BuildComponent[] | null {
  const effectiveBudget = budget * tierMultiplier
  const components: BuildComponent[] = []
  const debugLog: string[] = []

  debugLog.push(`Budget: $${budget.toLocaleString()}, Effective: $${Math.round(effectiveBudget).toLocaleString()}, Tier: ${tierMultiplier}`)

  // Track compatibility constraints
  let processorSocket: string | null = null
  let motherboardDdr: string | null = null
  let gpuMinWattage: number | null = null

  // Calculate price allocations per slot
  const allocations: Record<string, number> = {}
  for (const [slot, pct] of Object.entries(profile)) {
    if (pct === 0) continue
    allocations[slot] = effectiveBudget * pct
  }

  // ---- Step 1: Processor ----
  const processorProducts = allProducts.get('processor') || []
  const procAlloc = allocations['processor']
  if (!procAlloc || processorProducts.length === 0) {
    console.error(`[pc-assistant] Cannot build: processor alloc=${procAlloc}, products=${processorProducts.length}`)
    return null
  }

  const processor = pickProductForSlot(processorProducts, procAlloc * 0.4, procAlloc * 1.3)
  if (!processor) {
    console.error('[pc-assistant] Cannot build: no processor selected')
    return null
  }

  const procCompat = extractCompatibility('processor', processor.name)
  processorSocket = procCompat.socket || null
  debugLog.push(`Processor: ${processor.name} ($${Math.round(processor.arsComparePrice).toLocaleString()} ARS) socket=${processorSocket}`)

  components.push(makeComponent(processor, 'processor', 'Microprocesador'))

  // ---- Step 2: Motherboard ----
  const mbProducts = allProducts.get('motherboard') || []
  const mbAlloc = allocations['motherboard']
  if (!mbAlloc || mbProducts.length === 0) {
    console.error(`[pc-assistant] Cannot build: motherboard alloc=${mbAlloc}, products=${mbProducts.length}`)
    return null
  }

  // Filter by socket compatibility
  const mbCompatFilter = processorSocket
    ? (p: ProductWithArsPrice) => {
        const upper = p.name.toUpperCase()
        const socketPatterns: Record<string, string[]> = {
          AM4: ['AM4', 'B550', 'A520', 'X570', 'B450'],
          AM5: ['AM5', 'B650', 'B850', 'A620', 'X670', 'X870'],
          '1700': ['1700', 'B760', 'H610', 'B660', 'Z690', 'Z790'],
          '1851': ['1851', 'B860', 'Z890', 'H810'],
        }
        const patterns = socketPatterns[processorSocket]
        return patterns ? patterns.some(pat => upper.includes(pat.toUpperCase())) : true
      }
    : undefined

  const motherboard = pickProductForSlot(mbProducts, mbAlloc * 0.4, mbAlloc * 1.5, mbCompatFilter)
  if (!motherboard) {
    console.error('[pc-assistant] Cannot build: no motherboard selected')
    return null
  }

  const mbCompat = extractCompatibility('motherboard', motherboard.name)
  motherboardDdr = mbCompat.ddr || null
  debugLog.push(`Motherboard: ${motherboard.name} ($${Math.round(motherboard.arsComparePrice).toLocaleString()} ARS) ddr=${motherboardDdr}`)

  components.push(makeComponent(motherboard, 'motherboard', 'Motherboard'))

  // ---- Step 3: RAM ----
  const ramProducts = allProducts.get('ram') || []
  const ramAlloc = allocations['ram']
  if (!ramAlloc || ramProducts.length === 0) {
    console.error(`[pc-assistant] Cannot build: RAM alloc=${ramAlloc}, products=${ramProducts.length}`)
    return null
  }

  const ramCompatFilter = motherboardDdr
    ? (p: ProductWithArsPrice) => p.name.toUpperCase().includes(motherboardDdr!.toUpperCase())
    : undefined

  const ram = pickProductForSlot(ramProducts, ramAlloc * 0.3, ramAlloc * 1.5, ramCompatFilter)
  if (!ram) {
    console.error('[pc-assistant] Cannot build: no RAM selected')
    return null
  }

  debugLog.push(`RAM: ${ram.name} ($${Math.round(ram.arsComparePrice).toLocaleString()} ARS)`)
  components.push(makeComponent(ram, 'ram', 'Memoria RAM'))

  // ---- Step 4: GPU (optional for some use cases) ----
  if (profile.gpu > 0) {
    const gpuProducts = allProducts.get('gpu') || []
    const gpuAlloc = allocations['gpu']

    if (gpuAlloc && gpuProducts.length > 0) {
      const gpu = pickProductForSlot(gpuProducts, gpuAlloc * 0.3, gpuAlloc * 1.5)

      if (gpu) {
        const gpuCompat = extractCompatibility('gpu', gpu.name)
        gpuMinWattage = gpuCompat.gpuTdp ? gpuCompat.gpuTdp * 1.5 + 100 : null
        debugLog.push(`GPU: ${gpu.name} ($${Math.round(gpu.arsComparePrice).toLocaleString()} ARS) wattage_needed=${gpuMinWattage}`)
        components.push(makeComponent(gpu, 'gpu', 'Placa de Video'))
      } else {
        debugLog.push(`GPU: none found in budget range $${Math.round(gpuAlloc * 0.3).toLocaleString()}-$${Math.round(gpuAlloc * 1.5).toLocaleString()}`)
      }
    }
  }

  // ---- Step 5: SSD ----
  const ssdProducts = allProducts.get('ssd') || []
  const ssdAlloc = allocations['ssd']

  if (ssdAlloc && ssdProducts.length > 0) {
    const ssd = pickProductForSlot(ssdProducts, ssdAlloc * 0.3, ssdAlloc * 1.5)
    if (ssd) {
      debugLog.push(`SSD: ${ssd.name} ($${Math.round(ssd.arsComparePrice).toLocaleString()} ARS)`)
      components.push(makeComponent(ssd, 'ssd', 'Disco SSD'))
    } else {
      debugLog.push('SSD: none found')
      return null // SSD is required
    }
  } else {
    return null
  }

  // ---- Step 6: PSU ----
  const psuProducts = allProducts.get('psu') || []
  const psuAlloc = allocations['psu']

  if (psuAlloc && psuProducts.length > 0) {
    // If we know GPU wattage, prefer PSUs that can handle it
    let psuCompatFilter: ((p: ProductWithArsPrice) => boolean) | undefined
    if (gpuMinWattage) {
      psuCompatFilter = (p: ProductWithArsPrice) => {
        const wattMatch = p.name.match(/(\d{3,4})\s*W/i)
        return wattMatch ? parseInt(wattMatch[1]) >= gpuMinWattage! : true // allow PSUs without wattage in name
      }
    }

    const psu = pickProductForSlot(psuProducts, psuAlloc * 0.3, psuAlloc * 1.5, psuCompatFilter)
    if (psu) {
      debugLog.push(`PSU: ${psu.name} ($${Math.round(psu.arsComparePrice).toLocaleString()} ARS)`)
      components.push(makeComponent(psu, 'psu', 'Fuente'))
    } else {
      debugLog.push('PSU: none found')
      return null // PSU is required
    }
  } else {
    return null
  }

  // ---- Step 7: Case (optional - don't fail if not found) ----
  const caseProducts = allProducts.get('case') || []
  const caseAlloc = allocations['case']

  if (caseAlloc && caseProducts.length > 0) {
    const caseProduct = pickProductForSlot(caseProducts, caseAlloc * 0.2, caseAlloc * 1.5)
    if (caseProduct) {
      debugLog.push(`Case: ${caseProduct.name} ($${Math.round(caseProduct.arsComparePrice).toLocaleString()} ARS)`)
      components.push(makeComponent(caseProduct, 'case', 'Gabinete'))
    } else {
      debugLog.push('Case: none in budget (non-fatal)')
    }
  }

  // ---- Step 8: Cooling (optional) ----
  if (profile.cooling > 0) {
    const coolingProducts = allProducts.get('cooling') || []
    const coolingAlloc = allocations['cooling']

    if (coolingAlloc && coolingProducts.length > 0) {
      const cooling = pickProductForSlot(coolingProducts, coolingAlloc * 0.2, coolingAlloc * 1.5)
      if (cooling) {
        debugLog.push(`Cooling: ${cooling.name} ($${Math.round(cooling.arsComparePrice).toLocaleString()} ARS)`)
        components.push(makeComponent(cooling, 'cooling', 'Refrigeración'))
      }
    }
  }

  // Log the full build
  const totalPrice = components.reduce((sum, c) => sum + c.productComparePrice * c.quantity, 0)
  debugLog.push(`Total: $${Math.round(totalPrice).toLocaleString()} ARS (${components.length} components)`)
  console.log(`[pc-assistant] Build result:\n${debugLog.join('\n')}`)

  return components
}

function makeComponent(p: ProductWithArsPrice, slot: string, label: string): BuildComponent {
  return {
    slot,
    label,
    productId: p.id,
    productName: p.name,
    productPrice: p.arsPrice,
    productComparePrice: p.arsComparePrice,
    productSlug: p.slug || '',
    productImages: p.images || '[]',
    productStock: p.stock || 0,
    productSpecs: p.specs || '{}',
    quantity: 1,
  }
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
      builds[0].description = result.content.trim()
    }
  } catch (error) {
    console.error('[pc-assistant] Error generating descriptions:', error)
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
// Debug GET Endpoint
// ============================================

export async function GET() {
  try {
    const allProducts = await fetchAllProductsWithArsPrices()

    const debug: Record<string, any> = {}
    for (const [slot, products] of allProducts) {
      const prices = products.map(p => p.arsComparePrice || p.arsPrice).filter(p => p > 0)
      debug[slot] = {
        count: products.length,
        priceRange: prices.length > 0
          ? `$${Math.round(Math.min(...prices)).toLocaleString()} - $${Math.round(Math.max(...prices)).toLocaleString()} ARS`
          : 'N/A',
        cheapest3: products.slice(0, 3).map(p => ({
          name: p.name,
          arsPrice: `$${Math.round(p.arsComparePrice || p.arsPrice).toLocaleString()}`,
        })),
      }
    }

    return NextResponse.json({ debug, timestamp: new Date().toISOString() })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

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

    // Ready to build! Fetch all products upfront
    console.log(`[pc-assistant] Building configs for useCase=${useCase}, budget=${budget}`)

    const allProducts = await fetchAllProductsWithArsPrices()
    const profile = BUDGET_PROFILES[useCase] || BUDGET_PROFILES.general
    const builds: SuggestedBuild[] = []

    for (const tier of BUILD_TIERS) {
      try {
        const components = buildConfiguration(allProducts, useCase, budget, tier.multiplier, profile)
        if (components && components.length >= 5) {
          const totalPrice = components.reduce((sum, c) => sum + c.productComparePrice * c.quantity, 0)
          const totalListPrice = components.reduce((sum, c) => sum + c.productPrice * c.quantity, 0)

          builds.push({
            name: `${tier.emoji} ${tier.name}`,
            description: '',
            totalPrice,
            totalListPrice,
            components,
          })
        } else {
          console.warn(`[pc-assistant] Tier ${tier.name}: only ${components?.length || 0} components, need 5+`)
        }
      } catch (error) {
        console.error(`[pc-assistant] Error building tier ${tier.name}:`, error)
      }
    }

    if (builds.length === 0) {
      // Provide more helpful error message with debug info
      const slotCounts: string[] = []
      for (const [slot, products] of allProducts) {
        if (products.length > 0) slotCounts.push(`${slot}: ${products.length}`)
      }
      console.error(`[pc-assistant] No builds possible. Product counts: ${slotCounts.join(', ')}`)

      return NextResponse.json({
        message: `Disculpá, no pude armar una configuración con ese presupuesto. ¿Podrías aumentar un poco el presupuesto o probar con otro tipo de uso?`,
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
