'use client'

import { useState } from 'react'
import { Mail, ArrowLeft, MessageCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const storePhone = '5493517656918'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/customer/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al procesar la solicitud')
        return
      }

      setSubmitted(true)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const whatsappMessage = encodeURIComponent(
    `Hola, necesito restablecer mi contraseña. Mi email es: ${email}`
  )
  const whatsappUrl = `https://wa.me/${storePhone}?text=${whatsappMessage}`

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {submitted ? (
          <div className="text-center bg-white border rounded-xl p-8">
            <MessageCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-3">¡Solicitud recibida!</h1>
            <p className="text-gray-600 mb-6">
              Para restablecer tu contraseña, contactanos por WhatsApp. Un vendedor te va a enviar un enlace de recuperación.
            </p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition mb-4"
            >
              <MessageCircle className="h-5 w-5" />
              Contactar por WhatsApp
            </a>
            <p className="text-xs text-gray-400 mb-6">
              Se va a abrir WhatsApp con un mensaje prellenado. Solo tenés que enviarlo.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-compucity-green font-medium hover:text-compucity-green-dark transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a la tienda
            </Link>
          </div>
        ) : (
          <div className="bg-white border rounded-xl p-8">
            <div className="text-center mb-6">
              <Mail className="h-12 w-12 text-compucity-green mx-auto mb-3" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">¿Olvidaste tu contraseña?</h1>
              <p className="text-sm text-gray-500">
                Ingresá tu email y te ayudamos a restablecerla por WhatsApp.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    className="w-full border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-compucity-green"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!email || loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-compucity-green text-white font-medium rounded-lg hover:bg-compucity-green-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                {loading ? 'Procesando...' : 'Continuar'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver a la tienda
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
