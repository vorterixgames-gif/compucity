'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  X,
  Package,
  DollarSign,
  Calculator,
  ImageIcon,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
// Card & Table components not used - using plain HTML to avoid flex layout issues with overflow scroll
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import ImageUploader from '@/components/ui-custom/ImageUploader'

interface Category {
  id: string
  name: string
  slug: string
  parentId: string | null
  enabled: number
  markup: number | null
  cashDiscount: number | null
  ivaRate: number | null
}

interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  comparePrice: number | null
  costPrice: number | null
  sku: string | null
  stock: number
  stockByWarehouse: string | null
  isActive: number
  isFeatured: number
  images: string
  specs: string
  providerId: string | null
  providerName: string | null
  providerSku: string | null
  categoryId: string | null
  categoryName: string | null
  markup: number | null
  cashDiscount: number | null
  ivaRate: number | null
  salePrice: number | null
  saleStart: string | null
  saleEnd: string | null
  _calculated?: boolean
  _dollarRate?: number
  _effectiveMarkup?: number
  _effectiveCashDiscount?: number
  _effectiveIvaRate?: number
  _markupSource?: 'product' | 'category' | 'global'
  _cashDiscountSource?: 'product' | 'category' | 'global'
  _ivaRateSource?: 'product' | 'category' | 'default'
  createdAt: string
  updatedAt: string
}

interface ProductForm {
  name: string
  description: string
  price: string
  comparePrice: string
  costPrice: string
  sku: string
  stock: string
  isActive: boolean
  isFeatured: boolean
  imageUrls: string[]  // Array of image URLs (replaces JSON string)
  specs: string
  providerId: string
  providerSku: string
  categoryId: string
  markup: string       // individual product markup (empty = use global)
  cashDiscount: string  // individual product cash discount (empty = use global)
  ivaRate: string       // IVA percentage (empty = use category/default)
  salePrice: string     // promotional price (empty = no sale)
  saleStart: string     // sale start date (ISO)
  saleEnd: string       // sale end date (ISO)
}

type SortColumn = 'name' | 'categoryName' | 'costPrice' | 'price' | 'comparePrice' | 'stock' | 'isActive'
type SortDirection = 'asc' | 'desc'

interface Filters {
  category: string
  supplier: string // 'all' | 'none' | supplierId
  stockStatus: string // 'all' | 'inStock' | 'lowStock' | 'outOfStock'
  activeStatus: string // 'all' | 'active' | 'inactive'
  onSale: string // 'all' | 'yes' | 'no'
}

interface DollarConfig {
  rate: number
  markup: number
  cashDiscount: number
  source: string
}

interface SupplierOption {
  id: string
  name: string
}

interface CategoryOption {
  id: string
  name: string
  slug: string
  parentId: string | null
}

interface Pagination {
  page: number
  totalPages: number
  total: number
}

// Helper: get first image URL from a product's images JSON string
function getProductThumb(imagesJson: string): string | null {
  if (!imagesJson) return null
  try {
    const urls = JSON.parse(imagesJson)
    if (Array.isArray(urls) && urls.length > 0 && urls[0]) return urls[0]
  } catch {}
  return null
}

const emptyForm: ProductForm = {
  name: '',
  description: '',
  price: '',
  comparePrice: '',
  costPrice: '',
  sku: '',
  stock: '0',
  isActive: true,
  isFeatured: false,
  imageUrls: [],
  specs: '{}',
  providerId: '',
  providerSku: '',
  categoryId: '',
  markup: '',
  cashDiscount: '',
  ivaRate: '',
  salePrice: '',
  saleStart: '',
  saleEnd: '',
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(price)
}

export default function AdminProductos() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  // Pagination
  const [pagination, setPagination] = useState<Pagination>({ page: 1, totalPages: 1, total: 0 })
  const [pageSize, setPageSize] = useState(50)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Resolve category pricing with parent inheritance (subcategory → parent → null)
  const getCategoryPricing = useCallback((categoryId: string | null): { markup: number | null; cashDiscount: number | null; ivaRate: number | null; categoryName: string | null } => {
    if (!categoryId) return { markup: null, cashDiscount: null, ivaRate: null, categoryName: null }
    const cat = categories.find(c => c.id === categoryId)
    if (!cat) return { markup: null, cashDiscount: null, ivaRate: null, categoryName: null }

    // If the category has the value, use it; otherwise check parent
    const resolve = (field: 'markup' | 'cashDiscount' | 'ivaRate'): number | null => {
      if (cat[field] != null) return cat[field]
      // Walk up the parent chain
      let parentId = cat.parentId
      while (parentId) {
        const parent = categories.find(c => c.id === parentId)
        if (!parent) break
        if (parent[field] != null) return parent[field]
        parentId = parent.parentId
      }
      return null
    }

    return {
      markup: resolve('markup'),
      cashDiscount: resolve('cashDiscount'),
      ivaRate: resolve('ivaRate'),
      categoryName: cat.name,
    }
  }, [categories])

  // Sorting
  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Filters
  const [filters, setFilters] = useState<Filters>({
    category: 'all',
    supplier: 'all',
    stockStatus: 'all',
    activeStatus: 'all',
    onSale: 'all',
  })
  const [showFilters, setShowFilters] = useState(false)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Dialog states
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [formError, setFormError] = useState('')

  // Dollar config for price calculation
  const [dollarConfig, setDollarConfig] = useState<DollarConfig | null>(null)
  const [calculatedListPrice, setCalculatedListPrice] = useState<number | null>(null)
  const [calculatedCashPrice, setCalculatedCashPrice] = useState<number | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [generatingDescription, setGeneratingDescription] = useState(false)
  const [generatingAiId, setGeneratingAiId] = useState<string | null>(null)
  const [batchAiLoading, setBatchAiLoading] = useState(false)
  const [batchAiResult, setBatchAiResult] = useState<string | null>(null)

  const loadProducts = useCallback(async (opts?: { page?: number; limit?: number; search?: string; filters?: Filters; sortColumn?: SortColumn; sortDirection?: SortDirection }) => {
    const currentPage = opts?.page ?? pagination.page
    const currentLimit = opts?.limit ?? pageSize
    const currentSearch = opts?.search !== undefined ? opts.search : search
    const currentFilters = opts?.filters ?? filters
    const currentSortCol = opts?.sortColumn ?? sortColumn
    const currentSortDir = opts?.sortDirection ?? sortDirection

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const params = new URLSearchParams()
      params.set('page', String(currentPage))
      params.set('limit', String(currentLimit))
      if (currentSearch) params.set('search', currentSearch)
      if (currentFilters.category && currentFilters.category !== 'all') params.set('categoryId', currentFilters.category)
      if (currentFilters.supplier && currentFilters.supplier !== 'all') params.set('supplierId', currentFilters.supplier)
      if (currentFilters.stockStatus && currentFilters.stockStatus !== 'all') params.set('stockStatus', currentFilters.stockStatus)
      if (currentFilters.activeStatus && currentFilters.activeStatus !== 'all') params.set('activeStatus', currentFilters.activeStatus)
      if (currentFilters.onSale && currentFilters.onSale !== 'all') params.set('onSale', currentFilters.onSale)
      if (currentSortCol) params.set('sort', currentSortCol)
      if (currentSortDir) params.set('sortDir', currentSortDir)

      const res = await fetch(`/api/admin/products?${params.toString()}`, { signal: controller.signal })
      const data = await res.json()
      if (data.ok) {
        setProducts(data.products as Product[])
        setPagination({ page: data.page, totalPages: data.totalPages, total: data.total })
        if (data.suppliers) setSuppliers(data.suppliers as SupplierOption[])
        if (data.categories) {
          // Merge API categories into full category state for form use
          setCategories(prev => {
            const apiCats = data.categories as CategoryOption[]
            // If we already have full categories with markup etc, keep them
            // Otherwise use the basic ones from the API
            if (prev.length > 0) return prev
            return apiCats.map(c => ({
              id: c.id, name: c.name, slug: c.slug, parentId: c.parentId,
              enabled: 1, markup: null, cashDiscount: null, ivaRate: null,
            })) as Category[]
          })
        }
        // Also grab the dollar config from the response
        if (data.dollarRate) {
          setDollarConfig({
            rate: data.dollarRate,
            markup: data.markup || 30,
            cashDiscount: data.cashDiscount || 10,
            source: data.dollarSource || 'nacion',
          })
        }
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return // Request was cancelled, ignore
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
      setSearchLoading(false)
    }
  }, [pagination.page, pageSize, search, filters, sortColumn, sortDirection])

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/categories')
      const data = await res.json()
      if (data.ok && data.categories && (data.categories as Category[]).length > 0) {
        setCategories(data.categories as Category[])
      } else {
        // No categories found - try initializing them
        console.log('[productos] No categories found, initializing...')
        const initRes = await fetch('/api/admin/init-categories', { method: 'POST' })
        const initData = await initRes.json()
        if (initData.ok) {
          // Reload categories after initialization
          const res2 = await fetch('/api/admin/categories')
          const data2 = await res2.json()
          if (data2.ok) setCategories(data2.categories as Category[])
        }
      }
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }, [])

  useEffect(() => {
    loadProducts()
    loadCategories()
  }, [loadProducts, loadCategories])

  // Also fetch dollar config separately for the form
  const fetchDollarConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/dolar')
      const data = await res.json()
      if (data.ok) {
        setDollarConfig({
          rate: data.dollar.rate,
          markup: data.config.markup,
          cashDiscount: data.config.cashDiscount,
          source: data.dollar.source,
        })
      }
    } catch (error) {
      console.error('Error fetching dollar config:', error)
    }
  }, [])

  // Calculate prices when costPrice, markup, cashDiscount, ivaRate, or categoryId changes
  useEffect(() => {
    const costUsd = Number(form.costPrice)
    if (costUsd > 0 && dollarConfig) {
      // 3-tier priority: product individual → category (with parent inheritance) → global
      const catPricing = getCategoryPricing(form.categoryId || null)
      const catMarkup = catPricing.markup != null ? Number(catPricing.markup) : null
      const catCashDiscount = catPricing.cashDiscount != null ? Number(catPricing.cashDiscount) : null
      const catIvaRate = catPricing.ivaRate != null ? Number(catPricing.ivaRate) : null

      const effectiveMarkup = form.markup !== '' ? Number(form.markup) : (catMarkup != null ? catMarkup : dollarConfig.markup)
      const effectiveCashDiscount = form.cashDiscount !== '' ? Number(form.cashDiscount) : (catCashDiscount != null ? catCashDiscount : dollarConfig.cashDiscount)
      const effectiveIvaRate = form.ivaRate !== '' ? Number(form.ivaRate) : (catIvaRate != null ? catIvaRate : 10.5)
      // costUSD × (1+IVA) × (1+markup) × dollarRate
      const listPrice = Math.ceil(costUsd * (1 + effectiveIvaRate / 100) * (1 + effectiveMarkup / 100) * dollarConfig.rate)
      const cashPrice = Math.ceil(costUsd * (1 + effectiveIvaRate / 100) * (1 + (effectiveMarkup - effectiveCashDiscount) / 100) * dollarConfig.rate)
      setCalculatedListPrice(listPrice)
      setCalculatedCashPrice(cashPrice)
      // Auto-fill the price fields
      setForm(prev => ({
        ...prev,
        price: String(listPrice),
        comparePrice: String(cashPrice),
      }))
    } else {
      setCalculatedListPrice(null)
      setCalculatedCashPrice(null)
    }
  }, [form.costPrice, form.markup, form.cashDiscount, form.ivaRate, form.categoryId, categories, dollarConfig, getCategoryPricing])

  // Sorting handler - triggers API call with new sort
  const handleSort = (column: SortColumn) => {
    let newCol = column
    let newDir: SortDirection = 'asc'
    if (sortColumn === column) {
      if (sortDirection === 'asc') newDir = 'desc'
      else { newCol = 'name'; newDir = 'asc' } // 3rd click resets
    }
    setSortColumn(newCol)
    setSortDirection(newDir)
    loadProducts({ sortColumn: newCol, sortDirection: newDir, page: 1 })
  }

  // Sort icon for column headers
  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-300" />
    if (sortDirection === 'asc') return <ArrowUp className="w-3.5 h-3.5 text-compucity-green" />
    return <ArrowDown className="w-3.5 h-3.5 text-compucity-green" />
  }

  // Count active filters
  const activeFilterCount = Object.values(filters).filter(v => v !== 'all').length

  // Build a set of category IDs that belong to a parent (includes the parent itself + all descendants)
  const getCategoryIdsWithDescendants = (parentId: string): Set<string> => {
    const ids = new Set<string>()
    ids.add(parentId)
    const addChildIds = (pid: string) => {
      for (const cat of categories) {
        if (cat.parentId === pid) {
          ids.add(cat.id)
          addChildIds(cat.id)
        }
      }
    }
    addChildIds(parentId)
    return ids
  }

  // Products are now filtered/sorted server-side — just use them directly
  const filteredProducts = products

  const handleCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setCalculatedListPrice(null)
    setCalculatedCashPrice(null)
    fetchDollarConfig()
    setFormOpen(true)
  }

  const handleEdit = (product: Product) => {
    setEditingId(product.id)
    // Parse images from JSON string to array
    let imageUrls: string[] = []
    try {
      if (product.images && product.images !== 'null' && product.images !== 'undefined') {
        const parsed = JSON.parse(product.images)
        if (Array.isArray(parsed)) {
          imageUrls = parsed.filter((url: string) => url && typeof url === 'string')
        }
      }
    } catch {
      imageUrls = []
    }
    setForm({
      name: product.name,
      description: product.description || '',
      price: String(product.price),
      comparePrice: product.comparePrice ? String(product.comparePrice) : '',
      costPrice: product.costPrice ? String(product.costPrice) : '',
      sku: product.sku || '',
      stock: String(product.stock),
      isActive: product.isActive === 1,
      isFeatured: product.isFeatured === 1,
      imageUrls,
      specs: product.specs || '{}',
      providerId: product.providerId || '',
      providerSku: product.providerSku || '',
      categoryId: product.categoryId || '',
      markup: product.markup != null ? String(product.markup) : '',
      cashDiscount: product.cashDiscount != null ? String(product.cashDiscount) : '',
      ivaRate: product.ivaRate != null ? String(product.ivaRate) : '',
      salePrice: product.salePrice != null ? String(product.salePrice) : '',
      saleStart: product.saleStart ? product.saleStart.slice(0, 10) : '',
      saleEnd: product.saleEnd ? product.saleEnd.slice(0, 10) : '',
    })
    setFormError('')
    fetchDollarConfig()
    setFormOpen(true)
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
    setDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!deletingId) return
    try {
      await fetch(`/api/admin/products?id=${deletingId}`, { method: 'DELETE' })
      loadProducts() // Reload current page
    } catch (error) {
      console.error('Error deleting product:', error)
    }
    setDeleteOpen(false)
    setDeletingId(null)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      // Deselect all
      setSelectedIds(new Set())
    } else {
      // Select all filtered
      setSelectedIds(new Set(filteredProducts.map(p => p.id)))
    }
  }

  const confirmBulkDelete = async () => {
    setBulkDeleting(true)
    try {
      const ids = Array.from(selectedIds)
      await Promise.all(ids.map(id => fetch(`/api/admin/products?id=${id}`, { method: 'DELETE' })))
      setSelectedIds(new Set())
      loadProducts() // Reload current page
    } catch (error) {
      console.error('Error bulk deleting products:', error)
    }
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
  }

  const handleSave = async () => {
    setFormError('')
    if (!form.name.trim()) {
      setFormError('El nombre es requerido')
      return
    }

    const hasCostPrice = form.costPrice && Number(form.costPrice) > 0
    const hasManualPrice = form.price && Number(form.price) > 0

    if (!hasCostPrice && !hasManualPrice) {
      setFormError('Debés ingresar el costo en USD o el precio de lista manualmente')
      return
    }

    setSaving(true)
    try {
      const imagesJson = JSON.stringify(form.imageUrls)
      console.log('[productos] Saving with images:', form.imageUrls, '-> JSON:', imagesJson)

      // Track if user explicitly removed all images (allows backend to distinguish
      // accidental clear from intentional removal)
      const clearImages = editingId && form.imageUrls.length === 0

      const payload = {
        ...(editingId ? { id: editingId } : {}),
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: hasCostPrice ? calculatedListPrice! : Number(form.price),
        comparePrice: hasCostPrice ? calculatedCashPrice! : (form.comparePrice ? Number(form.comparePrice) : null),
        costPrice: form.costPrice ? Number(form.costPrice) : null,
        sku: form.sku.trim() || null,
        stock: Number(form.stock) || 0,
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        images: imagesJson,
        clearImages,
        specs: form.specs,
        providerId: form.providerId.trim() || null,
        providerSku: form.providerSku.trim() || null,
        categoryId: form.categoryId || null,
        markup: form.markup !== '' ? Number(form.markup) : null,
        cashDiscount: form.cashDiscount !== '' ? Number(form.cashDiscount) : null,
        ivaRate: form.ivaRate !== '' ? Number(form.ivaRate) : null,
        salePrice: form.salePrice ? Number(form.salePrice) : null,
        saleStart: form.saleStart || null,
        saleEnd: form.saleEnd || null,
      }

      const res = await fetch('/api/admin/products', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!data.ok) {
        const errorMsg = data.detail ? `${data.error}: ${data.detail}` : (data.error || 'Error al guardar')
        setFormError(errorMsg)
        return
      }

      setFormOpen(false)
      loadProducts() // Reload current page
    } catch (error) {
      setFormError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const updateForm = (field: keyof ProductForm, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-compucity-green" />
      </div>
    )
  }

  const hasCostPrice = form.costPrice && Number(form.costPrice) > 0

  return (
    <div className="space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-sm text-gray-500">{pagination.total.toLocaleString('es-AR')} productos en total</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            className="gap-2"
            disabled={batchAiLoading}
            onClick={async () => {
              setBatchAiLoading(true)
              setBatchAiResult(null)
              try {
                const res = await fetch('/api/generate-description', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ batch: true }),
                })
                const data = await res.json()
                if (data.ok) {
                  const hasErrors = data.errors && data.errors.length > 0
                  if (data.total === 0) {
                    setBatchAiResult('Todos los productos ya tienen descripción')
                  } else if (hasErrors) {
                    setBatchAiResult(`${data.updated} de ${data.total} descripciones generadas (${data.errors.length} errores)`)
                  } else {
                    setBatchAiResult(`${data.updated} descripciones generadas de ${data.total} productos`)
                  }
                  if (data.updated > 0) loadProducts()
                } else {
                  setBatchAiResult(`Error: ${data.error}`)
                }
              } catch (error) {
                setBatchAiResult('Error de conexión')
              } finally {
                setBatchAiLoading(false)
                setTimeout(() => setBatchAiResult(null), 8000)
              }
            }}
          >
            {batchAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {batchAiLoading ? 'Generando...' : 'Descripciones IA'}
          </Button>
          {batchAiResult && (
            <span className={`text-xs font-medium ${batchAiResult.startsWith('Error') ? 'text-red-500' : 'text-compucity-green'}`}>{batchAiResult}</span>
          )}
          <a
            href="/api/admin/export/products"
            target="_blank"
          >
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Exportar a Excel
            </Button>
          </a>
          <Button onClick={handleCreate} className="bg-compucity-green hover:bg-compucity-green-dark">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, SKU o categoría..."
              value={search}
              onChange={(e) => {
                const val = e.target.value
                setSearch(val)
                setSearchLoading(true)
                // Debounce search: 300ms
                if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
                searchDebounceRef.current = setTimeout(() => {
                  loadProducts({ search: val, page: 1 })
                }, 300)
              }}
              className="pl-10"
            />
            {searchLoading && (
              <Loader2 className="absolute right-9 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
            )}
            {search && (
              <button
                onClick={() => { setSearch(''); loadProducts({ search: '', page: 1 }) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            className={showFilters ? 'bg-compucity-green hover:bg-compucity-green-dark' : ''}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
            {activeFilterCount > 0 && (
              <Badge className="ml-2 bg-white text-compucity-green text-xs px-1.5 py-0">{activeFilterCount}</Badge>
            )}
          </Button>
        </div>

        {/* Expandable Filters */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg border">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Categoría</Label>
              <Select value={filters.category} onValueChange={(v) => { setFilters(prev => ({ ...prev, category: v })); loadProducts({ filters: { ...filters, category: v }, page: 1 }) }}>
                <SelectTrigger className="w-48 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categories
                    .filter(c => !c.parentId)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Proveedor</Label>
              <Select value={filters.supplier} onValueChange={(v) => { setFilters(prev => ({ ...prev, supplier: v })); loadProducts({ filters: { ...filters, supplier: v }, page: 1 }) }}>
                <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="none">Ingresado manualmente</SelectItem>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Stock</Label>
              <Select value={filters.stockStatus} onValueChange={(v) => { setFilters(prev => ({ ...prev, stockStatus: v })); loadProducts({ filters: { ...filters, stockStatus: v }, page: 1 }) }}>
                <SelectTrigger className="w-40 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="inStock">En stock (+5)</SelectItem>
                  <SelectItem value="lowStock">Bajo stock (1-5)</SelectItem>
                  <SelectItem value="outOfStock">Sin stock (0)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Estado</Label>
              <Select value={filters.activeStatus} onValueChange={(v) => { setFilters(prev => ({ ...prev, activeStatus: v })); loadProducts({ filters: { ...filters, activeStatus: v }, page: 1 }) }}>
                <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-500">En oferta</Label>
              <Select value={filters.onSale} onValueChange={(v) => { setFilters(prev => ({ ...prev, onSale: v })); loadProducts({ filters: { ...filters, onSale: v }, page: 1 }) }}>
                <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="yes">En oferta</SelectItem>
                  <SelectItem value="no">Sin oferta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-red-500 hover:text-red-700 mt-4"
                onClick={() => { const cleared = { category: 'all', supplier: 'all', stockStatus: 'all', activeStatus: 'all', onSale: 'all' }; setFilters(cleared); loadProducts({ filters: cleared, page: 1 }) }}
              >
                <X className="w-3 h-3 mr-1" />
                Limpiar filtros
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm font-medium text-blue-800">{selectedIds.size} producto{selectedIds.size > 1 ? 's' : ''} seleccionado{selectedIds.size > 1 ? 's' : ''}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-blue-600 hover:text-blue-800"
            onClick={() => setSelectedIds(new Set())}
          >
            <X className="w-3 h-3 mr-1" />
            Deseleccionar
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar {selectedIds.size} producto{selectedIds.size > 1 ? 's' : ''}
          </Button>
        </div>
      )}

      {/* Products Table */}
      <div className="space-y-2">
        {/* Pagination Top Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm text-gray-500">
          <span>Página {pagination.page} de {pagination.totalPages} ({pagination.total.toLocaleString('es-AR')} productos{(search || activeFilterCount > 0) ? ' filtrados' : ''})</span>
          <div className="flex items-center gap-2">
            {(sortColumn !== 'name' || sortDirection !== 'asc') && (
              <button
                onClick={() => { setSortColumn('name'); setSortDirection('asc'); loadProducts({ sortColumn: 'name', sortDirection: 'asc', page: 1 }) }}
                className="text-xs text-compucity-green hover:underline"
              >
                Restablecer orden
              </button>
            )}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">Mostrar:</span>
              {[50, 100, 200].map(size => (
                <button
                  key={size}
                  onClick={() => { setPageSize(size); loadProducts({ limit: size, page: 1 }) }}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${pageSize === size ? 'bg-compucity-green text-white font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>
      {filteredProducts.length === 0 ? (
        <div className="rounded-xl border shadow-sm bg-card text-card-foreground text-center py-12 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>No hay productos{search || activeFilterCount > 0 ? ' que coincidan con los filtros' : ''}</p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="block lg:hidden space-y-3">
            {filteredProducts.map((product) => (
              <div key={product.id} className={`rounded-xl border shadow-sm bg-card text-card-foreground p-3 space-y-2 ${selectedIds.has(product.id) ? 'ring-2 ring-blue-400 bg-blue-50/30' : ''}`}>
                {/* Name + Category row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    {/* Thumbnail */}
                    {getProductThumb(product.images) ? (
                      <div className="shrink-0 w-10 h-10 rounded-md overflow-hidden bg-gray-100 border">
                        <img src={getProductThumb(product.images)!} alt="" width={40} height={40} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="shrink-0 w-10 h-10 rounded-md bg-gray-100 border flex items-center justify-center">
                        <Package className="w-4 h-4 text-gray-300" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900 text-sm leading-tight truncate" title={product.name}>{product.name}</div>
                      {product.sku && <span className="text-xs text-gray-400 font-mono">{product.sku}</span>}
                      <div className="text-xs text-gray-500 mt-0.5">{product.categoryName || 'Sin categoría'}</div>
                      {product.providerName && <div className="text-xs text-gray-400">{product.providerName}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge
                      variant="secondary"
                      className={product.stock > 5 ? 'bg-green-100 text-green-800' : product.stock > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}
                      title={product.stockByWarehouse ? (() => {
                        try {
                          const wh = JSON.parse(product.stockByWarehouse)
                          return `CBA: ${wh.cba ?? 0} | BA: ${wh.air ?? 0} | Lugo: ${wh.lug ?? 0} | Rosario: ${wh.ros ?? 0} | Mza: ${wh.mza ?? 0}`
                        } catch { return '' }
                      })() : ''}
                    >
                      Stock: {product.stock}
                    </Badge>
                    <Badge variant="secondary" className={product.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                      {product.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>

                {/* Price row */}
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  {product.costPrice && product.costPrice > 0 ? (
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-compucity-green shrink-0" />
                      <span className="font-medium text-compucity-green">{Number(product.costPrice).toFixed(2)}</span>
                    </div>
                  ) : null}
                  <span className="font-medium text-gray-900">{formatPrice(product.price)}</span>
                  {product.comparePrice ? (
                    <span className="text-green-600 font-medium text-xs">Efectivo: {formatPrice(product.comparePrice)}</span>
                  ) : null}
                  {(product as any)._effectiveIvaRate != null && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${
                      (product as any)._ivaRateSource === 'category'
                        ? 'bg-violet-100 text-violet-800'
                        : (product as any)._ivaRateSource === 'product'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-600'
                    }`}>
                      IVA {(product as any)._effectiveIvaRate}%
                    </span>
                  )}
                  {product.salePrice && product.salePrice > 0 && (() => {
                    const now = new Date()
                    const startOk = !product.saleStart || now >= new Date(product.saleStart)
                    const endOk = !product.saleEnd || now <= new Date(product.saleEnd + 'T23:59:59')
                    return startOk && endOk ? (
                      <Badge className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-200 border">OFERTA</Badge>
                    ) : null
                  })()}
                </div>

                {/* Badges row */}
                {(product._calculated || (product as any)._effectiveMarkup != null || (product as any)._effectiveCashDiscount != null || (product as any)._effectiveIvaRate != null) && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {product._calculated && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-compucity-green-50 text-compucity-green shrink-0">A</Badge>
                    )}
                    {(product as any)._markupSource === 'product' && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-blue-50 text-blue-600 shrink-0" title={`Margen individual: ${(product as any)._effectiveMarkup}%`}>M</Badge>
                    )}
                    {(product as any)._markupSource === 'category' && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-indigo-50 text-indigo-600 shrink-0" title={`Margen por categoría: ${(product as any)._effectiveMarkup}%`}>MC</Badge>
                    )}
                    {(product as any)._cashDiscountSource === 'product' && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-amber-50 text-amber-600 shrink-0" title={`Desc. efectivo individual: ${(product as any)._effectiveCashDiscount}%`}>D</Badge>
                    )}
                    {(product as any)._cashDiscountSource === 'category' && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-orange-50 text-orange-600 shrink-0" title={`Desc. efectivo por categoría: ${(product as any)._effectiveCashDiscount}%`}>DC</Badge>
                    )}
                    {(product as any)._ivaRateSource === 'product' && (product as any)._effectiveIvaRate !== 10.5 && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-purple-50 text-purple-600 shrink-0" title={`IVA individual: ${(product as any)._effectiveIvaRate}%`}>I</Badge>
                    )}
                    {(product as any)._ivaRateSource === 'category' && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-violet-50 text-violet-600 shrink-0" title={`IVA por categoría: ${(product as any)._effectiveIvaRate}%`}>IC</Badge>
                    )}
                  </div>
                )}

                {/* Actions row */}
                <div className="flex items-center justify-end gap-1 pt-1 border-t">
                  {!product.description && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={generatingAiId === product.id}
                      onClick={async () => {
                        setGeneratingAiId(product.id)
                        try {
                          const res = await fetch('/api/generate-description', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ productId: product.id }),
                          })
                          const data = await res.json()
                          if (data.ok) loadProducts()
                        } catch {} finally { setGeneratingAiId(null) }
                      }}
                      className="h-7 text-xs gap-1 text-violet-600 hover:text-violet-700 border-violet-200 hover:border-violet-300"
                      title="Generar descripción con IA"
                    >
                      {generatingAiId === product.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      IA
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(product)}
                    className="h-7 text-xs gap-1"
                  >
                    <Pencil className="w-3 h-3" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(product.id)}
                    className="h-7 text-xs gap-1 text-red-500 hover:text-red-700 border-red-200 hover:border-red-300"
                  >
                    <Trash2 className="w-3 h-3" />
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block rounded-xl border shadow-sm bg-card text-card-foreground overflow-hidden">
            <div className="admin-table-wrapper">
              <table className="w-full text-sm admin-fixed-table">
                <colgroup>
                  <col style={{ width: '3%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '4%' }} />
                  <col style={{ width: '4%' }} />
                  <col style={{ width: '4%' }} />
                  <col style={{ width: '9%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b bg-gray-50/80">
                    <th className="h-10 px-1 text-center align-middle font-medium text-gray-600">
                      <button
                        onClick={toggleSelectAll}
                        className="text-gray-400 hover:text-blue-500 transition-colors"
                        title={selectedIds.size === filteredProducts.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                      >
                        {selectedIds.size === filteredProducts.length && filteredProducts.length > 0 ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                    <th className="h-10 px-2 text-left align-middle font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">Nombre <SortIcon column="name" /></div>
                    </th>
                    <th className="h-10 px-2 text-left align-middle font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors" onClick={() => handleSort('categoryName')}>
                      <div className="flex items-center gap-1">Categoría <SortIcon column="categoryName" /></div>
                    </th>
                    <th className="h-10 px-2 text-left align-middle font-medium text-gray-600">Proveedor</th>
                    <th className="h-10 px-2 text-right align-middle font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors" onClick={() => handleSort('costPrice')}>
                      <div className="flex items-center justify-end gap-1">Costo USD <SortIcon column="costPrice" /></div>
                    </th>
                    <th className="h-10 px-2 text-right align-middle font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors" onClick={() => handleSort('price')}>
                      <div className="flex items-center justify-end gap-1">Precio Lista <SortIcon column="price" /></div>
                    </th>
                    <th className="h-10 px-2 text-right align-middle font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors" onClick={() => handleSort('comparePrice')}>
                      <div className="flex items-center justify-end gap-1">Efectivo <SortIcon column="comparePrice" /></div>
                    </th>
                    <th className="h-10 px-2 text-center align-middle font-medium text-gray-600">IVA</th>
                    <th className="h-10 px-2 text-center align-middle font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors" onClick={() => handleSort('stock')}>
                      <div className="flex items-center justify-center gap-1">Stock <SortIcon column="stock" /></div>
                    </th>
                    <th className="h-10 px-2 text-center align-middle font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors" onClick={() => handleSort('isActive')}>
                      <div className="flex items-center justify-center gap-1">Activo <SortIcon column="isActive" /></div>
                    </th>
                    <th className="h-10 px-2 text-center align-middle font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product, index) => (
                    <tr key={product.id} className={`hover:bg-muted/50 border-b transition-colors ${selectedIds.has(product.id) ? 'bg-blue-50/50' : index % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                      <td className="p-2 align-middle text-center">
                        <button
                          onClick={() => toggleSelect(product.id)}
                          className="text-gray-400 hover:text-blue-500 transition-colors"
                        >
                          {selectedIds.has(product.id) ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="p-2 align-middle">
                        <div className="flex items-center gap-2">
                          {getProductThumb(product.images) ? (
                            <div className="shrink-0 w-8 h-8 rounded overflow-hidden bg-gray-100 border">
                              <img src={getProductThumb(product.images)!} alt="" width={32} height={32} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="shrink-0 w-8 h-8 rounded bg-gray-50 border flex items-center justify-center">
                              <Package className="w-3 h-3 text-gray-300" />
                            </div>
                          )}
                          <div className="truncate" title={product.name}>
                            <span className="font-medium text-gray-900">{product.name}</span>
                            {product.sku && (
                              <span className="text-xs text-gray-400 font-mono ml-2">{product.sku}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-2 align-middle">
                        <div className="truncate text-sm text-gray-600" title={product.categoryName || ''}>
                          {product.categoryName || '—'}
                        </div>
                      </td>
                      <td className="p-2 align-middle">
                        <div className="truncate text-sm text-gray-500" title={product.providerName || ''}>
                          {product.providerName || <span className="text-gray-300">—</span>}
                        </div>
                      </td>
                      <td className="p-2 align-middle text-right">
                        {product.costPrice && product.costPrice > 0 ? (
                          <div>
                            <div className="flex items-center justify-end gap-1">
                              <DollarSign className="w-3 h-3 text-compucity-green shrink-0" />
                              <span className="font-medium text-compucity-green">{Number(product.costPrice).toFixed(2)}</span>
                            </div>
                            {(product._calculated || (product as any)._effectiveMarkup != null || (product as any)._effectiveCashDiscount != null || (product as any)._effectiveIvaRate != null) && (
                              <div className="flex items-center justify-end gap-0.5 mt-0.5">
                                {product._calculated && (
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-compucity-green-50 text-compucity-green shrink-0">A</Badge>
                                )}
                                {(product as any)._markupSource === 'product' && (
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-blue-50 text-blue-600 shrink-0" title={`Margen individual: ${(product as any)._effectiveMarkup}%`}>M</Badge>
                                )}
                                {(product as any)._markupSource === 'category' && (
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-indigo-50 text-indigo-600 shrink-0" title={`Margen por categoría: ${(product as any)._effectiveMarkup}%`}>MC</Badge>
                                )}
                                {(product as any)._cashDiscountSource === 'product' && (
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-amber-50 text-amber-600 shrink-0" title={`Desc. efectivo individual: ${(product as any)._effectiveCashDiscount}%`}>D</Badge>
                                )}
                                {(product as any)._cashDiscountSource === 'category' && (
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-orange-50 text-orange-600 shrink-0" title={`Desc. efectivo por categoría: ${(product as any)._effectiveCashDiscount}%`}>DC</Badge>
                                )}
                                {(product as any)._ivaRateSource === 'product' && (product as any)._effectiveIvaRate !== 10.5 && (
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-purple-50 text-purple-600 shrink-0" title={`IVA individual: ${(product as any)._effectiveIvaRate}%`}>I</Badge>
                                )}
                                {(product as any)._ivaRateSource === 'category' && (
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-violet-50 text-violet-600 shrink-0" title={`IVA por categoría: ${(product as any)._effectiveIvaRate}%`}>IC</Badge>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-2 align-middle text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-medium text-gray-900">{formatPrice(product.price)}</span>
                          {product.salePrice && product.salePrice > 0 && (() => {
                            const now = new Date()
                            const startOk = !product.saleStart || now >= new Date(product.saleStart)
                            const endOk = !product.saleEnd || now <= new Date(product.saleEnd + 'T23:59:59')
                            return startOk && endOk ? (
                              <Badge className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-200 border">OFERTA</Badge>
                            ) : null
                          })()}
                        </div>
                      </td>
                      <td className="p-2 align-middle text-right">
                        {product.comparePrice ? (
                          <div className="text-sm text-green-600 font-medium">
                            {formatPrice(product.comparePrice)}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-2 align-middle text-center">
                        {(product as any)._effectiveIvaRate != null ? (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${
                            (product as any)._ivaRateSource === 'category'
                              ? 'bg-violet-100 text-violet-800'
                              : (product as any)._ivaRateSource === 'product'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-100 text-gray-600'
                          }`}>
                            {(product as any)._effectiveIvaRate}%
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-2 align-middle text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <Badge
                            variant="secondary"
                            className={product.stock > 5 ? 'bg-green-100 text-green-800' : product.stock > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}
                            title={product.stockByWarehouse ? (() => {
                              try {
                                const wh = JSON.parse(product.stockByWarehouse)
                                return `Stock por depósito — CBA: ${wh.cba ?? 0} | BA: ${wh.air ?? 0} | Lugo: ${wh.lug ?? 0} | Rosario: ${wh.ros ?? 0} | Mendoza: ${wh.mza ?? 0}`
                              } catch { return '' }
                            })() : ''}
                          >
                            {product.stock}
                          </Badge>
                          {product.stockByWarehouse && (() => {
                            try {
                              const wh = JSON.parse(product.stockByWarehouse)
                              const totalOther = (wh.air || 0) + (wh.lug || 0) + (wh.ros || 0) + (wh.mza || 0)
                              if (product.stock === 0 && totalOther > 0) {
                                return <span className="text-[10px] text-orange-500 leading-tight">+{totalOther} otros dep.</span>
                              }
                            } catch {}
                            return null
                          })()}
                        </div>
                      </td>
                      <td className="p-2 align-middle text-center">
                        <Badge variant="secondary" className={product.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                          {product.isActive ? 'Sí' : 'No'}
                        </Badge>
                      </td>
                      <td className="p-2 align-middle text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {!product.description && (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={generatingAiId === product.id}
                              onClick={async () => {
                                setGeneratingAiId(product.id)
                                try {
                                  const res = await fetch('/api/generate-description', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ productId: product.id }),
                                  })
                                  const data = await res.json()
                                  if (data.ok) loadProducts()
                                } catch {} finally { setGeneratingAiId(null) }
                              }}
                              title="Generar descripción con IA"
                              className="h-7 w-7 text-violet-500 hover:text-violet-700"
                            >
                              {generatingAiId === product.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(product)}
                            title="Editar"
                            className="h-7 w-7"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(product.id)}
                            title="Eliminar"
                            className="text-red-500 hover:text-red-700 h-7 w-7"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      </div>

      {/* Pagination Bottom Bar */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-sm text-gray-500">
            Mostrando {((pagination.page - 1) * pageSize) + 1}–{Math.min(pagination.page * pageSize, pagination.total)} de {pagination.total.toLocaleString('es-AR')}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={pagination.page <= 1}
              onClick={() => loadProducts({ page: 1 })}
              title="Primera página"
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={pagination.page <= 1}
              onClick={() => loadProducts({ page: pagination.page - 1 })}
              title="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-3 py-1 text-sm font-medium">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => loadProducts({ page: pagination.page + 1 })}
              title="Página siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => loadProducts({ page: pagination.totalPages })}
              title="Última página"
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Product Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Producto' : 'Nuevo Producto'}
            </DialogTitle>
          </DialogHeader>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="Nombre del producto"
              />
            </div>

            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description">Descripción</Label>
                {editingId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1.5 text-compucity-green hover:text-compucity-green-dark"
                    disabled={generatingDescription || !form.name.trim()}
                    onClick={async () => {
                      setGeneratingDescription(true)
                      try {
                        const res = await fetch('/api/generate-description', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ productId: editingId }),
                        })
                        const data = await res.json()
                        if (data.ok && data.description) {
                          updateForm('description', data.description)
                        } else {
                          console.error('Error generating description:', data.error)
                        }
                      } catch (error) {
                        console.error('Error generating description:', error)
                      } finally {
                        setGeneratingDescription(false)
                      }
                    }}
                  >
                    {generatingDescription ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {generatingDescription ? 'Generando...' : 'Generar con IA'}
                  </Button>
                )}
              </div>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="Descripción del producto"
                rows={3}
              />
            </div>

            {/* === PRICING SECTION === */}
            <div className="sm:col-span-2 border rounded-lg p-4 bg-gray-50/50 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Calculator className="w-4 h-4" />
                Precios
              </div>

              {/* Cost in USD */}
              <div className="space-y-2">
                <Label htmlFor="costPrice" className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  Costo en USD
                </Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  value={form.costPrice}
                  onChange={(e) => updateForm('costPrice', e.target.value)}
                  placeholder="Ej: 150.00"
                  className="bg-white"
                />
                <p className="text-xs text-compucity-green">
                  Ingresá el costo en dólares y los precios en pesos se calculan automáticamente con la cotización actual.
                </p>
              </div>

              {/* Individual Markup & Discount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="markup" className="flex items-center gap-1">
                    <Calculator className="w-4 h-4 text-blue-600" />
                    Margen individual (%)
                  </Label>
                  <Input
                    id="markup"
                    type="number"
                    step="1"
                    min="0"
                    max="200"
                    value={form.markup}
                    onChange={(e) => updateForm('markup', e.target.value)}
                    placeholder="Dejar vacío para heredar"
                    className="bg-white"
                  />
                  {(() => {
                    const cp = getCategoryPricing(form.categoryId || null)
                    const hasCat = cp.markup != null
                    const inheritedVal = hasCat ? cp.markup : (dollarConfig?.markup ?? 30)
                    const source = hasCat ? 'category' : 'global'
                    const isOverridden = form.markup !== ''
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        {isOverridden ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            {form.markup}% individual
                          </span>
                        ) : hasCat ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                            Hereda {cp.markup}% de &ldquo;{cp.categoryName}&rdquo;
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                            Global {dollarConfig?.markup ?? 30}%
                          </span>
                        )}
                        {isOverridden && hasCat && (
                          <span className="text-[11px] text-gray-400">Categoría: {cp.markup}%</span>
                        )}
                      </div>
                    )
                  })()}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cashDiscount" className="flex items-center gap-1">
                    <Calculator className="w-4 h-4 text-amber-600" />
                    Descuento efectivo individual (%)
                  </Label>
                  <Input
                    id="cashDiscount"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={form.cashDiscount}
                    onChange={(e) => updateForm('cashDiscount', e.target.value)}
                    placeholder="Dejar vacío para heredar"
                    className="bg-white"
                  />
                  {(() => {
                    const cp = getCategoryPricing(form.categoryId || null)
                    const hasCat = cp.cashDiscount != null
                    const inheritedVal = hasCat ? cp.cashDiscount : (dollarConfig?.cashDiscount ?? 10)
                    const source = hasCat ? 'category' : 'global'
                    const isOverridden = form.cashDiscount !== ''
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        {isOverridden ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                            {form.cashDiscount}% individual
                          </span>
                        ) : hasCat ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                            Hereda {cp.cashDiscount}% de &ldquo;{cp.categoryName}&rdquo;
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                            Global {dollarConfig?.cashDiscount ?? 10}%
                          </span>
                        )}
                        {isOverridden && hasCat && (
                          <span className="text-[11px] text-gray-400">Categoría: {cp.cashDiscount}%</span>
                        )}
                      </div>
                    )
                  })()}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ivaRate" className="flex items-center gap-1">
                    <Calculator className="w-4 h-4 text-purple-600" />
                    IVA (%)
                  </Label>
                  <Select
                    value={form.ivaRate || '_inherit'}
                    onValueChange={(value) => updateForm('ivaRate', value === '_inherit' ? '' : value)}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Seleccionar IVA" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_inherit">{(() => {
                        const cp = getCategoryPricing(form.categoryId || null)
                        const inheritedRate = cp.ivaRate != null ? cp.ivaRate : 10.5
                        return `Heredar de categoría → ${inheritedRate}%`
                      })()}</SelectItem>
                      <SelectItem value="10.5">10,5% (forzar individual)</SelectItem>
                      <SelectItem value="21">21% (forzar individual)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-400">
                    {(() => {
                      const cp = getCategoryPricing(form.categoryId || null)
                      if (cp.ivaRate != null) {
                        return form.ivaRate === ''
                          ? `✓ Usando IVA ${cp.ivaRate}% de la categoría "${cp.categoryName}".`
                          : `Categoría usa ${cp.ivaRate}%. Este producto tiene IVA ${form.ivaRate}% individual.`
                      }
                      return form.ivaRate === ''
                        ? 'Usando IVA default 10,5%. La categoría no tiene IVA configurado.'
                        : `Este producto tiene IVA ${form.ivaRate}% individual.`
                    })()}
                  </p>
                </div>
              </div>

              {/* Calculated prices preview */}
              {hasCostPrice && dollarConfig && (
                <div className="bg-compucity-green-50 border border-compucity-green-100 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-semibold text-compucity-green-dark flex items-center gap-1">
                    <Calculator className="w-4 h-4" />
                    Cálculo automático
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-compucity-green">Cotización dólar</p>
                      <p className="font-bold text-compucity-green-dark">${dollarConfig.rate.toLocaleString('es-AR')}</p>
                    </div>
                    <div>
                      <p className="text-compucity-green">Margen de ganancia</p>
                      <p className="font-bold text-compucity-green-dark">
                        {form.markup !== '' ? form.markup : (() => {
                          const cp = getCategoryPricing(form.categoryId || null)
                          return cp.markup != null ? cp.markup : dollarConfig.markup
                        })()}%
                        {form.markup !== '' && <span className="text-xs font-normal text-blue-600 ml-1">(individual)</span>}
                        {form.markup === '' && (() => {
                          const cp = getCategoryPricing(form.categoryId || null)
                          return cp.markup != null ? <span className="text-xs font-normal text-indigo-600 ml-1">(categoría)</span> : null
                        })()}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-compucity-green">Descuento efectivo</p>
                      <p className="font-bold text-compucity-green-dark">
                        {form.cashDiscount !== '' ? form.cashDiscount : (() => {
                          const cp = getCategoryPricing(form.categoryId || null)
                          return cp.cashDiscount != null ? cp.cashDiscount : dollarConfig.cashDiscount
                        })()}%
                        {form.cashDiscount !== '' && <span className="text-xs font-normal text-amber-600 ml-1">(individual)</span>}
                        {form.cashDiscount === '' && (() => {
                          const cp = getCategoryPricing(form.categoryId || null)
                          return cp.cashDiscount != null ? <span className="text-xs font-normal text-orange-600 ml-1">(categoría)</span> : null
                        })()}
                      </p>
                    </div>
                    <div>
                      <p className="text-compucity-green">IVA</p>
                      <p className="font-bold text-compucity-green-dark">
                        {form.ivaRate !== '' ? form.ivaRate : (() => {
                          const cp = getCategoryPricing(form.categoryId || null)
                          return cp.ivaRate != null ? cp.ivaRate : '10.5'
                        })()}%
                        {form.ivaRate !== '' && <span className="text-xs font-normal text-purple-600 ml-1">(individual)</span>}
                        {form.ivaRate === '' && (() => {
                          const cp = getCategoryPricing(form.categoryId || null)
                          return cp.ivaRate != null ? <span className="text-xs font-normal text-violet-600 ml-1">(categoría)</span> : null
                        })()}
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-compucity-green-100 pt-2 space-y-1 text-sm">
                    <p className="text-gray-600">
                      USD {Number(form.costPrice).toFixed(2)} × (1 + {form.ivaRate !== '' ? form.ivaRate : (() => { const cp = getCategoryPricing(form.categoryId || null); return cp.ivaRate != null ? cp.ivaRate : '10.5'; })()}%) × (1 + {form.markup !== '' ? form.markup : dollarConfig.markup}%) × ${dollarConfig.rate.toLocaleString('es-AR')} = 
                      <strong className="text-gray-900"> {formatPrice(calculatedListPrice!)}</strong> <span className="text-gray-500">(lista c/IVA)</span>
                    </p>
                    <p className="text-gray-600">
                      USD {Number(form.costPrice).toFixed(2)} × (1 + {form.ivaRate !== '' ? form.ivaRate : (() => { const cp = getCategoryPricing(form.categoryId || null); return cp.ivaRate != null ? cp.ivaRate : '10.5'; })()}%) × (1 + {form.markup !== '' ? form.markup : dollarConfig.markup}% - {form.cashDiscount !== '' ? form.cashDiscount : dollarConfig.cashDiscount}%) × ${dollarConfig.rate.toLocaleString('es-AR')} = 
                      <strong className="text-green-700"> {formatPrice(calculatedCashPrice!)}</strong> <span className="text-gray-500">(efectivo c/IVA)</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="bg-white rounded-md p-2 text-center border">
                      <p className="text-xs text-gray-500">Precio de lista</p>
                      <p className="font-bold text-gray-900">{formatPrice(calculatedListPrice!)}</p>
                    </div>
                    <div className="bg-white rounded-md p-2 text-center border border-green-200">
                      <p className="text-xs text-gray-500">Precio en efectivo</p>
                      <p className="font-bold text-green-700">{formatPrice(calculatedCashPrice!)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Manual price fields - shown when no costPrice */}
              {!hasCostPrice && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Precio de lista (ARS) *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => updateForm('price', e.target.value)}
                      placeholder="0.00"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="comparePrice">Precio en efectivo (ARS)</Label>
                    <Input
                      id="comparePrice"
                      type="number"
                      step="0.01"
                      value={form.comparePrice}
                      onChange={(e) => updateForm('comparePrice', e.target.value)}
                      placeholder="0.00"
                      className="bg-white"
                    />
                    <p className="text-xs text-gray-400">Precio con descuento para pago en efectivo</p>
                  </div>
                </div>
              )}

              {/* When costPrice is set, show read-only calculated values */}
              {hasCostPrice && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Precio de lista (ARS)</Label>
                    <div className="h-10 px-3 flex items-center bg-gray-100 border rounded-md text-sm text-gray-600">
                      {calculatedListPrice ? formatPrice(calculatedListPrice) : '—'} <span className="ml-2 text-xs text-gray-400">(calculado)</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Precio en efectivo (ARS)</Label>
                    <div className="h-10 px-3 flex items-center bg-gray-100 border rounded-md text-sm text-green-700 font-medium">
                      {calculatedCashPrice ? formatPrice(calculatedCashPrice) : '—'} <span className="ml-2 text-xs text-gray-400">(calculado)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* === PRECIO PROMOCIONAL (Sale Price) === */}
              <div className="border-t pt-4 mt-4">
                <details className="group">
                  <summary className="flex items-center gap-2 text-sm font-semibold text-orange-600 cursor-pointer select-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>
                    Precio Promocional
                    <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </summary>
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-gray-500">
                      Si se configura un precio de oferta, se mostrará tachado el precio de lista y este precio como el vigente.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="salePrice" className="flex items-center gap-1">
                          <span className="text-orange-600">Precio oferta (ARS)</span>
                        </Label>
                        <Input
                          id="salePrice"
                          type="number"
                          step="0.01"
                          value={form.salePrice}
                          onChange={(e) => updateForm('salePrice', e.target.value)}
                          placeholder="Ej: 299999"
                          className="bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="saleStart">Inicio de oferta</Label>
                        <Input
                          id="saleStart"
                          type="date"
                          value={form.saleStart}
                          onChange={(e) => updateForm('saleStart', e.target.value)}
                          className="bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="saleEnd">Fin de oferta</Label>
                        <Input
                          id="saleEnd"
                          type="date"
                          value={form.saleEnd}
                          onChange={(e) => updateForm('saleEnd', e.target.value)}
                          className="bg-white"
                        />
                      </div>
                    </div>
                    {form.salePrice && Number(form.salePrice) > 0 && (
                      <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
                        <strong>Oferta activa:</strong> El precio de {formatPrice(Number(form.salePrice))} se mostrará como precio principal
                        {form.saleStart && form.saleEnd && (
                          <> del {new Date(form.saleStart).toLocaleDateString('es-AR')} al {new Date(form.saleEnd).toLocaleDateString('es-AR')}</>
                        )}
                        {form.saleStart && !form.saleEnd && (
                          <> desde el {new Date(form.saleStart).toLocaleDateString('es-AR')}</>
                        )}
                        {!form.saleStart && form.saleEnd && (
                          <> hasta el {new Date(form.saleEnd).toLocaleDateString('es-AR')}</>
                        )}
                        {!form.saleStart && !form.saleEnd && (
                          <> permanentemente (sin fechas configuradas)</>
                        )}
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={form.sku}
                onChange={(e) => updateForm('sku', e.target.value)}
                placeholder="SKU-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock">Stock (Córdoba)</Label>
              <Input
                id="stock"
                type="number"
                value={form.stock}
                onChange={(e) => updateForm('stock', e.target.value)}
                placeholder="0"
              />
              {editingId && (() => {
                const ep = products.find(p => p.id === editingId)
                if (!ep?.stockByWarehouse) return null
                try {
                  const wh = JSON.parse(ep.stockByWarehouse)
                  const hasOtherStock = (wh.air || 0) + (wh.lug || 0) + (wh.ros || 0) + (wh.mza || 0) > 0
                  if (hasOtherStock || wh.cba !== undefined) {
                    return (
                      <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 space-y-0.5">
                        <div className="font-medium text-gray-600 mb-1">Stock por depósito:</div>
                        <div className="flex gap-3 flex-wrap">
                          <span className={wh.cba > 0 ? 'text-green-600 font-medium' : 'text-red-500'}>CBA: {wh.cba ?? 0}</span>
                          <span>BA: {wh.air ?? 0}</span>
                          <span>Lugo: {wh.lug ?? 0}</span>
                          <span>Rosario: {wh.ros ?? 0}</span>
                          <span>Mendoza: {wh.mza ?? 0}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1">El stock mostrado en la tienda es solo Córdoba (CBA)</div>
                      </div>
                    )
                  }
                } catch {}
                return null
              })()}
            </div>

            {/* Category Selection - Two-level selector */}
            <div className="sm:col-span-2 border rounded-lg p-4 bg-gray-50/50 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                Categoría del Producto
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="parentCategory">Categoría Principal</Label>
                  <Select
                    value={(() => {
                      if (!form.categoryId) return '_none'
                      const selectedCat = categories.find(c => c.id === form.categoryId)
                      if (!selectedCat) return '_none'
                      // If it's a parent category, return its id
                      if (!selectedCat.parentId) return selectedCat.id
                      // If it's a child, return its parent's id
                      return selectedCat.parentId
                    })()}
                    onValueChange={(value) => {
                      if (value === '_none') {
                        updateForm('categoryId', '')
                      } else {
                        // When parent changes, auto-select the first subcategory if available
                        const children = categories
                          .filter(c => c.parentId === value && c.enabled === 1)
                          .sort((a, b) => a.name.localeCompare(b.name))
                        if (children.length > 0) {
                          updateForm('categoryId', children[0].id)
                        } else {
                          // No subcategories - assign to parent directly
                          updateForm('categoryId', value)
                        }
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sin categoría</SelectItem>
                      {categories
                        .filter(c => !c.parentId)
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(parent => (
                          <SelectItem key={parent.id} value={parent.id}>
                            {parent.name} {parent.enabled === 0 ? '(oculta)' : ''}
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subCategory">Subcategoría</Label>
                  <Select
                    value={form.categoryId && categories.find(c => c.id === form.categoryId)?.parentId ? form.categoryId : '_all'}
                    onValueChange={(value) => {
                      if (value === '_all') {
                        // Keep parent category selected
                        const selectedCat = categories.find(c => c.id === form.categoryId)
                        if (selectedCat?.parentId) {
                          updateForm('categoryId', selectedCat.parentId)
                        }
                      } else {
                        updateForm('categoryId', value)
                      }
                    }}
                    disabled={!form.categoryId || !categories.find(c => c.id === form.categoryId)?.parentId && !categories.find(c => c.id === form.categoryId && categories.some(ch => ch.parentId === c.id))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const selectedCat = categories.find(c => c.id === form.categoryId)
                        const parentId = selectedCat?.parentId || selectedCat?.id
                        if (!parentId) return null
                        const parentCat = categories.find(c => c.id === parentId)
                        const children = categories
                          .filter(c => c.parentId === parentId)
                          .sort((a, b) => a.name.localeCompare(b.name))
                        if (children.length === 0) return <SelectItem value="_all">Sin subcategorías</SelectItem>
                        return (
                          <>
                            <SelectItem value="_all">Todas las {parentCat?.name || 'subcategorías'}</SelectItem>
                            {children.map(child => (
                              <SelectItem key={child.id} value={child.id}>
                                {child.name} {child.enabled === 0 ? '(oculta)' : ''}
                              </SelectItem>
                            ))}
                          </>
                        )
                      })()}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.categoryId && (() => {
                const selectedCat = categories.find(c => c.id === form.categoryId)
                if (!selectedCat) return null
                const parentName = selectedCat.parentId
                  ? categories.find(c => c.id === selectedCat.parentId)?.name
                  : selectedCat.name
                const childName = selectedCat.parentId ? selectedCat.name : null
                return (
                  <div className="flex items-center gap-2 text-xs text-gray-500 bg-white border rounded-md px-3 py-2">
                    <span className="font-medium text-compucity-green">
                      {parentName}{childName ? ` › ${childName}` : ''}
                    </span>
                    {selectedCat.enabled === 0 && (
                      <span className="text-amber-600 font-medium">(categoría oculta)</span>
                    )}
                  </div>
                )
              })()}
            </div>

            <div className="space-y-2">
              <Label htmlFor="providerId">Proveedor</Label>
              <Select value={form.providerId || 'none'} onValueChange={(v) => updateForm('providerId', v === 'none' ? '' : v)}>
                <SelectTrigger id="providerId">
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin proveedor</SelectItem>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="providerSku">SKU Proveedor</Label>
              <Input
                id="providerSku"
                value={form.providerSku}
                onChange={(e) => updateForm('providerSku', e.target.value)}
                placeholder="SKU del proveedor"
              />
            </div>

            <div className="flex items-center gap-3 py-2">
              <Switch
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(checked) => updateForm('isActive', checked)}
              />
              <Label htmlFor="isActive">Producto activo</Label>
            </div>

            <div className="flex items-center gap-3 py-2">
              <Switch
                id="isFeatured"
                checked={form.isFeatured}
                onCheckedChange={(checked) => updateForm('isFeatured', checked)}
              />
              <Label htmlFor="isFeatured">Producto destacado</Label>
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label className="flex items-center gap-1">
                <ImageIcon className="w-4 h-4" />
                Imágenes del producto
              </Label>
              <ImageUploader
                images={form.imageUrls}
                onChange={(urls) => {
                  console.log('[productos] ImageUploader onChange:', urls)
                  setForm(prev => ({ ...prev, imageUrls: urls }))
                }}
                maxImages={6}
              />
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="specs">Especificaciones (JSON)</Label>
              <Textarea
                id="specs"
                value={form.specs}
                onChange={(e) => updateForm('specs', e.target.value)}
                placeholder='{"RAM": "16GB", "Disco": "512GB SSD"}'
                rows={3}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-compucity-green hover:bg-compucity-green-dark" disabled={saving || imageUploading}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : imageUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Subiendo imágenes...
                </>
              ) : (
                editingId ? 'Guardar Cambios' : 'Crear Producto'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El producto será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectedIds.size} producto{selectedIds.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. {selectedIds.size} producto{selectedIds.size > 1 ? 's serán eliminados' : ' será eliminado'} permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} className="bg-red-600 hover:bg-red-700" disabled={bulkDeleting}>
              {bulkDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                `Eliminar ${selectedIds.size} producto${selectedIds.size > 1 ? 's' : ''}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}