import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Carrito',
  description: 'Tu carrito de compras en Compucity. Productos de informática con envío a todo el país.',
  alternates: {
    canonical: 'https://www.compucityonline.com.ar/carrito',
  },
  robots: { index: false, follow: true },
}

export default function CarritoLayout({ children }: { children: React.ReactNode }) {
  return children
}
