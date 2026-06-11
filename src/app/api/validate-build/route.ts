import { NextRequest, NextResponse } from 'next/server'
import { grokChat } from '@/lib/grok'
import { db } from '@/lib/db'
import { extractCompatibility, type CompatibilityInfo } from '@/lib/compatibility'

// ============================================
// Types
// ============================================

interface BuildComponent {
  slot: string
  name: string
  price: number
}

interface ValidateBuildRequest {
  components: BuildComponent[]
}

interface ValidationIssue {
  severity: 'error' | 'warning' | 'info'
  component: string
  message: string
  suggestion: string
}

interface UpgradeProduct {
  id: string
  name: string
  price: number
  comparePrice: number | null
  slug: string
  images: string | null
  specs: string | null
  stock: number
  reason?: string
}

interface ValidationResult {
  compatible: boolean
  score: number
  issues: ValidationIssue[]
  summary: string
  bottleneck: string
  bottleneck_detail: string
  use_case: string
  upgrade_suggestion: string | null
  upgrade_products: UpgradeProduct[] | null
}

const FALLBACK_RESULT: ValidationResult = {
  compatible: true,
  score: 0,
  issues: [],
  summary: 'No se pudo validar el build con IA. Verificá la compatibilidad manualmente.',
  bottleneck: 'ninguno',
  bottleneck_detail: '',
  use_case: 'general',
  upgrade_suggestion: null,
  upgrade_products: null,
}

function fallbackWithError(errorMsg: string): ValidationResult & { _debug?: string } {
  return {
    ...FALLBACK_RESULT,
    summary: `No se pudo validar el build con IA: ${errorMsg}`,
    _debug: errorMsg,
  }
}

// Slot label map for user-friendly names in the prompt
const SLOT_LABELS: Record<string, string> = {
  processor: 'Procesador',
  motherboard: 'Motherboard',
  ram: 'Memoria RAM',
  gpu: 'Placa de Video',
  ssd: 'Disco SSD',
  hdd: 'Disco HDD',
  psu: 'Fuente de Alimentación',
  case: 'Gabinete',
  cooling: 'Refrigeración',
  thermal: 'Pasta Térmica',
  monitor: 'Monitor',
  network: 'Placa de Red',
  peripherals: 'Periféricos',
}

// Map bottleneck slot to category slug for product lookup
const BOTTLENECK_TO_CATEGORY: Record<string, string> = {
  procesador: 'microprocesadores',
  'placa de video': 'placas-de-video',
  ram: 'memorias-ram',
  almacenamiento: 'discos-ssd',
}

// ============================================
// Feature Flag Check
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
        const parsed = JSON.parse(rows[0].value)
        return parsed.value === true
      } catch {
        return false
      }
    }
    return false
  } catch (error) {
    console.error('[validate-build] Error checking ai_enabled flag:', error)
    return false
  }
}

// ============================================
// Spec Formatting
// ============================================

function formatSpecs(slot: string, info: CompatibilityInfo): string {
  const parts: string[] = []
  if (info.socket) parts.push(`Socket: ${info.socket}`)
  if (info.ddr) parts.push(`DDR: ${info.ddr}`)
  if (info.ddrType && info.ddrType === 'sodimm') parts.push('Tipo: SODIMM (laptop)')
  if (info.wattage) parts.push(`Potencia: ${info.wattage}W`)
  if (info.gpuTdp) parts.push(`TDP estimado: ${info.gpuTdp}W`)
  if (info.brand) parts.push(`Marca: ${info.brand}`)
  return parts.length > 0 ? parts.join(', ') : 'Sin specs detectadas'
}

// ============================================
// Fetch Upgrade Products from DB
// ============================================

async function fetchUpgradeProducts(
  bottleneckSlot: string,
  currentComponents: BuildComponent[],
  motherboardName?: string
): Promise<UpgradeProduct[]> {
  const categorySlug = BOTTLENECK_TO_CATEGORY[bottleneckSlot]
  if (!categorySlug) return []

  try {
    // Get category ID
    const catResult = await db.execute({
      sql: 'SELECT id FROM categories WHERE slug = ?',
      args: [categorySlug],
    })
    const catRows = catResult.rows as any[]
    if (catRows.length === 0) return []

    const categoryId = catRows[0].id

    // Get current component price for that slot to filter by price range
    const currentComp = currentComponents.find(c => {
      const slotMap: Record<string, string> = {
        procesador: 'processor',
        'placa de video': 'gpu',
        ram: 'ram',
        almacenamiento: 'ssd',
      }
      return c.slot === slotMap[bottleneckSlot]
    })
    const currentPrice = currentComp?.price || 0

    // Fetch products from that category, prioritizing higher-tier (more expensive than current)
    // and compatible ones based on motherboard constraints
    let query = `
      SELECT p.id, p.name, p.price, p.comparePrice, p.costPrice, p.slug, p.specs, p.images, p.stock,
             p.markup, p.cashDiscount, p.ivaRate, p.salePrice, p.saleStart, p.saleEnd, p.categoryId
      FROM products p
      WHERE p.categoryId = ?
        AND p.isActive = 1
        AND p.stock > 0
    `
    const args: any[] = [categoryId]

    // If bottleneck is processor, filter by motherboard socket
    if (bottleneckSlot === 'procesador' && motherboardName) {
      const mbInfo = extractCompatibility('motherboard', motherboardName)
      if (mbInfo.socket) {
        // Get all subcategories for the socket
        const socketPatterns: Record<string, string[]> = {
          AM4: ['AM4', 'B550', 'A520', 'X570', 'B450'],
          AM5: ['AM5', 'B650', 'B850', 'A620', 'X670', 'X870'],
          '1700': ['1700', 'B760', 'H610', 'B660', 'Z690', 'Z790'],
          '1851': ['1851', 'B860', 'Z890', 'H810'],
        }
        const patterns = socketPatterns[mbInfo.socket]
        if (patterns) {
          const likeClauses = patterns.map(() => `p.name LIKE ?`).join(' OR ')
          query += ` AND (${likeClauses})`
          patterns.forEach(p => args.push(`%${p}%`))
        }
      }
    }

    // If bottleneck is RAM, filter by motherboard DDR
    if (bottleneckSlot === 'ram' && motherboardName) {
      const mbInfo = extractCompatibility('motherboard', motherboardName)
      if (mbInfo.ddr) {
        query += ` AND p.name LIKE ?`
        args.push(`%${mbInfo.ddr}%`)
      }
    }

    query += ` ORDER BY p.price ASC LIMIT 20`

    const productsResult = await db.execute({ sql: query, args })
    const products = productsResult.rows as any[]

    // Calculate prices the same way the PC Builder does
    const { fetchDollarRate, calculateProductPrices } = await import('@/lib/dollar')
    const dollar = await fetchDollarRate()
    const markupResult = await db.execute({ sql: "SELECT value FROM store_config WHERE key = 'markup'", args: [] })
    const markupRows = markupResult.rows as any[]
    const globalMarkup = markupRows.length > 0 ? (JSON.parse(markupRows[0].value).value ?? 30) : 30
    const cashDiscountResult = await db.execute({ sql: "SELECT value FROM store_config WHERE key = 'cash_discount'", args: [] })
    const cashDiscountRows = cashDiscountResult.rows as any[]
    const globalCashDiscount = cashDiscountRows.length > 0 ? (JSON.parse(cashDiscountRows[0].value).value ?? 10) : 10

    // Get category markups
    const catMarkupResult = await db.execute('SELECT id, markup, cashDiscount, ivaRate FROM categories')
    const catMarkupMap = new Map<string, any>()
    for (const row of (catMarkupResult.rows as any[])) {
      catMarkupMap.set(row.id, row)
    }

    // Filter out the currently selected product and calculate prices
    const currentName = currentComp?.name || ''
    const filtered = products
      .filter(p => p.name !== currentName)
      .map(p => {
        const catMarkup = catMarkupMap.get(p.categoryId)
        const calculated = calculateProductPrices(p, dollar.rate, globalMarkup, globalCashDiscount, catMarkup || null)
        return {
          id: p.id,
          name: p.name,
          price: calculated.price || p.price || 0,
          comparePrice: calculated.comparePrice || null,
          slug: p.slug || '',
          images: p.images,
          specs: p.specs,
          stock: p.stock || 0,
        }
      })

    return filtered.slice(0, 10)
  } catch (error) {
    console.error('[validate-build] Error fetching upgrade products:', error)
    return []
  }
}

// ============================================
// Prompt Construction
// ============================================

function buildUserPrompt(components: BuildComponent[]): string {
  const lines: string[] = ['Analizá la siguiente configuración de PC:\n']

  for (const comp of components) {
    const label = SLOT_LABELS[comp.slot] || comp.slot
    const info = extractCompatibility(comp.slot, comp.name)
    const specs = formatSpecs(comp.slot, info)

    lines.push(`- ${label}: ${comp.name}`)
    lines.push(`  Specs extraídas: ${specs}`)
    lines.push(`  Precio: $${comp.price.toLocaleString('es-AR')}`)
    lines.push('')
  }

  lines.push('Total de componentes:', String(components.length))
  lines.push('')
  lines.push('Analizá la compatibilidad completa de este build y respondé en JSON.')

  return lines.join('\n')
}

function buildUpgradePrompt(
  bottleneck: string,
  bottleneckDetail: string,
  upgradeProducts: UpgradeProduct[],
  currentComponents: BuildComponent[]
): string {
  const lines: string[] = []

  lines.push(`Detectaste un cuello de botella en "${bottleneck}" con este detalle: "${bottleneckDetail}"`)
  lines.push('')
  lines.push('Estos son los productos disponibles en la tienda para reemplazarlo:')
  lines.push('')

  upgradeProducts.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.name} - $${p.price.toLocaleString('es-AR')}`)
  })

  lines.push('')
  lines.push('Build actual:')
  currentComponents.forEach(c => {
    lines.push(`- ${SLOT_LABELS[c.slot] || c.slot}: ${c.name}`)
  })

  lines.push('')
  lines.push('Elegí los 3 mejores productos de la lista que resolverían el cuello de botella, ordenados por relación precio/rendimiento. Respondé en JSON.')

  return lines.join('\n')
}

const SYSTEM_PROMPT = `Sos un experto en hardware de PC. Analizás configuraciones de PC y detectás ÚNICAMENTE problemas reales de compatibilidad. Respondés SIEMPRE en JSON válido sin markdown.

REGLAS ESTRICTAS:
- Si el socket del procesador no coincide con la motherboard, es un ERROR
- Si la memoria DDR no coincide con la motherboard, es un ERROR
- Si la fuente es insuficiente para la GPU + resto del sistema, es un WARNING
- Si no hay GPU dedicada, es un INFO

REGLAS DE BOTTLENECK - MUY IMPORTANTE:
- Solo marcá "bottleneck" si hay un desbalance EXTREMO y EVIDENTE entre componentes. Ejemplos válidos:
  * Procesador de entrada (Celeron/Pentium/i3) con GPU de alta gama (RTX 4070+)
  * GPU de baja gama (GT 1030) con procesador de alta gama (i9/Ryzen 9)
  * 4GB de RAM en un build gaming
- NO marqués bottleneck si los componentes están en rangos similares de rendimiento
- NO marqués bottleneck porque "existe algo mejor" - solo si la diferencia es extrema
- Si el build es coherente y equilibrado, bottleneck DEBE ser "ninguno"
- Sé conservador: cuando en duda, bottleneck = "ninguno"

Evaluá el build completo y asigná un score 1-10 basado en la coherencia general.

Respondé en este formato JSON exacto:
{
  "compatible": true/false,
  "score": 1-10,
  "issues": [
    {
      "severity": "error" | "warning" | "info",
      "component": "slot name (ej: fuente, procesador)",
      "message": "Descripción del problema en español",
      "suggestion": "Qué componente sería mejor (nombre genérico, no producto específico)"
    }
  ],
  "summary": "Resumen en 1-2 oraciones del estado del build",
  "bottleneck": "ninguno" | "procesador" | "placa de video" | "ram" | "almacenamiento",
  "bottleneck_detail": "Explicación breve si hay cuello de botella",
  "use_case": "gaming" | "oficina" | "edicion" | "general",
  "upgrade_suggestion": "Sugerencia de upgrade más impactante o null si no aplica"
}`

const UPGRADE_SYSTEM_PROMPT = `Sos un experto en hardware de PC. Te van a dar una lista de productos disponibles en una tienda y un cuello de botella detectado. Elegí los mejores productos que resuelvan el problema, manteniendo compatibilidad con el resto del build. Respondés SIEMPRE en JSON válido sin markdown.

Respondé en este formato JSON exacto:
{
  "recommendations": [
    {
      "name": "Nombre exacto del producto de la lista",
      "reason": "Por qué es mejor que el actual (1 oración)"
    }
  ]
}`

// ============================================
// JSON Response Parser
// ============================================

function parseLlmJson(raw: string): any | null {
  // Try direct parse first
  try {
    return JSON.parse(raw)
  } catch {
    // Continue to try extracting from markdown
  }

  // Try extracting JSON from markdown code blocks
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim())
    } catch {
      // Continue
    }
  }

  // Try finding the first { ... } block
  const braceStart = raw.indexOf('{')
  const braceEnd = raw.lastIndexOf('}')
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(raw.substring(braceStart, braceEnd + 1))
    } catch {
      // Give up
    }
  }

  return null
}

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    // 1. Check feature flag
    const aiEnabled = await isAiEnabled()
    if (!aiEnabled) {
      return NextResponse.json(
        { error: 'IA deshabilitada' },
        { status: 403 }
      )
    }

    // 2. Parse request body
    let body: ValidateBuildRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Body inválido. Se esperaba JSON.' },
        { status: 400 }
      )
    }

    const { components } = body

    // 3. Validate components array
    if (!Array.isArray(components) || components.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere al menos un componente para validar.' },
        { status: 400 }
      )
    }

    if (components.length > 13) {
      return NextResponse.json(
        { error: 'Máximo 13 componentes permitidos.' },
        { status: 400 }
      )
    }

    // Validate each component has required fields
    for (const comp of components) {
      if (!comp.slot || !comp.name || typeof comp.price !== 'number') {
        return NextResponse.json(
          { error: 'Cada componente debe tener slot, name y price.' },
          { status: 400 }
        )
      }
    }

    // 4. Build user prompt with extracted specs
    const userPrompt = buildUserPrompt(components)

    // 5. Call Groq for analysis (increased timeout for better results)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000)

    let analysisResult: any = null

    try {
      const result = await grokChat({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        maxTokens: 800,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // 6. Parse response
      const rawContent = result.content
      if (!rawContent) {
        console.error('[validate-build] Empty Groq response')
        return NextResponse.json(fallbackWithError('Groq devolvió respuesta vacía'))
      }

      analysisResult = parseLlmJson(rawContent)
      if (!analysisResult) {
        console.error('[validate-build] Failed to parse Groq JSON:', rawContent.substring(0, 200))
        return NextResponse.json(fallbackWithError('No se pudo parsear la respuesta de Groq'))
      }
    } catch (error) {
      clearTimeout(timeoutId)
      const errMsg = error instanceof Error ? error.message : String(error)
      console.error('[validate-build] Groq call failed:', errMsg)

      if (errMsg.includes('abort') || errMsg.includes('timeout') || errMsg.includes('Timeout')) {
        return NextResponse.json(
          { error: 'Tiempo de espera agotado. Intentá de nuevo.' },
          { status: 504 }
        )
      }

      return NextResponse.json(fallbackWithError(errMsg))
    }

    // 7. Validate and sanitize parsed result
    const bottleneck: string = ['ninguno', 'procesador', 'placa de video', 'ram', 'almacenamiento'].includes(analysisResult.bottleneck)
      ? analysisResult.bottleneck
      : 'ninguno'

    const response: ValidationResult = {
      compatible: typeof analysisResult.compatible === 'boolean' ? analysisResult.compatible : true,
      score: typeof analysisResult.score === 'number' ? Math.max(1, Math.min(10, analysisResult.score)) : 0,
      issues: Array.isArray(analysisResult.issues)
        ? analysisResult.issues.map((issue: any) => ({
            severity: ['error', 'warning', 'info'].includes(issue.severity) ? issue.severity : 'info',
            component: String(issue.component || ''),
            message: String(issue.message || ''),
            suggestion: String(issue.suggestion || ''),
          }))
        : [],
      summary: String(analysisResult.summary || ''),
      bottleneck,
      bottleneck_detail: String(analysisResult.bottleneck_detail || ''),
      use_case: ['gaming', 'oficina', 'edicion', 'general'].includes(analysisResult.use_case)
        ? analysisResult.use_case
        : 'general',
      upgrade_suggestion: analysisResult.upgrade_suggestion ? String(analysisResult.upgrade_suggestion) : null,
      upgrade_products: null,
    }

    // 8. If there's a bottleneck, fetch upgrade products and get AI recommendations
    if (bottleneck !== 'ninguno') {
      const motherboardComp = components.find(c => c.slot === 'motherboard')
      const upgradeProducts = await fetchUpgradeProducts(
        bottleneck,
        components,
        motherboardComp?.name
      )

      if (upgradeProducts.length > 0) {
        try {
          const upgradePrompt = buildUpgradePrompt(
            bottleneck,
            response.bottleneck_detail,
            upgradeProducts,
            components
          )

          const upgradeController = new AbortController()
          const upgradeTimeoutId = setTimeout(() => upgradeController.abort(), 15000)

          const upgradeResult = await grokChat({
            messages: [
              { role: 'system', content: UPGRADE_SYSTEM_PROMPT },
              { role: 'user', content: upgradePrompt },
            ],
            temperature: 0.3,
            maxTokens: 400,
            signal: upgradeController.signal,
          })

          clearTimeout(upgradeTimeoutId)

          const upgradeRaw = upgradeResult.content
          if (upgradeRaw) {
            const upgradeParsed = parseLlmJson(upgradeRaw)
            if (upgradeParsed?.recommendations && Array.isArray(upgradeParsed.recommendations)) {
              // Match AI recommendations with actual products from DB
              const recommendedProducts: UpgradeProduct[] = []
              for (const rec of upgradeParsed.recommendations) {
                const matched = upgradeProducts.find(p =>
                  p.name.toLowerCase().includes(rec.name?.toLowerCase()?.substring(0, 15)) ||
                  rec.name?.toLowerCase()?.includes(p.name.toLowerCase().substring(0, 15))
                )
                if (matched) {
                  recommendedProducts.push({
                    ...matched,
                    reason: String(rec.reason || ''),
                  })
                }
              }

              // If AI didn't match well, fall back to top 3 products by price (higher tier)
              if (recommendedProducts.length === 0) {
                response.upgrade_products = upgradeProducts.slice(0, 3)
              } else {
                response.upgrade_products = recommendedProducts
              }
            }
          }
        } catch (error) {
          // Upgrade suggestion failed, just return analysis without products
          console.error('[validate-build] Upgrade recommendation failed:', error)
          // Fallback: return top 3 products from DB without AI filtering
          response.upgrade_products = upgradeProducts.slice(0, 3)
        }
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[validate-build] Unexpected error:', error)
    return NextResponse.json(FALLBACK_RESULT)
  }
}
