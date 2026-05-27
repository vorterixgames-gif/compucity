import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Import subcategory rules from sync route
const SUBCATEGORY_RULES: { parentSlug: string; rules: { keywords: string[]; subcategorySlug: string; name: string }[] }[] = [
  {
    parentSlug: 'notebooks',
    rules: [
      { keywords: ['TABLET', 'TABLETA', 'IDEA TAB', 'TAB PLUS', 'EASYPEN'], subcategorySlug: 'tablets', name: 'Tablets' },
      { keywords: ['GAMER', 'GAMING', 'LOQ', 'LEGION', 'RTX', 'GEFORCE', 'RADEON', 'THIN 15', 'TUF GAMING', 'PREDATOR', 'NITRO'], subcategorySlug: 'gamer', name: 'Gamer' },
      { keywords: ['SLIM', 'ULTRABOOK', 'IDEAPAD SLIM', 'BORDER ULTRA', 'IP SLIM'], subcategorySlug: 'ultrabooks', name: 'Ultrabooks' },
      { keywords: ['TOUCH', 'TOUCHSCREEN', 'IPS 300', 'PANTALLA TACTIL', 'XPS', 'SPECTRE', 'ZENBOOK'], subcategorySlug: 'diseno', name: 'Diseño' },
      { keywords: ['IDEAPAD', '250 G', '255 G', 'KELYX', 'OFFICE', 'CONSUMO', 'FREE'], subcategorySlug: 'oficina', name: 'Oficina' },
    ],
  },
  {
    parentSlug: 'monitores',
    rules: [
      { keywords: ['ULTRAGEAR', 'GAMER', 'GAMING', 'RAPTOR HAWK', '144HZ', '165HZ', '180HZ', '200HZ', '240HZ', '1MS', '0.5MS', 'FREESYNC', 'G-SYNC', 'CURVO', 'OLED'], subcategorySlug: 'gamer-mon', name: 'Gamer' },
      { keywords: ['ULTRAFINE', 'ERGO', '4K USB-C', 'COLOR CALIBRATED', 'THUNDERBOLT', 'DUAL ERGO'], subcategorySlug: 'diseno-mon', name: 'Diseño' },
      { keywords: ['SOPORTE', 'BRAZO', 'MOUNT', 'STAND MONITOR'], subcategorySlug: 'soportes-y-brazos', name: 'Soportes y Brazos' },
      { keywords: ['MONITOR', 'LED', 'HDMI', 'FULL HD', 'CORPORATIVO', 'CONSUMO'], subcategorySlug: 'oficina-mon', name: 'Oficina' },
    ],
  },
  {
    parentSlug: 'pc-armadas',
    rules: [
      { keywords: ['GAMER', 'GAMING', 'PC GAMER', 'RTX', 'GEFORCE', 'RADEON'], subcategorySlug: 'gamer-pc', name: 'Gamer' },
      { keywords: ['MINI PC', 'STICK PC', 'NUC', 'MELE', 'N100'], subcategorySlug: 'mini-pc', name: 'Mini PC' },
      { keywords: ['DESIGN', 'DISEÑO', 'CREATOR', 'STUDIO'], subcategorySlug: 'diseno-pc', name: 'Diseño' },
      { keywords: ['SIST.', 'KELYX', 'OFFICE', 'OFICINA', 'PC'], subcategorySlug: 'oficina-pc', name: 'Oficina' },
    ],
  },
  {
    parentSlug: 'accesorios',
    rules: [
      { keywords: ['TAPO', 'SMART HOME', 'SENSOR DE MOVIMIENTO', 'TIMBRE VIDEO', 'PARTY LIGHT', 'LUZ PROYECCION', 'BARRA DE LUZ', 'SMART PLUG', 'BOMBILLA INTELIGENTE'], subcategorySlug: 'smart-home', name: 'Smart Home' },
      { keywords: ['HELADERA', 'LAVARROPAS', 'AIRE ACONDICIONADO', 'ELECTRODOMESTICO', 'SMART INVERTER', 'INSTAVIEW'], subcategorySlug: 'hogar-inteligente', name: 'Hogar Inteligente' },
      { keywords: ['UPS', 'ESTABILIZADOR', 'NOBREAK', 'SURGE PROTECTION'], subcategorySlug: 'ups', name: 'UPS' },
      { keywords: ['CARGADOR', 'CHARGER', 'POWER BANK'], subcategorySlug: 'cargadores', name: 'Cargadores' },
      { keywords: ['SILLA', 'GAMING CHAIR'], subcategorySlug: 'sillas-gamer', name: 'Sillas Gamer' },
      { keywords: ['ESCRITORIO', 'DESK ', 'MESA GAMER'], subcategorySlug: 'escritorios', name: 'Escritorios' },
      { keywords: ['MOCHILA', 'FUNDA', 'BACKPACK'], subcategorySlug: 'fundas-mochilas', name: 'Fundas/Mochilas' },
      { keywords: ['BASE CARGADORA', 'DOCK'], subcategorySlug: 'bases', name: 'Bases' },
    ],
  },
]

/**
 * POST /api/admin/suppliers/recategorize
 * Re-assigns categories to all products of a supplier based on the category mappings.
 * Also applies subcategory rules when a product maps to a parent category.
 * Body: { supplierId }
 */
export async function POST(request: Request) {
  try {
    const { supplierId } = await request.json()

    if (!supplierId) {
      return NextResponse.json({ error: 'supplierId requerido' }, { status: 400 })
    }

    // Build category lookup
    const catResult = await db.execute('SELECT id, name, slug, parentId FROM categories')
    const slugToId: Record<string, string> = {}
    const idToParentId: Record<string, string | null> = {}
    const idToSlug: Record<string, string> = {}
    const parentSlugToChildSlugs: Record<string, string[]> = {}

    for (const row of catResult.rows as any[]) {
      slugToId[row.slug] = row.id
      idToParentId[row.id] = row.parentId || null
      idToSlug[row.id] = row.slug
      if (row.parentId) {
        const parentRow = (catResult.rows as any[]).find((r: any) => r.id === row.parentId)
        if (parentRow?.slug) {
          if (!parentSlugToChildSlugs[parentRow.slug]) parentSlugToChildSlugs[parentRow.slug] = []
          parentSlugToChildSlugs[parentRow.slug].push(row.slug)
        }
      }
    }

    // Get all mappings for this supplier
    const mappingsResult = await db.execute({
      sql: 'SELECT supplierCategory, storeCategoryId FROM supplier_category_mappings WHERE supplierId = ?',
      args: [supplierId],
    })

    const mappings = mappingsResult.rows as any[]

    if (mappings.length === 0) {
      return NextResponse.json({
        ok: false,
        message: 'No hay mapeos de categorías configurados para este proveedor. Configure los mapeos primero.',
      })
    }

    let totalUpdated = 0
    let subcategoryUpdated = 0

    // Step 1: Apply supplier category mappings
    for (const mapping of mappings) {
      const result = await db.execute({
        sql: 'UPDATE products SET categoryId = ?, updatedAt = ? WHERE providerId = ? AND supplierCategory = ?',
        args: [mapping.storeCategoryId, new Date().toISOString(), supplierId, mapping.supplierCategory],
      })
      totalUpdated += (result.rowsAffected as number) || 0
    }

    // Step 2: Apply subcategory rules to products that are in parent categories
    // Get all products for this supplier that are in a parent category (no parentId = has children)
    const productsResult = await db.execute({
      sql: `SELECT p.id, p.name, p.categoryId, p.supplierCategory
            FROM products p
            JOIN categories c ON p.categoryId = c.id
            WHERE p.providerId = ? AND c.parentId IS NULL`,
      args: [supplierId],
    })

    const parentProducts = productsResult.rows as any[]

    for (const product of parentProducts) {
      const parentSlug = idToSlug[product.categoryId]
      if (!parentSlug || !parentSlugToChildSlugs[parentSlug]?.length) continue

      const subRules = SUBCATEGORY_RULES.find(r => r.parentSlug === parentSlug)
      if (!subRules) continue

      const nameUpper = (product.name || '').toUpperCase()
      const supplierCatUpper = (product.supplierCategory || '').toUpperCase()

      for (const rule of subRules.rules) {
        const nameMatch = rule.keywords.some(kw => nameUpper.includes(kw))
        const supplierCatMatch = rule.keywords.some(kw => supplierCatUpper.includes(kw))
        if (nameMatch || supplierCatMatch) {
          const subcategoryId = slugToId[rule.subcategorySlug]
          if (subcategoryId) {
            await db.execute({
              sql: 'UPDATE products SET categoryId = ?, updatedAt = ? WHERE id = ?',
              args: [subcategoryId, new Date().toISOString(), product.id],
            })
            subcategoryUpdated++
            break
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Se recategorizaron ${totalUpdated} productos con mapeos y ${subcategoryUpdated} fueron refinados a subcategorías usando ${mappings.length} mapeos.`,
      totalUpdated,
      subcategoryUpdated,
      mappingsUsed: mappings.length,
    })
  } catch (error) {
    console.error('Recategorize error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
