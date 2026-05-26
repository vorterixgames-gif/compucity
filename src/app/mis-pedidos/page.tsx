'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Mail, Lock, Phone, FileText, Package, LogOut,
  ChevronDown, ChevronUp, Truck, MapPin, Loader2, Eye, EyeOff,
  ShoppingBag, Clock, CheckCircle2, PackageCheck, CircleDot, XCircle, Search
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'

// ============================================
// Types
// ============================================

interface CustomerData {
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

interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
  productId?: string | null
}

interface OrderData {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  customerDni: string | null
  shippingAddress: string | null
  shippingCity: string | null
  shippingProvince: string | null
  shippingZip: string | null
  shippingMethod: string | null
  shippingCost: number
  trackingNumber: string | null
  status: string
  paymentMethod: string | null
  total: number
  notes: string | null
  customerId: string | null
  createdAt: string
  updatedAt: string
  items: OrderItem[]
}

// ============================================
// Status Configuration
// ============================================

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pendiente: {
    label: 'Pendiente',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
    icon: Clock,
  },
  pending: {
    label: 'Pendiente',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
    icon: Clock,
  },
  paid: {
    label: 'Pagado',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
    icon: CheckCircle2,
  },
  pago: {
    label: 'Pagado',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
    icon: CheckCircle2,
  },
  preparing: {
    label: 'Preparando',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50 border-purple-200',
    icon: PackageCheck,
  },
  preparando: {
    label: 'Preparando',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50 border-purple-200',
    icon: PackageCheck,
  },
  shipped: {
    label: 'Enviado',
    color: 'text-compucity-green-dark',
    bgColor: 'bg-compucity-green-50 border-compucity-green-100',
    icon: Truck,
  },
  enviado: {
    label: 'Enviado',
    color: 'text-compucity-green-dark',
    bgColor: 'bg-compucity-green-50 border-compucity-green-100',
    icon: Truck,
  },
  delivered: {
    label: 'Entregado',
    color: 'text-green-700',
    bgColor: 'bg-green-50 border-green-200',
    icon: CircleDot,
  },
  entregado: {
    label: 'Entregado',
    color: 'text-green-700',
    bgColor: 'bg-green-50 border-green-200',
    icon: CircleDot,
  },
  cancelled: {
    label: 'Cancelado',
    color: 'text-red-700',
    bgColor: 'bg-red-50 border-red-200',
    icon: XCircle,
  },
  cancelado: {
    label: 'Cancelado',
    color: 'text-red-700',
    bgColor: 'bg-red-50 border-red-200',
    icon: XCircle,
  },
}

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG['pending']
}

// ============================================
// Price formatter
// ============================================

const formatPrice = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

const formatDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

// ============================================
// Main Page Component
// ============================================

export default function MisPedidosPage() {
  const [customer, setCustomer] = useState<CustomerData | null>(null)
  const [orders, setOrders] = useState<OrderData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  // Order lookup by number
  const [lookupNumber, setLookupNumber] = useState('')
  const [lookupResult, setLookupResult] = useState<OrderData | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')

  // Check auth on mount
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/customer/me')
      if (res.ok) {
        const data = await res.json()
        setCustomer(data.customer)
        // Fetch orders
        const ordersRes = await fetch('/api/customer/orders')
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json()
          setOrders(ordersData.orders || [])
        }
      }
    } catch {
      // Not authenticated
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const handleLogout = async () => {
    await fetch('/api/customer/logout', { method: 'POST' })
    setCustomer(null)
    setOrders([])
  }

  const handleLookupOrder = async () => {
    if (!lookupNumber.trim()) return
    setLookupLoading(true)
    setLookupError('')
    setLookupResult(null)
    try {
      const res = await fetch(`/api/orders?orderNumber=${encodeURIComponent(lookupNumber.trim())}`)
      const data = await res.json()
      if (data.ok && data.order) {
        setLookupResult(data.order)
      } else {
        setLookupError(data.error || 'Pedido no encontrado')
      }
    } catch {
      setLookupError('Error al buscar el pedido')
    } finally {
      setLookupLoading(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-compucity-green animate-spin" />
          <p className="text-sm text-gray-500">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-compucity-green-dark to-compucity-green text-white">
        <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="h-7 w-7" />
            <h1 className="text-2xl sm:text-3xl font-bold">Mis Pedidos</h1>
          </div>
          <p className="text-white/80 text-sm sm:text-base">
            {customer
              ? `Hola, ${customer.name} — Seguí tus pedidos acá`
              : 'Ingresá a tu cuenta para ver tus pedidos'}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <AnimatePresence mode="wait">
          {customer ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <CustomerDashboard
                customer={customer}
                orders={orders}
                expandedOrder={expandedOrder}
                setExpandedOrder={setExpandedOrder}
                onLogout={handleLogout}
              />
            </motion.div>
          ) : (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              {/* Quick order lookup */}
              <Card className="mb-6 border-0 shadow-sm">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Search className="h-4 w-4 text-compucity-green" />
                    <p className="text-sm font-medium text-gray-700">Buscar pedido por número</p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ej: CP-LH5XYZ"
                      value={lookupNumber}
                      onChange={(e) => setLookupNumber(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && handleLookupOrder()}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleLookupOrder}
                      disabled={lookupLoading || !lookupNumber.trim()}
                      className="bg-compucity-green hover:bg-compucity-green-dark text-white"
                    >
                      {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  {lookupError && (
                    <p className="text-sm text-red-600 mt-2">{lookupError}</p>
                  )}
                  {lookupResult && (
                    <OrderCard
                      order={lookupResult}
                      expanded={expandedOrder === lookupResult.id}
                      onToggle={() => setExpandedOrder(expandedOrder === lookupResult.id ? null : lookupResult.id)}
                    />
                  )}
                  <Separator className="my-4" />

                  <div className="text-center">
                    <p className="text-sm text-gray-500 mb-1">¿Querés ver todos tus pedidos?</p>
                    <p className="text-xs text-gray-400">Ingresá a tu cuenta abajo para ver el historial completo</p>
                  </div>
                </CardContent>
              </Card>

              <AuthForms onLoginSuccess={(cust) => {
                setCustomer(cust)
                checkAuth()
              }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ============================================
// Auth Forms Component (Login / Register)
// ============================================

function AuthForms({ onLoginSuccess }: { onLoginSuccess: (customer: CustomerData) => void }) {
  const [activeTab, setActiveTab] = useState('login')

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [showLoginPassword, setShowLoginPassword] = useState(false)

  // Register state
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regDni, setRegDni] = useState('')
  const [regError, setRegError] = useState('')
  const [regLoading, setRegLoading] = useState(false)
  const [showRegPassword, setShowRegPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      const res = await fetch('/api/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLoginError(data.error || 'Error al iniciar sesión')
        return
      }
      onLoginSuccess(data.customer)
    } catch {
      setLoginError('Error de conexión')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError('')
    setRegLoading(true)
    try {
      const res = await fetch('/api/customer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          phone: regPhone,
          password: regPassword,
          dni: regDni,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setRegError(data.error || 'Error al registrarse')
        return
      }
      onLoginSuccess(data.customer)
    } catch {
      setRegError('Error de conexión')
    } finally {
      setRegLoading(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="border-b">
          <TabsList className="w-full rounded-none border-0 bg-transparent h-auto p-0">
            <TabsTrigger
              value="login"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-compucity-green data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3.5 text-sm font-medium data-[state=active]:text-compucity-green-dark"
            >
              Iniciar Sesión
            </TabsTrigger>
            <TabsTrigger
              value="register"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-compucity-green data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3.5 text-sm font-medium data-[state=active]:text-compucity-green-dark"
            >
              Crear Cuenta
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="login" className="mt-0">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-compucity-green-50 flex items-center justify-center mx-auto mb-3">
                <User className="h-7 w-7 text-compucity-green" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Bienvenido de vuelta</h2>
              <p className="text-sm text-gray-500 mt-1">Ingresá con tu email y contraseña</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="tu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
                  {loginError}
                </div>
              )}

              <Button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-compucity-green hover:bg-compucity-green-dark text-white h-11"
              >
                {loginLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Iniciar Sesión
              </Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500">
                ¿No tenés cuenta?{' '}
                <button
                  onClick={() => setActiveTab('register')}
                  className="text-compucity-green hover:text-compucity-green-dark font-medium"
                >
                  Registrate acá
                </button>
              </p>
            </div>
          </CardContent>
        </TabsContent>

        <TabsContent value="register" className="mt-0">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-compucity-green-50 flex items-center justify-center mx-auto mb-3">
                <User className="h-7 w-7 text-compucity-green" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Creá tu cuenta</h2>
              <p className="text-sm text-gray-500 mt-1">Registrate para hacer seguimiento de tus pedidos</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reg-name">Nombre completo *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="reg-name"
                    type="text"
                    placeholder="Juan Pérez"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="tu@email.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-phone">Teléfono</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="reg-phone"
                      type="tel"
                      placeholder="351 1234567"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">Contraseña *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="reg-password"
                    type={showRegPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-dni">DNI <span className="text-gray-400 font-normal">(opcional)</span></Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="reg-dni"
                    type="text"
                    placeholder="12345678"
                    value={regDni}
                    onChange={(e) => setRegDni(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {regError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
                  {regError}
                </div>
              )}

              <Button
                type="submit"
                disabled={regLoading}
                className="w-full bg-compucity-green hover:bg-compucity-green-dark text-white h-11"
              >
                {regLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Crear Cuenta
              </Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500">
                ¿Ya tenés cuenta?{' '}
                <button
                  onClick={() => setActiveTab('login')}
                  className="text-compucity-green hover:text-compucity-green-dark font-medium"
                >
                  Iniciá sesión
                </button>
              </p>
            </div>
          </CardContent>
        </TabsContent>
      </Tabs>
    </Card>
  )
}

// ============================================
// Customer Dashboard Component
// ============================================

function CustomerDashboard({
  customer,
  orders,
  expandedOrder,
  setExpandedOrder,
  onLogout,
}: {
  customer: CustomerData
  orders: OrderData[]
  expandedOrder: string | null
  setExpandedOrder: (id: string | null) => void
  onLogout: () => void
}) {
  return (
    <div className="space-y-6">
      {/* Customer Info Card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-compucity-green flex items-center justify-center text-white font-bold text-lg shrink-0">
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{customer.name}</h2>
                <p className="text-sm text-gray-500">{customer.email}</p>
                {customer.phone && <p className="text-xs text-gray-400">{customer.phone}</p>}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="text-gray-500 hover:text-red-600 hover:border-red-200"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Cerrar sesión
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Tus Pedidos ({orders.length})
          </h2>
        </div>

        {orders.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No tenés pedidos todavía</p>
              <p className="text-sm text-gray-400 mt-1">
                Cuando realices una compra con este email, tus pedidos van a aparecer acá
              </p>
              <Link
                href="/"
                className="inline-block mt-4 px-5 py-2.5 bg-compucity-green text-white rounded-lg text-sm font-medium hover:bg-compucity-green-dark transition"
              >
                Ir a la tienda
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                expanded={expandedOrder === order.id}
                onToggle={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// Order Card Component
// ============================================

function OrderCard({
  order,
  expanded,
  onToggle,
}: {
  order: OrderData
  expanded: boolean
  onToggle: () => void
}) {
  const statusConfig = getStatusConfig(order.status)
  const StatusIcon = statusConfig.icon
  const orderItems = (order.items || []) as OrderItem[]
  const itemsCount = orderItems.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      {/* Order Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left p-4 sm:p-5 hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-gray-500" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                {order.orderNumber}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatDate(order.createdAt)} · {itemsCount} {itemsCount === 1 ? 'producto' : 'productos'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Badge
              variant="outline"
              className={`${statusConfig.bgColor} ${statusConfig.color} border-0 text-xs font-medium gap-1`}
            >
              <StatusIcon className="h-3 w-3" />
              {statusConfig.label}
            </Badge>
            <div className="text-right hidden sm:block">
              <p className="font-bold text-gray-900 text-sm">{formatPrice(order.total)}</p>
            </div>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>

        {/* Mobile price */}
        <div className="sm:hidden mt-2 flex items-center justify-between">
          <p className="font-bold text-gray-900 text-sm">{formatPrice(order.total)}</p>
        </div>
      </button>

      {/* Order Details - expanded */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-4">
              <Separator />

              {/* Status Progress */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Estado del pedido</p>
                <div className="flex items-center gap-1">
                  {['pending', 'paid', 'preparing', 'shipped', 'delivered'].map((step, i) => {
                    const stepConfig = getStatusConfig(step)
                    const statusOrder = ['pending', 'pendiente', 'paid', 'pago', 'preparing', 'preparando', 'shipped', 'enviado', 'delivered', 'entregado']
                    const currentIdx = statusOrder.indexOf(order.status)
                    const stepIdx = statusOrder.indexOf(step)
                    const isCompleted = currentIdx >= stepIdx && stepIdx !== -1
                    const StepIcon = stepConfig.icon

                    return (
                      <div key={step} className="flex items-center flex-1">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-colors ${
                            isCompleted
                              ? 'bg-compucity-green text-white'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          <StepIcon className="h-3.5 w-3.5" />
                        </div>
                        {i < 4 && (
                          <div className={`flex-1 h-0.5 mx-1 ${isCompleted ? 'bg-compucity-green' : 'bg-gray-200'}`} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Productos</p>
                <div className="bg-gray-50 rounded-lg divide-y divide-gray-100">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800 truncate">{item.name}</p>
                        <p className="text-xs text-gray-400">
                          {formatPrice(item.price)} × {item.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-gray-900 ml-3">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipping & Totals */}
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Shipping info */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Envío</p>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                    {order.shippingMethod === 'retiro' ? (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-compucity-green shrink-0" />
                        <p className="text-sm text-gray-700">Retiro en local — La Falda, Córdoba</p>
                      </div>
                    ) : (
                      <>
                        {order.shippingAddress && (
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-compucity-green shrink-0 mt-0.5" />
                            <div className="text-sm text-gray-700">
                              <p>{order.shippingAddress}</p>
                              {order.shippingCity && <p>{order.shippingCity}{order.shippingProvince ? `, ${order.shippingProvince}` : ''}</p>}
                              {order.shippingZip && <p className="text-xs text-gray-400">CP: {order.shippingZip}</p>}
                            </div>
                          </div>
                        )}
                        {order.trackingNumber && (
                          <div className="flex items-center gap-2 pt-1">
                            <Truck className="h-4 w-4 text-compucity-green shrink-0" />
                            <p className="text-sm">
                              <span className="text-gray-500">Tracking:</span>{' '}
                              <span className="font-medium text-gray-800">{order.trackingNumber}</span>
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Totals */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Resumen</p>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="text-gray-700">{formatPrice(order.total - (order.shippingCost || 0))}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Envío</span>
                      <span className="text-gray-700">
                        {order.shippingCost > 0 ? formatPrice(order.shippingCost) : 'Gratis'}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold">
                      <span>Total</span>
                      <span className="text-compucity-green-dark">{formatPrice(order.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {order.notes && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notas</p>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{order.notes}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
