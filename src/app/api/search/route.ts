import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Search endpoint optimizado: query directa a DB sin pipeline de precios completo.
// El search del navbar solo necesita nombre, slug, precio e imagen para las sugerencias.
// No necesita deduplicación, enriquecimiento de marcas, ni cálculo completo de precios.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ ok: true, products: [] })
  }

  const searchTerm = q.trim()
  const limit = 6

  try {
    // Query directa: solo columnas necesarias, sin currency (no existe en la tabla),
    // sin JOINs, sin ORDER BY complejo.
    // Usa los precios ya calculados (price, comparePrice) que se guardan en la DB.
    const result = await db.execute({
      sql: `SELECT id, name, slug, price, comparePrice, images
            FROM products
            WHERE isActive = 1 AND stock > 0 AND name LIKE ?
            ORDER BY CASE WHEN images IS NOT NULL AND images != '[]' THEN 0 ELSE 1 END,
                     COALESCE(createdAt, updatedAt) DESC
            LIMIT ?`,
      args: [`%${searchTerm}%`, limit],
    })

    const products = (result.rows as any[]).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      comparePrice: p.comparePrice,
      images: p.images ? (() => { try { return JSON.parse(p.images) } catch { return [] } })() : [],
    }))

    return NextResponse.json({ ok: true, products })
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ ok: true, products: [] })
  }
}
