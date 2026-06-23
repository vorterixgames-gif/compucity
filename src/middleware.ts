import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/admin-auth'

/**
 * Middleware para Compucity — Sesión 44 día 4 (Round 5):
 *
 * REFACTORIZACIÓN: El middleware anterior se ejecutaba en TODAS las rutas
 * (storefront + admin + APIs). Eso consumía Edge CPU innecesaria en cada
 * visita al storefront, aunque fuera cacheada.
 *
 * Ahora el middleware SOLO se ejecuta en /admin/* y /api/admin/*.
 * El storefront no pasa por middleware → menos latencia + menos CPU.
 *
 * Anti-scraping: movido a next.config.ts (redirects basados en User-Agent).
 * Rate limiting: eliminado (era Edge CPU cara para poco beneficio real).
 * Redirect vercel.app → dominio propio: movido a next.config.ts.
 *
 * Lo que queda acá: solo verificación de admin_token para rutas protegidas.
 */

export async function middleware(request: NextRequest) {
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

// ============================================
// Matcher — SOLO rutas admin (sesión 44 round 5)
// ============================================
// Antes: matcher cubría TODAS las rutas menos estáticas.
// Ahora: solo /admin/* y /api/admin/*.
// El storefront (home, categorías, productos) NO pasa por middleware.
// Reducción estimada: ~90% de ejecuciones de middleware eliminadas.
export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
  ],
}
