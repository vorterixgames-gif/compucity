import { NextRequest, NextResponse } from 'next/server'

/**
 * Endpoint de prueba para verificar compatibilidad de z-ai-web-dev-sdk con Edge Runtime.
 *
 * Sesión 44 round 8: queremos mover los endpoints de IA (pc-assistant, notebook-assistant,
 * generate-description) de Node.js runtime a Edge runtime para que NO consuman Fluid Active CPU.
 *
 * Edge Functions en Vercel:
 * - No consumen Fluid Active CPU (cuentan como Edge invocations, cuota separada: 1M/mes gratis)
 * - Tienen 25s de timeout (suficiente para IA)
 * - Pero NO soportan Node.js APIs (fs, path, os, etc.)
 *
 * z-ai-web-dev-sdk importa `fs/promises`, `path`, `os` al inicio del archivo.
 * Si el bundler de Edge runtime no los resuelve, este endpoint va a fallar.
 *
 * Si este endpoint funciona → podemos migrar los 3 endpoints de IA a Edge.
 * Si falla → tenemos que reemplazar z-ai-web-dev-sdk por fetch directo a la API de ZAI.
 */

// IMPORTANTE: runtime = 'edge' hace que este endpoint no consuma Fluid Active CPU
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { prompt = 'Decí "hola" en una palabra' } = body

    // Test 1: ¿Puedo importar y usar z-ai-web-dev-sdk en Edge?
    const ZAIModule = await import('z-ai-web-dev-sdk')
    const ZAI = ZAIModule.default

    const baseUrl = process.env.ZAI_BASE_URL
    const apiKey = process.env.ZAI_API_KEY

    if (!baseUrl || !apiKey) {
      return NextResponse.json({
        ok: false,
        error: 'ZAI_BASE_URL o ZAI_API_KEY no configurados',
        elapsed: Date.now() - startTime,
      }, { status: 500 })
    }

    // Crear instancia directa (sin loadConfig que usa fs)
    const zai = new ZAI({
      baseUrl,
      apiKey,
      chatId: process.env.ZAI_CHAT_ID || '',
      userId: process.env.ZAI_USER_ID || '',
      token: process.env.ZAI_TOKEN || '',
    })

    // Test 2: ¿Puedo hacer una llamada a la API?
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'Respondé en máximo 5 palabras.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 50,
    })

    const content = completion?.choices?.[0]?.message?.content

    return NextResponse.json({
      ok: true,
      message: 'Edge runtime + z-ai-web-dev-sdk funcionan correctamente',
      response: content,
      prompt,
      elapsed: `${Date.now() - startTime}ms`,
      runtime: 'edge',
    })
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      elapsed: `${Date.now() - startTime}ms`,
      runtime: 'edge',
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Endpoint de prueba Edge + z-ai-web-dev-sdk. Hacé POST con {"prompt": "hola"}',
    runtime: 'edge',
  })
}
