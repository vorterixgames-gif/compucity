import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="text-sm text-gray-500 mb-6" aria-label="Breadcrumb">
      <ol className="flex items-center flex-wrap gap-y-1">
        <li className="flex items-center">
          <Link
            href="/"
            className="hover:text-compucity-green transition inline-flex items-center gap-1"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Inicio</span>
          </Link>
        </li>
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={i} className="flex items-center">
              <ChevronRight className="h-3.5 w-3.5 mx-1.5 text-gray-400" />
              {isLast || !item.href ? (
                <span className="text-gray-900 font-medium">{item.label}</span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-compucity-green transition"
                >
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
