import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

// Sesión 56: endpoint para detectar productos "stale" (sin actualizar hace más de X días).
// Esto ayuda a detectar temprano si algún producto dejó de sincronizarse por rate limit,
// bug del sync, producto movido de posición en el catálogo del proveedor, etc.
//
// Criterio: productos con updatedAt < datetime('now', '-7 days')
// Incluye TODOS los productos (con y sin proveedor) — si un producto no se actualiza
// hace 7 días, algo está mal sin importar si tiene proveedor o no.

const STALE_DAYS = 7
const MAX_RESULTS = 500 // límite de seguridad para no devolver miles de filas

export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // SESIÓN 62: solo productos CON stock, y por defecto solo proveedores
    // principales (Air Intra, Elit, Invid, Eikon, BACKUP).
    // ?provider=all  -> todos (incluye cargas manuales)
    // ?provider=<nombre exacto> -> filtra por proveedor
    const provider = (request.nextUrl.searchParams.get('provider') || '').trim()
    let providerClause = `AND s.name IN ('Air Intra', 'Elit', 'Invid Computers', 'Eikon', 'BACKUP')`
    const args: (string | number)[] = []
    if (provider === 'all') {
      providerClause = ''
    } else if (provider !== '') {
      providerClause = 'AND s.name = ?'
      args.push(provider)
    }

    // Query 1: count total de productos stale (para mostrar el número en el banner)
    const countRes = await db.execute({
      sql: `SELECT COUNT(*) as count FROM products p
            LEFT JOIN suppliers s ON p.providerId = s.id
            WHERE COALESCE(p.lastSeenAt, p.updatedAt) < datetime('now', '-${STALE_DAYS} days')
              AND p.stock > 0 ${providerClause}`,
      args,
    })
    const totalCount = (countRes.rows as any[])[0]?.count ?? 0

    if (totalCount === 0) {
      return NextResponse.json({
        ok: true,
        staleCount: 0,
        staleProducts: [],
        thresholdDays: STALE_DAYS,
      })
    }

    // Query 2: listado de productos stale (con datos básicos para mostrar en la tabla)
    // Ordenado por updatedAt ASC (los más viejos primero — los más urgentes)
    const listRes = await db.execute({
      sql: `SELECT
              p.id,
              p.name,
              p.sku,
              p.providerSku,
              p.providerId,
              p.stock,
              p.costPrice,
              p.isActive,
              p.updatedAt,
              s.name AS providerName
            FROM products p
            LEFT JOIN suppliers s ON p.providerId = s.id
            WHERE COALESCE(p.lastSeenAt, p.updatedAt) < datetime('now', '-${STALE_DAYS} days')
              AND p.stock > 0 ${providerClause}
            ORDER BY p.updatedAt ASC
            LIMIT ${MAX_RESULTS}`,
      args,
    })

    const staleProducts = (listRes.rows as any[]).map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      providerSku: row.providerSku,
      providerId: row.providerId,
      providerName: row.providerName || (row.providerId ? 'Proveedor sin nombre' : 'Sin proveedor'),
      stock: row.stock,
      costPrice: row.costPrice,
      isActive: row.isActive,
      updatedAt: row.updatedAt,
    }))

    return NextResponse.json({
      ok: true,
      staleCount: totalCount,
      staleProducts,
      thresholdDays: STALE_DAYS,
      truncated: totalCount > MAX_RESULTS,
    })
  } catch (error) {
    console.error('Error fetching stale products:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
