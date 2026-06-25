'use client'

import { useEffect, useState } from 'react'
import ProductCard from '@/components/ui-custom/ProductCard'
import ProductCardSkeleton from '@/components/ui-custom/ProductCardSkeleton'
import FadeIn from '@/components/ui-custom/FadeIn'

interface RelatedProduct {
  id: string
  name: string
  slug: string
  price: number
  comparePrice: number | null
  image: string | null
  stock: number
  isFeatured?: number
  salePrice?: number | null
  saleStart?: string | null
  saleEnd?: string | null
}

interface RelatedProductsProps {
  categoryId: string | null
  productId: string
}

export default function RelatedProducts({ categoryId, productId }: RelatedProductsProps) {
  const [products, setProducts] = useState<RelatedProduct[]>([])
  const [loading, setLoading] = useState(true)

  // Sesión 46: agregado AbortController para evitar setear state en componente desmontado
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    const params = new URLSearchParams({ productId })
    if (categoryId) params.set('categoryId', categoryId)

    fetch(`/api/related-products?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted) {
          if (data.ok && data.products) {
            setProducts(data.products)
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch related products:', err)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [categoryId, productId])

  // Don't render anything if no related products found and not loading
  if (!loading && products.length === 0) {
    return null
  }

  return (
    <FadeIn className="mt-12">
      <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">
        Productos relacionados
      </h2>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              slug={product.slug}
              price={product.price}
              comparePrice={product.comparePrice}
              image={product.image}
              stock={product.stock}
              isFeatured={product.isFeatured === 1}
              salePrice={product.salePrice}
              saleStart={product.saleStart}
              saleEnd={product.saleEnd}
            />
          ))}
        </div>
      )}
    </FadeIn>
  )
}
