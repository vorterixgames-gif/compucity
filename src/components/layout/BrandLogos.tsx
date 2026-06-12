'use client'

import FadeIn from '@/components/ui-custom/FadeIn'

/**
 * Curated list of brands with CONFIRMED working SimpleIcons logos.
 * All slugs tested and returning HTTP 200 from cdn.simpleicons.org.
 * This avoids broken images from the dynamic API brands that don't
 * have icons on SimpleIcons (HPE, Logitech, Brother, APC, etc.)
 */
const BRANDS = [
  { name: 'Intel', slug: 'intel', width: 60, height: 40 },
  { name: 'AMD', slug: 'amd', width: 80, height: 24 },
  { name: 'NVIDIA', slug: 'nvidia', width: 80, height: 28 },
  { name: 'ASUS', slug: 'asus', width: 70, height: 28 },
  { name: 'HP', slug: 'hp', width: 50, height: 50 },
  { name: 'Samsung', slug: 'samsung', width: 80, height: 26 },
  { name: 'Kingston', slug: 'kingstontechnology', width: 90, height: 20 },
  { name: 'Corsair', slug: 'corsair', width: 80, height: 24 },
] as const

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
                key={brand.slug}
                className="flex-shrink-0 w-28 h-16 rounded-xl border border-compucity-green-100 bg-white flex items-center justify-center px-3 transition-all duration-300 hover:border-compucity-green-400 hover:shadow-md cursor-default select-none"
              >
                <img
                  src={`https://cdn.simpleicons.org/${brand.slug}/9ca3af`}
                  alt={brand.name}
                  width={brand.width}
                  height={brand.height}
                  className="opacity-70 hover:opacity-100 transition-opacity duration-300"
                  loading="lazy"
                />
              </div>
            ))}
          </div>

          {/* Desktop: centered grid */}
          <div className="hidden md:grid grid-cols-4 gap-4 max-w-3xl mx-auto">
            {BRANDS.map((brand) => (
              <div
                key={brand.slug}
                className="h-20 rounded-xl border border-compucity-green-100 bg-white flex items-center justify-center px-4 transition-all duration-300 hover:border-compucity-green-400 hover:shadow-md cursor-default select-none"
              >
                <img
                  src={`https://cdn.simpleicons.org/${brand.slug}/9ca3af`}
                  alt={brand.name}
                  width={brand.width}
                  height={brand.height}
                  className="opacity-70 hover:opacity-100 transition-opacity duration-300"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </FadeIn>
  )
}
