import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Finalizar Pedido',
  description: 'Completá tu pedido en Compucity. Envíos a todo el país o retirá en nuestra tienda en La Falda, Córdoba.',
  alternates: {
    canonical: 'https://www.compucityonline.com.ar/checkout',
  },
  robots: { index: false, follow: true },
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children
}
