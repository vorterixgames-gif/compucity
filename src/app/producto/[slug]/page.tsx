import { getProductBySlug } from '@/lib/queries'
import { notFound } from 'next/navigation'
import ProductDetailClient from './ProductDetailClient'
import ProductGallery from '@/components/ui-custom/ProductGallery'
import Breadcrumbs from '@/components/ui-custom/Breadcrumbs'
import ProductTabs from '@/components/ui-custom/ProductTabs'
import RelatedProducts from '@/components/ui-custom/RelatedProducts'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product) {
    notFound()
  }

  const images: string[] = product.images ? JSON.parse(product.images) : []
  const specs: Record<string, string> = product.specs ? JSON.parse(product.specs) : {}

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
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
            <p className="text-sm text-gray-500">Precio de lista: {formatPrice(product.price)}</p>
            {product.comparePrice && product.comparePrice < product.price ? (
              <p className="text-3xl font-bold text-green-600">{formatPrice(product.comparePrice)}</p>
            ) : (
              <p className="text-3xl font-bold text-gray-900">{formatPrice(product.price)}</p>
            )}
            {product.comparePrice && product.comparePrice < product.price && (
              <p className="text-sm text-green-600 mt-1">Precio en efectivo</p>
            )}
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
