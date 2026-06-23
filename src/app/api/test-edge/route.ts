import { NextRequest, NextResponse } from 'next/server'

/**
 * Endpoint de prueba para verificar compatibilidad de IA APIs con Edge Runtime.
 *
 * Sesión 44 round 8: queremos mover los endpoints de IA (pc-assistant, notebook-assistant,
 * generate-description) de Node.js runtime a Edge runtime para que NO consuman Fluid Active CPU.
 *
 * Edge Functions en Vercel:
 * - No consumen Fluid Active CPU (cuentan como Edge invocations, cuota separada: 1M/mes gratis)
 * - Tienen 25s de timeout (suficiente para IA)
 * - Pero NO soportan Node.js APIs (fs, path, os, etc.)
 *
 * Este endpoint prueba 2 cosas:
 * 1. Si z-ai-web-dev-sdk funciona en Edge (si ZAI_BASE_URL y ZAI_API_KEY están configurados)
 * 2. Si la API de Groq funciona en Edge (GROQ_API_KEY sí está configurada)
 *
 * Si al menos una funciona → podemos migrar los 3 endpoints de IA a Edge.
 */

// IMPORTANTE: runtime = 'edge' hace que este endpoint no consuma Fluid Active CPU
export const runtime = 'edge'

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const body = await request.json().catch(() => ({}))
  const { prompt = 'Decí "hola" en una palabra' } = body

  const results: any = {
    runtime: 'edge',
    elapsed: 0,
    tests: {},
  }

  // ============================================
  // Test 1: Groq API (siempre configurada en Vercel)
  // ============================================
  try {
    const groqApiKey = process.env.GROQ_API_KEY
    if (!groqApiKey) {
      results.tests.groq = { ok: false, error: 'GROQ_API_KEY no configurada' }
    } else {
      const t0 = Date.now()
      const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: 'Respondé en máximo 5 palabras.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 50,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        results.tests.groq = {
          ok: false,
          status: response.status,
          error: errText.substring(0, 200),
          elapsed: `${Date.now() - t0}ms`,
        }
      } else {
        const data = await response.json()
        results.tests.groq = {
          ok: true,
          response: data?.choices?.[0]?.message?.content,
          elapsed: `${Date.now() - t0}ms`,
          model: GROQ_MODEL,
        }
      }
    }
  } catch (error: any) {
    results.tests.groq = {
      ok: false,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    }
  }

  // ============================================
  // Test 2: z-ai-web-dev-sdk (solo si ZAI_* están configuradas)
  // ============================================
  const zaiBaseUrl = process.env.ZAI_BASE_URL
  const zaiApiKey = process.env.ZAI_API_KEY

  if (!zaiBaseUrl || !zaiApiKey) {
    results.tests.zai = {
      ok: false,
      skipped: true,
      reason: 'ZAI_BASE_URL o ZAI_API_KEY no configuradas en Vercel. Los chatbots usan fallback a Groq en producción.',
    }
  } else {
    try {
      const ZAIModule = await import('z-ai-web-dev-sdk')
      const ZAI = ZAIModule.default
      const zai = new ZAI({
        baseUrl: zaiBaseUrl,
        apiKey: zaiApiKey,
        chatId: process.env.ZAI_CHAT_ID || '',
        userId: process.env.ZAI_USER_ID || '',
        token: process.env.ZAI_TOKEN || '',
      })

      const t0 = Date.now()
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: 'Respondé en máximo 5 palabras.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 50,
      })

      results.tests.zai = {
        ok: true,
        response: completion?.choices?.[0]?.message?.content,
        elapsed: `${Date.now() - t0}ms`,
      }
    } catch (error: any) {
      results.tests.zai = {
        ok: false,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      }
    }
  }

  // ============================================
  // Veredicto
  // ============================================
  const groqOk = results.tests.groq?.ok === true
  const zaiOk = results.tests.zai?.ok === true
  const zaiSkipped = results.tests.zai?.skipped === true

  results.ok = groqOk || zaiOk
  results.message = results.ok
    ? 'Edge runtime funciona con al menos una API de IA'
    : 'Edge runtime NO funciona con ninguna API de IA'
  results.canMigrate = results.ok
  results.elapsed = `${Date.now() - startTime}ms`

  return NextResponse.json(results, { status: results.ok ? 200 : 500 })
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Endpoint de prueba Edge + IA. Hacé POST con {"prompt": "hola"}',
    runtime: 'edge',
    tests: ['groq', 'zai'],
  })
}

