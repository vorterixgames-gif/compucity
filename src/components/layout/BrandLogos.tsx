'use client'

import FadeIn from '@/components/ui-custom/FadeIn'
import Image from 'next/image'

interface Brand {
  name: string
  slug: string
  logoWidth: number
  logoHeight: number
}

// SimpleIcons CDN - real brand logo SVGs
// Format: https://cdn.simpleicons.org/{slug}/{color}
const BRANDS: Brand[] = [
  { name: 'AMD', slug: 'amd', logoWidth: 80, logoHeight: 24 },
  { name: 'Intel', slug: 'intel', logoWidth: 60, logoHeight: 40 },
  { name: 'NVIDIA', slug: 'nvidia', logoWidth: 80, logoHeight: 28 },
  { name: 'Kingston', slug: 'kingstontechnology', logoWidth: 90, logoHeight: 20 },
  { name: 'Corsair', slug: 'corsair', logoWidth: 80, logoHeight: 24 },
  { name: 'ASUS', slug: 'asus', logoWidth: 70, logoHeight: 28 },
  { name: 'Samsung', slug: 'samsung', logoWidth: 80, logoHeight: 26 },
  { name: 'Seagate', slug: 'seagate', logoWidth: 70, logoHeight: 26 },
]

export default function BrandLogos() {
  return (
    <FadeIn>
      <section className="py-10 bg-compucity-green-50/50 border-y border-compucity-green-100/50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-center text-lg md:text-xl font-semibold text-compucity-green-800 mb-8">
            Trabajamos con las mejores marcas
          </h2>

          {/* Mobile: horizontal scroll */}
          <div className="md:hidden flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
            {BRANDS.map((brand) => (
              <div
                key={brand.name}
                className="flex-shrink-0 w-28 h-16 rounded-xl border border-compucity-green-100 bg-white flex items-center justify-center px-3 transition-all duration-300 hover:border-compucity-green-400 hover:shadow-md cursor-default select-none group"
              >
                <Image
                  src={`https://cdn.simpleicons.org/${brand.slug}/9ca3af`}
                  alt={brand.name}
                  width={brand.logoWidth}
                  height={brand.logoHeight}
                  className="transition-all duration-300 group-hover:brightness-0 group-hover:invert-[40%] group-hover:sepia-[90%] group-hover:saturate-[400%] group-hover:hue-rotate-[100deg]"
                  unoptimized
                />
              </div>
            ))}
          </div>

          {/* Desktop: centered grid */}
          <div className="hidden md:grid grid-cols-4 gap-4 max-w-3xl mx-auto">
            {BRANDS.map((brand) => (
              <div
                key={brand.name}
                className="h-20 rounded-xl border border-compucity-green-100 bg-white flex items-center justify-center px-4 transition-all duration-300 hover:border-compucity-green-400 hover:shadow-md cursor-default select-none group"
              >
                <Image
                  src={`https://cdn.simpleicons.org/${brand.slug}/9ca3af`}
                  alt={brand.name}
                  width={brand.logoWidth}
                  height={brand.logoHeight}
                  className="transition-all duration-300 group-hover:brightness-0 group-hover:invert-[40%] group-hover:sepia-[90%] group-hover:saturate-[400%] group-hover:hue-rotate-[100deg]"
                  unoptimized
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </FadeIn>
  )
}
