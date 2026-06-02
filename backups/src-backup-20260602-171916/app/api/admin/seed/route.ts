import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

// Estructura de categorías - nombres cortos como el admin los quiere
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

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { action } = await request.json()

    if (action === 'seed-categories') {
      let created = 0
      let skipped = 0
      const now = new Date().toISOString()

      for (let idx = 0; idx < CATEGORIES_STRUCTURE.length; idx++) {
        const cat = CATEGORIES_STRUCTURE[idx]
        const existing = await db.execute({
          sql: 'SELECT id FROM categories WHERE slug = ?',
          args: [cat.slug],
        })

        let parentId: string

        if (existing.rows.length > 0) {
          parentId = (existing.rows[0] as any).id
          await db.execute({
            sql: 'UPDATE categories SET "order" = ? WHERE id = ?',
            args: [idx, parentId],
          })
          skipped++
        } else {
          parentId = crypto.randomUUID()
          await db.execute({
            sql: 'INSERT INTO categories (id, name, slug, image, parentId, enabled, "order", createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            args: [parentId, cat.name, cat.slug, null, null, 1, idx, now, now],
          })
          created++
        }

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
              sql: 'UPDATE categories SET parentId = ?, "order" = ? WHERE id = ?',
              args: [parentId, subIdx, subId],
            })
            skipped++
          }
        }
      }

      return NextResponse.json({
        ok: true,
        message: `Categorías creadas: ${created}, ya existían: ${skipped}`,
        created,
        skipped,
      })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (error) {
    console.error('Seed categories error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
