import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Arma tu PC',
  description: 'Armá tu PC a medida elegiendo cada componente. Procesadores, placas de video, memorias y más. Asesoramiento personalizado desde La Falda, Córdoba.',
  alternates: {
    canonical: 'https://www.compucityonline.com.ar/arma-tu-pc',
  },
  openGraph: {
    title: 'Arma tu PC a Medida | Compucity',
    description: 'Armá tu PC a medida eligiendo cada componente. Procesadores, placas de video, memorias y más.',
    url: 'https://www.compucityonline.com.ar/arma-tu-pc',
  },
}

export default function ArmaTuPcLayout({ children }: { children: React.ReactNode }) {
  return children
}
