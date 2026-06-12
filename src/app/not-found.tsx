import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Página no encontrada',
  description: 'La página que buscás no existe. Volvé al inicio de Compucity, tu tienda de informática en La Falda, Córdoba.',
}

export default function NotFound() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <h1 className="text-6xl font-bold text-compucity-green mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Página no encontrada</h2>
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        Lo sentimos, la página que buscás no existe o fue removida. Volvé al inicio para seguir comprando.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-compucity-green text-white font-semibold rounded-lg hover:bg-compucity-green-700 transition"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
