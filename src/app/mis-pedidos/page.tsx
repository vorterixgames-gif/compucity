'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

export default function MisPedidosPage() {
  const [orderNumber, setOrderNumber] = useState('')

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Mis Pedidos</h1>
      <p className="text-gray-500 mb-8">Ingresá el número de pedido para ver el estado</p>
      
      <div className="flex max-w-md mx-auto">
        <input
          type="text"
          placeholder="Número de pedido (ej: COMP-001)"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          className="flex-1 px-4 py-3 border rounded-l-lg text-sm focus:outline-none focus:border-compucity-green"
        />
        <button className="px-6 py-3 bg-compucity-green text-white rounded-r-lg hover:bg-compucity-green-dark transition">
          <Search className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
