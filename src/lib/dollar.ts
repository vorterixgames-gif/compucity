import { db } from './db'

// DolarApi.com - free, no API key needed
const DOLAR_API_OFICIAL = 'https://dolarapi.com/v1/dolares/oficial'
const DOLAR_API_BLUE = 'https://dolarapi.com/v1/dolares/blue'

export interface DollarInfo {
  rate: number
  source: string
  compra: number | null
  venta: number | null
  fecha: string
  cached: boolean
}

export async function fetchDollarRate(): Promise<DollarInfo> {
  try {
    // Get configured source
    const sourceResult = await db.execute({
      sql: "SELECT value FROM store_config WHERE key = 'dollar_source'",
      args: [],
    })
    const sourceRow = sourceResult.rows as any[]
    const configSource = sourceRow[0] ? JSON.parse(sourceRow[0].value).value : 'nacion'

    // Fetch from DolarApi
    const apiUrl = configSource === 'blue' ? DOLAR_API_BLUE : DOLAR_API_OFICIAL
    const res = await fetch(apiUrl, {
      next: { revalidate: 3600 }, // cache 1 hour on Next.js side
    })

    if (!res.ok) throw new Error('DolarApi no responde')

    const data = await res.json()
    const rate = data.venta

    // Save to database
    const now = new Date().toISOString()
    const existing = await db.execute({
      sql: 'SELECT id FROM dollar_rates ORDER BY updatedAt DESC LIMIT 1',
      args: [],
    })

    if (existing.rows.length > 0) {
      await db.execute({
        sql: 'UPDATE dollar_rates SET rate = ?, source = ?, updatedAt = ? WHERE id = ?',
        args: [rate, configSource, now, (existing.rows[0] as any).id],
      })
    } else {
      const id = crypto.randomUUID()
      await db.execute({
        sql: 'INSERT INTO dollar_rates (id, rate, source, updatedAt) VALUES (?, ?, ?, ?)',
        args: [id, rate, configSource, now],
      })
    }

    return {
      rate,
      source: configSource === 'blue' ? 'Dólar Blue' : 'Banco Nación',
      compra: data.compra,
      venta: data.venta,
      fecha: data.fechaActualizacion,
      cached: false,
    }
  } catch {
    // Fallback: return stored rate from DB
    try {
      const result = await db.execute('SELECT * FROM dollar_rates ORDER BY updatedAt DESC LIMIT 1')
      const rows = result.rows as any[]
      if (rows.length > 0) {
        return {
          rate: rows[0].rate,
          source: rows[0].source + ' (cache)',
          compra: null,
          venta: rows[0].rate,
          fecha: rows[0].updatedAt,
          cached: true,
        }
      }
    } catch {}
    // Ultimate fallback
    return {
      rate: 1415,
      source: 'Fallback',
      compra: null,
      venta: 1415,
      fecha: new Date().toISOString(),
      cached: true,
    }
  }
}

export async function getStoreConfigNumber(key: string, defaultValue: number): Promise<number> {
  const result = await db.execute({
    sql: 'SELECT value FROM store_config WHERE key = ?',
    args: [key],
  })
  const rows = result.rows as any[]
  if (rows.length > 0) {
    try {
      const parsed = JSON.parse(rows[0].value)
      return Number(parsed.value) || defaultValue
    } catch {
      return defaultValue
    }
  }
  return defaultValue
}

// Calculate prices based on dollar rate
// costPrice (USD) × dollarRate × (1 + markup/100) = precio de lista
// precio de lista × (1 - cashDiscount/100) = precio en efectivo
export interface CalculatedPrices {
  dollarRate: number
  dollarSource: string
  markup: number
  cashDiscount: number
  listPrice: number    // precio de lista (ARS)
  cashPrice: number    // precio en efectivo (ARS)
}

export async function calculatePrices(costUsd: number): Promise<CalculatedPrices> {
  const dollar = await fetchDollarRate()
  const markup = await getStoreConfigNumber('markup', 30)
  const cashDiscount = await getStoreConfigNumber('cash_discount', 10)

  const listPrice = Math.ceil(costUsd * dollar.rate * (1 + markup / 100))
  const cashPrice = Math.ceil(listPrice * (1 - cashDiscount / 100))

  return {
    dollarRate: dollar.rate,
    dollarSource: dollar.source,
    markup,
    cashDiscount,
    listPrice,
    cashPrice,
  }
}

// Calculate product prices for display
export function calculateProductPrices(product: any, dollarRate: number, markup: number, cashDiscount: number) {
  if (product.costPrice && Number(product.costPrice) > 0) {
    const listPrice = Math.ceil(Number(product.costPrice) * dollarRate * (1 + markup / 100))
    const cashPrice = Math.ceil(listPrice * (1 - cashDiscount / 100))
    return {
      ...product,
      price: listPrice,
      comparePrice: cashPrice,
      _calculated: true,
      _costUsd: Number(product.costPrice),
    }
  }
  return { ...product, _calculated: false }
}
