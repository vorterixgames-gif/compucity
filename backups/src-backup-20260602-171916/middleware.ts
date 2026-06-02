import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/admin-auth'

/**
 * Middleware para proteger rutas del panel de administración.
 *
 * - /admin/login → siempre accesible (página de login)
 * - /admin/* → requiere cookie admin_token con firma HMAC válida
 * - /api/admin/auth/* → siempre accesible (login, check, logout)
 * - /api/admin/* → requiere cookie admin_token con firma HMAC válida
 * - Todo lo demás → pasa sin restricción
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas del admin (login y auth API)
  const isPublicAdminRoute =
    pathname === '/admin/login' ||
    pathname.startsWith('/api/admin/auth/')

  if (isPublicAdminRoute) {
    return NextResponse.next()
  }

  // Verificar si es una ruta protegida del admin
  const isAdminPage = pathname.startsWith('/admin')
  const isAdminApi = pathname.startsWith('/api/admin')

  if (isAdminPage || isAdminApi) {
    const token = request.cookies.get('admin_token')?.value

    if (!token) {
      // Si es una API route, devolver 401
      if (isAdminApi) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      // Si es una página, redirigir al login
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    // Verify the HMAC signature of the token
    const email = await verifyToken(token)
    if (!email) {
      // Token is invalid or tampered — clear it and deny access
      const response = isAdminApi
        ? NextResponse.json({ error: 'Token inválido' }, { status: 401 })
        : NextResponse.redirect(new URL('/admin/login', request.url))

      // Clear the invalid cookie
      response.cookies.set('admin_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      })

      return response
    }

    // Token is valid — the email is verified by HMAC
    // Additional DB validation happens in getCurrentAdmin() on API routes
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
  ],
}
