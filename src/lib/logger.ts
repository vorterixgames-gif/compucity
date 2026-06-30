/**
 * Logger que respeta el entorno de ejecución.
 *
 * Sesión 45 QA Fase 1: los console.log en producción consumen Fluid CPU para
 * formatear el mensaje (JSON.stringify, template literals) y enviar los logs
 * a Vercel Observability. El agente de QA detectó 381 console.log en 57 archivos.
 *
 * Este logger:
 * - En desarrollo (NODE_ENV !== 'production'): se comporta como console.log
 * - En producción: los métodos debug/info son no-op (no consumen CPU)
 * - En producción: los métodos warn/error SIEMPRE loguean (necesarios para detectar problemas)
 *
 * Uso:
 *   import { logger } from '@/lib/logger'
 *   logger.debug('mensaje', data)   // no-op en prod
 *   logger.info('mensaje')          // no-op en prod
 *   logger.warn('mensaje', data)    // siempre loguea
 *   logger.error('mensaje', error)  // siempre loguea
 */

const isProduction = process.env.NODE_ENV === 'production'

export const logger = {
  /** Logs de debug detallados. No-op en producción. */
  debug: (...args: any[]) => {
    if (!isProduction) console.log(...args)
  },

  /** Logs informativos. No-op en producción. */
  info: (...args: any[]) => {
    if (!isProduction) console.log(...args)
  },

  /** Warnings. SIEMPRE loguean (incluso en producción). */
  warn: (...args: any[]) => {
    console.warn(...args)
  },

  /** Errores. SIEMPRE loguean (incluso en producción). */
  error: (...args: any[]) => {
    console.error(...args)
  },
}
