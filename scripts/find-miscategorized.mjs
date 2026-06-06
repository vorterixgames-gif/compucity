import { createClient } from '@libsql/client/web'

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw',
})

async function main() {
  // 1. Get all categories
  const catResult = await db.execute('SELECT id, name, slug, parentId FROM categories ORDER BY name')
  const categories = catResult.rows
  
  // Build slug -> name, id -> slug maps
  const slugToName = {}
  const idToSlug = {}
  const idToName = {}
  const idToParentId = {}
  
  for (const cat of categories) {
    slugToName[cat.slug] = cat.name
    idToSlug[cat.id] = cat.slug
    idToName[cat.id] = cat.name
    idToParentId[cat.id] = cat.parentId
  }
  
  // Build parent -> children map
  const parentToChildren = {}
  for (const cat of categories) {
    if (cat.parentId) {
      if (!parentToChildren[cat.parentId]) parentToChildren[cat.parentId] = []
      parentToChildren[cat.parentId].push(cat.id)
    }
  }
  
  // 2. For each category, get all active products
  console.log('=== PRODUCTS BY CATEGORY (active, with stock) ===\n')
  
  // Get top-level (parent) categories
  const parentCategories = categories.filter(c => !c.parentId)
  
  for (const parentCat of parentCategories) {
    // Get all category IDs (parent + children)
    const catIds = [parentCat.id]
    const children = parentToChildren[parentCat.id] || []
    catIds.push(...children)
    
    // Get products
    const placeholders = catIds.map(() => '?').join(',')
    const prodResult = await db.execute({
      sql: `SELECT id, name, categoryId, supplierCategory, categorySource FROM products WHERE categoryId IN (${placeholders}) AND isActive = 1`,
      args: catIds,
    })
    
    const products = prodResult.rows
    if (products.length === 0) continue
    
    console.log(`\n${'='.repeat(80)}`)
    console.log(`${parentCat.name} (${parentCat.slug}) — ${products.length} productos`)
    console.log('='.repeat(80))
    
    // Check for misplaced products
    const misplaced = []
    
    for (const prod of products) {
      const name = (prod.name || '').toUpperCase()
      const catSlug = idToSlug[prod.categoryId] || 'unknown'
      
      const issue = checkIfMisplaced(name, catSlug, parentCat.slug)
      if (issue) {
        misplaced.push({ name: prod.name, slug: catSlug, issue, supplierCategory: prod.supplierCategory })
      }
    }
    
    if (misplaced.length > 0) {
      console.log(`\n  ❌ PRODUCTOS MAL CATEGORIZADOS (${misplaced.length}):`)
      for (const m of misplaced) {
        console.log(`    - "${m.name}"`)
        console.log(`      Categoría: ${m.slug} | Problema: ${m.issue}`)
        if (m.supplierCategory) console.log(`      SupplierCat: ${m.supplierCategory}`)
      }
    } else {
      console.log(`\n  ✅ Todos los productos parecen estar bien categorizados`)
    }
    
    // List ALL products for review (abbreviated)
    console.log(`\n  Lista de productos (primeros 30):`)
    const sorted = [...products].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    for (let i = 0; i < Math.min(30, sorted.length); i++) {
      const p = sorted[i]
      const subSlug = idToSlug[p.categoryId] || '?'
      const marker = misplaced.find(m => m.name === p.name) ? ' ⚠️' : ''
      console.log(`    ${i+1}. ${p.name} [${subSlug}]${marker}`)
    }
    if (sorted.length > 30) {
      console.log(`    ... y ${sorted.length - 30} más`)
    }
  }
}

function checkIfMisplaced(name, catSlug, parentSlug) {
  // Skip if no name
  if (!name) return 'Sin nombre'
  
  // === CHECK PER PARENT CATEGORY ===
  
  // NOTEBOOKS: Should only contain actual laptops/notebooks/tablets
  if (parentSlug === 'notebooks') {
    // Accessories for notebooks should NOT be here
    if (/\bCABLE\b/.test(name) && !/\bNOTEBOOK\b/.test(name) && !/\bLAPTOP\b/.test(name)) return 'Cable no es una notebook'
    if (/\bADAPTADOR\b/.test(name) && !/\bNOTEBOOK\b/.test(name) && !/\bLAPTOP\b/.test(name)) return 'Adaptador no es una notebook'
    if (/\bCARGADOR\b/.test(name) && !/\bNOTEBOOK\b/.test(name) && !/\bLAPTOP\b/.test(name)) return 'Cargador no es una notebook'
    if (/\bBASE\b/.test(name) && !/\bNOTEBOOK\b/.test(name) && !/\bLAPTOP\b/.test(name)) return 'Base no es una notebook'
    if (/\bFUNDA\b/.test(name) || /\bMOCHILA\b/.test(name)) return 'Fundas/mochilas no son notebooks'
    if (/\bBATERIA\b/.test(name) && !/\bNOTEBOOK\b/.test(name)) return 'Batería no es una notebook'
    if (/\bFAN\b/.test(name) && !/\bNOTEBOOK\b/.test(name)) return 'Fan no es una notebook'
    if (/\bCOOLER\b/.test(name) && !/\bNOTEBOOK\b/.test(name)) return 'Cooler no es una notebook'
    if (/\bSOPORTE\b/.test(name) && !/\bNOTEBOOK\b/.test(name)) return 'Soporte no es una notebook'
    if (/\bMONITOR\b/.test(name) && !/\bNOTEBOOK\b/.test(name)) return 'Monitor no es una notebook'
    if (/\bTECLADO\b/.test(name) && !/\bNOTEBOOK\b/.test(name)) return 'Teclado no es una notebook'
    if (/\bMOUSE\b/.test(name) && !/\bNOTEBOOK\b/.test(name)) return 'Mouse no es una notebook'
    if (/\bAURICULAR\b/.test(name)) return 'Auricular no es una notebook'
    if (/\bPARLANTE\b/.test(name) && !/\bNOTEBOOK\b/.test(name)) return 'Parlante no es una notebook'
    if (/\bWEBCAM\b/.test(name)) return 'Webcam no es una notebook'
    if (/\bMICROFONO\b/.test(name)) return 'Micrófono no es una notebook'
    if (/\bDISCO\b/.test(name) && !/\bNOTEBOOK\b/.test(name)) return 'Disco no es una notebook'
    if (/\bMEMORIA\b/.test(name) && /\bSODIMM\b/.test(name)) return null  // SODIMM is notebook RAM, ok in some contexts
    if (/\bSSD\b/.test(name) && !/\bNOTEBOOK\b/.test(name) && !/\bLAPTOP\b/.test(name)) return 'SSD no es una notebook'
    if (/\bUPS\b/.test(name)) return 'UPS no es una notebook'
    if (/\bROUTER\b/.test(name)) return 'Router no es una notebook'
    if (/\bSWITCH\b/.test(name)) return 'Switch no es una notebook'
    if (/\bIMPRESORA\b/.test(name)) return 'Impresora no es una notebook'
  }
  
  // MONITORES: Should only contain actual monitors
  if (parentSlug === 'monitores') {
    if (/\bCABLE\b/.test(name) && !/\bMONITOR\b/.test(name)) return 'Cable no es un monitor'
    if (/\bADAPTADOR\b/.test(name) && !/\bMONITOR\b/.test(name)) return 'Adaptador no es un monitor'
    if (/\bFAN\b/.test(name) || /\bCOOLER\b/.test(name)) return 'Fan/cooler no es un monitor'
    if (/\bCARGADOR\b/.test(name) && !/\bMONITOR\b/.test(name)) return 'Cargador no es un monitor'
    if (/\bNOTEBOOK\b/.test(name) || /\bLAPTOP\b/.test(name)) return 'Notebook no es un monitor'
    if (/\bTECLADO\b/.test(name)) return 'Teclado no es un monitor'
    if (/\bMOUSE\b/.test(name)) return 'Mouse no es un monitor'
    if (/\bAURICULAR\b/.test(name)) return 'Auricular no es un monitor'
    if (/\bWEBCAM\b/.test(name)) return 'Webcam no es un monitor'
    if (/\bSSD\b/.test(name) || /\bHDD\b/.test(name)) return 'Disco no es un monitor'
    if (/\bMEMORIA\b/.test(name) && /\bDDR\b/.test(name)) return 'Memoria RAM no es un monitor'
    if (/\bFUENTE\b/.test(name)) return 'Fuente no es un monitor'
    if (/\bGABINETE\b/.test(name)) return 'Gabinete no es un monitor'
  }
  
  // PC ARMADAS: Should only contain complete PCs
  if (parentSlug === 'pc-armadas') {
    if (/\bCABLE\b/.test(name) && !/\bPC\b/.test(name)) return 'Cable no es una PC armada'
    if (/\bMONITOR\b/.test(name) && !/\bPC\b/.test(name) && !/\bALL.?IN.?ONE\b/.test(name) && !/\bAIO\b/.test(name)) return 'Monitor no es una PC armada'
    if (/\bTECLADO\b/.test(name) && !/\bPC\b/.test(name) && !/\bKIT\b/.test(name)) return 'Teclado no es una PC armada'
    if (/\bMOUSE\b/.test(name) && !/\bPC\b/.test(name)) return 'Mouse no es una PC armada'
    if (/\bAURICULAR\b/.test(name) && !/\bPC\b/.test(name) && !/\bKIT\b/.test(name)) return 'Auricular no es una PC armada'
    if (/\bSWITCH\b/.test(name) && !/\bPC\b/.test(name)) return 'Switch no es una PC armada'
    if (/\bROUTER\b/.test(name)) return 'Router no es una PC armada'
    if (/\bIMPRESORA\b/.test(name)) return 'Impresora no es una PC armada'
    if (/\bUPS\b/.test(name)) return 'UPS no es una PC armada'
    if (/\bSILLA\b/.test(name)) return 'Silla no es una PC armada'
  }
  
  // COMPONENTES DE PC: Subcategories
  if (parentSlug === 'componentes-de-pc') {
    // Placas de Video
    if (catSlug === 'placas-de-video') {
      if (/\bCABLE\b/.test(name)) return 'Cable no es una placa de video'
      if (/\bADAPTADOR\b/.test(name) && !/\bVGA\b/.test(name)) return 'Adaptador no es una placa de video'
      if (/\bNOTEBOOK\b/.test(name) || /\bLAPTOP\b/.test(name)) return 'Notebook no es una placa de video'
      if (/\bIP.?CAM\b/.test(name)) return 'IP Cam no es una placa de video'
      if (/\bMOTHER\b/.test(name)) return 'Motherboard no es una placa de video'
      if (/\bMONITOR\b/.test(name)) return 'Monitor no es una placa de video'
      if (/\bPC\b/.test(name) && (/\bGAMER\b/.test(name) || /\bLENOVO\b/.test(name) || /\bKELYX\b/.test(name))) return 'PC armada no es una placa de video'
      if (/\bMINI.?PC\b/.test(name) || /\bBAREBONE\b/.test(name)) return 'Mini PC no es una placa de video'
      if (/\bREPUESTO\b/.test(name)) return 'Repuesto no es una placa de video'
    }
    
    // Microprocesadores
    if (catSlug === 'microprocesadores') {
      if (/\bMOTHER\b/.test(name)) return 'Motherboard no es un microprocesador'
      if (/\bNOTEBOOK\b/.test(name) || /\bLAPTOP\b/.test(name)) return 'Notebook no es un microprocesador'
      if (/\bPC\b/.test(name)) return 'PC no es un microprocesador'
      if (/\bMINI.?PC\b/.test(name)) return 'Mini PC no es un microprocesador'
      if (/\bCOOLER\b/.test(name) || /\bFAN\b/.test(name)) return 'Cooler no es un microprocesador'
    }
    
    // Memorias RAM
    if (catSlug === 'memorias-ram') {
      if (/\bNOTEBOOK\b/.test(name) || /\bLAPTOP\b/.test(name)) return 'Notebook no es memoria RAM'
      if (/\bPC\b/.test(name) && !/\bRAM\b/.test(name)) return 'PC no es memoria RAM'
      if (/\bSSD\b/.test(name) || /\bHDD\b/.test(name)) return 'Disco no es memoria RAM'
    }
    
    // Discos SSD
    if (catSlug === 'discos-ssd') {
      if (/\bNOTEBOOK\b/.test(name) || /\bLAPTOP\b/.test(name)) return 'Notebook no es un SSD'
      if (/\bEXTERNO\b/.test(name) || /\bPORTABLE\b/.test(name)) return 'Disco externo no es SSD interno'
      if (/\bPENDRIVE\b/.test(name) || /\bFLASH.?DRIVE\b/.test(name)) return 'Pendrive no es un SSD'
      if (/\bPC\b/.test(name)) return 'PC no es un SSD'
    }
    
    // Discos HDD
    if (catSlug === 'discos-hdd') {
      if (/\bEXTERNO\b/.test(name) || /\bPORTABLE\b/.test(name)) return 'Disco externo no es HDD interno'
      if (/\bNOTEBOOK\b/.test(name) || /\bLAPTOP\b/.test(name)) return 'Notebook no es un HDD'
      if (/\bSSD\b/.test(name) && !/\bHDD\b/.test(name)) return 'SSD no es un HDD'
    }
    
    // Fuentes
    if (catSlug === 'fuentes') {
      if (/\bNOTEBOOK\b/.test(name) || /\bLAPTOP\b/.test(name)) return 'Notebook no es una fuente'
      if (/\bCARGADOR\b/.test(name) && !/\bFUENTE\b/.test(name)) return 'Cargador no es una fuente'
      if (/\bPC\b/.test(name) && (/\bGAMER\b/.test(name) || /\bLENOVO\b/.test(name))) return 'PC armada no es una fuente'
    }
    
    // Gabinetes
    if (catSlug === 'gabinetes') {
      if (/\bNOTEBOOK\b/.test(name) || /\bLAPTOP\b/.test(name)) return 'Notebook no es un gabinete'
      if (/\bPC\b/.test(name) && !/\bGABINETE\b/.test(name)) return 'PC armada no es un gabinete'
    }
    
    // Refrigeración
    if (catSlug === 'refrigeracion') {
      if (/\bSWITCH\b/.test(name)) return 'Switch no es refrigeración'
      if (/\bHIKVISION\b/.test(name)) return 'Hikvision no es refrigeración'
      if (/\bNOTEBOOK\b/.test(name) || /\bLAPTOP\b/.test(name)) return 'Notebook no es refrigeración'
      if (/\bPC\b/.test(name) && !/\bCOOLER\b/.test(name) && !/\bFAN\b/.test(name)) return 'PC armada no es refrigeración'
    }
    
    // Motherboards
    if (catSlug === 'motherboards') {
      if (/\bNOTEBOOK\b/.test(name) || /\bLAPTOP\b/.test(name)) return 'Notebook no es una motherboard'
      if (/\bCABLE\b/.test(name)) return 'Cable no es una motherboard'
    }
  }
  
  // PERIFERICOS
  if (parentSlug === 'perifericos') {
    if (/\bNOTEBOOK\b/.test(name) || /\bLAPTOP\b/.test(name)) return 'Notebook no es un periférico'
    if (/\bMONITOR\b/.test(name)) return 'Monitor no es un periférico'
    if (/\bPC\b/.test(name) && /\bGAMER\b/.test(name)) return 'PC no es un periférico'
  }
  
  // CONECTIVIDAD Y REDES
  if (parentSlug === 'conectividad-y-redes') {
    if (/\bNOTEBOOK\b/.test(name) || /\bLAPTOP\b/.test(name)) return 'Notebook no es un producto de red'
    if (/\bMONITOR\b/.test(name) && !/\bCAMARA\b/.test(name)) return 'Monitor no es un producto de red'
  }
  
  // ACCESORIOS
  if (parentSlug === 'accesorios') {
    if (/\bNOTEBOOK\b/.test(name) || /\bLAPTOP\b/.test(name)) return 'Notebook no es un accesorio'
    if (/\bPC\b/.test(name) && (/\bGAMER\b/.test(name) || /\bLENOVO\b/.test(name))) return 'PC armada no es un accesorio'
    if (/\bMONITOR\b/.test(name) && !/\bSOPORTE\b/.test(name) && !/\bBRAZO\b/.test(name)) return 'Monitor no es un accesorio'
  }
  
  // IMPRESION
  if (parentSlug === 'impresion') {
    if (/\bNOTEBOOK\b/.test(name) || /\bLAPTOP\b/.test(name)) return 'Notebook no es impresión'
    if (/\bMONITOR\b/.test(name)) return 'Monitor no es impresión'
  }
  
  // ALMACENAMIENTO EXTERNO
  if (parentSlug === 'almacenamiento-externo') {
    if (/\bNOTEBOOK\b/.test(name) || /\bLAPTOP\b/.test(name)) return 'Notebook no es almacenamiento externo'
  }
  
  return null
}

main().catch(console.error)
