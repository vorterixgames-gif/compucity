/**
 * Format utilities — Sesión 46
 *
 * Centraliza el formateo de precios para evitar recrear Intl.NumberFormat
 * en cada render de cada componente.
 *
 * Antes: `const formatPrice = (n) => new Intl.NumberFormat(...)` aparecía
 * en 8+ archivos, creando una nueva instancia en cada render.
 *
 * Ahora: una sola instancia del formatter, compartida entre todos los componentes.
 */

const arsFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
})

/**
 * Formatea un número como moneda argentina (ARS).
 * Ej: 459471 → "$ 459.471,00"
 */
export const formatARS = (n: number): string => arsFormatter.format(n)
