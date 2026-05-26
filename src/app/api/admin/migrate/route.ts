import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()

    if (action === 'add-enabled-order') {
      const results: string[] = []

      // Add 'enabled' column if not exists
      try {
        await db.execute('ALTER TABLE categories ADD COLUMN enabled INTEGER DEFAULT 1')
        results.push('Columna "enabled" agregada')
      } catch (e: any) {
        if (e.message?.includes('duplicate column')) {
          results.push('Columna "enabled" ya existe')
        } else {
          results.push(`Error en "enabled": ${e.message}`)
        }
      }

      // Add 'order' column if not exists
      try {
        await db.execute('ALTER TABLE categories ADD COLUMN "order" INTEGER DEFAULT 0')
        results.push('Columna "order" agregada')
      } catch (e: any) {
        if (e.message?.includes('duplicate column')) {
          results.push('Columna "order" ya existe')
        } else {
          results.push(`Error en "order": ${e.message}`)
        }
      }

      // Set enabled = 1 for all existing categories
      try {
        await db.execute('UPDATE categories SET enabled = 1 WHERE enabled IS NULL')
        results.push('Categorías existentes habilitadas')
      } catch (e: any) {
        results.push(`Error habilitando categorías: ${e.message}`)
      }

      // Set order based on current alphabetical position for parent categories
      try {
        const parents = await db.execute('SELECT id FROM categories WHERE parentId IS NULL ORDER BY name ASC')
        for (let i = 0; i < parents.rows.length; i++) {
          await db.execute({
            sql: 'UPDATE categories SET "order" = ? WHERE id = ?',
            args: [i, (parents.rows[i] as any).id],
          })
        }
        results.push(`Orden asignado a ${parents.rows.length} categorías padre`)
      } catch (e: any) {
        results.push(`Error asignando orden: ${e.message}`)
      }

      return NextResponse.json({ ok: true, results })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
