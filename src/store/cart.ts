'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  id: string
  name: string
  price: number
  image: string
  quantity: number
  slug: string
  // Sesion 56: timestamp de cuando se agrego al carrito (o se refresco el precio).
  // Opcional para no romper carritos viejos guardados en localStorage que no tienen este campo.
  addedAt?: number
}

export interface AppliedCoupon {
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  description?: string
}

interface CartStore {
  items: CartItem[]
  lastAdded: string | null
  appliedCoupon: AppliedCoupon | null
  couponDiscount: number
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  totalItems: () => number
  totalPrice: () => number
  setLastAdded: (id: string | null) => void
  applyCoupon: (coupon: AppliedCoupon, discountAmount: number) => void
  removeCoupon: () => void
  // Sesion 56: refresca precios de items existentes (no toca quantity, no toca cupon).
  // Solo actualiza si el precio realmente cambio para evitar re-renders innecesarios.
  refreshPrices: (updates: Array<{ id: string; price: number }>) => void
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      lastAdded: null,
      appliedCoupon: null,
      couponDiscount: 0,
      setLastAdded: (id: string | null) => set({ lastAdded: id }),
      addItem: (item) => {
        const items = get().items
        const existing = items.find((i) => i.id === item.id)
        if (existing) {
          // Si ya existe, solo incrementa cantidad. NO actualiza addedAt ni price
          // (preserva el precio y timestamp original del item en carrito).
          set({
            items: items.map((i) =>
              i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
            ),
            lastAdded: item.id,
          })
        } else {
          set({ items: [...items, { ...item, quantity: 1, addedAt: Date.now() }], lastAdded: item.id })
        }
        // Auto-clear lastAdded after 600ms
        setTimeout(() => {
          set({ lastAdded: null })
        }, 600)
      },
      removeItem: (id) => {
        const newItems = get().items.filter((i) => i.id !== id)
        // If cart is empty after removal, also remove coupon
        if (newItems.length === 0) {
          set({ items: newItems, appliedCoupon: null, couponDiscount: 0 })
        } else {
          set({ items: newItems })
        }
      },
      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          const newItems = get().items.filter((i) => i.id !== id)
          if (newItems.length === 0) {
            set({ items: newItems, appliedCoupon: null, couponDiscount: 0 })
          } else {
            set({ items: newItems })
          }
        } else {
          set({
            items: get().items.map((i) =>
              i.id === id ? { ...i, quantity } : i
            ),
          })
        }
      },
      clearCart: () => set({ items: [], appliedCoupon: null, couponDiscount: 0 }),
      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      totalPrice: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      applyCoupon: (coupon, discountAmount) => set({ appliedCoupon: coupon, couponDiscount: discountAmount }),
      removeCoupon: () => set({ appliedCoupon: null, couponDiscount: 0 }),
      // Sesion 56: refresca precios en batch. Solo actualiza price y addedAt,
      // NO toca quantity, image, slug ni name (para no romper nada).
      // Solo aplica el update si el precio realmente cambio (evita re-renders innecesarios).
      refreshPrices: (updates) => {
        const items = get().items
        let changed = false
        const newItems = items.map((i) => {
          const u = updates.find((x) => x.id === i.id)
          if (u && Math.abs(u.price - i.price) > 0.001) {
            changed = true
            return { ...i, price: u.price, addedAt: Date.now() }
          }
          return i
        })
        if (changed) set({ items: newItems })
      },
    }),
    { name: 'compucity-cart' }
  )
)
