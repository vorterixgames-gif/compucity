'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Bot,
  User,
  ShoppingCart,
  Check,
  Sparkles,
} from 'lucide-react'

// ============================================
// Types
// ============================================

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface BuildComponent {
  slot: string
  label: string
  productId: string
  productName: string
  productPrice: number
  productComparePrice: number
  productSlug: string
  productImages: string
  productStock: number
  productSpecs: string
  quantity: number
}

interface SuggestedBuild {
  name: string
  description: string
  totalPrice: number
  totalListPrice: number
  components: BuildComponent[]
}

interface BuilderProduct {
  id: string
  name: string
  slug: string
  price: number
  comparePrice: number | null
  costPrice: number | null
  images: string
  stock: number
  specs: string
  _calculated: boolean
}

interface SelectedComponent {
  slot: string
  product: BuilderProduct
  quantity: number
}

interface PCAssistantChatProps {
  onLoadBuild: (components: SelectedComponent[]) => void
}

// ============================================
// Helpers
// ============================================

function formatPrice(n: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function safeParseFirstImage(images: string | null): string | null {
  if (!images) return null
  try { return JSON.parse(images)[0] } catch { return null }
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: '¡Hola! Soy el asistente de Compucity. Te ayudo a armar la PC ideal según tus necesidades y presupuesto. ¿Para qué vas a usar la PC? (gaming, trabajo, diseño, programación, etc.)',
}

// ============================================
// Component
// ============================================

export default function PCAssistantChat({ onLoadBuild }: PCAssistantChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [builds, setBuilds] = useState<SuggestedBuild[] | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, builds])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const sendMessage = async () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    const userMessage: ChatMessage = { role: 'user', content: trimmed }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/pc-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      const data = await res.json()

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message || 'Disculpá, no entendí. ¿Podés repetir?',
      }
      setMessages(prev => [...prev, assistantMessage])

      // If builds are returned, show them
      if (data.builds && data.builds.length > 0) {
        setBuilds(data.builds)
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Disculpá, hubo un error de conexión. Intentá de nuevo.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleLoadBuild = (build: SuggestedBuild) => {
    const components: SelectedComponent[] = build.components.map(c => ({
      slot: c.slot,
      product: {
        id: c.productId,
        name: c.productName,
        slug: c.productSlug,
        price: c.productPrice,
        comparePrice: c.productComparePrice,
        costPrice: null,
        images: c.productImages,
        stock: c.productStock,
        specs: c.productSpecs,
        _calculated: true,
      },
      quantity: c.quantity,
    }))

    onLoadBuild(components)
    setIsOpen(false)

    // Reset chat for next time
    setMessages([INITIAL_MESSAGE])
    setBuilds(null)
    setInput('')
  }

  const resetChat = () => {
    setMessages([INITIAL_MESSAGE])
    setBuilds(null)
    setInput('')
  }

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group"
        >
          <Sparkles className="w-5 h-5 group-hover:animate-pulse" />
          <span className="font-medium text-sm">Asistente IA</span>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Asistente Compucity</h3>
                <p className="text-[11px] text-purple-200">Te ayudo a armar tu PC ideal</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={resetChat}
                className="p-1.5 hover:bg-white/10 rounded-lg transition"
                title="Reiniciar conversación"
              >
                <Sparkles className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user'
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'bg-purple-100 text-purple-600'
                }`}>
                  {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                {/* Message Bubble */}
                <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-md'
                    : 'bg-white text-gray-700 border border-gray-200 rounded-tl-md shadow-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Pensando...
                  </div>
                </div>
              </div>
            )}

            {/* Suggested Builds */}
            {builds && builds.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
                  <ShoppingCart className="w-4 h-4" />
                  Opciones para vos
                </div>

                {builds.map((build, bi) => (
                  <div
                    key={bi}
                    className="bg-white border border-purple-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition"
                  >
                    {/* Build Header */}
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-3 border-b border-purple-100">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm text-gray-800">{build.name}</h4>
                        <div className="text-right">
                          <div className="text-sm font-bold text-green-700">
                            {formatPrice(build.totalPrice)}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            Lista: {formatPrice(build.totalListPrice)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Build Components */}
                    <div className="px-4 py-2.5 space-y-1.5">
                      {build.components.map((comp, ci) => (
                        <div key={ci} className="flex items-center gap-2 text-xs">
                          <span className="text-purple-500 font-medium w-24 shrink-0">{comp.label}</span>
                          <span className="text-gray-700 truncate flex-1">{comp.productName}</span>
                          <span className="text-gray-400 shrink-0">
                            {formatPrice(comp.productComparePrice)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Load Build Button */}
                    <div className="px-4 py-3 border-t border-gray-100">
                      <button
                        onClick={() => handleLoadBuild(build)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg text-sm font-medium transition shadow-sm hover:shadow"
                      >
                        <Check className="w-4 h-4" />
                        Cargar al builder
                      </button>
                    </div>
                  </div>
                ))}

                {/* Build description (AI text) */}
                {builds[0]?.description && (
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-md px-3.5 py-2.5 shadow-sm max-w-[85%] text-sm text-gray-700 leading-relaxed">
                      {builds[0].description}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="px-4 py-3 border-t border-gray-200 bg-white shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={builds ? '¿Querés otra opción?' : 'Escribí tu mensaje...'}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent disabled:opacity-50 placeholder-gray-400"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-purple-600 hover:bg-purple-700 text-white transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
