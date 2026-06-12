'use client'

import { useState, useEffect, useCallback } from 'react'
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
  { id: 'fb1', name: 'AMD', slug: 'amd', logoUrl: null, logoWidth: 80, logoHeight: 24, productCount: 0 },
  { id: 'fb2', name: 'Intel', slug: 'intel', logoUrl: null, logoWidth: 60, logoHeight: 40, productCount: 0 },
  { id: 'fb3', name: 'NVIDIA', slug: 'nvidia', logoUrl: null, logoWidth: 80, logoHeight: 28, productCount: 0 },
  { id: 'fb4', name: 'Kingston', slug: 'kingstontechnology', logoUrl: null, logoWidth: 90, logoHeight: 20, productCount: 0 },
  { id: 'fb5', name: 'Corsair', slug: 'corsair', logoUrl: null, logoWidth: 80, logoHeight: 24, productCount: 0 },
  { id: 'fb6', name: 'ASUS', slug: 'asus', logoUrl: null, logoWidth: 70, logoHeight: 28, productCount: 0 },
  { id: 'fb7', name: 'Samsung', slug: 'samsung', logoUrl: null, logoWidth: 80, logoHeight: 26, productCount: 0 },
  { id: 'fb8', name: 'Seagate', slug: 'seagate', logoUrl: null, logoWidth: 70, logoHeight: 26, productCount: 0 },
]

// SimpleIcons slugs that don't match the brand's DB slug — override mapping
const SLUG_OVERRIDES: Record<string, string> = {
  'tp-link': 'tplink',
  'cooler-master': 'cooler_master',
  'kingston': 'kingstontechnology',
  'team-group': 'teamgroup',
  'd-link': 'dlink',
  'harman-kardon': 'harman',
  'cx': 'cx',
  'apc': 'schneiderelectric',
}

// Brand names (lowercase) known to NOT exist on SimpleIcons — show text fallback directly
const NO_ICON_NAMES = new Set([
  'hpe', 'apc', 'logitech', 'brother', 'epson', 'aruba',
  'lexmark', 'ezviz', 'hiksemi', 'x-tech', 'gamemax',
  'hilook', 'hikvision', 'mercusys', 'raptor', 'cudy',
  'furukawa', 'teros', 'kelyx', 'pantum', 'klipxtreme',
  'memox', 'arkham', 'foxbox', 'noganet', 'e-view',
  'nexxt', 'intelaid', 'ocom', 'biwin', 'glcfi',
  'thronos', 'loosafe', 'cromax', 'aerocool', 'sentey',
  'naceb', 'raptor', 'motorola', 'sapphire', 'powercolor',
  'inno3d', 'ezviz', 'tenda', 'mikrotik', 'synology',
])

export default function BrandLogos() {
  const [brands, setBrands] = useState<Brand[]>(FALLBACK_BRANDS)
  const [failedIcons, setFailedIcons] = useState<Set<string>>(new Set())

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

  const handleImageError = useCallback((brandKey: string) => {
    setFailedIcons(prev => {
      const next = new Set(prev)
      next.add(brandKey)
      return next
    })
  }, [])

  // Always generate logo URL from the correct SimpleIcons slug, ignoring the DB logoUrl
  const getLogoSrc = (brand: Brand) => {
    const slug = SLUG_OVERRIDES[brand.slug] || brand.slug
    return `https://cdn.simpleicons.org/${slug}/9ca3af`
  }

  // Check if a brand is known to not have an icon, or if it previously failed
  const hasNoIcon = (brand: Brand) => {
    return (
      NO_ICON_NAMES.has(brand.name.toLowerCase()) ||
      NO_ICON_NAMES.has(brand.slug.toLowerCase()) ||
      failedIcons.has(brand.id) ||
      failedIcons.has(brand.slug)
    )
  }

  const renderBrandLogo = (brand: Brand) => {
    if (hasNoIcon(brand)) {
      // Text fallback — styled brand initial + name
      return (
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-compucity-green-100 text-compucity-green-700 font-bold text-sm flex items-center justify-center shrink-0">
            {brand.name.charAt(0)}
          </span>
          <span className="text-xs font-semibold text-gray-500 leading-tight line-clamp-2">
            {brand.name}
          </span>
        </div>
      )
    }

    return (
      <Image
        src={getLogoSrc(brand)}
        alt={brand.name}
        width={brand.logoWidth || 80}
        height={brand.logoHeight || 24}
        className="transition-all duration-300 group-hover:brightness-0 group-hover:invert-[40%] group-hover:sepia-[90%] group-hover:saturate-[400%] group-hover:hue-rotate-[100deg]"
        unoptimized
        onError={() => handleImageError(brand.id)}
      />
    )
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
                {renderBrandLogo(brand)}
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
                {renderBrandLogo(brand)}
              </div>
            ))}
          </div>
        </div>
      </section>
    </FadeIn>
  )
}
