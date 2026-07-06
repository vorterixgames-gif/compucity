'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatARS } from '@/lib/format'
import {
  Loader2,
  ShoppingCart,
  Eye,
  ChevronDown,
  ChevronUp,
  Truck,
  Download,
  Trash2,
  AlertTriangle,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
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
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface OrderItem {
  id: string
  productId: string | null
  name: string
  price: number
  quantity: number
}

interface Order {
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
  paymentId: string | null
  total: number
  notes: string | null
  createdAt: string
  updatedAt: string
  items: OrderItem[]
  customerId: string | null  // Sesión 51: necesario para editar cliente vinculado
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  paid: { label: 'Pagado', color: 'bg-green-100 text-green-800' },
  preparing: { label: 'Preparando', color: 'bg-compucity-green-100 text-compucity-green-dark' },
  shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-800' },
  delivered: { label: 'Entregado', color: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
}

const statusOptions = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'paid', label: 'Pagado' },
  { value: 'preparing', label: 'Preparando' },
  { value: 'shipped', label: 'Enviado' },
  { value: 'delivered', label: 'Entregado' },
  { value: 'cancelled', label: 'Cancelado' },
]

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminPedidos() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Status update dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [newStatus, setNewStatus] = useState('')
  const [newTracking, setNewTracking] = useState('')
  const [newNotes, setNewNotes] = useState('')

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Edit customer dialog (sesión 51)
  // Permite editar el cliente vinculado a un pedido sin ir a /admin/clientes.
  // Solo disponible si el pedido tiene customerId (cliente logueado al comprar).
  const [editCustomerDialogOpen, setEditCustomerDialogOpen] = useState(false)
  const [customerLoading, setCustomerLoading] = useState(false)
  const [customerSaving, setCustomerSaving] = useState(false)
  const [editCustomerError, setEditCustomerError] = useState('')
  const [orderForCustomerEdit, setOrderForCustomerEdit] = useState<Order | null>(null)
  const [customerForm, setCustomerForm] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    dni: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
  })

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/orders')
      const data = await res.json()
      if (data.ok) setOrders(data.orders as Order[])
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const toggleExpand = (orderId: string) => {
    setExpandedOrder(prev => prev === orderId ? null : orderId)
  }

  const openStatusDialog = (order: Order) => {
    setSelectedOrder(order)
    setNewStatus(order.status)
    setNewTracking(order.trackingNumber || '')
    setNewNotes(order.notes || '')
    setStatusDialogOpen(true)
  }

  const handleSaveStatus = async () => {
    if (!selectedOrder) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedOrder.id,
          status: newStatus,
          trackingNumber: newTracking,
          notes: newNotes,
        }),
      })

      const data = await res.json()
      if (data.ok) {
        setOrders(prev =>
          prev.map(o =>
            o.id === selectedOrder.id
              ? { ...o, status: newStatus, trackingNumber: newTracking || null, notes: newNotes || null }
              : o
          )
        )
        setStatusDialogOpen(false)
      }
    } catch (error) {
      console.error('Error updating order:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/orders?id=${orderToDelete.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.ok) {
        setOrders(prev => prev.filter(o => o.id !== orderToDelete.id))
        setDeleteDialogOpen(false)
        setOrderToDelete(null)
      }
    } catch (error) {
      console.error('Error deleting order:', error)
    } finally {
      setDeleting(false)
    }
  }

  const openDeleteDialog = (order: Order) => {
    setOrderToDelete(order)
    setDeleteDialogOpen(true)
  }

  // Sesión 51: editar cliente vinculado a un pedido
  const openEditCustomerDialog = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation()
    if (!order.customerId) return
    setOrderForCustomerEdit(order)
    setEditCustomerError('')
    setCustomerLoading(true)
    setEditCustomerDialogOpen(true)
    try {
      // Fetch del cliente completo (el pedido solo tiene el snapshot)
      const res = await fetch(`/api/admin/customers?id=${order.customerId}`)
      const data = await res.json()
      if (!res.ok || !data.customer) {
        setEditCustomerError(data.error || 'No se pudo cargar el cliente')
        return
      }
      const c = data.customer
      setCustomerForm({
        id: c.id || '',
        name: c.name || '',
        email: c.email || '',
        phone: c.phone || '',
        dni: c.dni || '',
        address: c.address || '',
        city: c.city || '',
        province: c.province || '',
        postalCode: c.postalCode || '',
      })
    } catch {
      setEditCustomerError('Error de conexión al cargar el cliente')
    } finally {
      setCustomerLoading(false)
    }
  }

  const handleSaveCustomerEdit = async () => {
    if (!orderForCustomerEdit || !customerForm.id) return
    setCustomerSaving(true)
    setEditCustomerError('')
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerForm),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setEditCustomerError(data.error || 'Error al actualizar el cliente')
        return
      }
      // Actualizar el snapshot del pedido en estado local para reflejar
      // el cambio en la UI (name/email/phone/dni que se muestran en el pedido)
      setOrders(prev =>
        prev.map(o =>
          o.id === orderForCustomerEdit.id
            ? {
                ...o,
                customerName: customerForm.name,
                customerEmail: customerForm.email,
                customerPhone: customerForm.phone,
                customerDni: customerForm.dni,
                shippingAddress: customerForm.address || o.shippingAddress,
                shippingCity: customerForm.city || o.shippingCity,
                shippingProvince: customerForm.province || o.shippingProvince,
                shippingZip: customerForm.postalCode || o.shippingZip,
              }
            : o
        )
      )
      setEditCustomerDialogOpen(false)
      setOrderForCustomerEdit(null)
    } catch {
      setEditCustomerError('Error de conexión')
    } finally {
      setCustomerSaving(false)
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-sm text-gray-500">{orders.length} pedidos en total</p>
        </div>
        <a
          href="/api/admin/export/emails"
          target="_blank"
        >
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Exportar Emails
          </Button>
        </a>
      </div>

      {/* Orders Table */}
      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-400">
              <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>No hay pedidos aún</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const status = statusMap[order.status] || statusMap.pending
            const isExpanded = expandedOrder === order.id

            return (
              <Card key={order.id} className="overflow-hidden">
                {/* Order Header Row */}
                <div
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpand(order.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="font-mono font-bold text-compucity-green text-sm">
                      #{order.orderNumber}
                    </span>
                    <span className="text-sm text-gray-900 font-medium truncate">
                      {order.customerName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant="secondary" className={status.color}>
                      {status.label}
                    </Badge>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatARS(order.total)}
                    </span>
                    <span className="text-xs text-gray-400 hidden sm:block">
                      {formatDate(order.createdAt)}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Customer Info */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-sm text-gray-700">Datos del Cliente</h4>
                          {order.customerId && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-compucity-green hover:text-compucity-green-dark hover:bg-compucity-green-50"
                              onClick={(e) => openEditCustomerDialog(e, order)}
                            >
                              <Pencil className="w-4 h-4 mr-1" />
                              Editar cliente
                            </Button>
                          )}
                        </div>
                        <div className="space-y-1 text-sm">
                          <p><span className="text-gray-500">Nombre:</span> {order.customerName}</p>
                          {order.customerEmail && <p><span className="text-gray-500">Email:</span> {order.customerEmail}</p>}
                          {order.customerPhone && <p><span className="text-gray-500">Teléfono:</span> {order.customerPhone}</p>}
                          {order.customerDni && <p><span className="text-gray-500">DNI:</span> {order.customerDni}</p>}
                        </div>

                        <h4 className="font-semibold text-sm text-gray-700 mt-4">Envío</h4>
                        <div className="space-y-1 text-sm">
                          {order.shippingAddress && <p><span className="text-gray-500">Dirección:</span> {order.shippingAddress}</p>}
                          {order.shippingCity && <p><span className="text-gray-500">Ciudad:</span> {order.shippingCity}</p>}
                          {order.shippingProvince && <p><span className="text-gray-500">Provincia:</span> {order.shippingProvince}</p>}
                          {order.shippingZip && <p><span className="text-gray-500">CP:</span> {order.shippingZip}</p>}
                          {order.shippingMethod && <p><span className="text-gray-500">Método:</span> {order.shippingMethod}</p>}
                          {order.shippingCost > 0 && <p><span className="text-gray-500">Costo envío:</span> {formatARS(order.shippingCost)}</p>}
                          {order.trackingNumber && (
                            <p>
                              <span className="text-gray-500">Tracking:</span>{' '}
                              <span className="font-mono text-compucity-green">{order.trackingNumber}</span>
                            </p>
                          )}
                        </div>

                        {order.paymentMethod && (
                          <>
                            <h4 className="font-semibold text-sm text-gray-700 mt-4">Pago</h4>
                            <div className="space-y-1 text-sm">
                              <p><span className="text-gray-500">Método:</span> {order.paymentMethod}</p>
                              {order.paymentId && <p><span className="text-gray-500">ID:</span> <span className="font-mono text-xs">{order.paymentId}</span></p>}
                            </div>
                          </>
                        )}

                        {order.notes && (
                          <>
                            <h4 className="font-semibold text-sm text-gray-700 mt-4">Notas</h4>
                            <p className="text-sm text-gray-600 bg-white rounded p-2 border">{order.notes}</p>
                          </>
                        )}
                      </div>

                      {/* Order Items */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm text-gray-700">Productos</h4>
                        <div className="bg-white rounded-lg border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead className="text-center">Cant.</TableHead>
                                <TableHead className="text-right">Precio</TableHead>
                                <TableHead className="text-right">Subtotal</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {order.items.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="text-sm">{item.name}</TableCell>
                                  <TableCell className="text-center">{item.quantity}</TableCell>
                                  <TableCell className="text-right text-sm">{formatARS(item.price)}</TableCell>
                                  <TableCell className="text-right font-medium text-sm">
                                    {formatARS(item.price * item.quantity)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          <div className="border-t p-3 flex justify-between items-center bg-gray-50">
                            <span className="font-semibold text-sm">Total</span>
                            <span className="font-bold text-lg">{formatARS(order.total)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>Creado: {formatDate(order.createdAt)}</span>
                          <span>·</span>
                          <span>Actualizado: {formatDate(order.updatedAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-4 border-t flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation()
                          openDeleteDialog(order)
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Eliminar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          openStatusDialog(order)
                        }}
                      >
                        <Truck className="w-4 h-4 mr-1" />
                        Actualizar Estado
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Eliminar Pedido #{orderToDelete?.orderNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              ¿Estás seguro de que querés eliminar este pedido? Esta acción no se puede deshacer.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-800">
                Pedido #{orderToDelete?.orderNumber} - {orderToDelete?.customerName}
              </p>
              <p className="text-sm text-red-600 mt-1">
                Total: {orderToDelete ? formatARS(orderToDelete.total) : ''}
              </p>
              <p className="text-xs text-red-500 mt-1">
                Se eliminarán {orderToDelete?.items.length} producto(s) del pedido
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteOrder}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Sí, eliminar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Actualizar Pedido #{selectedOrder?.orderNumber}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tracking">Número de Tracking</Label>
              <Input
                id="tracking"
                value={newTracking}
                onChange={(e) => setNewTracking(e.target.value)}
                placeholder="Número de seguimiento"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order-notes">Notas</Label>
              <Textarea
                id="order-notes"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Notas internas sobre el pedido"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveStatus} className="bg-compucity-green hover:bg-compucity-green-dark" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog (sesión 51) */}
      <Dialog open={editCustomerDialogOpen} onOpenChange={setEditCustomerDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          {orderForCustomerEdit && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                Editando cliente del pedido <span className="font-mono">#{orderForCustomerEdit.orderNumber}</span>
                {orderForCustomerEdit.customerId && (
                  <span className="ml-2 text-gray-400">(ID: {orderForCustomerEdit.customerId.slice(0, 8)}...)</span>
                )}
              </p>

              {customerLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-compucity-green" />
                  <span className="ml-2 text-sm text-gray-500">Cargando datos del cliente...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cust-name">Nombre y apellido *</Label>
                    <Input
                      id="cust-name"
                      value={customerForm.name}
                      onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                      placeholder="Nombre completo"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cust-email">Email *</Label>
                    <Input
                      id="cust-email"
                      type="email"
                      value={customerForm.email}
                      onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                      placeholder="email@ejemplo.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cust-phone">Teléfono</Label>
                    <Input
                      id="cust-phone"
                      value={customerForm.phone}
                      onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                      placeholder="Ej: 3548 40-2056"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cust-dni">DNI</Label>
                    <Input
                      id="cust-dni"
                      value={customerForm.dni}
                      onChange={(e) => setCustomerForm({ ...customerForm, dni: e.target.value })}
                      placeholder="DNI (sin puntos)"
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cust-address">Dirección</Label>
                    <Input
                      id="cust-address"
                      value={customerForm.address}
                      onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                      placeholder="Calle, número, piso, depto"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cust-city">Ciudad</Label>
                    <Input
                      id="cust-city"
                      value={customerForm.city}
                      onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                      placeholder="Ciudad"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cust-province">Provincia</Label>
                    <select
                      id="cust-province"
                      value={customerForm.province}
                      onChange={(e) => setCustomerForm({ ...customerForm, province: e.target.value })}
                      className="w-full h-10 border border-gray-300 rounded-md px-3 text-sm bg-white focus:outline-none focus:border-compucity-green focus:ring-1 focus:ring-compucity-green"
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

                  <div className="space-y-2">
                    <Label htmlFor="cust-postalCode">Código Postal</Label>
                    <Input
                      id="cust-postalCode"
                      value={customerForm.postalCode}
                      onChange={(e) => setCustomerForm({ ...customerForm, postalCode: e.target.value })}
                      placeholder="CP"
                    />
                  </div>
                </div>
              )}

              {editCustomerError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {editCustomerError}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCustomerDialogOpen(false)} disabled={customerSaving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCustomerEdit}
              className="bg-compucity-green hover:bg-compucity-green-dark"
              disabled={customerSaving || customerLoading || !customerForm.name.trim() || !customerForm.email.trim()}
            >
              {customerSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar cambios'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
