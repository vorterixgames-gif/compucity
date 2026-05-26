import CategoryIcons from '@/components/layout/CategoryIcons'
import BrandLogos from '@/components/layout/BrandLogos'
import ProductCard from '@/components/ui-custom/ProductCard'
import HeroSection from '@/components/ui-custom/HeroSection'
import { getFeaturedProducts, getAllActiveProducts } from '@/lib/queries'
import Link from 'next/link'
import { Truck, Shield, MessageCircle, Headphones, ArrowRight, Cpu } from 'lucide-react'

export const dynamic = 'force-dynamic'

function safeParseFirstImage(images: string | null): string | null {
  if (!images) return null
  try { return JSON.parse(images)[0] } catch { return null }
}

export default async function HomePage() {
  let featured: any[] = []
  let allProducts: any[] = []

  try {
    [featured, allProducts] = await Promise.all([
      getFeaturedProducts(),
      getAllActiveProducts(),
    ])
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
      <section className="bg-compucity-green-50 border-y border-compucity-green/10">
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
                    <Icon className="h-5 w-5 text-compucity-green" />
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

      {/* Featured Products */}
      {featured.length > 0 && (
        <section className="py-10">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Productos Destacados</h2>
              <Link href="/categoria/todos" className="inline-flex items-center gap-1 text-sm text-compucity-green hover:text-compucity-green-dark font-semibold group transition">
                Ver todos <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {featured.map((product) => (
                <ProductCard key={product.id} id={product.id} name={product.name} slug={product.slug} price={product.price} comparePrice={product.comparePrice} image={safeParseFirstImage(product.images)} stock={product.stock} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* All Products */}
      <section className="py-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Nuestros Productos</h2>
            <Link href="/categoria/todos" className="inline-flex items-center gap-1 text-sm text-compucity-green hover:text-compucity-green-dark font-semibold group transition">
              Ver todos <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          {allProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {allProducts.map((product) => (
                <ProductCard key={product.id} id={product.id} name={product.name} slug={product.slug} price={product.price} comparePrice={product.comparePrice} image={safeParseFirstImage(product.images)} stock={product.stock} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-compucity-green-50 rounded-2xl border border-compucity-green/10">
              <div className="w-16 h-16 rounded-full bg-compucity-green/10 flex items-center justify-center mx-auto mb-5">
                <Cpu className="h-8 w-8 text-compucity-green/30" />
              </div>
              <p className="text-gray-700 text-lg mb-2 font-semibold">Próximamente productos</p>
              <p className="text-gray-400 text-sm mb-6">Estamos cargando el catálogo. Volvé pronto.</p>
              <Link href="https://wa.me/5493517656918?text=Hola!%20Quiero%20consultar%20por%20un%20producto" target="_blank" className="inline-flex items-center gap-2 px-6 py-2.5 bg-compucity-green hover:bg-compucity-green-dark text-white text-sm font-semibold rounded-lg transition">
                <MessageCircle className="h-4 w-4" /> Consultar por WhatsApp
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ==========================================
          CTA - Claro con acento verde
          ========================================== */}
      <section className="bg-compucity-green-dark">
        <div className="max-w-7xl mx-auto px-4 py-14 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3 text-white">
            ¿No encontrás lo que buscás?
          </h2>
          <p className="text-white/70 mb-8 max-w-md mx-auto">Contactanos por WhatsApp y te conseguimos lo que necesitás al mejor precio</p>
          <a
            href="https://wa.me/5493517656918?text=Hola!%20Busco%20un%20producto%20que%20no%20vi%20en%20la%20tienda"
            target="_blank"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white hover:bg-gray-100 text-compucity-green-dark font-bold rounded-lg transition-all duration-200"
          >
            <MessageCircle className="h-5 w-5" />
            Consultar por WhatsApp
          </a>
        </div>
      </section>
    </div>
  )
}
