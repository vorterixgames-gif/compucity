'use client'

import { MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function WhatsAppButton() {
  const phoneNumber = '5493548402056'
  const message = encodeURIComponent('Hola! Quisiera hacer una consulta sobre un producto de Compucity')
  const [bottomClass, setBottomClass] = useState('bottom-6')

  // Detect if there's a sticky bottom bar (arma-tu-pc mobile bar) and move WhatsApp above it
  useEffect(() => {
    const checkForStickyBar = () => {
      const stickyBar = document.querySelector('.lg\\:hidden.fixed.bottom-0')
      if (stickyBar) {
        setBottomClass('bottom-24')
      } else {
        setBottomClass('bottom-6')
      }
    }

    checkForStickyBar()
    const observer = new MutationObserver(checkForStickyBar)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    <a
      href={`https://wa.me/${phoneNumber}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed ${bottomClass} left-4 md:left-6 z-40 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-full p-3.5 md:p-4 shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-110 group`}
      aria-label="Contactar por WhatsApp"
    >
      <MessageCircle className="h-5 w-5 md:h-6 md:w-6" />
      {/* Tooltip */}
      <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg">
        Chateá con nosotros
      </span>
    </a>
  )
}
