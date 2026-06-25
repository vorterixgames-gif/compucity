import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"
import WhatsAppButton from "@/components/layout/WhatsAppButton"
import ScrollToTop from "@/components/layout/ScrollToTop"
import JsonLd, { getLocalBusinessSchema, getWebSiteSchema } from "@/components/seo/JsonLd"

// Sesión 46 fix: revertido a layout NO async.
// Un layout async en App Router hace que TODAS las páginas hijas se vuelvan
// dinámicas, rompiendo el revalidate=3600 de categorías y causando 500.
// Los fetches de categories/brands en Navbar/Footer se mantienen del lado del cliente
// pero optimizados con sessionStorage cache.
export default function TiendaLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <JsonLd data={getLocalBusinessSchema()} />
      <JsonLd data={getWebSiteSchema()} />

      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
      <ScrollToTop />
    </>
  )
}
