'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Cpu,
  CircuitBoard,
  Zap,
  HardDrive,
  Box,
  Monitor,
  Wind,
  Droplets,
  ChevronRight,
  ChevronLeft,
  ShoppingCart,
  MessageCircle,
  Trash2,
  Plus,
  Check,
  Loader2,
  Search,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ============================================
// Types
// ============================================

interface ComponentSlot {
  slot: string
  label: string
  categorySlug: string
  count: number
  icon: React.ElementType
  required: boolean
}

interface BuilderProduct {
  id: string
  name: string
  slug: string
  price: number
  comparePrice: number | null
  costPrice: number | null
  images: string
  stock: number
  specs: string
  _calculated: boolean
}

interface SelectedComponent {
  slot: string
  product: BuilderProduct
}

// ============================================
// Slot Definitions
// ============================================

const SLOTS: { slot: string; label: string; categorySlug: string; icon: React.ElementType; required: boolean }[] = [
  { slot: 'processor', label: 'Microprocesador', categorySlug: 'microprocesadores', icon: Cpu, required: true },
  { slot: 'motherboard', label: 'Motherboard', categorySlug: 'motherboards', icon: CircuitBoard, required: true },
  { slot: 'ram', label: 'Memoria RAM', categorySlug: 'memorias-ram', icon: Zap, required: true },
  { slot: 'gpu', label: 'Placa de Video', categorySlug: 'placas-de-video', icon: Monitor, required: false },
  { slot: 'ssd', label: 'Disco SSD', categorySlug: 'discos-ssd', icon: HardDrive, required: true },
  { slot: 'hdd', label: 'Disco HDD', categorySlug: 'discos-hdd', icon: HardDrive, required: false },
  { slot: 'psu', label: 'Fuente', categorySlug: 'fuentes', icon: Zap, required: true },
  { slot: 'case', label: 'Gabinete', categorySlug: 'gabinetes', icon: Box, required: true },
  { slot: 'cooling', label: 'Refrigeración', categorySlug: 'refrigeracion', icon: Wind, required: false },
  { slot: 'thermal', label: 'Pasta Térmica', categorySlug: 'pastas-termicas', icon: Droplets, required: false },
]

// ============================================
// Helpers
// ============================================

function formatPrice(n: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function safeParseFirstImage(images: string | null): string | null {
  if (!images) return null
  try { return JSON.parse(images)[0] } catch { return null }
}

function parseSpecs(specs: string): Record<string, string> {
  try {
    return JSON.parse(specs)
  } catch {
    return {}
  }
}

// ============================================
// Main Component
// ============================================

export default function ArmaTuPCPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedComponents, setSelectedComponents] = useState<SelectedComponent[]>([])
  const [products, setProducts] = useState<BuilderProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [slotsWithCounts, setSlotsWithCounts] = useState<ComponentSlot[]>([])

  const currentSlot = SLOTS[currentStep]
  const selectedForCurrentSlot = selectedComponents.find(c => c.slot === currentSlot.slot)

  // Load slot counts on mount
  useEffect(() => {
    async function loadSlotCounts() {
      try {
        const res = await fetch('/api/pc-builder')
        const data = await res.json()
        if (data.ok && data.slots) {
          setSlotsWithCounts(
            data.slots.map((s: any) => {
              const slotDef = SLOTS.find(sl => sl.slot === s.slot)
              return {
                ...s,
                icon: slotDef?.icon || Cpu,
                required: slotDef?.required || false,
              }
            })
          )
        }
      } catch (error) {
        console.error('Error loading slot counts:', error)
      }
    }
    loadSlotCounts()
  }, [])

  // Load products when step changes
  const loadProducts = useCallback(async () => {
    setLoading(true)
    setSearch('')
    try {
      const res = await fetch(`/api/pc-builder?slot=${currentSlot.slot}`)
      const data = await res.json()
      if (data.ok) {
        setProducts(data.products || [])
      }
    } catch (error) {
      console.error('Error loading products:', error)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [currentSlot.slot])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const selectProduct = (product: BuilderProduct) => {
    setSelectedComponents(prev => {
      const filtered = prev.filter(c => c.slot !== currentSlot.slot)
      return [...filtered, { slot: currentSlot.slot, product }]
    })
  }

  const removeProduct = (slot: string) => {
    setSelectedComponents(prev => prev.filter(c => c.slot !== slot))
  }

  const totalPrice = selectedComponents.reduce((sum, c) => sum + (c.product.comparePrice || c.product.price), 0)
  const totalListPrice = selectedComponents.reduce((sum, c) => sum + c.product.price, 0)
  const completedRequired = SLOTS.filter(s => s.required).every(s => selectedComponents.some(c => c.slot === s.slot))
  const completedCount = selectedComponents.length

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const goNext = () => {
    if (currentStep < SLOTS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Generate WhatsApp message
  const buildWhatsAppUrl = () => {
    let msg = '🔧 *Quiero armar una PC a medida!*\n\n'
    selectedComponents.forEach(c => {
      const slotLabel = SLOTS.find(s => s.slot === c.slot)?.label || c.slot
      const price = c.product.comparePrice || c.product.price
      msg += `*${slotLabel}:* ${c.product.name} - ${formatPrice(price)}\n`
    })
    msg += `\n💰 *Total en efectivo:* ${formatPrice(totalPrice)}\n`
    msg += `📋 *Total de lista:* ${formatPrice(totalListPrice)}\n\n`
    msg += `Consulto por la disponibilidad y tiempo de armado. Gracias!`
    return `https://wa.me/5493517656918?text=${encodeURIComponent(msg)}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Arma tu PC a medida</h1>
          <p className="text-gray-300">Elegí los componentes y te la armamos. Envíos a todo el país.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* ============================================ */}
          {/* Left: Stepper + Product Selection */}
          {/* ============================================ */}
          <div className="flex-1">
            {/* Step Indicator - Horizontal on desktop, progress on mobile */}
            <div className="bg-white rounded-xl border p-4 mb-6 overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max">
                {SLOTS.map((slot, idx) => {
                  const Icon = slot.icon
                  const isSelected = selectedComponents.some(c => c.slot === slot.slot)
                  const isCurrent = idx === currentStep
                  return (
                    <button
                      key={slot.slot}
                      onClick={() => setCurrentStep(idx)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                        isCurrent
                          ? 'bg-compucity-green text-white shadow-md'
                          : isSelected
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {isSelected ? (
                        <Check className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="hidden sm:inline">{slot.label}</span>
                      {slot.required && !isSelected && (
                        <span className="text-[10px] text-red-400">*</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Current Step Header */}
            <div className="bg-white rounded-xl border p-5 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-compucity-green-100 text-compucity-green flex items-center justify-center">
                    {(() => { const Icon = currentSlot.icon; return <Icon className="h-5 w-5" /> })()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {currentSlot.label}
                      {currentSlot.required && <span className="text-red-500 ml-1">*</span>}
                    </h2>
                    <p className="text-sm text-gray-500">
                      Paso {currentStep + 1} de {SLOTS.length}
                      {!currentSlot.required && ' · Opcional'}
                    </p>
                  </div>
                </div>
                {selectedForCurrentSlot && (
                  <button
                    onClick={() => removeProduct(currentSlot.slot)}
                    className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                    Quitar
                  </button>
                )}
              </div>

              {/* Currently selected for this slot */}
              {selectedForCurrentSlot && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-900 truncate">{selectedForCurrentSlot.product.name}</p>
                    <p className="text-xs text-green-700">
                      Efectivo: {formatPrice(selectedForCurrentSlot.product.comparePrice || selectedForCurrentSlot.product.price)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder={`Buscar ${currentSlot.label.toLowerCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Product List */}
            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-16 bg-white rounded-xl border">
                  <Loader2 className="w-8 h-8 animate-spin text-compucity-green" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border">
                  <Cpu className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 mb-1">No hay productos disponibles</p>
                  <p className="text-sm text-gray-400">
                    {products.length === 0
                      ? 'Próximamente agregaremos productos de esta categoría'
                      : 'No se encontraron resultados para tu búsqueda'}
                  </p>
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const isSelected = selectedForCurrentSlot?.product.id === product.id
                  const image = safeParseFirstImage(product.images)
                  const specs = parseSpecs(product.specs)
                  const specEntries = Object.entries(specs).slice(0, 4)

                  return (
                    <button
                      key={product.id}
                      onClick={() => selectProduct(product)}
                      className={`w-full text-left bg-white rounded-xl border p-4 flex items-start gap-4 transition hover:shadow-md ${
                        isSelected
                          ? 'border-compucity-green bg-compucity-green-50/50 ring-2 ring-compucity-green-100'
                          : 'border-gray-200 hover:border-compucity-green-100'
                      }`}
                    >
                      {/* Image */}
                      <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                        {image ? (
                          <img src={image} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <Cpu className="w-6 h-6" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 text-sm mb-1 line-clamp-2">{product.name}</h3>
                        {specEntries.length > 0 && (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-2">
                            {specEntries.map(([key, value]) => (
                              <span key={key} className="text-xs text-gray-500">
                                <span className="text-gray-400">{key}:</span> {value}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">Lista: {formatPrice(product.price)}</span>
                          {product.comparePrice && product.comparePrice < product.price && (
                            <span className="text-sm font-bold text-green-600">
                              Efectivo: {formatPrice(product.comparePrice)}
                            </span>
                          )}
                          {!product.comparePrice && (
                            <span className="text-sm font-bold text-gray-900">{formatPrice(product.price)}</span>
                          )}
                          {product.stock <= 0 && (
                            <span className="text-xs text-red-500 font-medium">Sin stock</span>
                          )}
                        </div>
                      </div>

                      {/* Selection indicator */}
                      <div className="shrink-0 mt-1">
                        {isSelected ? (
                          <div className="w-8 h-8 rounded-full bg-compucity-green flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center group-hover:border-compucity-cyan-light transition">
                            <Plus className="w-4 h-4 text-gray-300" />
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <Button
                variant="outline"
                onClick={goPrev}
                disabled={currentStep === 0}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>

              {currentStep < SLOTS.length - 1 ? (
                <Button onClick={goNext} className="bg-compucity-green hover:bg-compucity-green-dark gap-2">
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    if (completedRequired) {
                      window.open(buildWhatsAppUrl(), '_blank')
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 gap-2"
                  disabled={!completedRequired}
                >
                  <MessageCircle className="w-4 h-4" />
                  Enviar por WhatsApp
                </Button>
              )}
            </div>

            {/* Skip optional */}
            {!currentSlot.required && currentStep < SLOTS.length - 1 && (
              <div className="text-center mt-3">
                <button
                  onClick={goNext}
                  className="text-sm text-gray-400 hover:text-gray-600 transition"
                >
                  Saltar este paso →
                </button>
              </div>
            )}
          </div>

          {/* ============================================ */}
          {/* Right: Summary Sidebar */}
          {/* ============================================ */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="bg-white rounded-xl border lg:sticky lg:top-24">
              {/* Summary Header */}
              <div className="p-5 border-b">
                <h3 className="font-bold text-gray-900 mb-1">Tu PC a medida</h3>
                <p className="text-sm text-gray-500">{completedCount} de {SLOTS.length} componentes</p>
              </div>

              {/* Selected Components List */}
              <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
                {SLOTS.map((slot) => {
                  const selected = selectedComponents.find(c => c.slot === slot.slot)
                  const Icon = slot.icon

                  if (selected) {
                    return (
                      <div key={slot.slot} className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                        <Icon className="w-4 h-4 text-green-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-green-700 font-medium">{slot.label}</p>
                          <p className="text-xs text-green-900 truncate">{selected.product.name}</p>
                        </div>
                        <span className="text-xs font-medium text-green-700 whitespace-nowrap">
                          {formatPrice(selected.product.comparePrice || selected.product.price)}
                        </span>
                      </div>
                    )
                  }

                  return (
                    <div key={slot.slot} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <Icon className="w-4 h-4 text-gray-300 shrink-0" />
                      <span className="text-xs text-gray-400 flex-1">{slot.label}</span>
                      {slot.required && <span className="text-[10px] text-red-400">Requerido</span>}
                    </div>
                  )
                })}
              </div>

              {/* Totals */}
              <div className="p-5 border-t space-y-2">
                {totalListPrice > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Precio de lista</span>
                    <span className="text-gray-900">{formatPrice(totalListPrice)}</span>
                  </div>
                )}
                {totalPrice > 0 && totalPrice < totalListPrice && (
                  <div className="flex items-center justify-between">
                    <span className="text-green-700 font-medium">Precio en efectivo</span>
                    <span className="text-green-700 font-bold text-lg">{formatPrice(totalPrice)}</span>
                  </div>
                )}
                {totalPrice === 0 && (
                  <div className="text-center text-sm text-gray-400 py-2">
                    Seleccioná componentes para ver el total
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-5 border-t space-y-3">
                <a
                  href={completedCount > 0 ? buildWhatsAppUrl() : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm transition ${
                    completedCount > 0
                      ? 'bg-green-500 hover:bg-green-600 text-white cursor-pointer'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  onClick={(e) => { if (completedCount === 0) e.preventDefault() }}
                >
                  <MessageCircle className="w-4 h-4" />
                  Consultar por WhatsApp
                </a>

                {completedCount > 0 && (
                  <button
                    onClick={() => {
                      setSelectedComponents([])
                      setCurrentStep(0)
                    }}
                    className="w-full text-sm text-gray-400 hover:text-red-500 transition py-1"
                  >
                    Limpiar selección
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
