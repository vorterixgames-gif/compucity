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

interface ValidationResult {
  compatible: boolean
  score: number
  issues: ValidationIssue[]
  summary: string
  bottleneck: string
  bottleneck_detail: string
  use_case: string
  upgrade_suggestion: string | null
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

const SYSTEM_PROMPT = `Sos un experto en hardware de PC. Analizás configuraciones de PC y detectás problemas de compatibilidad, cuellos de botella, y sugerís mejoras. Respondés SIEMPRE en JSON válido sin markdown.

Reglas:
- Si el socket del procesador no coincide con la motherboard, es un ERROR
- Si la memoria DDR no coincide con la motherboard, es un ERROR  
- Si la fuente es insuficiente para la GPU + resto del sistema, es un WARNING
- Si el procesador limita la GPU (bottleneck), es un WARNING
- Si no hay GPU dedicada, es un INFO
- Evaluá el build completo y asigná un score 1-10

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

// ============================================
// JSON Response Parser
// ============================================

function parseLlmJson(raw: string): ValidationResult | null {
  // Try direct parse first
  try {
    return JSON.parse(raw) as ValidationResult
  } catch {
    // Continue to try extracting from markdown
  }

  // Try extracting JSON from markdown code blocks
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as ValidationResult
    } catch {
      // Continue
    }
  }

  // Try finding the first { ... } block
  const braceStart = raw.indexOf('{')
  const braceEnd = raw.lastIndexOf('}')
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(raw.substring(braceStart, braceEnd + 1)) as ValidationResult
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

    // 5. Call Grok with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

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
        console.error('[validate-build] Empty Grok response')
        return NextResponse.json(FALLBACK_RESULT)
      }

      const parsed = parseLlmJson(rawContent)
      if (!parsed) {
        console.error('[validate-build] Failed to parse Grok JSON:', rawContent.substring(0, 200))
        return NextResponse.json(FALLBACK_RESULT)
      }

      // 7. Validate and sanitize parsed result
      const response: ValidationResult = {
        compatible: typeof parsed.compatible === 'boolean' ? parsed.compatible : true,
        score: typeof parsed.score === 'number' ? Math.max(1, Math.min(10, parsed.score)) : 0,
        issues: Array.isArray(parsed.issues)
          ? parsed.issues.map((issue: any) => ({
              severity: ['error', 'warning', 'info'].includes(issue.severity) ? issue.severity : 'info',
              component: String(issue.component || ''),
              message: String(issue.message || ''),
              suggestion: String(issue.suggestion || ''),
            }))
          : [],
        summary: String(parsed.summary || ''),
        bottleneck: ['ninguno', 'procesador', 'placa de video', 'ram', 'almacenamiento'].includes(parsed.bottleneck)
          ? parsed.bottleneck
          : 'ninguno',
        bottleneck_detail: String(parsed.bottleneck_detail || ''),
        use_case: ['gaming', 'oficina', 'edicion', 'general'].includes(parsed.use_case)
          ? parsed.use_case
          : 'general',
        upgrade_suggestion: parsed.upgrade_suggestion ? String(parsed.upgrade_suggestion) : null,
      }

      return NextResponse.json(response)
    } catch (error) {
      clearTimeout(timeoutId)
      const errMsg = error instanceof Error ? error.message : String(error)
      console.error('[validate-build] Grok call failed:', errMsg)

      // If aborted (timeout), return specific error
      if (errMsg.includes('abort') || errMsg.includes('timeout') || errMsg.includes('Timeout')) {
        return NextResponse.json(
          { error: 'Tiempo de espera agotado. Intentá de nuevo.' },
          { status: 504 }
        )
      }

      // Return fallback for other LLM errors
      return NextResponse.json(FALLBACK_RESULT)
    }
  } catch (error) {
    console.error('[validate-build] Unexpected error:', error)
    return NextResponse.json(FALLBACK_RESULT)
  }
}
