import CategoryProducts from '@/components/ui-custom/CategoryProducts'
import Breadcrumbs from '@/components/ui-custom/Breadcrumbs'
import NotebookChatBanner from '@/components/ui-custom/NotebookChatBanner'
import NotebookAssistantChat from '@/components/notebook-assistant-chat'
import { getEnabledCategories, getProductsByCategory, getAllActiveProducts, searchProducts, getCategoryBySlug } from '@/lib/queries'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import JsonLd, { getBreadcrumbSchema } from '@/components/seo/JsonLd'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string }>
}

// Sesión 49: cambiado a force-dynamic para evitar timeout durante build.
// Las categorías grandes (notebooks, cables) con SELECT * + 5 queries
// paralelas tardaban >60s en la generación estática de Vercel.
// Con force-dynamic, se renderiza on-demand y Vercel CDN cachea.
// Las queries internas usan unstable_cache (5 min) así que el costo
// de Turso es mínimo después del primer hit.
export const dynamic = 'force-dynamic'

// Dynamic metadata for category pages
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params
  const { q } = await searchParams

  if (q) {
    return {
      title: `Resultados para "${q}"`,
      description: `Resultados de búsqueda para "${q}" en Compucity. Encontrá notebooks, componentes y periféricos online.`,
      alternates: {
        canonical: `https://www.compucityonline.com.ar/categoria/${slug}?q=${encodeURIComponent(q)}`,
      },
    }
  }

  const category = await getCategoryBySlug(slug)

  if (!category && slug !== 'todos') {
    return { title: 'Categoría no encontrada' }
  }

  const name = slug === 'todos' ? 'Todos los productos' : category?.name ?? slug
  const description = slug === 'todos'
    ? 'Explorá todo nuestro catálogo de productos de informática. Notebooks, componentes, periféricos y más. Envíos a todo el país desde La Falda, Córdoba.'
    : `${name} en Compucity. Comprá online con envíos a todo el país desde La Falda, Córdoba. Las mejores marcas y asesoramiento personalizado.`

  return {
    title: `${name} - Comprá Online`,
    description,
    alternates: {
      canonical: `https://www.compucityonline.com.ar/categoria/${slug}`,
    },
    openGraph: {
      title: `${name} | Compucity`,
      description,
      url: `https://www.compucityonline.com.ar/categoria/${slug}`,
      type: 'website',
    },
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { q } = await searchParams

  // Get only enabled categories for the storefront
  const categories = await getEnabledCategories()

  // Search or list products
  let products
  if (q) {
    // When there's a search query, search across all products
    products = await searchProducts(q, 200)
  } else if (slug === 'todos') {
    products = await getAllActiveProducts()
  } else {
    products = await getProductsByCategory(slug)
  }

  // Find current category
  const currentCategory = categories.find(c => c.slug === slug)

  if (slug !== 'todos' && !currentCategory) {
    notFound()
  }

  const categoryName = q
    ? `Resultados para "${q}"`
    : slug === 'todos'
      ? 'Todos los productos'
      : currentCategory?.name ?? slug

  // Sesión 46: revertido a queries directas (el cálculo en memoria causaba 500).
  // Las queries originales funcionaban correctamente.
  // Get subcategories for the current category (only enabled)
  let subcategories: { id: string; name: string; slug: string }[] = []
  let parentCategory: { id: string; name: string; slug: string } | null = null

  if (currentCategory) {
    // Check if this is a parent category → get its enabled children
    const subResult = await db.execute({
      sql: 'SELECT id, name, slug FROM categories WHERE parentId = ? AND enabled = 1 ORDER BY name',
      args: [currentCategory.id],
    })
    subcategories = (subResult.rows as any[]).map(r => ({ id: String(r.id), name: String(r.name), slug: String(r.slug) }))

    // Check if this is a subcategory → get parent and siblings
    if (currentCategory.parentId && subcategories.length === 0) {
      const parentResult = await db.execute({
        sql: 'SELECT id, name, slug FROM categories WHERE id = ? AND enabled = 1',
        args: [currentCategory.parentId],
      })
      parentCategory = (parentResult.rows as any[]).map(r => ({ id: String(r.id), name: String(r.name), slug: String(r.slug) }))[0] || null

      // Get siblings (other enabled subcategories of the same parent)
      if (parentCategory) {
        const siblingsResult = await db.execute({
          sql: 'SELECT id, name, slug FROM categories WHERE parentId = ? AND enabled = 1 ORDER BY name',
          args: [parentCategory.id],
        })
        subcategories = (siblingsResult.rows as any[]).map(r => ({ id: String(r.id), name: String(r.name), slug: String(r.slug) }))
      }
    } else if (subcategories.length > 0) {
      parentCategory = currentCategory
    }
  }

  // Build parent categories list for sidebar (only enabled root categories)
  const parentCategories = categories.filter(c => !c.parentId)

  // Notebook-related categories that should show the chatbot banner
  const NOTEBOOK_CATEGORIES = new Set(['notebooks', 'gamer-y-diseno', 'oficina'])
  const isNotebookCategory = NOTEBOOK_CATEGORIES.has(slug)

  // Build breadcrumb structured data
  const breadcrumbData = [
    { name: 'Inicio', url: '/' },
    ...(parentCategory && parentCategory.id !== currentCategory?.id
      ? [{ name: parentCategory.name, url: `/categoria/${parentCategory.slug}` }]
      : []),
    { name: categoryName, url: `/categoria/${slug}` },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Structured Data: Breadcrumb */}
      <JsonLd data={getBreadcrumbSchema(breadcrumbData)} />

      {/* Breadcrumb */}
      <Breadcrumbs
        items={
          parentCategory && parentCategory.id !== currentCategory?.id
            ? [
                { label: parentCategory.name, href: `/categoria/${parentCategory.slug}` },
                { label: categoryName },
              ]
            : [{ label: categoryName }]
        }
      />

      {/* Notebook Chat Banner - only on notebook-related categories */}
      {isNotebookCategory && <NotebookChatBanner />}

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="md:w-56 shrink-0">
          <h3 className="font-semibold text-gray-900 mb-3">Categorías</h3>
          <ul className="space-y-0.5">
            <li>
              <a href="/categoria/todos" className={`block px-3 py-1.5 rounded text-sm ${slug === 'todos' ? 'bg-compucity-green-50 text-compucity-green font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                Todos los productos
              </a>
            </li>
            {parentCategories.map((cat) => (
              <li key={cat.id}>
                <a
                  href={`/categoria/${cat.slug}`}
                  className={`block px-3 py-1.5 rounded text-sm ${slug === cat.slug ? 'bg-compucity-green-50 text-compucity-green font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {cat.name}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        {/* Products with Filters/Sort - Client Component */}
        <CategoryProducts
          products={products.map(p => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: p.price,
            comparePrice: p.comparePrice,
            images: p.images,
            stock: p.stock,
            createdAt: p.createdAt,
            salePrice: (p as any).salePrice ?? null,
            saleStart: (p as any).saleStart ?? null,
            saleEnd: (p as any).saleEnd ?? null,
            brandId: (p as any).brandId ?? null,
            brandName: (p as any).brandName ?? null,
          }))}
          subcategories={subcategories}
          currentCategory={currentCategory ? { id: currentCategory.id, name: currentCategory.name, slug: currentCategory.slug } : null}
          parentCategory={parentCategory ? { id: parentCategory.id, name: parentCategory.name, slug: parentCategory.slug } : null}
          categorySlug={slug}
          categoryName={categoryName}
          searchQuery={q ?? null}
        />
      </div>

      {/* Notebook assistant chatbot - on notebook-related categories */}
      {isNotebookCategory && <NotebookAssistantChat />}
    </div>
  )
}
