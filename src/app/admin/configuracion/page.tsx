'use client'

import { useEffect, useState } from 'react'
import {
  Loader2,
  Save,
  Settings,
  DollarSign,
  RefreshCw,
  TrendingUp,
  Truck,
  MapPin,
  Package,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function AdminConfiguracion() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  // Store config
  const [storeName, setStoreName] = useState('Compucity')
  const [slogan, setSlogan] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  // Dollar config
  const [dollarRate, setDollarRate] = useState<number | null>(null)
  const [dollarSource, setDollarSource] = useState('nacion')
  const [dollarFecha, setDollarFecha] = useState('')
  const [dollarCached, setDollarCached] = useState(false)
  const [markup, setMarkup] = useState('30')
  const [cashDiscount, setCashDiscount] = useState('10')

  // Shipping config
  const [originCP, setOriginCP] = useState('5172')
  const [shippingMarkup, setShippingMarkup] = useState('0')
  const [weightPerItem, setWeightPerItem] = useState('2')
  const [shippingTestCP, setShippingTestCP] = useState('')
  const [shippingTestResult, setShippingTestResult] = useState<any[] | null>(null)
  const [shippingTestSource, setShippingTestSource] = useState<string>('')
  const [shippingTestLoading, setShippingTestLoading] = useState(false)

  // Andreani credentials
  const [andreaniUser, setAndreaniUser] = useState('')
  const [andreaniPassword, setAndreaniPassword] = useState('')
  const [andreaniCliente, setAndreaniCliente] = useState('')
  const [andreaniContratoDomicilio, setAndreaniContratoDomicilio] = useState('')
  const [andreaniContratoSucursal, setAndreaniContratoSucursal] = useState('')
  const [showAndreaniPass, setShowAndreaniPass] = useState(false)

  // Correo Argentino credentials
  const [correoUserToken, setCorreoUserToken] = useState('')
  const [correoPasswordToken, setCorreoPasswordToken] = useState('')
  const [correoEmail, setCorreoEmail] = useState('')
  const [correoPassword, setCorreoPassword] = useState('')
  const [showCorreoPass, setShowCorreoPass] = useState(false)

  // Example calculation
  const [ejemplo, setEjemplo] = useState<{ lista: number; efectivo: number } | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const [configRes, dolarRes] = await Promise.all([
        fetch('/api/admin/config'),
        fetch('/api/dolar'),
      ])

      const configData = await configRes.json()
      const dolarData = await dolarRes.json()

      if (configData.ok) {
        const config = configData.config
        setStoreName(config.store_name || 'Compucity')
        setSlogan(config.slogan || '')
        setWhatsapp(config.whatsapp || '')
        setMarkup(config.markup || '30')
        setCashDiscount(config.cash_discount || '10')
        setDollarSource(config.dollar_source || 'nacion')
        // Shipping config
        setOriginCP(config.origin_cp || '5172')
        setShippingMarkup(config.shipping_markup || '0')
        setWeightPerItem(config.weight_per_item || '2')
        // Andreani credentials
        setAndreaniUser(config.andreani_user || '')
        setAndreaniPassword(config.andreani_password || '')
        setAndreaniCliente(config.andreani_cliente || '')
        setAndreaniContratoDomicilio(config.andreani_contrato_domicilio || '')
        setAndreaniContratoSucursal(config.andreani_contrato_sucursal || '')
        // Correo Argentino credentials
        setCorreoUserToken(config.correo_user_token || '')
        setCorreoPasswordToken(config.correo_password_token || '')
        setCorreoEmail(config.correo_email || '')
        setCorreoPassword(config.correo_password || '')
      }

      if (dolarData.ok) {
        setDollarRate(dolarData.dollar.rate)
        setDollarFecha(dolarData.dollar.fecha)
        setDollarCached(dolarData.dollar.cached)
        setMarkup(String(dolarData.config.markup))
        setCashDiscount(String(dolarData.config.cashDiscount))
        if (dolarData.ejemplo) {
          setEjemplo({ lista: dolarData.ejemplo.precioLista, efectivo: dolarData.ejemplo.precioEfectivo })
        }
      }
    } catch (error) {
      console.error('Error loading config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async (section?: string) => {
    setSaving(true)
    setSaveMessage('')
    try {
      const configs: Record<string, string> = {
        store_name: storeName,
        slogan,
        whatsapp,
        markup,
        cash_discount: cashDiscount,
        dollar_source: dollarSource,
        origin_cp: originCP,
        shipping_markup: shippingMarkup,
        weight_per_item: weightPerItem,
        andreani_user: andreaniUser,
        andreani_password: andreaniPassword,
        andreani_cliente: andreaniCliente,
        andreani_contrato_domicilio: andreaniContratoDomicilio,
        andreani_contrato_sucursal: andreaniContratoSucursal,
        correo_user_token: correoUserToken,
        correo_password_token: correoPasswordToken,
        correo_email: correoEmail,
        correo_password: correoPassword,
      }

      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs }),
      })

      const data = await res.json()
      if (data.ok) {
        setSaveMessage(section ? `${section} guardado correctamente` : 'Configuración guardada correctamente')
        setTimeout(() => setSaveMessage(''), 3000)
        loadConfig()
      }
    } catch (error) {
      setSaveMessage('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleTestShipping = async () => {
    if (!shippingTestCP || !/^\d{4,5}$/.test(shippingTestCP.trim())) return
    setShippingTestLoading(true)
    setShippingTestResult(null)
    setShippingTestSource('')
    try {
      const res = await fetch(`/api/shipping?cp=${shippingTestCP.trim()}&items=1`)
      const data = await res.json()
      if (data.ok) {
        setShippingTestResult(data.quotes)
        setShippingTestSource(data.source || 'table')
      }
    } catch {
      setShippingTestResult([])
    } finally {
      setShippingTestLoading(false)
    }
  }

  const handleRefreshDollar = async () => {
    try {
      const res = await fetch('/api/dolar', { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) {
        setDollarRate(data.dollar.rate)
        setDollarFecha(data.dollar.fecha)
        setDollarCached(data.dollar.cached)
        if (data.ejemplo) {
          setEjemplo({ lista: data.ejemplo.precioLista, efectivo: data.ejemplo.precioEfectivo })
        }
      }
    } catch {}
  }

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

  const formatDate = (d: string) => {
    if (!d) return '—'
    return new Date(d).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const hasAndreaniConfig = andreaniUser && andreaniPassword && andreaniCliente && andreaniContratoDomicilio
  const hasCorreoConfig = correoUserToken && correoPasswordToken && correoEmail && correoPassword

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-compucity-green" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500">Ajustes generales de la tienda</p>
      </div>

      {/* Store Config */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-compucity-green" />
            <CardTitle className="text-lg">Datos de la Tienda</CardTitle>
          </div>
          <CardDescription>Información general de tu comercio</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store-name">Nombre de la tienda</Label>
            <Input id="store-name" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Compucity" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slogan">Eslogan</Label>
            <Input id="slogan" value={slogan} onChange={(e) => setSlogan(e.target.value)} placeholder="Tu Mundo Digital" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp">Número de WhatsApp</Label>
            <Input id="whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="5493547123456" />
            <p className="text-xs text-gray-400">Formato: código país + número sin espacios ni símbolos</p>
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <Button onClick={() => handleSaveConfig('Tienda')} className="bg-compucity-green hover:bg-compucity-green-dark" disabled={saving}>
              {saving ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>) : (<><Save className="w-4 h-4 mr-2" />Guardar</>)}
            </Button>
            {saveMessage && (
              <span className={`text-sm ${saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>{saveMessage}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dollar Rate */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <CardTitle className="text-lg">Cotización del Dólar</CardTitle>
          </div>
          <CardDescription>Se actualiza automáticamente desde DolarApi.com</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="font-bold text-2xl text-gray-900">
                  ${dollarRate ? dollarRate.toLocaleString('es-AR') : '—'}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefreshDollar}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Actualizar
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              Dólar {dollarSource === 'blue' ? 'Blue' : 'Banco Nación'} · Venta
              {dollarCached && <span className="text-amber-600 ml-2">(caché)</span>}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Última actualización: {formatDate(dollarFecha)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dollar-source">Fuente de cotización</Label>
            <Select value={dollarSource} onValueChange={setDollarSource}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nacion">Banco Nación (Oficial)</SelectItem>
                <SelectItem value="blue">Dólar Blue</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400">Banco Nación = precio oficial de referencia. Blue = mercado informal.</p>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="markup">Margen de ganancia (%)</Label>
              <Input id="markup" type="number" step="1" value={markup} onChange={(e) => setMarkup(e.target.value)} placeholder="30" />
              <p className="text-xs text-gray-400">Se aplica sobre costo USD × dólar</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cash-discount">Descuento efectivo (%)</Label>
              <Input id="cash-discount" type="number" step="1" value={cashDiscount} onChange={(e) => setCashDiscount(e.target.value)} placeholder="10" />
              <p className="text-xs text-gray-400">Descuento por pago en efectivo</p>
            </div>
          </div>

          {ejemplo && dollarRate && (
            <div className="bg-compucity-green-50 rounded-lg p-4 border border-compucity-green-100">
              <p className="text-sm font-semibold text-compucity-green-dark mb-2">Ejemplo de cálculo (producto de USD 100):</p>
              <div className="space-y-1 text-sm text-compucity-green-dark">
                <p>Costo USD: USD 100</p>
                <p>Dólar {dollarSource === 'blue' ? 'Blue' : 'Banco Nación'}: ${dollarRate.toLocaleString('es-AR')}</p>
                <p>+ Margen {markup}% → Precio de lista: <strong>{formatPrice(ejemplo.lista)}</strong></p>
                <p>+ Margen {markup}% - Desc. {cashDiscount}% → Precio en efectivo: <strong className="text-green-700">{formatPrice(ejemplo.efectivo)}</strong></p>
              </div>
            </div>
          )}

          <Separator />
          <div className="flex items-center gap-3">
            <Button onClick={() => handleSaveConfig('Dólar')} className="bg-compucity-green hover:bg-compucity-green-dark" disabled={saving}>
              {saving ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>) : (<><Save className="w-4 h-4 mr-2" />Guardar</>)}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Shipping General Config */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-purple-600" />
            <CardTitle className="text-lg">Configuración de Envíos</CardTitle>
          </div>
          <CardDescription>Ajustes generales de envío</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="origin-cp">
                <MapPin className="inline w-4 h-4 mr-1" />
                CP de origen
              </Label>
              <Input id="origin-cp" value={originCP} onChange={(e) => setOriginCP(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="5172" maxLength={5} />
              <p className="text-xs text-gray-400">Código postal del local (La Falda = 5172)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping-markup">
                <TrendingUp className="inline w-4 h-4 mr-1" />
                Recargo envío (%)
              </Label>
              <Input id="shipping-markup" type="number" step="1" value={shippingMarkup} onChange={(e) => setShippingMarkup(e.target.value)} placeholder="0" />
              <p className="text-xs text-gray-400">Porcentaje extra sobre la tarifa</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight-per-item">
                <Package className="inline w-4 h-4 mr-1" />
                Peso por producto (kg)
              </Label>
              <Input id="weight-per-item" type="number" step="0.5" value={weightPerItem} onChange={(e) => setWeightPerItem(e.target.value)} placeholder="2" />
              <p className="text-xs text-gray-400">Peso estimado para calcular envío</p>
            </div>
          </div>

          <Separator />

          {/* Test de cotización */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Probar cotización de envío</p>
            <div className="flex gap-2">
              <Input value={shippingTestCP} onChange={(e) => setShippingTestCP(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="CP destino (ej: 5000)" maxLength={5} className="max-w-[200px]" />
              <Button variant="outline" onClick={handleTestShipping} disabled={shippingTestLoading || !shippingTestCP}>
                {shippingTestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cotizar'}
              </Button>
            </div>

            {shippingTestResult && shippingTestResult.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-2 border">
                <p className="text-xs text-gray-500">
                  Cotización de CP {originCP} → {shippingTestCP} (1 producto, ~{weightPerItem}kg)
                  {shippingTestSource === 'api' && <span className="text-green-600 ml-2 font-medium">· Tarifa real (API)</span>}
                  {shippingTestSource === 'table' && <span className="text-amber-600 ml-2 font-medium">· Tarifa estimada (tabla)</span>}
                </p>
                {shippingTestResult.map((q: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{q.serviceName}</span>
                      <span className="text-gray-400 ml-2">{q.estimatedDays}</span>
                    </div>
                    <span className="font-semibold">{q.price === 0 ? 'Gratis' : formatPrice(q.price)}</span>
                  </div>
                ))}
              </div>
            )}
            {shippingTestResult && shippingTestResult.length === 0 && (
              <p className="text-sm text-red-600">No se encontraron opciones de envío para ese CP</p>
            )}
          </div>

          <Separator />
          <div className="flex items-center gap-3">
            <Button onClick={() => handleSaveConfig('Envíos')} className="bg-compucity-green hover:bg-compucity-green-dark" disabled={saving}>
              {saving ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>) : (<><Save className="w-4 h-4 mr-2" />Guardar</>)}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Andreani API Credentials */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-600" />
            <CardTitle className="text-lg">Andreani - API</CardTitle>
          </div>
          <CardDescription>
            Credenciales de la API de Andreani para tarifas reales
            {hasAndreaniConfig && <span className="text-green-600 ml-1">· Configurado</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-800">
              Para obtener las credenciales tenés que ser cliente de Andreani. Contactá a tu representante o escribí a <strong>apis@andreani.com</strong>.
              Una vez configurado, las tarifas se consultan en tiempo real desde la API de Andreani.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="andreani-user">
                <Key className="inline w-4 h-4 mr-1" />
                Usuario API
              </Label>
              <Input id="andreani-user" value={andreaniUser} onChange={(e) => setAndreaniUser(e.target.value)} placeholder="usuario_api" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="andreani-password">Contraseña API</Label>
              <div className="relative">
                <Input
                  id="andreani-password"
                  type={showAndreaniPass ? 'text' : 'password'}
                  value={andreaniPassword}
                  onChange={(e) => setAndreaniPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowAndreaniPass(!showAndreaniPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showAndreaniPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="andreani-cliente">Código de Cliente</Label>
              <Input id="andreani-cliente" value={andreaniCliente} onChange={(e) => setAndreaniCliente(e.target.value)} placeholder="CL0003750" />
              <p className="text-xs text-gray-400">Ejemplo: CL0003750</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="andreani-contrato-dom">Contrato Domicilio</Label>
              <Input id="andreani-contrato-dom" value={andreaniContratoDomicilio} onChange={(e) => setAndreaniContratoDomicilio(e.target.value)} placeholder="300006611" />
              <p className="text-xs text-gray-400">N° de contrato para envío a domicilio</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="andreani-contrato-suc">Contrato Sucursal</Label>
              <Input id="andreani-contrato-suc" value={andreaniContratoSucursal} onChange={(e) => setAndreaniContratoSucursal(e.target.value)} placeholder="400006711" />
              <p className="text-xs text-gray-400">N° de contrato para envío a sucursal (opcional, usa el de domicilio si no se completa)</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <Button onClick={() => handleSaveConfig('Andreani')} className="bg-orange-600 hover:bg-orange-700" disabled={saving}>
              {saving ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>) : (<><Save className="w-4 h-4 mr-2" />Guardar Andreani</>)}
            </Button>
            {hasAndreaniConfig && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="w-4 h-4" /> Credenciales configuradas
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Correo Argentino API Credentials */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-compucity-green-dark" />
            <CardTitle className="text-lg">Correo Argentino - API (Paq.Ar)</CardTitle>
          </div>
          <CardDescription>
            Credenciales de la API de Correo Argentino para tarifas reales
            {hasCorreoConfig && <span className="text-green-600 ml-1">· Configurado</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-compucity-green-50 border border-compucity-green-100 rounded-lg p-3">
            <p className="text-xs text-compucity-green-dark">
              Para obtener las credenciales tenés que tener una cuenta de MiCorreo. Solicitá las credenciales API en{' '}
              <strong>correoargentino.com.ar/MiCorreo</strong> o contactá a tu representante.
              La API devuelve tarifas de Paq.ar Clásico y Express en tiempo real.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="correo-user-token">
                <Key className="inline w-4 h-4 mr-1" />
                User Token
              </Label>
              <Input id="correo-user-token" value={correoUserToken} onChange={(e) => setCorreoUserToken(e.target.value)} placeholder="Token para Basic Auth" />
              <p className="text-xs text-gray-400">Se usa en el header Authorization (Basic auth)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="correo-pass-token">Password Token</Label>
              <div className="relative">
                <Input
                  id="correo-pass-token"
                  type={showCorreoPass ? 'text' : 'password'}
                  value={correoPasswordToken}
                  onChange={(e) => setCorreoPasswordToken(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCorreoPass(!showCorreoPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCorreoPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="correo-email">Email MiCorreo</Label>
              <Input id="correo-email" type="email" value={correoEmail} onChange={(e) => setCorreoEmail(e.target.value)} placeholder="tu@email.com" />
              <p className="text-xs text-gray-400">Email de tu cuenta MiCorreo</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="correo-password">Contraseña MiCorreo</Label>
              <Input
                id="correo-password"
                type="password"
                value={correoPassword}
                onChange={(e) => setCorreoPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <Button onClick={() => handleSaveConfig('Correo Argentino')} className="bg-compucity-green-dark hover:bg-compucity-green-dark" disabled={saving}>
              {saving ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>) : (<><Save className="w-4 h-4 mr-2" />Guardar Correo Arg.</>)}
            </Button>
            {hasCorreoConfig && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="w-4 h-4" /> Credenciales configuradas
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status summary */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Estado de las APIs de envío</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              {hasAndreaniConfig ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-500" />
              )}
              <span className={hasAndreaniConfig ? 'text-green-700' : 'text-amber-700'}>
                Andreani: {hasAndreaniConfig ? 'API configurada - tarifas reales' : 'Sin configurar - usando tarifas estimadas'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {hasCorreoConfig ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-500" />
              )}
              <span className={hasCorreoConfig ? 'text-green-700' : 'text-amber-700'}>
                Correo Argentino: {hasCorreoConfig ? 'API configurada - tarifas reales' : 'Sin configurar - usando tarifas estimadas'}
              </span>
            </div>
          </div>
          {!hasAndreaniConfig && !hasCorreoConfig && (
            <p className="text-xs text-gray-500 mt-3">
              Mientras no configures las APIs, se usan tarifas estimadas basadas en tablas de precios. Configurá al menos una API para obtener tarifas reales.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
