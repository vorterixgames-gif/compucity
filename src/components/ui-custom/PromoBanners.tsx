'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

/* ─── Types ─── */
interface Banner {
  id: string
  title: string
  subtitle: string | null
  buttonText: string | null
  buttonLink: string | null
  bgColor: string
  textColor: string
  imageUrl: string | null
  position: string
  isActive: number
  order: number
}

interface Props {
  position: 'top' | 'below-hero'
}

/* ─── Auto-scroll interval (ms) ─── */
const AUTO_SCROLL_INTERVAL = 4500

/* ─── Component ─── */
export default function PromoBanners({ position }: Props) {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loaded, setLoaded] = useState(false)
  const [current, setCurrent] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [direction, setDirection] = useState(1)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ── Fetch banners on mount ── */
  useEffect(() => {
    let cancelled = false
    async function fetchBanners() {
      try {
        const res = await fetch('/api/banners')
        const data = await res.json()
        if (!cancelled && data.ok && Array.isArray(data.banners)) {
          const filtered = (data.banners as Banner[]).filter(
            (b) => b.position === position && b.isActive === 1
          )
          setBanners(filtered)
        }
      } catch {
        // Silently fail — banners are non-critical
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    fetchBanners()
    return () => {
      cancelled = true
    }
  }, [position])

  const count = banners.length

  /* ── Auto-scroll ── */
  const goNext = useCallback(() => {
    setDirection(1)
    setCurrent((prev) => (prev + 1) % count)
  }, [count])

  useEffect(() => {
    if (isPaused || count <= 1) return
    timerRef.current = setInterval(goNext, AUTO_SCROLL_INTERVAL)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPaused, goNext, count])

  /* ── Don't render until loaded or if no banners ── */
  if (!loaded || count === 0) return null

  const banner = banners[current]

  /* ── Slide variants (crossfade + slight slide) ── */
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 40 : -40,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -40 : 40,
      opacity: 0,
    }),
  }

  const bgColor = banner.bgColor || '#3A8B68'
  const textColor = banner.textColor || '#FFFFFF'

  return (
    <div
      className="w-full relative overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label={`Promo banners – ${position}`}
    >
      {/* ── Animated entrance wrapper ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* ── Banner strip ── */}
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={banner.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="w-full py-4 md:py-6 px-4 text-center relative"
            style={{ backgroundColor: bgColor }}
          >
            {/* Background image */}
            {banner.imageUrl && (
              <>
                <img
                  src={banner.imageUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  aria-hidden="true"
                />
                <div className="absolute inset-0" style={{ backgroundColor: bgColor, opacity: 0.7 }} />
              </>
            )}

            <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 md:gap-5 flex-wrap relative z-10">
              {/* Text content */}
              <div className="min-w-0">
                <h3
                  className="text-sm md:text-base lg:text-lg font-bold leading-tight truncate"
                  style={{ color: textColor }}
                >
                  {banner.title}
                </h3>
                {banner.subtitle && (
                  <p
                    className="text-[11px] md:text-xs lg:text-sm opacity-90 mt-0.5 truncate"
                    style={{ color: textColor }}
                  >
                    {banner.subtitle}
                  </p>
                )}
              </div>

              {/* Button (inverted colors) */}
              {banner.buttonText && banner.buttonLink && (
                <Link
                  href={banner.buttonLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1 md:px-4 md:py-1.5 text-xs md:text-sm font-semibold rounded-full transition-all duration-200 hover:scale-105 shrink-0"
                  style={{
                    backgroundColor: textColor,
                    color: bgColor,
                  }}
                >
                  {banner.buttonText}
                  <ArrowRight className="w-3 h-3 md:w-3.5 md:h-3.5" />
                </Link>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ── Dot indicators (only if multiple banners) ── */}
        {count > 1 && (
          <div
            className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10"
            style={{ color: textColor }}
          >
            {banners.map((b, i) => (
              <button
                key={b.id}
                onClick={() => {
                  setDirection(i > current ? 1 : -1)
                  setCurrent(i)
                }}
                className={`transition-all duration-300 rounded-full ${
                  i === current
                    ? 'w-5 h-2 opacity-90'
                    : 'w-2 h-2 opacity-40 hover:opacity-65'
                }`}
                style={{
                  backgroundColor: textColor,
                }}
                aria-label={`Ir al banner ${i + 1}`}
                aria-current={i === current ? 'true' : undefined}
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
