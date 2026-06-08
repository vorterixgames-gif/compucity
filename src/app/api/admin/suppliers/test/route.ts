import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { apiType, apiBaseUrl, apiUsername, apiPassword, apiUserId, apiToken } = await request.json()

    switch (apiType) {
      case 'invid': {
        const baseUrl = apiBaseUrl || 'https://www.invidcomputers.com'
        const authRes = await fetch(`${baseUrl}/api/v1/auth.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: apiUsername, password: apiPassword }),
        })

        if (!authRes.ok) {
          const errText = await authRes.text()
          return NextResponse.json({
            ok: false,
            message: `Error ${authRes.status}: ${errText}`,
          })
        }

        const authData = await authRes.json()
        if (authData.access_token) {
          // Try fetching first product page
          const productsRes = await fetch(`${baseUrl}/api/v1/articulo.php`, {
            headers: { 'Authorization': `Bearer ${authData.access_token}` },
          })

          let productCount = 0
          let sampleProduct = null
          if (productsRes.ok) {
            const productsData = await productsRes.json()
            const products = productsData.data || []
            productCount = products.length
            if (products.length > 0) {
              sampleProduct = {
                id: products[0].ID,
                title: products[0].TITLE,
                price: products[0].PRICE,
                currency: products[0].CURRENCY,
                stockStatus: products[0].STOCK_STATUS,
                brand: products[0].BRAND,
              }
            }
          }

          return NextResponse.json({
            ok: true,
            message: `Conexión exitosa. Token recibido (expira en ${authData.expiration_time ? Math.round(authData.expiration_time / 3600) : '?'} horas). ${productCount} productos en primera página.`,
            details: {
              tokenType: authData.token_type,
              expiresIn: authData.expiration_time,
              productCount,
              sampleProduct,
            },
          })
        } else {
          return NextResponse.json({
            ok: false,
            message: `Autenticación fallida: ${authData.message || 'Credenciales incorrectas'}`,
          })
        }
      }

      case 'air_intra': {
        const baseUrl = apiBaseUrl || 'https://api.air-intra.com/v2'
        const authRes = await fetch(
          `${baseUrl}/?q=login&user=${encodeURIComponent(apiUsername)}&pass=${encodeURIComponent(apiPassword)}`
        )

        if (!authRes.ok) {
          return NextResponse.json({
            ok: false,
            message: `Error ${authRes.status}`,
          })
        }

        const authData = await authRes.json()
        if (authData.token) {
          return NextResponse.json({
            ok: true,
            message: `Conexión exitosa. Empresa: ${authData.nombre || 'N/A'}, Lista: ${authData.lista || 'N/A'}, Cotización USD: $${authData.cotiza || 'N/A'}`,
            details: {
              nombre: authData.nombre,
              mail: authData.mail,
              sucursal: authData.sucursal,
              lista: authData.lista,
              cotiza: authData.cotiza,
            },
          })
        } else {
          return NextResponse.json({
            ok: false,
            message: `Autenticación fallida: ${authData.error_detail || authData.error_name || 'Credenciales incorrectas'}`,
          })
        }
      }

      case 'elit': {
        const baseUrl = apiBaseUrl || 'https://clientes.elit.com.ar'
        const userId = parseInt(apiUserId || '0')
        const token = apiToken || ''

        if (!userId || !token) {
          return NextResponse.json({
            ok: false,
            message: 'Se requiere user_id y token para ELIT. Obtenga estos datos desde el portal de ELIT.',
          })
        }

        const testRes = await fetch(
          `${baseUrl}/v1/api/productos?limit=1&offset=1`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, token }),
          }
        )

        if (!testRes.ok) {
          return NextResponse.json({
            ok: false,
            message: `Error ${testRes.status}: No se pudo conectar con la API de ELIT`,
          })
        }

        const data = await testRes.json()
        const products = data.resultado || []

        return NextResponse.json({
          ok: true,
          message: `Conexión exitosa. Cotización USD: $${data.cotizacion || 'N/A'}. ${products.length} producto(s) en prueba.`,
          details: {
            cotizacion: data.cotizacion,
            sampleCount: products.length,
            sampleProduct: products.length > 0 ? {
              nombre: products[0].nombre,
              precio: products[0].precio,
              moneda: products[0].moneda,
              stock: products[0].stock_total,
              marca: products[0].marca,
            } : null,
          },
        })
      }

      default:
        return NextResponse.json({
          ok: false,
          message: `Tipo de API "${apiType}" no soportado. Use: invid, air_intra, elit`,
        }, { status: 400 })
    }
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      message: `Error de conexión: ${error.message}`,
    })
  }
}
