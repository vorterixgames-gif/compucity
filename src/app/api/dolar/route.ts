import { NextResponse } from 'next/server'
import { fetchDollarRate, getStoreConfigNumber } from '@/lib/dollar'

// Sesión 43 día 2: cache 5 min en CDN. El dolar cambia ~1 vez por hora
// (Bluelytics), y fetchDollarRate ya tiene su propio caché memoria de 15 min.
// 5 min de CDN cache evita que cada visitante dispare queries a store_config.
export const revalidate = 300

export async function GET() {
  try {
    const dollar = await fetchDollarRate()
    // Sesión 44: usar getStoreConfigNumber cacheado (5 min) en vez de getConfig local sin cache.
    // Antes: 2 queries a store_config por request. Ahora: 0 (después del primer hit).
    const markup = await getStoreConfigNumber('markup', 30)
    const cashDiscount = await getStoreConfigNumber('cash_discount', 10)

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
        precioLista: Math.ceil(100 * (1 + 10.5 / 100) * (1 + markup / 100) * dollar.rate),
        precioEfectivo: Math.ceil(100 * (1 + 10.5 / 100) * (1 + (markup - cashDiscount) / 100) * dollar.rate),
        nota: 'Fórmula: costUSD × (1+IVA) × (1+markup) × dollarRate',
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    })
  } catch (error) {
    console.error('Dolar API error:', error)
    return NextResponse.json({ ok: false, error: 'Error al obtener cotización' }, { status: 500 })
  }
}
