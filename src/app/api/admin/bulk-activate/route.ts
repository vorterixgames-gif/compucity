import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

// SESIÓN 70: Reactivación masiva server-side (un solo UPDATE, sin N PUTs).
// Uso: POST /api/admin/bulk-activate  body: { providerIds: ["<elit-id>","<invid-id>"] }
// Reactiva (isActive=1) todos los productos inactivos de esos proveedores.
// Si providerIds vacío/ausente → reactiva todos los inactivos EXCEPTO Air Intra.
export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const providerIds: string[] = Array.isArray(body.providerIds) ? body.providerIds : []

    const now = new Date().toISOString()
    let sql: string
    let args: any[] = [now]
    if (providerIds.length > 0) {
      const ph = providerIds.map(() => '?').join(', ')
      sql = `UPDATE products SET isActive = 1, updatedAt = ? WHERE isActive = 0 AND providerId IN (${ph})`
      args = [now, ...providerIds]
    } else {
      sql = `UPDATE products SET isActive = 1, updatedAt = ? WHERE isActive = 0 AND (providerId IS NULL OR providerId != 'air-intra-1780331633566')`
    }

    const res = await db.execute({ sql, args })
    const affected = (res as any).rowsAffected ?? (res as any).response?.result?.affected_row_count ?? -1
    return NextResponse.json({ ok: true, reactivated: affected })
  } catch (error: any) {
    console.error('bulk-activate error:', error)
    return NextResponse.json({ ok: false, error: error.message || 'Error interno' }, { status: 500 })
  }
}
