import { createClient } from '@libsql/client/web'

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw',
})

async function main() {
  const catResult = await db.execute('SELECT id, slug, name, parentId FROM categories')
  const slugToId = {}
  const idToSlug = {}
  const idToName = {}
  const idToParentId = {}
  for (const row of catResult.rows) {
    slugToId[row.slug] = row.id
    idToSlug[row.id] = row.slug
    idToName[row.id] = row.name
    idToParentId[row.id] = row.parentId
  }

  // Get ALL notebook subcategory IDs (notebooks + all children)
  const notebooksId = slugToId['notebooks']
  const notebookCatIds = [notebooksId]
  for (const [slug, id] of Object.entries(slugToId)) {
    if (idToParentId[id] === notebooksId) {
      notebookCatIds.push(id)
      console.log(`  Notebook subcategory: ${slug} (${idToName[id]})`)
    }
  }

  // Get ALL monitores subcategory IDs
  const monitoresId = slugToId['monitores']
  const monitoresCatIds = [monitoresId]
  for (const [slug, id] of Object.entries(slugToId)) {
    if (idToParentId[id] === monitoresId) {
      monitoresCatIds.push(id)
    }
  }

  // Check remaining misplaced products in notebooks
  console.log('\n=== REMAINING NOTEBOOK PRODUCTS CHECK ===')
  const placeholders = notebookCatIds.map(() => '?').join(',')
  const nbResult = await db.execute({
    sql: `SELECT id, name, categoryId, categorySource, supplierCategory FROM products WHERE categoryId IN (${placeholders}) AND isActive = 1 ORDER BY name`,
    args: notebookCatIds,
  })

  const nonNotebooks = []
  for (const p of nbResult.rows) {
    const name = (p.name || '').toUpperCase()
    const catSlug = idToSlug[p.categoryId]

    // Check if this is an actual notebook - must have processor/RAM/SSD specs
    const isActualNotebook = /\b(?:I[3579]-\d|RYZEN\s+\d|CORE\s+(?:I|ULTRA)|CELERON|N\d{4,}|ATOM)\b/i.test(p.name)

    // Check for accessories that shouldn't be here
    const isAccessory =
      (/\bALIMENTACION\b/i.test(name)) ||
      (/\bFUENTE\b/i.test(name) && !/\bPC\b/.test(name)) ||
      (/\bCARGADOR\b/i.test(name)) ||
      (/\bBATERIA\b/i.test(name) && /\bNOTEBOOK\b/i.test(name)) ||
      (/\bSOPORTE\b/i.test(name) && (/\bNOTEBOOK\b/i.test(name) || /\bLAPTOP\b/i.test(name))) ||
      (/\bAURICULAR\b/i.test(name)) ||
      (/\bPARLANTE\b/i.test(name)) ||
      (/\bUPS\b/i.test(name)) ||
      (/\bBOLSO\b/i.test(name)) ||
      (/\bFUNDA\b/i.test(name) && /\bNOTEBOOK\b/i.test(name)) ||
      (/\bMOCHILA\b/i.test(name) && /\bLAPTOP\b/i.test(name)) ||
      (/\bBISAGRA\b/i.test(name)) ||
      (/\bLIMPIA\b/i.test(name)) ||
      (/\bLIMPIEZA\b/i.test(name)) ||
      (/\bCAJA\s+P\/?NOTEBOOK\b/i.test(name)) ||
      (/\bCITIZEN\s+PN\b/i.test(name))

    if (isAccessory && !isActualNotebook) {
      nonNotebooks.push({ name: p.name, slug: catSlug, supplierCat: p.supplierCategory })
    }
  }

  if (nonNotebooks.length > 0) {
    console.log(`  Still found ${nonNotebooks.length} non-notebook products:`)
    for (const p of nonNotebooks) {
      console.log(`    - "${p.name}" [${p.slug}] supplierCat: ${p.supplierCat}`)
    }

    // Fix them
    const accessoryMap = {
      'ALIMENTACION': 'cargadores',
      'FUENTE': 'cargadores',
      'CARGADOR': 'cargadores',
      'BATERIA': 'cargadores',
      'SOPORTE': 'bases',
      'AURICULAR': 'auriculares',
      'PARLANTE': 'parlantes',
      'UPS': 'ups',
      'BOLSO': 'fundas-mochilas',
      'FUNDA': 'fundas-mochilas',
      'MOCHILA': 'fundas-mochilas',
      'BISAGRA': 'cables-y-adaptadores',
      'LIMPIA': 'cables-y-adaptadores',
      'LIMPIEZA': 'cables-y-adaptadores',
      'CAJA P/NOTEBOOK': 'cables-y-adaptadores',
      'CITIZEN PN': 'toners-y-cartuchos',
    }

    for (const p of nonNotebooks) {
      let targetSlug = null
      const name = (p.name || '').toUpperCase()
      for (const [keyword, slug] of Object.entries(accessoryMap)) {
        if (name.includes(keyword)) {
          targetSlug = slug
          break
        }
      }
      if (targetSlug && slugToId[targetSlug]) {
        const fromId = Object.entries(slugToId).find(([s, id]) => s === p.slug)?.[1]
        // Find product ID
        const prodResult = await db.execute({
          sql: 'SELECT id, categorySource FROM products WHERE name = ? AND categoryId = ? AND isActive = 1',
          args: [p.name, fromId || ''],
        })
        if (prodResult.rows.length > 0 && prodResult.rows[0].categorySource !== 'manual') {
          await db.execute({
            sql: "UPDATE products SET categoryId = ?, categorySource = 'auto', updatedAt = datetime('now') WHERE id = ?",
            args: [slugToId[targetSlug], prodResult.rows[0].id],
          })
          console.log(`  FIXED: "${p.name}" [${p.slug} → ${targetSlug}]`)
        }
      }
    }
  } else {
    console.log('  ✅ All notebook products look correct!')
  }

  // Check remaining misplaced products in monitores
  console.log('\n=== REMAINING MONITORES PRODUCTS CHECK ===')
  const monPlaceholders = monitoresCatIds.map(() => '?').join(',')
  const monResult = await db.execute({
    sql: `SELECT id, name, categoryId, categorySource, supplierCategory FROM products WHERE categoryId IN (${monPlaceholders}) AND isActive = 1 ORDER BY name`,
    args: monitoresCatIds,
  })

  const nonMonitors = []
  for (const p of monResult.rows) {
    const name = (p.name || '').toUpperCase()
    const catSlug = idToSlug[p.categoryId]

    // Server fans
    if (/\bFAN\b/i.test(name) && !/\bMONITOR\b/i.test(name)) {
      nonMonitors.push({ name: p.name, slug: catSlug, issue: 'Fan product', supplierCat: p.supplierCategory })
    }
    // Cables for monitors
    if (/\bCABLE\b/i.test(name) && /\bMONITOR\b/i.test(name) && !/\bMONITOR\b/i.test(name.replace(/P\/\s*MONITOR/i, ''))) {
      nonMonitors.push({ name: p.name, slug: catSlug, issue: 'Cable for monitor', supplierCat: p.supplierCategory })
    }
    // Bandejas/KVM
    if (/\bBANDEJA\b/i.test(name) || /\bRACK.*MONITOR/i.test(name)) {
      nonMonitors.push({ name: p.name, slug: catSlug, issue: 'KVM/rack product', supplierCat: p.supplierCategory })
    }
  }

  if (nonMonitors.length > 0) {
    console.log(`  Still found ${nonMonitors.length} non-monitor products:`)
    for (const p of nonMonitors) {
      console.log(`    - "${p.name}" [${p.slug}] issue: ${p.issue} supplierCat: ${p.supplierCat}`)
    }
  } else {
    console.log('  ✅ All monitor products look correct!')
  }

  // Show remaining notebook products for review
  console.log('\n=== ALL NOTEBOOK PRODUCTS (for review) ===')
  const nbResult2 = await db.execute({
    sql: `SELECT name, categoryId FROM products WHERE categoryId IN (${placeholders}) AND isActive = 1 ORDER BY name`,
    args: notebookCatIds,
  })
  for (let i = 0; i < nbResult2.rows.length; i++) {
    const p = nbResult2.rows[i]
    const catSlug = idToSlug[p.categoryId]
    console.log(`  ${i+1}. ${p.name} [${catSlug}]`)
  }
}

main().catch(console.error)
