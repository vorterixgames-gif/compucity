// ============================================
// Groq Client — uses native fetch, no external deps
// ============================================

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GroqChatOptions {
  messages: GroqMessage[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

interface GroqChatResult {
  content: string | null
  raw: any
}

/**
 * Call Groq chat completions API using native fetch.
 * Groq is OpenAI-compatible, so same endpoint structure.
 */
export async function grokChat(options: GroqChatOptions): Promise<GrokChatResult> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is not set')
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
