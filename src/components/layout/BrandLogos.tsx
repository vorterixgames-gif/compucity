'use client'

import FadeIn from '@/components/ui-custom/FadeIn'

interface Brand {
  name: string
  svg: React.ReactNode
}

const BRANDS: Brand[] = [
  {
    name: 'AMD',
    svg: (
      <svg viewBox="0 0 120 40" className="h-8 w-auto" fill="currentColor">
        <path d="M8 4h8l4 8 4-8h8v24h-7V16l-5 9-5-9v12H8V4zm28 0h7v24h-7V4zm12 0h8l8 14V4h7v24h-8L55 14v14h-7V4z"/>
      </svg>
    ),
  },
  {
    name: 'Intel',
    svg: (
      <svg viewBox="0 0 120 40" className="h-8 w-auto" fill="currentColor">
        <path d="M10 8h6v4h-6V8zm0 7h6v17h-6V15zm10-7h6v4h-6V8zm0 7h6v17h-6V15zm10 0h6v2.5c1.5-2 3.5-3 6-3 5 0 8 3.5 8 9s-3 9.5-8 9.5c-2.5 0-4.5-1-6-3V32h-6V15zm6 9c0 2.5 1.5 4 3.5 4s3.5-1.5 3.5-4-1.5-4-3.5-4-3.5 1.5-3.5 4zm22-9h6v2.5c1.5-2 3.5-3 6-3 5 0 8 3.5 8 9s-3 9.5-8 9.5c-2.5 0-4.5-1-6-3V32h-6V15zm6 9c0 2.5 1.5 4 3.5 4s3.5-1.5 3.5-4-1.5-4-3.5-4-3.5 1.5-3.5 4z"/>
      </svg>
    ),
  },
  {
    name: 'NVIDIA',
    svg: (
      <svg viewBox="0 0 120 40" className="h-8 w-auto" fill="currentColor">
        <path d="M48 8l-8 14 8 14h12l8-14-8-14H48zm2 4h7l5 10-5 10h-7l-5-10 5-10zm18-4h7v4h-7V8zm0 7h7v17h-7V15zm12 0h6v3c1-2 3-3.5 5.5-3.5 3.5 0 6 2.5 6 7V32h-7V23c0-2-1-3-2.5-3s-2.5 1-2.5 3v9h-6V15z"/>
      </svg>
    ),
  },
  {
    name: 'Kingston',
    svg: (
      <svg viewBox="0 0 120 40" className="h-8 w-auto" fill="currentColor">
        <path d="M5 6h12c4 0 7 2 7 6 0 2.5-1 4-3 5 3 1 4.5 3 4.5 6 0 4.5-3.5 7-8 7H5V6zm7 9h4c2 0 3-1 3-2.5S18 10 16 10h-4v5zm0 4v7h5c2 0 3.5-1.5 3.5-3.5S19 19 17 19h-5zm20-13h7v24h-7V6zm12 0h7l7 12V6h7v24h-7l-7-12v12h-7V6z"/>
      </svg>
    ),
  },
  {
    name: 'Corsair',
    svg: (
      <svg viewBox="0 0 120 40" className="h-8 w-auto" fill="currentColor">
        <path d="M8 8h6l5 8 5-8h6v24h-6V18l-5 8-5-8v14H8V8zm30 12c0-7 5-12.5 12-12.5S62 13 62 20s-5 12.5-12 12.5S38 27 38 20zm6 0c0 4 2.5 6.5 6 6.5s6-2.5 6-6.5-2.5-6.5-6-6.5-6 2.5-6 6.5zm20-12h7l6 14 6-14h7v24h-6V18l-5 12h-4l-5-12v14h-6V8z"/>
      </svg>
    ),
  },
  {
    name: 'ASUS',
    svg: (
      <svg viewBox="0 0 120 40" className="h-8 w-auto" fill="currentColor">
        <path d="M4 28h8V16l6 12h4l6-12v12h8V10h-9l-5 10-5-10H4v18zm36 0h7V10h-7v18zm10-9c0-5.5 4-9.5 10-9.5 4 0 7 2 8.5 5l-5.5 3c-.5-1.5-1.5-2.5-3-2.5-2 0-3.5 1.5-3.5 4s1.5 4 3.5 4c1.5 0 2.5-1 3-2.5l5.5 3c-1.5 3-4.5 5-8.5 5-6 0-10-4-10-9.5zm22 9h7V10h-7v18zm10 0h7V18l8 10h6V10h-7v10l-8-10h-6v18z"/>
      </svg>
    ),
  },
  {
    name: 'Logitech',
    svg: (
      <svg viewBox="0 0 120 40" className="h-8 w-auto" fill="currentColor">
        <path d="M8 8c0-2 1.5-4 4-4h6v6h-4v20h8V10h-4V4h10v22c0 4-3 7-7 7h-9c-4 0-7-3-7-7V8zm22 2h7v20h-7V10zm12 0h6v3c1-2 3-3.5 5.5-3.5 3.5 0 6 2.5 6 7V30h-7V21c0-2-1-3-2.5-3s-2.5 1-2.5 3v9h-6V10zm25 0h7v20h-7V10zm12 0h6v3c1.5-2.5 3.5-3.5 6-3.5v6h-2c-2.5 0-4 1.5-4 4v10.5h-6V10z"/>
      </svg>
    ),
  },
  {
    name: 'Samsung',
    svg: (
      <svg viewBox="0 0 120 40" className="h-8 w-auto" fill="currentColor">
        <path d="M6 12c0-3 3-6 10-6s10 3 10 6v16h-7V13c0-1.5-1-3-3-3s-3 1.5-3 3v15H6V12zm22-4h7v20h-7V8zm12 0h7v3c1.5-2.5 3.5-3.5 6.5-3.5 4.5 0 7 3 7 8v12.5h-7V17c0-2-1-3.5-3-3.5s-3 1.5-3 3.5v11h-7V8zm30 4h-5v5h5v5c0 2 1.5 3.5 3.5 3.5h5.5v-5h-2V17h2v-5h-2V8h-7v4z"/>
      </svg>
    ),
  },
  {
    name: 'Western Digital',
    svg: (
      <svg viewBox="0 0 120 40" className="h-7 w-auto" fill="currentColor">
        <path d="M4 8h4l4 14 4-14h4l4 14 4-14h4l-6 24h-4l-4-13-4 13H8L4 8zm28 0h7v24h-7V8zm12 0h7v3c1.5-2.5 3.5-3.5 6-3.5 4.5 0 7.5 3.5 7.5 9s-3 9-7.5 9c-2.5 0-4.5-1-6-3.5v12h-7V8zm7 9c0 2.5 1.5 4 3.5 4s3.5-1.5 3.5-4-1.5-4-3.5-4-3.5 1.5-3.5 4z"/>
      </svg>
    ),
  },
  {
    name: 'Seagate',
    svg: (
      <svg viewBox="0 0 120 40" className="h-8 w-auto" fill="currentColor">
        <path d="M6 20c0-7 5-12.5 12-12.5 4.5 0 8 2 10 5.5l-5.5 3c-1-2-2.5-3-4.5-3-3 0-5.5 2.5-5.5 6.5s2.5 6.5 5.5 6.5c2 0 3.5-1 4.5-3l5.5 3c-2 3.5-5.5 5.5-10 5.5C11 32.5 6 27 6 20zm25-12h7v24h-7V8zm12 12c0-7 5-12.5 12-12.5S67 13 67 20s-5 12.5-12 12.5S43 27 43 20zm6 0c0 4 2.5 6.5 6 6.5s6-2.5 6-6.5-2.5-6.5-6-6.5-6 2.5-6 6.5z"/>
      </svg>
    ),
  },
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
          <div className="md:hidden flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
            {BRANDS.map((brand) => (
              <div
                key={brand.name}
                className="flex-shrink-0 w-28 h-16 rounded-xl border border-gray-200 bg-white flex items-center justify-center px-4 transition-all duration-300 hover:border-compucity-green/30 hover:shadow-md cursor-default select-none group"
              >
                <div className="text-gray-300 group-hover:text-compucity-green transition-colors duration-300">
                  {brand.svg}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: centered grid */}
          <div className="hidden md:grid grid-cols-5 gap-4 max-w-3xl mx-auto">
            {BRANDS.map((brand) => (
              <div
                key={brand.name}
                className="h-20 rounded-xl border border-gray-200 bg-white flex items-center justify-center px-5 transition-all duration-300 hover:border-compucity-green/30 hover:shadow-md cursor-default select-none group"
              >
                <div className="text-gray-300 group-hover:text-compucity-green transition-colors duration-300">
                  {brand.svg}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </FadeIn>
  )
}
