import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    GROQ_API_KEY_set: !!process.env.GROQ_API_KEY,
    GROQ_API_KEY_prefix: process.env.GROQ_API_KEY?.substring(0, 8) || 'NOT SET',
    XAI_API_KEY_set: !!process.env.XAI_API_KEY,
    all_env_keys_with_key: Object.keys(process.env).filter(k => 
      k.includes('GROQ') || k.includes('XAI') || k.includes('OPENAI') || k.includes('API_KEY')
    ),
  })
}
