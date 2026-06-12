import { MetadataRoute } from 'next'
import { db } from '@/lib/db'

const SITE_URL = 'https://www.compucityonline.com.ar'

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

  // Fetch active products
  let productPages: MetadataRoute.Sitemap = []
  try {
    const productsResult = await db.execute(
      'SELECT slug, updatedAt FROM products WHERE active = 1'
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
