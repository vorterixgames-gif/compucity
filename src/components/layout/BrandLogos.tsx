'use client'

import { useState, useEffect } from 'react'
import FadeIn from '@/components/ui-custom/FadeIn'
import Image from 'next/image'

interface Brand {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  logoWidth: number
  logoHeight: number
  productCount: number
}

// Fallback brands when API is not available
const FALLBACK_BRANDS: Brand[] = [
  { id: 'fb1', name: 'AMD', slug: 'amd', logoUrl: 'https://cdn.simpleicons.org/amd/9ca3af', logoWidth: 80, logoHeight: 24, productCount: 0 },
  { id: 'fb2', name: 'Intel', slug: 'intel', logoUrl: 'https://cdn.simpleicons.org/intel/9ca3af', logoWidth: 60, logoHeight: 40, productCount: 0 },
  { id: 'fb3', name: 'NVIDIA', slug: 'nvidia', logoUrl: 'https://cdn.simpleicons.org/nvidia/9ca3af', logoWidth: 80, logoHeight: 28, productCount: 0 },
  { id: 'fb4', name: 'Kingston', slug: 'kingstontechnology', logoUrl: 'https://cdn.simpleicons.org/kingstontechnology/9ca3af', logoWidth: 90, logoHeight: 20, productCount: 0 },
  { id: 'fb5', name: 'Corsair', slug: 'corsair', logoUrl: 'https://cdn.simpleicons.org/corsair/9ca3af', logoWidth: 80, logoHeight: 24, productCount: 0 },
  { id: 'fb6', name: 'ASUS', slug: 'asus', logoUrl: 'https://cdn.simpleicons.org/asus/9ca3af', logoWidth: 70, logoHeight: 28, productCount: 0 },
  { id: 'fb7', name: 'Samsung', slug: 'samsung', logoUrl: 'https://cdn.simpleicons.org/samsung/9ca3af', logoWidth: 80, logoHeight: 26, productCount: 0 },
  { id: 'fb8', name: 'Seagate', slug: 'seagate', logoUrl: 'https://cdn.simpleicons.org/seagate/9ca3af', logoWidth: 70, logoHeight: 26, productCount: 0 },
]

export default function BrandLogos() {
  const [brands, setBrands] = useState<Brand[]>(FALLBACK_BRANDS)

  useEffect(() => {
    const loadBrands = async () => {
      try {
        const res = await fetch('/api/brands')
        const data = await res.json()
        if (data.ok && data.brands && data.brands.length > 0) {
          // Show brands with the most products first, limit to top 8 for display
          const sorted = [...(data.brands as Brand[])].sort((a, b) => (b.productCount || 0) - (a.productCount || 0))
          setBrands(sorted.slice(0, 8))
        }
      } catch (error) {
        console.error('Error loading brands:', error)
      }
    }
    loadBrands()
  }, [])

  const getLogoSrc = (brand: Brand) => {
    if (brand.logoUrl) return brand.logoUrl
    return `https://cdn.simpleicons.org/${brand.slug}/9ca3af`
  }

  return (
    <FadeIn>
      <section className="py-10 bg-compucity-green-50/50 border-y border-compucity-green-100/50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-center text-lg md:text-xl font-semibold text-compucity-green-800 mb-8">
            Trabajamos con las mejores marcas
          </h2>

          {/* Mobile: horizontal scroll */}
          <div className="md:hidden flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
            {brands.map((brand) => (
              <div
                key={brand.id || brand.slug}
                className="flex-shrink-0 w-28 h-16 rounded-xl border border-compucity-green-100 bg-white flex items-center justify-center px-3 transition-all duration-300 hover:border-compucity-green-400 hover:shadow-md cursor-default select-none group"
              >
                <Image
                  src={getLogoSrc(brand)}
                  alt={brand.name}
                  width={brand.logoWidth || 80}
                  height={brand.logoHeight || 24}
                  className="transition-all duration-300 group-hover:brightness-0 group-hover:invert-[40%] group-hover:sepia-[90%] group-hover:saturate-[400%] group-hover:hue-rotate-[100deg]"
                  unoptimized
                />
              </div>
            ))}
          </div>

          {/* Desktop: centered grid */}
          <div className="hidden md:grid grid-cols-4 gap-4 max-w-3xl mx-auto">
            {brands.map((brand) => (
              <div
                key={brand.id || brand.slug}
                className="h-20 rounded-xl border border-compucity-green-100 bg-white flex items-center justify-center px-4 transition-all duration-300 hover:border-compucity-green-400 hover:shadow-md cursor-default select-none group"
              >
                <Image
                  src={getLogoSrc(brand)}
                  alt={brand.name}
                  width={brand.logoWidth || 80}
                  height={brand.logoHeight || 24}
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
