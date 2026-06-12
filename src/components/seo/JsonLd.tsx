/**
 * Reusable JSON-LD structured data component for SEO.
 * Renders a <script type="application/ld+json"> tag with the given data.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

/**
 * LocalBusiness schema for Compucity - used on homepage for GEO/local SEO.
 */
export function getLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ElectronicsStore',
    name: 'Compucity',
    description: 'Tienda online de notebooks, componentes, periféricos y accesorios de informática. Envíos a todo el país desde La Falda, Córdoba.',
    url: 'https://www.compucityonline.com.ar',
    telephone: '+5493548402056',
    email: 'compucitylafalda@gmail.com',
    image: 'https://www.compucityonline.com.ar/images/og-image.jpg',
    logo: 'https://www.compucityonline.com.ar/images/logo-compucity.png',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Av. Sarmiento 462',
      addressLocality: 'La Falda',
      addressRegion: 'Córdoba',
      postalCode: '5172',
      addressCountry: 'AR',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: -31.0975,
      longitude: -64.4933,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '18:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Saturday',
        opens: '09:00',
        closes: '13:00',
      },
    ],
    priceRange: '$$',
    sameAs: [
      'https://www.instagram.com/compucitylafalda',
      'https://www.facebook.com/compucitylafalda',
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Productos de informática',
      itemListElement: [
        { '@type': 'OfferCatalog', name: 'Notebooks' },
        { '@type': 'OfferCatalog', name: 'Componentes de PC' },
        { '@type': 'OfferCatalog', name: 'Periféricos' },
        { '@type': 'OfferCatalog', name: 'Monitores' },
        { '@type': 'OfferCatalog', name: 'PCs Armadas' },
      ],
    },
  }
}

/**
 * WebSite schema with SearchAction - enables sitelinks search box in Google.
 */
export function getWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Compucity',
    url: 'https://www.compucityonline.com.ar',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://www.compucityonline.com.ar/categoria/todos?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

/**
 * Product schema for individual product pages.
 */
export function getProductSchema({
  name,
  description,
  image,
  price,
  comparePrice,
  sku,
  slug,
  stock,
  categoryName,
}: {
  name: string
  description?: string | null
  image?: string | null
  price: number
  comparePrice?: number | null
  sku?: string | null
  slug: string
  stock: number
  categoryName?: string | null
}) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: description || `${name} - Comprá online en Compucity, La Falda, Córdoba.`,
    url: `https://www.compucityonline.com.ar/producto/${slug}`,
    brand: categoryName ? { '@type': 'Brand', name: categoryName } : undefined,
  }

  if (image) {
    schema.image = image.startsWith('http') ? image : `https://www.compucityonline.com.ar${image}`
  }

  if (sku) {
    schema.sku = sku
  }

  // Offers
  schema.offers = {
    '@type': 'Offer',
    url: `https://www.compucityonline.com.ar/producto/${slug}`,
    priceCurrency: 'ARS',
    price: comparePrice || price,
    priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    availability: stock > 0
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock',
    seller: {
      '@type': 'ElectronicsStore',
      name: 'Compucity',
    },
    // Show the higher price as "highPrice" if there's a cash discount
    highPrice: comparePrice ? price : undefined,
    lowPrice: comparePrice ? comparePrice : price,
  }

  return schema
}

/**
 * BreadcrumbList schema for navigation breadcrumbs.
 */
export function getBreadcrumbSchema(items: { name: string; url?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      ...(item.url ? { item: `https://www.compucityonline.com.ar${item.url}` } : {}),
    })),
  }
}
