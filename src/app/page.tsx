import CategoryIcons from '@/components/layout/CategoryIcons'
import BrandLogos from '@/components/layout/BrandLogos'
import ProductCard from '@/components/ui-custom/ProductCard'
import HeroSection from '@/components/ui-custom/HeroSection'
import { getFeaturedProducts, getAllActiveProducts, getTopProductsByCategorySlug } from '@/lib/queries'
import { ensureMigrations } from '@/lib/db'
import Link from 'next/link'
import { Truck, Shield, MessageCircle, Headphones, ArrowRight, Cpu } from 'lucide-react'

export const dynamic = 'force-dynamic'

function safeParseFirstImage(images: string | null): string | null {
  if (!images) return null
  try { return JSON.parse(images)[0] } catch { return null }
}

export default async function HomePage() {
  // Run auto-migrations (adds shippingDetails column if missing)
  await ensureMigrations()

  let featured: any[] = []
  let allProducts: any[] = []
  let gamerPCs: any[] = []
  let monitorProducts: any[] = []
  let notebookProducts: any[] = []

  try {
    [featured, allProducts, gamerPCs, monitorProducts, notebookProducts] = await Promise.all([
      getFeaturedProducts(),
      getAllActiveProducts(),
      getTopProductsByCategorySlug('gamer-pc', 4),
      getTopProductsByCategorySlug('monitores', 4),
      getTopProductsByCategorySlug('notebooks', 12),
    ])
    // Pick 4 notebooks with brand/line variety (avoid 4 identical Legion)
    if (notebookProducts.length > 4) {
      const seen = new Set<string>()
      const diverse: any[] = []
      for (const p of notebookProducts) {
        const name = (p.name || '').toLowerCase()
        // Extract brand+line as key (e.g. "lenovo legion", "msi cyborg", "lenovo loq", "lenovo t14")
        const brandLine = name.match(/(lenovo\s\w+|msi\s\w+|asus\s\w+|hp\s\w+|dell\s\w+|acer\s\w+)/)?.[1] || name.slice(0, 20)
        if (!seen.has(brandLine)) {
          seen.add(brandLine)
          diverse.push(p)
        }
        if (diverse.length >= 4) break
      }
      notebookProducts = diverse.length >= 4 ? diverse : notebookProducts.slice(0, 4)
    }
  } catch (error) {
    console.error('Homepage data fetch error:', error)
  }

  return (
    <div>
      {/* ==========================================
          HERO - Carrusel Full-Width
          ========================================== */}
      <HeroSection />

      {/* ==========================================
          BENEFITS BAR
          ========================================== */}
      <section className="bg-compucity-navy-50 border-y border-compucity-navy/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Truck, label: 'Envíos a todo el país' },
              { icon: Shield, label: 'Compra segura' },
              { icon: MessageCircle, label: 'Pedidos por WhatsApp' },
              { icon: Headphones, label: 'Asesoramiento personalizado' },
            ].map((item, i) => {
              const Icon = item.icon
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm">
                    <Icon className="h-5 w-5 text-compucity-navy" />
                  </div>
                  <span className="text-sm text-gray-700 font-medium">{item.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Brand Logos */}
      <BrandLogos />

      {/* Category Icons */}
      <CategoryIcons />

      {/* ==========================================
          ROW 1 - PC Armadas Gamer
          ========================================== */}
      {gamerPCs.length > 0 && (
        <section className="py-10 bg-compucity-navy">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-white">PC Armadas</h2>
              <Link href="/categoria/gamer-pc" className="inline-flex items-center gap-1 text-sm text-compucity-gold-light hover:text-compucity-gold font-semibold group transition">
                Ver todas <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {gamerPCs.map((product) => (
                <ProductCard key={product.id} id={product.id} name={product.name} slug={product.slug} price={product.price} comparePrice={product.comparePrice} image={safeParseFirstImage(product.images)} stock={product.stock} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ==========================================
          ROW 2 - Monitores
          ========================================== */}
      {monitorProducts.length > 0 && (
        <section className="py-10">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Monitores</h2>
              <Link href="/categoria/monitores" className="inline-flex items-center gap-1 text-sm text-compucity-green hover:text-compucity-green-dark font-semibold group transition">
                Ver todas <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {monitorProducts.map((product) => (
                <ProductCard key={product.id} id={product.id} name={product.name} slug={product.slug} price={product.price} comparePrice={product.comparePrice} image={safeParseFirstImage(product.images)} stock={product.stock} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ==========================================
          ROW 3 - Notebooks
          ========================================== */}
      {notebookProducts.length > 0 && (
        <section className="py-10 bg-compucity-navy">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-white">Notebooks</h2>
              <Link href="/categoria/notebooks" className="inline-flex items-center gap-1 text-sm text-compucity-gold-light hover:text-compucity-gold font-semibold group transition">
                Ver todas <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {notebookProducts.map((product) => (
                <ProductCard key={product.id} id={product.id} name={product.name} slug={product.slug} price={product.price} comparePrice={product.comparePrice} image={safeParseFirstImage(product.images)} stock={product.stock} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ==========================================
          CTA - Claro con acento verde
          ========================================== */}
      <section className="bg-gradient-to-r from-compucity-green-dark via-compucity-green to-compucity-green-dark">
        <div className="max-w-7xl mx-auto px-4 py-14 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3 text-white">
            ¿No encontrás lo que buscás?
          </h2>
          <p className="text-white/70 mb-8 max-w-md mx-auto">Contactanos por WhatsApp y te conseguimos lo que necesitás al mejor precio</p>
          <a
            href="https://wa.me/5493517656918?text=Hola!%20Busco%20un%20producto%20que%20no%20vi%20en%20la%20tienda"
            target="_blank"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-compucity-gold hover:bg-compucity-gold-light text-compucity-navy font-bold rounded-lg transition-all duration-200 shadow-lg"
          >
            <MessageCircle className="h-5 w-5" />
            Consultar por WhatsApp
          </a>
        </div>
      </section>
    </div>
  )
}
