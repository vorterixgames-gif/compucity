import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"
import WhatsAppButton from "@/components/layout/WhatsAppButton"
import ScrollToTop from "@/components/layout/ScrollToTop"
import JsonLd, { getLocalBusinessSchema, getWebSiteSchema } from "@/components/seo/JsonLd"

export default function TiendaLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      {/* Structured Data: LocalBusiness + WebSite (GEO SEO) */}
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
