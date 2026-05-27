'use client'

import { useState } from 'react'

interface ProductTabsProps {
  description: string | null
  specs: Record<string, string>
}

const TABS = [
  { key: 'description', label: 'Descripción' },
  { key: 'specs', label: 'Especificaciones' },
  { key: 'shipping', label: 'Envío y pago' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function ProductTabs({ description, specs }: ProductTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('description')
  const hasSpecs = Object.keys(specs).length > 0

  return (
    <div>
      {/* Tab Headers - horizontal scrollable on mobile */}
      <div className="flex overflow-x-auto border-b border-gray-200 scrollbar-thin -mb-px">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative shrink-0 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'text-compucity-green'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {/* Active tab green underline indicator */}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-compucity-green rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content with fade-in transition */}
      <div className="mt-4 min-h-[80px]">
        {activeTab === 'description' && (
          <div
            key="description"
            className="animate-fade-in text-gray-600 leading-relaxed"
          >
            {description ? (
              <p>{description}</p>
            ) : (
              <p className="text-gray-400 italic">Sin descripción disponible.</p>
            )}
          </div>
        )}

        {activeTab === 'specs' && (
          <div
            key="specs"
            className="animate-fade-in"
          >
            {hasSpecs ? (
              <div className="border rounded-lg overflow-hidden">
                {Object.entries(specs).map(([key, value], i) => (
                  <div
                    key={key}
                    className={`flex ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                  >
                    <div className="w-1/3 px-4 py-2.5 text-sm font-medium text-gray-700">
                      {key}
                    </div>
                    <div className="w-2/3 px-4 py-2.5 text-sm text-gray-600">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 italic">Sin especificaciones disponibles.</p>
            )}
          </div>
        )}

        {activeTab === 'shipping' && (
          <div
            key="shipping"
            className="animate-fade-in text-gray-600 leading-relaxed"
          >
            <p>
              Envíos a todo el país por Andreani o Correo Argentino. Pago en
              efectivo o transferencia bancaria con descuento especial. Hacé tu
              pedido por WhatsApp y te asesoramos.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
