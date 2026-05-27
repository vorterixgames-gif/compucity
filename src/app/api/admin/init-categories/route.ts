import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const CATEGORIES_STRUCTURE: { name: string; slug: string; children: { name: string; slug: string }[] }[] = [
  {
    name: 'Notebooks',
    slug: 'notebooks',
    children: [
      { name: 'Gamer', slug: 'gamer' },
      { name: 'Oficina', slug: 'oficina' },
      { name: 'Diseño', slug: 'diseno' },
      { name: 'Ultrabooks', slug: 'ultrabooks' },
    ],
  },
  {
    name: 'PC Armadas',
    slug: 'pc-armadas',
    children: [
      { name: 'Gamer', slug: 'gamer-pc' },
      { name: 'Oficina', slug: 'oficina-pc' },
      { name: 'Diseño', slug: 'diseno-pc' },
      { name: 'Mini PC', slug: 'mini-pc' },
    ],
  },
  {
    name: 'Componentes de PC',
    slug: 'componentes-de-pc',
    children: [
      { name: 'Placas de Video', slug: 'placas-de-video' },
      { name: 'Microprocesadores', slug: 'microprocesadores' },
      { name: 'Motherboards', slug: 'motherboards' },
      { name: 'Memorias RAM', slug: 'memorias-ram' },
      { name: 'Discos SSD', slug: 'discos-ssd' },
      { name: 'Discos HDD', slug: 'discos-hdd' },
      { name: 'Fuentes', slug: 'fuentes' },
      { name: 'Gabinetes', slug: 'gabinetes' },
      { name: 'Refrigeración', slug: 'refrigeracion' },
      { name: 'Pastas Térmicas', slug: 'pastas-termicas' },
      { name: 'Combos', slug: 'combos' },
    ],
  },
  {
    name: 'Monitores',
    slug: 'monitores',
    children: [
      { name: 'Gamer', slug: 'gamer-mon' },
      { name: 'Oficina', slug: 'oficina-mon' },
      { name: 'Diseño', slug: 'diseno-mon' },
      { name: 'Soportes y Brazos', slug: 'soportes-y-brazos' },
    ],
  },
  {
    name: 'Periféricos',
    slug: 'perifericos',
    children: [
      { name: 'Teclados', slug: 'teclados' },
      { name: 'Mouse', slug: 'mouse' },
      { name: 'Auriculares', slug: 'auriculares' },
      { name: 'Mousepads', slug: 'mousepads' },
      { name: 'Parlantes', slug: 'parlantes' },
      { name: 'Webcams', slug: 'webcams' },
      { name: 'Micrófonos', slug: 'microfonos' },
      { name: 'Joysticks', slug: 'joysticks' },
      { name: 'Kits Gamer', slug: 'kits-gamer' },
    ],
  },
  {
    name: 'Impresión',
    slug: 'impresion',
    children: [
      { name: 'Láser', slug: 'laser' },
      { name: 'Inyección', slug: 'inyeccion' },
      { name: 'Sistema Continuo', slug: 'sistema-continuo' },
      { name: 'Toners y Cartuchos', slug: 'toners-y-cartuchos' },
    ],
  },
  {
    name: 'Conectividad y Redes',
    slug: 'conectividad-y-redes',
    children: [
      { name: 'Routers WiFi', slug: 'routers-wifi' },
      { name: 'Switches', slug: 'switches' },
      { name: 'Cables y Adaptadores', slug: 'cables-y-adaptadores' },
      { name: 'Placas de Red', slug: 'placas-de-red' },
    ],
  },
  {
    name: 'Almacenamiento Externo',
    slug: 'almacenamiento-externo',
    children: [
      { name: 'Discos Externos', slug: 'discos-externos' },
      { name: 'Pendrives', slug: 'pendrives' },
      { name: 'Micro SD', slug: 'micro-sd' },
    ],
  },
  {
    name: 'Accesorios',
    slug: 'accesorios',
    children: [
      { name: 'Cargadores', slug: 'cargadores' },
      { name: 'Bases', slug: 'bases' },
      { name: 'Fundas/Mochilas', slug: 'fundas-mochilas' },
      { name: 'UPS', slug: 'ups' },
      { name: 'Sillas Gamer', slug: 'sillas-gamer' },
      { name: 'Escritorios', slug: 'escritorios' },
    ],
  },
]

export async function POST() {
  try {
    const results: string[] = []

    // Step 1: Create categories table if it doesn't exist
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT UNIQUE NOT NULL,
          image TEXT,
          parentId TEXT,
          enabled INTEGER DEFAULT 1,
          "order" INTEGER DEFAULT 0,
          createdAt TEXT DEFAULT (datetime('now')),
          updatedAt TEXT DEFAULT (datetime('now'))
        )
      `)
      results.push('Tabla categories creada/verificada')
    } catch (e: any) {
      results.push(`Tabla: ${e.message}`)
    }

    // Step 2: Add missing columns (for existing tables that might not have them)
    const columnsToAdd = [
      { name: 'enabled', sql: 'ALTER TABLE categories ADD COLUMN enabled INTEGER DEFAULT 1' },
      { name: 'order', sql: 'ALTER TABLE categories ADD COLUMN "order" INTEGER DEFAULT 0' },
      { name: 'parentId', sql: 'ALTER TABLE categories ADD COLUMN parentId TEXT' },
      { name: 'image', sql: 'ALTER TABLE categories ADD COLUMN image TEXT' },
    ]

    for (const col of columnsToAdd) {
      try {
        await db.execute(col.sql)
        results.push(`Columna "${col.name}" agregada`)
      } catch (e: any) {
        if (e.message?.includes('duplicate column') || e.message?.includes('already exists')) {
          results.push(`Columna "${col.name}" ya existe`)
        } else {
          results.push(`Columna "${col.name}": ${e.message}`)
        }
      }
    }

    // Step 3: Add categoryId to products table if missing
    try {
      await db.execute('ALTER TABLE products ADD COLUMN categoryId TEXT')
      results.push('Columna "categoryId" agregada a products')
    } catch (e: any) {
      if (e.message?.includes('duplicate column') || e.message?.includes('already exists')) {
        results.push('Columna "categoryId" ya existe en products')
      } else {
        results.push(`categoryId en products: ${e.message}`)
      }
    }

    // Step 4: Seed categories
    const now = new Date().toISOString()
    let created = 0
    let updated = 0

    for (let idx = 0; idx < CATEGORIES_STRUCTURE.length; idx++) {
      const cat = CATEGORIES_STRUCTURE[idx]
      const existing = await db.execute({
        sql: 'SELECT id FROM categories WHERE slug = ?',
        args: [cat.slug],
      })

      let parentId: string

      if (existing.rows.length > 0) {
        parentId = (existing.rows[0] as any).id
        // Update name and order in case they changed
        await db.execute({
          sql: 'UPDATE categories SET name = ?, "order" = ?, enabled = COALESCE(enabled, 1), updatedAt = ? WHERE id = ?',
          args: [cat.name, idx, now, parentId],
        })
        updated++
      } else {
        parentId = crypto.randomUUID()
        await db.execute({
          sql: 'INSERT INTO categories (id, name, slug, image, parentId, enabled, "order", createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          args: [parentId, cat.name, cat.slug, null, null, 1, idx, now, now],
        })
        created++
      }

      // Seed/update children
      for (let subIdx = 0; subIdx < cat.children.length; subIdx++) {
        const sub = cat.children[subIdx]
        const existingSub = await db.execute({
          sql: 'SELECT id FROM categories WHERE slug = ?',
          args: [sub.slug],
        })

        if (existingSub.rows.length === 0) {
          const subId = crypto.randomUUID()
          await db.execute({
            sql: 'INSERT INTO categories (id, name, slug, image, parentId, enabled, "order", createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            args: [subId, sub.name, sub.slug, null, parentId, 1, subIdx, now, now],
          })
          created++
        } else {
          const subId = (existingSub.rows[0] as any).id
          await db.execute({
            sql: 'UPDATE categories SET name = ?, parentId = ?, "order" = ?, enabled = COALESCE(enabled, 1), updatedAt = ? WHERE id = ?',
            args: [sub.name, parentId, subIdx, now, subId],
          })
          updated++
        }
      }
    }

    // Step 5: Set enabled = 1 for any categories that have NULL enabled
    try {
      await db.execute('UPDATE categories SET enabled = 1 WHERE enabled IS NULL')
    } catch (e: any) {
      // ignore
    }

    // Step 6: Count what we have
    const countResult = await db.execute('SELECT COUNT(*) as total FROM categories')
    const parentCount = await db.execute('SELECT COUNT(*) as total FROM categories WHERE parentId IS NULL')
    const total = (countResult.rows[0] as any).total
    const parents = (parentCount.rows[0] as any).total

    results.push(`Categorías creadas: ${created}, actualizadas: ${updated}`)
    results.push(`Total en BD: ${total} (${parents} padres, ${total - parents} subcategorías)`)

    return NextResponse.json({
      ok: true,
      results,
      stats: { total, parents, children: total - parents, created, updated },
    })
  } catch (error) {
    console.error('Init categories error:', error)
    return NextResponse.json({ error: 'Error del servidor', details: String(error) }, { status: 500 })
  }
}
