'use client'

import { useState, useEffect } from 'react'
import { useCart } from '@/store/cart'
import { Truck, MapPin, MessageCircle, User, Phone, Mail, FileText, Package, Loader2, ChevronRight, ArrowLeft, LogIn, X, Eye, EyeOff, UserPlus, CheckCircle } from 'lucide-react'
import Link from 'next/link'

interface LoggedInCustomer {
  id: string
  name: string
  email: string
  phone: string | null
  dni: string | null
  address?: string | null
  city?: string | null
  province?: string | null
  postalCode?: string | null
}

interface ShippingQuote {
  carrier: string
  carrierName: string
  service: string
  serviceName: string
  price: number
  estimatedDays: string
  description: string
}

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart()
  const [step, setStep] = useState<'data' | 'shipping'>('data')
  const [loggedInCustomer, setLoggedInCustomer] = useState<LoggedInCustomer | null>(null)
  const [customerData, setCustomerData] = useState({
    name: '',
    dni: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    notes: '',
  })
  const [shippingMethod, setShippingMethod] = useState<'retiro' | 'envio'>('retiro')

  // Check if customer is logged in and pre-fill data
  useEffect(() => {
    const checkCustomer = async () => {
      try {
        const res = await fetch('/api/customer/me')
        if (res.ok) {
          const data = await res.json()
          const c = data.customer as LoggedInCustomer
          setLoggedInCustomer(c)
          setCustomerData(prev => ({
            ...prev,
            name: c.name || prev.name,
            email: c.email || prev.email,
            phone: c.phone || prev.phone,
            dni: c.dni || prev.dni,
            address: c.address || prev.address,
            city: c.city || prev.city,
            province: c.province || prev.province,
            postalCode: c.postalCode || prev.postalCode,
          }))
        }
      } catch {
        // Not logged in, that's fine
      }
    }
    checkCustomer()
  }, [])
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuote[]>([])
  const [selectedQuote, setSelectedQuote] = useState<ShippingQuote | null>(null)
  const [loadingShipping, setLoadingShipping] = useState(false)
  const [shippingError, setShippingError] = useState('')

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

  const shippingCost = selectedQuote?.price || 0
  const grandTotal = totalPrice() + shippingCost

  // Calcular envío cuando cambia el CP o el método
  useEffect(() => {
    if (shippingMethod === 'retiro') {
      setSelectedQuote({
        carrier: 'retiro',
        carrierName: 'Retiro en local',
        service: 'retiro',
        serviceName: 'Retiro en CompuCity',
        price: 0,
        estimatedDays: 'Inmediato',
        description: 'La Falda, Córdoba',
      })
      setShippingQuotes([])
      return
    }

    const cp = customerData.postalCode.trim()
    if (!/^\d{4,5}$/.test(cp)) {
      setShippingQuotes([])
      setSelectedQuote(null)
      return
    }

    const fetchShipping = async () => {
      setLoadingShipping(true)
      setShippingError('')
      try {
        const res = await fetch(`/api/shipping?cp=${cp}&items=${items.length}`)
        const data = await res.json()
        if (data.ok && data.quotes.length > 0) {
          setShippingQuotes(data.quotes)
          // Seleccionar la primera opción por defecto (más económica)
          setSelectedQuote(data.quotes[0])
        } else {
          setShippingError(data.error || 'No hay opciones de envío para ese código postal')
          setShippingQuotes([])
          setSelectedQuote(null)
        }
      } catch {
        setShippingError('Error al consultar el costo de envío')
        setShippingQuotes([])
        setSelectedQuote(null)
      } finally {
        setLoadingShipping(false)
      }
    }

    // Debounce de 500ms
    const timer = setTimeout(fetchShipping, 500)
    return () => clearTimeout(timer)
  }, [customerData.postalCode, shippingMethod, items.length])

  const generateWhatsAppMessage = () => {
    const storePhone = '5493517656918'

    let message = `🛒 *NUEVO PEDIDO - COMPUCITY*\n\n`
    message += `👤 *Cliente:*\n`
    message += `   Nombre: ${customerData.name}\n`
    message += `   DNI: ${customerData.dni}\n`
    message += `   Teléfono: ${customerData.phone}\n`
    if (customerData.email) message += `   Email: ${customerData.email}\n`
    message += `\n📦 *Envío:*\n`
    if (shippingMethod === 'retiro') {
      message += `   Retiro en local - La Falda, Córdoba - Gratis\n`
    } else {
      message += `   ${selectedQuote?.serviceName || 'Envío por correo'}\n`
      message += `   Dirección: ${customerData.address}\n`
      message += `   Ciudad: ${customerData.city}\n`
      if (customerData.province) message += `   Provincia: ${customerData.province}\n`
      message += `   CP: ${customerData.postalCode}\n`
      message += `   Costo envío: ${formatPrice(shippingCost)}\n`
      message += `   Plazo: ${selectedQuote?.estimatedDays || 'a confirmar'}\n`
    }
    message += `\n🛍️ *Productos:*\n`
    items.forEach((item, i) => {
      message += `   ${i + 1}. ${item.name} x${item.quantity} - ${formatPrice(item.price * item.quantity)}\n`
    })
    message += `\n💰 *Subtotal: ${formatPrice(totalPrice())}*\n`
    if (shippingCost > 0) {
      message += `📦 *Envío: ${formatPrice(shippingCost)}*\n`
    }
    message += `💵 *Total: ${formatPrice(grandTotal)}*\n`
    if (customerData.notes) {
      message += `\n📝 *Notas:* ${customerData.notes}\n`
    }
    message += `\n---\nPedido enviado desde la tienda online`

    return `https://wa.me/${storePhone}?text=${encodeURIComponent(message)}`
  }

  const [sending, setSending] = useState(false)
  const [orderError, setOrderError] = useState('')

  // Login modal state
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Post-order account creation state
  const [showAccountOffer, setShowAccountOffer] = useState(false)
  const [createAccountPassword, setCreateAccountPassword] = useState('')
  const [createAccountLoading, setCreateAccountLoading] = useState(false)
  const [createAccountError, setCreateAccountError] = useState('')
  const [accountCreated, setAccountCreated] = useState(false)
  const [orderCompleted, setOrderCompleted] = useState(false)
  const [honeypot, setHoneypot] = useState('')

  const handleLogin = async () => {
    setLoginLoading(true)
    setLoginError('')
    try {
      const res = await fetch('/api/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLoginError(data.error || 'Credenciales inválidas')
        setLoginLoading(false)
        return
      }
      // Login exitoso - actualizar datos del cliente
      const c = data.customer as LoggedInCustomer
      setLoggedInCustomer(c)
      setCustomerData(prev => ({
        ...prev,
        name: c.name || prev.name,
        email: c.email || prev.email,
        phone: c.phone || prev.phone,
        dni: c.dni || prev.dni,
        address: c.address || prev.address,
        city: c.city || prev.city,
        province: c.province || prev.province,
        postalCode: c.postalCode || prev.postalCode,
      }))
      setShowLoginModal(false)
      setLoginEmail('')
      setLoginPassword('')
    } catch {
      setLoginError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleCreateAccount = async () => {
    // Honeypot check - si el campo oculto tiene contenido, es un bot
    if (honeypot) return
    setCreateAccountLoading(true)
    setCreateAccountError('')
    try {
      const res = await fetch('/api/customer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customerData.name,
          email: customerData.email,
          phone: customerData.phone,
          password: createAccountPassword,
          dni: customerData.dni,
          address: customerData.address,
          city: customerData.city,
          province: customerData.province,
          postalCode: customerData.postalCode,
          _hp: honeypot,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateAccountError(data.error || 'Error al crear la cuenta')
        setCreateAccountLoading(false)
        return
      }
      setAccountCreated(true)
      const c = data.customer as LoggedInCustomer
      setLoggedInCustomer(c)
    } catch {
      setCreateAccountError('Error de conexión. Intentá de nuevo.')
    } finally {
      setCreateAccountLoading(false)
    }
  }

  const handleSendWhatsApp = async () => {
    setSending(true)
    setOrderError('')
    try {
      // 1. Guardar pedido en la base de datos
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerData.name,
          customerDni: customerData.dni,
          customerEmail: customerData.email,
          customerPhone: customerData.phone,
          customerId: loggedInCustomer?.id || null,
          shippingAddress: customerData.address,
          shippingCity: customerData.city,
          shippingProvince: customerData.province,
          shippingZip: customerData.postalCode,
          shippingMethod: shippingMethod === 'retiro' ? 'retiro' : 'envio',
          shippingCost,
          shippingDetails: shippingMethod === 'envio' && selectedQuote
            ? JSON.stringify({ carrier: selectedQuote.carrier, carrierName: selectedQuote.carrierName, service: selectedQuote.service, serviceName: selectedQuote.serviceName, price: selectedQuote.price, estimatedDays: selectedQuote.estimatedDays, description: selectedQuote.description })
            : JSON.stringify({ method: 'retiro', description: 'Retiro en local - La Falda, Córdoba' }),
          notes: customerData.notes,
          items: items.map(item => ({
            productId: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
          total: grandTotal,
        }),
      })

      const orderData = await orderRes.json()

      if (!orderRes.ok) {
        setOrderError(orderData.error || 'Error al guardar el pedido')
        setSending(false)
        return
      }

      // 2. Abrir WhatsApp con el mensaje
      const url = generateWhatsAppMessage()
      window.open(url, '_blank')
      clearCart()

      // 3. Si no está logueado y tiene email, ofrecer crear cuenta
      if (!loggedInCustomer && customerData.email) {
        setShowAccountOffer(true)
      }
      setOrderCompleted(true)
    } catch (err) {
      setOrderError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  // Pantalla de pedido completado
  if (orderCompleted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">¡Pedido enviado!</h1>
        <p className="text-gray-500 mb-6">
          Tu pedido fue enviado por WhatsApp. Un vendedor se va a contactar a la brevedad para confirmar y coordinar el pago y la entrega.
        </p>

        {/* Ofrecer crear cuenta si no está logueado y tiene email */}
        {showAccountOffer && !accountCreated && (
          <div className="relative mt-6 p-6 bg-compucity-green-50 border border-compucity-green-100 rounded-xl text-left max-w-md mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="h-5 w-5 text-compucity-green" />
              <h3 className="font-semibold text-compucity-green-900">¿Querés crear una cuenta?</h3>
            </div>
            <p className="text-sm text-compucity-green-700 mb-4">
              Con una cuenta podés seguir tus pedidos, guardar tus datos para la próxima compra y acceder a ofertas exclusivas.
            </p>
            {createAccountError && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{createAccountError}</div>
            )}
            <div className="space-y-3">
              {/* Honeypot - campo oculto para bots, los humanos no lo ven */}
              <div className="absolute opacity-0 h-0 w-0 overflow-hidden" aria-hidden="true" tabIndex={-1}>
                <label htmlFor="website_hp">No completar este campo</label>
                <input
                  id="website_hp"
                  type="text"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  placeholder="Dejar vacío"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña</label>
                <input
                  type="password"
                  value={createAccountPassword}
                  onChange={(e) => setCreateAccountPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-compucity-green"
                />
              </div>
              <button
                onClick={handleCreateAccount}
                disabled={createAccountPassword.length < 6 || createAccountLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-compucity-green text-white font-medium rounded-lg hover:bg-compucity-green-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                {createAccountLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {createAccountLoading ? 'Creando cuenta...' : 'Crear mi cuenta'}
              </button>
              <button
                onClick={() => setShowAccountOffer(false)}
                className="w-full text-sm text-gray-400 hover:text-gray-600 transition"
              >
                No, gracias
              </button>
            </div>
          </div>
        )}

        {accountCreated && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl max-w-md mx-auto">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <p className="font-semibold text-green-800">¡Cuenta creada con éxito!</p>
            <p className="text-sm text-green-700 mt-1">Ya podés seguir tus pedidos desde "Mis pedidos" en el menú.</p>
          </div>
        )}

        <Link href="/" className="inline-block mt-6 px-6 py-3 bg-compucity-green text-white rounded-lg hover:bg-compucity-green-dark transition">
          Volver a la tienda
        </Link>
      </div>
    )
  }

  if (items.length === 0 && !orderCompleted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Tu carrito está vacío</h1>
        <p className="text-gray-500 mb-6">Agregá productos al carrito para hacer un pedido.</p>
        <Link href="/" className="px-6 py-3 bg-compucity-green text-white rounded-lg hover:bg-compucity-green-dark transition">
          Ver productos
        </Link>
      </div>
    )
  }

  const canProceedFromData = customerData.name && customerData.phone
  const canSendOrder = customerData.name && customerData.phone && (
    shippingMethod === 'retiro' || (
      customerData.address && customerData.city && customerData.province && customerData.postalCode && selectedQuote
    )
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Finalizar Pedido</h1>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-8">
        {(['data', 'shipping'] as const).map((s, i) => {
          const labels = ['Tus datos', 'Envío']
          const icons = [User, Truck]
          const Icon = icons[i]
          const isActive = step === s
          const isDone = ['data', 'shipping'].indexOf(step) > i
          return (
            <button key={s} onClick={() => { if (isDone) setStep(s) }} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${isActive ? 'bg-compucity-green text-white' : isDone ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className={`text-sm ${isActive ? 'text-compucity-green font-medium' : 'text-gray-500'}`}>{labels[i]}</span>
              {i < 1 && <div className="w-12 h-0.5 bg-gray-200 mx-2" />}
            </button>
          )
        })}
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Form */}
        <div className="md:col-span-2">
          {step === 'data' && (
            <div className="space-y-4">
              {/* Login prompt - solo si NO está logueado */}
              {!loggedInCustomer && (
                <div className="flex items-center justify-between p-4 bg-compucity-green-50 border border-compucity-green-100 rounded-lg">
                  <div className="flex items-center gap-2">
                    <LogIn className="h-4 w-4 text-compucity-green shrink-0" />
                    <span className="text-sm text-compucity-green-900">¿Ya tenés una cuenta?</span>
                  </div>
                  <button
                    onClick={() => { setShowLoginModal(true); setLoginError('') }}
                    className="text-sm font-semibold text-compucity-green hover:text-compucity-green-dark transition"
                  >
                    Iniciá sesión
                  </button>
                </div>
              )}

              {/* Logged in indicator */}
              {loggedInCustomer && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-sm text-green-800">
                    Sesión iniciada como <strong>{loggedInCustomer.name}</strong> — tus datos se cargaron automáticamente
                  </span>
                </div>
              )}

              <div className="bg-white border rounded-lg p-6 space-y-4">
                <h2 className="text-lg font-semibold">Tus datos</h2>
                <p className="text-sm text-gray-500">Completá tus datos para que los vendedores puedan contactarte y coordinar la entrega.</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={customerData.name}
                      onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                      placeholder="Juan Pérez"
                      className="w-full border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-compucity-green"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DNI</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={customerData.dni}
                      onChange={(e) => setCustomerData({ ...customerData, dni: e.target.value })}
                      placeholder="12345678"
                      className="w-full border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-compucity-green"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="tel"
                      value={customerData.phone}
                      onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                      placeholder="351 1234567"
                      className="w-full border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-compucity-green"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      value={customerData.email}
                      onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                      placeholder="juan@email.com"
                      className="w-full border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-compucity-green"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas o consultas</label>
                <textarea
                  value={customerData.notes}
                  onChange={(e) => setCustomerData({ ...customerData, notes: e.target.value })}
                  placeholder="Algún comentario sobre tu pedido, forma de pago preferida, consulta, etc."
                  rows={3}
                  className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-compucity-green resize-none"
                />
              </div>
              <button
                onClick={() => setStep('shipping')}
                disabled={!canProceedFromData}
                className="w-full flex items-center justify-center gap-2 py-3 bg-compucity-green text-white font-medium rounded-lg hover:bg-compucity-green-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition mt-2"
              >
                Continuar
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            </div>
          )}

          {step === 'shipping' && (
            <div className="space-y-4 bg-white border rounded-lg p-6">
              <h2 className="text-lg font-semibold">Método de envío</h2>

              {/* Opciones de envío */}
              <div className="space-y-3">
                {/* Retiro en local */}
                <label className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition ${shippingMethod === 'retiro' ? 'border-compucity-green bg-compucity-green-50' : 'hover:border-compucity-cyan-light'}`}>
                  <input
                    type="radio"
                    name="shipping"
                    value="retiro"
                    checked={shippingMethod === 'retiro'}
                    onChange={() => setShippingMethod('retiro')}
                    className="text-compucity-green"
                  />
                  <MapPin className="h-5 w-5 text-compucity-green" />
                  <div className="flex-1">
                    <p className="font-medium">Retiro en local</p>
                    <p className="text-sm text-gray-500">La Falda, Córdoba - Gratis</p>
                  </div>
                  <span className="text-sm font-semibold text-green-600">Gratis</span>
                </label>

                {/* Envío a domicilio */}
                <label className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition ${shippingMethod === 'envio' ? 'border-compucity-green bg-compucity-green-50' : 'hover:border-compucity-cyan-light'}`}>
                  <input
                    type="radio"
                    name="shipping"
                    value="envio"
                    checked={shippingMethod === 'envio'}
                    onChange={() => setShippingMethod('envio')}
                    className="text-compucity-green"
                  />
                  <Truck className="h-5 w-5 text-compucity-green" />
                  <div className="flex-1">
                    <p className="font-medium">Envío a domicilio</p>
                    <p className="text-sm text-gray-500">Andreani o Correo Argentino - Se cotiza según destino</p>
                  </div>
                </label>
              </div>

              {/* Datos de envío + Calculadora */}
              {shippingMethod === 'envio' && (
                <div className="space-y-4 mt-4">
                  {/* Código postal */}
                  <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <MapPin className="inline h-4 w-4 mr-1" />
                        Código Postal *
                      </label>
                      <input
                        type="text"
                        value={customerData.postalCode}
                        onChange={(e) => setCustomerData({ ...customerData, postalCode: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                        placeholder="Ej: 5000"
                        className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-compucity-green"
                        maxLength={5}
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Ingresá tu código postal para calcular el costo de envío
                      </p>
                    </div>

                    {/* Loading */}
                    {loadingShipping && (
                      <div className="flex items-center gap-2 text-sm text-compucity-green">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Calculando costo de envío...
                      </div>
                    )}

                    {/* Error */}
                    {shippingError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                        {shippingError}
                      </div>
                    )}

                    {/* Resultados de cotización */}
                    {shippingQuotes.length > 0 && !loadingShipping && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">Opciones de envío:</p>
                        {shippingQuotes.map((quote, i) => (
                          <label
                            key={i}
                            className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                              selectedQuote?.serviceName === quote.serviceName
                                ? 'border-compucity-green bg-compucity-green-50'
                                : 'hover:border-compucity-cyan-light bg-white'
                            }`}
                          >
                            <input
                              type="radio"
                              name="shippingQuote"
                              value={i}
                              checked={selectedQuote?.serviceName === quote.serviceName}
                              onChange={() => setSelectedQuote(quote)}
                              className="text-compucity-green"
                            />
                            <Package className="h-5 w-5 text-gray-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{quote.serviceName}</p>
                              <p className="text-xs text-gray-500">{quote.estimatedDays} · {quote.description}</p>
                            </div>
                            <span className="font-semibold text-sm whitespace-nowrap">
                              {quote.price === 0 ? 'Gratis' : formatPrice(quote.price)}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Dirección de envío */}
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dirección *</label>
                      <input
                        type="text"
                        value={customerData.address}
                        onChange={(e) => setCustomerData({ ...customerData, address: e.target.value })}
                        placeholder="Calle, número, piso, depto"
                        className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-compucity-green"
                      />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad / Localidad *</label>
                        <input
                          type="text"
                          value={customerData.city}
                          onChange={(e) => setCustomerData({ ...customerData, city: e.target.value })}
                          placeholder="Córdoba Capital"
                          className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-compucity-green"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Provincia *</label>
                        <select
                          value={customerData.province}
                          onChange={(e) => setCustomerData({ ...customerData, province: e.target.value })}
                          className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-compucity-green bg-white"
                        >
                          <option value="">Seleccionar provincia</option>
                          <option value="Buenos Aires">Buenos Aires</option>
                          <option value="CABA">Ciudad Autónoma de Buenos Aires</option>
                          <option value="Catamarca">Catamarca</option>
                          <option value="Chaco">Chaco</option>
                          <option value="Chubut">Chubut</option>
                          <option value="Córdoba">Córdoba</option>
                          <option value="Corrientes">Corrientes</option>
                          <option value="Entre Ríos">Entre Ríos</option>
                          <option value="Formosa">Formosa</option>
                          <option value="Jujuy">Jujuy</option>
                          <option value="La Pampa">La Pampa</option>
                          <option value="La Rioja">La Rioja</option>
                          <option value="Mendoza">Mendoza</option>
                          <option value="Misiones">Misiones</option>
                          <option value="Neuquén">Neuquén</option>
                          <option value="Río Negro">Río Negro</option>
                          <option value="Salta">Salta</option>
                          <option value="San Juan">San Juan</option>
                          <option value="San Luis">San Luis</option>
                          <option value="Santa Cruz">Santa Cruz</option>
                          <option value="Santa Fe">Santa Fe</option>
                          <option value="Santiago del Estero">Santiago del Estero</option>
                          <option value="Tierra del Fuego">Tierra del Fuego</option>
                          <option value="Tucumán">Tucumán</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Send by WhatsApp */}
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <MessageCircle className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-green-800">Enviar pedido por WhatsApp</h3>
                    <p className="text-sm text-green-700 mt-1">
                      Al presionar el botón se va a abrir WhatsApp con un mensaje que incluye tu pedido completo. 
                      Un vendedor te va a responder para confirmar disponibilidad, coordinar el pago y la entrega.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setStep('data')}
                  className="flex items-center gap-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver
                </button>
                <button
                  onClick={handleSendWhatsApp}
                  disabled={!canSendOrder || sending}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition text-lg"
                >
                  {sending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <MessageCircle className="h-5 w-5" />
                  )}
                  {sending ? 'Guardando pedido...' : 'Enviar pedido por WhatsApp'}
                </button>
              </div>
              {orderError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{orderError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="bg-gray-50 rounded-lg p-6 h-fit sticky top-4">
          <h2 className="font-semibold mb-3">Tu pedido</h2>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-600 line-clamp-1">{item.name} x{item.quantity}</span>
                <span className="font-medium whitespace-nowrap ml-2">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatPrice(totalPrice())}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Envío</span>
              {shippingMethod === 'retiro' ? (
                <span className="text-green-600 font-medium">Gratis (retiro)</span>
              ) : selectedQuote ? (
                <span>{selectedQuote.price === 0 ? 'Gratis' : formatPrice(selectedQuote.price)}</span>
              ) : (
                <span className="text-gray-400">A calcular</span>
              )}
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span>{formatPrice(grandTotal)}</span>
            </div>
          </div>
          {shippingMethod === 'envio' && selectedQuote && (
            <div className="mt-3 p-2 bg-compucity-green-50 rounded-lg">
              <p className="text-xs text-compucity-green-dark">
                📦 Envío: {selectedQuote.serviceName} · {selectedQuote.estimatedDays}
              </p>
            </div>
          )}
          <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
            <p className="text-xs text-yellow-700">
              💬 El vendedor te confirmará el precio final, stock disponible y coordinará la forma de pago.
            </p>
          </div>
        </div>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowLoginModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Iniciar sesión</h3>
              <button onClick={() => setShowLoginModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Iniciá sesión para que tus datos se carguen automáticamente.</p>

            {loginError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{loginError}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-compucity-green"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleLogin() }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Tu contraseña"
                    className="w-full border rounded-lg pl-4 pr-10 py-2 text-sm focus:outline-none focus:border-compucity-green"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleLogin() }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                onClick={handleLogin}
                disabled={!loginEmail || !loginPassword || loginLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-compucity-green text-white font-medium rounded-lg hover:bg-compucity-green-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                {loginLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                {loginLoading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
