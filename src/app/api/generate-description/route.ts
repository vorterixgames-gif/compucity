import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'

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
    console.error('[generate-description] Error checking ai_enabled flag:', error)
    return false
  }
}

// ============================================
// System Prompt
// ============================================

const SYSTEM_PROMPT = `Sos un redactor de productos de informática para una tienda online argentina. Generás descripciones en español, claras y profesionales, que destaquen las características principales del producto. No usás emojis. No mencionás precios. La descripción debe tener entre 2 y 4 oraciones. Respondés SOLO con el texto de la descripción, sin comillas, sin markdown, sin prefijos.`

// ============================================
// Build User Prompt
// ============================================

function buildUserPrompt(productName: string, categoryName: string | null, specs: string | null): string {
  let prompt = `Generá una descripción para este producto:\nNombre: ${productName}`
  if (categoryName) {
    prompt += `\nCategoría: ${categoryName}`
  }
  if (specs) {
    try {
      const parsed = JSON.parse(specs)
      if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length > 0) {
        const specLines = Object.entries(parsed)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ')
        prompt += `\nEspecificaciones: ${specLines}`
      }
    } catch {
      // specs is not valid JSON, skip
    }
  }
  return prompt
}

// ============================================
// Generate Description for a Single Product
// ============================================

async function generateDescriptionForProduct(productId: string): Promise<{ ok: boolean; description?: string; error?: string }> {
  // Fetch product with category name
  const productResult = await db.execute({
    sql: `SELECT p.id, p.name, p.specs, p.categoryId, c.name as categoryName
          FROM products p
          LEFT JOIN categories c ON p.categoryId = c.id
          WHERE p.id = ?`,
    args: [productId],
  })

  const rows = productResult.rows as any[]
  if (rows.length === 0) {
    return { ok: false, error: 'Producto no encontrado' }
  }

  const product = rows[0]
  const userPrompt = buildUserPrompt(product.name, product.categoryName, product.specs)

  try {
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    })

    const description = completion?.choices?.[0]?.message?.content?.trim()

    if (!description) {
      console.error('[generate-description] Empty LLM response for product:', productId)
      return { ok: false, error: 'La IA no generó una descripción' }
    }

    // Save to DB
    await db.execute({
      sql: 'UPDATE products SET description = ?, updatedAt = ? WHERE id = ?',
      args: [description, new Date().toISOString(), productId],
    })

    return { ok: true, description }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[generate-description] LLM call failed for product:', productId, errMsg)
    return { ok: false, error: errMsg }
  }
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
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Body inválido. Se esperaba JSON.' },
        { status: 400 }
      )
    }

    // 3. Single product flow
    if (body.productId) {
      const result = await generateDescriptionForProduct(body.productId)
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        )
      }
      return NextResponse.json({ ok: true, description: result.description })
    }

    // 4. Batch flow (for admin)
    if (body.productIds && Array.isArray(body.productIds)) {
      let updated = 0
      const errors: string[] = []

      for (const productId of body.productIds) {
        const result = await generateDescriptionForProduct(productId)
        if (result.ok) {
          updated++
        } else if (result.error) {
          errors.push(`${productId}: ${result.error}`)
        }
      }

      return NextResponse.json({
        ok: true,
        updated,
        errors: errors.length > 0 ? errors : undefined,
      })
    }

    // 5. Auto-batch: find all products with empty description
    if (body.batch === true) {
      const productsResult = await db.execute({
        sql: `SELECT p.id, p.name, p.specs, p.categoryId, c.name as categoryName
              FROM products p
              LEFT JOIN categories c ON p.categoryId = c.id
              WHERE (p.description IS NULL OR p.description = '')
                AND p.isActive = 1
              LIMIT 20`,
        args: [],
      })

      const products = productsResult.rows as any[]
      let updated = 0
      const errors: string[] = []

      for (const product of products) {
        const userPrompt = buildUserPrompt(product.name, product.categoryName, product.specs)

        try {
          const zai = await ZAI.create()
          const completion = await zai.chat.completions.create({
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 200,
          })

          const description = completion?.choices?.[0]?.message?.content?.trim()

          if (description) {
            await db.execute({
              sql: 'UPDATE products SET description = ?, updatedAt = ? WHERE id = ?',
              args: [description, new Date().toISOString(), product.id],
            })
            updated++
          } else {
            errors.push(`${product.id}: Empty LLM response`)
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error)
          console.error('[generate-description] LLM call failed for product:', product.id, errMsg)
          errors.push(`${product.id}: ${errMsg}`)
        }
      }

      return NextResponse.json({
        ok: true,
        updated,
        total: products.length,
        errors: errors.length > 0 ? errors : undefined,
      })
    }

    return NextResponse.json(
      { error: 'Se requiere productId, productIds o batch: true' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[generate-description] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Error del servidor' },
      { status: 500 }
    )
  }
}
