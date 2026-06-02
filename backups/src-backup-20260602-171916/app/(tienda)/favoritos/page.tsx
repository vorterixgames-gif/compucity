'use client'

import { useEffect, useState } from 'react'
import { Heart, ArrowRight } from 'lucide-react'
import { useWishlist } from '@/store/wishlist'
import ProductCard from '@/components/ui-custom/ProductCard'

interface FavProduct {
  id: string
  name: string
  slug: string
  price: number
  comparePrice: number | null
  images: string
  stock: number
}

export default function FavoritosPage() {
  const items = useWishlist((s) => s.items)
  const [products, setProducts] = useState<FavProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (items.length === 0) {
      setProducts([])
      setLoading(false)
      return
    }

    const fetchProducts = async () => {
      setLoading(true)
      try {
        // Fetch product details for each wishlist item
        const results = await Promise.all(
          items.map(async (id) => {
            try {
              const res = await fetch(`/api/products?id=${id}`)
              const data = await res.json()
              if (data.ok && data.product) {
                return data.product as FavProduct
              }
              return null
            } catch {
              return null
            }
          })
        )
        setProducts(results.filter((p): p is FavProduct => p !== null))
      } catch {
        setProducts([])
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [items])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Heart className="h-6 w-6 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900">Favoritos</h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0 || products.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center">
          <div className="mx-auto w-20 h-20 bg-compucity-green-50 rounded-full flex items-center justify-center mb-6">
            <Heart className="h-10 w-10 text-compucity-green" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">No tenés productos favoritos</h1>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Explorá nuestro catálogo y hacé clic en el corazón para guardar los productos que más te gusten.
          </p>
          <a
            href="/categoria/todos"
            className="inline-flex items-center gap-2 px-6 py-3 bg-compucity-green text-white font-semibold rounded-lg hover:bg-compucity-green-dark transition"
          >
            Ver productos
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Heart className="h-6 w-6 text-red-500 fill-red-500" />
        <h1 className="text-2xl font-bold text-gray-900">Favoritos</h1>
        <span className="text-sm text-gray-500">({products.length} producto{products.length !== 1 ? 's' : ''})</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            id={product.id}
            name={product.name}
            slug={product.slug}
            price={product.price}
            comparePrice={product.comparePrice}
            image={product.images ? JSON.parse(product.images)[0] : null}
            stock={product.stock}
          />
        ))}
      </div>
    </div>
  )
}
