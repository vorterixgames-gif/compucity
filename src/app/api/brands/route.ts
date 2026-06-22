import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Sesión 43: cache 1h en CDN. Las marcas cambian muy raramente (solo cuando
// se agrega/edita una marca desde /admin o cuando corre el sync de brands
// en GitHub Actions). 1h de staleness OK.
//
// Sesión 44: cache subido a 24h porque ahora brands se actualizan via
// GitHub Actions 1 vez por día, no en cada cron de Vercel.
export const revalidate = 86400 // 24h

// Public API: returns all active brands, ordered by order then name
export async function GET() {
  try {
    const result = await db.execute(
      `SELECT id, name, slug, logoUrl, logoWidth, logoHeight, isActive, "order", productCount, createdAt, updatedAt
       FROM brands
       WHERE isActive = 1
       ORDER BY "order" ASC, name ASC`
    )

    const brands = result.rows as any[]

    // Sesión 44: eliminado el bloque que hacía fetch('http://localhost:3000/api/admin/init-brands')
    // cuando la tabla brands estaba vacía. Ese fetch fallaba en Vercel (localhost no existe
    // en serverless) y peor: /api/admin/init-brands no tenía auth, así que cualquiera podía
    // disparar 7K+ queries. Si brands está vacío, simplemente retornamos [] — el admin
    // puede inicializar manualmente desde /admin/proveedores.

    return NextResponse.json({ ok: true, brands }, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    })
  } catch (error) {
    console.error('Get public brands error:', error)
    // If table doesn't exist yet, return empty array
    return NextResponse.json({ ok: true, brands: [] })
  }
}
