'use client'

import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import ProductCard from '@/components/ui-custom/ProductCard'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Product {
  id: string
  name: string
  slug: string
  price: number
  comparePrice?: number | null
  images?: string | null
  stock?: number
  isFeatured?: boolean
  salePrice?: number | null
  saleStart?: string | null
  saleEnd?: string | null
}

function safeParseFirstImage(images: string | null): string | null {
  if (!images) return null
  try { return JSON.parse(images)[0] } catch { return null }
}

interface FeaturedProductsCarouselProps {
  products: Product[]
}

export default function FeaturedProductsCarousel({ products }: FeaturedProductsCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: 'start',
      loop: true,
      slidesToScroll: 1,
      containScroll: 'trimSnaps',
    },
    [Autoplay({ delay: 4000, stopOnInteraction: true })]
  )

  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setCanScrollPrev(emblaApi.canScrollPrev())
    setCanScrollNext(emblaApi.canScrollNext())
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi, onSelect])

  const scrollPrev = useCallback(() => {
    emblaApi?.scrollPrev()
  }, [emblaApi])

  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext()
  }, [emblaApi])

  // Determine how many slides per view based on responsive design
  // We'll show 1 on mobile, 2 on md, 3 on lg, 4 on xl
  // Since this is CSS-based, we handle it with basis classes

  if (!products || products.length === 0) return null

  // Group products into slides: 1 product per slide on mobile, but we'll
  // use CSS to show multiple at once on larger screens
  // Each CarouselItem holds one product card, and we use CSS basis to control width

  return (
    <section className="py-10 bg-gradient-to-b from-compucity-green-50/30 to-white">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-compucity-green-500 rounded-full" />
            <h2 className="text-2xl md:text-3xl font-bold text-compucity-green-900">Productos Destacados</h2>
          </div>
          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={scrollPrev}
              disabled={!canScrollPrev}
              className="w-9 h-9 rounded-full border border-compucity-green-200 bg-white hover:bg-compucity-green-50 hover:border-compucity-green-400 flex items-center justify-center transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-compucity-green-200 shadow-sm"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-4 w-4 text-compucity-green-700" />
            </button>
            <button
              onClick={scrollNext}
              disabled={!canScrollNext}
              className="w-9 h-9 rounded-full border border-compucity-green-200 bg-white hover:bg-compucity-green-50 hover:border-compucity-green-400 flex items-center justify-center transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-compucity-green-200 shadow-sm"
              aria-label="Siguiente"
            >
              <ChevronRight className="h-4 w-4 text-compucity-green-700" />
            </button>
          </div>
        </div>

        {/* Carousel */}
        <div className="relative" ref={emblaRef}>
          <div className="flex -ml-3 md:-ml-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex-none w-1/2 pl-3 md:w-1/3 md:pl-4 lg:w-1/4"
              >
                <ProductCard
                  id={product.id}
                  name={product.name}
                  slug={product.slug}
                  price={product.price}
                  comparePrice={product.comparePrice}
                  image={safeParseFirstImage(product.images ?? null)}
                  stock={product.stock}
                  isFeatured={true}
                  salePrice={product.salePrice}
                  saleStart={product.saleStart}
                  saleEnd={product.saleEnd}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Dot indicators */}
        {products.length > 4 && (
          <div className="flex items-center justify-center gap-1.5 mt-6">
            {products.map((_, index) => (
              <button
                key={index}
                onClick={() => emblaApi?.scrollTo(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === selectedIndex
                    ? 'w-6 bg-compucity-green-500'
                    : 'w-2 bg-compucity-green-200 hover:bg-compucity-green-300'
                }`}
                aria-label={`Ir al slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
