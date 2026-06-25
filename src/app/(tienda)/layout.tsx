import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"
import WhatsAppButton from "@/components/layout/WhatsAppButton"
import ScrollToTop from "@/components/layout/ScrollToTop"
import JsonLd, { getLocalBusinessSchema, getWebSiteSchema } from "@/components/seo/JsonLd"
import { getEnabledCategories } from "@/lib/queries"
import { unstable_cache } from 'next/cache'

// Sesión 46: layout sigue siendo NO async para no romper páginas con revalidate.
// Las categorías se obtienen con unstable_cache (tag 'categories', TTL 5 min).
// Si la query falla, retorna [] y el sitio sigue funcionando (Navbar/Footer muestran defaults).
const getCachedEnabledCategories = unstable_cache(
  async () => {
    try {
      return await getEnabledCategories()
    } catch {
      return []
    }
  },
  ['enabled_categories'],
  { tags: ['categories'], revalidate: 300 }
)

export default async function TiendaLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const categories = await getCachedEnabledCategories()

  return (
    <>
      <JsonLd data={getLocalBusinessSchema()} />
      <JsonLd data={getWebSiteSchema()} />

      <Navbar categories={categories} />
      <main className="flex-1">{children}</main>
      <Footer categories={categories} />
      <WhatsAppButton />
      <ScrollToTop />
    </>
  )
}
