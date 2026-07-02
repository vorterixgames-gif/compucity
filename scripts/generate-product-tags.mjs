/**
 * Generate tags for existing products. Optimized with batch updates.
 */

import { createClient } from '@libsql/client';

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw',
});

function detectTags(name, tagDefs) {
  const tags = []
  for (const td of tagDefs) {
    if (td.detect(name)) tags.push(td.value)
  }
  return tags
}

const PC_ARMADAS_TAGS = [
  { value: 'gamer', detect: (n) => /\bGAMER\b|\bGAMING\b|\bRTX\b|\bGTX\b|\bVGA\s*\d+|\bV\d+\s*GB?|\bGT\s*\d{3,4}|\bARKHAM\b|\bGAMEMAX\b|\bXPG\b|\bRADEON\s*RX\s*\d{4}|\bARC\s*A?\d{3}/i.test(n) },
  { value: 'oficina', detect: (n) => /\bOFICINA\b|\bOFFICE\b/i.test(n) },
  { value: 'diseno', detect: (n) => /\bDESIGN\b|\bDISE[ÑN]O\b|\bCREATOR\b|\bSTUDIO\b/i.test(n) },
  { value: 'mini_pc', detect: (n) => /\bMINI PC\b|\bSTICK PC\b|\bNUC\b|\bMELE\b|\bN100\b/i.test(n) },
  { value: 'aio', detect: (n) => /\bAIO\b|\bALL[- ]?IN[- ]?ONE\b/i.test(n) },
  { value: 'hp', detect: (n) => /\bHP\b|\bZ[12]G\b|\bOMEN\b|\bVICTUS\b|\bELITEDESK\b|\bPRODESK\b/i.test(n) },
  { value: 'lenovo', detect: (n) => /\bLENOVO\b|\bTHINKCENTRE\b|\bIDEACENTRE\b|\bLEGION\b|\bLOQ\b/i.test(n) },
  { value: 'dell', detect: (n) => /\bDELL\b|\bINSPIRON\b|\bOPTIPLEX\b|\bALIENWARE\b/i.test(n) },
  { value: 'cx', detect: (n) => /\bCX\b/.test(n) && !/\bXC\b/.test(n) },
  { value: 'gamemax', detect: (n) => /\bGAMEMAX\b/i.test(n) },
  { value: 'kelyx', detect: (n) => /\bKELYX\b/i.test(n) },
  { value: 'asus', detect: (n) => /\bASUS\b|\bROG\b|\bTUF\b|\bPN\d/i.test(n) },
  { value: 'intel', detect: (n) => /\bINTEL\b|\bNUC\b/i.test(n) },
  { value: 'arkham', detect: (n) => /\bARKHAM\b/i.test(n) },
  { value: 'xpg', detect: (n) => /\bXPG\b/i.test(n) },
  { value: 'i9', detect: (n) => /\bI9\b|\bCORE\s*9\b|\bCORE\s*ULTRA\s*9\b/i.test(n) },
  { value: 'i7', detect: (n) => /\bI7\b|\bCORE\s*7\b|\bCORE\s*ULTRA\s*7\b|\bU7[- ]?\d/i.test(n) },
  { value: 'i5', detect: (n) => /\bI5\b|\bCORE\s*5\b|\bCORE\s*ULTRA\s*5\b|\bC5[- ]?\d|\bU5[- ]?\d/i.test(n) },
  { value: 'i3', detect: (n) => /\bI3\b|\bCORE\s*3\b|\bC3[- ]?\d/i.test(n) },
  { value: 'celeron', detect: (n) => /\bCELERON\b|\bPENTIUM\b/i.test(n) },
  { value: 'intel_n', detect: (n) => /\bN100\b|\bN305\b|\bN5030\b/i.test(n) },
  { value: 'r9', detect: (n) => /\bRYZEN\s*9\b|\bR9[- ]?\d/i.test(n) },
  { value: 'r7', detect: (n) => /\bRYZEN\s*7\b|\bR7[- ]?\d/i.test(n) },
  { value: 'r5', detect: (n) => /\bRYZEN\s*5\b|\bR5[- ]?\d/i.test(n) },
  { value: 'r3', detect: (n) => /\bRYZEN\s*3\b|\bR3[- ]?\d/i.test(n) },
  { value: 'dedicated_gpu', detect: (n) => /\bRTX\b|\bGTX\b|\bRADEON\s*RX\b|\bARC\s*A?\d{3}|\bVGA\s*\d+|\bV\d+\s*GB?|\bGT\s*\d{3,4}/i.test(n) },
  { value: 'integrated_gpu', detect: (n) => !/\bRTX\b|\bGTX\b|\bRADEON\s*RX\b|\bARC\s*A?\d{3}|\bVGA\s*\d+|\bV\d+\s*GB?|\bGT\s*\d{3,4}/i.test(n) },
]

const NOTEBOOK_TAGS = [
  { value: 'lenovo', detect: (n) => /\bLENOVO\b|\bTHINKPAD\b|\bIDEAPAD\b|\bLOQ\b|\bLEGION\b|\bYOGA\b/i.test(n) },
  { value: 'hp', detect: (n) => /\bHP\b|\bPAVILION\b|\bOMEN\b|\bVICTUS\b|\bDRAGONFLY\b|\bZBOOK\b/i.test(n) },
  { value: 'dell', detect: (n) => /\bDELL\b|\bINSPIRON\b|\bLATITUDE\b|\bALIENWARE\b/i.test(n) },
  { value: 'asus', detect: (n) => /\bASUS\b|\bROG\b|\bTUF\b|\bZENBOOK\b|\bVIVOBOOK\b/i.test(n) },
  { value: 'msi', detect: (n) => /\bMSI\b|\bRAIDER\b|\bTHIN\b|\bCYBORG\b/i.test(n) },
  { value: 'acer', detect: (n) => /\bACER\b|\bASPIRE\b|\bNITRO\b|\bPREDATOR\b/i.test(n) },
  { value: 'cx', detect: (n) => /\bCX\b/.test(n) && !/\bXC\b/.test(n) },
  { value: 'kelyx', detect: (n) => /\bKELYX\b/i.test(n) },
  { value: 'i9', detect: (n) => /\bI9\b|\bCORE\s*9\b|\bCORE\s*ULTRA\s*9\b/i.test(n) },
  { value: 'i7', detect: (n) => /\bI7\b|\bCORE\s*7\b|\bCORE\s*ULTRA\s*7\b|\bU7[- ]?\d/i.test(n) },
  { value: 'i5', detect: (n) => /\bI5\b|\bCORE\s*5\b|\bCORE\s*ULTRA\s*5\b|\bC5[- ]?\d|\bU5[- ]?\d/i.test(n) },
  { value: 'i3', detect: (n) => /\bI3\b|\bCORE\s*3\b|\bC3[- ]?\d/i.test(n) },
  { value: 'celeron', detect: (n) => /\bCELERON\b|\bPENTIUM\b/i.test(n) },
  { value: 'intel_n', detect: (n) => /\bN100\b|\bN305\b|\bN5030\b/i.test(n) },
  { value: 'r9', detect: (n) => /\bRYZEN\s*9\b|\bR9[- ]?\d/i.test(n) },
  { value: 'r7', detect: (n) => /\bRYZEN\s*7\b|\bR7[- ]?\d/i.test(n) },
  { value: 'r5', detect: (n) => /\bRYZEN\s*5\b|\bR5[- ]?\d/i.test(n) },
  { value: 'r3', detect: (n) => /\bRYZEN\s*3\b|\bR3[- ]?\d/i.test(n) },
  { value: 'dedicated_gpu', detect: (n) => /\bRTX\b|\bGTX\b|\bRADEON\s*RX\b|\bARC\s*A?\d{3}|\bVGA\s*\d+|\bV\d+\s*GB?|\bGT\s*\d{3,4}/i.test(n) },
  { value: 'integrated_gpu', detect: (n) => !/\bRTX\b|\bGTX\b|\bRADEON\s*RX\b|\bARC\s*A?\d{3}|\bVGA\s*\d+|\bV\d+\s*GB?|\bGT\s*\d{3,4}/i.test(n) },
]

const RAM_TAGS = [
  { value: 'ram_pc', detect: (n) => !/\bSODIMM\b/i.test(n) && /\bDDR[345]\b|\bUDIMM\b|\bDIMM\b/i.test(n) },
  { value: 'ram_notebook', detect: (n) => /\bSODIMM\b/i.test(n) },
  { value: 'kingston', detect: (n) => /\bKINGSTON\b|\bFURY\b/i.test(n) },
  { value: 'hiksemi', detect: (n) => /\bHIKSEMI\b/i.test(n) },
  { value: 'adata', detect: (n) => /\bADATA\b|\bXPG\b/i.test(n) },
  { value: 'corsair', detect: (n) => /\bCORSAIR\b|\bVENGEANCE\b/i.test(n) },
  { value: 'memox', detect: (n) => /\bMEMOX\b/i.test(n) },
  { value: 'crucial', detect: (n) => /\bCRUCIAL\b/i.test(n) },
  { value: 'lexar', detect: (n) => /\bLEXAR\b/i.test(n) },
  { value: 'gskill', detect: (n) => /\bG\.?SKILL\b|\bTRIDENT\b|\bRIPJAWS\b/i.test(n) },
  { value: 'patriot', detect: (n) => /\bPATRIOT\b/i.test(n) },
  { value: 'ddr3', detect: (n) => /\bDDR3\b/i.test(n) },
  { value: 'ddr4', detect: (n) => /\bDDR4\b/i.test(n) },
  { value: 'ddr5', detect: (n) => /\bDDR5\b/i.test(n) },
]

async function processCategory(catSlugs, tagDefs) {
  // Get all category IDs
  const cats = await db.execute({ sql: 'SELECT id, slug FROM categories WHERE enabled = 1' })
  const catIds = cats.rows.filter(c => catSlugs.includes(c.slug)).map(c => c.id)
  
  if (catIds.length === 0) {
    console.log(`  No matching categories found`)
    return 0
  }
  
  const placeholders = catIds.map(() => '?').join(',')
  const products = await db.execute({
    sql: `SELECT id, name, tags FROM products WHERE categoryId IN (${placeholders}) AND isActive = 1`,
    args: catIds,
  })

  console.log(`  ${(products.rows).length} products`)
  
  let updated = 0
  const batchSize = 20
  const updates = []
  
  for (const p of products.rows) {
    const existingTags = p.tags ? JSON.parse(p.tags) : []
    if (existingTags.length > 0) continue
    
    const detected = detectTags(p.name || '', tagDefs)
    if (detected.length > 0) {
      updates.push({ id: p.id, tags: JSON.stringify(detected) })
    }
  }
  
  // Batch update
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize)
    await Promise.all(batch.map(u => 
      db.execute({ sql: 'UPDATE products SET tags = ? WHERE id = ?', args: [u.tags, u.id] })
    ))
    updated += batch.length
  }
  
  return updated
}

async function migrate() {
  console.log('=== GENERATE TAGS FOR EXISTING PRODUCTS ===\n')
  
  let total = 0
  
  console.log('PC Armadas:')
  total += await processCategory(['pc-armadas'], PC_ARMADAS_TAGS)
  
  console.log('Notebooks:')
  total += await processCategory(['notebooks', 'gamer-y-diseno', 'oficina'], NOTEBOOK_TAGS)
  
  console.log('RAM:')
  total += await processCategory(['memorias-ram', 'memoria-ram-pc', 'memoria-ram-notebook'], RAM_TAGS)
  
  console.log(`\n✅ Total: ${total} products updated with tags`)
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
