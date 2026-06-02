import { NextRequest, NextResponse } from 'next/server'
import { calculateShipping, estimateShippingWeight, DEFAULT_ORIGIN_CP, ShippingQuote } from '@/lib/shipping'
import { quoteDomicilio as andreaniQuoteDomicilio, quoteSucursal as andreaniQuoteSucursal, parseAndreaniCredentials, clearAndreaniTokenCache } from '@/lib/andreani'
import { quote as correoQuote, parseCorreoCredentials, clearCorreoTokenCache } from '@/lib/correo-argentino'
import { db } from '@/lib/db'

async function getConfigValue(key: string, fallback: string): Promise<string> {
  try {
    const result = await db.execute({
      sql: 'SELECT value FROM store_config WHERE key = ?',
      args: [key],
    })
    const rows = result.rows as any[]
    if (rows.length > 0) {
      try {
        const parsed = JSON.parse(rows[0].value)
        if (typeof parsed === 'object' && parsed.value !== undefined) {
          return String(parsed.value)
        }
        return String(parsed)
      } catch {
        return rows[0].value || fallback
      }
    }
  } catch {
    // Table might not exist yet
  }
  return fallback
}

async function getAllConfig(): Promise<Record<string, string>> {
  try {
    const result = await db.execute('SELECT * FROM store_config')
    const config: Record<string, string> = {}
    for (const row of result.rows as any[]) {
      config[row.key] = row.value
    }
    return config
  } catch {
    return {}
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const destinationCP = searchParams.get('cp')?.trim() || ''
    const weightKg = parseFloat(searchParams.get('weight') || '0')
    const itemCount = parseInt(searchParams.get('items') || '1')
    const isRetiro = searchParams.get('retiro') === 'true'

    // Retiro en local
    if (isRetiro) {
      const quotes = calculateShipping({
        originCP: DEFAULT_ORIGIN_CP,
        destinationCP: DEFAULT_ORIGIN_CP,
        weightKg: 1,
        isRetiro: true,
      })
      return NextResponse.json({ ok: true, quotes })
    }

    // Validar código postal
    if (!destinationCP || !/^\d{4,5}$/.test(destinationCP.replace(/\s/g, ''))) {
      return NextResponse.json(
        { ok: false, error: 'Ingresá un código postal válido (4 o 5 dígitos)' },
        { status: 400 }
      )
    }

    // Get all config at once
    const config = await getAllConfig()

    // Parse config values
    const originCP = config.origin_cp || DEFAULT_ORIGIN_CP
    const shippingMarkup = parseFloat(config.shipping_markup || '0') || 0
    const weightPerItem = parseFloat(config.weight_per_item || '2') || 2
    const finalWeight = weightKg > 0 ? weightKg : estimateShippingWeight(
      Array.from({ length: itemCount }, () => ({ name: '', quantity: 1 })),
      weightPerItem
    )

    const cleanDestCP = destinationCP.replace(/\s/g, '')
    const quotes: ShippingQuote[] = []
    let usedRealAPI = false

    // =============================================
    // INTENTAR API REAL DE ANDREANI
    // =============================================
    const andreaniCreds = parseAndreaniCredentials(config)
    if (andreaniCreds) {
      try {
        const [domicilioResult, sucursalResult] = await Promise.all([
          andreaniQuoteDomicilio(andreaniCreds, {
            cpDestino: parseInt(cleanDestCP),
            pesoKg: finalWeight,
            valorDeclarado: 0,
          }),
          andreaniCreds.contratoSucursal
            ? andreaniQuoteSucursal(andreaniCreds, {
                cpDestino: parseInt(cleanDestCP),
                pesoKg: finalWeight,
                valorDeclarado: 0,
              })
            : Promise.resolve(null),
        ])

        if (domicilioResult) {
          usedRealAPI = true
          quotes.push({
            carrier: 'andreani',
            carrierName: 'Andreani',
            service: 'estandar',
            serviceName: 'Andreani a Domicilio',
            price: Math.ceil(domicilioResult.tarifaConIva),
            estimatedDays: '3-7 días hábiles',
            description: 'Envío a domicilio con seguimiento',
          })
        }

        if (sucursalResult) {
          usedRealAPI = true
          quotes.push({
            carrier: 'andreani',
            carrierName: 'Andreani',
            service: 'sucursal',
            serviceName: 'Andreani a Sucursal',
            price: Math.ceil(sucursalResult.tarifaConIva),
            estimatedDays: '3-7 días hábiles',
            description: 'Retiro en sucursal Andreani con seguimiento',
          })
        }
      } catch (error) {
        console.error('[Shipping] Andreani API error, falling back:', error)
      }
    }

    // =============================================
    // INTENTAR API REAL DE CORREO ARGENTINO
    // =============================================
    const correoCreds = parseCorreoCredentials(config)
    if (correoCreds) {
      try {
        const correoResult = await correoQuote(correoCreds, {
          cpOrigen: originCP,
          cpDestino: cleanDestCP,
          pesoGramos: Math.ceil(finalWeight * 1000),
          largoCm: 30,
          anchoCm: 20,
          altoCm: 10,
        })

        if (correoResult && correoResult.rates.length > 0) {
          usedRealAPI = true
          for (const rate of correoResult.rates) {
            // D=Domicilio, S=Sucursal
            const isDomicilio = rate.deliveredType === 'D'
            const isExpress = rate.productType === 'EP'

            quotes.push({
              carrier: 'correo_argentino',
              carrierName: 'Correo Argentino',
              service: isDomicilio ? 'estandar' : 'sucursal',
              serviceName: `${rate.productName} ${isDomicilio ? 'a Domicilio' : 'en Sucursal'}`,
              price: Math.ceil(rate.price),
              estimatedDays: rate.deliveryTimeMin && rate.deliveryTimeMax
                ? `${rate.deliveryTimeMin}-${rate.deliveryTimeMax} días hábiles`
                : (isExpress ? '3-5 días hábiles' : '5-8 días hábiles'),
              description: `Envío por Correo Argentino con seguimiento${isExpress ? ' (Express)' : ''}`,
            })
          }
        }
      } catch (error) {
        console.error('[Shipping] Correo Argentino API error, falling back:', error)
      }
    }

    // =============================================
    // FALLBACK: TABLAS DE TARIFAS SI NO HAY API REAL
    // =============================================
    if (!usedRealAPI) {
      const fallbackQuotes = calculateShipping({
        originCP,
        destinationCP: cleanDestCP,
        weightKg: finalWeight,
        isRetiro: false,
      })
      quotes.push(...fallbackQuotes)
    }

    // Aplicar markup si está configurado
    const finalQuotes = shippingMarkup > 0
      ? quotes.map(q => ({
          ...q,
          price: Math.ceil(q.price * (1 + shippingMarkup / 100)),
        }))
      : quotes

    return NextResponse.json({
      ok: true,
      quotes: finalQuotes,
      weight: finalWeight,
      originCP,
      source: usedRealAPI ? 'api' : 'table',
    })
  } catch (error) {
    console.error('Shipping calculation error:', error)
    return NextResponse.json({ ok: false, error: 'Error al calcular el envío' }, { status: 500 })
  }
}
