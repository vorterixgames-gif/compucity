'use client'

import { useState, useMemo } from 'react'
import { SlidersHorizontal, X, ChevronDown, ArrowUpDown } from 'lucide-react'
import ProductCard from './ProductCard'

interface Subcategory {
  id: string
  name: string
  slug: string
}

interface ProductItem {
  id: string
  name: string
  slug: string
  price: number
  comparePrice: number | null
  images: string
  stock: number
  createdAt?: string
}

interface Props {
  products: ProductItem[]
  subcategories: Subcategory[]
  currentCategory: { id: string; name: string; slug: string } | null
  parentCategory: { id: string; name: string; slug: string } | null
  categorySlug: string
  categoryName: string
}

type SortOption = 'newest' | 'price-asc' | 'price-desc' | 'name-az'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Más recientes' },
  { value: 'price-asc', label: 'Precio: menor a mayor' },
  { value: 'price-desc', label: 'Precio: mayor a menor' },
  { value: 'name-az', label: 'Nombre A-Z' },
]

const formatPrice = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

const parsePriceInput = (val: string): number | null => {
  const cleaned = val.replace(/[^0-9]/g, '')
  return cleaned ? parseInt(cleaned, 10) : null
}

export default function CategoryProducts({
  products,
  subcategories,
  currentCategory,
  parentCategory,
  categorySlug,
  categoryName,
}: Props) {
  const [sort, setSort] = useState<SortOption>('newest')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [onlyInStock, setOnlyInStock] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const hasActiveFilters = priceMin !== '' || priceMax !== '' || onlyInStock

  const clearFilters = () => {
    setPriceMin('')
    setPriceMax('')
    setOnlyInStock(false)
  }

  const filteredAndSorted = useMemo(() => {
    let result = [...products]

    // Price filter
    const min = parsePriceInput(priceMin)
    const max = parsePriceInput(priceMax)
    if (min !== null) {
      result = result.filter((p) => (p.comparePrice ?? p.price) >= min)
    }
    if (max !== null) {
      result = result.filter((p) => (p.comparePrice ?? p.price) <= max)
    }

    // Stock filter
    if (onlyInStock) {
      result = result.filter((p) => p.stock > 0)
    }

    // Sort
    switch (sort) {
      case 'newest':
        result.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return dateB - dateA
        })
        break
      case 'price-asc':
        result.sort((a, b) => (a.comparePrice ?? a.price) - (b.comparePrice ?? b.price))
        break
      case 'price-desc':
        result.sort((a, b) => (b.comparePrice ?? b.price) - (a.comparePrice ?? a.price))
        break
      case 'name-az':
        result.sort((a, b) => a.name.localeCompare(b.name, 'es'))
        break
    }

    return result
  }, [products, sort, priceMin, priceMax, onlyInStock])

  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{categoryName}</h1>
        <span className="text-sm text-gray-500">
          {filteredAndSorted.length} producto{filteredAndSorted.length !== 1 ? 's' : ''}
          {hasActiveFilters && products.length !== filteredAndSorted.length && (
            <span className="text-gray-400"> de {products.length}</span>
          )}
        </span>
      </div>

      {/* Subcategories pills */}
      {subcategories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {parentCategory && parentCategory.id !== currentCategory?.id ? null : (
            <a
              href={`/categoria/${categorySlug}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                !currentCategory || categorySlug === currentCategory.slug
                  ? 'bg-compucity-green text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos
            </a>
          )}
          {subcategories.map((sub) => (
            <a
              key={sub.id}
              href={`/categoria/${sub.slug}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                currentCategory?.id === sub.id
                  ? 'bg-compucity-green text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {sub.name}
            </a>
          ))}
        </div>
      )}

      {/* Filter & Sort Bar - Desktop */}
      <div className="hidden md:flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
        {/* Sort */}
        <div className="relative flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-gray-500 shrink-0" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-compucity-green cursor-pointer"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="w-px h-6 bg-gray-300" />

        {/* Price range */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 whitespace-nowrap">Precio:</span>
          <input
            type="text"
            placeholder="Mín"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            className="w-28 px-2 py-1.5 text-sm border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:border-compucity-green placeholder:text-gray-400"
          />
          <span className="text-gray-400">-</span>
          <input
            type="text"
            placeholder="Máx"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            className="w-28 px-2 py-1.5 text-sm border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:border-compucity-green placeholder:text-gray-400"
          />
        </div>

        <div className="w-px h-6 bg-gray-300" />

        {/* Stock filter */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyInStock}
            onChange={(e) => setOnlyInStock(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-compucity-green focus:ring-compucity-green accent-compucity-green"
          />
          <span className="text-sm text-gray-700">Solo en stock</span>
        </label>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="ml-auto flex items-center gap-1 text-sm text-compucity-green hover:text-compucity-green-dark font-medium transition"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {/* Filter & Sort - Mobile */}
      <div className="md:hidden mb-4">
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filtros y orden
          </span>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <span className="bg-compucity-green text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {[priceMin !== '', priceMax !== '', onlyInStock].filter(Boolean).length}
              </span>
            )}
            <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {filtersOpen && (
          <div className="mt-2 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4 animate-fade-in">
            {/* Sort */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Ordenar por</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-700 focus:outline-none focus:border-compucity-green"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Price range */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Rango de precio</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Precio mín"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:border-compucity-green placeholder:text-gray-400"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="text"
                  placeholder="Precio máx"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:border-compucity-green placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Stock filter */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-compucity-green focus:ring-compucity-green accent-compucity-green"
              />
              <span className="text-sm text-gray-700">Solo en stock</span>
            </label>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-sm text-compucity-green hover:text-compucity-green-dark font-medium transition"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Product Grid */}
      {filteredAndSorted.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredAndSorted.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              slug={product.slug}
              price={product.price}
              comparePrice={product.comparePrice}
              image={product.images ? JSON.parse(product.images)[0] : null}
              stock={product.stock}
            />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500 text-lg mb-2">No hay productos que coincidan con los filtros</p>
          <button
            onClick={clearFilters}
            className="text-compucity-green hover:text-compucity-green-dark font-medium text-sm transition"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="text-center py-20 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500 text-lg mb-2">No hay productos en esta categoría</p>
          <p className="text-gray-400 text-sm">Estamos cargando el catálogo. Volvé pronto.</p>
        </div>
      )}
    </div>
  )
}
