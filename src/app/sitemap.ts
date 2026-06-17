import { MetadataRoute } from 'next'
import { db } from '@/lib/db'

const SITE_URL = 'https://www.compucityonline.com.ar'

// Sesión 43: agregado revalidate=3600 (1h) para que Turso no reciba queries
// en cada request al sitemap. Googlebot y otros crawlers piden el sitemap
// frecuentemente, y sin revalidate cada pedido = 2 SELECTs a Turso.
// Con revalidate=3600, se sirve desde caché 1h y se regenera en background.
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages with high priority
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/contacto`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/arma-tu-pc`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/elige-tu-notebook`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]

  // Fetch enabled categories
  let categoryPages: MetadataRoute.Sitemap = []
  try {
    const categoriesResult = await db.execute(
      'SELECT slug, updatedAt FROM categories WHERE enabled = 1'
    )
    categoryPages = (categoriesResult.rows as any[]).map((row) => ({
      url: `${SITE_URL}/categoria/${row.slug}`,
      lastModified: new Date(row.updatedAt || Date.now()),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))
  } catch (error) {
    console.error('Sitemap categories error:', error)
  }

  // Fetch active products.
  // Sesión 43: FIX BUG — antes usaba `WHERE active = 1` que NO EXISTE como columna
  // (la columna real es `isActive`). El catch silenciaba el error y los productos
  // NUNCA aparecían en el sitemap, lo que empeoraba el SEO y forzaba a Googlebot
  // a crawlear ciegamente. Ahora usa la columna correcta.
  let productPages: MetadataRoute.Sitemap = []
  try {
    const productsResult = await db.execute(
      'SELECT slug, updatedAt FROM products WHERE isActive = 1'
    )
    productPages = (productsResult.rows as any[]).map((row) => ({
      url: `${SITE_URL}/producto/${row.slug}`,
      lastModified: new Date(row.updatedAt || Date.now()),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))
  } catch (error) {
    console.error('Sitemap products error:', error)
  }

  return [...staticPages, ...categoryPages, ...productPages]
}
