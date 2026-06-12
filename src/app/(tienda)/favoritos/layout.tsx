import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Favoritos',
  description: 'Tus productos favoritos en Compucity. Guardá los productos que te interesan y compralos cuando quieras.',
  alternates: {
    canonical: 'https://www.compucityonline.com.ar/favoritos',
  },
  robots: { index: false, follow: true },
}

export default function FavoritosLayout({ children }: { children: React.ReactNode }) {
  return children
}
