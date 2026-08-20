import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'
import { grokChat } from '@/lib/grok'

// SESIÓN 65: restaurado — el endpoint existía (tasks 4-5-6, 2026-03-04) pero el
// archivo se perdió del repo (bug recurrente de archivos que desaparecen).
// El botón "Generar con IA" del admin productos seguía apuntando acá (404).
// Ahora usa grokChat (Groq, mismo client de los chatbots de la web) en vez de
// z-ai-web-dev-sdk directo: en producción ZAI no está configurado y el fallback
// Groq es lo que ya funciona en los chatbots.
export const maxDuration = 60

const SYSTEM_PROMPT = `Sos el redactor de Compucity, una tienda de informática de Córdoba, Argentina. Escribí descripciones de producto en español, de 2 a 4 frases, sin emojis, sin precios, sin markdown y sin inventar especificaciones que no figuren en los datos del producto. Enfocate en el uso práctico y a quién le sirve el producto.`

async function isAiEnabled(): Promise<boolean> {
  try {
    const res = await db.execute({
      sql: `SELECT value FROM store_config WHERE key = 'ai_enabled'`,
      args: [],
    })
    if (res.rows.length === 0) return true
    const parsed = JSON.parse(String(res.rows[0].value))
    return parsed?.value !== false
  } catch {
    return true
  }
}

interface ProductRow {
  id: string
  name: string
  description: string | null
  specs: string | null
  categoryName: string | null
}

async function loadProduct(id: string): Promise<ProductRow | null> {
  const res = await db.execute({
    sql: `SELECT p.id, p.name, p.description, p.specs, c.name as categoryName
          FROM products p
          LEFT JOIN categories c ON p.categoryId = c.id
          WHERE p.id = ?`,
    args: [id],
  })
  if (res.rows.length === 0) return null
  const r = res.rows[0] as any
  return { id: r.id, name: r.name, description: r.description, specs: r.specs, categoryName: r.categoryName }
}

function buildUserPrompt(p: ProductRow): string {
  let specsText = ''
  if (p.specs) {
    try {
      const specs = JSON.parse(p.specs)
      const entries = Object.entries(specs).map(([k, v]) => `${k}: ${v}`)
      if (entries.length > 0) specsText = entries.join(' | ')
    } catch {
      specsText = ''
    }
  }
  return `Producto: ${p.name}
Categoría: ${p.categoryName || 'Sin categoría'}${specsText ? `
Especificaciones: ${specsText}` : ''}

Generá la descripción para la ficha del producto.`
}

async function generateFor(p: ProductRow): Promise<string> {
  const result = await grokChat({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(p) },
    ],
    temperature: 0.7,
    maxTokens: 200,
  })
  const text = (result.content || '').trim()
  if (!text) throw new Error('La IA devolvió una descripción vacía')
  return text
}

async function saveDescription(id: string, description: string) {
  await db.execute({
    sql: `UPDATE products SET description = ?, updatedAt = ? WHERE id = ?`,
    args: [description, new Date().toISOString(), id],
  })
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!(await isAiEnabled())) {
      return NextResponse.json({ ok: false, error: 'Generación con IA deshabilitada (ai_enabled=false)' })
    }

    const body = await request.json()

    // ─── Auto-batch: hasta 10 productos activos sin descripción ───
    if (body.batch === true) {
      const res = await db.execute({
        sql: `SELECT id FROM products
              WHERE isActive = 1 AND (description IS NULL OR description = '')
              LIMIT 10`,
        args: [],
      })
      const ids = (res.rows as any[]).map(r => r.id)
      let updated = 0
      const errors: string[] = []
      for (const id of ids) {
        try {
          const p = await loadProduct(id)
          if (!p) continue
          const text = await generateFor(p)
          await saveDescription(id, text)
          updated++
        } catch (e: any) {
          errors.push(`${id}: ${e.message}`)
        }
      }
      return NextResponse.json({ ok: true, updated, total: ids.length, errors })
    }

    // ─── Batch por IDs ───
    if (Array.isArray(body.productIds)) {
      const ids = body.productIds.slice(0, 10)
      let updated = 0
      const errors: string[] = []
      for (const id of ids) {
        try {
          const p = await loadProduct(id)
          if (!p) continue
          const text = await generateFor(p)
          await saveDescription(id, text)
          updated++
        } catch (e: any) {
          errors.push(`${id}: ${e.message}`)
        }
      }
      return NextResponse.json({ ok: true, updated, total: ids.length, errors })
    }

    // ─── Single product ───
    const productId = body.productId
    if (!productId) return NextResponse.json({ ok: false, error: 'Falta productId o productIds' })

    const p = await loadProduct(productId)
    if (!p) return NextResponse.json({ ok: false, error: 'Producto no encontrado' })

    const text = await generateFor(p)
    await saveDescription(productId, text)
    return NextResponse.json({ ok: true, description: text })
  } catch (error: any) {
    console.error('generate-description error:', error)
    return NextResponse.json({ ok: false, error: error.message || 'Error interno' }, { status: 500 })
  }
}
