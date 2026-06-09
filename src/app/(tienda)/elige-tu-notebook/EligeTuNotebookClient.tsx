'use client'

import { MessageCircle, ArrowRight, Laptop } from 'lucide-react'
import Link from 'next/link'

export default function EligeTuNotebookClient() {
  const handleOpenChat = () => {
    const chatButton = document.querySelector('[aria-label="Encontrá tu notebook con Citi"]') as HTMLButtonElement
    if (chatButton) chatButton.click()
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
      <button
        onClick={handleOpenChat}
        className="inline-flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 font-semibold px-6 py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all text-lg"
      >
        <MessageCircle className="w-5 h-5" />
        Charlar con Citi
        <ArrowRight className="w-5 h-5" />
      </button>
      <Link
        href="/categoria/notebooks"
        className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white font-medium px-6 py-3.5 rounded-xl transition-all"
      >
        <Laptop className="w-5 h-5" />
        Ver todas las notebooks
      </Link>
    </div>
  )
}
