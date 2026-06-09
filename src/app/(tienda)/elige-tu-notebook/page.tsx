import Link from 'next/link'
import { Laptop, MessageCircle, Sparkles, Shield, Truck } from 'lucide-react'
import NotebookAssistantChat from '@/components/notebook-assistant-chat'
import EligeTuNotebookClient from './EligeTuNotebookClient'

export const metadata = {
  title: 'Elegí tu Notebook | Compucity',
  description: 'Dejate asesorar por Citi, nuestro asistente inteligente, y encontrá la notebook ideal para vos. Gaming, oficina, estudio o diseño.',
}

export default function EligeTuNotebookPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-700 via-indigo-700 to-blue-800 text-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-300 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 py-12 md:py-20 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span className="text-sm font-medium">Asistente inteligente</span>
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
              Encontrá la notebook ideal para vos
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Contale a Citi qué necesitás y tu presupuesto, y te recomienda las mejores opciones. Elegí la tuya y va directo al carrito.
            </p>

            {/* CTA */}
            <EligeTuNotebookClient />
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-10">
          ¿Cómo funciona?
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Step 1 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center hover:shadow-lg transition">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-7 h-7" />
            </div>
            <div className="text-sm font-bold text-blue-600 mb-2">Paso 1</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Contale qué necesitás</h3>
            <p className="text-sm text-gray-500">
              Decile a Citi para qué vas a usar la notebook (gaming, oficina, estudio, diseño) y tu presupuesto aproximado.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center hover:shadow-lg transition">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7" />
            </div>
            <div className="text-sm font-bold text-indigo-600 mb-2">Paso 2</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Recibí 3 recomendaciones</h3>
            <p className="text-sm text-gray-500">
              Citi analiza nuestro catálogo y te recomienda 3 opciones: Económica, Recomendada y Premium, con las specs de cada una.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center hover:shadow-lg transition">
            <div className="w-14 h-14 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
              <Laptop className="w-7 h-7" />
            </div>
            <div className="text-sm font-bold text-green-600 mb-2">Paso 3</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Elegí y al carrito</h3>
            <p className="text-sm text-gray-500">
              Seleccioná la notebook que más te guste y se agrega directamente al carrito. Simple y rápido.
            </p>
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            <span>Garantía oficial</span>
          </div>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            <span>Envíos a todo el país</span>
          </div>
          <div className="flex items-center gap-2">
            <Laptop className="w-5 h-5 text-indigo-600" />
            <span>Marcas líderes</span>
          </div>
        </div>

        {/* Popular categories */}
        <div className="mt-16">
          <h3 className="text-xl font-bold text-center text-gray-900 mb-6">
            También podés explorar por categoría
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
            <Link
              href="/categoria/notebooks"
              className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-blue-300 hover:shadow-md transition group"
            >
              <Laptop className="w-6 h-6 text-blue-600 mx-auto mb-2 group-hover:scale-110 transition" />
              <span className="text-sm font-medium text-gray-700">Notebooks</span>
            </Link>
            <Link
              href="/categoria/gamer-y-diseno"
              className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-purple-300 hover:shadow-md transition group"
            >
              <Sparkles className="w-6 h-6 text-purple-600 mx-auto mb-2 group-hover:scale-110 transition" />
              <span className="text-sm font-medium text-gray-700">Gamer y Diseño</span>
            </Link>
            <Link
              href="/categoria/oficina"
              className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-green-300 hover:shadow-md transition group"
            >
              <Shield className="w-6 h-6 text-green-600 mx-auto mb-2 group-hover:scale-110 transition" />
              <span className="text-sm font-medium text-gray-700">Oficina</span>
            </Link>
            <Link
              href="/arma-tu-pc"
              className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-orange-300 hover:shadow-md transition group"
            >
              <MessageCircle className="w-6 h-6 text-orange-600 mx-auto mb-2 group-hover:scale-110 transition" />
              <span className="text-sm font-medium text-gray-700">Arma tu PC</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Chatbot - floating */}
      <NotebookAssistantChat />
    </div>
  )
}
