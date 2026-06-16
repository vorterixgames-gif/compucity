'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Loader2,
  Truck,
  Search,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Globe,
  Mail,
  Phone,
  User,
  Key,
  Link2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FolderInput,
  ArrowRight,
  Save,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ParentCategory {
  id: string
  name: string
  slug: string
}

interface Supplier {
  id: string
  name: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  website: string | null
  apiType: string
  apiBaseUrl: string | null
  apiUserId: string | null
  apiToken: string | null
  apiUsername: string | null
  apiPassword: string | null
  markup: number
  currency: string
  isActive: number
  allowedCategories: string[] | null
  lastSyncAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  productCount: number
  inactiveCount: number
}

const apiTypeLabels: Record<string, { label: string; color: string }> = {
  none: { label: 'Sin API', color: 'bg-gray-100 text-gray-600' },
  invid: { label: 'Invid Computers', color: 'bg-blue-100 text-blue-700' },
  air_intra: { label: 'Air Intra', color: 'bg-purple-100 text-purple-700' },
  elit: { label: 'ELIT', color: 'bg-orange-100 text-orange-700' },
  custom: { label: 'Custom API', color: 'bg-teal-100 text-teal-700' },
}

interface FormData {
  name: string
  contactName: string
  contactEmail: string
  contactPhone: string
  website: string
  apiType: string
  apiBaseUrl: string
  apiUserId: string
  apiToken: string
  apiUsername: string
  apiPassword: string
  markup: number
  currency: string
  isActive: boolean
  notes: string
}

interface SupplierCategoryInfo {
  supplierCategory: string
  productCount: number
}

interface CategoryMapping {
  id: string
  supplierId: string
  supplierCategory: string
  storeCategoryId: string
  storeCategoryName: string | null
}

interface StoreCategory {
  id: string
  name: string
  slug: string
  parentId: string | null
  displayName: string
}

const emptyForm: FormData = {
  name: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  website: '',
  apiType: 'none',
  apiBaseUrl: '',
  apiUserId: '',
  apiToken: '',
  apiUsername: '',
  apiPassword: '',
  markup: 30,
  currency: 'USD',
  isActive: true,
  notes: '',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Nunca'
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminProveedores() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [parentCategories, setParentCategories] = useState<ParentCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null)

  // Form dialog
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingName, setDeletingName] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Sync
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null)
  // Cooldown state: when > 0, sync button is disabled and a countdown is shown.
  // Set when the server returns a RATE_LIMITED_COOLDOWN message.
  const [cooldownRemaining, setCooldownRemaining] = useState(0)

  // Test connection
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Category mapping dialog
  const [mappingOpen, setMappingOpen] = useState(false)
  const [mappingSupplierId, setMappingSupplierId] = useState<string | null>(null)
  const [mappingSupplierName, setMappingSupplierName] = useState('')
  const [supplierCategories, setSupplierCategories] = useState<SupplierCategoryInfo[]>([])
  const [categoryMappings, setCategoryMappings] = useState<CategoryMapping[]>([])
  const [storeCategories, setStoreCategories] = useState<StoreCategory[]>([])
  const [mappingLoading, setMappingLoading] = useState(false)
  const [mappingSaving, setMappingSaving] = useState<Record<string, boolean>>({})
  const [recategorizing, setRecategorizing] = useState(false)
  const [recategorizeResult, setRecategorizeResult] = useState<{ ok: boolean; message: string } | null>(null)

  const loadSuppliers = useCallback(async (searchTerm: string = '', pageNum: number = 1) => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.set('search', searchTerm)
      params.set('page', pageNum.toString())

      const res = await fetch(`/api/admin/suppliers?${params}`)
      const data = await res.json()
      if (data.ok) {
        setSuppliers(data.suppliers)
        if (data.parentCategories) setParentCategories(data.parentCategories)
        setTotal(data.total)
        setPage(data.page)
        setTotalPages(data.totalPages)
      }
    } catch (error) {
      console.error('Error loading suppliers:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  // On mount: check if there's an active cooldown from a previous session
  // (e.g. user closed the tab and reopened). We pick the first Air Intra
  // supplier we can find to query the cooldown status.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/suppliers?page=1')
        const data = await res.json()
        if (!data.ok) return
        const airIntra = (data.suppliers || []).find((s: Supplier) => s.apiType === 'air_intra')
        if (!airIntra) return
        const st = await fetch(`/api/admin/suppliers/sync?supplierId=${encodeURIComponent(airIntra.id)}`)
        if (!st.ok) return
        const stData = await st.json()
        if (stData.cooldownRemaining && stData.cooldownRemaining > 0) {
          setCooldownRemaining(Math.ceil(stData.cooldownRemaining / 1000))
        }
      } catch (e) {
        // best-effort — ignore
      }
    })()
  }, [])

  // Countdown effect: tick cooldownRemaining down every second until it hits 0.
  // When it reaches 0, clear the cooldown banner automatically.
  useEffect(() => {
    if (cooldownRemaining <= 0) return
    const id = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) {
          clearInterval(id)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [cooldownRemaining])

  const handleSearch = () => {
    setLoading(true)
    setPage(1)
    loadSuppliers(search, 1)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleClearSearch = () => {
    setSearch('')
    setLoading(true)
    setPage(1)
    loadSuppliers('', 1)
  }

  const handlePageChange = (newPage: number) => {
    setLoading(true)
    loadSuppliers(search, newPage)
  }

  // Form handlers
  const openCreateForm = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setFormOpen(true)
  }

  const openEditForm = (supplier: Supplier) => {
    setEditingId(supplier.id)
    setForm({
      name: supplier.name || '',
      contactName: supplier.contactName || '',
      contactEmail: supplier.contactEmail || '',
      contactPhone: supplier.contactPhone || '',
      website: supplier.website || '',
      apiType: supplier.apiType || 'none',
      apiBaseUrl: supplier.apiBaseUrl || '',
      apiUserId: supplier.apiUserId || '',
      apiToken: supplier.apiToken || '',
      apiUsername: supplier.apiUsername || '',
      apiPassword: supplier.apiPassword || '',
      markup: supplier.markup ?? 30,
      currency: supplier.currency || 'USD',
      isActive: supplier.isActive === 1,
      notes: supplier.notes || '',
    })
    setFormError('')
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError('El nombre es requerido')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      const url = '/api/admin/suppliers'
      const method = editingId ? 'PUT' : 'POST'
      const body = editingId ? { id: editingId, ...form } : form

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (data.ok) {
        setFormOpen(false)
        loadSuppliers(search, page)
      } else {
        setFormError(data.error || 'Error al guardar')
      }
    } catch (error) {
      setFormError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  // Delete handlers
  const openDeleteDialog = (e: React.MouseEvent, supplier: Supplier) => {
    e.stopPropagation()
    setDeletingId(supplier.id)
    setDeletingName(supplier.name)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/suppliers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingId }),
      })
      const data = await res.json()
      if (data.ok) {
        setSuppliers(prev => prev.filter(s => s.id !== deletingId))
        setTotal(prev => prev - 1)
        setDeleteOpen(false)
        setDeletingId(null)
      }
    } catch (error) {
      console.error('Error deleting supplier:', error)
    } finally {
      setDeleting(false)
    }
  }

  // Safe JSON parser - handles non-JSON responses (Vercel timeouts, error pages)
  const safeFetchJson = async (url: string, options: RequestInit): Promise<any> => {
    const res = await fetch(url, options)
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      return await res.json()
    }
    // Response is not JSON (HTML error page, Vercel timeout, etc.)
    const text = await res.text().catch(() => '')
    if (res.status === 504 || text.includes('timeout') || text.includes('TIMEOUT')) {
      throw new Error('La sincronización tardó demasiado (timeout de Vercel 60s). Intente de nuevo — los lotes ahora son de 1 página (~500 productos) para encajar en el límite.')
    }
    if (res.status === 413) {
      throw new Error('El archivo es demasiado grande para subir (límite de Vercel).')
    }
    throw new Error(`Error del servidor (${res.status}): ${text.substring(0, 150) || 'Respuesta no válida'}`)
  }

  // Sync handler
  const handleSync = async (e: React.MouseEvent, supplier: Supplier) => {
    e.stopPropagation()
    setSyncingId(supplier.id)
    setSyncResult(null)
    setSyncProgress(null)

    try {
      if (supplier.apiType === 'air_intra') {
        // Batched sync for Air Intra to avoid Vercel Hobby 60s timeout
        // Each batch processes PAGES_PER_BATCH (1) page of ~500 products
        // (reduced from 2 pages because 2 still timed out on Vercel)
        const PAGES_PER_BATCH = 1
        let token: string | undefined
        let exchangeRate: number | undefined
        let nextPage: number | undefined
        let batchNum = 1
        let totalCreated = 0
        let totalUpdated = 0
        let totalFetched = 0
        let totalErrors = 0

        // First call: login + first batch
        const firstData = await safeFetchJson('/api/admin/suppliers/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supplierId: supplier.id }),
        })

        if (!firstData.ok) {
          armCooldownIfPresent(firstData.message)
          setSyncResult({ ok: false, message: firstData.message || 'Error en sincronización' })
          setSyncingId(null)
          setSyncProgress(null)
          return
        }

        totalCreated += firstData.created || 0
        totalUpdated += firstData.updated || 0
        totalFetched += firstData.total || 0
        totalErrors += firstData.errors || 0
        token = firstData.token
        exchangeRate = firstData.exchangeRate
        nextPage = firstData.nextPage

        // Continue with subsequent batches if there are more pages
        while (firstData.hasMore && nextPage !== undefined && token) {
          batchNum++
          setSyncProgress({ current: batchNum, total: -1 }) // -1 = unknown total batches

          const batchData = await safeFetchJson('/api/admin/suppliers/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supplierId: supplier.id,
              batch: {
                startPage: nextPage,
                endPage: nextPage + PAGES_PER_BATCH - 1,
                token,
                exchangeRate,
              },
            }),
          })

          if (!batchData.ok) {
            // Error on a batch — stop immediately and report what we've accumulated so far.
            // Previously checked `!batchData.ok && !batchData.hasMore`, but the rate limit path
            // returns ok=false + hasMore=true, which let the loop continue through 16+ failing
            // batches with 0 products each. Now we stop on ANY batch failure.
            armCooldownIfPresent(batchData.message)
            setSyncResult({
              ok: totalFetched > 0,
              message: totalFetched > 0
                ? `Sincronización parcial: ${totalFetched} productos procesados, ${totalCreated} nuevos, ${totalUpdated} actualizados. Error en lote ${batchNum}: ${batchData.message}`
                : `Error en lote ${batchNum}: ${batchData.message}`,
            })
            loadSuppliers(search, page)
            setSyncingId(null)
            setSyncProgress(null)
            return
          }

          totalCreated += batchData.created || 0
          totalUpdated += batchData.updated || 0
          totalFetched += batchData.total || 0
          totalErrors += batchData.errors || 0
          token = batchData.token || token
          exchangeRate = batchData.exchangeRate || exchangeRate
          nextPage = batchData.nextPage

          // Update firstData.hasMore for the loop condition
          firstData.hasMore = batchData.hasMore
        }

        setSyncProgress({ current: batchNum, total: batchNum }) // Indicate finalization phase

        // Finalize step: syp sync, recategorization, recovery
        if (token) {
          const finalizeData = await safeFetchJson('/api/admin/suppliers/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supplierId: supplier.id,
              batch: {
                startPage: 0,
                endPage: 0,
                token,
                exchangeRate,
                finalize: true,
              },
            }),
          })
          totalCreated += finalizeData.created || 0
          totalUpdated += finalizeData.updated || 0
          totalFetched += finalizeData.total || 0
          totalErrors += finalizeData.errors || 0

          const finalizeNote = finalizeData.ok
            ? (finalizeData.message || 'Post-procesamiento completado')
            : `Advertencia en post-procesamiento: ${finalizeData.message}`

          setSyncResult({
            ok: true,
            message: `Sincronización completada: ${totalFetched} productos, ${totalCreated} nuevos, ${totalUpdated} actualizados, ${totalErrors} errores. ${finalizeNote}`,
          })
        } else {
          setSyncResult({
            ok: true,
            message: `Sincronización completada: ${totalFetched} productos, ${totalCreated} nuevos, ${totalUpdated} actualizados, ${totalErrors} errores`,
          })
        }
      } else {
        // Non-Air Intra suppliers: single request sync (Invid, Elit)
        const data = await safeFetchJson('/api/admin/suppliers/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supplierId: supplier.id }),
        })
        setSyncResult({ ok: data.ok, message: data.message || 'Sincronización completada' })
      }

      loadSuppliers(search, page)
    } catch (error: any) {
      setSyncResult({ ok: false, message: `Error: ${error.message}` })
    } finally {
      setSyncingId(null)
      setSyncProgress(null)
    }
  }

  // Test connection handler
  // Helper: detect RATE_LIMITED_COOLDOWN marker in server response, extract
  // remaining seconds, and arm the countdown UI. Returns true if a cooldown
  // was detected (so caller can skip further processing).
  const armCooldownIfPresent = (message: string | undefined): boolean => {
    if (!message) return false
    // Match "(NNNs)" anywhere in the message — server always formats it as "Espere ~X minuto(s) (NNNs)"
    const m = message.match(/\((\d+)s\)/)
    if (m) {
      const secs = parseInt(m[1], 10)
      if (Number.isFinite(secs) && secs > 0) {
        setCooldownRemaining(secs)
        return true
      }
    }
    // Fallback: marker present but no "(NNs)" → assume 5 min default
    if (message.includes('RATE_LIMITED_COOLDOWN')) {
      setCooldownRemaining(5 * 60)
      return true
    }
    return false
  }

  const handleTestConnection = async (e: React.MouseEvent, supplier: Supplier) => {
    e.stopPropagation()
    setTestingId(supplier.id)
    setTestResult(null)

    try {
      const data = await safeFetchJson('/api/admin/suppliers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiType: supplier.apiType,
          apiBaseUrl: supplier.apiBaseUrl,
          apiUsername: supplier.apiUsername,
          apiPassword: supplier.apiPassword,
          apiUserId: supplier.apiUserId,
          apiToken: supplier.apiToken,
        }),
      })
      setTestResult({ ok: data.ok, message: data.message })
    } catch (error: any) {
      setTestResult({ ok: false, message: `Error: ${error.message}` })
    } finally {
      setTestingId(null)
    }
  }

  const toggleExpand = (supplierId: string) => {
    setExpandedSupplier(prev => prev === supplierId ? null : supplierId)
    setSyncResult(null)
    setTestResult(null)
  }

  // Get default base URL for api type
  const getDefaultBaseUrl = (apiType: string) => {
    switch (apiType) {
      case 'invid': return 'https://www.invidcomputers.com'
      case 'air_intra': return 'https://api.air-intra.com/v2'
      case 'elit': return 'https://clientes.elit.com.ar'
      default: return ''
    }
  }

  // Category mapping handlers
  const openMappingDialog = async (e: React.MouseEvent, supplier: Supplier) => {
    e.stopPropagation()
    setMappingSupplierId(supplier.id)
    setMappingSupplierName(supplier.name)
    setMappingLoading(true)
    setMappingOpen(true)
    setRecategorizeResult(null)

    try {
      const res = await fetch(`/api/admin/suppliers/category-mappings?supplierId=${supplier.id}`)
      const data = await res.json()
      if (data.ok) {
        setSupplierCategories(data.supplierCategories || [])
        setCategoryMappings(data.mappings || [])
        setStoreCategories(data.storeCategories || [])
      }
    } catch (error) {
      console.error('Error loading category mappings:', error)
    } finally {
      setMappingLoading(false)
    }
  }

  const handleMappingSave = async (supplierCategory: string, storeCategoryId: string) => {
    if (!mappingSupplierId) return
    setMappingSaving(prev => ({ ...prev, [supplierCategory]: true }))

    try {
      const res = await fetch('/api/admin/suppliers/category-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: mappingSupplierId,
          supplierCategory,
          storeCategoryId,
        }),
      })

      const data = await res.json()
      if (data.ok) {
        // Refresh mappings
        const mapRes = await fetch(`/api/admin/suppliers/category-mappings?supplierId=${mappingSupplierId}`)
        const mapData = await mapRes.json()
        if (mapData.ok) {
          setCategoryMappings(mapData.mappings || [])
        }
      }
    } catch (error) {
      console.error('Error saving mapping:', error)
    } finally {
      setMappingSaving(prev => ({ ...prev, [supplierCategory]: false }))
    }
  }

  const handleMappingDelete = async (mappingId: string) => {
    try {
      await fetch(`/api/admin/suppliers/category-mappings?id=${mappingId}`, { method: 'DELETE' })
      // Refresh mappings
      if (mappingSupplierId) {
        const mapRes = await fetch(`/api/admin/suppliers/category-mappings?supplierId=${mappingSupplierId}`)
        const mapData = await mapRes.json()
        if (mapData.ok) {
          setCategoryMappings(mapData.mappings || [])
        }
      }
    } catch (error) {
      console.error('Error deleting mapping:', error)
    }
  }

  const handleRecategorize = async () => {
    if (!mappingSupplierId) return
    setRecategorizing(true)
    setRecategorizeResult(null)

    try {
      const res = await fetch('/api/admin/suppliers/recategorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId: mappingSupplierId }),
      })

      const data = await res.json()
      setRecategorizeResult({ ok: data.ok, message: data.message || 'Recategorización completada' })
    } catch (error: any) {
      setRecategorizeResult({ ok: false, message: `Error: ${error.message}` })
    } finally {
      setRecategorizing(false)
    }
  }

  // Helper: get current mapping for a supplier category
  const getMappingForCategory = (supplierCategory: string): CategoryMapping | undefined => {
    return categoryMappings.find(m => m.supplierCategory === supplierCategory)
  }

  // Toggle allowed category for a supplier
  const handleToggleAllowedCategory = async (supplier: Supplier, categorySlug: string) => {
    const current = supplier.allowedCategories || []
    const isCurrentlyAllowed = current.includes(categorySlug)
    const newAllowed = isCurrentlyAllowed
      ? current.filter((s: string) => s !== categorySlug)
      : [...current, categorySlug]

    // Optimistic update
    setSuppliers(prev => prev.map(s =>
      s.id === supplier.id ? { ...s, allowedCategories: newAllowed } : s
    ))

    try {
      await fetch('/api/admin/suppliers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: supplier.id, allowedCategories: newAllowed }),
      })
    } catch (error) {
      console.error('Error updating allowed categories:', error)
      // Revert on error
      setSuppliers(prev => prev.map(s =>
        s.id === supplier.id ? { ...s, allowedCategories: current } : s
      ))
    }
  }

  // Select all / deselect all categories for a supplier
  const handleSetAllCategories = async (supplier: Supplier, selectAll: boolean) => {
    const newAllowed = selectAll ? parentCategories.map(c => c.slug) : []

    setSuppliers(prev => prev.map(s =>
      s.id === supplier.id ? { ...s, allowedCategories: newAllowed.length > 0 ? newAllowed : null } : s
    ))

    try {
      await fetch('/api/admin/suppliers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: supplier.id, allowedCategories: newAllowed.length > 0 ? newAllowed : null }),
      })
    } catch (error) {
      console.error('Error updating allowed categories:', error)
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
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-sm text-gray-500">{total} proveedores registrados</p>
        </div>
        <Button
          onClick={openCreateForm}
          className="bg-compucity-green hover:bg-compucity-green-dark gap-2"
        >
          <Plus className="w-4 h-4" />
          Agregar Proveedor
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre, contacto o email..."
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

      {/* Sync/Test Result Banner */}
      {syncProgress && syncingId && (
        <div className="flex items-center gap-3 p-3 rounded-lg text-sm bg-blue-50 text-blue-700 border border-blue-200">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <span>
            Sincronizando lote {syncProgress.current}{syncProgress.total > 0 ? ` de ${syncProgress.total}` : ''}...
          </span>
          <div className="flex-1 h-2 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: syncProgress.total > 0 ? `${(syncProgress.current / syncProgress.total) * 100}%` : '100%' }}
            />
          </div>
        </div>
      )}
      {syncResult && !cooldownRemaining && (
        <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
          syncResult.ok
            ? syncResult.message?.includes('BROKEN_PAGE_SKIPPED')
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {syncResult.ok
            ? syncResult.message?.includes('BROKEN_PAGE_SKIPPED')
              ? <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              : <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          <span className="flex-1">{syncResult.message}</span>
          <button onClick={() => setSyncResult(null)} className="ml-auto text-current opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Cooldown banner: shown when server reported a severe Air Intra rate limit */}
      {cooldownRemaining > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg text-sm bg-amber-50 text-amber-800 border border-amber-300">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-semibold">
              Air Intra en cooldown — rate limit severo detectado
            </div>
            <div className="text-amber-700 text-xs mt-0.5">
              {syncResult?.message?.replace(/^(RATE_LIMITED_COOLDOWN|BROKEN_PAGE_SKIPPED):\s*/, '') ?? 'Espere antes de reintentar.'}
            </div>
            <div className="text-amber-900 text-xs mt-1">
              La sincronización se reanudará automáticamente desde la última página exitosa cuando expire el cooldown.
              No es necesario volver a sincronizar las páginas ya procesadas.
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono text-lg font-bold tabular-nums">
              {Math.floor(cooldownRemaining / 60)}:{(cooldownRemaining % 60).toString().padStart(2, '0')}
            </span>
            <span className="text-xs opacity-70">min:seg</span>
          </div>
        </div>
      )}

      {testResult && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          testResult.ok
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {testResult.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
          {testResult.message}
          <button onClick={() => setTestResult(null)} className="ml-auto text-current opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Supplier List */}
      {suppliers.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-400">
              <Truck className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>No hay proveedores registrados</p>
              <p className="text-sm mt-1">Agrega proveedores para sincronizar productos y precios</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {suppliers.map((supplier) => {
            const isExpanded = expandedSupplier === supplier.id
            const apiInfo = apiTypeLabels[supplier.apiType] || apiTypeLabels.none
            const isSyncing = syncingId === supplier.id
            const isTesting = testingId === supplier.id

            return (
              <Card key={supplier.id} className="overflow-hidden">
                {/* Supplier Header Row */}
                <div
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpand(supplier.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      supplier.isActive ? 'bg-compucity-green-100' : 'bg-gray-100'
                    }`}>
                      <Truck className={`w-5 h-5 ${supplier.isActive ? 'text-compucity-green-dark' : 'text-gray-400'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{supplier.name}</p>
                        {supplier.isActive === 0 && (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-500 text-xs">Inactivo</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className={apiInfo.color}>
                          {apiInfo.label}
                        </Badge>
                        {supplier.productCount > 0 && (
                          <span className="text-xs text-gray-500">
                            {supplier.productCount} productos
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-xs">
                      Markup: {supplier.markup}%
                    </Badge>
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
                          {supplier.contactName && (
                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-4 h-4 text-gray-400" />
                              <span>{supplier.contactName}</span>
                            </div>
                          )}
                          {supplier.contactEmail && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="w-4 h-4 text-gray-400" />
                              <a href={`mailto:${supplier.contactEmail}`} className="text-compucity-green hover:underline">
                                {supplier.contactEmail}
                              </a>
                            </div>
                          )}
                          {supplier.contactPhone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-4 h-4 text-gray-400" />
                              <span>{supplier.contactPhone}</span>
                            </div>
                          )}
                          {supplier.website && (
                            <div className="flex items-center gap-2 text-sm">
                              <Globe className="w-4 h-4 text-gray-400" />
                              <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-compucity-green hover:underline">
                                {supplier.website}
                              </a>
                            </div>
                          )}
                          {!supplier.contactName && !supplier.contactEmail && !supplier.contactPhone && !supplier.website && (
                            <p className="text-sm text-gray-400 italic">Sin datos de contacto</p>
                          )}
                        </div>
                      </div>

                      {/* API Info */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm text-gray-700">Configuración API</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Link2 className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">Tipo:</span>
                            <Badge variant="secondary" className={apiInfo.color}>{apiInfo.label}</Badge>
                          </div>
                          {supplier.apiBaseUrl && (
                            <div className="flex items-center gap-2 text-sm">
                              <Globe className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-500 truncate">{supplier.apiBaseUrl}</span>
                            </div>
                          )}
                          {supplier.apiUsername && (
                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-4 h-4 text-gray-400" />
                              <span>Usuario: {supplier.apiUsername}</span>
                            </div>
                          )}
                          {supplier.apiUserId && (
                            <div className="flex items-center gap-2 text-sm">
                              <Key className="w-4 h-4 text-gray-400" />
                              <span>User ID: {supplier.apiUserId}</span>
                            </div>
                          )}
                          {supplier.apiToken && (
                            <div className="flex items-center gap-2 text-sm">
                              <Key className="w-4 h-4 text-gray-400" />
                              <span>Token: {'•'.repeat(Math.min(supplier.apiToken.length, 12))}</span>
                            </div>
                          )}
                          {supplier.lastSyncAt && (
                            <div className="flex items-center gap-2 text-sm">
                              <RefreshCw className="w-4 h-4 text-gray-400" />
                              <span>Última sync: {formatDate(supplier.lastSyncAt)}</span>
                            </div>
                          )}
                          {supplier.apiType === 'none' && (
                            <p className="text-sm text-gray-400 italic">Sin integración API configurada</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    {supplier.notes && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                        <p className="text-sm text-yellow-800">{supplier.notes}</p>
                      </div>
                    )}

                    {/* Allowed Categories Filter */}
                    {supplier.apiType !== 'none' && parentCategories.length > 0 && (
                      <div className="mt-4 p-3 bg-white border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-sm text-gray-700">Categorías Permitidas</h4>
                          <div className="flex gap-2">
                            <button
                              className="text-xs text-compucity-green hover:underline"
                              onClick={() => handleSetAllCategories(supplier, true)}
                            >
                              Todas
                            </button>
                            <span className="text-xs text-gray-300">|</span>
                            <button
                              className="text-xs text-gray-500 hover:underline"
                              onClick={() => handleSetAllCategories(supplier, false)}
                            >
                              Ninguna
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mb-2">
                          {supplier.allowedCategories === null
                            ? 'Todas las categorías están permitidas (filtro desactivado)'
                            : supplier.allowedCategories.length === 0
                              ? 'Ninguna categoría permitida — todos los productos se desactivarán'
                              : `${supplier.allowedCategories.length} de ${parentCategories.length} categorías permitidas`
                          }
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {parentCategories.map(cat => {
                            const isAllowed = supplier.allowedCategories === null || supplier.allowedCategories.includes(cat.slug)
                            return (
                              <button
                                key={cat.id}
                                onClick={() => handleToggleAllowedCategory(supplier, cat.slug)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                                  isAllowed
                                    ? 'bg-compucity-green-50 text-compucity-green-dark border-compucity-green/30 hover:bg-compucity-green/20'
                                    : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                <span className={`w-2 h-2 rounded-full ${isAllowed ? 'bg-compucity-green' : 'bg-gray-300'}`} />
                                {cat.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-4 pt-4 border-t flex flex-wrap gap-2 justify-between items-center">
                      <div className="text-xs text-gray-400">
                        Creado: {formatDate(supplier.createdAt)} · Actualizado: {formatDate(supplier.updatedAt)}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {supplier.apiType !== 'none' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1"
                              onClick={(e) => handleTestConnection(e, supplier)}
                              disabled={isTesting}
                            >
                              {isTesting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                              {isTesting ? 'Probando...' : 'Probar Conexión'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-compucity-green hover:bg-compucity-green-50 gap-1"
                              onClick={(e) => handleSync(e, supplier)}
                              disabled={isSyncing || (cooldownRemaining > 0 && supplier.apiType === 'air_intra')}
                              title={cooldownRemaining > 0 && supplier.apiType === 'air_intra'
                                ? `En cooldown (${Math.floor(cooldownRemaining / 60)}:${(cooldownRemaining % 60).toString().padStart(2, '0')})`
                                : undefined}
                            >
                              {isSyncing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : cooldownRemaining > 0 && supplier.apiType === 'air_intra' ? (
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                              {isSyncing && syncProgress
                                ? `Lote ${syncProgress.current}/${syncProgress.total > 0 ? syncProgress.total : '...'}`
                                : isSyncing
                                  ? 'Sincronizando...'
                                  : cooldownRemaining > 0 && supplier.apiType === 'air_intra'
                                    ? `Cooldown ${Math.floor(cooldownRemaining / 60)}:${(cooldownRemaining % 60).toString().padStart(2, '0')}`
                                    : 'Sincronizar Productos'
                              }
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-1"
                              onClick={(e) => openMappingDialog(e, supplier)}
                            >
                              <FolderInput className="w-4 h-4" />
                              Mapear Categorías
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={(e) => { e.stopPropagation(); openEditForm(supplier) }}
                        >
                          <Pencil className="w-4 h-4" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                          onClick={(e) => openDeleteDialog(e, supplier)}
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Proveedor' : 'Agregar Proveedor'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {formError && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{formError}</div>
            )}

            {/* Basic Info */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-gray-700 border-b pb-1">Información Básica</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">Nombre *</label>
                  <Input
                    placeholder="Ej: Invid Computers"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">Sitio Web</label>
                  <Input
                    placeholder="https://..."
                    value={form.website}
                    onChange={(e) => setForm(prev => ({ ...prev, website: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-gray-700 border-b pb-1">Contacto</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">Nombre Contacto</label>
                  <Input
                    placeholder="Ej: Juan Pérez"
                    value={form.contactName}
                    onChange={(e) => setForm(prev => ({ ...prev, contactName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">Email</label>
                  <Input
                    placeholder="contacto@proveedor.com"
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => setForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">Teléfono</label>
                  <Input
                    placeholder="+54 11 1234-5678"
                    value={form.contactPhone}
                    onChange={(e) => setForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* API Config */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-gray-700 border-b pb-1">Integración API</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">Tipo de API</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.apiType}
                    onChange={(e) => {
                      const newType = e.target.value
                      setForm(prev => ({
                        ...prev,
                        apiType: newType,
                        apiBaseUrl: prev.apiBaseUrl || getDefaultBaseUrl(newType),
                      }))
                    }}
                  >
                    <option value="none">Sin API</option>
                    <option value="invid">Invid Computers</option>
                    <option value="air_intra">Air Intra</option>
                    <option value="elit">ELIT</option>
                    <option value="custom">Custom API</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">URL Base API</label>
                  <Input
                    placeholder="https://api.proveedor.com"
                    value={form.apiBaseUrl}
                    onChange={(e) => setForm(prev => ({ ...prev, apiBaseUrl: e.target.value }))}
                  />
                </div>
              </div>

              {/* Invid / Air Intra credentials */}
              {(form.apiType === 'invid' || form.apiType === 'air_intra' || form.apiType === 'custom') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1">Usuario API</label>
                    <Input
                      placeholder="usuario"
                      value={form.apiUsername}
                      onChange={(e) => setForm(prev => ({ ...prev, apiUsername: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1">Contraseña API</label>
                    <Input
                      placeholder="contraseña"
                      type="password"
                      value={form.apiPassword}
                      onChange={(e) => setForm(prev => ({ ...prev, apiPassword: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {/* ELIT credentials */}
              {(form.apiType === 'elit') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1">User ID</label>
                    <Input
                      placeholder="12345"
                      value={form.apiUserId}
                      onChange={(e) => setForm(prev => ({ ...prev, apiUserId: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1">Token</label>
                    <Input
                      placeholder="token_proporcionado_por_elit"
                      type="password"
                      value={form.apiToken}
                      onChange={(e) => setForm(prev => ({ ...prev, apiToken: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {/* API type help text */}
              {form.apiType === 'invid' && (
                <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                  Invid usa autenticación JWT (usuario/contraseña). El token se genera automáticamente al sincronizar.
                  Los productos se sincronizan en USD con el markup configurado.
                </p>
              )}
              {form.apiType === 'air_intra' && (
                <p className="text-xs text-gray-500 bg-purple-50 p-2 rounded">
                  Air Intra usa autenticación por Bearer Token (usuario/contraseña). Necesita registrarse en www.air-intra.com primero.
                  Los precios están en USD. La API devuelve stock por depósito.
                </p>
              )}
              {form.apiType === 'elit' && (
                <p className="text-xs text-gray-500 bg-orange-50 p-2 rounded">
                  ELIT usa user_id + token fijo (no expira). Obtenga sus credenciales desde el portal de ELIT en Servicios &gt; API.
                  Soporta sincronización incremental por fecha.
                </p>
              )}
            </div>

            {/* Pricing */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-gray-700 border-b pb-1">Precios y Markup</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">Markup (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="500"
                    value={form.markup}
                    onChange={(e) => setForm(prev => ({ ...prev, markup: parseInt(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-gray-400 mt-1">Porcentaje a agregar al costo</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">Moneda</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.currency}
                    onChange={(e) => setForm(prev => ({ ...prev, currency: e.target.value }))}
                  >
                    <option value="USD">USD (Dólares)</option>
                    <option value="ARS">ARS (Pesos)</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300 text-compucity-green focus:ring-compucity-green"
                    />
                    <span className="text-sm font-medium text-gray-600">Proveedor Activo</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">Notas</label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                placeholder="Notas adicionales sobre este proveedor..."
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-compucity-green hover:bg-compucity-green-dark"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                editingId ? 'Guardar Cambios' : 'Crear Proveedor'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Proveedor</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar al proveedor <strong>{deletingName}</strong>?
              Los productos asociados no se eliminarán, pero se desvincularán de este proveedor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Mapping Dialog */}
      <Dialog open={mappingOpen} onOpenChange={setMappingOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <FolderInput className="w-5 h-5 text-amber-600" />
                Mapear Categorías — {mappingSupplierName}
              </div>
            </DialogTitle>
          </DialogHeader>

          {mappingLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-compucity-green" />
              <span className="ml-2 text-gray-500">Cargando categorías...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Info Banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <strong>Cómo funciona:</strong> Las categorías del proveedor se asignan a las categorías de tu tienda.
                Cuando sincronices, los productos se asignarán automáticamente a la categoría correcta.
                Primero sincroniza los productos, luego mapea las categorías, y finalmente haz clic en &quot;Re-categorizar&quot;.
              </div>

              {/* Re-categorize result */}
              {recategorizeResult && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                  recategorizeResult.ok
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {recategorizeResult.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                  {recategorizeResult.message}
                  <button onClick={() => setRecategorizeResult(null)} className="ml-auto text-current opacity-60 hover:opacity-100">✕</button>
                </div>
              )}

              {/* Re-categorize button */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {supplierCategories.length} categorías del proveedor encontradas · {categoryMappings.length} mapeos configurados
                </p>
                <Button
                  onClick={handleRecategorize}
                  disabled={recategorizing || categoryMappings.length === 0}
                  className="bg-amber-600 hover:bg-amber-700 gap-1"
                  size="sm"
                >
                  {recategorizing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {recategorizing ? 'Re-categorizando...' : 'Re-categorizar Productos'}
                </Button>
              </div>

              {supplierCategories.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FolderInput className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No se encontraron categorías del proveedor</p>
                  <p className="text-xs mt-1">
                    Primero sincroniza los productos para que las categorías del proveedor se registren.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {supplierCategories.map((sc) => {
                    const existingMapping = getMappingForCategory(sc.supplierCategory)
                    const isSaving = mappingSaving[sc.supplierCategory]

                    return (
                      <div
                        key={sc.supplierCategory}
                        className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                      >
                        {/* Supplier category */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate" title={sc.supplierCategory}>
                            {sc.supplierCategory || '(sin categoría)'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {sc.productCount} producto{sc.productCount !== 1 ? 's' : ''}
                          </p>
                        </div>

                        {/* Arrow */}
                        <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />

                        {/* Store category selector */}
                        <div className="flex-1 min-w-0">
                          <select
                            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                            value={existingMapping?.storeCategoryId || ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleMappingSave(sc.supplierCategory, e.target.value)
                              }
                            }}
                          >
                            <option value="">— Sin mapear —</option>
                            {storeCategories
                              .sort((a, b) => a.displayName.localeCompare(b.displayName))
                              .map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.displayName}
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Status indicator */}
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin text-amber-500 flex-shrink-0" />
                        ) : existingMapping ? (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            {existingMapping.storeCategoryName && (
                              <span className="text-xs text-green-600 max-w-[120px] truncate" title={existingMapping.storeCategoryName}>
                                {existingMapping.storeCategoryName}
                              </span>
                            )}
                          </div>
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        )}

                        {/* Delete mapping button */}
                        {existingMapping && (
                          <button
                            onClick={() => handleMappingDelete(existingMapping.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                            title="Eliminar mapeo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
