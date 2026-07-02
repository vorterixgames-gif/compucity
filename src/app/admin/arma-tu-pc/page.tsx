'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Loader2,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  Cpu,
  CircuitBoard,
  Zap,
  Gamepad2,
  HardDrive,
  Plug,
  Box,
  Wind,
  Droplets,
  Monitor,
  Wifi,
  Mouse,
  CheckCircle,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

interface Category {
  id: string
  name: string
  slug: string
  parentId: string | null
  enabled: number
}

interface BuilderSlotConfig {
  slot: string
  label: string
  categorySlug: string
  additionalCategorySlugs?: string[]
  includedSubcategorySlugs?: string[]
  enabled: boolean
  required: boolean
  maxQty: number
  order: number
  icon: string
}

const ICON_OPTIONS = [
  { value: 'Cpu', label: 'Microprocesador', component: Cpu },
  { value: 'CircuitBoard', label: 'Motherboard', component: CircuitBoard },
  { value: 'Zap', label: 'RAM', component: Zap },
  { value: 'Gamepad2', label: 'Placa de Video', component: Gamepad2 },
  { value: 'HardDrive', label: 'Disco', component: HardDrive },
  { value: 'Plug', label: 'Fuente', component: Plug },
  { value: 'Box', label: 'Gabinete', component: Box },
  { value: 'Wind', label: 'Refrigeración', component: Wind },
  { value: 'Droplets', label: 'Pasta Térmica', component: Droplets },
  { value: 'Monitor', label: 'Monitor', component: Monitor },
  { value: 'Wifi', label: 'WiFi/Red', component: Wifi },
  { value: 'Mouse', label: 'Periférico', component: Mouse },
]

export default function AdminArmaTuPC() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [slots, setSlots] = useState<BuilderSlotConfig[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [configSource, setConfigSource] = useState<string>('default')
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [newSlotKey, setNewSlotKey] = useState('')
  const [newSlotLabel, setNewSlotLabel] = useState('')
  const [newSlotCategory, setNewSlotCategory] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  // Load slots and categories
  useEffect(() => {
    Promise.all([
      fetch('/api/admin/pc-builder-slots').then(r => r.json()),
      fetch('/api/admin/categories').then(r => r.json()),
    ]).then(([slotsData, catData]) => {
      if (slotsData.ok) {
        setSlots(slotsData.slots)
        setConfigSource(slotsData.source || 'default')
      }
      if (catData.ok) {
        const cats = catData.categories || []
        setCategories(cats)
        // Debug: log subcategory info for perifericos
        const perif = cats.find((c: any) => c.slug === 'perifericos')
        if (perif) {
          const subs = cats.filter((c: any) => c.parentId === perif.id)
          console.log('[DEBUG] Periféricos:', perif.id, '| subcategories found:', subs.length, '| enabled type:', typeof perif.enabled, perif.enabled)
          if (subs.length > 0) console.log('[DEBUG] First sub:', subs[0].name, subs[0].parentId, typeof subs[0].enabled, subs[0].enabled)
        } else {
          console.log('[DEBUG] Periféricos not found in categories')
        }
      }
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [])

  // Derived: parent categories (enabled, no parentId)
  const enabledCategories = useMemo(
    () => categories.filter(c => Number(c.enabled) === 1 && !c.parentId),
    [categories]
  )

  // Derived: subcategories grouped by parent ID
  const subcategoriesByParentId = useMemo(() => {
    const map = new Map<string, Category[]>()
    for (const c of categories) {
      if (c.parentId && Number(c.enabled) === 1) {
        if (!map.has(c.parentId)) map.set(c.parentId, [])
        map.get(c.parentId)!.push(c)
      }
    }
    return map
  }, [categories])

  // Derived: category by slug lookup
  const categoryBySlug = useMemo(() => {
    const map = new Map<string, Category>()
    for (const c of categories) {
      map.set(c.slug, c)
    }
    return map
  }, [categories])

  const save = async () => {
    setSaving(true)
    setSaveMessage(null)
    try {
      const res = await fetch('/api/admin/pc-builder-slots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots }),
      })
      const data = await res.json()
      if (data.ok) {
        setConfigSource('database')
        setSaveMessage({ type: 'success', text: 'Configuración guardada correctamente' })
      } else {
        setSaveMessage({ type: 'error', text: data.error || 'Error al guardar' })
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Error de conexión' })
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMessage(null), 5000)
    }
  }

  const resetToDefaults = async () => {
    try {
      await fetch('/api/admin/pc-builder-slots', { method: 'DELETE' })
      const res = await fetch('/api/admin/pc-builder-slots')
      const data = await res.json()
      if (data.ok) {
        setSlots(data.slots)
        setConfigSource('default')
        setSaveMessage({ type: 'success', text: 'Se restauraron los valores por defecto' })
        setTimeout(() => setSaveMessage(null), 5000)
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Error al restaurar' })
    }
    setShowResetDialog(false)
  }

  const moveSlot = (index: number, direction: 'up' | 'down') => {
    const newSlots = [...slots]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newSlots.length) return
    ;[newSlots[index], newSlots[targetIndex]] = [newSlots[targetIndex], newSlots[index]]
    // Update order values
    newSlots.forEach((s, i) => s.order = i)
    setSlots(newSlots)
  }

  const updateSlot = (index: number, field: keyof BuilderSlotConfig, value: any) => {
    const newSlots = [...slots]
    newSlots[index] = { ...newSlots[index], [field]: value }
    setSlots(newSlots)
  }

  const toggleSubcategory = (index: number, subSlug: string) => {
    const newSlots = [...slots]
    const slot = { ...newSlots[index] }
    const current = slot.includedSubcategorySlugs || []
    if (current.includes(subSlug)) {
      slot.includedSubcategorySlugs = current.filter(s => s !== subSlug)
    } else {
      slot.includedSubcategorySlugs = [...current, subSlug]
    }
    newSlots[index] = slot
    setSlots(newSlots)
  }

  const clearSubcategoryFilter = (index: number) => {
    const newSlots = [...slots]
    newSlots[index] = { ...newSlots[index] }
    delete newSlots[index].includedSubcategorySlugs
    setSlots(newSlots)
  }

  const removeSlot = (index: number) => {
    const newSlots = slots.filter((_, i) => i !== index)
    newSlots.forEach((s, i) => s.order = i)
    setSlots(newSlots)
  }

  const addNewSlot = () => {
    if (!newSlotKey || !newSlotLabel || !newSlotCategory) return
    if (!/^[a-z][a-z0-9_-]*$/.test(newSlotKey)) {
      setSaveMessage({ type: 'error', text: 'El key solo puede contener letras minúsculas, números, guiones y guiones bajos. Debe empezar con letra.' })
      setTimeout(() => setSaveMessage(null), 5000)
      return
    }
    if (slots.some(s => s.slot === newSlotKey)) {
      setSaveMessage({ type: 'error', text: `Ya existe un slot con key "${newSlotKey}"` })
      setTimeout(() => setSaveMessage(null), 5000)
      return
    }
    const newSlot: BuilderSlotConfig = {
      slot: newSlotKey,
      label: newSlotLabel,
      categorySlug: newSlotCategory,
      enabled: true,
      required: false,
      maxQty: 1,
      order: slots.length,
      icon: 'Cpu',
    }
    setSlots([...slots, newSlot])
    setNewSlotKey('')
    setNewSlotLabel('')
    setNewSlotCategory('')
    setShowAddForm(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-compucity-green" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Arma tu PC — Slots</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configurá qué categorías aparecen en el arma tu PC, su orden y si son obligatorias.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${configSource === 'database' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
            {configSource === 'database' ? 'Configuración personalizada' : 'Valores por defecto'}
          </span>
        </div>
      </div>

      {saveMessage && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${saveMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {saveMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {saveMessage.text}
        </div>
      )}

      {/* Slot list */}
      <div className="space-y-3 mb-6">
        {slots.map((slot, idx) => {
          const iconOption = ICON_OPTIONS.find(i => i.value === slot.icon)
          const IconComponent = iconOption?.component || Cpu
          const parentCat = categoryBySlug.get(slot.categorySlug)
          const subcategories = parentCat ? (subcategoriesByParentId.get(parentCat.id) || []) : []
          const hasSubcategories = subcategories.length > 0
          const hasSubcategoryFilter = (slot.includedSubcategorySlugs?.length ?? 0) > 0

          return (
            <Card key={slot.slot} className={`${!slot.enabled ? 'opacity-50' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Drag + Order buttons */}
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <button
                      onClick={() => moveSlot(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <GripVertical className="w-4 h-4 text-gray-300" />
                    <button
                      onClick={() => moveSlot(idx, 'down')}
                      disabled={idx === slots.length - 1}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Icon + info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${slot.enabled ? 'bg-compucity-green-50 text-compucity-green' : 'bg-gray-100 text-gray-400'}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{slot.label}</span>
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{slot.slot}</code>
                        {slot.required && (
                          <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Obligatorio</span>
                        )}
                        {hasSubcategoryFilter && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Filter className="w-3 h-3" />
                            {slot.includedSubcategorySlugs!.length} subcat.
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Categoría: <span className="font-mono">{slot.categorySlug}</span>
                        {slot.additionalCategorySlugs?.length ? ` + ${slot.additionalCategorySlugs.join(', ')}` : ''}
                        {hasSubcategoryFilter && ` · Solo: ${slot.includedSubcategorySlugs!.join(', ')}`}
                        {!hasSubcategoryFilter && hasSubcategories ? ' · Todas las subcategorías' : ''}
                        {' · '}Máx: {slot.maxQty}
                      </p>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateSlot(idx, 'enabled', !slot.enabled)}
                      className={`p-2 rounded-lg transition ${slot.enabled ? 'text-compucity-green hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}
                      title={slot.enabled ? 'Desactivar' : 'Activar'}
                    >
                      {slot.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => removeSlot(idx)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded edit row */}
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">Nombre</Label>
                    <Input
                      value={slot.label}
                      onChange={e => updateSlot(idx, 'label', e.target.value)}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Categoría</Label>
                    <Select
                      value={slot.categorySlug}
                      onValueChange={v => {
                        // Clear subcategory filter when changing category
                        const newSlots = [...slots]
                        const updated = { ...newSlots[idx], categorySlug: v }
                        delete updated.includedSubcategorySlugs
                        newSlots[idx] = updated
                        setSlots(newSlots)
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {enabledCategories.map(c => (
                          <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Ícono</Label>
                    <Select value={slot.icon} onValueChange={v => updateSlot(idx, 'icon', v)}>
                      <SelectTrigger className="h-8 text-sm mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Máx. cantidad</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={slot.maxQty}
                      onChange={e => updateSlot(idx, 'maxQty', Math.max(1, parseInt(e.target.value) || 1))}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div className="flex items-center gap-4 col-span-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={slot.required}
                        onCheckedChange={v => updateSlot(idx, 'required', v)}
                      />
                      <Label className="text-sm">Obligatorio</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={slot.enabled}
                        onCheckedChange={v => updateSlot(idx, 'enabled', v)}
                      />
                      <Label className="text-sm">Visible</Label>
                    </div>
                  </div>
                </div>

                {/* Subcategory filter — only shown when the category has subcategories */}
                {hasSubcategories && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs text-gray-500 flex items-center gap-1">
                        <Filter className="w-3 h-3" />
                        Subcategorías incluidas
                      </Label>
                      {hasSubcategoryFilter && (
                        <button
                          onClick={() => clearSubcategoryFilter(idx)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Seleccionar todas
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mb-2">
                      {hasSubcategoryFilter
                        ? 'Solo se mostrarán productos de las subcategorías seleccionadas.'
                        : 'Sin seleccionar = se incluyen todas las subcategorías (comportamiento por defecto).'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {subcategories.map(sub => {
                        const isSelected = slot.includedSubcategorySlugs?.includes(sub.slug) ?? false
                        return (
                          <button
                            key={sub.id}
                            onClick={() => toggleSubcategory(idx, sub.slug)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                              isSelected
                                ? 'bg-compucity-green-50 text-compucity-green border-compucity-green-200'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {sub.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Add new slot */}
      {showAddForm ? (
        <Card className="mb-6 border-compucity-green-200 bg-compucity-green-50/30">
          <CardContent className="p-4">
            <h3 className="font-medium text-gray-900 mb-3">Agregar nuevo slot</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Key (identificador único)</Label>
                <Input
                  value={newSlotKey}
                  onChange={e => setNewSlotKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="ej: webcam"
                  className="h-8 text-sm mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Nombre visible</Label>
                <Input
                  value={newSlotLabel}
                  onChange={e => setNewSlotLabel(e.target.value)}
                  placeholder="ej: Webcam"
                  className="h-8 text-sm mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Categoría</Label>
                <Select value={newSlotCategory} onValueChange={setNewSlotCategory}>
                  <SelectTrigger className="h-8 text-sm mt-1">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledCategories.map(c => (
                      <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={addNewSlot} disabled={!newSlotKey || !newSlotLabel || !newSlotCategory}>
                Agregar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancelar
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Nota: los slots nuevos tendrán filtros básicos. Los filtros avanzados (inclusión/exclusión, compatibilidad) 
              se configuran en el código para los slots estándar. Si necesitás filtros avanzados para un slot nuevo, 
              consultá con el desarrollador. Podrás elegir subcategorías después de crear el slot.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)} className="mb-6">
          <Plus className="w-4 h-4 mr-1" />
          Agregar slot
        </Button>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button
          onClick={save}
          disabled={saving}
          className="bg-compucity-green hover:bg-compucity-green-dark text-white"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Guardar configuración
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowResetDialog(true)}
          className="text-red-600 hover:text-red-700"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Restaurar por defecto
        </Button>
      </div>

      {/* Info box */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <h4 className="text-sm font-medium text-amber-800 mb-1">Importante</h4>
        <ul className="text-xs text-amber-700 space-y-1">
          <li>• Los filtros avanzados (inclusión/exclusión de productos, compatibilidad socket/DDR) están en el código y aplican solo a los slots estándar.</li>
          <li>• Los slots nuevos usan la categoría completa sin filtrado avanzado. Si un slot necesita filtros, hay que agregarlos en el código.</li>
          <li>• Al desactivar un slot, ya no aparece en la página &quot;Arma tu PC&quot; pero sus filtros siguen existiendo en el código.</li>
          <li>• <b>Subcategorías:</b> si seleccionás subcategorías específicas, solo se mostrarán productos de esas subcategorías. Sin seleccionar = todas.</li>
          <li>• &quot;Restaurar por defecto&quot; elimina la configuración personalizada y vuelve a los 13 slots originales.</li>
        </ul>
      </div>

      {/* Reset confirmation dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar valores por defecto</AlertDialogTitle>
            <AlertDialogDescription>
              Esto eliminará la configuración personalizada y volverá a los 13 slots originales. Los cambios no guardados se perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={resetToDefaults} className="bg-red-600 hover:bg-red-700">
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
