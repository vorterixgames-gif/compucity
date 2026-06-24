import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { grokChat } from '@/lib/grok'
import { db } from '@/lib/db'
import { fetchDollarRate, calculateProductPrices } from '@/lib/dollar'

// Sesión 44 round 8: migrado a Edge runtime para no consumir Fluid Active CPU.
export const runtime = 'edge'
export const maxDuration = 25

// ============================================
// Types
// ============================================

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface NotebookProduct {
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
}

interface RecommendedNotebook {
  id: string
  name: string
  slug: string
  price: number
  comparePrice: number
  images: string
  stock: number
  specs: string
  tier: string
  reason: string
}

// Category slugs that contain notebooks
const NOTEBOOK_CATEGORY_SLUGS = ['notebooks', 'oficina', 'gamer-y-diseno']

// Use case profiles for notebook recommendations
const USE_CASE_PROFILES: Record<string, { label: string; preferredBrands: string[]; minRam: number; preferredGpu: boolean; screenPreference: string }> = {
  gaming: {
    label: 'Gaming',
    preferredBrands: ['LENOVO', 'HP', 'MSI', 'ASUS', 'DELL', 'ACER', 'GIGABYTE'],
    minRam: 8,
    preferredGpu: true,
    screenPreference: '15-16',
  },
  oficina: {
    label: 'Oficina / Trabajo',
    preferredBrands: ['LENOVO', 'HP', 'DELL', 'ASUS', 'ACER', 'BANGHO'],
    minRam: 4,
    preferredGpu: false,
    screenPreference: '14-15',
  },
  estudiante: {
    label: 'Estudiante',
    preferredBrands: ['LENOVO', 'HP', 'DELL', 'ASUS', 'ACER', 'BANGHO', 'CX'],
    minRam: 4,
    preferredGpu: false,
    screenPreference: '13-14',
  },
  diseno: {
    label: 'Diseño / Edición',
    preferredBrands: ['LENOVO', 'HP', 'MSI', 'ASUS', 'DELL', 'ACER', 'GIGABYTE'],
    minRam: 16,
    preferredGpu: true,
    screenPreference: '15-16',
  },
  general: {
    label: 'Uso general',
    preferredBrands: ['LENOVO', 'HP', 'DELL', 'ASUS', 'ACER', 'BANGHO', 'CX', 'MSI'],
    minRam: 4,
    preferredGpu: false,
    screenPreference: '15-16',
  },
}

// Include patterns — must have one of these to be considered a notebook
const NOTEBOOK_INCLUDE_PATTERNS = [
  'NOTEBOOK', 'LAPTOP', 'NB ', 'IDEAPAD', 'THINKPAD', 'LOQ', 'LEGION',
  'VICTUS', 'OMEN', 'INSPIRON', 'LATITUDE', 'PAVILION', 'KATANA',
  'GF15', 'GF65', 'GF75', 'CYBORG', 'CROSSHAIR', 'TUF ', 'ROG ',
  'VIVOBOOK', 'ZENBOOK', 'SWIFT', 'ASPIRE', 'NITRO', 'PREDATOR',
  'GAMING ', 'PROBOOK', 'ELITEBOOK', 'ZBOOK', 'DRAGONFLY',
]

// Exclude patterns — definitely not a notebook
const NOTEBOOK_EXCLUDE_PATTERNS = [
  'CARGADOR', 'FUENTE', 'BATERIA', 'MOCHILA', 'FUNDA', 'BASE', 'SOPORTE',
  'MOUSE', 'TECLADO', 'AURICULAR', 'PARLANTE', 'MONITOR', 'IMPRESORA',
  'DISCO EXTERNO', 'PENDRIVE', 'ROUTER', 'SWITCH', 'CABLE', 'ADAPTADOR',
  'SILLA', 'ESCRITORIO', 'WEBCAM', 'MICROFONO', 'PAD', 'JOYSTICK',
  'TABLET', 'CELULAR', 'SMART', 'UPS', 'ESTABILIZADOR', 'TONER',
  'CARTUCHO', 'TINTA', 'PAPEL', 'MEMORIA RAM', 'SODIMM', 'SSD',
  'DISCO INTERNO', 'PLACA DE VIDEO', 'PLACA DE RED', 'MICROPROCESADOR',
  'MOTHERBOARD', 'GABINETE', 'REFRIGERACION', 'PASTA TERMICA',
  'HUB ', 'DOCK', 'MULTIPLEXOR', 'CINTA', 'SCANNER', 'PROYECTOR',
  'CONVERTIDOR', 'REGLETA', 'INVERSORES', 'STABILIZER',
]

function isNotebookProduct(name: string): boolean {
  const upper = name.toUpperCase()
  // Must include a notebook keyword
  if (!NOTEBOOK_INCLUDE_PATTERNS.some(p => upper.includes(p))) return false
  // Must NOT include an exclude keyword
  if (NOTEBOOK_EXCLUDE_PATTERNS.some(p => upper.includes(p))) return false
  return true
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
// Fetch Notebook Products
// ============================================

async function fetchNotebooksWithArsPrices(): Promise<NotebookProduct[]> {
  try {
    // 1. Collect all category IDs for notebook-related categories
    const allCategoryIds: string[] = []

    for (const slug of NOTEBOOK_CATEGORY_SLUGS) {
      const catResult = await db.execute({
        sql: 'SELECT id FROM categories WHERE slug = ?',
        args: [slug],
      })
      const catRows = catResult.rows as any[]
      if (catRows.length === 0) {
        console.warn(`[notebook-assistant] Category slug not found: ${slug}`)
        continue
      }

      const catId = catRows[0].id
      allCategoryIds.push(catId)

      // Also include subcategories
      const subResult = await db.execute({
        sql: 'SELECT id FROM categories WHERE parentId = ?',
        args: [catId],
      })
      for (const row of subResult.rows as any[]) {
        allCategoryIds.push(row.id)
      }
    }

    if (allCategoryIds.length === 0) {
      console.warn('[notebook-assistant] No notebook categories found')
      return []
    }

    // 2. Fetch products from these categories
    const placeholders = allCategoryIds.map(() => '?').join(',')
    const query = `
      SELECT p.id, p.name, p.slug, p.price, p.comparePrice, p.costPrice, p.images, p.specs, p.stock,
             p.markup, p.cashDiscount, p.ivaRate, p.salePrice, p.saleStart, p.saleEnd, p.categoryId
      FROM products p
      WHERE p.categoryId IN (${placeholders}) AND p.isActive = 1 AND p.stock > 0
      ORDER BY p.price ASC
    `
    const result = await db.execute({ sql: query, args: allCategoryIds })
    const rawProducts = result.rows as any[]

    // 3. Filter to only actual notebook products
    const notebooks = rawProducts.filter(p => isNotebookProduct(p.name))

    if (notebooks.length === 0) {
      console.warn('[notebook-assistant] No notebooks after filtering')
      return []
    }

    // 4. Calculate ARS prices
    const products: NotebookProduct[] = notebooks.map(p => ({
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
      arsPrice: 0,
      arsComparePrice: 0,
    }))

    try {
      const dollar = await fetchDollarRate()
      logger.debug(`[notebook-assistant] Dollar rate: ${dollar.rate}`)

      const markupResult = await db.execute({ sql: "SELECT value FROM store_config WHERE key = 'markup'", args: [] })
      const markupRows = markupResult.rows as any[]
      const globalMarkup = markupRows.length > 0 ? (JSON.parse(markupRows[0].value).value ?? 30) : 30

      const cashDiscountResult = await db.execute({ sql: "SELECT value FROM store_config WHERE key = 'cash_discount'", args: [] })
      const cashDiscountRows = cashDiscountResult.rows as any[]
      const globalCashDiscount = cashDiscountRows.length > 0 ? (JSON.parse(cashDiscountRows[0].value).value ?? 10) : 10

      const catMarkupResult = await db.execute('SELECT id, markup, cashDiscount, ivaRate FROM categories')
      const catMarkupMap = new Map<string, any>()
      for (const row of (catMarkupResult.rows as any[])) { catMarkupMap.set(row.id, row) }

      for (const p of products) {
        const catMarkup = catMarkupMap.get(p.categoryId)
        const calculated = calculateProductPrices(p, dollar.rate, globalMarkup, globalCashDiscount, catMarkup || null)
        p.arsPrice = calculated.price || p.priceUsd || 0
        p.arsComparePrice = calculated.comparePrice || p.comparePriceUsd || calculated.price || 0
      }
    } catch (error) {
      console.error('[notebook-assistant] Error calculating ARS prices, using USD fallback:', error)
      for (const p of products) {
        p.arsPrice = (p.priceUsd || 0) * 1200
        p.arsComparePrice = (p.comparePriceUsd || p.priceUsd || 0) * 1200
      }
    }

    logger.debug(`[notebook-assistant] Found ${products.length} notebooks`)

    // Log price ranges
    const prices = products.map(p => p.arsComparePrice).filter(p => p > 0)
    if (prices.length > 0) {
      logger.debug(`[notebook-assistant] Price range: $${Math.round(Math.min(...prices)).toLocaleString()} - $${Math.round(Math.max(...prices)).toLocaleString()} ARS`)
    }

    return products
  } catch (error) {
    console.error('[notebook-assistant] Error fetching notebooks:', error)
    return []
  }
}

// ============================================
// Extract Notebook Specs from Name
// ============================================

function extractNotebookSpecs(name: string): {
  processor: string | null
  ram: string | null
  screen: string | null
  gpu: string | null
  storage: string | null
  brand: string | null
} {
  const upper = name.toUpperCase()

  // Brand
  const brandPatterns = [
    { brand: 'Lenovo', patterns: ['LENOVO', 'THINKPAD', 'IDEAPAD', 'LOQ', 'LEGION', 'YOGA'] },
    { brand: 'HP', patterns: ['HP ', 'PAVILION', 'OMEN', 'VICTUS', 'PROBOOK', 'ELITEBOOK', 'ZBOOK', 'DRAGONFLY'] },
    { brand: 'Dell', patterns: ['DELL', 'INSPIRON', 'LATITUDE', 'ALIENWARE', 'VOSTRO'] },
    { brand: 'ASUS', patterns: ['ASUS', 'VIVOBOOK', 'ZENBOOK', 'TUF', 'ROG'] },
    { brand: 'Acer', patterns: ['ACER', 'ASPIRE', 'NITRO', 'PREDATOR', 'SWIFT'] },
    { brand: 'MSI', patterns: ['MSI', 'KATANA', 'CYBORG', 'CROSSHAIR'] },
    { brand: 'Gigabyte', patterns: ['GIGABYTE', 'AORUS', 'AERO'] },
    { brand: 'Bangho', patterns: ['BANGHO'] },
    { brand: 'CX', patterns: ['CX '] },
  ]
  let brand: string | null = null
  for (const bp of brandPatterns) {
    if (bp.patterns.some(p => upper.includes(p))) {
      brand = bp.brand
      break
    }
  }

  // Processor
  let processor: string | null = null
  if (/CORE\s*ULTRA\s*[579]/i.test(name)) {
    const m = name.match(/CORE\s*ULTRA\s*([579])/i)
    processor = m ? `Intel Core Ultra ${m[1]}` : 'Intel Core Ultra'
  } else if (/\bI[3579]\b/i.test(name) || /CORE\s*[3579]/i.test(name)) {
    const m = name.match(/(?:CORE\s*)?I([3579])/i)
    processor = m ? `Intel Core i${m[1]}` : null
  } else if (/RYZEN\s*[3579]/i.test(name)) {
    const m = name.match(/RYZEN\s*([3579])/i)
    processor = m ? `AMD Ryzen ${m[1]}` : null
  }

  // RAM
  let ram: string | null = null
  const ramMatch = name.match(/(\d+)\s*GB\s*(?:DDR[345]|RAM)?/i)
  if (ramMatch) {
    const gb = parseInt(ramMatch[1])
    if (gb >= 4 && gb <= 128) ram = `${gb}GB RAM`
  }

  // Screen size
  let screen: string | null = null
  const screenMatch = name.match(/(\d{2}(?:\.\d)?)["\s]*(?:PULG|INCH|FHD|HD|\)|$)/i)
  if (screenMatch) {
    const size = parseFloat(screenMatch[1])
    if (size >= 11 && size <= 18) screen = `${size}"`
  }

  // GPU
  let gpu: string | null = null
  if (/RTX\s*\d{4}/i.test(name)) {
    const m = name.match(/(RTX\s*\d{4}\s*(?:TI|SUPER)?)/i)
    gpu = m ? m[1].toUpperCase() : 'RTX'
  } else if (/GTX\s*\d{4}/i.test(name)) {
    const m = name.match(/(GTX\s*\d{4}\s*(?:TI|SUPER)?)/i)
    gpu = m ? m[1].toUpperCase() : 'GTX'
  } else if (/RX\s*\d{4}/i.test(name)) {
    const m = name.match(/(RX\s*\d{4})/i)
    gpu = m ? m[1].toUpperCase() : 'Radeon'
  } else if (/ARC\s*A?\d{3}/i.test(name)) {
    gpu = 'Intel Arc'
  }

  // Storage
  let storage: string | null = null
  const storageMatch = name.match(/(\d+)\s*(GB|TB)\s*(?:SSD|HDD|M\.2|NVME|PCIe)/i)
  if (storageMatch) {
    storage = `${storageMatch[1]}${storageMatch[2].toUpperCase()} SSD`
  }

  return { processor, ram, screen, gpu, storage, brand }
}

// ============================================
// Pick 3 Notebook Recommendations
// ============================================

function pickNotebookRecommendations(
  notebooks: NotebookProduct[],
  useCase: string,
  budget: number
): RecommendedNotebook[] {
  if (notebooks.length === 0) return []

  const profile = USE_CASE_PROFILES[useCase] || USE_CASE_PROFILES.general
  const recommendations: RecommendedNotebook[] = []

  // Sort notebooks by price ascending
  const sorted = [...notebooks].sort((a, b) => a.arsComparePrice - b.arsComparePrice)

  // Filter notebooks within budget range (allow up to 20% over budget for premium)
  const budgetMin = budget * 0.3
  const budgetMax = budget * 1.3
  const inBudget = sorted.filter(p => {
    const price = p.arsComparePrice || p.arsPrice
    return price >= budgetMin && price <= budgetMax
  })

  // If nothing in range, use all sorted
  const pool = inBudget.length >= 3 ? inBudget : sorted

  if (pool.length === 0) return []

  // Score notebooks based on use case fit
  const scored = pool.map(p => {
    let score = 0
    const specs = extractNotebookSpecs(p.name)
    const price = p.arsComparePrice || p.arsPrice

    // Prefer brands associated with the use case
    if (specs.brand && profile.preferredBrands.includes(specs.brand.toUpperCase())) {
      score += 20
    }

    // GPU bonus for gaming/diseño
    if (profile.preferredGpu && specs.gpu) {
      score += 30
    } else if (!profile.preferredGpu && !specs.gpu) {
      score += 10 // Cheaper without GPU is fine for oficina
    }

    // RAM check
    const ramGB = specs.ram ? parseInt(specs.ram) : 0
    if (ramGB >= profile.minRam) {
      score += 15
    }

    // Screen preference
    if (specs.screen) {
      const screenNum = parseFloat(specs.screen)
      if (profile.screenPreference === '13-14' && screenNum <= 14) score += 10
      else if (profile.screenPreference === '15-16' && screenNum >= 15 && screenNum <= 16) score += 10
      else if (profile.screenPreference === '14-15' && screenNum >= 14 && screenNum <= 15.6) score += 10
    }

    // Proximity to budget midpoint
    const midBudget = budget * 0.85
    const distance = Math.abs(price - midBudget)
    score += Math.max(0, 25 - (distance / budget) * 50)

    return { product: p, score, specs }
  })

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Pick 3 at different price tiers
  const tiers = [
    { name: 'Economica', multiplier: 0.7, emoji: '🟢' },
    { name: 'Recomendada', multiplier: 1.0, emoji: '🟡' },
    { name: 'Premium', multiplier: 1.15, emoji: '🔴' },
  ]

  for (const tier of tiers) {
    const tierBudget = budget * tier.multiplier
    const tierMin = tierBudget * 0.4
    const tierMax = tierBudget * 1.4

    // Find the best scored notebook within this tier's price range
    let tierCandidates = scored.filter(s => {
      const price = s.product.arsComparePrice || s.product.arsPrice
      return price >= tierMin && price <= tierMax
    })

    // If no exact matches, expand range
    if (tierCandidates.length === 0) {
      tierCandidates = scored.filter(s => {
        const price = s.product.arsComparePrice || s.product.arsPrice
        return price >= budget * 0.2 && price <= budget * 1.5
      })
    }

    // Still nothing? Just use the top scored that we haven't used yet
    if (tierCandidates.length === 0) {
      tierCandidates = scored.filter(s =>
        !recommendations.some(r => r.id === s.product.id)
      )
    }

    if (tierCandidates.length === 0) continue

    // Pick the best scored from candidates (that hasn't been picked yet)
    const best = tierCandidates.find(s =>
      !recommendations.some(r => r.id === s.product.id)
    ) || tierCandidates[0]

    // Avoid duplicates
    if (recommendations.some(r => r.id === best.product.id)) continue

    const p = best.product
    const specs = best.specs

    // Generate a brief reason for this recommendation
    let reason = ''
    if (useCase === 'gaming') {
      reason = specs.gpu
        ? `Con ${specs.gpu} para gaming fluido`
        : 'Buena opción gaming dentro del presupuesto'
    } else if (useCase === 'oficina') {
      reason = specs.processor
        ? `${specs.processor}, ideal para productividad`
        : 'Equilibrada para tareas de oficina'
    } else if (useCase === 'estudiante') {
      reason = specs.screen
        ? `Pantalla ${specs.screen}, portable y eficiente`
        : 'Liviana y eficiente para estudiar'
    } else if (useCase === 'diseno') {
      reason = specs.gpu
        ? `${specs.gpu} + ${specs.ram || 'RAM'} para diseño y edición`
        : 'Potente para diseño y render'
    } else {
      reason = specs.processor
        ? `${specs.processor}, versátil para todo uso`
        : 'Buena relación precio/rendimiento'
    }

    recommendations.push({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.arsPrice,
      comparePrice: p.arsComparePrice,
      images: p.images || '[]',
      stock: p.stock,
      specs: JSON.stringify(specs),
      tier: `${tier.emoji} ${tier.name}`,
      reason,
    })
  }

  return recommendations
}

// ============================================
// Generate Recommendation Descriptions with AI
// ============================================

async function generateRecommendationDescription(
  notebooks: RecommendedNotebook[],
  useCase: string,
  budget: number
): Promise<string> {
  try {
    const notebooksInfo = notebooks.map(n => ({
      tier: n.tier,
      name: n.name,
      price: n.comparePrice,
      reason: n.reason,
    }))

    const prompt = `Sos Citi, el asistente de ventas de Compucity, una tienda de informática en Argentina. El cliente busca una notebook para ${useCase} con un presupuesto de $${budget.toLocaleString('es-AR')} ARS.

Se le recomendaron ${notebooks.length} opciones. Escribí un mensaje corto y amigable (máximo 3 oraciones) describiendo brevemente las opciones y destacando las diferencias. No uses markdown ni formato especial, solo texto plano. Hablá en argentino familiar (vos, no tú).`

    const result = await grokChat({
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Opciones:\n${notebooksInfo.map(n => `${n.tier}: ${n.name} - $${n.price.toLocaleString('es-AR')} efectivo - ${n.reason}`).join('\n\n')}` },
      ],
      temperature: 0.7,
      maxTokens: 300,
    })

    if (result.content) {
      return result.content.trim()
    }
  } catch (error) {
    console.error('[notebook-assistant] Error generating description:', error)
  }

  return `Te recomiendo ${notebooks.length} opciones de notebooks. La Económica te entra justo en presupuesto, la Recomendada es la mejor relación precio/rendimiento, y la Premium tiene lo mejor para ${useCase}.`
}

// ============================================
// System Prompt for Chat
// ============================================

const CHAT_SYSTEM_PROMPT = `Sos Citi, el asistente virtual de Compucity, una tienda de informática en Argentina. Tu trabajo es ayudar al cliente a elegir la notebook ideal.

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
  "use_case": null | "gaming" | "oficina" | "estudiante" | "diseno" | "general",
  "budget": null | número (en ARS, sin símbolo)
}

- "ready" es true cuando ya sabés el uso Y el presupuesto
- Si el cliente da un presupuesto en dólares, convertilo estimando que 1 USD ≈ 1200 ARS (aproximado)
- Si el cliente dice algo como "para juegos", "para jugar", "gamer" → use_case = "gaming"
- Si dice "para trabajar", "oficina", "administrar", "planillas", "word" → use_case = "oficina"
- Si dice "para estudiar", "universidad", "facultad", "colegio", "estudiante" → use_case = "estudiante"
- Si dice "para editar video", "diseño", "render", "photoshop", "ilustrator", "autocad" → use_case = "diseno"
- Si no está claro → use_case = "general"
- Para notebooks, los use_case más comunes son gaming, oficina y estudiante

Ejemplos:
- Cliente: "Busco una notebook para la facu" → message: "¡Genial! ¿Cuál es tu presupuesto aproximado? Decime en pesos si podés.", ready: false, use_case: "estudiante", budget: null
- Cliente: "Tengo 800000 pesos para gaming" → message: "¡Dale! Voy a buscar las mejores opciones para vos.", ready: true, use_case: "gaming", budget: 800000`

const POST_RECOMMENDATION_SYSTEM_PROMPT = `Sos Citi, el asistente virtual de Compucity, una tienda de informática en Argentina. Ya le recomendaste notebooks al cliente y ahora está haciendo consultas adicionales.

Reglas:
- Hablá en argentino familiar (usá "vos", no "tú")
- Sé amable y entusiasta
- Respondé SIEMPRE en JSON válido sin markdown
- Ayudá al cliente con sus dudas sobre las opciones que le presentaste
- Si pregunta por cambios o alternativas, explicale que puede reiniciar la conversación
- Si quiere ajustar el presupuesto, decile que puede tocar el botón de reinicio (✨) para empezar de nuevo
- No inventes productos ni precios específicos

Formato de respuesta JSON:
{
  "message": "Tu mensaje al cliente en texto plano",
  "ready": false,
  "use_case": null,
  "budget": null
}

IMPORTANTE: ready siempre debe ser false en esta fase. No generes nuevas recomendaciones.`

// ============================================
// Debug GET Endpoint
// ============================================

export async function GET() {
  try {
    const notebooks = await fetchNotebooksWithArsPrices()

    const prices = notebooks.map(p => p.arsComparePrice || p.arsPrice).filter(p => p > 0)
    const debug = {
      count: notebooks.length,
      priceRange: prices.length > 0
        ? `$${Math.round(Math.min(...prices)).toLocaleString()} - $${Math.round(Math.max(...prices)).toLocaleString()} ARS`
        : 'N/A',
      cheapest5: notebooks.slice(0, 5).map(p => ({
        name: p.name,
        arsPrice: `$${Math.round(p.arsComparePrice || p.arsPrice).toLocaleString()}`,
      })),
      mostExpensive5: notebooks.slice(-5).map(p => ({
        name: p.name,
        arsPrice: `$${Math.round(p.arsComparePrice || p.arsPrice).toLocaleString()}`,
      })),
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

    // Detect if recommendations were already shown
    const assistantMessages = messages.filter(m => m.role === 'assistant')
    const recommendationsAlreadyShown = assistantMessages.some(m =>
      m.content.includes('opciones') || m.content.includes('Opciones') || m.content.includes('recomiendo') || m.content.includes('Recomiendo')
    )
    const userMessages = messages.filter(m => m.role === 'user')
    const hasMultipleUserMessagesAfterRecommendations = userMessages.length > 2

    // Call LLM for chat response
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const systemPrompt = recommendationsAlreadyShown && hasMultipleUserMessagesAfterRecommendations
      ? POST_RECOMMENDATION_SYSTEM_PROMPT
      : CHAT_SYSTEM_PROMPT

    let chatResult: any = null
    try {
      const result = await grokChat({
        messages: [
          { role: 'system', content: systemPrompt },
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
          notebooks: null,
        })
      }

      chatResult = parseLlmJson(result.content)
      if (!chatResult) {
        return NextResponse.json({
          message: result.content,
          ready: false,
          notebooks: null,
        })
      }
    } catch (error) {
      clearTimeout(timeoutId)
      console.error('[notebook-assistant] LLM chat error:', error)
      return NextResponse.json({
        message: 'Disculpá, estoy teniendo problemas para conectarme. ¿Podés intentar de nuevo?',
        ready: false,
        notebooks: null,
      })
    }

    const responseMessage = chatResult.message || '¿En qué más te puedo ayudar?'
    const isReady = chatResult.ready === true
    const useCase = chatResult.use_case || null
    const budget = typeof chatResult.budget === 'number' ? chatResult.budget : null

    // If recommendations were already shown, skip and just chat
    if (recommendationsAlreadyShown && hasMultipleUserMessagesAfterRecommendations) {
      return NextResponse.json({
        message: responseMessage,
        ready: false,
        notebooks: null,
      })
    }

    // If not ready yet, just return the chat message
    if (!isReady || !useCase || !budget) {
      return NextResponse.json({
        message: responseMessage,
        ready: false,
        notebooks: null,
      })
    }

    // Ready to recommend! Fetch notebooks
    logger.debug(`[notebook-assistant] Recommending notebooks for useCase=${useCase}, budget=${budget}`)

    const notebooks = await fetchNotebooksWithArsPrices()

    if (notebooks.length === 0) {
      return NextResponse.json({
        message: 'Disculpá, no tengo notebooks disponibles en este momento. ¿Podrías intentar más tarde?',
        ready: false,
        notebooks: null,
      })
    }

    const recommendations = pickNotebookRecommendations(notebooks, useCase, budget)

    if (recommendations.length === 0) {
      return NextResponse.json({
        message: `Disculpá, no pude encontrar notebooks con ese presupuesto. ¿Podrías aumentar un poco el presupuesto o probar con otro tipo de uso?`,
        ready: false,
        notebooks: null,
      })
    }

    // Generate friendly AI description
    const description = await generateRecommendationDescription(recommendations, useCase, budget)

    return NextResponse.json({
      message: responseMessage,
      ready: true,
      notebooks: recommendations,
      description,
    })
  } catch (error) {
    console.error('[notebook-assistant] Unexpected error:', error)
    return NextResponse.json({
      message: 'Ocurrió un error inesperado. Intentá de nuevo.',
      ready: false,
      notebooks: null,
    })
  }
}
