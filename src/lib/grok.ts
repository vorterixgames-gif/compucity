// ============================================
// AI Chat Client — uses z-ai-web-dev-sdk (primary) or Groq (fallback)
// ============================================

import ZAI from 'z-ai-web-dev-sdk'

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

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

// Singleton ZAI instance — created directly from env vars (no config file needed)
let zaiInstance: ZAI | null = null

function getZai(): ZAI {
  if (!zaiInstance) {
    const baseUrl = process.env.ZAI_BASE_URL
    const apiKey = process.env.ZAI_API_KEY
    if (!baseUrl || !apiKey) {
      throw new Error('ZAI_BASE_URL and ZAI_API_KEY environment variables are required')
    }
    zaiInstance = new ZAI({
      baseUrl,
      apiKey,
      chatId: process.env.ZAI_CHAT_ID || '',
      userId: process.env.ZAI_USER_ID || '',
      token: process.env.ZAI_TOKEN || '',
    })
  }
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

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`Groq API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content ?? null
  return { content, raw: data }
}

/**
 * Call AI chat completions.
 * Primary: z-ai-web-dev-sdk (configured via env vars, no file needed)
 * Fallback: Groq API (if GROQ_API_KEY is valid)
 */
export async function grokChat(options: ChatOptions): Promise<ChatResult> {
  const { temperature = 0.3, maxTokens = 800 } = options

  // Try z-ai-web-dev-sdk first
  try {
    const zai = getZai()
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
