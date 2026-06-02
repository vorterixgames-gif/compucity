import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

/**
 * POST /api/admin/validate-categories
 * Validates and fixes product categorization in PC Builder categories.
 * This catches products that were miscategorized by keyword matching
 * and moves them to the correct category.
 * 
 * Respects categorySource = 'manual' (won't overwrite admin changes).
 * 
 * Body: { dryRun?: boolean } - if true, only reports issues without fixing
 */

// General category corrections that should always be applied
// These catch products that were miscategorized by keyword matching in sync
const GENERAL_CORRECTIONS: {
  namePattern: RegExp
  wrongSlugs: string[]
  correctSlug: string
}[] = [
  // === Placas de Video corrections (most common miscategorization) ===
  // VGA cables in any component category
  { namePattern: /^Vga\s+\d+\s*(M\/M|Mts|Pin)/i, wrongSlugs: ['placas-de-video'], correctSlug: 'cables-y-adaptadores' },
  // IP cameras in video card category
  { namePattern: /^Ip\s*Cam/i, wrongSlugs: ['placas-de-video'], correctSlug: 'placas-de-red' },
  // Laptop motherboards with Vga
  { namePattern: /Mb\s.*\+?\s*Vga/i, wrongSlugs: ['placas-de-video'], correctSlug: 'motherboards' },
  // HP Z workstations
  { namePattern: /^HP Z\d/i, wrongSlugs: ['placas-de-video', 'microprocesadores', 'memorias-ram', 'discos-ssd'], correctSlug: 'pc-armadas' },
  // Dell workstations
  { namePattern: /^DELL P\d/i, wrongSlugs: ['placas-de-video', 'microprocesadores'], correctSlug: 'pc-armadas' },
  // Repuesto products
  { namePattern: /REPUESTO/i, wrongSlugs: ['placas-de-video', 'microprocesadores', 'memorias-ram'], correctSlug: 'motherboards' },
  // RMA products
  { namePattern: /\(RMA\)/i, wrongSlugs: ['placas-de-video', 'microprocesadores', 'memorias-ram'], correctSlug: 'motherboards' },
  // Notebooks with RTX/DDR/SSD in wrong component categories
  { namePattern: /NOTEBOOK|LAPTOP|PORTATIL/i, wrongSlugs: ['placas-de-video', 'memorias-ram', 'discos-ssd', 'microprocesadores'], correctSlug: 'notebooks' },
  // PC Armadas with component keywords
  { namePattern: /PC\s+(GAMER|KELYX|LENOVO)/i, wrongSlugs: ['fuentes', 'gabinetes', 'placas-de-video', 'microprocesadores', 'memorias-ram', 'discos-ssd'], correctSlug: 'pc-armadas' },
  // Sist. Kelyx in component categories
  { namePattern: /SIST\./i, wrongSlugs: ['fuentes', 'gabinetes', 'microprocesadores', 'memorias-ram', 'discos-ssd'], correctSlug: 'pc-armadas' },
  // Mini PC / Barebones in component categories
  { namePattern: /MINI PC|BAREBONE|STICK PC/i, wrongSlugs: ['placas-de-video', 'microprocesadores', 'memorias-ram', 'discos-ssd', 'fuentes'], correctSlug: 'pc-armadas' },
  // Video cards in wrong categories (should be in placas-de-video)
  { namePattern: /(?:Vga|Placa de Video).*(?:RTX|GTX|GEFORCE|RADEON)/i, wrongSlugs: ['memorias-ram', 'discos-ssd', 'cables-y-adaptadores'], correctSlug: 'placas-de-video' },
  // Cables/adapters mis-categorized as video cards
  { namePattern: /CABLE|ADAPTADOR/i, wrongSlugs: ['placas-de-video'], correctSlug: 'cables-y-adaptadores' },
  // Monitors in wrong categories
  { namePattern: /MONITOR/i, wrongSlugs: ['placas-de-video', 'cables-y-adaptadores'], correctSlug: 'monitores' },
  // Motherboards in microprocesadores
  { namePattern: /MOTHER/i, wrongSlugs: ['microprocesadores'], correctSlug: 'motherboards' },
  // External drives in internal SSD/HDD categories
  { namePattern: /EXTERNO|EXTERNA|PORTABLE/i, wrongSlugs: ['discos-ssd', 'discos-hdd'], correctSlug: 'discos-externos' },
  // Pendrives in SSD category
  { namePattern: /PENDRIVE|FLASH DRIVE|PEN DRIVE/i, wrongSlugs: ['discos-ssd'], correctSlug: 'pendrives' },
]

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const dryRun = body.dryRun === true

    // Build category lookup
    const catResult = await db.execute('SELECT id, slug, parentId FROM categories')
    const slugToId: Record<string, string> = {}
    for (const row of catResult.rows as any[]) {
      slugToId[row.slug] = row.id
    }

    const issues: { productId: string; name: string; currentSlug: string; suggestedSlug: string; reason: string }[] = []
    let fixed = 0
    let skipped = 0

    // Apply general corrections to all products (skip manual categories)
    for (const correction of GENERAL_CORRECTIONS) {
      for (const wrongSlug of correction.wrongSlugs) {
        const wrongCatId = slugToId[wrongSlug]
        const correctCatId = slugToId[correction.correctSlug]
        if (!wrongCatId || !correctCatId) continue

        // Find products in wrong category matching the pattern
        const products = await db.execute({
          sql: `SELECT id, name, categorySource FROM products WHERE categoryId = ? AND isActive = 1`,
          args: [wrongCatId],
        })

        for (const product of products.rows as any[]) {
          if (!correction.namePattern.test(product.name || '')) continue

          const isManual = product.categorySource === 'manual'
          issues.push({
            productId: product.id,
            name: product.name,
            currentSlug: wrongSlug,
            suggestedSlug: correction.correctSlug,
            reason: `Matched pattern: ${correction.namePattern.toString()}${isManual ? ' (PROTECTED - manual category)' : ''}`,
          })

          if (!dryRun && !isManual) {
            await db.execute({
              sql: "UPDATE products SET categoryId = ?, categorySource = 'auto', updatedAt = datetime('now') WHERE id = ?",
              args: [correctCatId, product.id],
            })
            fixed++
          } else if (isManual) {
            skipped++
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      issuesFound: issues.length,
      fixed: dryRun ? 0 : fixed,
      skippedManual: skipped,
      issues: issues.slice(0, 100),
      message: dryRun
        ? `Se encontraron ${issues.length} problemas. Ejecutar sin dryRun para corregir.`
        : `Se corrigieron ${fixed} productos. ${skipped} con categoría manual fueron protegidos.`,
    })
  } catch (error) {
    console.error('Validate categories error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

/**
 * GET /api/admin/validate-categories
 * Preview current categorization issues without fixing them.
 */
export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Build category lookup
    const catResult = await db.execute('SELECT id, slug, parentId FROM categories')
    const slugToId: Record<string, string> = {}
    for (const row of catResult.rows as any[]) {
      slugToId[row.slug] = row.id
    }

    const issues: { name: string; currentSlug: string; suggestedSlug: string; reason: string; isManual: boolean }[] = []

    for (const correction of GENERAL_CORRECTIONS) {
      for (const wrongSlug of correction.wrongSlugs) {
        const wrongCatId = slugToId[wrongSlug]
        if (!wrongCatId) continue

        const products = await db.execute({
          sql: `SELECT id, name, categorySource FROM products WHERE categoryId = ? AND isActive = 1`,
          args: [wrongCatId],
        })

        for (const product of products.rows as any[]) {
          if (!correction.namePattern.test(product.name || '')) continue
          issues.push({
            name: product.name,
            currentSlug: wrongSlug,
            suggestedSlug: correction.correctSlug,
            reason: `Pattern: ${correction.namePattern.toString()}`,
            isManual: product.categorySource === 'manual',
          })
        }
      }
    }

    // Also count products per PC Builder category
    const PC_BUILDER_SLOTS = [
      'microprocesadores', 'motherboards', 'memorias-ram', 'placas-de-video',
      'discos-ssd', 'discos-hdd', 'fuentes', 'gabinetes', 'refrigeracion', 'pastas-termicas',
    ]
    const categoryCounts: Record<string, number> = {}
    for (const slug of PC_BUILDER_SLOTS) {
      const catId = slugToId[slug]
      if (!catId) continue
      const result = await db.execute({
        sql: 'SELECT COUNT(*) as cnt FROM products WHERE categoryId = ? AND isActive = 1 AND stock > 0',
        args: [catId],
      })
      categoryCounts[slug] = (result.rows[0] as any).cnt || 0
    }

    return NextResponse.json({
      ok: true,
      issuesFound: issues.length,
      issues: issues.slice(0, 50),
      categoryCounts,
      manualProtected: issues.filter(i => i.isManual).length,
    })
  } catch (error) {
    console.error('Validate categories GET error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
