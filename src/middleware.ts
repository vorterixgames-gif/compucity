import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/admin-auth'

/**
 * Middleware para Compucity — Sesión 43 día 2:
 * 1. Protege rutas del admin (/admin/*, /api/admin/*)
 * 2. Bloquea bots scrapers conocidos (AhrefsBot, SemrushBot, etc.)
 * 3. Rate limiting por IP para prevenir scraping agresivo
 *
 * EXCEPCIONES (siempre permitidas):
 * - Googlebot, Bingbot, DuckDuckBot, FacebookBot, Twitterbot, Applebot (SEO legítimo)
 * - Admin autenticado (puede navegar sin límites)
 * - Cron endpoints (con CRON_SECRET)
 */

// ============================================
// CAPA 1: Lista negra de bots scrapers conocidos
// ============================================
// Estos bots NO aportan valor SEO al sitio (no son buscadores principales)
// y consumen recursos crawleando todo. Bloquearlos reduce consumo Turso.
//
// IMPORTANTE: NO bloqueamos GPTBot, ClaudeBot, PerplexityBot, etc. porque
// esos bots son los que usan las IAs para RECOMENDAR tu sitio cuando alguien
// les pregunta. Solo bloqueamos bots de ENTRENAMIENTO (CCBot, ChatGPT-User,
// Google-Extended, etc.) que usan tu contenido para entrenar modelos futuros
// sin aportarte nada a cambio.
const BLOCKED_BOTS = [
  'ahrefsbot',       // Ahrefs SEO crawler (competencia)
  'semrushbot',      // Semrush SEO crawler (competencia)
  'mj12bot',         // Majestic SEO crawler
  'dotbot',          // Moz SEO crawler
  'petalbot',        // Huawei search (poco tráfico AR)
  'yandexbot',       // Yandex (Rusia)
  'baiduspider',     // Baidu (China)
  'bytespider',      // ByteDance (TikTok, China)
  'amazonbot',       // Amazon crawler
  // ─── Solo bots de ENTRENAMIENTO de IA (no los de búsqueda/recomendación) ───
  'ccbot',              // Common Crawl (entrenamiento IA)
  'chatgpt-user',       // OpenAI entrenamiento (NO GPTBot que es el de recomendación)
  'google-extended',    // Google AI entrenamiento (NO Googlebot que es el de búsqueda)
  'anthropic-ai',       // Anthropic entrenamiento (NO ClaudeBot que es el de recomendación)
  'applebot-extended',  // Apple AI entrenamiento (NO AppleBot que es el de búsqueda)
  'meta-externalagent', // Meta AI entrenamiento
  'ai2bot',             // AI2 entrenamiento
  'imagesiftbot',       // Image sifting
  'diffbot',            // Diffbot scraper
  'cohere-ai',          // Cohere entrenamiento
]

// ============================================
// CAPA 2: Lista blanca — bots legítimos SIEMPRE permitidos
// ============================================
// Estos bots aportan valor:
// - Buscadores: traen tráfico orgánico desde Google, Bing, DuckDuckGo
// - Redes sociales: preview de links compartidos (WhatsApp, Telegram, etc.)
// - IAs de búsqueda/recomendación: ChatGPT, Claude, Perplexity pueden
//   recomendar tu sitio cuando alguien les pregunta por productos
const ALLOWED_BOTS = [
  // Buscadores principales
  'googlebot',       // Google search
  'googlebot-image', // Google images
  'googlebot-news',  // Google News
  'google-sitemaps', // Google sitemaps verification
  'bingbot',         // Bing search
  'msnbot',          // MSN
  'duckduckbot',     // DuckDuckGo
  'applebot',        // Apple Siri/Safari suggestions
  // Redes sociales (preview de links)
  'facebookexternalhit', // Facebook
  'twitterbot',      // Twitter/X
  'linkedinbot',     // LinkedIn
  'telegrambot',     // Telegram
  'whatsapp',        // WhatsApp
  'slackbot',        // Slack
  'discordbot',      // Discord
  // IAs de búsqueda/recomendación (NO de entrenamiento — esos están bloqueados arriba)
  'gptbot',          // OpenAI ChatGPT (recomendación en tiempo real)
  'oai-searchbot',   // OpenAI Search
  'claudebot',       // Anthropic Claude (recomendación)
  'perplexitybot',   // Perplexity.ai (recomendación)
  'openai',          // OpenAI genérico
]

// ============================================
// CAPA 3: Rate limiting por IP (en memoria del edge)
// ============================================
// Si una IP hace más de 30 requests en 10 segundos → bloquear 1 hora.
// Un humano normal hace 1-2 req/segundo. Un scraper hace 10-50.
// El edge runtime de Vercel mantiene esta memoria por región (no es perfecta
// pero funciona para la mayoría de scrapers).
const RATE_LIMIT_WINDOW_MS = 10_000 // 10 segundos
const RATE_LIMIT_MAX_REQUESTS = 30  // máx 30 req por IP en 10s
const RATE_LIMIT_BLOCK_MS = 60 * 60 * 1000 // bloquear 1 hora
const RATE_LIMIT_PATH = '/api/_rate-limit'

// Mapa de IPs con sus timestamps de requests recientes y bloqueos
// En el edge runtime esto vive por cold start de la instancia
const ipRequests = new Map<string, number[]>()
const blockedIps = new Map<string, number>() // ip → timestamp hasta cuándo

function getClientIp(request: NextRequest): string {
  // Vercel pone la IP real en estos headers
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()

  // ¿Está bloqueada esta IP?
  const blockedUntil = blockedIps.get(ip)
  if (blockedUntil && blockedUntil > now) {
    return true
  }
  if (blockedUntil && blockedUntil <= now) {
    blockedIps.delete(ip)
  }

  // Limpiar requests viejas
  const requests = ipRequests.get(ip) || []
  const recentRequests = requests.filter(t => now - t < RATE_LIMIT_WINDOW_MS)

  // Agregar request actual
  recentRequests.push(now)
  ipRequests.set(ip, recentRequests)

  // ¿Hizo demasiadas requests en la ventana?
  if (recentRequests.length > RATE_LIMIT_MAX_REQUESTS) {
    blockedIps.set(ip, now + RATE_LIMIT_BLOCK_MS)
    console.warn(`[anti-scraping] IP ${ip} bloqueada por rate limit (${recentRequests.length} req en ${RATE_LIMIT_WINDOW_MS / 1000}s)`)
    return true
  }

  return false
}

// Cleanup periódico para que no crezca infinito (cada ~10 min)
if (typeof globalThis !== 'undefined') {
  const lastCleanup = (globalThis as any).__lastRateLimitCleanup || 0
  if (Date.now() - lastCleanup > 10 * 60 * 1000) {
    (globalThis as any).__lastRateLimitCleanup = Date.now()
    const now = Date.now()
    for (const [ip, requests] of ipRequests) {
      const recent = requests.filter(t => now - t < RATE_LIMIT_WINDOW_MS)
      if (recent.length === 0) {
        ipRequests.delete(ip)
      } else {
        ipRequests.set(ip, recent)
      }
    }
  }
}

// ============================================
// Helpers de User-Agent
// ============================================
function getUserAgent(request: NextRequest): string {
  return (request.headers.get('user-agent') || '').toLowerCase()
}

function isAllowedBot(ua: string): boolean {
  return ALLOWED_BOTS.some(bot => ua.includes(bot))
}

function isBlockedBot(ua: string): boolean {
  return BLOCKED_BOTS.some(bot => ua.includes(bot))
}

// Googlebot verification: si dice ser Googlebot, la IP debería ser de Google.
// En edge runtime no podemos hacer reverse DNS completo, pero al menos
// verificamos que venga de rangos conocidos de Google.
function isGooglebotIp(ip: string): boolean {
  // Rangos aproximados de Google (no exhaustivo, pero bloquea los fake más obvios)
  if (ip.startsWith('66.249.') || // Google
      ip.startsWith('64.233.') || // Google
      ip.startsWith('72.14.') ||  // Google
      ip.startsWith('74.125.') || // Google
      ip.startsWith('141.85.') || // Google
      ip.startsWith('108.177.') || // Google
      ip.startsWith('104.132.') || // Google
      ip.startsWith('35.247.') || // Google Cloud (bot)
      ip.startsWith('34.100.')) {  // Google Cloud (bot)
    return true
  }
  return false
}

function isMicrosoftIp(ip: string): boolean {
  // Bingbot de Microsoft
  if (ip.startsWith('40.77.') ||
      ip.startsWith('157.55.') ||
      ip.startsWith('207.46.') ||
      ip.startsWith('13.66.') ||
      ip.startsWith('13.67.')) {
    return true
  }
  return false
}

// ============================================
// Middleware principal
// ============================================
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') || ''

  // ─── Fix SEO (sesión 43 día 2 FINAL): redirigir dominio interno de Vercel ───
  // Vercel expone el sitio en 2 URLs:
  //   1. www.compucityonline.com.ar (dominio principal — el que queremos indexar)
  //   2. my-project-*.vercel.app (URL interna — NO queremos que Google la indexe)
  // Si alguien entra por la URL interna, lo redirigimos al dominio principal
  // para evitar contenido duplicado y consolidar el SEO.
  if (host.includes('.vercel.app')) {
    const newUrl = new URL(request.url)
    newUrl.host = 'www.compucityonline.com.ar'
    newUrl.protocol = 'https:'
    return NextResponse.redirect(newUrl, 301) // 301 = permanente, Google consolida
  }

  // ─── Excepción 1: rutas internas del sistema ───
  // No aplicamos anti-scraping a estas rutas
  if (
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/_rate-limit') ||
    pathname.startsWith('/admin')
  ) {
    // Pero SÍ aplicamos la lógica admin auth (más abajo)
    return handleAdminAuth(request, pathname)
  }

  // ─── Excepción 2: archivos estáticos ───
  // No aplicar anti-scraping a imágenes, CSS, JS, etc.
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next()
  }

  const ua = getUserAgent(request)
  const ip = getClientIp(request)

  // ─── CAPA 1: Bloquear bots scrapers conocidos ───
  if (isBlockedBot(ua)) {
    console.log(`[anti-scraping] Bloqueado bot conocido: ${ua.substring(0, 50)} (IP: ${ip})`)
    return new NextResponse('Bot bloqueado. Si creés que es un error, contactanos.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // ─── CAPA 2: Verificar bots legítimos (Googlebot, Bingbot, etc.) ───
  // Si dice ser Googlebot pero la IP no es de Google → bloquear (fake)
  if (ua.includes('googlebot') && !isGooglebotIp(ip)) {
    console.warn(`[anti-scraping] FAKE Googlebot bloqueado. IP: ${ip}, UA: ${ua.substring(0, 80)}`)
    return new NextResponse('Bot bloqueado. Si creás que es un error, contactanos.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
  if (ua.includes('bingbot') && !isMicrosoftIp(ip)) {
    console.warn(`[anti-scraping] FAKE Bingbot bloqueado. IP: ${ip}, UA: ${ua.substring(0, 80)}`)
    return new NextResponse('Bot bloqueado. Si creás que es un error, contactanos.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // Si es un bot legítimo (verificado), permitir sin rate limit
  if (isAllowedBot(ua)) {
    return NextResponse.next()
  }

  // ─── CAPA 3: Rate limiting por IP ───
  // Aplica a cualquier cosa que no sea bot legítimo ni admin ni archivos estáticos
  if (isRateLimited(ip)) {
    return new NextResponse('Demasiadas requests. Intentá más tarde.', {
      status: 429,
      headers: {
        'Content-Type': 'text/plain',
        'Retry-After': '3600',
      },
    })
  }

  return NextResponse.next()
}

// ============================================
// Lógica de admin auth (separada para claridad)
// ============================================
async function handleAdminAuth(request: NextRequest, pathname: string): Promise<NextResponse> {
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
// Matcher — aplicamos middleware a TODAS las rutas menos estáticas
// ============================================
export const config = {
  matcher: [
    // Aplicar a todo, excepto:
    // - /_next/static (build estáticos)
    // - /_next/image (optimizador de imágenes)
    // - /favicon.ico, /robots.txt, /sitemap.xml (sirven estáticos)
    // - /api/cron (cron con secret propio)
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/cron).*)',
  ],
}
