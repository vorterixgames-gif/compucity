'use client'

import { useState, useEffect } from 'react'
import { useCart } from '@/store/cart'
import { Truck, MapPin, MessageCircle, User, Phone, Mail, FileText, Package, Loader2, ChevronRight, ArrowLeft } from 'lucide-react'
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
          shippingZip: customerData.postalCode,
          shippingMethod: shippingMethod === 'retiro' ? 'retiro' : 'envio',
          shippingCost,
          shippingDetails: shippingMethod === 'envio' && selectedQuote
            ? `${selectedQuote.serviceName} · ${selectedQuote.estimatedDays} · ${selectedQuote.carrierName}`
            : 'Retiro en local',
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
    } catch (err) {
      setOrderError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <MessageCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">¡Pedido enviado!</h1>
        <p className="text-gray-500 mb-6">
          Tu pedido fue enviado por WhatsApp. Un vendedor se va a contactar a la brevedad para confirmar y coordinar el pago y la entrega.
        </p>
        <Link href="/" className="px-6 py-3 bg-compucity-green text-white rounded-lg hover:bg-compucity-green-dark transition">
          Volver a la tienda
        </Link>
      </div>
    )
  }

  const canProceedFromData = customerData.name && customerData.phone
  const canSendOrder = customerData.name && customerData.phone && (
    shippingMethod === 'retiro' || (
      customerData.address && customerData.city && customerData.postalCode && selectedQuote
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
            <div className="space-y-4 bg-white border rounded-lg p-6">
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
                  <div className="grid md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
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
    </div>
  )
}
