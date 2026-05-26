'use client'

import React, { useEffect, useState, useCallback } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
  isActive: number
  isFeatured: number
  images: string
  specs: string
  providerId: string | null
  providerSku: string | null
  categoryId: string | null
  categoryName: string | null
  _calculated?: boolean
  _dollarRate?: number
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
}

interface DollarConfig {
  rate: number
  markup: number
  cashDiscount: number
  source: string
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
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

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

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/products')
      const data = await res.json()
      if (data.ok) {
        setProducts(data.products as Product[])
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
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }, [])

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

  // Calculate prices when costPrice changes
  useEffect(() => {
    const costUsd = Number(form.costPrice)
    if (costUsd > 0 && dollarConfig) {
      const listPrice = Math.ceil(costUsd * dollarConfig.rate * (1 + dollarConfig.markup / 100))
      const cashPrice = Math.ceil(listPrice * (1 - dollarConfig.cashDiscount / 100))
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
  }, [form.costPrice, dollarConfig])

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.categoryName?.toLowerCase().includes(search.toLowerCase())
  )

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
      imageUrls = product.images ? JSON.parse(product.images) : []
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
      setProducts(prev => prev.filter(p => p.id !== deletingId))
    } catch (error) {
      console.error('Error deleting product:', error)
    }
    setDeleteOpen(false)
    setDeletingId(null)
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
        specs: form.specs,
        providerId: form.providerId.trim() || null,
        providerSku: form.providerSku.trim() || null,
        categoryId: form.categoryId || null,
      }

      const res = await fetch('/api/admin/products', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!data.ok) {
        setFormError(data.error || 'Error al guardar')
        return
      }

      setFormOpen(false)
      loadProducts()
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-sm text-gray-500">{products.length} productos en total</p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar por nombre, SKU o categoría..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>No hay productos{search ? ' que coincidan con la búsqueda' : ''}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Costo USD</TableHead>
                    <TableHead className="text-right">Precio Lista</TableHead>
                    <TableHead className="text-right">Efectivo</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead className="text-center">Activo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product, index) => (
                    <TableRow key={product.id} className={index % 2 === 1 ? 'bg-gray-50/50' : ''}>
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900">{product.name}</div>
                          {product.sku && (
                            <div className="text-xs text-gray-400 font-mono">{product.sku}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {product.categoryName || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {product.costPrice && product.costPrice > 0 ? (
                          <div className="flex items-center justify-end gap-1">
                            <DollarSign className="w-3 h-3 text-compucity-green" />
                            <span className="font-medium text-compucity-green">{Number(product.costPrice).toFixed(2)}</span>
                            {product._calculated && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-compucity-green-50 text-compucity-green">Auto</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium text-gray-900">{formatPrice(product.price)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        {product.comparePrice ? (
                          <div className="text-sm text-green-600 font-medium">
                            {formatPrice(product.comparePrice)}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className={product.stock > 5 ? 'bg-green-100 text-green-800' : product.stock > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}
                        >
                          {product.stock}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className={product.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                          {product.isActive ? 'Sí' : 'No'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(product)}
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(product.id)}
                            title="Eliminar"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
              <Label htmlFor="description">Descripción</Label>
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
                      <p className="font-bold text-compucity-green-dark">{dollarConfig.markup}%</p>
                    </div>
                  </div>
                  <div className="border-t border-compucity-green-100 pt-2 space-y-1 text-sm">
                    <p className="text-gray-600">
                      USD {Number(form.costPrice).toFixed(2)} × ${dollarConfig.rate.toLocaleString('es-AR')} × {1 + dollarConfig.markup / 100} = 
                      <strong className="text-gray-900"> {formatPrice(calculatedListPrice!)}</strong> <span className="text-gray-500">(lista)</span>
                    </p>
                    <p className="text-gray-600">
                      {formatPrice(calculatedListPrice!)} × {1 - dollarConfig.cashDiscount / 100} = 
                      <strong className="text-green-700"> {formatPrice(calculatedCashPrice!)}</strong> <span className="text-gray-500">(efectivo, -{dollarConfig.cashDiscount}%)</span>
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
              <Label htmlFor="stock">Stock</Label>
              <Input
                id="stock"
                type="number"
                value={form.stock}
                onChange={(e) => updateForm('stock', e.target.value)}
                placeholder="0"
              />
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
              <Label htmlFor="providerId">ID Proveedor</Label>
              <Input
                id="providerId"
                value={form.providerId}
                onChange={(e) => updateForm('providerId', e.target.value)}
                placeholder="ID del proveedor"
              />
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
    </div>
  )
}
