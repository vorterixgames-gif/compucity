import { createClient } from '@libsql/client/web'

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw',
})

async function main() {
  const catResult = await db.execute('SELECT id, slug, name, parentId FROM categories')
  const slugToId = {}
  for (const row of catResult.rows) {
    slugToId[row.slug] = row.id
  }

  // Specific product fixes
  const fixes = [
    // Notebooks: remaining chargers (named "Notebook XXW" or "Notebook P/auto")
    { nameContains: 'Notebook 65W Multiples Conexiones', toSlug: 'cargadores', desc: 'Notebook charger' },
    { nameContains: 'Notebook 70W Automatica Noganet LED EXPO', toSlug: 'cargadores', desc: 'Notebook charger' },
    { nameContains: 'Notebook 70W Automatica Noganet Led+usb', toSlug: 'cargadores', desc: 'Notebook charger' },
    { nameContains: 'Notebook 90W Automatic Multiples Conexiones', toSlug: 'cargadores', desc: 'Notebook charger' },
    { nameContains: 'Notebook P/auto 120W Multiples Conexiones', toSlug: 'cargadores', desc: 'Notebook car charger' },
    { nameContains: 'Notebook P/auto 80W Multiples Conexiones', toSlug: 'cargadores', desc: 'Notebook car charger' },
    { nameContains: 'Notebook P/auto 90W Multiples Conexiones', toSlug: 'cargadores', desc: 'Notebook car charger' },
    { nameContains: 'Dell P/notebook 45W', toSlug: 'cargadores', desc: 'Dell notebook charger' },

    // Notebooks: bags/morral
    { nameContains: 'Morral P/notebook Portdesigns 15.6 Oxford Black', toSlug: 'fundas-mochilas', desc: 'Morral for notebook' },
    { nameContains: 'Morral P/notebook Portdesigns 15.6 Oxford Blue', toSlug: 'fundas-mochilas', desc: 'Morral for notebook' },

    // Notebooks: cleaning
    { nameContains: 'Compitt Kit P/notebook', toSlug: 'cables-y-adaptadores', desc: 'Cleaning kit' },

    // Notebooks: projectors (PORTATIL triggers notebooks)
    { nameContains: 'Proyector Mini Portatil', toSlug: 'impresion', desc: 'Projector not notebook' },

    // Notebooks: scanner (PORTATIL triggers notebooks)
    { nameContains: 'Scanner Brother Ds-640 Portatil', toSlug: 'impresion', desc: 'Scanner not notebook' },

    // Monitores: APC Netbotz Rack Monitor (environmental monitors, not display monitors)
    { nameContains: 'Apc Netbotz Rack Monitor 250 (demo)', toSlug: 'placas-de-red', desc: 'Environmental monitor not display' },
    { nameContains: 'Apc Netbotz Rack Monitor 250A', toSlug: 'placas-de-red', desc: 'Environmental monitor not display' },
    { nameContains: 'Apc Netbotz Rack Monitor 750', toSlug: 'placas-de-red', desc: 'Environmental monitor not display' },

    // Monitores/soportes: CD tray, paper tray, plotter stand
    { nameContains: 'Bandeja Soporte DE CD SP R-270', toSlug: 'cables-y-adaptadores', desc: 'CD tray not monitor' },
    { nameContains: 'Bandeja Soporte DE Papel Tx105', toSlug: 'cables-y-adaptadores', desc: 'Paper tray not monitor' },
    { nameContains: 'Epson Soporte Plotter T3170', toSlug: 'impresion', desc: 'Plotter stand not monitor' },
  ]

  let totalFixed = 0

  for (const fix of fixes) {
    const toCatId = slugToId[fix.toSlug]
    if (!toCatId) {
      console.log(`  SKIP: slug "${fix.toSlug}" not found`)
      continue
    }

    // Find the product by name
    const result = await db.execute({
      sql: `SELECT id, name, categoryId, categorySource FROM products WHERE name LIKE ? AND isActive = 1`,
      args: [`%${fix.nameContains}%`],
    })

    for (const product of result.rows) {
      if (product.categorySource === 'manual') {
        console.log(`  PROTECTED (manual): "${product.name}"`)
        continue
      }

      await db.execute({
        sql: "UPDATE products SET categoryId = ?, categorySource = 'auto', updatedAt = datetime('now') WHERE id = ?",
        args: [toCatId, product.id],
      })
      totalFixed++
      console.log(`  FIXED: "${product.name}" → ${fix.toSlug} (${fix.desc})`)
    }
  }

  console.log(`\n=== TOTAL: ${totalFixed} additional products fixed ===`)
}

main().catch(console.error)
