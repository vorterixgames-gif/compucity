'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface Banner {
  id: string
  title: string
  subtitle: string | null
  buttonText: string | null
  buttonLink: string | null
  bgColor: string
  textColor: string
  position: string
  isActive: number
  order: number
}

interface Props {
  banners: Banner[]
}

export default function PromoBanner({ banners }: Props) {
  if (!banners || banners.length === 0) return null

  return (
    <div className="w-full">
      {banners.map((banner) => (
        <div
          key={banner.id}
          className="w-full py-3 px-4 text-center"
          style={{ backgroundColor: banner.bgColor || '#3A8B68' }}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-4 flex-wrap">
            <div>
              <h3
                className="text-base md:text-lg font-bold"
                style={{ color: banner.textColor || '#FFFFFF' }}
              >
                {banner.title}
              </h3>
              {banner.subtitle && (
                <p
                  className="text-xs md:text-sm opacity-90 mt-0.5"
                  style={{ color: banner.textColor || '#FFFFFF' }}
                >
                  {banner.subtitle}
                </p>
              )}
            </div>
            {banner.buttonText && banner.buttonLink && (
              <Link
                href={banner.buttonLink}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-full transition-all duration-200 hover:scale-105"
                style={{
                  backgroundColor: banner.textColor || '#FFFFFF',
                  color: banner.bgColor || '#3A8B68',
                }}
              >
                {banner.buttonText}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
