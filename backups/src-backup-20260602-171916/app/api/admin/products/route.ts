import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchDollarRate } from '@/lib/dollar'
import { getCurrentAdmin } from '@/lib/admin-auth'

async function getConfig(key: string, defaultValue: number): Promise<number> {
  const result = await db.execute({
    sql: 'SELECT value FROM store_config WHERE key = ?',
    args: [key],
  })
  const rows = result.rows as any[]
  if (rows.length > 0) {
    try {
      const raw = rows[0].value
      try {
        const parsed = JSON.parse(raw)
        if (typeof parsed === 'object' && parsed !== null && 'value' in parsed) {
          return Number(parsed.value) || defaultValue
        }
        if (typeof parsed === 'number') return parsed || defaultValue
      } catch {
        // Not valid JSON, treat as plain string number
      }
      return Number(raw) || defaultValue
    } catch {
      return defaultValue
    }
  }
  return defaultValue
}

export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

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
        // Use product-level markup/discount if set, otherwise fall back to global
        const effectiveMarkup = p.markup != null ? Number(p.markup) : markup
        const effectiveCashDiscount = p.cashDiscount != null ? Number(p.cashDiscount) : cashDiscount
        const effectiveIvaRate = p.ivaRate != null ? Number(p.ivaRate) : 10.5
        // Auto-calculate from USD cost
        // costUSD × (1+IVA) × (1+markup) × dollarRate
        const calculatedListPrice = Math.ceil(p.costPrice * (1 + effectiveIvaRate / 100) * (1 + effectiveMarkup / 100) * dollar.rate)
        const calculatedCashPrice = Math.ceil(p.costPrice * (1 + effectiveIvaRate / 100) * (1 + (effectiveMarkup - effectiveCashDiscount) / 100) * dollar.rate)
        return {
          ...p,
          price: calculatedListPrice,
          comparePrice: calculatedCashPrice,
          _calculated: true,
          _dollarRate: dollar.rate,
          _effectiveMarkup: effectiveMarkup,
          _effectiveCashDiscount: effectiveCashDiscount,
          _effectiveIvaRate: effectiveIvaRate,
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
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const {
      name, description, price, comparePrice, costPrice, sku, stock,
      isActive, isFeatured, images, specs, providerId, providerSku, categoryId,
      markup, cashDiscount, ivaRate,
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
      const globalMarkup = await getConfig('markup', 30)
      const globalCashDiscount = await getConfig('cash_discount', 10)
      // Use product-level values if provided, otherwise use global
      const effectiveMarkup = markup != null && markup !== '' ? Number(markup) : globalMarkup
      const effectiveCashDiscount = cashDiscount != null && cashDiscount !== '' ? Number(cashDiscount) : globalCashDiscount
      let effectiveIvaRate = ivaRate != null && ivaRate !== '' ? Number(ivaRate) : 10.5

      // SAFEGUARD: Only allow valid IVA rates (10.5 or 21)
      if (isNaN(effectiveIvaRate) || ![10.5, 21].includes(effectiveIvaRate)) {
        console.warn(`[PRICE SAFETY] Invalid ivaRate ${ivaRate} for new product, defaulting to 10.5%`)
        effectiveIvaRate = 10.5
      }

      // costUSD × (1+IVA) × (1+markup) × dollarRate
      finalPrice = Math.ceil(Number(costPrice) * (1 + effectiveIvaRate / 100) * (1 + effectiveMarkup / 100) * dollar.rate)
      finalComparePrice = Math.ceil(Number(costPrice) * (1 + effectiveIvaRate / 100) * (1 + (effectiveMarkup - effectiveCashDiscount) / 100) * dollar.rate)
    } else {
      // Manual pricing
      finalPrice = Number(price)
      finalComparePrice = comparePrice ? Number(comparePrice) : null
    }

    await db.execute({
      sql: `INSERT INTO products (id, name, slug, description, price, comparePrice, costPrice, markup, cashDiscount, ivaRate, sku, stock, isActive, isFeatured, images, specs, providerId, providerSku, categoryId, createdAt, updatedAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, name, finalSlug, description || null,
        finalPrice, finalComparePrice,
        hasCostPrice ? Number(costPrice) : null,
        markup != null && markup !== '' ? Number(markup) : null,
        cashDiscount != null && cashDiscount !== '' ? Number(cashDiscount) : null,
        ivaRate != null && ivaRate !== '' ? Number(ivaRate) : 10.5,
        sku || null,
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
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id, name, description, price, comparePrice, costPrice, sku, stock,
      isActive, isFeatured, images, specs, providerId, providerSku, categoryId,
      markup, cashDiscount, ivaRate } = body

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Determine if we need to recalculate prices
    // Recalculate when: costPrice is set OR markup/cashDiscount changed on a product with costPrice
    const hasCostPrice = costPrice && Number(costPrice) > 0
    const markupChanged = markup !== undefined
    const discountChanged = cashDiscount !== undefined
    const needRecalc = hasCostPrice || markupChanged || discountChanged

    let finalPrice: number | undefined = price !== undefined ? Number(price) : undefined
    let finalComparePrice: number | null | undefined = comparePrice !== undefined ? (comparePrice ? Number(comparePrice) : null) : undefined

    if (needRecalc) {
      // Get the product's current costPrice if not provided in this request
      let effectiveCostPrice = hasCostPrice ? Number(costPrice) : 0
      
      if (!hasCostPrice && (markupChanged || discountChanged)) {
        // Fetch current costPrice from DB since it wasn't sent
        const currentProduct = await db.execute({
          sql: 'SELECT costPrice, markup, cashDiscount FROM products WHERE id = ?',
          args: [id],
        })
        const rows = currentProduct.rows as any[]
        if (rows.length > 0 && rows[0].costPrice && Number(rows[0].costPrice) > 0) {
          effectiveCostPrice = Number(rows[0].costPrice)
        }
      }

      if (effectiveCostPrice > 0) {
        // Auto-calculate from USD cost + dollar rate + markup
        const dollar = await fetchDollarRate()
        const globalMarkup = await getConfig('markup', 30)
        const globalCashDiscount = await getConfig('cash_discount', 10)

        // Determine effective markup: use product-level if provided, otherwise use existing or global
        let effectiveMarkup = globalMarkup
        if (markup != null && markup !== '') {
          effectiveMarkup = Number(markup)
        } else if (markup === null || markup === '') {
          // User cleared the individual markup, use global
          effectiveMarkup = globalMarkup
        } else if (markup === undefined) {
          // markup not sent in request - check if product has individual value
          if (hasCostPrice) {
            // New costPrice being set, use global unless markup was provided
            effectiveMarkup = globalMarkup
          }
          // Otherwise keep current behavior
        }

        let effectiveCashDiscount = globalCashDiscount
        if (cashDiscount != null && cashDiscount !== '') {
          effectiveCashDiscount = Number(cashDiscount)
        } else if (cashDiscount === null || cashDiscount === '') {
          effectiveCashDiscount = globalCashDiscount
        }

        const dollarRate = dollar?.rate || 1415
        let effectiveIvaRate = ivaRate != null && ivaRate !== '' ? Number(ivaRate) : 10.5

        // SAFEGUARD: Only allow valid IVA rates (10.5 or 21)
        if (isNaN(effectiveIvaRate) || ![10.5, 21].includes(effectiveIvaRate)) {
          console.warn(`[PRICE SAFETY] Invalid ivaRate ${ivaRate} for product ${id}, defaulting to 10.5%`)
          effectiveIvaRate = 10.5
        }

        finalPrice = Math.ceil(effectiveCostPrice * dollarRate * (1 + effectiveMarkup / 100) * (1 + effectiveIvaRate / 100))
        finalComparePrice = Math.ceil(effectiveCostPrice * dollarRate * (1 + (effectiveMarkup - effectiveCashDiscount) / 100) * (1 + effectiveIvaRate / 100))
      }
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
    if (markup !== undefined) { fields.push('markup = ?'); values.push(markup != null && markup !== '' ? Number(markup) : null) }
    if (cashDiscount !== undefined) { fields.push('cashDiscount = ?'); values.push(cashDiscount != null && cashDiscount !== '' ? Number(cashDiscount) : null) }
    if (ivaRate !== undefined) {
      const parsedIva = ivaRate != null && ivaRate !== '' ? Number(ivaRate) : 10.5
      // SAFEGUARD: Only store valid IVA rates in the database
      const safeIva = (isNaN(parsedIva) || ![10.5, 21].includes(parsedIva)) ? 10.5 : parsedIva
      fields.push('ivaRate = ?'); values.push(safeIva)
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    fields.push('updatedAt = ?')
    values.push(now)
    values.push(id)

    console.log('[products PUT] Updating product', id, 'fields:', fields.join(', '))
    await db.execute({
      sql: `UPDATE products SET ${fields.join(', ')} WHERE id = ?`,
      args: values,
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Update product error:', error)
    const errorMessage = error?.message || 'Error del servidor'
    return NextResponse.json({ error: 'Error del servidor', detail: errorMessage }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

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
