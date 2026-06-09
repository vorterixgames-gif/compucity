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
  Laptop,
} from 'lucide-react'
import { useCart } from '@/store/cart'

// ============================================
// Types
// ============================================

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface NotebookSpecs {
  processor: string | null
  ram: string | null
  screen: string | null
  gpu: string | null
  storage: string | null
  brand: string | null
}

interface RecommendedNotebook {
  id: string
  name: string
  slug: string
  price: number
  comparePrice: number
  images: string
  stock: number
  specs: string
  tier: string
  reason: string
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

function parseSpecs(specsStr: string): NotebookSpecs {
  try { return JSON.parse(specsStr) } catch { return { processor: null, ram: null, screen: null, gpu: null, storage: null, brand: null } }
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: '¡Hola! Soy Citi de Compucity. Te ayudo a encontrar la notebook ideal según tus necesidades y presupuesto. ¿Para qué vas a usar la notebook? (gaming, oficina, estudiar, diseño, etc.)',
}

// ============================================
// Component
// ============================================

export default function NotebookAssistantChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [notebooks, setNotebooks] = useState<RecommendedNotebook[] | null>(null)
  const [description, setDescription] = useState<string | null>(null)
  const [addedToCart, setAddedToCart] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const addItem = useCart(s => s.addItem)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, notebooks])

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

    // If notebooks are showing, clear them so chat can continue normally
    if (notebooks) {
      setNotebooks(null)
      setDescription(null)
    }

    try {
      const res = await fetch('/api/notebook-assistant', {
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

      // If notebooks are returned, show them
      if (data.notebooks && data.notebooks.length > 0) {
        setNotebooks(data.notebooks)
        setDescription(data.description || null)
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

  const handleAddToCart = (notebook: RecommendedNotebook) => {
    const image = safeParseFirstImage(notebook.images)
    addItem({
      id: notebook.id,
      name: notebook.name,
      price: notebook.comparePrice,
      image: image || '/placeholder-product.png',
      slug: notebook.slug,
    })
    setAddedToCart(notebook.id)

    // Add confirmation message
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: `¡Listo! Agregué la ${notebook.name} a tu carrito. ¿Te puedo ayudar con algo más?`,
      },
    ])

    // Clear added state after 2 seconds
    setTimeout(() => setAddedToCart(null), 2000)
  }

  const resetChat = () => {
    setMessages([INITIAL_MESSAGE])
    setNotebooks(null)
    setDescription(null)
    setInput('')
    setAddedToCart(null)
  }

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-28 right-5 md:bottom-6 md:right-6 z-50 flex items-center gap-2 p-4 md:px-5 md:py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group"
          aria-label="Encontrá tu notebook con Citi"
        >
          <Laptop className="w-5 h-5 group-hover:animate-pulse" />
          <span className="font-medium text-sm hidden md:inline">Encontrá tu notebook</span>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] h-[620px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Laptop className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Citi Notebooks</h3>
                <p className="text-[11px] text-blue-200">Te ayudo a encontrar tu notebook ideal</p>
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
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-blue-50 text-blue-600'
                }`}>
                  {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                {/* Message Bubble */}
                <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-md'
                    : 'bg-white text-gray-700 border border-gray-200 rounded-tl-md shadow-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Buscando notebooks...
                  </div>
                </div>
              </div>
            )}

            {/* Recommended Notebooks */}
            {notebooks && notebooks.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                  <Laptop className="w-4 h-4" />
                  Opciones para vos
                </div>

                {notebooks.map((nb, bi) => {
                  const specs = parseSpecs(nb.specs)
                  const image = safeParseFirstImage(nb.images)
                  const isAdded = addedToCart === nb.id

                  return (
                    <div
                      key={bi}
                      className="bg-white border border-blue-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition"
                    >
                      {/* Notebook Header */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-blue-200">
                        <div className="flex items-center gap-3">
                          {/* Image */}
                          {image ? (
                            <img
                              src={image}
                              alt={nb.name}
                              className="w-12 h-12 object-contain rounded bg-white p-1 border border-gray-100"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-white border border-gray-100 flex items-center justify-center">
                              <Laptop className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                {nb.tier}
                              </span>
                            </div>
                            <h4 className="font-semibold text-sm text-gray-800 mt-1 truncate">{nb.name}</h4>
                            <p className="text-xs text-blue-600 mt-0.5">{nb.reason}</p>
                          </div>
                        </div>
                      </div>

                      {/* Specs */}
                      <div className="px-4 py-2.5 space-y-1.5">
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                          {specs.processor && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-gray-400">CPU:</span>
                              <span className="text-gray-700 truncate">{specs.processor}</span>
                            </div>
                          )}
                          {specs.ram && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-gray-400">RAM:</span>
                              <span className="text-gray-700">{specs.ram}</span>
                            </div>
                          )}
                          {specs.screen && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-gray-400">Pantalla:</span>
                              <span className="text-gray-700">{specs.screen}</span>
                            </div>
                          )}
                          {specs.gpu && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-gray-400">GPU:</span>
                              <span className="text-gray-700 truncate">{specs.gpu}</span>
                            </div>
                          )}
                          {specs.storage && (
                            <div className="flex items-center gap-1.5 text-xs col-span-2">
                              <span className="text-gray-400">Almacenamiento:</span>
                              <span className="text-gray-700">{specs.storage}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Price + Add to Cart */}
                      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-blue-700">
                            {formatPrice(nb.comparePrice)}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            Lista: {formatPrice(nb.price)}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddToCart(nb)}
                          disabled={isAdded}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition shadow-sm ${
                            isAdded
                              ? 'bg-green-500 text-white cursor-default'
                              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white hover:shadow'
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-4 h-4" />
                              En el carrito
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="w-4 h-4" />
                              Agregar al carrito
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* AI description */}
                {description && (
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-md px-3.5 py-2.5 shadow-sm max-w-[85%] text-sm text-gray-700 leading-relaxed">
                      {description}
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
                placeholder={notebooks ? 'Hacé una consulta o tocá ✨ para reiniciar' : 'Escribí tu mensaje...'}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 placeholder-gray-400"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
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
