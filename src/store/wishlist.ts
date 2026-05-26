'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WishlistStore {
  items: string[]
  toggleItem: (id: string) => void
  isInWishlist: (id: string) => boolean
}

export const useWishlist = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],
      toggleItem: (id: string) => {
        const items = get().items
        if (items.includes(id)) {
          set({ items: items.filter((i) => i !== id) })
        } else {
          set({ items: [...items, id] })
        }
      },
      isInWishlist: (id: string) => {
        return get().items.includes(id)
      },
    }),
    { name: 'compucity-wishlist' }
  )
)
