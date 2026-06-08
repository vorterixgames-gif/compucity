/**
 * Keys to hide from customer-facing spec displays.
 * These are internal/supplier fields not relevant for customers.
 */
export const HIDDEN_SPEC_KEYS = new Set([
  'Moneda',
  'EAN',
  'Garantía',
  'GARANTIA',
  'garantia',
  'Moneda DOL',
  'Moneda USD',
  'ID',
  'Código',
  'Codigo',
  'Proveedor',
  'Costo',
  'Margen',
])

/**
 * Filter out internal/supplier specs, returning only customer-visible entries.
 */
export function getVisibleSpecs(specs: Record<string, string>): [string, string][] {
  return Object.entries(specs).filter(([key]) => !HIDDEN_SPEC_KEYS.has(key))
}
