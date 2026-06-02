'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Laptop, Cpu, Mouse, Monitor, Computer, Cable, Printer, Wifi, HardDrive, Briefcase, LucideIcon, ArrowRight } from 'lucide-react'

interface Category {
  id: string
  name: string
  slug: string
  parentId: string | null
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'notebooks': Laptop,
  'pc-armadas': Computer,
  'componentes-de-pc': Cpu,
  'monitores': Monitor,
  'perifericos': Mouse,
  'impresion': Printer,
  'conectividad-y-redes': Wifi,
  'almacenamiento-externo': HardDrive,
  'accesorios': Briefcase,
}

const DEFAULT_ICON = Cable

export default function CategoryIcons() {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await fetch('/api/categories')
        const data = await res.json()
        if (data.ok && data.categories && (data.categories as Category[]).length > 0) {
          const parents = (data.categories as Category[]).filter((c: Category) => !c.parentId)
          setCategories(parents)
        } else {
          try {
            await fetch('/api/admin/init-categories', { method: 'POST' })
            const res2 = await fetch('/api/categories')
            const data2 = await res2.json()
            if (data2.ok && data2.categories) {
              const parents = (data2.categories as Category[]).filter((c: Category) => !c.parentId)
              setCategories(parents)
            }
          } catch {}
        }
      } catch (error) {
        console.error('Error loading categories:', error)
      }
    }
    loadCategories()
  }, [])

  const displayCategories = categories.length > 0 ? categories : [
    { name: 'Notebooks', slug: 'notebooks', icon: Laptop },
    { name: 'Componentes', slug: 'componentes-de-pc', icon: Cpu },
    { name: 'Periféricos', slug: 'perifericos', icon: Mouse },
    { name: 'Monitores', slug: 'monitores', icon: Monitor },
    { name: 'PC Armadas', slug: 'pc-armadas', icon: Computer },
    { name: 'Accesorios', slug: 'accesorios', icon: Briefcase },
  ]

  return (
    <section className="py-10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 bg-compucity-green-400 rounded-full" />
            <h2 className="text-2xl font-bold text-compucity-green-900">Explorá por Categoría</h2>
          </div>
          <Link href="/categoria/todos" className="hidden sm:inline-flex items-center gap-1 text-sm text-compucity-green-600 hover:text-compucity-green-800 font-semibold group transition">
            Ver todas <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {displayCategories.map((cat) => {
            const slug = cat.slug
            const Icon = 'icon' in cat ? cat.icon : (CATEGORY_ICONS[slug] || DEFAULT_ICON)
            const catId = 'id' in cat ? cat.id : slug

            return (
              <Link
                key={catId}
                href={`/categoria/${slug}`}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-compucity-green-100 hover:border-compucity-green-400 card-hover group shadow-sm"
              >
                <div className="p-3 rounded-xl bg-compucity-green-50 group-hover:bg-compucity-green-600 transition-colors duration-200">
                  <Icon className="h-5 w-5 text-compucity-green-600 group-hover:text-white transition-colors duration-200" />
                </div>
                <span className="text-xs font-semibold text-compucity-green-800 group-hover:text-compucity-green-600 text-center transition-colors line-clamp-2">
                  {cat.name}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
