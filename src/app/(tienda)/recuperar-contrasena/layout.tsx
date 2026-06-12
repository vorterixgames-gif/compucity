import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Recuperar Contraseña',
  description: 'Recuperá tu contraseña de Compucity para acceder a tu cuenta.',
  robots: { index: false, follow: true },
}

export default function RecuperarContrasenaLayout({ children }: { children: React.ReactNode }) {
  return children
}
