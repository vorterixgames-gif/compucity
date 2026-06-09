// ============================================
// Grok (xAI) Client — uses native fetch, no external deps
// ============================================

const GROK_BASE_URL = 'https://api.x.ai/v1'
const GROK_MODEL = 'grok-3-mini'

interface GrokMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GrokChatOptions {
  messages: GrokMessage[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

interface GrokChatResult {
  content: string | null
  raw: any
}

/**
 * Call Grok chat completions API using native fetch.
 * Compatible with xAI's OpenAI-compatible endpoint.
 */
export async function grokChat(options: GrokChatOptions): Promise<GrokChatResult> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is not set')
  }

  const { messages, temperature = 0.3, maxTokens = 800, signal } = options

  const response = await fetch(`${GROK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`Grok API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content ?? null

  return { content, raw: data }
}
