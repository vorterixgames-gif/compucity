import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"
import WhatsAppButton from "@/components/layout/WhatsAppButton"
import ScrollToTop from "@/components/layout/ScrollToTop"
import JsonLd, { getLocalBusinessSchema, getWebSiteSchema } from "@/components/seo/JsonLd"
import { getEnabledCategories } from "@/lib/queries"

// Sesión 46: convertido a async server component.
// Antes: Navbar, Footer y CategoryIcons hacían 3 fetches independientes a /api/categories.
// Ahora: 1 sola query cacheada (unstable_cache tag 'categories') desde el layout.
// Los 3 componentes reciben categorías como prop → 0 fetches client-side.
export default async function TiendaLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const categories = await getEnabledCategories()

  return (
    <>
      {/* Structured Data: LocalBusiness + WebSite (GEO SEO) */}
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
