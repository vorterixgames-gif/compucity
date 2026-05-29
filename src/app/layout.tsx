import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Compucity - Tu Mundo Digital | Tienda Online de Informática",
  description: "Tienda online de notebooks, componentes, periféricos y accesorios de informática. Envíos a todo el país desde La Falda, Córdoba. Hacé tu pedido por WhatsApp.",
  keywords: ["compucity", "notebooks", "componentes pc", "periféricos", "informática", "Córdoba", "tienda online"],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "64x64 48x48 32x32 16x16" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Compucity - Tu Mundo Digital",
    description: "Tienda online de informática. Notebooks, componentes y más.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
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
