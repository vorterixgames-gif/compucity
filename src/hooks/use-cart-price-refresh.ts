'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useCart } from '@/store/cart'

// ============================================
// Sesión 56: refresh de precios del carrito
// ============================================
//
// Variante B + expiración de 1 hora.
//
// Comportamiento:
// - Items con <5 min en carrito: NO se refrescan (precio fresco)
// - Items con 5 min–1 hora: refresh silencioso al montar el componente
// - Items con >1 hora: NO se refrescan + se levanta flag showStaleWarning
//   para que la UI muestre un aviso pidiéndole al usuario que refresque
//
// Por qué:
// - 5 min: coincide con el cache del CDN de /api/products (s-maxage=300),
//   así que el fetch va a salir del cache casi siempre
// - 1 hora: si el usuario dejó el carrito abierto y se fue, no queremos
//   generar requests cada vez que vuelve. Mejor avisarle.
//
// Seguridad:
// - useEffect con array vacío: solo se ejecuta 1 vez al montar
// - ranRef previene doble ejecución en React StrictMode (dev)
// - Promise.allSettled: si un fetch falla, no rompe los demás
// - try/catch con console.error (no silent fail — lección s50)
// - No toca quantity, image, slug ni name (refreshPrices solo cambia price)
// - Si todo falla, no rompe nada: el backend recalcula en /api/orders (igual que hoy)

const STALE_THRESHOLD_MS = 5 * 60 * 1000    // 5 minutos
const EXPIRATION_THRESHOLD_MS = 60 * 60 * 1000  // 1 hora

export interface CartPriceRefreshResult {
  /** True si hay items con >1 hora en el carrito (mostrar aviso) */
  showStaleWarning: boolean
  /** True si el refresh está en curso (para mostrar spinner en el botón) */
  refreshing: boolean
  /** Refresca manualmente todos los items (para el botón "Refrescar precios") */
  manualRefresh: () => Promise<void>
}

export function useCartPriceRefresh(): CartPriceRefreshResult {
  const items = useCart((s) => s.items)
  const refreshPrices = useCart((s) => s.refreshPrices)
  const ranRef = useRef(false)
  const [showStaleWarning, setShowStaleWarning] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Función que hace el fetch real y actualiza precios.
  // Recibe los IDs a refrescar. Devuelve false si algún item está expirado (>1h).
  const doRefresh = useCallback(async (idsToRefresh: string[]): Promise<boolean> => {
    if (idsToRefresh.length === 0) return true

    setRefreshing(true)
    try {
      const updates: Array<{ id: string; price: number }> = []
      // Fetch paralelo (típicamente 1-5 items). Promise.allSettled para no romper todo si uno falla.
      const results = await Promise.allSettled(
        idsToRefresh.map((id) =>
          fetch(`/api/products?id=${encodeURIComponent(id)}`).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            return r.json()
          })
        )
      )

      const now = Date.now()
      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (r.status !== 'fulfilled') {
          // Log individual pero no rompe el loop (lección s50: no silent fail)
          console.error(`[cart-refresh] Falló fetch para ${idsToRefresh[i]}:`, r.reason)
          continue
        }
        const data = r.value
        if (!data?.ok || !data.product) continue

        const p = data.product
        // Misma lógica que ProductCard.tsx línea 37:
        // cartPrice = salePrice (si hay oferta activa) > comparePrice (efectivo) > price (lista)
        const hasSale =
          p.salePrice &&
          p.salePrice > 0 &&
          (!p.saleEnd || new Date(p.saleEnd).getTime() > now) &&
          (!p.saleStart || new Date(p.saleStart).getTime() < now)
        const cartPrice = hasSale
          ? p.salePrice
          : p.comparePrice && p.comparePrice < p.price
            ? p.comparePrice
            : p.price

        updates.push({ id: idsToRefresh[i], price: cartPrice })
      }

      if (updates.length > 0) {
        refreshPrices(updates)
      }
      return true
    } catch (e) {
      // No romper el carrito si el refresh falla — el backend recalcula igual en /api/orders
      console.error('[cart-refresh] Error general (non-fatal, backend recalcula en checkout):', e)
      return false
    } finally {
      setRefreshing(false)
    }
  }, [refreshPrices])

  // Auto-refresh al montar (1 sola vez)
  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const now = Date.now()
    const staleItems: string[] = []
    let hasExpired = false

    for (const item of items) {
      const addedAt = item.addedAt ?? 0  // items viejos sin addedAt se tratan como stale
      const ageMs = now - addedAt

      if (ageMs > EXPIRATION_THRESHOLD_MS) {
        // Expirado: no refrescar, marcar aviso
        hasExpired = true
      } else if (ageMs > STALE_THRESHOLD_MS) {
        // Stale: candidato a refresh
        staleItems.push(item.id)
      }
      // <5 min: fresco, no hacer nada
    }

    if (hasExpired) {
      setShowStaleWarning(true)
      // No refrescar automáticamente — el usuario debe tocar el botón
      return
    }

    if (staleItems.length > 0) {
      // Refresh silencioso
      doRefresh(staleItems)
    }
  }, [items, doRefresh])

  // Refresco manual (botón "Refrescar precios")
  const manualRefresh = useCallback(async () => {
    setShowStaleWarning(false)
    // Refrescar TODOS los items (no solo stale) porque el usuario lo pidió explícitamente
    await doRefresh(items.map((i) => i.id))
  }, [items, doRefresh])

  return { showStaleWarning, refreshing, manualRefresh }
}
