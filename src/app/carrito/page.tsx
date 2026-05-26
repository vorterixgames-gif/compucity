'use client'

import { useCart } from '@/store/cart'
import Link from 'next/link'
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft, MessageCircle } from 'lucide-react'

export default function CartPage() {
  const { items, removeItem, updateQuantity, totalPrice, clearCart } = useCart()

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center bg-white rounded-2xl border border-gray-100 shadow-sm p-8 md:p-10">
          <div className="w-20 h-20 rounded-full bg-compucity-green-50 flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="h-10 w-10 text-compucity-green" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Tu carrito está vacío</h1>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Explorá nuestros productos y encontrá lo que buscás. Tenemos las mejores ofertas en informática.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/categoria/todos"
              className="inline-flex items-center justify-center px-6 py-3 bg-compucity-green hover:bg-compucity-green-dark text-white font-semibold rounded-lg transition-all duration-200"
            >
              Ver productos
            </Link>
            <Link
              href="/arma-tu-pc"
              className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 hover:text-compucity-green hover:border-compucity-green font-semibold rounded-lg transition-all duration-200"
            >
              Arma tu PC
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Carrito ({items.length} {items.length === 1 ? 'producto' : 'productos'})</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Items */}
        <div className="md:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex gap-4 p-4 bg-white border rounded-lg">
              <img
                src={item.image || '/placeholder-product.png'}
                alt={item.name}
                className="w-24 h-24 object-cover rounded"
              />
              <div className="flex-1">
                <Link href={`/producto/${item.slug}`} className="font-medium text-gray-900 hover:text-compucity-green">
                  {item.name}
                </Link>
                <p className="text-lg font-bold text-gray-900 mt-1">{formatPrice(item.price)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="p-1 rounded border hover:bg-gray-50"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center text-sm">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="p-1 rounded border hover:bg-gray-50"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="ml-2 p-1 text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button onClick={clearCart} className="text-sm text-red-500 hover:text-red-700">
            Vaciar carrito
          </button>
        </div>

        {/* Summary */}
        <div className="bg-gray-50 rounded-lg p-6 h-fit">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h2>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">{formatPrice(totalPrice())}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Envío</span>
              <span className="text-gray-500">A coordinar por WhatsApp</span>
            </div>
          </div>
          <div className="border-t pt-3 mb-6">
            <div className="flex justify-between">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="text-xl font-bold text-gray-900">{formatPrice(totalPrice())}</span>
            </div>
          </div>
          <Link
            href="/checkout"
            className="block w-full text-center py-3 bg-compucity-green text-white font-semibold rounded-lg hover:bg-compucity-green-dark transition"
          >
            Finalizar pedido
          </Link>
          <p className="text-xs text-gray-500 text-center mt-2">
            Completás tus datos y enviamos el pedido por WhatsApp
          </p>
        </div>
      </div>
    </div>
  )
}
