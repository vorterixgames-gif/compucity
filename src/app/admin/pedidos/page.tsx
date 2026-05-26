'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Loader2,
  ShoppingCart,
  Eye,
  ChevronDown,
  ChevronUp,
  Truck,
  Download,
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
                      {formatPrice(order.total)}
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
                        <h4 className="font-semibold text-sm text-gray-700">Datos del Cliente</h4>
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
                          {order.shippingCost > 0 && <p><span className="text-gray-500">Costo envío:</span> {formatPrice(order.shippingCost)}</p>}
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
                                  <TableCell className="text-right text-sm">{formatPrice(item.price)}</TableCell>
                                  <TableCell className="text-right font-medium text-sm">
                                    {formatPrice(item.price * item.quantity)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          <div className="border-t p-3 flex justify-between items-center bg-gray-50">
                            <span className="font-semibold text-sm">Total</span>
                            <span className="font-bold text-lg">{formatPrice(order.total)}</span>
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
    </div>
  )
}
