import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchDollarRate } from '@/lib/dollar'

async function getConfig(key: string, defaultValue: number): Promise<number> {
  const result = await db.execute({
    sql: 'SELECT value FROM store_config WHERE key = ?',
    args: [key],
  })
  const rows = result.rows as any[]
  if (rows.length > 0) {
    try {
      return Number(JSON.parse(rows[0].value).value) || defaultValue
    } catch {
      return defaultValue
    }
  }
  return defaultValue
}

export async function GET() {
  try {
    // Get current dollar rate and config
    const dollar = await fetchDollarRate()
    const markup = await getConfig('markup', 30)
    const cashDiscount = await getConfig('cash_discount', 10)

    const result = await db.execute(
      `SELECT p.*, c.name as categoryName 
       FROM products p 
       LEFT JOIN categories c ON p.categoryId = c.id 
       ORDER BY p.createdAt DESC`
    )

    // Calculate prices based on dollar for products that have costPrice (USD)
    const products = (result.rows as any[]).map(p => {
      if (p.costPrice && p.costPrice > 0) {
        // Auto-calculate from USD cost
        const calculatedListPrice = Math.ceil(p.costPrice * dollar.rate * (1 + markup / 100))
        const calculatedCashPrice = Math.ceil(calculatedListPrice * (1 - cashDiscount / 100))
        return {
          ...p,
          price: calculatedListPrice,
          comparePrice: calculatedCashPrice,
          _calculated: true,
          _dollarRate: dollar.rate,
        }
      }
      // Manual pricing (no USD cost set)
      return { ...p, _calculated: false, _dollarRate: dollar.rate }
    })

    return NextResponse.json({
      ok: true,
      products,
      dollarRate: dollar.rate,
      markup,
      cashDiscount,
    })
  } catch (error) {
    console.error('Get products error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name, description, price, comparePrice, costPrice, sku, stock,
      isActive, isFeatured, images, specs, providerId, providerSku, categoryId,
    } = body

    console.log('[products POST] Received images:', images, 'type:', typeof images)

    if (!name) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      )
    }

    // Either costPrice (USD) or price (ARS) must be provided
    const hasCostPrice = costPrice && Number(costPrice) > 0
    const hasManualPrice = price !== undefined && Number(price) > 0

    if (!hasCostPrice && !hasManualPrice) {
      return NextResponse.json(
        { error: 'Debés ingresar el costo en USD o el precio de lista' },
        { status: 400 }
      )
    }

    const id = crypto.randomUUID()
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Check slug uniqueness
    const existing = await db.execute({
      sql: 'SELECT id FROM products WHERE slug = ?',
      args: [slug],
    })
    const finalSlug = existing.rows.length > 0 ? `${slug}-${Date.now()}` : slug

    const now = new Date().toISOString()

    // Calculate prices
    let finalPrice: number
    let finalComparePrice: number | null

    if (hasCostPrice) {
      // Auto-calculate from USD cost + dollar rate + markup
      const dollar = await fetchDollarRate()
      const markup = await getConfig('markup', 30)
      const cashDiscount = await getConfig('cash_discount', 10)

      finalPrice = Math.ceil(Number(costPrice) * dollar.rate * (1 + markup / 100))
      finalComparePrice = Math.ceil(finalPrice * (1 - cashDiscount / 100))
    } else {
      // Manual pricing
      finalPrice = Number(price)
      finalComparePrice = comparePrice ? Number(comparePrice) : null
    }

    await db.execute({
      sql: `INSERT INTO products (id, name, slug, description, price, comparePrice, costPrice, sku, stock, isActive, isFeatured, images, specs, providerId, providerSku, categoryId, createdAt, updatedAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, name, finalSlug, description || null,
        finalPrice, finalComparePrice,
        hasCostPrice ? Number(costPrice) : null, sku || null,
        stock !== undefined ? Number(stock) : 0,
        isActive !== undefined ? (isActive ? 1 : 0) : 1,
        isFeatured !== undefined ? (isFeatured ? 1 : 0) : 0,
        images || '[]', specs || '{}',
        providerId || null, providerSku || null,
        categoryId || null, now, now,
      ],
    })

    return NextResponse.json({ ok: true, product: { id, slug: finalSlug } })
  } catch (error) {
    console.error('Create product error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, description, price, comparePrice, costPrice, sku, stock,
      isActive, isFeatured, images, specs, providerId, providerSku, categoryId } = body

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Calculate prices
    const hasCostPrice = costPrice && Number(costPrice) > 0
    let finalPrice: number | undefined = price !== undefined ? Number(price) : undefined
    let finalComparePrice: number | null | undefined = comparePrice !== undefined ? (comparePrice ? Number(comparePrice) : null) : undefined

    if (hasCostPrice) {
      // Auto-calculate from USD cost + dollar rate + markup
      const dollar = await fetchDollarRate()
      const markup = await getConfig('markup', 30)
      const cashDiscount = await getConfig('cash_discount', 10)

      finalPrice = Math.ceil(Number(costPrice) * dollar.rate * (1 + markup / 100))
      finalComparePrice = Math.ceil(finalPrice * (1 - cashDiscount / 100))
    }

    const fields: string[] = []
    const values: any[] = []

    if (name !== undefined) { fields.push('name = ?'); values.push(name) }
    if (description !== undefined) { fields.push('description = ?'); values.push(description) }
    if (finalPrice !== undefined) { fields.push('price = ?'); values.push(finalPrice) }
    if (finalComparePrice !== undefined) { fields.push('comparePrice = ?'); values.push(finalComparePrice) }
    if (costPrice !== undefined) { fields.push('costPrice = ?'); values.push(hasCostPrice ? Number(costPrice) : null) }
    if (sku !== undefined) { fields.push('sku = ?'); values.push(sku) }
    if (stock !== undefined) { fields.push('stock = ?'); values.push(Number(stock)) }
    if (isActive !== undefined) { fields.push('isActive = ?'); values.push(isActive ? 1 : 0) }
    if (isFeatured !== undefined) { fields.push('isFeatured = ?'); values.push(isFeatured ? 1 : 0) }
    if (images !== undefined) { fields.push('images = ?'); values.push(images) }
    if (specs !== undefined) { fields.push('specs = ?'); values.push(specs) }
    if (providerId !== undefined) { fields.push('providerId = ?'); values.push(providerId) }
    if (providerSku !== undefined) { fields.push('providerSku = ?'); values.push(providerSku) }
    if (categoryId !== undefined) { fields.push('categoryId = ?'); values.push(categoryId) }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    fields.push('updatedAt = ?')
    values.push(now)
    values.push(id)

    await db.execute({
      sql: `UPDATE products SET ${fields.join(', ')} WHERE id = ?`,
      args: values,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Update product error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    await db.execute({
      sql: 'DELETE FROM products WHERE id = ?',
      args: [id],
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete product error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
