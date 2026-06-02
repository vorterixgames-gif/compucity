'use client'

import Link from 'next/link'
import { ShoppingCart, Heart } from 'lucide-react'
import { useCart } from '@/store/cart'
import { useWishlist } from '@/store/wishlist'

interface ProductCardProps {
  id: string
  name: string
  slug: string
  price: number
  comparePrice?: number | null
  image?: string | null
  stock?: number
  isFeatured?: boolean
  isNew?: boolean
}

export default function ProductCard({ id, name, slug, price, comparePrice, image, stock, isFeatured, isNew }: ProductCardProps) {
  const addItem = useCart((s) => s.addItem)
  const toggleItem = useWishlist((s) => s.toggleItem)
  const isInWishlist = useWishlist((s) => s.isInWishlist(id))
  const imageUrl = image || '/placeholder-product.png'
  const hasDiscount = comparePrice && comparePrice < price

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    addItem({ id, name, price: comparePrice || price, image: imageUrl, slug })
  }

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleItem(id)
  }

  // Badge logic
  const showOfferBadge = false // Efectivo badge moved to price area
  const showFeaturedBadge = isFeatured
  const showLastUnitsBadge = stock !== undefined && stock > 0 && stock <= 3
  const showOutOfStock = stock !== undefined && stock <= 0

  // Stock indicator logic
  const showStockIndicator = stock !== undefined && stock > 0

  return (
    <Link
      href={`/producto/${slug}`}
      className="group flex flex-col bg-white rounded-xl border border-gray-100 hover:border-compucity-green-400/50 card-hover overflow-hidden shadow-sm hover:shadow-md"
    >
      {/* Image */}
      <div className="aspect-square bg-compucity-green-50 relative overflow-hidden p-3">
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src = '/placeholder-product.png'
          }}
        />

        {/* Badges - stacked vertically top-left */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {showOfferBadge && (
            <div className="bg-compucity-green-800 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
              EFECTIVO
            </div>
          )}
          {showFeaturedBadge && (
            <div className="bg-compucity-green-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
              DESTACADO
            </div>
          )}
          {isNew && (
            <div className="bg-compucity-green text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              NUEVO
            </div>
          )}
          {showLastUnitsBadge && (
            <div className="bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              ÚLTIMAS UNIDADES
            </div>
          )}
        </div>

        {/* Wishlist heart button - top right */}
        <button
          onClick={handleToggleWishlist}
          aria-label={isInWishlist ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center bg-white rounded-full shadow-md hover:shadow-lg transition-all duration-200 hover:scale-110 z-10"
        >
          <Heart
            className={`h-4 w-4 transition-colors ${
              isInWishlist
                ? 'fill-red-500 text-red-500'
                : 'text-gray-400 hover:text-red-400'
            }`}
          />
        </button>

        {/* Out of stock overlay */}
        {showOutOfStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center backdrop-blur-[1px]">
            <span className="text-gray-600 font-semibold text-sm bg-white px-3 py-1.5 rounded-lg border border-gray-200">Sin stock</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 p-4">
        <h3 className="text-sm font-medium text-gray-800 line-clamp-2 mb-3 group-hover:text-compucity-green-700 transition-colors min-h-[2.5rem]">
          {name}
        </h3>
        <div className="mt-auto space-y-0.5">
          {hasDiscount ? (
            <div className="flex items-center gap-2">
              <p className="text-lg font-extrabold text-compucity-green-700">{formatPrice(comparePrice!)}</p>
              <span className="bg-compucity-green-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">EFECTIVO</span>
            </div>
          ) : (
            <p className="text-lg font-extrabold text-compucity-green-800">{formatPrice(price)}</p>
          )}
          {hasDiscount && (
            <p className="text-xs text-gray-400">Lista: {formatPrice(price)}</p>
          )}

          {/* Stock indicator */}
          {showStockIndicator && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-1.5 h-1.5 rounded-full ${stock! > 5 ? 'bg-green-500' : 'bg-orange-400'}`} />
              <span className={`text-[11px] font-medium ${stock! > 5 ? 'text-green-600' : 'text-orange-500'}`}>
                {stock! > 5 ? 'En stock' : 'Pocas unidades'}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={handleAddToCart}
          disabled={stock !== undefined && stock <= 0}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-compucity-green-700 hover:bg-compucity-green-800 text-white text-sm font-semibold rounded-lg disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <ShoppingCart className="h-4 w-4" />
          {stock !== undefined && stock <= 0 ? 'Sin stock' : 'Comprar'}
        </button>
      </div>
    </Link>
  )
}
