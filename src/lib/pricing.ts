/**
 * Pricing helpers for sale prices and promotions.
 */

interface ProductWithSale {
  price: number
  comparePrice?: number | null
  salePrice?: number | null
  saleStart?: string | null
  saleEnd?: string | null
}

/**
 * Returns the active sale price if the product has an active sale,
 * or null if no sale is active.
 *
 * A sale is active when:
 * - salePrice is set and > 0
 * - current date is between saleStart and saleEnd (inclusive)
 */
export function getActiveSale(product: ProductWithSale): number | null {
  if (!product.salePrice || product.salePrice <= 0) return null

  const now = new Date()

  // Check saleStart
  if (product.saleStart) {
    const start = new Date(product.saleStart)
    // Set to start of day
    start.setHours(0, 0, 0, 0)
    if (now < start) return null
  }

  // Check saleEnd
  if (product.saleEnd) {
    const end = new Date(product.saleEnd)
    // Set to end of day
    end.setHours(23, 59, 59, 999)
    if (now > end) return null
  }

  // If no dates are set but salePrice exists, it's always active
  return product.salePrice
}

/**
 * Returns the display prices for a product considering active sales.
 * Returns { displayPrice, originalPrice, isOnSale }
 *
 * - displayPrice: the price to show prominently (sale price if active, otherwise the normal price)
 * - originalPrice: the crossed-out price if there's a sale (the regular list price)
 * - isOnSale: whether an active sale is in effect
 */
export function getDisplayPrices(product: ProductWithSale): {
  displayPrice: number
  originalPrice: number | null
  isOnSale: boolean
} {
  const salePrice = getActiveSale(product)

  if (salePrice !== null && salePrice < product.price) {
    return {
      displayPrice: salePrice,
      originalPrice: product.price,
      isOnSale: true,
    }
  }

  return {
    displayPrice: product.price,
    originalPrice: null,
    isOnSale: false,
  }
}

/**
 * Returns the effective price for the cart (considering sale and cash discount).
 * Priority: sale price > comparePrice (cash) > list price
 */
export function getCartPrice(product: ProductWithSale): number {
  const salePrice = getActiveSale(product)
  if (salePrice !== null && salePrice < product.price) {
    return salePrice
  }
  // Use comparePrice (cash price) if available and lower than list price
  if (product.comparePrice && product.comparePrice < product.price) {
    return product.comparePrice
  }
  return product.price
}
