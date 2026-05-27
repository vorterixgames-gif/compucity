// ============================================
// CALCULADORA DE ENVÍOS - CompuCity
// Soporta: Andreani + Correo Argentino
// Basado en zonas según código postal
// ============================================

// Zonas de Argentina según primer dígito del CP
// 1: CABA y GBA
// 2: Buenos Aires (interior)
// 3: Entre Ríos, Santa Fe
// 4: Córdoba
// 5: San Juan, San Luis, Mendoza
// 6: Catamarca, La Rioja, Santiago del Estero, Tucumán
// 7: Chaco, Corrientes, Formosa, Misiones
// 8: La Pampa, Neuquén, Río Negro
// 9: Chubut, Santa Cruz, Tierra del Fuego

export type ShippingCarrier = 'andreani' | 'correo_argentino'
export type ShippingService = 'estandar' | 'urgente' | 'retiro'

export interface ShippingQuote {
  carrier: ShippingCarrier
  carrierName: string
  service: ShippingService
  serviceName: string
  price: number
  estimatedDays: string
  description: string
}

export interface ShippingCalcParams {
  originCP: string       // CP de origen (ej: "5172" para La Falda)
  destinationCP: string  // CP de destino
  weightKg: number       // Peso en kg
  isRetiro: boolean      // Retiro en local
}

// Rangos de peso para las tarifas (en kg)
type WeightBracket = '0-1' | '1-5' | '5-10' | '10-15' | '15-20' | '20-30'

function getWeightBracket(weightKg: number): WeightBracket {
  if (weightKg <= 1) return '0-1'
  if (weightKg <= 5) return '1-5'
  if (weightKg <= 10) return '5-10'
  if (weightKg <= 15) return '10-15'
  if (weightKg <= 20) return '15-20'
  return '20-30'
}

// Determina la zona según el código postal
// Origen: La Falda, Córdoba (CP 5172) - Zona 4
function getZone(cp: string): number {
  const prefix = parseInt(cp.charAt(0))
  if (isNaN(prefix)) return 4
  return prefix
}

// Distancia relativa entre zonas (para calcular tarifas)
// Se usa la zona de origen como base
function getRelativeZone(originCP: string, destinationCP: string): 'local' | 'provincial' | 'regional' | 'nacional_cercano' | 'nacional_lejano' {
  const originZone = getZone(originCP)
  const destZone = getZone(destinationCP)

  // Mismo código postal o misma zona = local
  if (originZone === destZone) {
    // Si es zona 4 (Córdoba), es provincial
    if (originZone === 4) return 'provincial'
    return 'local'
  }

  // Zonas adyacentes = regional
  const diff = Math.abs(originZone - destZone)
  if (diff === 1) return 'regional'
  if (diff === 2) return 'nacional_cercano'

  // Zonas lejanas
  return 'nacional_lejano'
}

// ============================================
// TARIFAS ANDREANI (actualizadas mayo 2026)
// Tarifas aproximadas basadas en tabla oficial
// ============================================
const ANDREANI_RATES: Record<string, Record<WeightBracket, number>> = {
  local: {
    '0-1': 4500, '1-5': 5500, '5-10': 7500, '10-15': 9500, '15-20': 12000, '20-30': 15000
  },
  provincial: {
    '0-1': 5500, '1-5': 7000, '5-10': 9500, '10-15': 12000, '15-20': 15000, '20-30': 19000
  },
  regional: {
    '0-1': 6500, '1-5': 8500, '5-10': 11000, '10-15': 14000, '15-20': 17500, '20-30': 22000
  },
  nacional_cercano: {
    '0-1': 8000, '1-5': 10500, '5-10': 14000, '10-15': 18000, '15-20': 22500, '20-30': 28000
  },
  nacional_lejano: {
    '0-1': 10000, '1-5': 13500, '5-10': 18000, '10-15': 23000, '15-20': 29000, '20-30': 36000
  },
}

// Tiempos estimados de entrega Andreani (días hábiles)
const ANDREANI_DAYS: Record<string, string> = {
  local: '1-2',
  provincial: '2-3',
  regional: '3-5',
  nacional_cercano: '4-7',
  nacional_lejano: '5-10',
}

// ============================================
// TARIFAS CORREO ARGENTINO (Paq.Ar)
// Tarifas aproximadas basadas en tabla oficial
// ============================================
const CORREO_RATES: Record<string, Record<WeightBracket, number>> = {
  local: {
    '0-1': 3500, '1-5': 4500, '5-10': 6500, '10-15': 8500, '15-20': 11000, '20-30': 14000
  },
  provincial: {
    '0-1': 4500, '1-5': 6000, '5-10': 8000, '10-15': 10500, '15-20': 13500, '20-30': 17000
  },
  regional: {
    '0-1': 5500, '1-5': 7500, '5-10': 10000, '10-15': 13000, '15-20': 16000, '20-30': 20000
  },
  nacional_cercano: {
    '0-1': 7000, '1-5': 9500, '5-10': 12500, '10-15': 16000, '15-20': 20000, '20-30': 25000
  },
  nacional_lejano: {
    '0-1': 9000, '1-5': 12000, '5-10': 16000, '10-15': 21000, '15-20': 26500, '20-30': 33000
  },
}

// Tiempos estimados Correo Argentino (días hábiles)
const CORREO_DAYS: Record<string, string> = {
  local: '2-3',
  provincial: '3-5',
  regional: '4-7',
  nacional_cercano: '5-8',
  nacional_lejano: '7-12',
}

/**
 * Calcula las opciones de envío disponibles
 */
export function calculateShipping(params: ShippingCalcParams): ShippingQuote[] {
  const { originCP, destinationCP, weightKg, isRetiro } = params

  // Retiro en local - gratis
  if (isRetiro) {
    return [
      {
        carrier: 'correo_argentino',
        carrierName: 'Retiro en local',
        service: 'retiro',
        serviceName: 'Retiro en CompuCity',
        price: 0,
        estimatedDays: 'Inmediato',
        description: 'La Falda, Córdoba - Retirás tu pedido en el local',
      },
    ]
  }

  // Validar CP destino
  const cp = destinationCP.replace(/\s/g, '')
  if (!/^\d{4,5}$/.test(cp)) {
    return []
  }

  const bracket = getWeightBracket(weightKg)
  const relZone = getRelativeZone(originCP, cp)

  const quotes: ShippingQuote[] = []

  // Opción 1: Andreani
  const andreaniPrice = ANDREANI_RATES[relZone]?.[bracket]
  if (andreaniPrice) {
    quotes.push({
      carrier: 'andreani',
      carrierName: 'Andreani',
      service: 'estandar',
      serviceName: 'Andreani Estándar',
      price: andreaniPrice,
      estimatedDays: `${ANDREANI_DAYS[relZone]} días hábiles`,
      description: 'Envío estándar por Andreani con seguimiento',
    })

    // Andreani urgente (+40% sobre estándar)
    quotes.push({
      carrier: 'andreani',
      carrierName: 'Andreani',
      service: 'urgente',
      serviceName: 'Andreani Urgente',
      price: Math.ceil(andreaniPrice * 1.4),
      estimatedDays: `${Math.max(1, parseInt(ANDREANI_DAYS[relZone]) - 1)}-${Math.max(2, parseInt(ANDREANI_DAYS[relZone].split('-')[1]) - 2)} días hábiles`,
      description: 'Envío prioritario por Andreani con seguimiento',
    })
  }

  // Opción 2: Correo Argentino
  const correoPrice = CORREO_RATES[relZone]?.[bracket]
  if (correoPrice) {
    quotes.push({
      carrier: 'correo_argentino',
      carrierName: 'Correo Argentino',
      service: 'estandar',
      serviceName: 'Correo Argentino (Paq.Ar)',
      price: correoPrice,
      estimatedDays: `${CORREO_DAYS[relZone]} días hábiles`,
      description: 'Envío por Correo Argentino con seguimiento',
    })
  }

  return quotes
}

/**
 * Obtiene la descripción de la zona de envío
 */
export function getZoneDescription(originCP: string, destinationCP: string): string {
  const relZone = getRelativeZone(originCP, destinationCP)
  const descriptions: Record<string, string> = {
    local: 'Zona local (mismo área)',
    provincial: 'Provincial',
    regional: 'Regional (zona cercana)',
    nacional_cercano: 'Nacional (media distancia)',
    nacional_lejano: 'Nacional (larga distancia)',
  }
  return descriptions[relZone] || 'Nacional'
}

/**
 * Estima el peso total del pedido basado en los productos
 * @param items Items del pedido
 * @param weightPerItem Peso estimado por producto en kg (default: 2)
 */
export function estimateShippingWeight(items: { name: string; quantity: number }[], weightPerItem: number = 2): number {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  return Math.max(1, totalItems * weightPerItem)
}

/**
 * Obtiene el CP de origen configurado para la tienda
 */
export const DEFAULT_ORIGIN_CP = '5172' // La Falda, Córdoba
