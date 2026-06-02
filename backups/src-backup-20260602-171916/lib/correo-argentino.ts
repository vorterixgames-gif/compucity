// ============================================
// CORREO ARGENTINO API Integration (MiCorreo / Paq.Ar)
// Documentación: https://api.correoargentino.com.ar/micorreo/v1
// ============================================

interface CorreoCredentials {
  userToken: string      // For Basic auth to get JWT
  passwordToken: string  // For Basic auth to get JWT
  email: string          // MiCorreo account email
  password: string       // MiCorreo account password
}

interface CorreoQuoteParams {
  cpOrigen: string
  cpDestino: string
  pesoGramos: number
  largoCm: number
  anchoCm: number
  altoCm: number
  cantidad?: number
}

interface CorreoRate {
  deliveredType: 'D' | 'S'  // D=Domicilio, S=Sucursal
  productType: 'CP' | 'EP'  // CP=Clásico, EP=Express
  productName: string
  price: number
  deliveryTimeMin: string
  deliveryTimeMax: string
}

interface CorreoQuoteResult {
  rates: CorreoRate[]
  validTo: string
}

// Token cache
let cachedJwt: { token: string; expires: number; customerId: string } | null = null

const PRODUCTION_URL = 'https://api.correoargentino.com.ar/micorreo/v1'
const TEST_URL = 'https://apitest.correoargentino.com.ar/micorreo/v1'

function getBaseUrl(): string {
  return process.env.CORREO_SANDBOX === 'true' ? TEST_URL : PRODUCTION_URL
}

/**
 * Step 1: Obtener JWT token con Basic auth
 */
async function getToken(credentials: CorreoCredentials): Promise<string> {
  const auth = Buffer.from(`${credentials.userToken}:${credentials.passwordToken}`).toString('base64')
  const baseUrl = getBaseUrl()

  const response = await fetch(`${baseUrl}/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Correo Argentino token error: ${response.status}`)
  }

  const data = await response.json()
  return data.token
}

/**
 * Step 2: Validar usuario y obtener customerId
 */
async function validateUser(jwt: string, email: string, password: string): Promise<string> {
  const baseUrl = getBaseUrl()

  const response = await fetch(`${baseUrl}/users/validate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error(`Correo Argentino validate error: ${response.status}`)
  }

  const data = await response.json()
  return data.customerId
}

/**
 * Autenticación completa - obtiene JWT + customerId
 * Cachea el resultado por 50 minutos
 */
async function authenticate(credentials: CorreoCredentials): Promise<{ jwt: string; customerId: string }> {
  // Check cache
  if (cachedJwt && cachedJwt.expires > Date.now()) {
    return { jwt: cachedJwt.token, customerId: cachedJwt.customerId }
  }

  const jwt = await getToken(credentials)
  const customerId = await validateUser(jwt, credentials.email, credentials.password)

  // Cache for 50 minutes
  cachedJwt = {
    token: jwt,
    expires: Date.now() + 50 * 60 * 1000,
    customerId,
  }

  return { jwt, customerId }
}

/**
 * Cotizar envío con Correo Argentino
 */
export async function quote(
  credentials: CorreoCredentials,
  params: CorreoQuoteParams
): Promise<CorreoQuoteResult | null> {
  try {
    const { jwt, customerId } = await authenticate(credentials)
    const baseUrl = getBaseUrl()

    const body = {
      customerId,
      postalCodeOrigin: params.cpOrigen,
      postalCodeDestination: params.cpDestino,
      deliveredType: 'D', // Domicilio - we'll get both D and S options
      dimensions: [
        {
          weight: params.pesoGramos,
          height: params.altoCm,
          width: params.anchoCm,
          length: params.largoCm,
          quantity: params.cantidad || 1,
        },
      ],
    }

    const response = await fetch(`${baseUrl}/rates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[Correo Argentino] Quote error:', response.status, errorBody)
      return null
    }

    const data = await response.json()

    return {
      rates: (data.rates || []).map((r: any) => ({
        deliveredType: r.deliveredType,
        productType: r.productType,
        productName: r.productName || (r.productType === 'CP' ? 'Paq.ar Clásico' : 'Paq.ar Express'),
        price: parseFloat(String(r.price)),
        deliveryTimeMin: String(r.deliveryTimeMin || ''),
        deliveryTimeMax: String(r.deliveryTimeMax || ''),
      })),
      validTo: data.validTo || '',
    }
  } catch (error) {
    console.error('[Correo Argentino] Quote exception:', error)
    return null
  }
}

/**
 * Verifica si las credenciales están configuradas
 */
export function hasCorreoCredentials(credentials: Partial<CorreoCredentials>): credentials is CorreoCredentials {
  return !!(
    credentials.userToken &&
    credentials.passwordToken &&
    credentials.email &&
    credentials.password
  )
}

/**
 * Obtiene las credenciales de Correo Argentino desde la config de la DB
 */
export function parseCorreoCredentials(config: Record<string, string>): CorreoCredentials | null {
  const userToken = config.correo_user_token || ''
  const passwordToken = config.correo_password_token || ''
  const email = config.correo_email || ''
  const password = config.correo_password || ''

  if (userToken && passwordToken && email && password) {
    return { userToken, passwordToken, email, password }
  }
  return null
}

/**
 * Limpia cache de token (útil cuando cambian credenciales)
 */
export function clearCorreoTokenCache(): void {
  cachedJwt = null
}
