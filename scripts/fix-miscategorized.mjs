import { createClient } from '@libsql/client/web'

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw',
})

async function main() {
  // 1. Build category slug → id map
  const catResult = await db.execute('SELECT id, slug, name, parentId FROM categories')
  const slugToId = {}
  const idToSlug = {}
  for (const row of catResult.rows) {
    slugToId[row.slug] = row.id
    idToSlug[row.id] = row.slug
  }

  console.log('Category slugs:', Object.keys(slugToId).join(', '))

  // 2. Define corrections: product name pattern → correct category slug
  const corrections = [
    // === MONITORES: Remove server fans, KVM trays ===
    { match: /(?:Standard\s+Fan|Fan\s+(?:Kit|Cuskit|Customer))/i, fromSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon', 'soportes-y-brazos'], toSlug: 'refrigeracion', desc: 'Server fan in monitores' },
    { match: /^Dell\s+(?:Standar|Standard)\s+Fan/i, fromSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon', 'soportes-y-brazos'], toSlug: 'refrigeracion', desc: 'Dell server fan' },
    { match: /^Hpe?\s+\w+\s+Gen\d+.*Fan/i, fromSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon', 'soportes-y-brazos'], toSlug: 'refrigeracion', desc: 'HPE server fan' },
    { match: /^Fan\s+Kit\s+Hpe/i, fromSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon', 'soportes-y-brazos'], toSlug: 'refrigeracion', desc: 'HPE fan kit' },
    { match: /^Poweredge.*Standard\s+Fan/i, fromSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon', 'soportes-y-brazos'], toSlug: 'refrigeracion', desc: 'PowerEdge fan' },
    { match: /^Bandeja.*Monitor.*Teclado/i, fromSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon'], toSlug: 'soportes-y-brazos', desc: 'KVM tray in monitores' },
    { match: /Rack\s+(?:Lcd|Led)\s+Monitor\s+Keyboard/i, fromSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon'], toSlug: 'soportes-y-brazos', desc: 'Rack KVM in monitores' },

    // === NOTEBOOKS: Remove accessories ===
    { match: /^Alimentacion\s+Notebook/i, fromSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno', 'tablets'], toSlug: 'cargadores', desc: 'Notebook power adapter' },
    { match: /^Fuente\s+(Notebook|Alimentacion)/i, fromSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno', 'cargadores'], toSlug: 'cargadores', desc: 'Notebook charger/fuente' },
    { match: /^Cargador/i, fromSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'], toSlug: 'cargadores', desc: 'Cargador in notebooks' },
    { match: /^Bateria\s+P\/?notebook/i, fromSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'], toSlug: 'cargadores', desc: 'Notebook battery' },
    { match: /^Soporte.*(?:Notebook|Laptop|Portatil)/i, fromSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'], toSlug: 'bases', desc: 'Soporte in notebooks' },
    { match: /^Auriculares?\s+.*(?:Notebook|Laptop)/i, fromSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'], toSlug: 'auriculares', desc: 'Auricular in notebooks' },
    { match: /^(?:Bolso|Funda|Mochila).*(?:Notebook|Laptop|Portatil)/i, fromSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'], toSlug: 'fundas-mochilas', desc: 'Bolso/funda in notebooks' },
    { match: /Limpia\s+(?:Notebooks|Lcd|Monitores)/i, fromSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno', 'monitores', 'oficina-mon', 'gamer-mon'], toSlug: 'cables-y-adaptadores', desc: 'Cleaning product' },
    { match: /Limpieza.*(?:Notebook|Computacion)/i, fromSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno', 'pc-armadas'], toSlug: 'cables-y-adaptadores', desc: 'Cleaning product' },
    { match: /^Parlante\s+.*Portatil/i, fromSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'], toSlug: 'parlantes', desc: 'Parlante portatil in notebooks' },
    { match: /^Ups.*Portatil/i, fromSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'], toSlug: 'ups', desc: 'UPS portatil in notebooks' },
    { match: /^Bisagra\s+Notebook/i, fromSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'], toSlug: 'cables-y-adaptadores', desc: 'Bisagra in notebooks' },
    { match: /^Caja\s+P\/?notebook/i, fromSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'], toSlug: 'cables-y-adaptadores', desc: 'Caja in notebooks' },
    { match: /^Citizen\s+Pn/i, fromSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'], toSlug: 'toners-y-cartuchos', desc: 'Citizen PN in notebooks' },

    // === COMPONENTES: Fix misplaced complete PCs ===
    { match: /^PC\s+(HP|Performance)/i, fromSlugs: ['discos-ssd', 'memorias-ram', 'microprocesadores', 'fuentes', 'gabinetes'], toSlug: 'pc-armadas', desc: 'Complete PC in component category' },
    { match: /Mother(?:board)?\s+(?:P\/?|Para\s+)?Notebook/i, fromSlugs: ['motherboards'], toSlug: 'cables-y-adaptadores', desc: 'Notebook motherboard in PC motherboards' },
    { match: /^Motherboard\s+Notebook$/i, fromSlugs: ['motherboards'], toSlug: 'cables-y-adaptadores', desc: 'Notebook motherboard in PC motherboards' },
  ]

  let totalFixed = 0
  const fixedProducts = []

  for (const correction of corrections) {
    for (const fromSlug of correction.fromSlugs) {
      const fromCatId = slugToId[fromSlug]
      const toCatId = slugToId[correction.toSlug]
      if (!fromCatId || !toCatId) {
        if (!fromCatId) console.log(`  SKIP: slug "${fromSlug}" not found in DB`)
        continue
      }

      // Find matching products
      const products = await db.execute({
        sql: `SELECT id, name, categorySource FROM products WHERE categoryId = ? AND isActive = 1`,
        args: [fromCatId],
      })

      for (const product of products.rows) {
        if (!correction.match.test(product.name || '')) continue
        if (product.categorySource === 'manual') {
          console.log(`  PROTECTED (manual): "${product.name}" [${fromSlug} → ${correction.toSlug}]`)
          continue
        }

        // Move the product
        await db.execute({
          sql: "UPDATE products SET categoryId = ?, categorySource = 'auto', updatedAt = datetime('now') WHERE id = ?",
          args: [toCatId, product.id],
        })

        totalFixed++
        fixedProducts.push({ name: product.name, from: fromSlug, to: correction.toSlug, desc: correction.desc })
        console.log(`  FIXED: "${product.name}" [${fromSlug} → ${correction.toSlug}] (${correction.desc})`)
      }
    }
  }

  console.log(`\n=== TOTAL: ${totalFixed} products fixed ===`)

  // 3. Also fix: Products with "PORTATIL" keyword that are NOT notebooks
  // The keyword "PORTATIL" maps to notebooks, but products like "Parlante Portatil", "UPS Portatil" are not notebooks
  // We already handled the specific cases above, but let's do a broader check
  console.log('\n=== Additional check: non-notebook products with PORTATIL in notebooks category ===')
  const notebookSlugs = ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno', 'tablets']
  const notebookCatIds = notebookSlugs.map(s => slugToId[s]).filter(Boolean)

  for (const catId of notebookCatIds) {
    const products = await db.execute({
      sql: `SELECT id, name, categorySource FROM products WHERE categoryId = ? AND isActive = 1 AND (name LIKE '%Portatil%' OR name LIKE '%PORTATIL%')`,
      args: [catId],
    })

    for (const product of products.rows) {
      const name = (product.name || '').toUpperCase()
      // Skip actual notebooks (they have processor/SSD/RAM specs)
      const isActualNotebook = /\b(?:I[3579]-\d|RYZEN\s+\d|CORE\s+(?:I|ULTRA)|CELERO|N\d{4,}|SSD\s*\d|RAM\s*\d)/i.test(product.name)
      if (isActualNotebook) continue

      // Already fixed above? Skip
      if (fixedProducts.find(p => p.name === product.name)) continue

      // Determine correct category based on product type
      let correctSlug = null
      if (/\bPARLANTE\b/i.test(name)) correctSlug = 'parlantes'
      else if (/\bUPS\b/i.test(name)) correctSlug = 'ups'
      else if (/\bCARGADOR\b/i.test(name)) correctSlug = 'cargadores'
      else if (/\bMONITOR\b/i.test(name)) correctSlug = 'monitores'
      else if (/\bAURICULAR\b/i.test(name)) correctSlug = 'auriculares'
      else if (/\bSOPORTE\b/i.test(name)) correctSlug = 'bases'

      if (correctSlug && slugToId[correctSlug] && product.categorySource !== 'manual') {
        await db.execute({
          sql: "UPDATE products SET categoryId = ?, categorySource = 'auto', updatedAt = datetime('now') WHERE id = ?",
          args: [slugToId[correctSlug], product.id],
        })
        totalFixed++
        const fromSlug = idToSlug[catId] || catId
        console.log(`  FIXED: "${product.name}" [${fromSlug} → ${correctSlug}] (PORTATIL keyword)`)
      }
    }
  }

  console.log(`\n=== FINAL TOTAL: ${totalFixed} products fixed ===`)
}

main().catch(console.error)
