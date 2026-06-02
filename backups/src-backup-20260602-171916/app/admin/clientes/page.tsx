'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Loader2,
  Users,
  Search,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  ShoppingBag,
  Trash2,
  Download,
  KeyRound,
  Copy,
  Check,
  MessageCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface Customer {
  id: string
  name: string
  email: string
  phone: string | null
  dni: string | null
  address: string | null
  city: string | null
  province: string | null
  postalCode: string | null
  createdAt: string
  updatedAt: string
  orderCount: number
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

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function AdminClientes() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Reset password state
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [customerToReset, setCustomerToReset] = useState<Customer | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetUrl, setResetUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [resetError, setResetError] = useState('')

  const loadCustomers = useCallback(async (searchTerm: string = '', pageNum: number = 1) => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.set('search', searchTerm)
      params.set('page', pageNum.toString())

      const res = await fetch(`/api/admin/customers?${params}`)
      const data = await res.json()
      if (data.ok) {
        setCustomers(data.customers)
        setTotal(data.total)
        setPage(data.page)
        setTotalPages(data.totalPages)
      }
    } catch (error) {
      console.error('Error loading customers:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  const handleSearch = () => {
    setLoading(true)
    setPage(1)
    loadCustomers(search, 1)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleClearSearch = () => {
    setSearch('')
    setLoading(true)
    setPage(1)
    loadCustomers('', 1)
  }

  const handlePageChange = (newPage: number) => {
    setLoading(true)
    loadCustomers(search, newPage)
  }

  const handleDelete = async () => {
    if (!customerToDelete) return
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: customerToDelete.id }),
      })
      const data = await res.json()
      if (data.ok) {
        setCustomers(prev => prev.filter(c => c.id !== customerToDelete.id))
        setTotal(prev => prev - 1)
        setDeleteDialogOpen(false)
        setCustomerToDelete(null)
      }
    } catch (error) {
      console.error('Error deleting customer:', error)
    } finally {
      setDeleting(false)
    }
  }

  const openDeleteDialog = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation()
    setCustomerToDelete(customer)
    setDeleteDialogOpen(true)
  }

  const openResetDialog = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation()
    setCustomerToReset(customer)
    setResetUrl('')
    setCopied(false)
    setResetError('')
    setResetDialogOpen(true)
  }

  const handleGenerateResetLink = async () => {
    if (!customerToReset) return
    setResetLoading(true)
    setResetError('')
    try {
      const res = await fetch('/api/admin/customers/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: customerToReset.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResetError(data.error || 'Error al generar enlace')
        return
      }
      setResetUrl(data.resetUrl)
    } catch {
      setResetError('Error de conexión')
    } finally {
      setResetLoading(false)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(resetUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  const getWhatsAppUrl = () => {
    if (!customerToReset || !resetUrl) return ''
    const phone = customerToReset.phone
    if (!phone) return ''
    const cleanPhone = phone.replace(/\D/g, '')
    const message = encodeURIComponent(
      `Hola ${customerToReset.name}, acá tenés el enlace para restablecer tu contraseña de Compucity:\n\n${resetUrl}\n\nEl enlace dura 24 horas. Si no lo solicitaste, ignorá este mensaje.`
    )
    return `https://wa.me/${cleanPhone.startsWith('0') ? '549' + cleanPhone.substring(1) : '549' + cleanPhone}?text=${message}`
  }

  const toggleExpand = (customerId: string) => {
    setExpandedCustomer(prev => prev === customerId ? null : customerId)
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
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500">{total} clientes registrados</p>
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

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre, email, teléfono o DNI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} className="bg-compucity-green hover:bg-compucity-green-dark">
          Buscar
        </Button>
        {search && (
          <Button variant="outline" onClick={handleClearSearch}>
            Limpiar
          </Button>
        )}
      </div>

      {/* Customer List */}
      {customers.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>No hay clientes registrados aún</p>
              <p className="text-sm mt-1">Los clientes aparecerán aquí cuando se registren en la tienda</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {customers.map((customer) => {
            const isExpanded = expandedCustomer === customer.id

            return (
              <Card key={customer.id} className="overflow-hidden">
                {/* Customer Header Row */}
                <div
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpand(customer.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-compucity-green-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-compucity-green-dark font-bold text-sm">
                        {customer.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{customer.name}</p>
                      <p className="text-xs text-gray-500 truncate">{customer.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {customer.orderCount > 0 && (
                      <Badge variant="secondary" className="bg-compucity-green-100 text-compucity-green-dark">
                        <ShoppingBag className="w-3 h-3 mr-1" />
                        {customer.orderCount} {customer.orderCount === 1 ? 'pedido' : 'pedidos'}
                      </Badge>
                    )}
                    <span className="text-xs text-gray-400 hidden sm:block">
                      {formatShortDate(customer.createdAt)}
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
                      {/* Contact Info */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm text-gray-700">Datos de Contacto</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <a href={`mailto:${customer.email}`} className="text-compucity-green hover:underline">
                              {customer.email}
                            </a>
                          </div>
                          {customer.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-4 h-4 text-gray-400" />
                              <span>{customer.phone}</span>
                            </div>
                          )}
                          {customer.dni && (
                            <div className="flex items-center gap-2 text-sm">
                              <CreditCard className="w-4 h-4 text-gray-400" />
                              <span>DNI: {customer.dni}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Address Info */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm text-gray-700">Dirección de Envío</h4>
                        {customer.address || customer.city || customer.province ? (
                          <div className="space-y-2">
                            {customer.address && (
                              <div className="flex items-start gap-2 text-sm">
                                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                                <span>{customer.address}</span>
                              </div>
                            )}
                            {(customer.city || customer.province || customer.postalCode) && (
                              <div className="text-sm text-gray-600 pl-6">
                                {[
                                  customer.city,
                                  customer.province,
                                  customer.postalCode && `CP ${customer.postalCode}`
                                ].filter(Boolean).join(', ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic">Sin dirección registrada</p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-4 border-t flex justify-between items-center">
                      <div className="text-xs text-gray-400">
                        Registrado: {formatDate(customer.createdAt)} · Última actualización: {formatDate(customer.updatedAt)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-compucity-green hover:text-compucity-green-dark hover:bg-compucity-green-50"
                          onClick={(e) => openResetDialog(e, customer)}
                        >
                          <KeyRound className="w-4 h-4 mr-1" />
                          Restablecer contraseña
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => openDeleteDialog(e, customer)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-gray-500">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer Contraseña</DialogTitle>
          </DialogHeader>
          {customerToReset && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Generá un enlace de recuperación para <strong>{customerToReset.name}</strong> ({customerToReset.email}).
                Luego enviáselo por WhatsApp para que pueda cambiar su contraseña.
              </p>

              {!resetUrl ? (
                <Button
                  onClick={handleGenerateResetLink}
                  disabled={resetLoading}
                  className="w-full bg-compucity-green hover:bg-compucity-green-dark text-white"
                >
                  {resetLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando enlace...</>
                  ) : (
                    <><KeyRound className="w-4 h-4 mr-2" />Generar enlace de recuperación</>
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800 font-medium mb-2">Enlace generado (dura 24 horas):</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={resetUrl}
                        className="flex-1 text-xs bg-white border rounded px-2 py-1.5 text-gray-700 select-all"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyLink}
                        className="shrink-0"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {customerToReset.phone ? (
                    <a
                      href={getWhatsAppUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Enviar por WhatsApp a {customerToReset.name}
                    </a>
                  ) : (
                    <p className="text-xs text-amber-600">
                      Este cliente no tiene teléfono registrado. Copiá el enlace y enviáselo manualmente.
                    </p>
                  )}
                </div>
              )}

              {resetError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {resetError}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Cliente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            ¿Estás seguro de que quieres eliminar al cliente <strong>{customerToDelete?.name}</strong> ({customerToDelete?.email})?
            Los pedidos asociados no se eliminarán, pero se desvincularán de este cliente.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
