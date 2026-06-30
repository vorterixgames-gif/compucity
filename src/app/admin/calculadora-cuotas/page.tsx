'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Plus, Save, Calculator, Loader2 } from 'lucide-react'

interface InstallmentPlan {
  id: string
  method: string
  installments: number
  surcharge: number  // porcentaje de recargo
}

// Planes preconfigurados por defecto — el dueño los puede editar/borrar después
const DEFAULT_PLANS: InstallmentPlan[] = [
  { id: 'efectivo', method: 'Efectivo', installments: 1, surcharge: 0 },
  { id: 'naranja-3', method: 'Naranja X', installments: 3, surcharge: 0 },
  { id: 'naranja-6', method: 'Naranja X', installments: 6, surcharge: 15 },
  { id: 'naranja-9', method: 'Naranja X', installments: 9, surcharge: 25 },
  { id: 'naranja-12', method: 'Naranja X', installments: 12, surcharge: 35 },
  { id: 'visa-3', method: 'Visa', installments: 3, surcharge: 5 },
  { id: 'visa-6', method: 'Visa', installments: 6, surcharge: 20 },
  { id: 'visa-12', method: 'Visa', installments: 12, surcharge: 40 },
  { id: 'master-3', method: 'Mastercard', installments: 3, surcharge: 5 },
  { id: 'master-6', method: 'Mastercard', installments: 6, surcharge: 18 },
  { id: 'master-12', method: 'Mastercard', installments: 12, surcharge: 38 },
  { id: 'mp-3', method: 'MercadoPago', installments: 3, surcharge: 10 },
  { id: 'mp-6', method: 'MercadoPago', installments: 6, surcharge: 25 },
  { id: 'mp-12', method: 'MercadoPago', installments: 12, surcharge: 45 },
]

const formatPrice = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

// CFT anual aproximado: recargo × (12/cuotas) × 1.5
// No es la fórmula exacta del BCRA, pero da una idea del costo financiero real
function calculateCFT(surcharge: number, installments: number): number {
  if (installments <= 1 || surcharge === 0) return 0
  // Fórmula aproximada de tasa nominal anual convertida a efectiva
  // TNA = recargo × (12 / cuotas)
  // CFT ≈ (1 + TNA/100)^1 - 1 (aproximación simple)
  const tna = surcharge * (12 / installments)
  const cft = Math.round((Math.pow(1 + tna / 100, 1) - 1) * 100)
  return cft
}

export default function CalculadoraCuotasPage() {
  const [plans, setPlans] = useState<InstallmentPlan[]>(DEFAULT_PLANS)
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // Cargar planes guardados al montar
  useEffect(() => {
    const loadPlans = async () => {
      try {
        const res = await fetch('/api/admin/config')
        const data = await res.json()
        if (data.ok && data.config?.installment_plans) {
          try {
            const saved = JSON.parse(data.config.installment_plans)
            if (Array.isArray(saved) && saved.length > 0) {
              setPlans(saved)
            }
          } catch {}
        }
      } catch (e) {
        console.error('Error cargando planes:', e)
      } finally {
        setLoading(false)
      }
    }
    loadPlans()
  }, [])

  // Guardar planes en store_config
  const handleSavePlans = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configs: {
            installment_plans: JSON.stringify(plans),
          },
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setMessage('Planes guardados correctamente')
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage('Error al guardar: ' + (data.error || 'desconocido'))
      }
    } catch (e: any) {
      setMessage('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // Agregar plan nuevo
  const handleAddPlan = () => {
    const newPlan: InstallmentPlan = {
      id: `plan-${Date.now()}`,
      method: 'Nuevo',
      installments: 1,
      surcharge: 0,
    }
    setPlans([...plans, newPlan])
  }

  // Eliminar plan
  const handleDeletePlan = (id: string) => {
    setPlans(plans.filter(p => p.id !== id))
  }

  // Actualizar campo de un plan
  const handleUpdatePlan = (id: string, field: keyof InstallmentPlan, value: string | number) => {
    setPlans(plans.map(p => {
      if (p.id !== id) return p
      if (field === 'installments' || field === 'surcharge') {
        return { ...p, [field]: Number(value) || 0 }
      }
      return { ...p, [field]: value }
    }))
  }

  // Precio para cálculo
  const priceNum = parseFloat(price.replace(/[^0-9.]/g, '')) || 0

  // Agrupar planes por medio de pago para mostrarlos ordenados
  const methods = Array.from(new Set(plans.map(p => p.method))).sort()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Calculator className="w-6 h-6 text-compucity-green" />
          Calculadora de Cuotas
        </h1>
        <Button onClick={handleSavePlans} className="bg-compucity-green hover:bg-compucity-green-dark" disabled={saving}>
          {saving ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>) : (<><Save className="w-4 h-4 mr-2" />Guardar planes</>)}
        </Button>
      </div>

      {message && (
        <div className={`p-3 rounded-md text-sm ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna izquierda: Calculadora */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Calcular cuotas</CardTitle>
            <CardDescription>Ingresá el precio para ver todas las opciones de cuotas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="price">Precio ($)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="100000"
                className="text-lg font-semibold"
              />
            </div>

            {priceNum > 0 ? (
              <div className="space-y-3">
                {methods.map(method => {
                  const methodPlans = plans.filter(p => p.method === method).sort((a, b) => a.installments - b.installments)
                  return (
                    <div key={method} className="border border-gray-200 rounded-lg p-3">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">{method}</h4>
                      <div className="space-y-1">
                        {methodPlans.map(plan => {
                          const total = priceNum * (1 + plan.surcharge / 100)
                          const cuota = total / plan.installments
                          const cft = calculateCFT(plan.surcharge, plan.installments)
                          return (
                            <div key={plan.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                              <div className="flex-1">
                                <span className="font-medium">{plan.installments} cuota{plan.installments > 1 ? 's' : ''}</span>
                                {plan.surcharge > 0 && (
                                  <span className="text-xs text-gray-500 ml-2">+{plan.surcharge}%</span>
                                )}
                                {plan.surcharge === 0 && plan.installments > 1 && (
                                  <span className="text-xs text-green-600 ml-2 font-semibold">SIN INTERÉS</span>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-gray-900">{formatPrice(cuota)}<span className="text-xs font-normal text-gray-500">/cuota</span></div>
                                {plan.installments > 1 && (
                                  <div className="text-xs text-gray-500">
                                    Total: {formatPrice(total)}
                                    {cft > 0 && <span className="ml-2">CFT ~{cft}%</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                Ingresá un precio para ver las opciones de cuotas
              </div>
            )}
          </CardContent>
        </Card>

        {/* Columna derecha: Configuración de planes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Planes configurados</CardTitle>
            <CardDescription>Editá los recargos según tus convenios con cada medio de pago</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="text-center py-4 text-gray-400">Cargando planes...</div>
            ) : (
              <>
                {plans.map(plan => (
                  <div key={plan.id} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      type="text"
                      value={plan.method}
                      onChange={(e) => handleUpdatePlan(plan.id, 'method', e.target.value)}
                      className="col-span-4"
                      placeholder="Medio de pago"
                    />
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min="1"
                        value={plan.installments}
                        onChange={(e) => handleUpdatePlan(plan.id, 'installments', e.target.value)}
                        placeholder="Cuotas"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={plan.surcharge}
                        onChange={(e) => handleUpdatePlan(plan.id, 'surcharge', e.target.value)}
                        placeholder="% recargo"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeletePlan(plan.id)}
                      className="col-span-2 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={handleAddPlan} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar plan
                </Button>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                  <strong>Cómo usar:</strong>
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    <li>Editá los recargos según tus convenios (ej: Naranja X 6 cuotas = 15%)</li>
                    <li>Para "sin interés", poné recargo en 0</li>
                    <li>Click "Guardar planes" para persistir los cambios</li>
                    <li>Ingresá el precio en la calculadora de la izquierda</li>
                    <li>Decile al cliente el valor de la cuota que mejor le cierre</li>
                  </ol>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                  <strong>Nota sobre el CFT:</strong> El CFT mostrado es aproximado.
                  El CFT real lo define cada medio de pago y puede variar según el banco emisor
                  de la tarjeta. Usá estos valores como referencia para informar al cliente.
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
