'use client'

import { Sparkles, MessageCircle, Laptop } from 'lucide-react'

export default function NotebookChatBanner() {
  const openChat = () => {
    // Find and click the floating notebook chat button
    const chatBtn = document.querySelector('[aria-label="Encontrá tu notebook con Citi"]') as HTMLButtonElement
    if (chatBtn) {
      chatBtn.click()
    }
  }

  return (
    <div className="mb-6 rounded-2xl overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white relative">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute -top-8 -right-8 w-48 h-48 bg-white rounded-full blur-2xl" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-blue-300 rounded-full blur-2xl" />
      </div>

      <div className="relative z-10 flex items-center gap-4 px-5 py-4 md:px-6 md:py-5">
        {/* Icon */}
        <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
          <Laptop className="w-6 h-6 md:w-7 md:h-7" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span className="text-xs font-medium text-blue-200 uppercase tracking-wide">Asistente inteligente</span>
          </div>
          <h3 className="text-base md:text-lg font-bold leading-tight">
            ¿No sabés cuál elegir? Hablá con Citi
          </h3>
          <p className="text-sm text-blue-100 mt-0.5 hidden sm:block">
            Contale qué necesitás y te recomienda 3 opciones ideales para vos
          </p>
        </div>

        {/* CTA Button */}
        <button
          onClick={openChat}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 md:px-5 md:py-3 bg-white text-blue-700 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl active:scale-95"
        >
          <MessageCircle className="w-4 h-4 md:w-5 md:h-5" />
          <span className="hidden sm:inline">Chatear ahora</span>
          <span className="sm:hidden">Chatear</span>
        </button>
      </div>
    </div>
  )
}
