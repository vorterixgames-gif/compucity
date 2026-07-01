import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/admin-auth'

/**
 * Proxy para Compucity — Sesión 49:
 *
 * Migrado de middleware.ts a proxy.ts (Next.js 16.2+ convención).
 * El archivo "middleware" está deprecado en Next.js 16.2+.
 *
 * Funcionalidad idéntica: solo verificación de admin_token para rutas protegidas.
 * El storefront no pasa por proxy → menos latencia + menos CPU.
 */

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas del admin (login y auth API) — no requieren token
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
      if (isAdminApi) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    const email = await verifyToken(token)
    if (!email) {
      const response = isAdminApi
        ? NextResponse.json({ error: 'Token inválido' }, { status: 401 })
        : NextResponse.redirect(new URL('/admin/login', request.url))

      response.cookies.set('admin_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      })

      return response
    }

    return NextResponse.next()
  }

  return NextResponse.next()
}

// Matcher — SOLO rutas admin (igual que antes)
export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
  ],
}
