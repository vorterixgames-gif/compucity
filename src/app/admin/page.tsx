'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Package,
  ShoppingCart,
  Users,
  Truck,
  DollarSign,
  TrendingUp,
  Plus,
  ArrowRight,
  Loader2,
  AlertTriangle,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DashboardStats {
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  totalCustomers: number
  totalSuppliers: number
  dollarRate: number
  dollarSource: string
  dollarCompra: number | null
  dollarVenta: number | null
  dollarUpdatedAt: string
  activeProducts: number
  featuredProducts: number
}

interface RecentOrder {
  id: string
  orderNumber: string
  customerName: string
  total: number
  status: string
  createdAt: string
}

interface StaleProduct {
  id: string
  name: string
  sku: string
  providerSku: string | null
  providerId: string | null
  providerName: string
  stock: number
  costPrice: number
  isActive: number
  updatedAt: string
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  paid: { label: 'Pagado', color: 'bg-green-100 text-green-800' },
  preparing: { label: 'Preparando', color: 'bg-compucity-green-100 text-compucity-green-dark' },
  shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-800' },
  delivered: { label: 'Entregado', color: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(price)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [loading, setLoading] = useState(true)
  // Sesión 56: banner de productos stale (sin actualizar hace más de 7 días)
  const [staleCount, setStaleCount] = useState<number | null>(null)
  const [staleProducts, setStaleProducts] = useState<StaleProduct[]>([])
  const [staleDialogOpen, setStaleDialogOpen] = useState(false)
  const [staleLoading, setStaleLoading] = useState(false)
  // SESIÓN 62: filtro por proveedor en el diálogo de stale ('' = principales)
  const [staleProvider, setStaleProvider] = useState<string>('')
  const [dialogCount, setDialogCount] = useState<number | null>(null)

  useEffect(() => {
    loadStats()
    loadStaleCount()
  }, [])

  const loadStats = async () => {
    try {
      const res = await fetch('/api/admin/stats')
      const data = await res.json()
      if (data.ok) {
        setStats(data.stats)
        setRecentOrders(data.recentOrders || [])
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  // Sesión 56: solo carga el count para mostrar el banner.
  // El listado completo se carga solo cuando el usuario hace click en "Ver detalle".
  const loadStaleCount = async () => {
    try {
      const res = await fetch('/api/admin/stale-products')
      const data = await res.json()
      if (data.ok) {
        setStaleCount(data.staleCount)
      }
    } catch (error) {
      console.error('Error loading stale count:', error)
      // No bloquear el dashboard si esto falla — solo ocultamos el banner
    }
  }

  // Carga el listado completo para mostrar en el diálogo
  const loadStaleDetail = async (provider?: string) => {
    setStaleLoading(true)
    const prov = provider ?? staleProvider
    try {
      const res = await fetch(`/api/admin/stale-products?provider=${encodeURIComponent(prov)}`)
      const data = await res.json()
      if (data.ok) {
        setStaleProducts(data.staleProducts || [])
        setDialogCount(data.staleCount)
        setStaleDialogOpen(true)
      }
    } catch (error) {
      console.error('Error loading stale detail:', error)
    } finally {
      setStaleLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-compucity-green" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sesión 56: Banner de productos stale (sin actualizar hace más de 7 días).
          Solo se muestra si hay productos stale (staleCount > 0).
          Si el fetch falla (staleCount === null), no se muestra nada. */}
      {staleCount !== null && staleCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900">
              {staleCount} {staleCount === 1 ? 'producto no se actualiza' : 'productos no se actualizan'} hace más de 7 días
            </h3>
            <p className="text-sm text-amber-800 mt-1">
              Esto puede indicar que algún proveedor dejó de sincronizar, un producto se movió de posición
              en el catálogo, o hay un problema con el sync. Revisá el listado para detectar el problema.
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Se cuentan productos CON stock de Air Intra, Elit, Invid, Eikon y BACKUP. En el detalle podés filtrar por proveedor o ver todos.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 border-amber-400 text-amber-800 hover:bg-amber-100"
              onClick={loadStaleDetail}
              disabled={staleLoading}
            >
              {staleLoading ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-1" />
              )}
              Ver detalle
            </Button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Productos
            </CardTitle>
            <Package className="w-5 h-5 text-compucity-green" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats?.totalProducts ?? 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {stats?.activeProducts ?? 0} activos · {stats?.featuredProducts ?? 0} destacados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Pedidos
            </CardTitle>
            <ShoppingCart className="w-5 h-5 text-compucity-green" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats?.totalOrders ?? 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Gestión de ventas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Clientes
            </CardTitle>
            <Users className="w-5 h-5 text-compucity-green" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats?.totalCustomers ?? 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Clientes registrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Ingresos Totales
            </CardTitle>
            <DollarSign className="w-5 h-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {formatPrice(stats?.totalRevenue ?? 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Pedidos pagados y completados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Proveedores
            </CardTitle>
            <Truck className="w-5 h-5 text-compucity-green" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats?.totalSuppliers ?? 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Proveedores activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Cotización Dólar
            </CardTitle>
            <TrendingUp className="w-5 h-5 text-compucity-green" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              ${stats?.dollarRate ? Number(stats.dollarRate).toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '—'}
            </div>
            <div className="text-xs text-gray-500 mt-1 space-y-0.5">
              <p>{stats?.dollarSource === 'blue' ? 'Dólar Blue' : stats?.dollarSource === 'nacion' ? 'Dólar Oficial (Banco Nación)' : stats?.dollarSource || 'Cotización actual'}</p>
              {stats?.dollarCompra && stats?.dollarVenta && (
                <p>Compra: ${Number(stats.dollarCompra).toLocaleString('es-AR', { minimumFractionDigits: 2 })} · Venta: ${Number(stats.dollarVenta).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              )}
              {stats?.dollarUpdatedAt && (
                <p>Actualizado: {new Date(stats.dollarUpdatedAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/admin/productos">
          <Button className="bg-compucity-green hover:bg-compucity-green-dark">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Producto
          </Button>
        </Link>
        <Link href="/admin/pedidos">
          <Button variant="outline">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Ver Pedidos
          </Button>
        </Link>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Pedidos Recientes</CardTitle>
          <Link href="/admin/pedidos">
            <Button variant="ghost" size="sm">
              Ver todos <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>No hay pedidos aún</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order) => {
                    const status = statusMap[order.status] || statusMap.pending
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono font-medium">
                          #{order.orderNumber}
                        </TableCell>
                        <TableCell>{order.customerName}</TableCell>
                        <TableCell className="font-medium">
                          {formatPrice(order.total)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={status.color}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-500 text-sm">
                          {formatDate(order.createdAt)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sesión 56: Diálogo con el listado completo de productos stale */}
      <Dialog open={staleDialogOpen} onOpenChange={setStaleDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Productos sin actualizar hace más de 7 días
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 ml-2">
                {dialogCount ?? staleCount} en el filtro actual
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {/* SESIÓN 62: filtro por proveedor */}
          <div className="flex items-center gap-2 pb-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Proveedor:</label>
            <select
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
              value={staleProvider}
              disabled={staleLoading}
              onChange={(e) => {
                setStaleProvider(e.target.value)
                loadStaleDetail(e.target.value)
              }}
            >
              <option value="">Principales (Air Intra, Elit, Invid, Eikon, BACKUP)</option>
              <option value="all">Todos (incluye manuales)</option>
              <option value="Air Intra">Air Intra</option>
              <option value="Elit">Elit</option>
              <option value="Invid Computers">Invid Computers</option>
              <option value="Eikon">Eikon</option>
              <option value="BACKUP">BACKUP</option>
            </select>
          </div>
          <div className="overflow-x-auto flex-1">
            {staleProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No hay productos para mostrar</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[250px]">Producto</TableHead>
                    <TableHead className="min-w-[120px]">SKU</TableHead>
                    <TableHead className="min-w-[140px]">Proveedor</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Última actualización</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staleProducts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link
                          href={`/admin/productos?search=${encodeURIComponent(p.name.substring(0, 30))}`}
                          className="text-gray-900 hover:text-compucity-green hover:underline"
                        >
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.providerSku || p.sku || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {p.providerName}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={Number(p.stock) === 0 ? 'text-red-600 font-medium' : ''}>
                          {p.stock}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {p.isActive === 1 ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Activo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                            Inactivo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-500">
                        {formatDate(p.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          {(dialogCount ?? 0) > staleProducts.length && (
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
              ⚠ Mostrando los {staleProducts.length} productos más antiguos. Hay {(dialogCount ?? 0) - staleProducts.length} más.
              Considerá hacer un sync manual desde /admin/proveedores para actualizarlos.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
