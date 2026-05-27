// ============================================
// ANDREANI API Integration
// Documentación: https://developers.andreani.com
// ============================================

interface AndreaniCredentials {
  user: string
  password: string
  codigoCliente: string
  contratoDomicilio: string
  contratoSucursal: string
}

interface AndreaniQuoteParams {
  cpDestino: number
  pesoKg: number
  volumenCm3?: number
  largoCm?: number
  anchoCm?: number
  altoCm?: number
  valorDeclarado?: number
}

interface AndreaniQuoteResult {
  tarifaSinIva: number
  tarifaConIva: number
  pesoAforado: string
}

// Token cache
let cachedToken: { token: string; expires: number } | null = null

const PRODUCTION_URL = 'https://apis.andreani.com'
const SANDBOX_URL = 'https://apisqa.andreani.com'

function getBaseUrl(): string {
  return process.env.ANDREANI_SANDBOX === 'true' ? SANDBOX_URL : PRODUCTION_URL
}

/**
 * Autenticación con Andreani - obtiene el token JWT
 */
async function login(credentials: AndreaniCredentials): Promise<string> {
  // Check cache
  if (cachedToken && cachedToken.expires > Date.now()) {
    return cachedToken.token
  }

  const baseUrl = getBaseUrl()
  const auth = Buffer.from(`${credentials.user}:${credentials.password}`).toString('base64')

  const response = await fetch(`${baseUrl}/login`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Andreani login failed: ${response.status}`)
  }

  const token = response.headers.get('x-authorization-token')
  if (!token) {
    throw new Error('Andreani login: no token returned')
  }

  // Cache for 50 minutes (tokens typically last 1 hour)
  cachedToken = {
    token,
    expires: Date.now() + 50 * 60 * 1000,
  }

  return token
}

/**
 * Cotizar envío a domicilio con Andreani
 */
export async function quoteDomicilio(
  credentials: AndreaniCredentials,
  params: AndreaniQuoteParams
): Promise<AndreaniQuoteResult | null> {
  try {
    const token = await login(credentials)
    const baseUrl = getBaseUrl()

    // Build bultos - use volumen or dimensions
    let volumenParam = ''
    if (params.largoCm && params.anchoCm && params.altoCm) {
      volumenParam = `&bultos[0][largoCm]=${params.largoCm}&bultos[0][anchoCm]=${params.anchoCm}&bultos[0][altoCm]=${params.altoCm}`
    } else if (params.volumenCm3) {
      volumenParam = `&bultos[0][volumen]=${params.volumenCm3}`
    } else {
      // Default volume estimate: 30x20x10 = 6000 cm³
      volumenParam = `&bultos[0][volumen]=6000`
    }

    const url = `${baseUrl}/v1/tarifas?cpDestino=${params.cpDestino}&contrato=${credentials.contratoDomicilio}&cliente=${credentials.codigoCliente}${volumenParam}&bultos[0][kilos]=${params.pesoKg}&bultos[0][valorDeclarado]=${params.valorDeclarado || 0}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-authorization-token': token,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[Andreani] Quote domicilio error:', response.status, errorBody)
      return null
    }

    const data = await response.json()

    return {
      tarifaSinIva: parseFloat(data.tarifaSinIva?.total || '0'),
      tarifaConIva: parseFloat(data.tarifaConIva?.total || '0'),
      pesoAforado: data.pesoAforado || '',
    }
  } catch (error) {
    console.error('[Andreani] Quote domicilio exception:', error)
    return null
  }
}

/**
 * Cotizar envío a sucursal con Andreani
 */
export async function quoteSucursal(
  credentials: AndreaniCredentials,
  params: AndreaniQuoteParams
): Promise<AndreaniQuoteResult | null> {
  try {
    const token = await login(credentials)
    const baseUrl = getBaseUrl()

    let volumenParam = ''
    if (params.volumenCm3) {
      volumenParam = `&bultos[0][volumen]=${params.volumenCm3}`
    } else {
      volumenParam = `&bultos[0][volumen]=6000`
    }

    const url = `${baseUrl}/v1/tarifas?cpDestino=${params.cpDestino}&contrato=${credentials.contratoSucursal}&cliente=${credentials.codigoCliente}${volumenParam}&bultos[0][kilos]=${params.pesoKg}&bultos[0][valorDeclarado]=${params.valorDeclarado || 0}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-authorization-token': token,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[Andreani] Quote sucursal error:', response.status, errorBody)
      return null
    }

    const data = await response.json()

    return {
      tarifaSinIva: parseFloat(data.tarifaSinIva?.total || '0'),
      tarifaConIva: parseFloat(data.tarifaConIva?.total || '0'),
      pesoAforado: data.pesoAforado || '',
    }
  } catch (error) {
    console.error('[Andreani] Quote sucursal exception:', error)
    return null
  }
}

/**
 * Verifica si las credenciales de Andreani están configuradas
 */
export function hasAndreaniCredentials(credentials: Partial<AndreaniCredentials>): credentials is AndreaniCredentials {
  return !!(
    credentials.user &&
    credentials.password &&
    credentials.codigoCliente &&
    credentials.contratoDomicilio
  )
}

/**
 * Obtiene las credenciales de Andreani desde la config de la DB
 */
export function parseAndreaniCredentials(config: Record<string, string>): AndreaniCredentials | null {
  const user = config.andreani_user || ''
  const password = config.andreani_password || ''
  const codigoCliente = config.andreani_cliente || ''
  const contratoDomicilio = config.andreani_contrato_domicilio || ''
  const contratoSucursal = config.andreani_contrato_sucursal || ''

  if (user && password && codigoCliente && contratoDomicilio) {
    return { user, password, codigoCliente, contratoDomicilio, contratoSucursal: contratoSucursal || contratoDomicilio }
  }
  return null
}

// Clear token cache (useful when credentials change)
export function clearAndreaniTokenCache(): void {
  cachedToken = null
}
