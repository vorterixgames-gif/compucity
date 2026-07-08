import { getProductBySlug } from '@/lib/queries'
import { formatARS } from '@/lib/format'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import ProductDetailClient from './ProductDetailClient'
import ProductGallery from '@/components/ui-custom/ProductGallery'
import Breadcrumbs from '@/components/ui-custom/Breadcrumbs'
import ProductTabs from '@/components/ui-custom/ProductTabs'
import RelatedProducts from '@/components/ui-custom/RelatedProducts'
import { getActiveSale } from '@/lib/pricing'
import JsonLd, { getProductSchema, getBreadcrumbSchema } from '@/components/seo/JsonLd'

// Sesión 44: revalidate 5 min para reducir queries a Turso.
// Antes esta página era dinámica por defecto (cada visita = queries frescas).
// Como getProductBySlug ya tiene unstable_cache con tag 'products' y TTL 5 min,
// agregar revalidate=300 acá evita que se regenere el HTML en cada visita.
// Los cambios de admin invalidan el cache con revalidateTag('products') → instantáneo.
export const revalidate = 300

interface Props {
  params: Promise<{ slug: string }>
}

// Dynamic metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product) {
    return { title: 'Producto no encontrado' }
  }

  const images: string[] = product.images ? JSON.parse(product.images) : []
  // Sesión 51 d2: Opción B — usar siempre el og-image.jpg (con el logo de Compucity)
  // como og:image para los productos, en vez de la imagen del producto.
  // El dueño reportó: "el tema que me muestra el productos sin el logo de compucity".
  // Antes: si el producto tenía imagen, se usaba esa sola (sin logo de marca).
  // Ahora: siempre se usa og-image.jpg con el logo, igual que el home.
  // La imagen del producto sigue usándose en: la página del producto (galería),
  // el JSON-LD (structured data para Google), y los ProductCards del storefront.
  const imageUrl = 'https://www.compucityonline.com.ar/images/og-image-v2.jpg'

  const activeSale = getActiveSale(product as any)
  const displayPrice = activeSale !== null && activeSale < product.price ? activeSale : (product.comparePrice || product.price)

  const description = product.description
    ? `${product.description.slice(0, 155)}... - Comprá online en Compucity, La Falda, Córdoba.`
    : `${product.name} por $${displayPrice.toLocaleString('es-AR')}. Comprá online con envío a todo el país desde La Falda, Córdoba.`

  return {
    title: `${product.name} - Comprá Online`,
    description,
    alternates: {
      canonical: `https://www.compucityonline.com.ar/producto/${slug}`,
    },
    openGraph: {
      title: `${product.name} | Compucity`,
      description,
      url: `https://www.compucityonline.com.ar/producto/${slug}`,
      type: 'website',
      images: [{
        url: imageUrl,
        width: 800,
        height: 600,
        alt: product.name,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} | Compucity`,
      description,
      images: [imageUrl],
    },
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product) {
    notFound()
  }

  const images: string[] = product.images ? JSON.parse(product.images) : []
  const specs: Record<string, string> = product.specs ? JSON.parse(product.specs) : {}


  // Build structured data for this product
  // Sesión 43 día 3 (18/6): agregado brandName para que Google valide el producto.
  // Antes se usaba categoryName como brand, lo cual era incorrecto.
  const productJsonLd = getProductSchema({
    name: product.name,
    description: product.description,
    image: images[0] || null,
    price: product.price,
    comparePrice: product.comparePrice,
    sku: product.sku || null,
    slug: product.slug,
    stock: product.stock,
    categoryName: product.category?.name || null,
    brandName: (product as any).brandName || null,
  })

  // Build breadcrumb structured data
  const breadcrumbItems = [
    { name: 'Inicio', url: '/' },
    ...(product.category
      ? [{ name: product.category.name, url: `/categoria/${product.category.slug}` }]
      : []),
    { name: product.name },
  ]
  const breadcrumbJsonLd = getBreadcrumbSchema(breadcrumbItems)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Structured Data: Product + Breadcrumb */}
      <JsonLd data={productJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      {/* Breadcrumb */}
      <Breadcrumbs
        items={
          product.category
            ? [
                { label: product.category.name, href: `/categoria/${product.category.slug}` },
                { label: product.name },
              ]
            : [{ label: product.name }]
        }
      />

      <div className="grid md:grid-cols-2 gap-8">
        {/* Images */}
        <ProductGallery images={images} productName={product.name} />

        {/* Product Info */}
        <div>
          {product.category && (
            <p className="text-sm text-compucity-green mb-1">{product.category.name}</p>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>

          {/* Price */}
          <div className="mb-6">
            {(() => {
              const activeSale = getActiveSale(product as any)
              const isOnSale = activeSale !== null && activeSale < product.price
              const hasCashDiscount = product.comparePrice && product.comparePrice < product.price && !isOnSale

              if (isOnSale) {
                const discountPercent = Math.round((1 - activeSale! / product.price) * 100)
                // Calculate cash price from sale price as base
                const saleCashPrice = (product.comparePrice && product.comparePrice < product.price)
                  ? Math.ceil(activeSale! * (product.comparePrice / product.price))
                  : null
                return (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-green-600">{formatARS(activeSale!)}</p>
                      <span className="bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded">OFERTA -{discountPercent}%</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1 line-through">Precio de lista: {formatARS(product.price)}</p>
                    {saleCashPrice !== null && (
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-lg font-bold text-compucity-green-700">{formatARS(saleCashPrice)}</p>
                        <span className="bg-compucity-green-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">EFECTIVO</span>
                      </div>
                    )}
                  </>
                )
              }

              if (hasCashDiscount) {
                return (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-green-600">{formatARS(product.comparePrice!)}</p>
                      <span className="bg-compucity-green-800 text-white text-xs font-bold px-2 py-0.5 rounded">EFECTIVO</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">Precio de lista: {formatARS(product.price)}</p>
                  </>
                )
              }

              return <p className="text-3xl font-bold text-gray-900">{formatARS(product.price)}</p>
            })()}
            <p className="text-sm text-gray-500 mt-1">Hacé tu pedido por WhatsApp</p>
          </div>

          {/* Stock */}
          <div className="mb-6">
            {product.stock > 0 ? (
              <p className="text-sm text-green-600 font-medium">En stock ({product.stock} disponibles)</p>
            ) : (
              <p className="text-sm text-red-500 font-medium">Sin stock</p>
            )}
          </div>

          {/* Add to Cart */}
          <ProductDetailClient product={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: product.price,
            comparePrice: product.comparePrice,
            image: images[0] || null,
            stock: product.stock,
            salePrice: (product as any).salePrice ?? null,
            saleStart: (product as any).saleStart ?? null,
            saleEnd: (product as any).saleEnd ?? null,
          }} />

          {/* Tabs: Description, Specs, Shipping */}
          <div className="mt-8">
            <ProductTabs description={product.description} specs={specs} />
          </div>

          {/* SKU */}
          {product.sku && (
            <p className="mt-4 text-xs text-gray-400">SKU: {product.sku}</p>
          )}
        </div>
      </div>

      {/* Related Products */}
      <RelatedProducts
        categoryId={product.categoryId}
        productId={product.id}
      />
    </div>
  )
}
