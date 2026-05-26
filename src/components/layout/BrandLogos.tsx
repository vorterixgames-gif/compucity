'use client'

import FadeIn from '@/components/ui-custom/FadeIn'

const BRANDS = [
  'AMD',
  'Intel',
  'NVIDIA',
  'Kingston',
  'Corsair',
  'ASUS',
  'Logitech',
  'Samsung',
  'Western Digital',
  'Seagate',
]

export default function BrandLogos() {
  return (
    <FadeIn>
      <section className="py-10 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-center text-lg md:text-xl font-semibold text-gray-700 mb-8">
            Trabajamos con las mejores marcas
          </h2>

          {/* Mobile: horizontal scroll */}
          <div className="md:hidden flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
            {BRANDS.map((brand) => (
              <div
                key={brand}
                className="flex-shrink-0 px-5 py-2.5 rounded-full border border-gray-200 bg-white text-gray-400 font-semibold text-sm tracking-wide uppercase transition-all duration-300 hover:text-gray-700 hover:border-gray-400 hover:shadow-sm cursor-default select-none"
              >
                {brand}
              </div>
            ))}
          </div>

          {/* Desktop: centered grid */}
          <div className="hidden md:flex flex-wrap justify-center gap-3">
            {BRANDS.map((brand) => (
              <div
                key={brand}
                className="px-6 py-3 rounded-full border border-gray-200 bg-white text-gray-400 font-semibold text-sm tracking-wide uppercase transition-all duration-300 hover:text-gray-700 hover:border-gray-400 hover:shadow-sm cursor-default select-none"
              >
                {brand}
              </div>
            ))}
          </div>
        </div>
      </section>
    </FadeIn>
  )
}
