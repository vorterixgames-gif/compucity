'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, ShoppingCart, User, Menu, X, ChevronDown, Phone, LogOut, Package, Settings } from 'lucide-react'
import { useCart } from '@/store/cart'
import CompucityLogo from '@/components/ui-custom/CompucityLogo'

interface Subcategory {
  id: string
  name: string
  slug: string
}

interface Category {
  id: string
  name: string
  slug: string
  parentId: string | null
  children?: Subcategory[]
}

interface SearchResult {
  id: string
  name: string
  slug: string
  price: number
  comparePrice: number | null
  images: string[]
}

interface CustomerInfo {
  id: string
  name: string
  email: string
}

const NAV_LINKS = [
  { name: 'Arma tu PC', href: '/arma-tu-pc' },
  { name: 'Contacto', href: '/contacto' },
]

const formatPrice = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

function MobileCategoryItem({ cat, onClose }: { cat: Category; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = cat.children && cat.children.length > 0

  return (
    <div>
      <div className="flex items-center">
        <Link
          href={`/categoria/${cat.slug}`}
          className="flex-1 px-5 py-3 text-sm font-semibold text-compucity-green-900 hover:bg-compucity-green-50 transition"
          onClick={onClose}
        >
          {cat.name}
        </Link>
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-4 py-3 text-gray-400 hover:text-compucity-green-600 transition"
            aria-label={expanded ? 'Colapsar' : 'Expandir'}
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {expanded && hasChildren && (
        <div className="bg-compucity-green-50/50 border-t border-b border-compucity-green-100">
          {cat.children!.map((sub) => (
            <Link
              key={sub.id}
              href={`/categoria/${sub.slug}`}
              className="block px-8 py-2.5 text-sm text-gray-600 hover:text-compucity-green-700 hover:bg-compucity-green-100/50 transition"
              onClick={onClose}
            >
              {sub.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const totalItems = useCart((s) => s.totalItems())
  const lastAdded = useCart((s) => s.lastAdded)
  const [bouncing, setBouncing] = useState(false)
  const prevLastAdded = useRef<string | null>(null)

  // User dropdown state
  const [customer, setCustomer] = useState<CustomerInfo | null>(null)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const userDropdownRef = useRef<HTMLDivElement>(null)

  // Search autocomplete state
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (lastAdded && lastAdded !== prevLastAdded.current) {
      setBouncing(true)
      const timer = setTimeout(() => setBouncing(false), 400)
      prevLastAdded.current = lastAdded
      return () => clearTimeout(timer)
    }
  }, [lastAdded])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Check if customer is logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/customer/me')
        if (res.ok) {
          const data = await res.json()
          setCustomer(data.customer)
        }
      } catch {
        // Not logged in
      }
    }
    checkAuth()
  }, [])

  // Close user dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('/api/customer/logout', { method: 'POST' })
    } catch {}
    setCustomer(null)
    setUserDropdownOpen(false)
  }

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await fetch('/api/categories')
        const data = await res.json()
        if (data.ok && data.categories && (data.categories as Category[]).length > 0) {
          const allCats = data.categories as Category[]
          const parents = allCats.filter(c => !c.parentId)
          const tree = parents.map(parent => ({
            ...parent,
            children: allCats.filter(c => c.parentId === parent.id).map(c => ({ id: c.id, name: c.name, slug: c.slug })),
          }))
          setCategories(tree)
        } else {
          try {
            await fetch('/api/admin/init-categories', { method: 'POST' })
            const res2 = await fetch('/api/categories')
            const data2 = await res2.json()
            if (data2.ok && data2.categories) {
              const allCats = data2.categories as Category[]
              const parents = allCats.filter(c => !c.parentId)
              const tree = parents.map(parent => ({
                ...parent,
                children: allCats.filter(c => c.parentId === parent.id).map(c => ({ id: c.id, name: c.name, slug: c.slug })),
              }))
              setCategories(tree)
            }
          } catch {}
        }
      } catch (error) {
        console.error('Error loading categories:', error)
      }
    }
    loadCategories()
  }, [])

  // Search autocomplete - debounced fetch
  const performSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([])
      setSearchDropdownOpen(false)
      return
    }
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json()
      if (data.ok) {
        setSearchResults(data.products)
        setSearchDropdownOpen(true)
      }
    } catch {
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [])

  const handleSearchInputChange = (value: string) => {
    setSearchQuery(value)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      performSearch(value)
    }, 300)
  }

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setSearchDropdownOpen(false)
      window.location.href = `/categoria/todos?q=${encodeURIComponent(searchQuery)}`
    }
  }

  // Listen for storage events (cross-tab logout)
  useEffect(() => {
    const handleStorage = () => {
      // Re-check auth when another tab logs out
      const checkAuth = async () => {
        try {
          const res = await fetch('/api/customer/me')
          if (res.ok) {
            const data = await res.json()
            setCustomer(data.customer)
          } else {
            setCustomer(null)
          }
        } catch {
          setCustomer(null)
        }
      }
      checkAuth()
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const hoveredCat = hoveredCategory ? categories.find(c => c.id === hoveredCategory) : categories[0]
  const hoveredCatSubs = hoveredCat?.children?.filter(Boolean) ?? []

  return (
    <header className="sticky top-0 z-50">
      {/* Top bar - Marquee */}
      <div className="bg-gradient-to-r from-compucity-green-950 via-compucity-green-800 to-compucity-green-700 text-white overflow-hidden">
        <div className="animate-marquee flex items-center gap-12 whitespace-nowrap py-1.5">
          {[1, 2].map((repeat) => (
            <span key={repeat} className="flex items-center gap-12 text-xs tracking-wide font-medium">
              <span className="flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-compucity-green-light animate-pulse" />
                Envíos a todo el país
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-compucity-green-light animate-pulse" />
                <a href="https://wa.me/5493517656918" target="_blank" className="hover:text-compucity-green-light transition-colors">WhatsApp: 3517656918</a>
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-compucity-green-light animate-pulse" />
                La Falda, Córdoba
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-compucity-green-light animate-pulse" />
                Compra segura y asesoramiento personalizado
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-compucity-green-light animate-pulse" />
                Hacé tu pedido por WhatsApp
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Main navbar */}
      <div className={`bg-white transition-shadow duration-300 ${scrolled ? 'shadow-lg' : 'border-b border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-4">
          {/* Hamburger - mobile */}
          <button
            className="md:hidden p-1 shrink-0 text-gray-700 hover:text-compucity-green transition"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          {/* LOGO - SVG de alta calidad */}
          <Link href="/" className="group shrink-0">
            <CompucityLogo variant="full" size="xl" className="group-hover:scale-105 transition-transform duration-200" />
          </Link>

          {/* Search - desktop */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-lg mx-8 relative" ref={searchContainerRef}>
            <div className="flex w-full relative">
              <input
                type="text"
                placeholder="¿Qué producto buscás?"
                value={searchQuery}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setSearchDropdownOpen(true) }}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-l-lg focus:outline-none focus:border-compucity-green focus:bg-white text-sm text-gray-800 placeholder:text-gray-400 transition"
                autoComplete="off"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-compucity-green hover:bg-compucity-green-dark text-white rounded-r-lg transition font-medium text-sm"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>

            {/* Autocomplete Dropdown */}
            {searchDropdownOpen && searchQuery.trim().length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-[100] max-h-96 overflow-y-auto animate-fade-in">
                {searchLoading ? (
                  <div className="p-4 text-center text-sm text-gray-400">
                    <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-compucity-green mr-2 align-middle" />
                    Buscando...
                  </div>
                ) : searchResults.length > 0 ? (
                  <>
                    {searchResults.map((product) => {
                      const effectivePrice = product.comparePrice && product.comparePrice < product.price
                        ? product.comparePrice
                        : product.price
                      const imageUrl = product.images?.[0] || '/placeholder-product.png'
                      return (
                        <a
                          key={product.id}
                          href={`/producto/${product.slug}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-compucity-green-50 transition border-b border-gray-100 last:border-b-0"
                          onClick={() => setSearchDropdownOpen(false)}
                        >
                          <img
                            src={imageUrl}
                            alt={product.name}
                            className="h-10 w-10 object-contain bg-gray-50 rounded shrink-0"
                            onError={(e) => {
                              ;(e.target as HTMLImageElement).src = '/placeholder-product.png'
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 truncate">{product.name}</p>
                            <p className="text-sm font-bold text-compucity-green">{formatPrice(effectivePrice)}</p>
                          </div>
                        </a>
                      )
                    })}
                    <a
                      href={`/categoria/todos?q=${encodeURIComponent(searchQuery)}`}
                      className="block px-4 py-3 text-center text-sm text-compucity-green font-medium hover:bg-compucity-green-50 transition border-t border-gray-200"
                      onClick={() => setSearchDropdownOpen(false)}
                    >
                      Buscar &ldquo;{searchQuery}&rdquo; en todos los productos →
                    </a>
                  </>
                ) : (
                  <div className="p-4 text-center">
                    <p className="text-sm text-gray-500 mb-2">No encontramos resultados</p>
                    <a
                      href={`/categoria/todos?q=${encodeURIComponent(searchQuery)}`}
                      className="text-sm text-compucity-green font-medium hover:text-compucity-green-dark transition"
                      onClick={() => setSearchDropdownOpen(false)}
                    >
                      Ver todos los productos →
                    </a>
                  </div>
                )}
              </div>
            )}
          </form>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* User icon - mobile */}
            <Link
              href="/mis-pedidos"
              className="md:hidden flex items-center text-gray-600 hover:text-compucity-green transition px-2 py-2 rounded-lg hover:bg-compucity-green-50"
              onClick={() => setMobileMenuOpen(false)}
            >
              {customer ? (
                <div className="w-6 h-6 rounded-full bg-compucity-green flex items-center justify-center text-white text-xs font-bold">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
              ) : (
                <User className="h-5 w-5" />
              )}
            </Link>

            {/* User Account / Profile Dropdown - desktop */}
            <div className="relative hidden md:block" ref={userDropdownRef}>
              {customer ? (
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-compucity-green transition px-3 py-2 rounded-lg hover:bg-compucity-green-50"
                >
                  <div className="w-6 h-6 rounded-full bg-compucity-green flex items-center justify-center text-white text-xs font-bold">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden lg:inline font-medium max-w-[100px] truncate">{customer.name.split(' ')[0]}</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              ) : (
                <Link
                  href="/mis-pedidos"
                  className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-compucity-green transition px-3 py-2 rounded-lg hover:bg-compucity-green-50"
                >
                  <User className="h-5 w-5" />
                  <span className="hidden lg:inline font-medium">Mi Cuenta</span>
                </Link>
              )}

              {/* User Dropdown Menu */}
              {customer && userDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-[100] py-1 animate-fade-in">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="font-medium text-gray-900 text-sm truncate">{customer.name}</p>
                    <p className="text-xs text-gray-500 truncate">{customer.email}</p>
                  </div>
                  <Link
                    href="/mis-pedidos"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-compucity-green-50 hover:text-compucity-green-dark transition"
                  >
                    <Package className="h-4 w-4 text-gray-400" />
                    Mis Pedidos
                  </Link>
                  <Link
                    href="/mis-pedidos"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-compucity-green-50 hover:text-compucity-green-dark transition"
                  >
                    <Settings className="h-4 w-4 text-gray-400" />
                    Mi Perfil
                  </Link>
                  <div className="border-t border-gray-100 mt-1">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
                    >
                      <LogOut className="h-4 w-4" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Link href="/carrito" className="relative flex items-center gap-1.5 text-sm text-gray-600 hover:text-compucity-green transition px-3 py-2 rounded-lg hover:bg-compucity-green-50">
              <ShoppingCart className="h-5 w-5" />
              <span className="hidden lg:inline font-medium">Carrito</span>
              {totalItems > 0 && (
                <span className={`absolute -top-0.5 -right-0.5 bg-compucity-green text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center font-bold ${bouncing ? 'animate-cart-bounce' : ''}`}>
                  {totalItems}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Nav bar - green gradient */}
      <div className="bg-gradient-to-r from-compucity-green-800 via-compucity-green-700 to-compucity-green-800">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="hidden md:flex items-center gap-0 h-10 text-sm">
            <div
              className="relative"
              onMouseEnter={() => {
                setCategoryDropdownOpen(true)
                if (!hoveredCategory && categories.length > 0) setHoveredCategory(categories[0].id)
              }}
              onMouseLeave={() => { setCategoryDropdownOpen(false); setHoveredCategory(null) }}
            >
              <button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded font-semibold transition h-10 text-sm">
                <Menu className="h-4 w-4" />
                Categorías
                <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${categoryDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {categoryDropdownOpen && categories.length > 0 && (
                <div className="absolute top-full left-0 bg-white text-gray-900 shadow-xl border border-gray-200 rounded-lg z-[100] flex animate-fade-in" style={{ minHeight: '300px', minWidth: '560px' }}>
                  <div className="w-56 border-r bg-compucity-green-50 py-1 shrink-0">
                    {categories.map((cat) => (
                      <Link
                        key={cat.id}
                        href={`/categoria/${cat.slug}`}
                        className={`flex items-center justify-between px-3 py-2.5 transition text-sm font-medium ${
                          hoveredCategory === cat.id ? 'bg-compucity-green/10 text-compucity-green-dark' : 'hover:bg-compucity-green/10 hover:text-compucity-green-dark text-gray-700'
                        }`}
                        onMouseEnter={() => setHoveredCategory(cat.id)}
                        onClick={() => { setCategoryDropdownOpen(false); setHoveredCategory(null) }}
                      >
                        {cat.name}
                        {cat.children && cat.children.length > 0 && <ChevronDown className="h-3 w-3 -rotate-90 opacity-40" />}
                      </Link>
                    ))}
                  </div>

                  <div className="flex-1 p-4 min-w-[280px]">
                    <Link href={`/categoria/${hoveredCat?.slug ?? 'todos'}`} className="text-sm font-bold text-compucity-green-dark hover:text-compucity-green mb-3 block transition" onClick={() => { setCategoryDropdownOpen(false); setHoveredCategory(null) }}>
                      Ver todo en {hoveredCat?.name ?? 'Productos'} →
                    </Link>
                    {hoveredCatSubs.length > 0 && (
                      <div className={hoveredCatSubs.length > 6 ? 'grid grid-cols-2 gap-x-4 gap-y-0.5' : 'flex flex-col gap-y-0.5'}>
                        {hoveredCatSubs.map((sub) => (
                          <Link key={sub.id} href={`/categoria/${sub.slug}`} className="block px-2 py-1.5 text-sm text-gray-600 hover:text-compucity-green-dark hover:bg-compucity-green-50 rounded transition" onClick={() => { setCategoryDropdownOpen(false); setHoveredCategory(null) }}>
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {categories.slice(0, 4).map((cat) => (
              <Link key={cat.id} href={`/categoria/${cat.slug}`} className="px-3 py-2 text-white/80 hover:text-white hover:bg-white/10 transition font-medium text-sm">
                {cat.name}
              </Link>
            ))}

            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="px-3 py-2 text-white/80 hover:text-white hover:bg-white/10 transition font-medium text-sm">
                {link.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 max-h-[70vh] overflow-y-auto animate-slide-up">
          <form onSubmit={handleSearch} className="p-4">
            <div className="flex">
              <input type="text" placeholder="Buscar productos..." value={searchQuery} onChange={(e) => handleSearchInputChange(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-l-lg text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-compucity-green transition" autoComplete="off" />
              <button type="submit" className="px-4 py-2.5 bg-compucity-green text-white rounded-r-lg"><Search className="h-4 w-4" /></button>
            </div>
            {/* Mobile search results */}
            {searchDropdownOpen && searchQuery.trim().length >= 2 && searchResults.length > 0 && (
              <div className="mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                {searchResults.map((product) => {
                  const effectivePrice = product.comparePrice && product.comparePrice < product.price
                    ? product.comparePrice
                    : product.price
                  const imageUrl = product.images?.[0] || '/placeholder-product.png'
                  return (
                    <a
                      key={product.id}
                      href={`/producto/${product.slug}`}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-compucity-green-50 transition border-b border-gray-100 last:border-b-0"
                      onClick={() => { setMobileMenuOpen(false); setSearchDropdownOpen(false) }}
                    >
                      <img src={imageUrl} alt={product.name} className="h-8 w-8 object-contain bg-gray-50 rounded shrink-0" onError={(e) => { ;(e.target as HTMLImageElement).src = '/placeholder-product.png' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-800 truncate">{product.name}</p>
                        <p className="text-xs font-bold text-compucity-green">{formatPrice(effectivePrice)}</p>
                      </div>
                    </a>
                  )
                })}
              </div>
            )}
          </form>
          {/* Mobile categories - expandable */}
          <div className="border-t border-gray-100">
            {categories.map((cat) => (
              <MobileCategoryItem key={cat.id} cat={cat} onClose={() => setMobileMenuOpen(false)} />
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
