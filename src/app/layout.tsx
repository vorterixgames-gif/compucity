import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://www.compucityonline.com.ar";

export const viewport: Viewport = {
  themeColor: "#0d7c3f",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Compucity - Tu Mundo Digital | Tienda de Informática en La Falda, Córdoba",
    template: "%s | Compucity",
  },
  description:
    "Tienda online de notebooks, componentes, periféricos y accesorios de informática. Envíos a todo el país desde La Falda, Córdoba. Comprá online con asesoramiento personalizado.",
  keywords: [
    "compucity",
    "tienda de informática La Falda",
    "notebooks Córdoba",
    "componentes pc",
    "periféricos gaming",
    "informática Argentina",
    "tienda online informática",
    "placas de video",
    "armar pc",
    "monitores",
    "La Falda Córdoba",
    "Valle de Punilla",
    "comprar notebook online",
  ],
  authors: [{ name: "Compucity" }],
  creator: "Compucity",
  publisher: "Compucity",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "64x64 48x48 32x32 16x16" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Compucity - Tu Mundo Digital | Tienda de Informática",
    description:
      "Tienda online de notebooks, componentes, periféricos y accesorios. Envíos a todo el país desde La Falda, Córdoba.",
    url: SITE_URL,
    siteName: "Compucity",
    locale: "es_AR",
    type: "website",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Compucity - Tu Mundo Digital - Tienda de Informática en La Falda, Córdoba",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Compucity - Tu Mundo Digital",
    description:
      "Tienda online de notebooks, componentes y periféricos. Envíos a todo el país.",
    images: ["/images/og-image.jpg"],
  },
  alternates: {
    canonical: SITE_URL,
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-gray-900`}
      >
        <div className="min-h-screen flex flex-col">
          {children}
        </div>
        <Toaster />
      </body>
    </html>
  );
}
