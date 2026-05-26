'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { MapPin, Phone, Mail, MessageCircle, ArrowUp } from 'lucide-react'
import CompucityLogo from '@/components/ui-custom/CompucityLogo'

interface Category {
  id: string
  name: string
  slug: string
  parentId: string | null
}

export default function Footer() {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch('/api/categories')
        const data = await res.json()
        if (data.ok && data.categories && (data.categories as Category[]).length > 0) {
          const parents = (data.categories as Category[])
            .filter((c: Category) => !c.parentId)
            .slice(0, 6)
          setCategories(parents)
        } else {
          try {
            await fetch('/api/admin/init-categories', { method: 'POST' })
            const res2 = await fetch('/api/categories')
            const data2 = await res2.json()
            if (data2.ok && data2.categories) {
              const parents = (data2.categories as Category[])
                .filter((c: Category) => !c.parentId)
                .slice(0, 6)
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

  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Green accent line */}
      <div className="h-1 bg-compucity-green" />

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand - Logo grande */}
          <div>
            <div className="mb-5">
              <CompucityLogo variant="full" size="lg" whiteText />
            </div>
            <p className="text-sm text-gray-400 mb-5 leading-relaxed">
              Tu tienda online de informática, componentes y más.
              Envíos a todo el país desde La Falda, Córdoba.
            </p>
            <a
              href="https://wa.me/5493517656918?text=Hola!%20Quisiera%20hacer%20una%20consulta"
              target="_blank"
              className="inline-flex items-center gap-2 bg-compucity-green/15 hover:bg-compucity-green/25 border border-compucity-green/30 rounded-lg px-4 py-2.5 transition group"
            >
              <MessageCircle className="h-4 w-4 text-compucity-green" />
              <span className="text-sm font-semibold text-compucity-green">WhatsApp</span>
            </a>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-white font-bold text-sm mb-5">Categorías</h3>
            <ul className="space-y-2">
              {categories.map((cat) => (
                <li key={cat.slug}>
                  <Link href={`/categoria/${cat.slug}`} className="text-sm text-gray-400 hover:text-compucity-green transition">
                    {cat.name}
                  </Link>
                </li>
              ))}
              {categories.length === 0 && (
                <li>
                  <Link href="/categoria/todos" className="text-sm text-gray-400 hover:text-compucity-green transition">
                    Todos los productos
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* Info */}
          <div>
            <h3 className="text-white font-bold text-sm mb-5">Información</h3>
            <ul className="space-y-2">
              <li><Link href="/arma-tu-pc" className="text-sm text-gray-400 hover:text-compucity-green transition">Arma tu PC</Link></li>
              <li><Link href="/contacto" className="text-sm text-gray-400 hover:text-compucity-green transition">Contacto</Link></li>
              <li><Link href="/mis-pedidos" className="text-sm text-gray-400 hover:text-compucity-green transition">Mis Pedidos</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-bold text-sm mb-5">Contacto</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5 text-sm text-gray-400">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-gray-500" />
                La Falda, Valle de Punilla, Córdoba
              </li>
              <li className="flex items-center gap-2.5 text-sm text-gray-400">
                <Phone className="h-4 w-4 shrink-0 text-gray-500" />
                <a href="tel:3517656918" className="hover:text-compucity-green transition">3517656918</a>
              </li>
              <li className="flex items-center gap-2.5 text-sm text-gray-400">
                <Mail className="h-4 w-4 shrink-0 text-gray-500" />
                <a href="mailto:info@compucity.com.ar" className="hover:text-compucity-green transition">info@compucity.com.ar</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">© {new Date().getFullYear()} Compucity. Todos los derechos reservados.</p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-compucity-green font-medium">Tu Mundo Digital</span>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="p-1.5 rounded-md bg-gray-800 hover:bg-compucity-green/20 text-gray-500 hover:text-compucity-green transition"
              aria-label="Volver arriba"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
