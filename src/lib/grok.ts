// ============================================
// AI Chat Client — uses z-ai-web-dev-sdk (primary) or Groq (fallback)
// ============================================
//
// Sesión 44 round 8: hecho compatible con Edge runtime.
// z-ai-web-dev-sdk importa fs/promises, path, os al inicio del archivo,
// lo que rompe el bundling de Edge runtime. Solución: import dinámico dentro
// de la función getZai(), así solo se carga cuando se necesita (y solo si
// las vars ZAI_* están configuradas). En producción los chatbots usan fallback
// a Groq porque ZAI no está configurada, así que nunca se carga el SDK.

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
// SESIÓN 65: Groq retiró llama-3.3-70b-versatile (404 model_not_found) y eso
// rompía los chatbots de la web y el generate-description. Ahora probamos una
// lista de modelos en orden hasta que uno responda.
const GROQ_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
  'llama-3.3-70b-versatile',
]

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatOptions {
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

interface ChatResult {
  content: string | null
  raw: any
}

// Cache de la instancia ZAI (singleton). Tipo loose para evitar importar el tipo.
let zaiInstance: any = null

async function getZai(): Promise<any> {
  if (zaiInstance) return zaiInstance

  const baseUrl = process.env.ZAI_BASE_URL
  const apiKey = process.env.ZAI_API_KEY
  if (!baseUrl || !apiKey) {
    throw new Error('ZAI_BASE_URL and ZAI_API_KEY environment variables are required')
  }

  // Import dinámico — solo carga el SDK si realmente lo vamos a usar.
  // Esto evita que el bundler de Edge runtime intente resolver fs/path/os
  // al inicio del módulo.
  const ZAIModule = await import('z-ai-web-dev-sdk')
  const ZAI = ZAIModule.default

  zaiInstance = new ZAI({
    baseUrl,
    apiKey,
    chatId: process.env.ZAI_CHAT_ID || '',
    userId: process.env.ZAI_USER_ID || '',
    token: process.env.ZAI_TOKEN || '',
  })
  return zaiInstance
}

/**
 * Try Groq API (fallback if z-ai-web-dev-sdk is unavailable)
 */
async function groqFallback(options: ChatOptions): Promise<ChatResult> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not set')
  }

  const { messages, temperature = 0.3, maxTokens = 800, signal } = options

  // SESIÓN 65: fallback entre modelos si Groq devuelve 404 (modelo retirado)
  let lastError = ''
  for (const model of GROQ_MODELS) {
    const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal,
    })

    if (response.ok) {
      const data = await response.json()
      const content = data?.choices?.[0]?.message?.content ?? null
      if (content) return { content, raw: data }
      lastError = `Groq devolvió contenido vacío (${model})`
      console.warn(`[groqFallback] ${lastError}, probando siguiente...`)
      continue
    }

    const errorText = await response.text().catch(() => 'Unknown error')
    lastError = `Groq API error ${response.status} (${model}): ${errorText}`
    // Si el modelo no existe / sin acceso, probar el siguiente
    if (response.status === 404 || errorText.includes('model_not_found') || errorText.includes('does not exist')) {
      console.warn(`[groqFallback] modelo ${model} no disponible, probando siguiente...`)
      continue
    }
    throw new Error(lastError)
  }
  throw new Error(lastError || 'Groq: ningún modelo disponible')
}

/**
 * Call AI chat completions.
 * Primary: z-ai-web-dev-sdk (configured via env vars, no file needed)
 * Fallback: Groq API (if GROQ_API_KEY is valid)
 */
export async function grokChat(options: ChatOptions): Promise<ChatResult> {
  const { temperature = 0.3, maxTokens = 800 } = options

  // Try z-ai-web-dev-sdk first (solo si está configurado, si no, salta a Groq)
  try {
    const zai = await getZai()
    const completion = await zai.chat.completions.create({
      messages: options.messages,
      temperature,
      max_tokens: maxTokens,
    })

    const content = completion.choices?.[0]?.message?.content ?? null
    if (content) {
      return { content, raw: completion }
    }
    // If empty content, fall through to Groq
  } catch (error: any) {
    console.warn('[grokChat] z-ai-web-dev-sdk failed, trying Groq fallback:', error?.message || error)
  }

  // Fallback to Groq
  return groqFallback(options)
}
