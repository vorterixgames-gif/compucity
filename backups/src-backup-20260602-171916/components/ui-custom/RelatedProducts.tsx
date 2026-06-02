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
}

interface RelatedProductsProps {
  categoryId: string | null
  productId: string
}

export default function RelatedProducts({ categoryId, productId }: RelatedProductsProps) {
  const [products, setProducts] = useState<RelatedProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams({ productId })
    if (categoryId) params.set('categoryId', categoryId)

    fetch(`/api/related-products?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.products) {
          setProducts(data.products)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch related products:', err)
      })
      .finally(() => {
        setLoading(false)
      })
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
            />
          ))}
        </div>
      )}
    </FadeIn>
  )
}
