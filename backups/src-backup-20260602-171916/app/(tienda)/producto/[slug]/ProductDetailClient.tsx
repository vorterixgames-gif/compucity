'use client'

import { useCart } from '@/store/cart'
import { useWishlist } from '@/store/wishlist'
import { ShoppingCart, MessageCircle, Heart } from 'lucide-react'

interface Props {
  product: {
    id: string
    name: string
    slug: string
    price: number
    comparePrice?: number | null
    image: string | null
    stock: number
  }
}

export default function ProductDetailClient({ product }: Props) {
  const addItem = useCart((s) => s.addItem)
  const toggleItem = useWishlist((s) => s.toggleItem)
  const isInWishlist = useWishlist((s) => s.isInWishlist(product.id))
  const effectivePrice = (product.comparePrice && product.comparePrice < product.price) 
    ? product.comparePrice 
    : product.price

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      name: product.name,
      price: effectivePrice,
      image: product.image || '/placeholder-product.png',
      slug: product.slug,
    })
  }

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleItem(product.id)
  }

  const whatsappMsg = encodeURIComponent(`Hola! Me interesa el producto: ${product.name}`)

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <button
          onClick={handleAddToCart}
          disabled={product.stock <= 0}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-compucity-green text-white font-semibold rounded-lg hover:bg-compucity-green-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition text-lg"
        >
          <ShoppingCart className="h-5 w-5" />
          {product.stock > 0 ? 'Agregar al carrito' : 'Sin stock'}
        </button>
        <button
          onClick={handleToggleWishlist}
          aria-label={isInWishlist ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          className="h-[52px] w-[52px] flex items-center justify-center border-2 rounded-lg transition-all duration-200 hover:scale-105 shrink-0"
          style={{
            borderColor: isInWishlist ? '#ef4444' : '#d1d5db',
            backgroundColor: isInWishlist ? '#fef2f2' : 'white',
          }}
        >
          <Heart
            className={`h-5 w-5 transition-colors ${
              isInWishlist
                ? 'fill-red-500 text-red-500'
                : 'text-gray-400'
            }`}
          />
        </button>
      </div>

      <a
        href={`https://wa.me/5493517656918?text=${whatsappMsg}`}
        target="_blank"
        className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition"
      >
        <MessageCircle className="h-5 w-5" />
        Consultar por WhatsApp
      </a>
    </div>
  )
}
