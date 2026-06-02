'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, Loader2, Tag, ChevronUp, ChevronDown, Eye, EyeOff, ImageIcon, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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

// ============================================
// TYPES
// ============================================

interface Coupon {
  id: string
  code: string
  description: string | null
  discountType: string
  discountValue: number
  minPurchase: number
  maxUses: number
  usedCount: number
  validFrom: string | null
  validUntil: string | null
  isActive: number
  createdAt: string
  updatedAt: string
}

interface Banner {
  id: string
  title: string
  subtitle: string | null
  buttonText: string | null
  buttonLink: string | null
  bgColor: string
  textColor: string
  imageUrl: string | null
  position: string
  isActive: number
  order: number
  createdAt: string
  updatedAt: string
}

interface CouponForm {
  code: string
  description: string
  discountType: string
  discountValue: string
  minPurchase: string
  maxUses: string
  validFrom: string
  validUntil: string
  isActive: boolean
}

interface BannerForm {
  title: string
  subtitle: string
  buttonText: string
  buttonLink: string
  bgColor: string
  textColor: string
  imageUrl: string
  position: string
  isActive: boolean
  order: string
}

const emptyCouponForm: CouponForm = {
  code: '',
  description: '',
  discountType: 'percentage',
  discountValue: '',
  minPurchase: '',
  maxUses: '',
  validFrom: '',
  validUntil: '',
  isActive: true,
}

const emptyBannerForm: BannerForm = {
  title: '',
  subtitle: '',
  buttonText: '',
  buttonLink: '',
  bgColor: '#3A8B68',
  textColor: '#FFFFFF',
  imageUrl: '',
  position: 'top',
  isActive: true,
  order: '0',
}

// Helper: compress image before upload
async function compressImageForBanner(file: File, maxWidth = 1600, quality = 0.85): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas error')); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }))
          } else {
            reject(new Error('Compression error'))
          }
        },
        'image/webp',
        quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Load error')) }
    img.src = url
  })
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminPromociones() {
  const [activeTab, setActiveTab] = useState<'cupones' | 'banners'>('cupones')

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Promociones</h1>
        <p className="text-sm text-gray-500">Gestioná cupones de descuento y banners promocionales</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('cupones')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === 'cupones' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Tag className="w-4 h-4 inline mr-1.5" />
          Cupones
        </button>
        <button
          onClick={() => setActiveTab('banners')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === 'banners' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ImageIcon className="w-4 h-4 inline mr-1.5" />
          Banners
        </button>
      </div>

      {activeTab === 'cupones' ? <CuponesTab /> : <BannersTab />}
    </div>
  )
}

// ============================================
// CUPONES TAB
// ============================================

function CuponesTab() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState<CouponForm>(emptyCouponForm)
  const [formError, setFormError] = useState('')

  const loadCoupons = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/coupons')
      const data = await res.json()
      if (data.ok) setCoupons(data.coupons as Coupon[])
    } catch (error) {
      console.error('Error loading coupons:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCoupons() }, [loadCoupons])

  const handleCreate = () => {
    setEditingId(null)
    setForm(emptyCouponForm)
    setFormError('')
    setFormOpen(true)
  }

  const handleEdit = (coupon: Coupon) => {
    setEditingId(coupon.id)
    setForm({
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      minPurchase: coupon.minPurchase ? String(coupon.minPurchase) : '',
      maxUses: coupon.maxUses ? String(coupon.maxUses) : '',
      validFrom: coupon.validFrom ? coupon.validFrom.slice(0, 10) : '',
      validUntil: coupon.validUntil ? coupon.validUntil.slice(0, 10) : '',
      isActive: coupon.isActive === 1,
    })
    setFormError('')
    setFormOpen(true)
  }

  const handleSave = async () => {
    setFormError('')
    if (!form.code.trim()) { setFormError('El código es requerido'); return }
    if (!form.discountValue || Number(form.discountValue) <= 0) { setFormError('El valor de descuento debe ser mayor a 0'); return }

    setSaving(true)
    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        code: form.code.trim(),
        description: form.description.trim() || null,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minPurchase: form.minPurchase ? Number(form.minPurchase) : 0,
        maxUses: form.maxUses ? Number(form.maxUses) : 0,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
        isActive: form.isActive,
      }

      const res = await fetch('/api/admin/coupons', {
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
      loadCoupons()
    } catch {
      setFormError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await fetch(`/api/admin/coupons?id=${deletingId}`, { method: 'DELETE' })
      setCoupons(prev => prev.filter(c => c.id !== deletingId))
    } catch (error) {
      console.error('Error deleting coupon:', error)
    }
    setDeleteOpen(false)
    setDeletingId(null)
  }

  const updateForm = (field: keyof CouponForm, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-compucity-green" />
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{coupons.length} cupón{coupons.length !== 1 ? 'es' : ''}</p>
        <Button onClick={handleCreate} className="bg-compucity-green hover:bg-compucity-green-dark">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Cupón
        </Button>
      </div>

      {coupons.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Tag className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>No hay cupones creados</p>
        </div>
      ) : (
        <div className="rounded-xl border shadow-sm bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50/80">
                <th className="h-10 px-4 text-left font-medium text-gray-600">Código</th>
                <th className="h-10 px-4 text-left font-medium text-gray-600">Descuento</th>
                <th className="h-10 px-4 text-left font-medium text-gray-600">Vigencia</th>
                <th className="h-10 px-4 text-center font-medium text-gray-600">Usos</th>
                <th className="h-10 px-4 text-center font-medium text-gray-600">Estado</th>
                <th className="h-10 px-4 text-center font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon, i) => (
                <tr key={coupon.id} className={`hover:bg-muted/50 border-b transition-colors ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                  <td className="p-3">
                    <div>
                      <span className="font-mono font-bold text-gray-900">{coupon.code}</span>
                      {coupon.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{coupon.description}</p>
                      )}
                      {coupon.minPurchase > 0 && (
                        <p className="text-xs text-gray-400">Mín: ${Number(coupon.minPurchase).toLocaleString('es-AR')}</p>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="font-medium text-compucity-green">
                      {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `$${Number(coupon.discountValue).toLocaleString('es-AR')}`}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-gray-500">
                    {coupon.validFrom ? new Date(coupon.validFrom).toLocaleDateString('es-AR') : '—'}
                    {' → '}
                    {coupon.validUntil ? new Date(coupon.validUntil).toLocaleDateString('es-AR') : '—'}
                  </td>
                  <td className="p-3 text-center">
                    <span className="text-sm">
                      {coupon.usedCount}{coupon.maxUses > 0 ? `/${coupon.maxUses}` : ''}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <Badge variant="secondary" className={coupon.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                      {coupon.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(coupon)} title="Editar" className="h-7 w-7">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setDeletingId(coupon.id); setDeleteOpen(true) }} title="Eliminar" className="text-red-500 hover:text-red-700 h-7 w-7">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Coupon Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Cupón' : 'Nuevo Cupón'}</DialogTitle>
          </DialogHeader>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {formError}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código *</Label>
                <Input id="code" value={form.code} onChange={(e) => updateForm('code', e.target.value.toUpperCase())} placeholder="VERANO2025" className="uppercase" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountType">Tipo de descuento</Label>
                <Select value={form.discountType} onValueChange={(v) => updateForm('discountType', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                    <SelectItem value="fixed">Monto fijo ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Input id="description" value={form.description} onChange={(e) => updateForm('description', e.target.value)} placeholder="Descuento de verano" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discountValue">
                  Valor del descuento {form.discountType === 'percentage' ? '(%)' : '($)'} *
                </Label>
                <Input id="discountValue" type="number" step="0.01" min="0" value={form.discountValue} onChange={(e) => updateForm('discountValue', e.target.value)} placeholder="10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minPurchase">Compra mínima ($)</Label>
                <Input id="minPurchase" type="number" step="0.01" min="0" value={form.minPurchase} onChange={(e) => updateForm('minPurchase', e.target.value)} placeholder="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxUses">Usos máximos (0 = ilimitado)</Label>
                <Input id="maxUses" type="number" min="0" value={form.maxUses} onChange={(e) => updateForm('maxUses', e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2 flex items-end">
                <div className="flex items-center gap-2 pb-1">
                  <Switch checked={form.isActive} onCheckedChange={(v) => updateForm('isActive', v)} />
                  <Label>{form.isActive ? 'Activo' : 'Inactivo'}</Label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="validFrom">Válido desde</Label>
                <Input id="validFrom" type="date" value={form.validFrom} onChange={(e) => updateForm('validFrom', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validUntil">Válido hasta</Label>
                <Input id="validUntil" type="date" value={form.validUntil} onChange={(e) => updateForm('validUntil', e.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-compucity-green hover:bg-compucity-green-dark" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingId ? 'Guardar' : 'Crear cupón'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cupón?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ============================================
// BANNERS TAB
// ============================================

interface CategoryOption {
  id: string
  name: string
  slug: string
}

function BannersTab() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState<BannerForm>(emptyBannerForm)
  const [formError, setFormError] = useState('')

  // Predefined link options
  const linkOptions = [
    { value: '', label: 'Sin link' },
    { value: '/arma-tu-pc', label: '🎤 Armá tu PC' },
    { value: '/categoria/ofertas', label: '🏷️ Ofertas' },
    ...categories.map(c => ({
      value: `/categoria/${c.slug}`,
      label: `📁 ${c.name}`,
    })),
  ]

  const loadBanners = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/banners')
      const data = await res.json()
      if (data.ok) setBanners(data.banners as Banner[])
    } catch (error) {
      console.error('Error loading banners:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/categories')
      const data = await res.json()
      if (data.ok && data.categories) {
        setCategories((data.categories as CategoryOption[]).filter(c => !c.slug.startsWith('_')))
      }
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }, [])

  useEffect(() => { loadBanners(); loadCategories() }, [loadBanners, loadCategories])

  const handleCreate = () => {
    setEditingId(null)
    setForm(emptyBannerForm)
    setFormError('')
    setFormOpen(true)
  }

  const handleEdit = (banner: Banner) => {
    setEditingId(banner.id)
    setForm({
      title: banner.title,
      subtitle: banner.subtitle || '',
      buttonText: banner.buttonText || '',
      buttonLink: banner.buttonLink || '',
      bgColor: banner.bgColor || '#3A8B68',
      textColor: banner.textColor || '#FFFFFF',
      imageUrl: banner.imageUrl || '',
      position: banner.position || 'top',
      isActive: banner.isActive === 1,
      order: String(banner.order || 0),
    })
    setFormError('')
    setFormOpen(true)
  }

  const handleSave = async () => {
    setFormError('')
    if (!form.title.trim()) { setFormError('El título es requerido'); return }

    setSaving(true)
    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        buttonText: form.buttonText.trim() || null,
        buttonLink: form.buttonLink.trim() || null,
        bgColor: form.bgColor,
        textColor: form.textColor,
        imageUrl: form.imageUrl.trim() || null,
        position: form.position,
        isActive: form.isActive,
        order: Number(form.order) || 0,
      }

      const res = await fetch('/api/admin/banners', {
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
      loadBanners()
    } catch {
      setFormError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await fetch(`/api/admin/banners?id=${deletingId}`, { method: 'DELETE' })
      setBanners(prev => prev.filter(b => b.id !== deletingId))
    } catch (error) {
      console.error('Error deleting banner:', error)
    }
    setDeleteOpen(false)
    setDeletingId(null)
  }

  const handleReorder = async (banner: Banner, direction: 'up' | 'down') => {
    const currentIndex = banners.findIndex(b => b.id === banner.id)
    if (direction === 'up' && currentIndex === 0) return
    if (direction === 'down' && currentIndex === banners.length - 1) return

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const swapBanner = banners[swapIndex]

    // Swap orders
    await Promise.all([
      fetch('/api/admin/banners', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: banner.id, order: swapBanner.order }),
      }),
      fetch('/api/admin/banners', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: swapBanner.id, order: banner.order }),
      }),
    ])

    loadBanners()
  }

  const updateForm = (field: keyof BannerForm, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-compucity-green" />
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{banners.length} banner{banners.length !== 1 ? 'es' : ''}</p>
        <Button onClick={handleCreate} className="bg-compucity-green hover:bg-compucity-green-dark">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Banner
        </Button>
      </div>

      {banners.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>No hay banners creados</p>
        </div>
      ) : (
        <div className="space-y-4">
          {banners.map((banner) => (
            <div key={banner.id} className="rounded-xl border shadow-sm bg-card overflow-hidden">
              {/* Preview */}
              <div
                className="w-full py-3 px-4 text-center"
                style={{ backgroundColor: banner.bgColor || '#3A8B68' }}
              >
                <h3 className="font-bold" style={{ color: banner.textColor || '#FFFFFF' }}>{banner.title}</h3>
                {banner.subtitle && (
                  <p className="text-sm opacity-90" style={{ color: banner.textColor || '#FFFFFF' }}>{banner.subtitle}</p>
                )}
                {banner.buttonText && (
                  <span
                    className="inline-block mt-2 px-3 py-1 text-xs font-semibold rounded-full"
                    style={{ backgroundColor: banner.textColor || '#FFFFFF', color: banner.bgColor || '#3A8B68' }}
                  >
                    {banner.buttonText}
                  </span>
                )}
              </div>
              {/* Info bar */}
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-t">
                <Badge variant="secondary" className="text-xs">
                  {banner.position === 'top' ? 'Arriba del hero' : 'Debajo del hero'}
                </Badge>
                <Badge variant="secondary" className={banner.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                  {banner.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
                <span className="text-xs text-gray-400">Orden: {banner.order}</span>
                <div className="ml-auto flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" onClick={() => handleReorder(banner, 'up')} title="Subir" className="h-7 w-7">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleReorder(banner, 'down')} title="Bajar" className="h-7 w-7">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(banner)} title="Editar" className="h-7 w-7">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setDeletingId(banner.id); setDeleteOpen(true) }} title="Eliminar" className="text-red-500 hover:text-red-700 h-7 w-7">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Banner Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Banner' : 'Nuevo Banner'}</DialogTitle>
          </DialogHeader>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {formError}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input id="title" value={form.title} onChange={(e) => updateForm('title', e.target.value)} placeholder="¡Ofertas de verano!" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtítulo</Label>
              <Input id="subtitle" value={form.subtitle} onChange={(e) => updateForm('subtitle', e.target.value)} placeholder="Hasta 30% de descuento en notebooks" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buttonText">Texto del botón</Label>
                <Input id="buttonText" value={form.buttonText} onChange={(e) => updateForm('buttonText', e.target.value)} placeholder="Ver ofertas" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buttonLink">Destino del botón</Label>
                <Select value={form.buttonLink || '_none'} onValueChange={(v) => updateForm('buttonLink', v === '_none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar destino" /></SelectTrigger>
                  <SelectContent>
                    {linkOptions.map(opt => (
                      <SelectItem key={opt.value || '_none'} value={opt.value || '_none'}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400 mt-1">O escribí un link personalizado:</p>
                <Input
                  value={form.buttonLink}
                  onChange={(e) => updateForm('buttonLink', e.target.value)}
                  placeholder="/categoria/ofertas"
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="position">Posición</Label>
                <Select value={form.position} onValueChange={(v) => updateForm('position', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">Arriba del hero</SelectItem>
                    <SelectItem value="below-hero">Debajo del hero</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="order">Orden</Label>
                <Input id="order" type="number" min="0" value={form.order} onChange={(e) => updateForm('order', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bgColor">Color de fondo</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.bgColor}
                    onChange={(e) => updateForm('bgColor', e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input value={form.bgColor} onChange={(e) => updateForm('bgColor', e.target.value)} className="flex-1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="textColor">Color de texto</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.textColor}
                    onChange={(e) => updateForm('textColor', e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input value={form.textColor} onChange={(e) => updateForm('textColor', e.target.value)} className="flex-1" />
                </div>
              </div>
            </div>

            {/* Background image */}
            <div className="space-y-2 border rounded-lg p-3 bg-gray-50/50">
              <Label className="text-sm font-semibold text-gray-700">Imagen de fondo (opcional)</Label>
              <p className="text-xs text-gray-400">Si agregás una imagen, se muestra como fondo con una capa semitransparente del color elegido arriba.</p>
              {form.imageUrl ? (
                <div className="relative rounded-lg overflow-hidden border">
                  <img src={form.imageUrl} alt="Fondo del banner" className="w-full h-24 object-cover" />
                  <button
                    onClick={() => updateForm('imageUrl', '')}
                    className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow"
                    title="Quitar imagen"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={form.imageUrl}
                    onChange={(e) => updateForm('imageUrl', e.target.value)}
                    placeholder="URL de imagen o subí una..."
                    className="flex-1"
                  />
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 transition shrink-0">
                    <ImageIcon className="w-4 h-4 text-gray-500" />
                    Subir
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        // Compress & upload
                        const formData = new FormData()
                        const compressed = await compressImageForBanner(file)
                        formData.append('file', compressed)
                        try {
                          const res = await fetch('/api/admin/upload', { method: 'POST', body: formData })
                          const data = await res.json()
                          if (data.ok && data.url) {
                            updateForm('imageUrl', data.url)
                          }
                        } catch {}
                      }}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => updateForm('isActive', v)} />
              <Label>{form.isActive ? 'Activo' : 'Inactivo'}</Label>
            </div>

            {/* Preview */}
            <div className="border rounded-lg overflow-hidden">
              <p className="text-xs text-gray-500 px-3 py-1 bg-gray-50 border-b">Vista previa</p>
              <div
                className="w-full py-3 px-4 text-center relative"
                style={{ backgroundColor: form.bgColor || '#3A8B68' }}
              >
                {form.imageUrl && (
                  <>
                    <img src={form.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0" style={{ backgroundColor: form.bgColor || '#3A8B68', opacity: 0.7 }} />
                  </>
                )}
                <div className="relative z-10">
                  <h3 className="font-bold" style={{ color: form.textColor || '#FFFFFF' }}>{form.title || 'Título del banner'}</h3>
                  {form.subtitle && (
                    <p className="text-sm opacity-90" style={{ color: form.textColor || '#FFFFFF' }}>{form.subtitle}</p>
                  )}
                  {form.buttonText && (
                    <span
                      className="inline-block mt-2 px-3 py-1 text-xs font-semibold rounded-full"
                      style={{ backgroundColor: form.textColor || '#FFFFFF', color: form.bgColor || '#3A8B68' }}
                    >
                      {form.buttonText}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-compucity-green hover:bg-compucity-green-dark" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingId ? 'Guardar' : 'Crear banner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar banner?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
