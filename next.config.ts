import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ['0.0.0.0'],
  // Security: Don't expose X-Powered-By header
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.simpleicons.org',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
    // Sesión 44: desactivar prefetch globalmente para reducir Fluid CPU
    // Antes: 1 visita = ~20 prefetches serverless (~10s CPU)
    // Ahora: 1 visita = 0 prefetches (~2s CPU)
    // El usuario tarda ~1s al hacer click en un link (aceptable)
    prefetch: false,
  },
  // Sesión 44 round 5: redirects que se ejecutan ANTES que cualquier cosa
  // (incluso antes que el middleware). Esto bloquea bots conocidos sin
  // consumir Edge CPU del middleware.
  //
  // Nota: Next.js `has` conditions solo soportan matching exacto de header
  // value, no substring. Por eso solo bloqueamos los UAs más dañinos que
  // vemos en logs (Meta-ExternalAgent hace ~50 req/3min).
  async redirects() {
    return [
      // Redirect vercel.app → dominio propio (antes en middleware)
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'compucity-vorterixgames-gif.vercel.app',
          },
        ],
        destination: 'https://www.compucityonline.com.ar/:path*',
        permanent: true,
      },
      // Bloquear Meta-ExternalAgent (bot de entrenamiento IA de Facebook/Meta)
      // Hace ~50 requests cada 3 minutos a /producto/* → mucho Fluid CPU
      // Next.js no soporta substring match, así que usamos el valor exacto
      // que vemos en logs: "meta-externalagent/1.1"
      {
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'user-agent',
            value: 'meta-externalagent/1.1',
          },
        ],
        destination: 'https://www.compucityonline.com.ar/blocked',
        permanent: false,
      },
    ]
  },
  // Sesión 43 día 2 FINAL: headers de cache para archivos estáticos.
  // Sin esto, Vercel sirve las imágenes con `max-age=0, must-revalidate`
  // lo que hace que cada visita vuelva a descargar las imágenes del hero
  // (~400 KB por visita). Con este header, el navegador cachea 1 año y
  // el CDN de Vercel también, reduciendo bandwidth y mejorando velocidad.
  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/uploads/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/favicon.ico',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/favicon-16x16.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/favicon-32x32.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/apple-touch-icon.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/android-chrome-192x192.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/logo.svg',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/placeholder-product.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/placeholder-product.svg',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
