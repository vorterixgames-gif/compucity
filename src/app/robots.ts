import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/carrito', '/checkout', '/favoritos', '/mis-pedidos', '/recuperar-contrasena', '/resetear-contrasena'],
      },
    ],
    sitemap: 'https://www.compucityonline.com.ar/sitemap.xml',
  }
}
