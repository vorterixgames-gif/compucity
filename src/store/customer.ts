/**
 * Customer store — Sesión 46
 *
 * Antes: Navbar hacía fetch a /api/customer/me en CADA navegación client-side
 * porque el state se perdía al re-montarse el componente.
 *
 * Ahora: Zustand store global que persiste el estado del customer entre
 * navegaciones. Solo se fetchea 1 vez (al primer montaje del Navbar).
 * Login/logout actualizan el store desde cualquier componente.
 */

import { create } from 'zustand'

interface CustomerInfo {
  id: string
  name: string
  email: string
  phone: string | null
  dni: string | null
  address?: string | null
  city?: string | null
  province?: string | null
  postalCode?: string | null
}

interface CustomerStore {
  customer: CustomerInfo | null
  loaded: boolean
  setCustomer: (c: CustomerInfo | null) => void
}

export const useCustomer = create<CustomerStore>((set) => ({
  customer: null,
  loaded: false,
  setCustomer: (c) => set({ customer: c, loaded: true }),
}))
