import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

// SESIÓN 79 (opción 3): historial de métricas de sync por proveedor.
// Lee supplier_sync_stats (la escriben los scripts de GitHub Actions en cada corrida).
// Si la tabla aún no existe (antes de la primera corrida post-deploy), devuelve lista vacía.
export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const limit = Math.min(100, Number(request.nextUrl.searchParams.get('limit')) || 30)
    try {
      const res = await db.execute({
        sql: `SELECT * FROM supplier_sync_stats ORDER BY runAt DESC LIMIT ?`,
        args: [limit],
      })
      return NextResponse.json({ ok: true, stats: res.rows as any[] })
    } catch (e: any) {
      // Tabla aún no creada -> vacío (no romper el admin)
      return NextResponse.json({ ok: true, stats: [], note: 'tabla supplier_sync_stats aún sin corridas' })
    }
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || 'Error interno' }, { status: 500 })
  }
}
