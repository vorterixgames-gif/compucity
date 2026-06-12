import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mis Pedidos',
  description: 'Seguí tus pedidos en Compucity. Consultá el estado de tus compras online.',
  alternates: {
    canonical: 'https://www.compucityonline.com.ar/mis-pedidos',
  },
  robots: { index: false, follow: true },
}

export default function MisPedidosLayout({ children }: { children: React.ReactNode }) {
  return children
}
