import type { Metadata } from 'next'
import AdminLayoutClient from '@/components/admin/AdminLayoutClient'

// Prevent search engines from indexing any admin page
export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
