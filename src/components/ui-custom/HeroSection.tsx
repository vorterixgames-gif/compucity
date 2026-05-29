'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Cpu, Laptop, CircuitBoard, Mouse, ChevronLeft, ChevronRight } from 'lucide-react'

/* ─── Slide Data ─── */
const slides = [
  {
    id: 1,
    image: '/images/hero-slide-pc-builder.png',
    badge: 'Armá tu PC',
    title: 'Armá tu PC\ngamer',
    titleAccent: 'gamer',
    description: 'Elegí cada componente y armá la PC de tus sueños. Procesadores, placas de video, memorias y más.',
    cta: { label: 'Comenzar a armar', href: '/arma-tu-pc', icon: Cpu, primary: true },
    ctaSecondary: { label: 'Ver componentes', href: '/categoria/componentes-de-pc' },
    gradient: 'from-compucity-green-900/95 via-compucity-green-700/80 to-compucity-green-900/30',
  },
  {
    id: 2,
    image: '/images/hero-slide-notebooks.png',
    badge: 'Notebooks',
    title: 'Notebooks y\nlaptops',
    titleAccent: 'laptops',
    description: 'Las mejores notebooks para trabajo, estudio y gaming. Lenovo, Asus, HP y más marcas.',
    cta: { label: 'Ver notebooks', href: '/categoria/notebooks', icon: Laptop, primary: true },
    ctaSecondary: { label: 'Ver todas las marcas', href: '/categoria/todos' },
    gradient: 'from-compucity-green-950/95 via-compucity-green-800/80 to-compucity-green-950/30',
  },
  {
    id: 3,
    image: '/images/hero-slide-components.png',
    badge: 'Componentes',
    title: 'Placas de video\ny componentes',
    titleAccent: 'componentes',
    description: 'Las últimas GPU, procesadores, RAM y storage. Todo lo que necesitás para tu setup.',
    cta: { label: 'Ver componentes', href: '/categoria/componentes-de-pc', icon: CircuitBoard, primary: true },
    ctaSecondary: { label: 'Ver productos', href: '/categoria/todos' },
    gradient: 'from-compucity-green-900/95 via-compucity-green-600/70 to-compucity-green-900/30',
  },
  {
    id: 4,
    image: '/images/hero-slide-perifericos.png',
    badge: 'Periféricos',
    title: 'Periféricos\ngaming',
    titleAccent: 'gaming',
    description: 'Teclados, mouses, auriculares y monitores. Mejorá tu experiencia de juego y trabajo.',
    cta: { label: 'Ver periféricos', href: '/categoria/perifericos', icon: Mouse, primary: true },
    ctaSecondary: { label: 'Ver todo', href: '/categoria/todos' },
    gradient: 'from-compucity-green-950/95 via-compucity-green-500/70 to-compucity-green-950/30',
  },
]

/* ─── Hero Carousel ─── */
export default function HeroSection() {
  const [current, setCurrent] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [direction, setDirection] = useState(1)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const touchStartX = useRef(0)

  const slideCount = slides.length

  const goTo = useCallback(
    (index: number) => {
      setDirection(index > current ? 1 : -1)
      setCurrent(index)
    },
    [current]
  )

  const goNext = useCallback(() => {
    setDirection(1)
    setCurrent((prev) => (prev + 1) % slideCount)
  }, [slideCount])

  const goPrev = useCallback(() => {
    setDirection(-1)
    setCurrent((prev) => (prev - 1 + slideCount) % slideCount)
  }, [slideCount])

  // Autoplay
  useEffect(() => {
    if (isPaused) return
    timerRef.current = setInterval(goNext, 5000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPaused, goNext])

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext, goPrev])

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext()
      else goPrev()
    }
  }

  const slide = slides[current]

  /* ─── Slide Variants ─── */
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0,
    }),
  }

  const contentVariants = {
    hidden: { opacity: 0, y: 20 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.2 + i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    }),
  }

  return (
    <section
      className="relative w-full overflow-hidden bg-compucity-green-900"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-roledescription="carousel"
      aria-label="Promociones destacadas"
    >
      {/* ── Slide Background Images ── */}
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={slide.id}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute inset-0"
        >
          {/* Background Image */}
          <Image
            src={slide.image}
            alt={slide.badge}
            fill
            className="object-cover object-center"
            priority={slide.id === 1}
            sizes="100vw"
          />
          {/* Gradient Overlay - ensures text readability */}
          <div className={`absolute inset-0 bg-gradient-to-r ${slide.gradient}`} />
          {/* Dark overlay for depth + text readability */}
          <div className="absolute inset-0 bg-black/30" />
        </motion.div>
      </AnimatePresence>

      {/* ── Content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 lg:py-28 min-h-[400px] md:min-h-[480px] lg:min-h-[520px] flex items-center"
        >
          <div className="max-w-xl lg:max-w-2xl">
            {/* Badge */}
            <motion.div
              variants={contentVariants}
              initial="hidden"
              animate="show"
              custom={0}
              className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-1.5 mb-5 backdrop-blur-sm border border-white/10"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              <span className="text-sm text-white font-semibold tracking-wide">{slide.badge}</span>
            </motion.div>

            {/* Title */}
            <motion.h1
              variants={contentVariants}
              initial="hidden"
              animate="show"
              custom={1}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-5 text-white leading-[1.1] whitespace-pre-line"
            >
              {slide.title.split('\n').map((line, i, arr) => (
                <span key={i}>
                  {line.includes(slide.titleAccent) ? (
                    <>
                      {line.split(slide.titleAccent)[0]}
                      <span className="text-compucity-green-light">{slide.titleAccent}</span>
                      {line.split(slide.titleAccent)[1]}
                    </>
                  ) : (
                    line
                  )}
                  {i < arr.length - 1 && <br />}
                </span>
              ))}
            </motion.h1>

            {/* Description */}
            <motion.p
              variants={contentVariants}
              initial="hidden"
              animate="show"
              custom={2}
              className="text-base sm:text-lg text-white/80 mb-8 leading-relaxed max-w-lg"
            >
              {slide.description}
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={contentVariants}
              initial="hidden"
              animate="show"
              custom={3}
              className="flex flex-wrap gap-3"
            >
              <Link
                href={slide.cta.href}
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-white hover:bg-compucity-green-50 text-compucity-green-800 font-bold rounded-lg transition-all duration-200 text-base shadow-lg shadow-compucity-green-950/20 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              >
                {slide.cta.icon && <slide.cta.icon className="h-4 w-4" />}
                {slide.cta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {slide.ctaSecondary && (
                <Link
                  href={slide.ctaSecondary.href}
                  className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/15 hover:bg-white/25 text-white font-semibold rounded-lg border border-white/20 hover:border-white/35 transition-all duration-200 text-base backdrop-blur-sm hover:scale-[1.02] active:scale-[0.98]"
                >
                  {slide.ctaSecondary.label}
                </Link>
              )}
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ── Navigation Arrows ── */}
      <button
        onClick={goPrev}
        className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-10 w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center backdrop-blur-sm transition-all duration-200 border border-white/10 hover:border-white/20"
        aria-label="Slide anterior"
      >
        <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
      </button>
      <button
        onClick={goNext}
        className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-10 w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center backdrop-blur-sm transition-all duration-200 border border-white/10 hover:border-white/20"
        aria-label="Siguiente slide"
      >
        <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
      </button>

      {/* ── Dot Indicators ── */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        {slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => goTo(i)}
            className={`transition-all duration-300 rounded-full ${
              i === current
                ? 'w-8 h-3 bg-white'
                : 'w-3 h-3 bg-white/40 hover:bg-white/60'
            }`}
            aria-label={`Ir al slide ${i + 1}`}
            aria-current={i === current ? 'true' : undefined}
          />
        ))}
      </div>

      {/* ── Progress Bar ── */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 z-10">
        <motion.div
          key={current}
          className="h-full bg-white/60"
          initial={{ width: '0%' }}
          animate={{ width: isPaused ? `${0}%` : '100%' }}
          transition={{ duration: 5, ease: 'linear' }}
        />
      </div>
    </section>
  )
}
