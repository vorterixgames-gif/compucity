import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchDollarRate } from '@/lib/dollar'
import {
  extractCompatibility,
  applyCompatibilityFilters,
  type CompatibilityFilters,
} from '@/lib/compatibility'

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

// Map component slots to category slugs
const COMPONENT_SLOTS: { slot: string; label: string; categorySlug: string }[] = [
  { slot: 'processor', label: 'Microprocesador', categorySlug: 'microprocesadores' },
  { slot: 'motherboard', label: 'Motherboard', categorySlug: 'motherboards' },
  { slot: 'ram', label: 'Memoria RAM', categorySlug: 'memorias-ram' },
  { slot: 'gpu', label: 'Placa de Video', categorySlug: 'placas-de-video' },
  { slot: 'ssd', label: 'Disco SSD', categorySlug: 'discos-ssd' },
  { slot: 'hdd', label: 'Disco HDD', categorySlug: 'discos-hdd' },
  { slot: 'psu', label: 'Fuente', categorySlug: 'fuentes' },
  { slot: 'case', label: 'Gabinete', categorySlug: 'gabinetes' },
  { slot: 'cooling', label: 'Refrigeración', categorySlug: 'refrigeracion' },
  { slot: 'thermal', label: 'Pasta Térmica', categorySlug: 'pastas-termicas' },
]

export async function GET(request: NextRequest) {
  try {
    const slot = request.nextUrl.searchParams.get('slot')

    const dollar = await fetchDollarRate()
    const markup = await getConfig('markup', 30)
    const cashDiscount = await getConfig('cash_discount', 10)

    // If requesting a specific slot, return products for that component category
    if (slot) {
      const slotConfig = COMPONENT_SLOTS.find(s => s.slot === slot)
      if (!slotConfig) {
        return NextResponse.json({ error: 'Componente no reconocido' }, { status: 400 })
      }

      // Find the category by slug
      const catResult = await db.execute({
        sql: 'SELECT id FROM categories WHERE slug = ?',
        args: [slotConfig.categorySlug],
      })
      const catRows = catResult.rows as any[]
      if (catRows.length === 0) {
        return NextResponse.json({ ok: true, products: [], slot: slotConfig, filters: {} })
      }

      const categoryId = catRows[0].id

      // Get active products in this category
      const result = await db.execute({
        sql: `SELECT p.id, p.name, p.slug, p.price, p.comparePrice, p.costPrice, p.images, p.stock, p.specs
              FROM products p
              WHERE p.categoryId = ? AND p.isActive = 1
              ORDER BY p.price ASC`,
        args: [categoryId],
      })

      const products = (result.rows as any[]).map(p => {
        if (p.costPrice && p.costPrice > 0) {
          const listPrice = Math.ceil(p.costPrice * dollar.rate * (1 + markup / 100))
          const cashPrice = Math.ceil(p.costPrice * dollar.rate * (1 + (markup - cashDiscount) / 100))
          return { ...p, price: listPrice, comparePrice: cashPrice, _calculated: true }
        }
        return { ...p, _calculated: false }
      })

      // Parse compatibility filters from query params
      const filters: CompatibilityFilters = {}
      const socketParam = request.nextUrl.searchParams.get('socket')
      const ddrParam = request.nextUrl.searchParams.get('ddr')
      const minWattageParam = request.nextUrl.searchParams.get('minWattage')
      const cpuTdpParam = request.nextUrl.searchParams.get('cpuTdp')

      if (socketParam) filters.socket = socketParam
      if (ddrParam) filters.ddr = ddrParam
      if (minWattageParam) filters.minWattage = parseInt(minWattageParam)
      if (cpuTdpParam) filters.cpuTdp = parseInt(cpuTdpParam)

      // Apply compatibility filters and enrich products with compat info
      const enrichedProducts = applyCompatibilityFilters(products, slot, filters)

      // Separate compatible and incompatible for sorting (compatible first)
      const compatible = enrichedProducts.filter(e => e.isCompatible)
      const incompatible = enrichedProducts.filter(e => !e.isCompatible)
      const sorted = [...compatible, ...incompatible]

      const finalProducts = sorted.map(({ product, compatInfo, isCompatible }) => ({
        ...product,
        compatInfo,
        isCompatible,
      }))

      return NextResponse.json({
        ok: true,
        products: finalProducts,
        slot: slotConfig,
        filters,
      })
    }

    // If no slot specified, return the list of available slots with counts
    const slotsWithCounts = await Promise.all(
      COMPONENT_SLOTS.map(async (s) => {
        try {
          const catResult = await db.execute({
            sql: 'SELECT id FROM categories WHERE slug = ?',
            args: [s.categorySlug],
          })
          const catRows = catResult.rows as any[]
          if (catRows.length === 0) return { ...s, count: 0 }

          const countResult = await db.execute({
            sql: 'SELECT COUNT(*) as total FROM products WHERE categoryId = ? AND isActive = 1',
            args: [catRows[0].id],
          })
          return { ...s, count: (countResult.rows[0] as any).total }
        } catch {
          return { ...s, count: 0 }
        }
      })
    )

    return NextResponse.json({ ok: true, slots: slotsWithCounts })
  } catch (error) {
    console.error('PC Builder API error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
