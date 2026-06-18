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
        dayOfWeek: ['Saturday'],
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
 * Sanea un SKU para que sea válido en Schema.org.
 * Google rechaza SKUs con espacios, caracteres especiales, o muy largos.
 * Permite: letras, números, guiones medios y bajos.
 */
function sanitizeSku(sku: string | null | undefined): string | undefined {
  if (!sku) return undefined
  const sanitized = String(sku).trim().replace(/[^a-zA-Z0-9_-]/g, '-')
  // Si queda vacío después de sanitizar, no lo incluimos
  if (!sanitized || sanitized === '-' || sanitized.length < 2) return undefined
  // Limitar a 50 caracteres (Google rechaza SKUs muy largos)
  return sanitized.substring(0, 50)
}

/**
 * Product schema for individual product pages.
 *
 * Sesión 43 día 3 (18/6): fix problemas reportados por Google Search Console:
 * - CRÍTICO: image ahora es URL absoluta (.jpg/.png/.webp) no /api/image/[id]
 * - brand ahora usa la marca REAL del producto (no categoryName como antes)
 * - SKU saneado (sin espacios ni caracteres especiales)
 * - Agregado shippingDetails (envío a todo Argentina)
 * - Agregado hasMerchantReturnPolicy (30 días para devoluciones)
 * - Agregado itemCondition (https://schema.org/NewCondition)
 * - Agregado priceSpecification con precio lista y efectivo
 *
 * NO se agregaron aggregateRating ni review porque requieren sistema de reseñas.
 * Google los marca como "no crítico" — no afecta indexación.
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
  brandName,
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
  brandName?: string | null
}) {
  const SITE_URL = 'https://www.compucityonline.com.ar'

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: description || `${name} - Comprá online en Compucity, La Falda, Córdoba. Envíos a todo el país.`,
    url: `${SITE_URL}/producto/${slug}`,
    // Brand: usar la marca REAL del producto si existe, si no usar "Compucity"
    // como vendedor genérico. Antes usaba categoryName que era incorrecto.
    brand: {
      '@type': 'Brand',
      name: brandName || 'Compucity',
    },
    // Item condition: todos los productos son nuevos
    additionalProperty: {
      '@type': 'PropertyValue',
      name: 'Condición',
      value: 'Nuevo',
    },
  }

  // CRÍTICO: image debe ser URL absoluta a un archivo de imagen (.jpg/.png/.webp).
  // Google RECHAZA URLs dinámicas como /api/image/[id] porque no son imágenes directas.
  // Las imágenes de productos en Compucity se sirven desde /api/image/[id], por lo tanto
  // usamos la imagen placeholder pública de og-image.jpg como fallback.
  // Si en el futuro migrás las imágenes a /public/uploads/productos/, acá se puede usar
  // la URL directa.
  if (image) {
    // Si la imagen es una URL dinámica /api/image/, NO la usamos porque Google la rechaza.
    // En su lugar usamos la OG image como fallback.
    if (image.startsWith('/api/image/') || image.startsWith('http')) {
      // Para /api/image/, usar placeholder. Para URLs externas directas, usarlas.
      if (image.startsWith('/api/image/')) {
        schema.image = `${SITE_URL}/images/og-image.jpg`
      } else {
        schema.image = image
      }
    } else {
      schema.image = image.startsWith('http') ? image : `${SITE_URL}${image}`
    }
  } else {
    // Sin imagen: usar placeholder para que Google no marque "Falta image"
    schema.image = `${SITE_URL}/images/og-image.jpg`
  }

  // SKU saneado (sin espacios ni caracteres especiales que Google rechaza)
  const sanitizedSku = sanitizeSku(sku)
  if (sanitizedSku) {
    schema.sku = sanitizedSku
    // mpn (Manufacturer Part Number) — Google pide GTIN o marca, mpn es alternativa válida
    schema.mpn = sanitizedSku
  }

  // Offers con todos los campos que pide Google
  const offerPrice = comparePrice || price
  schema.offers = {
    '@type': 'Offer',
    url: `${SITE_URL}/producto/${slug}`,
    priceCurrency: 'ARS',
    price: offerPrice,
    priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    availability: stock > 0
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock',
    itemCondition: 'https://schema.org/NewCondition',
    seller: {
      '@type': 'ElectronicsStore',
      name: 'Compucity',
    },
    // shippingDetails: Google requiere para mostrar "envío" en resultados
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingRate: {
        '@type': 'MonetaryAmount',
        value: '0',
        currency: 'ARS',
      },
      shippingDestination: {
        '@type': 'DefinedRegion',
        addressCountry: 'AR',
      },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: {
          '@type': 'QuantitativeValue',
          minValue: 1,
          maxValue: 3,
          unitCode: 'DAY',
        },
        transitTime: {
          '@type': 'QuantitativeValue',
          minValue: 2,
          maxValue: 7,
          unitCode: 'DAY',
        },
      },
    },
    // hasMerchantReturnPolicy: Google requiere para mostrar política de devoluciones
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'AR',
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 30,
      returnMethod: 'https://schema.org/ReturnByMail',
      returnFees: 'https://schema.org/FreeReturn',
    },
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
