import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/pc-builder-slots
 * Public endpoint - returns enabled PC Builder slots (no auth required).
 * Used by the storefront Arma tu PC page.
 * Falls back to hardcoded defaults if no config exists.
 */
export async function GET() {
  try {
    const result = await db.execute({
      sql: 'SELECT value FROM store_config WHERE key = ?',
      args: ['pc_builder_slots'],
    })

    if (result.rows.length > 0) {
      try {
        const config = JSON.parse((result.rows[0] as any).value)
        // Only return enabled slots, sorted by order
        const enabledSlots = config
          .filter((s: any) => s.enabled !== false)
          .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        return NextResponse.json({ ok: true, slots: enabledSlots })
      } catch {
        // JSON parse failed, fall through to defaults
      }
    }

    // Return default slots (all enabled)
    return NextResponse.json({ ok: true, slots: DEFAULT_PUBLIC_SLOTS })
  } catch (error) {
    console.error('Get public PC builder slots error:', error)
    return NextResponse.json({ ok: true, slots: DEFAULT_PUBLIC_SLOTS })
  }
}

// Default slots for public API (same as hardcoded in arma-tu-pc/page.tsx)
const DEFAULT_PUBLIC_SLOTS = [
  { slot: 'processor', label: 'Microprocesador', categorySlug: 'microprocesadores', required: true, maxQty: 1, order: 0, icon: 'Cpu' },
  { slot: 'motherboard', label: 'Motherboard', categorySlug: 'motherboards', required: true, maxQty: 1, order: 1, icon: 'CircuitBoard' },
  { slot: 'ram', label: 'Memoria RAM', categorySlug: 'memoria-ram-pc', required: true, maxQty: 4, order: 2, icon: 'Zap' },
  { slot: 'gpu', label: 'Placa de Video', categorySlug: 'placas-de-video', required: false, maxQty: 1, order: 3, icon: 'Gamepad2' },
  { slot: 'ssd', label: 'Disco SSD', categorySlug: 'discos-ssd', required: true, maxQty: 4, order: 4, icon: 'HardDrive' },
  { slot: 'hdd', label: 'Disco HDD', categorySlug: 'discos-hdd', required: false, maxQty: 2, order: 5, icon: 'HardDrive' },
  { slot: 'psu', label: 'Fuente', categorySlug: 'fuentes', required: true, maxQty: 1, order: 6, icon: 'Plug' },
  { slot: 'case', label: 'Gabinete', categorySlug: 'gabinetes', additionalCategorySlugs: ['gabinetes-con-fuente'], required: true, maxQty: 1, order: 7, icon: 'Box' },
  { slot: 'cooling', label: 'Refrigeración', categorySlug: 'refrigeracion', required: false, maxQty: 1, order: 8, icon: 'Wind' },
  { slot: 'thermal', label: 'Pasta Térmica', categorySlug: 'pastas-termicas', required: false, maxQty: 1, order: 9, icon: 'Droplets' },
  { slot: 'monitor', label: 'Monitor', categorySlug: 'monitores', required: false, maxQty: 2, order: 10, icon: 'Monitor' },
  { slot: 'network', label: 'Placa de Red / WiFi', categorySlug: 'placas-de-red', required: false, maxQty: 1, order: 11, icon: 'Wifi' },
  { slot: 'peripherals', label: 'Periféricos', categorySlug: 'perifericos', required: false, maxQty: 3, order: 12, icon: 'Mouse' },
]
