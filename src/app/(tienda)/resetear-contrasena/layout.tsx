import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Restablecer Contraseña',
  description: 'Restablecé tu contraseña de Compucity.',
  robots: { index: false, follow: true },
}

export default function ResetearContrasenaLayout({ children }: { children: React.ReactNode }) {
  return children
}
