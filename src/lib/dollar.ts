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
    const configSource = (() => {
      if (!sourceRow[0]) return 'nacion'
      const raw = sourceRow[0].value
      try {
        const parsed = JSON.parse(raw)
        if (typeof parsed === 'object' && parsed !== null && 'value' in parsed) return parsed.value
        if (typeof parsed === 'string') return parsed
      } catch {
        // Not valid JSON
      }
      return raw || 'nacion'
    })()

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
        sql: 'UPDATE dollar_rates SET rate = ?, source = ?, compra = ?, venta = ?, updatedAt = ? WHERE id = ?',
        args: [rate, configSource, data.compra, data.venta, now, (existing.rows[0] as any).id],
      })
    } else {
      const id = crypto.randomUUID()
      await db.execute({
        sql: 'INSERT INTO dollar_rates (id, rate, source, compra, venta, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        args: [id, rate, configSource, data.compra, data.venta, now],
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

// Calculate prices based on dollar rate
// costPrice (USD sin IVA) × (1 + ivaRate/100) = precio USD con IVA
// precio USD con IVA × (1 + markup/100) = precio USD con markup
// precio USD con markup × dollarRate = precio de lista en ARS (IVA incluido)
// Para efectivo: se aplica (1 + (markup - cashDiscount)/100) en lugar de (1 + markup/100)
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

  const ivaRate = await getStoreConfigNumber('default_iva_rate', 10.5)
  const listPrice = Math.ceil(costUsd * (1 + ivaRate / 100) * (1 + markup / 100) * dollar.rate)
  const cashPrice = Math.ceil(costUsd * (1 + ivaRate / 100) * (1 + (markup - cashDiscount) / 100) * dollar.rate)

  return {
    dollarRate: dollar.rate,
    dollarSource: dollar.source,
    markup,
    cashDiscount,
    listPrice,
    cashPrice,
  }
}

// Calculate product prices for display (IVA incluido)
// If the product has individual markup/cashDiscount/ivaRate, use those; otherwise fall back to global values
// SAFEGUARDS: validates all inputs to prevent pricing errors that could cost the business money
const VALID_IVA_RATES = [10.5, 21] // Only allowed IVA percentages
const SAFE_DEFAULT_IVA = 10.5       // Fallback if ivaRate is invalid/missing
const MIN_DOLLAR_RATE = 100          // Minimum reasonable dollar rate (safety net)
const MAX_MARKUP = 500               // Maximum markup percentage allowed

export function calculateProductPrices(product: any, dollarRate: number, globalMarkup: number, globalCashDiscount: number) {
  if (product.costPrice && Number(product.costPrice) > 0) {
    // Use product-level markup/discount/iva if set, otherwise use global/defaults
    let markup = product.markup != null ? Number(product.markup) : globalMarkup
    const cashDiscount = product.cashDiscount != null ? Number(product.cashDiscount) : globalCashDiscount
    let ivaRate = product.ivaRate != null ? Number(product.ivaRate) : SAFE_DEFAULT_IVA

    // SAFEGUARD: Validate IVA rate - must be 10.5 or 21, never 0 or invalid
    if (isNaN(ivaRate) || !VALID_IVA_RATES.includes(ivaRate)) {
      console.warn(`[PRICE SAFETY] Invalid ivaRate ${product.ivaRate} for product "${product.name}" (${product.id}), falling back to ${SAFE_DEFAULT_IVA}%`)
      ivaRate = SAFE_DEFAULT_IVA
    }

    // SAFEGUARD: Validate markup - prevent accidentally selling at loss
    if (isNaN(markup) || markup < 0) {
      console.warn(`[PRICE SAFETY] Invalid markup ${markup} for product "${product.name}" (${product.id}), falling back to global ${globalMarkup}%`)
      markup = globalMarkup
    }
    if (markup > MAX_MARKUP) {
      console.warn(`[PRICE SAFETY] Suspicious markup ${markup}% for product "${product.name}" (${product.id}), capping at ${MAX_MARKUP}%`)
      markup = MAX_MARKUP
    }

    // SAFEGUARD: Validate dollar rate - prevent broken prices if API fails
    if (isNaN(dollarRate) || dollarRate < MIN_DOLLAR_RATE) {
      console.error(`[PRICE SAFETY] Invalid dollar rate ${dollarRate}, skipping calculation for "${product.name}" (${product.id})`)
      return { ...product, _calculated: false, _priceError: 'Dollar rate invalid' }
    }

    const listPrice = Math.ceil(Number(product.costPrice) * (1 + ivaRate / 100) * (1 + markup / 100) * dollarRate)
    const cashPrice = Math.ceil(Number(product.costPrice) * (1 + ivaRate / 100) * (1 + (markup - cashDiscount) / 100) * dollarRate)

    // SAFEGUARD: Prices must be positive
    if (listPrice <= 0 || cashPrice <= 0) {
      console.error(`[PRICE SAFETY] Calculated price is <= 0 for "${product.name}" (${product.id}): list=${listPrice}, cash=${cashPrice}`)
      return { ...product, _calculated: false, _priceError: 'Price calculation resulted in <= 0' }
    }

    return {
      ...product,
      price: listPrice,
      comparePrice: cashPrice,
      _calculated: true,
      _costUsd: Number(product.costPrice),
      _effectiveMarkup: markup,
      _effectiveCashDiscount: cashDiscount,
      _effectiveIvaRate: ivaRate,
    }
  }
  return { ...product, _calculated: false }
}
