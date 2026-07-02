import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/pc-builder-slots
 * Returns the PC Builder slots configuration.
 * If no config exists in store_config, returns the default hardcoded slots.
 */
export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const result = await db.execute({
      sql: 'SELECT value FROM store_config WHERE key = ?',
      args: ['pc_builder_slots'],
    })

    if (result.rows.length > 0) {
      try {
        const config = JSON.parse((result.rows[0] as any).value)
        return NextResponse.json({ ok: true, slots: config, source: 'database' })
      } catch {
        // JSON parse failed, return defaults
      }
    }

    // Return default hardcoded slots
    return NextResponse.json({ ok: true, slots: DEFAULT_SLOTS, source: 'default' })
  } catch (error) {
    console.error('Get PC builder slots error:', error)
    return NextResponse.json({ ok: true, slots: DEFAULT_SLOTS, source: 'default' })
  }
}

/**
 * PUT /api/admin/pc-builder-slots
 * Saves the PC Builder slots configuration to store_config.
 * 
 * Expected body: { slots: BuilderSlotConfig[] }
 * 
 * Each slot: { slot, label, categorySlug, enabled, required, maxQty, order, icon?, additionalCategorySlugs? }
 */
export async function PUT(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { slots } = body as { slots: BuilderSlotConfig[] }

    if (!slots || !Array.isArray(slots)) {
      return NextResponse.json({ error: 'slots debe ser un array' }, { status: 400 })
    }

    // Validate each slot
    for (const slot of slots) {
      if (!slot.slot || !slot.label || !slot.categorySlug) {
        return NextResponse.json({ 
          error: `Slot inválido: debe tener slot, label y categorySlug. Recibido: ${JSON.stringify(slot)}` 
        }, { status: 400 })
      }
      // Ensure slot key only contains safe characters
      if (!/^[a-z][a-z0-9_-]*$/.test(slot.slot)) {
        return NextResponse.json({ 
          error: `Slot key "${slot.slot}" inválido. Solo letras minúsculas, números, guiones y guiones bajos. Debe empezar con letra.` 
        }, { status: 400 })
      }
    }

    // Check for duplicate slot keys
    const slotKeys = slots.map(s => s.slot)
    if (new Set(slotKeys).size !== slotKeys.length) {
      return NextResponse.json({ error: 'Hay slot keys duplicados' }, { status: 400 })
    }

    const value = JSON.stringify(slots)
    const now = new Date().toISOString()

    // Upsert into store_config
    const existing = await db.execute({
      sql: 'SELECT id FROM store_config WHERE key = ?',
      args: ['pc_builder_slots'],
    })

    if (existing.rows.length > 0) {
      await db.execute({
        sql: 'UPDATE store_config SET value = ?, updatedAt = ? WHERE key = ?',
        args: [value, now, 'pc_builder_slots'],
      })
    } else {
      const id = crypto.randomUUID()
      await db.execute({
        sql: 'INSERT INTO store_config (id, key, value, updatedAt) VALUES (?, ?, ?, ?)',
        args: [id, 'pc_builder_slots', value, now],
      })
    }

    return NextResponse.json({ ok: true, slots })
  } catch (error) {
    console.error('Save PC builder slots error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/pc-builder-slots
 * Removes the custom config from store_config, reverting to hardcoded defaults.
 */
export async function DELETE() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    await db.execute({
      sql: 'DELETE FROM store_config WHERE key = ?',
      args: ['pc_builder_slots'],
    })

    return NextResponse.json({ ok: true, message: 'Configuración eliminada. Se usarán los valores por defecto.' })
  } catch (error) {
    console.error('Delete PC builder slots error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

// ============================================
// Types
// ============================================

export interface BuilderSlotConfig {
  slot: string           // e.g., 'processor', 'ram', 'gpu'
  label: string          // e.g., 'Microprocesador', 'Memoria RAM'
  categorySlug: string   // e.g., 'microprocesadores', 'memorias-ram'
  additionalCategorySlugs?: string[] // e.g., ['gabinetes-con-fuente'] for case
  includedSubcategorySlugs?: string[] // e.g., ['mouse-gamer', 'teclados-gamer'] — if set, only these subcategories are included; if empty/missing, ALL subcategories are included (default behavior)
  enabled: boolean       // whether this slot appears in the builder
  required: boolean      // whether the user must select something
  maxQty: number         // max quantity (1 for most, 4 for RAM, etc.)
  order: number          // display order
  icon?: string          // icon name (optional, for admin display)
}

/**
 * Default slots matching the current hardcoded configuration.
 * These are used as fallback when no custom config exists in the DB.
 * IMPORTANT: Keep this in sync with the SLOTS array in arma-tu-pc/page.tsx
 * and COMPONENT_SLOTS in pc-builder/route.ts
 */
const DEFAULT_SLOTS: BuilderSlotConfig[] = [
  { slot: 'processor', label: 'Microprocesador', categorySlug: 'microprocesadores', enabled: true, required: true, maxQty: 1, order: 0, icon: 'Cpu' },
  { slot: 'motherboard', label: 'Motherboard', categorySlug: 'motherboards', enabled: true, required: true, maxQty: 1, order: 1, icon: 'CircuitBoard' },
  { slot: 'ram', label: 'Memoria RAM', categorySlug: 'memorias-ram', enabled: true, required: true, maxQty: 4, order: 2, icon: 'Zap' },
  { slot: 'gpu', label: 'Placa de Video', categorySlug: 'placas-de-video', enabled: true, required: false, maxQty: 1, order: 3, icon: 'Gamepad2' },
  { slot: 'ssd', label: 'Disco SSD', categorySlug: 'discos-ssd', enabled: true, required: true, maxQty: 4, order: 4, icon: 'HardDrive' },
  { slot: 'hdd', label: 'Disco HDD', categorySlug: 'discos-hdd', enabled: true, required: false, maxQty: 2, order: 5, icon: 'HardDrive' },
  { slot: 'psu', label: 'Fuente', categorySlug: 'fuentes', enabled: true, required: true, maxQty: 1, order: 6, icon: 'Plug' },
  { slot: 'case', label: 'Gabinete', categorySlug: 'gabinetes', additionalCategorySlugs: ['gabinetes-con-fuente'], enabled: true, required: true, maxQty: 1, order: 7, icon: 'Box' },
  { slot: 'cooling', label: 'Refrigeración', categorySlug: 'refrigeracion', enabled: true, required: false, maxQty: 1, order: 8, icon: 'Wind' },
  { slot: 'thermal', label: 'Pasta Térmica', categorySlug: 'pastas-termicas', enabled: true, required: false, maxQty: 1, order: 9, icon: 'Droplets' },
  { slot: 'monitor', label: 'Monitor', categorySlug: 'monitores', enabled: true, required: false, maxQty: 2, order: 10, icon: 'Monitor' },
  { slot: 'network', label: 'Placa de Red / WiFi', categorySlug: 'placas-de-red', enabled: true, required: false, maxQty: 1, order: 11, icon: 'Wifi' },
  { slot: 'peripherals', label: 'Periféricos', categorySlug: 'perifericos', enabled: true, required: false, maxQty: 3, order: 12, icon: 'Mouse' },
]
