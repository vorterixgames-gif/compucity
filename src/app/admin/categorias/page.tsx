'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  FolderOpen,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

interface Category {
  id: string
  name: string
  slug: string
  image: string | null
  parentId: string | null
  enabled: number
  order: number
  markup: number | null
  cashDiscount: number | null
  ivaRate: number | null
  createdAt: string
  updatedAt: string
}

interface CategoryForm {
  name: string
  image: string
  parentId: string
  enabled: boolean
  markup: string
  cashDiscount: string
  ivaRate: string
}

const emptyForm: CategoryForm = {
  name: '',
  image: '',
  parentId: '',
  enabled: true,
  markup: '',
  cashDiscount: '',
  ivaRate: '',
}

export default function AdminCategorias() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState<CategoryForm>(emptyForm)
  const [formError, setFormError] = useState('')

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/categories')
      const data = await res.json()
      if (data.ok && data.categories && (data.categories as Category[]).length > 0) {
        setCategories(data.categories as Category[])
      } else {
        // No categories found - try initializing them
        console.log('[categorias] No categories found, initializing...')
        const initRes = await fetch('/api/admin/init-categories', { method: 'POST' })
        const initData = await initRes.json()
        if (initData.ok) {
          const res2 = await fetch('/api/admin/categories')
          const data2 = await res2.json()
          if (data2.ok) setCategories(data2.categories as Category[])
        }
      }
    } catch (error) {
      console.error('Error loading categories:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  // Group categories: parent categories with their children
  const parentCategories = categories.filter(c => !c.parentId).sort((a, b) => a.order - b.order)

  const getChildren = (parentId: string) =>
    categories.filter(c => c.parentId === parentId).sort((a, b) => a.order - b.order)

  const getCategoryName = (parentId: string | null) => {
    if (!parentId) return '—'
    const parent = categories.find(c => c.id === parentId)
    return parent?.name || parentId
  }

  const handleCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setFormOpen(true)
  }

  const handleEdit = (category: Category) => {
    setEditingId(category.id)
    setForm({
      name: category.name,
      image: category.image || '',
      parentId: category.parentId || '',
      enabled: category.enabled === 1,
      markup: category.markup != null ? String(category.markup) : '',
      cashDiscount: category.cashDiscount != null ? String(category.cashDiscount) : '',
      ivaRate: category.ivaRate != null ? String(category.ivaRate) : '',
    })
    setFormError('')
    setFormOpen(true)
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
    setDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!deletingId) return
    try {
      await fetch(`/api/admin/categories?id=${deletingId}`, { method: 'DELETE' })
      setCategories(prev => prev.filter(c => c.id !== deletingId))
    } catch (error) {
      console.error('Error deleting category:', error)
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

    setSaving(true)
    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        name: form.name.trim(),
        image: form.image.trim() || null,
        parentId: form.parentId || null,
        enabled: form.enabled,
        markup: form.markup.trim() || null,
        cashDiscount: form.cashDiscount.trim() || null,
        ivaRate: form.ivaRate.trim() || null,
      }

      const res = await fetch('/api/admin/categories', {
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
      loadCategories()
    } catch (error) {
      setFormError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async (category: Category) => {
    const newEnabled = category.enabled === 1 ? 0 : 1
    setTogglingId(category.id)

    try {
      // Optimistic update
      setCategories(prev =>
        prev.map(c => c.id === category.id ? { ...c, enabled: newEnabled } : c)
      )

      const res = await fetch('/api/admin/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: category.id, enabled: newEnabled }),
      })

      const data = await res.json()
      if (!data.ok) {
        // Revert on error
        setCategories(prev =>
          prev.map(c => c.id === category.id ? { ...c, enabled: category.enabled } : c)
        )
      }
    } catch (error) {
      // Revert on error
      setCategories(prev =>
        prev.map(c => c.id === category.id ? { ...c, enabled: category.enabled } : c)
      )
    } finally {
      setTogglingId(null)
    }
  }

  const moveCategory = async (category: Category, direction: 'up' | 'down') => {
    const siblings = category.parentId
      ? getChildren(category.parentId)
      : parentCategories

    const currentIndex = siblings.findIndex(c => c.id === category.id)
    if (currentIndex === -1) return

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (swapIndex < 0 || swapIndex >= siblings.length) return

    const swapCategory = siblings[swapIndex]

    // Optimistic update
    const newOrder = swapCategory.order
    const swapNewOrder = category.order

    setCategories(prev =>
      prev.map(c => {
        if (c.id === category.id) return { ...c, order: newOrder }
        if (c.id === swapCategory.id) return { ...c, order: swapNewOrder }
        return c
      })
    )

    try {
      await Promise.all([
        fetch('/api/admin/categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: category.id, order: newOrder }),
        }),
        fetch('/api/admin/categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: swapCategory.id, order: swapNewOrder }),
        }),
      ])
    } catch (error) {
      console.error('Error reordering:', error)
      loadCategories() // Reload on error
    }
  }

  // Count products per category
  const getProductCount = (categoryId: string) => {
    // We don't have product counts in the current data
    // Just show children count for parents
    const children = getChildren(categoryId)
    return children.length
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
          <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
          <p className="text-sm text-gray-500">
            {parentCategories.length} categorías principales · {categories.length} en total
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={async () => {
              try {
                const res = await fetch('/api/admin/init-categories', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                })
                const data = await res.json()
                if (data.ok) {
                  loadCategories()
                }
              } catch (e) {
                console.error(e)
              }
            }}
            variant="outline"
            size="sm"
          >
            Reinicializar Categorías
          </Button>
          <Button onClick={handleCreate} className="bg-compucity-green hover:bg-compucity-green-dark">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Categoría
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        <strong>Tip:</strong> Las categorías deshabilitadas no se muestran en la tienda pero los productos siguen asignados.
        Al deshabilitar una categoría padre, sus subcategorías también se ocultan.
      </div>

      {/* Categories Table */}
      <Card>
        <CardContent className="p-0">
          {categories.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>No hay categorías</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Orden</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Padre</TableHead>
                    <TableHead className="text-center">Visible</TableHead>
                    <TableHead className="text-center">Subcat.</TableHead>
                    <TableHead className="text-center">Markup</TableHead>
                    <TableHead className="text-center">Dto. Efect.</TableHead>
                    <TableHead className="text-center">IVA</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parentCategories.map((category) => {
                    const children = getChildren(category.id)
                    const isDisabled = category.enabled === 0

                    return (
                      <>
                        {/* Parent Category Row */}
                        <TableRow
                          key={category.id}
                          className={`font-medium ${isDisabled ? 'bg-gray-100 text-gray-400' : 'bg-compucity-green-50/30'}`}
                        >
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <GripVertical className="w-4 h-4 text-gray-300" />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveCategory(category, 'up')}
                                disabled={parentCategories.indexOf(category) === 0}
                              >
                                <ChevronUp className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveCategory(category, 'down')}
                                disabled={parentCategories.indexOf(category) === parentCategories.length - 1}
                              >
                                <ChevronDown className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className={`font-semibold ${isDisabled ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                            {category.name}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-gray-500">
                            {category.slug}
                          </TableCell>
                          <TableCell>—</TableCell>
                          <TableCell className="text-center">
                            <button
                              onClick={() => toggleEnabled(category)}
                              disabled={togglingId === category.id}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                category.enabled === 1
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-red-100 text-red-700 hover:bg-red-200'
                              } ${togglingId === category.id ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                            >
                              {togglingId === category.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : category.enabled === 1 ? (
                                <Eye className="w-3 h-3" />
                              ) : (
                                <EyeOff className="w-3 h-3" />
                              )}
                              {category.enabled === 1 ? 'Visible' : 'Oculta'}
                            </button>
                          </TableCell>
                          <TableCell className="text-center text-sm text-gray-500">
                            {children.length}
                          </TableCell>
                          <TableCell className="text-center">
                            {category.markup != null ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                                {category.markup}%
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Global</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {category.cashDiscount != null ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                                {category.cashDiscount}%
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Global</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {category.ivaRate != null ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">
                                {category.ivaRate}%
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Default</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(category)}
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(category.id)}
                                title="Eliminar"
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Children Rows */}
                        {children.map((child) => {
                          const childDisabled = child.enabled === 0 || isDisabled
                          return (
                            <TableRow
                              key={child.id}
                              className={childDisabled ? 'bg-gray-50 text-gray-400' : ''}
                            >
                              <TableCell>
                                <span className="text-gray-300 pl-4">└─</span>
                              </TableCell>
                              <TableCell className={childDisabled ? 'text-gray-400 line-through' : 'text-gray-700'}>
                                {child.name}
                              </TableCell>
                              <TableCell className="font-mono text-sm text-gray-400">
                                {child.slug}
                              </TableCell>
                              <TableCell className="text-sm text-gray-500">
                                {category.name}
                              </TableCell>
                              <TableCell className="text-center">
                                <button
                                  onClick={() => toggleEnabled(child)}
                                  disabled={togglingId === child.id}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                    child.enabled === 1
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                                  } ${togglingId === child.id ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                                >
                                  {togglingId === child.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : child.enabled === 1 ? (
                                    <Eye className="w-3 h-3" />
                                  ) : (
                                    <EyeOff className="w-3 h-3" />
                                  )}
                                  {child.enabled === 1 ? 'Visible' : 'Oculta'}
                                </button>
                              </TableCell>
                              <TableCell></TableCell>
                              <TableCell className="text-center">
                                {child.markup != null ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                                    {child.markup}%
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">Global</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {child.cashDiscount != null ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                                    {child.cashDiscount}%
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">Global</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {child.ivaRate != null ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">
                                    {child.ivaRate}%
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">Default</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(child)}
                                    title="Editar"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(child.id)}
                                    title="Eliminar"
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Categoría' : 'Nueva Categoría'}
            </DialogTitle>
          </DialogHeader>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {formError}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nombre *</Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre de la categoría"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-image">URL de Imagen</Label>
              <Input
                id="cat-image"
                value={form.image}
                onChange={(e) => setForm(prev => ({ ...prev, image: e.target.value }))}
                placeholder="https://ejemplo.com/imagen.jpg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-parent">Categoría Padre</Label>
              <Select
                value={form.parentId}
                onValueChange={(value) => setForm(prev => ({ ...prev, parentId: value === '_none' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ninguna (categoría raíz)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Ninguna (categoría raíz)</SelectItem>
                  {categories
                    .filter(c => c.id !== editingId && !c.parentId)
                    .map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="cat-enabled">Habilitada en la tienda</Label>
              <button
                id="cat-enabled"
                type="button"
                onClick={() => setForm(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.enabled ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-500">
                {form.enabled ? 'Visible en la tienda' : 'Oculta en la tienda'}
              </span>
            </div>

            {/* Markup, Descuento e IVA por Categoría */}
            <div className="border-t pt-4 mt-2">
              <p className="text-sm font-semibold text-gray-700 mb-3">Margen, Descuento e IVA por Categoría</p>
              <p className="text-xs text-gray-400 mb-3">
                Si configuras un valor aquí, se usará para todos los productos de esta categoría que no tengan un valor individual.
                Prioridad: Producto individual {'>'} Categoría {'>'} Global (15% markup, 0% dto. efectivo, 10,5% IVA)
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cat-markup">Margen de ganancia (%)</Label>
                  <Input
                    id="cat-markup"
                    type="number"
                    min="0"
                    max="500"
                    step="1"
                    value={form.markup}
                    onChange={(e) => setForm(prev => ({ ...prev, markup: e.target.value }))}
                    placeholder="Usar global (15%)"
                  />
                  <p className="text-xs text-gray-400">
                    {form.markup ? `${form.markup}% para esta categoría` : 'Dejar vacío = usar global (15%)'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cat-cashDiscount">Descuento efectivo (%)</Label>
                  <Input
                    id="cat-cashDiscount"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={form.cashDiscount}
                    onChange={(e) => setForm(prev => ({ ...prev, cashDiscount: e.target.value }))}
                    placeholder="Usar global (0%)"
                  />
                  <p className="text-xs text-gray-400">
                    {form.cashDiscount ? `${form.cashDiscount}% para esta categoría` : 'Dejar vacío = usar global (0%)'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cat-ivaRate">IVA (%)</Label>
                  <Select
                    value={form.ivaRate || '_default'}
                    onValueChange={(value) => setForm(prev => ({ ...prev, ivaRate: value === '_default' ? '' : value }))}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Seleccionar IVA" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_default">Default → 10,5% (los productos heredan este valor)</SelectItem>
                      <SelectItem value="10.5">10,5%</SelectItem>
                      <SelectItem value="21">21%</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-400">
                    {form.ivaRate
                      ? `✓ Todos los productos de esta categoría (sin IVA individual) usarán ${form.ivaRate}%`
                      : 'Sin IVA configurado → los productos usan default 10,5%'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-compucity-green hover:bg-compucity-green-dark" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                editingId ? 'Guardar Cambios' : 'Crear Categoría'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Los productos de esta categoría quedarán sin categoría asignada.
              Las subcategorías pasarán a ser categorías raíz.
              Esta acción no se puede deshacer.
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
