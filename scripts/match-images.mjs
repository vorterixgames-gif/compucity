import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env')
const envContent = readFileSync(envPath, 'utf-8')
const envVars = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) envVars[match[1].trim()] = match[2].trim()
}

const db = createClient({ url: envVars.DATABASE_URL, authToken: envVars.TURSO_AUTH_TOKEN })

function extractKeywords(name) {
  const upper = name.toUpperCase()
  const keywords = []
  
  const brands = ['LOGITECH', 'CORSAIR', 'RAZER', 'HYPERX', 'KINGSTON', 'COOLER MASTER', 'ASUS', 'MSI', 'GIGABYTE', 'LENOVO', 'HP', 'DELL', 'TP-LINK', 'GENIUS', 'SAMSUNG', 'LG', 'WESTERN', 'SEAGATE', 'ADATA', 'CRUCIAL', 'BE QUIET', 'THERMALTAKE', 'NZXT', 'STEELSERIES', 'REDRAGON', 'MARVO', 'NOCTUA', 'ARCTIC', 'DEEPCOOL', 'GAMEMAX', 'X-TECH', 'KLIPXTREME', 'VERBATIM', 'SANDISK']
  
  for (const brand of brands) {
    if (upper.includes(brand)) {
      keywords.push(brand)
      break
    }
  }
  
  const modelPatterns = [
    /([A-Z]{2,4}[- ]?\d{3,5}[A-Z]*)/g,
    /(\d{4}[A-Z]{0,3})/g,
  ]
  
  for (const pattern of modelPatterns) {
    const matches = upper.match(pattern)
    if (matches) {
      keywords.push(...matches.slice(0, 2))
    }
  }
  
  return keywords.join(' ')
}

async function main() {
  const airIntra = await db.execute(`SELECT id, name, providerSku FROM products WHERE providerId = 'air-intra-1780331633566' AND (images = '[]' OR images IS NULL) AND isActive = 1 AND stock > 0 AND categoryId IS NOT NULL`)
  const elitInvid = await db.execute(`SELECT p.name, p.images, s.name as supplier FROM products p JOIN suppliers s ON p.providerId = s.id WHERE s.name IN ('Elit', 'Invid Computers') AND p.images != '[]' AND p.images IS NOT NULL AND p.isActive = 1`)

  console.log('Air Intra without images:', airIntra.rows.length)
  console.log('Elit/Invid with images:', elitInvid.rows.length)

  // Build index from Elit/Invid: keywords -> image URL
  const imageIndex = new Map()
  for (const row of elitInvid.rows) {
    const images = JSON.parse(row.images || '[]')
    if (images.length === 0) continue
    const keywords = extractKeywords(row.name)
    if (keywords) {
      imageIndex.set(keywords, { url: images[0], source: row.supplier, name: row.name })
    }
  }

  console.log('Image index entries:', imageIndex.size)

  // Match Air Intra products
  let matched = 0
  const matches = []

  for (const ai of airIntra.rows) {
    const keywords = extractKeywords(ai.name)
    if (!keywords) continue

    for (const [idxKeywords, imageData] of imageIndex) {
      const aiKws = new Set(keywords.split(' '))
      const idxKws = new Set(idxKeywords.split(' '))
      
      let overlap = 0
      for (const kw of aiKws) {
        if (idxKws.has(kw)) overlap++
      }
      
      if (overlap >= 2) {
        matches.push({ 
          id: ai.id, 
          name: ai.name, 
          imageUrl: imageData.url,
          sourceName: imageData.name,
          source: imageData.source,
          overlap
        })
        matched++
        break
      }
    }
  }

  console.log('\nKeyword matches:', matched)
  for (const m of matches.slice(0, 15)) {
    console.log(`  [${m.overlap}] ${m.name}  <-  ${m.source} | ${m.sourceName}`)
  }
  
  console.log('\nTotal potential image matches:', matched)
}

main().catch(e => console.error(e))
