import { getProductBySlug } from '@/lib/queries'
import { notFound } from 'next/navigation'
import ProductDetailClient from './ProductDetailClient'
import ProductGallery from '@/components/ui-custom/ProductGallery'
import Breadcrumbs from '@/components/ui-custom/Breadcrumbs'
import ProductTabs from '@/components/ui-custom/ProductTabs'
import RelatedProducts from '@/components/ui-custom/RelatedProducts'
import { getActiveSale } from '@/lib/pricing'

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
                      <p className="text-3xl font-bold text-green-600">{formatPrice(activeSale!)}</p>
                      <span className="bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded">OFERTA -{discountPercent}%</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1 line-through">Precio de lista: {formatPrice(product.price)}</p>
                    {saleCashPrice !== null && (
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-lg font-bold text-compucity-green-700">{formatPrice(saleCashPrice)}</p>
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
                      <p className="text-3xl font-bold text-green-600">{formatPrice(product.comparePrice!)}</p>
                      <span className="bg-compucity-green-800 text-white text-xs font-bold px-2 py-0.5 rounded">EFECTIVO</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">Precio de lista: {formatPrice(product.price)}</p>
                  </>
                )
              }

              return <p className="text-3xl font-bold text-gray-900">{formatPrice(product.price)}</p>
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
