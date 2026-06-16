import { db } from './db'

// ─── Fuentes de cotización ─────────────────────────────────────────────────
// Sesión 43: cambiado de DolarApi.com a Bluelytics.
// DolarApi.com dejó de actualizar el 12/6/2026 (datos stale 4+ días),
// lo que causaba que el sitio mostrara cotizaciones viejas vs el Banco Nación.
// Bluelytics actualiza cada ~1h y es la API más usada por e-commerce argentino.
//
// Formato de respuesta Bluelytics:
//   {
//     "oficial": { "value_avg": 1429, "value_sell": 1454, "value_buy": 1404 },
//     "blue":     { "value_avg": 1460, "value_sell": 1470, "value_buy": 1450 },
//     "last_update": "2026-06-16T18:45:54-03:00"
//   }
const DOLAR_API_OFICIAL = 'https://api.bluelytics.com.ar/v2/latest'
const DOLAR_API_BLUE = 'https://api.bluelytics.com.ar/v2/latest' // misma URL, usamos el campo "blue"

// ─── Caché en memoria (sesión 43) ──────────────────────────────────────────
// fetchDollarRate se llama en TODAS las queries de productos (home, categorías,
// detalle, búsqueda, PC Builder, etc). Sin caché, cada request del storefront
// hace 1 SELECT a store_config + 1 fetch externo + 1 SELECT + 1 UPDATE a
// dollar_rates = 3 queries Turso por request. Con este caché de 5 min, las
// queries se reducen a 3 cada 5 min por cold start del serverless.
const DOLLAR_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos
let dollarCache: { data: DollarInfo; expiresAt: number } | null = null

export interface DollarInfo {
  rate: number
  source: string
  compra: number | null
  venta: number | null
  fecha: string
  cached: boolean
}

export async function fetchDollarRate(): Promise<DollarInfo> {
  // 1. Caché en memoria (sin tocar Turso)
  const now = Date.now()
  if (dollarCache && dollarCache.expiresAt > now) {
    return dollarCache.data
  }

  try {
    // 2. Leer fuente configurada desde store_config
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

    // 3. Fetch a Bluelytics (cacheado 15 min por Next.js además del caché en memoria)
    const res = await fetch(DOLAR_API_OFICIAL, {
      next: { revalidate: 900 },
    })
    if (!res.ok) throw new Error('Bluelytics no responde')

    const data = await res.json()
    // Bluelytics tiene un solo endpoint con oficial + blue adentro
    const dolarData = configSource === 'blue' ? data.blue : data.oficial
    const rate = dolarData.value_sell
    const compra = dolarData.value_buy
    const venta = dolarData.value_sell
    const fecha = data.last_update

    // 4. Guardar en DB (UPDATE si existe, INSERT si no)
    const nowIso = new Date().toISOString()
    const existing = await db.execute({
      sql: 'SELECT id FROM dollar_rates ORDER BY updatedAt DESC LIMIT 1',
      args: [],
    })

    if (existing.rows.length > 0) {
      await db.execute({
        sql: 'UPDATE dollar_rates SET rate = ?, source = ?, compra = ?, venta = ?, updatedAt = ? WHERE id = ?',
        args: [rate, configSource, compra, venta, nowIso, (existing.rows[0] as any).id],
      })
    } else {
      const id = crypto.randomUUID()
      await db.execute({
        sql: 'INSERT INTO dollar_rates (id, rate, source, compra, venta, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        args: [id, rate, configSource, compra, venta, nowIso],
      })
    }

    const result: DollarInfo = {
      rate,
      source: configSource === 'blue' ? 'Dólar Blue' : 'Banco Nación',
      compra,
      venta,
      fecha,
      cached: false,
    }

    // 5. Guardar en caché en memoria
    dollarCache = { data: result, expiresAt: now + DOLLAR_CACHE_TTL_MS }

    return result
  } catch {
    // Fallback: devolver valor guardado en DB
    try {
      const result = await db.execute('SELECT * FROM dollar_rates ORDER BY updatedAt DESC LIMIT 1')
      const rows = result.rows as any[]
      if (rows.length > 0) {
        const fallback: DollarInfo = {
          rate: rows[0].rate,
          source: rows[0].source + ' (cache)',
          compra: null,
          venta: rows[0].rate,
          fecha: rows[0].updatedAt,
          cached: true,
        }
        // Cachear también el fallback por 1 min para no spammear DB si la API cae
        dollarCache = { data: fallback, expiresAt: now + 60_000 }
        return fallback
      }
    } catch {}
    // Ultimate fallback
    const ultimate: DollarInfo = {
      rate: 1415,
      source: 'Fallback',
      compra: null,
      venta: 1415,
      fecha: new Date().toISOString(),
      cached: true,
    }
    return ultimate
  }
}

/** Invalida el caché en memoria del dolar (ej: al cambiar dollar_source desde el admin) */
export function __clearDollarCache(): void {
  dollarCache = null
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
// Priority: product individual > category > global
// SAFEGUARDS: validates all inputs to prevent pricing errors that could cost the business money
const VALID_IVA_RATES = [10.5, 21] // Only allowed IVA percentages
const SAFE_DEFAULT_IVA = 10.5       // Fallback if ivaRate is invalid/missing
const MIN_DOLLAR_RATE = 100          // Minimum reasonable dollar rate (safety net)
const MAX_MARKUP = 500               // Maximum markup percentage allowed

export interface CategoryMarkup {
  markup: number | null
  cashDiscount: number | null
  ivaRate: number | null
}

export function calculateProductPrices(
  product: any,
  dollarRate: number,
  globalMarkup: number,
  globalCashDiscount: number,
  categoryMarkup?: CategoryMarkup | null
) {
  if (product.costPrice && Number(product.costPrice) > 0) {
    // PRIORITY: product individual > category > global
    // Markup
    let markup: number
    let markupSource: 'product' | 'category' | 'global'

    if (product.markup != null) {
      markup = Number(product.markup)
      markupSource = 'product'
    } else if (categoryMarkup?.markup != null) {
      markup = Number(categoryMarkup.markup)
      markupSource = 'category'
    } else {
      markup = globalMarkup
      markupSource = 'global'
    }

    // Cash discount - same priority
    let cashDiscount: number
    let cashDiscountSource: 'product' | 'category' | 'global'

    if (product.cashDiscount != null) {
      cashDiscount = Number(product.cashDiscount)
      cashDiscountSource = 'product'
    } else if (categoryMarkup?.cashDiscount != null) {
      cashDiscount = Number(categoryMarkup.cashDiscount)
      cashDiscountSource = 'category'
    } else {
      cashDiscount = globalCashDiscount
      cashDiscountSource = 'global'
    }

    // IVA rate - same priority: product → category → default
    let ivaRate: number
    let ivaRateSource: 'product' | 'category' | 'default'

    if (product.ivaRate != null) {
      ivaRate = Number(product.ivaRate)
      ivaRateSource = 'product'
    } else if (categoryMarkup?.ivaRate != null) {
      ivaRate = Number(categoryMarkup.ivaRate)
      ivaRateSource = 'category'
    } else {
      ivaRate = SAFE_DEFAULT_IVA
      ivaRateSource = 'default'
    }

    // SAFEGUARD: Validate IVA rate - must be 10.5 or 21, never 0 or invalid
    if (isNaN(ivaRate) || !VALID_IVA_RATES.includes(ivaRate)) {
      console.warn(`[PRICE SAFETY] Invalid ivaRate ${product.ivaRate} for product "${product.name}" (${product.id}), falling back to ${SAFE_DEFAULT_IVA}%`)
      ivaRate = SAFE_DEFAULT_IVA
    }

    // SAFEGUARD: Validate markup - prevent accidentally selling at loss
    if (isNaN(markup) || markup < 0) {
      console.warn(`[PRICE SAFETY] Invalid markup ${markup} for product "${product.name}" (${product.id}), falling back to global ${globalMarkup}%`)
      markup = globalMarkup
      markupSource = 'global'
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
      salePrice: product.salePrice != null ? Number(product.salePrice) : null,
      saleStart: product.saleStart || null,
      saleEnd: product.saleEnd || null,
      _calculated: true,
      _costUsd: Number(product.costPrice),
      _effectiveMarkup: markup,
      _effectiveCashDiscount: cashDiscount,
      _effectiveIvaRate: ivaRate,
      _markupSource: markupSource,
      _cashDiscountSource: cashDiscountSource,
      _ivaRateSource: ivaRateSource,
    }
  }
  return {
    ...product,
    salePrice: product.salePrice != null ? Number(product.salePrice) : null,
    saleStart: product.saleStart || null,
    saleEnd: product.saleEnd || null,
    _calculated: false,
  }
}
