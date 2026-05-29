'use client'

import { useState, useEffect, Suspense } from 'react'
import { Lock, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [validToken, setValidToken] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setVerifying(false)
      setValidToken(false)
      return
    }

    const verify = async () => {
      try {
        const res = await fetch(`/api/customer/reset-password?token=${token}`)
        const data = await res.json()
        setValidToken(data.valid === true)
      } catch {
        setValidToken(false)
      } finally {
        setVerifying(false)
      }
    }
    verify()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/customer/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al restablecer la contraseña')
        return
      }

      setSuccess(true)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // Loading state while verifying token
  if (verifying) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-compucity-green mx-auto mb-4" />
          <p className="text-gray-500">Verificando enlace...</p>
        </div>
      </div>
    )
  }

  // No token or invalid token
  if (!token || !validToken) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border rounded-xl p-8 text-center">
          <XCircle className="h-14 w-14 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Enlace inválido</h1>
          <p className="text-gray-500 mb-6">
            Este enlace expiró o ya fue usado. Solicitá uno nuevo para restablecer tu contraseña.
          </p>
          <Link
            href="/recuperar-contrasena"
            className="inline-flex items-center gap-2 px-6 py-3 bg-compucity-green text-white rounded-lg hover:bg-compucity-green-dark transition font-medium"
          >
            Solicitar nuevo enlace
          </Link>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border rounded-xl p-8 text-center">
          <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-3">¡Contraseña actualizada!</h1>
          <p className="text-gray-500 mb-6">
            Tu contraseña fue cambiada correctamente. Ya podés iniciar sesión con tu nueva contraseña.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-compucity-green text-white rounded-lg hover:bg-compucity-green-dark transition font-medium"
          >
            Ir a la tienda
          </Link>
        </div>
      </div>
    )
  }

  // Reset form
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white border rounded-xl p-8">
        <div className="text-center mb-6">
          <Lock className="h-12 w-12 text-compucity-green mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Nueva contraseña</h1>
          <p className="text-sm text-gray-500">
            Ingresá tu nueva contraseña para restablecer el acceso a tu cuenta.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="w-full border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-compucity-green"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repetí la contraseña"
                required
                minLength={6}
                className="w-full border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-compucity-green"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!password || !confirmPassword || loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-compucity-green text-white font-medium rounded-lg hover:bg-compucity-green-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {loading ? 'Guardando...' : 'Restablecer contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ResetearContrasenaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-compucity-green mx-auto mb-4" />
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
