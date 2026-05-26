import CategoryProducts from '@/components/ui-custom/CategoryProducts'
import Breadcrumbs from '@/components/ui-custom/Breadcrumbs'
import { getEnabledCategories, getProductsByCategory, getAllActiveProducts } from '@/lib/queries'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string }>
}

export const dynamic = 'force-dynamic'

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { q } = await searchParams

  // Get only enabled categories for the storefront
  const categories = await getEnabledCategories()
  const products = slug === 'todos'
    ? await getAllActiveProducts()
    : await getProductsByCategory(slug)

  // Find current category
  const currentCategory = categories.find(c => c.slug === slug)

  if (slug !== 'todos' && !currentCategory) {
    notFound()
  }

  const categoryName = slug === 'todos'
    ? 'Todos los productos'
    : currentCategory?.name ?? slug

  // Get subcategories for the current category (only enabled)
  let subcategories: { id: string; name: string; slug: string }[] = []
  let parentCategory: { id: string; name: string; slug: string } | null = null

  if (currentCategory) {
    // Check if this is a parent category → get its enabled children
    const subResult = await db.execute({
      sql: 'SELECT id, name, slug FROM categories WHERE parentId = ? AND enabled = 1 ORDER BY name',
      args: [currentCategory.id],
    })
    subcategories = subResult.rows as any[]

    // Check if this is a subcategory → get parent and siblings
    if (currentCategory.parentId && subcategories.length === 0) {
      const parentResult = await db.execute({
        sql: 'SELECT id, name, slug FROM categories WHERE id = ? AND enabled = 1',
        args: [currentCategory.parentId],
      })
      parentCategory = (parentResult.rows as any[])[0] || null

      // Get siblings (other enabled subcategories of the same parent)
      if (parentCategory) {
        const siblingsResult = await db.execute({
          sql: 'SELECT id, name, slug FROM categories WHERE parentId = ? AND enabled = 1 ORDER BY name',
          args: [parentCategory.id],
        })
        subcategories = siblingsResult.rows as any[]
      }
    } else if (subcategories.length > 0) {
      parentCategory = currentCategory
    }
  }

  // Build parent categories list for sidebar (only enabled root categories)
  const parentCategories = categories.filter(c => !c.parentId)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
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
          }))}
          subcategories={subcategories}
          currentCategory={currentCategory ? { id: currentCategory.id, name: currentCategory.name, slug: currentCategory.slug } : null}
          parentCategory={parentCategory}
          categorySlug={slug}
          categoryName={categoryName}
        />
      </div>
    </div>
  )
}
