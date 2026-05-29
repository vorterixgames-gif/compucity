import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchDollarRate, calculatePrices } from '@/lib/dollar'

export async function GET() {
  try {
    const dollar = await fetchDollarRate()
    const markup = await getConfig('markup', 30)
    const cashDiscount = await getConfig('cash_discount', 10)

    return NextResponse.json({
      ok: true,
      dollar: {
        rate: dollar.rate,
        source: dollar.source,
        compra: dollar.compra,
        venta: dollar.venta,
        fecha: dollar.fecha,
        cached: dollar.cached,
      },
      config: {
        markup,
        cashDiscount,
      },
      ejemplo: {
        costoUsd: 100,
        precioLista: Math.ceil(100 * dollar.rate * (1 + markup / 100)),
        precioEfectivo: Math.ceil(100 * dollar.rate * (1 + markup / 100) * (1 - cashDiscount / 100)),
      },
    })
  } catch (error) {
    console.error('Dolar API error:', error)
    return NextResponse.json({ ok: false, error: 'Error al obtener cotización' }, { status: 500 })
  }
}

async function getConfig(key: string, defaultValue: number): Promise<number> {
  const result = await db.execute({
    sql: 'SELECT value FROM store_config WHERE key = ?',
    args: [key],
  })
  const rows = result.rows as any[]
  if (rows.length > 0) {
    try {
      const raw = rows[0].value
      // Try JSON format first: {"value": 30}
      try {
        const parsed = JSON.parse(raw)
        if (typeof parsed === 'object' && parsed !== null && 'value' in parsed) {
          return Number(parsed.value) || defaultValue
        }
        // Parsed as a number directly (e.g. JSON.parse("30") = 30)
        if (typeof parsed === 'number') return parsed || defaultValue
      } catch {
        // Not valid JSON, treat as plain string number
      }
      // Plain string number: "30"
      return Number(raw) || defaultValue
    } catch {
      return defaultValue
    }
  }
  return defaultValue
}
