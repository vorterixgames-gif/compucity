#!/usr/bin/env node
/**
 * Cross-provider image copy v2: brand + category matching
 * Matches Air Intra products without images to Invid/Elit products with images
 * using brand name + category as the matching key.
 */

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

// Extended brand list
const BRANDS = [
  'LOGITECH', 'CORSAIR', 'RAZER', 'HYPERX', 'KINGSTON', 'COOLER MASTER',
  'ASUS ROG', 'ASUS TUF', 'ASUS', 'MSI', 'GIGABYTE', 'LENOVO', 'HP', 'DELL',
  'TP-LINK', 'GENIUS', 'SAMSUNG', 'LG', 'SEAGATE', 'ADATA', 'CRUCIAL',
  'BE QUIET', 'THERMALTAKE', 'NZXT', 'STEELSERIES', 'REDRAGON', 'MARVO',
  'NOCTUA', 'ARCTIC', 'DEEPCOOL', 'GAMEMAX', 'X-TECH', 'KLIPXTREME',
  'VERBATIM', 'SANDISK', 'WESTERN DIGITAL', 'WESTERN', 'INTEL', 'AMD', 'NVIDIA',
  'BROTHER', 'EPSON', 'CANON', 'HIKVISION', 'DAHUA', 'VTEX', 'PRISM',
  'FOXBOX', 'LEIYON', 'KELYX', 'NOBREAK', 'NOVAPRA', 'URBANO', 'ICIDU',
  'CABLETECH', 'GENElsi', 'NACEB', 'VALIANT', 'PCARMAR', 'SATELLITE',
]

function extractBrand(name) {
  const upper = name.toUpperCase()
  // Try multi-word brands first
  for (const brand of BRANDS.sort((a, b) => b.length - a.length)) {
    if (upper.includes(brand)) return brand
  }
  // Try extracting first word as potential brand
  const firstWord = upper.split(/\s+/)[0]
  if (firstWord.length >= 3) return firstWord
  return ''
}

function normalizeForMatch(name) {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Calculate simple word overlap score between two names
function nameSimilarity(name1, name2) {
  const words1 = new Set(normalizeForMatch(name1).split(' ').filter(w => w.length > 2))
  const words2 = new Set(normalizeForMatch(name2).split(' ').filter(w => w.length > 2))
  
  let intersection = 0
  for (const w of words1) {
    if (words2.has(w)) intersection++
  }
  
  const union = new Set([...words1, ...words2]).size
  if (union === 0) return 0
  return intersection / union // Jaccard similarity
}

async function main() {
  console.log('=== Cross-Provider Image Copy v2 (Brand + Category) ===\n')

  const BATCH_LIMIT = parseInt(process.argv[2]) || 0

  // Step 1: Get Air Intra products without images
  console.log('Loading Air Intra products without images...')
  const airIntraFull = await db.execute(
    `SELECT id, name, categoryId FROM products 
     WHERE providerId = 'air-intra-1780331633566' 
     AND (images = '[]' OR images IS NULL) 
     AND isActive = 1 AND stock > 0 AND categoryId IS NOT NULL`
  )
  
  const airIntra = BATCH_LIMIT > 0 
    ? { rows: airIntraFull.rows.slice(0, BATCH_LIMIT) } 
    : airIntraFull
  console.log(`  ${airIntraFull.rows.length} total need images, processing ${airIntra.rows.length}`)

  // Step 2: Get all Invid/Elit products with images, grouped by (brand, categoryId)
  console.log('Loading Invid/Elit products with images...')
  const donors = await db.execute(
    `SELECT p.id, p.name, p.images, p.categoryId, s.name as supplier 
     FROM products p JOIN suppliers s ON p.providerId = s.id 
     WHERE s.name IN ('Elit', 'Invid Computers') 
     AND p.images != '[]' AND p.images IS NOT NULL AND p.isActive = 1`
  )
  console.log(`  ${donors.rows.length} donor products with images`)

  // Build lookup: brand -> categoryId -> [donor products]
  const donorByBrandAndCategory = new Map()
  const donorByBrand = new Map()
  
  for (const row of donors.rows) {
    const images = JSON.parse(row.images || '[]')
    if (images.length === 0) continue
    
    const brand = extractBrand(row.name)
    const donor = { id: row.id, name: row.name, images, categoryId: row.categoryId, supplier: row.supplier, brand }
    
    // By brand + category
    const key1 = `${brand}::${row.categoryId || 'none'}`
    if (!donorByBrandAndCategory.has(key1)) donorByBrandAndCategory.set(key1, [])
    donorByBrandAndCategory.get(key1).push(donor)
    
    // By brand only
    if (!donorByBrand.has(brand)) donorByBrand.set(brand, [])
    donorByBrand.get(brand).push(donor)
  }

  console.log(`  ${donorByBrandAndCategory.size} unique brand+category combos`)
  console.log(`  ${donorByBrand.size} unique brands`)

  // Step 3: Match Air Intra products
  let enriched = 0, failed = 0, noBrandMatch = 0, noCategoryMatch = 0, downloaded = 0
  const results = []

  for (const ai of airIntra.rows) {
    const aiBrand = extractBrand(ai.name)
    
    if (!aiBrand) {
      noBrandMatch++
      continue
    }

    // Strategy 1: Exact brand + category match, then find best name similarity
    let bestDonor = null
    let bestScore = 0
    
    const key = `${aiBrand}::${ai.categoryId || 'none'}`
    const sameCategoryDonors = donorByBrandAndCategory.get(key)
    
    if (sameCategoryDonors) {
      for (const donor of sameCategoryDonors) {
        const sim = nameSimilarity(ai.name, donor.name)
        if (sim > bestScore) {
          bestScore = sim
          bestDonor = donor
        }
      }
    }
    
    // Strategy 2: Brand match in same category (different brand spelling)
    if (!bestDonor || bestScore < 0.1) {
      const brandDonors = donorByBrand.get(aiBrand)
      if (brandDonors) {
        // Filter to same category first
        const sameCatBrandDonors = brandDonors.filter(d => d.categoryId === ai.categoryId)
        const pool = sameCatBrandDonors.length > 0 ? sameCatBrandDonors : brandDonors
        
        for (const donor of pool) {
          const sim = nameSimilarity(ai.name, donor.name)
          if (sim > bestScore) {
            bestScore = sim
            bestDonor = donor
          }
        }
      }
    }

    if (!bestDonor) {
      noCategoryMatch++
      continue
    }

    // We found a match! Instead of downloading and re-encoding the image,
    // we can just reference the same image URL.
    // For /api/image/ URLs, the same ID can be shared across products.
    // For external URLs, we can copy the URL directly.
    
    const imageUrl = bestDonor.images[0]
    
    // Check if this is an internal /api/image/ URL or external
    if (imageUrl.startsWith('/api/image/')) {
      // Internal image - just reference the same image ID
      // But we need to merge with any existing images the product might have
      await db.execute({
        sql: `UPDATE products SET images = ?, updatedAt = datetime('now') WHERE id = ?`,
        args: [JSON.stringify([imageUrl]), ai.id],
      })
    } else {
      // External URL - copy it directly (same as original sync does)
      await db.execute({
        sql: `UPDATE products SET images = ?, updatedAt = datetime('now') WHERE id = ?`,
        args: [JSON.stringify([imageUrl]), ai.id],
      })
    }

    enriched++
    const matchType = bestScore >= 0.3 ? 'strong' : bestScore >= 0.15 ? 'moderate' : 'weak'
    
    if (enriched <= 10 || enriched % 50 === 0) {
      console.log(`✓ [${enriched}] ${ai.name}`)
      console.log(`    → ${bestDonor.supplier}: ${bestDonor.name} (${matchType}, sim=${bestScore.toFixed(3)})`)
    }

    await new Promise(r => setTimeout(r, 30))
  }

  console.log('\n========================================')
  console.log(`Enriched: ${enriched}`)
  console.log(`No brand match: ${noBrandMatch}`)
  console.log(`No category/brand+cat match: ${noCategoryMatch}`)
  console.log(`Processed: ${airIntra.rows.length} / ${airIntraFull.rows.length}`)

  const remaining = await db.execute(
    `SELECT COUNT(*) as count FROM products 
     WHERE providerId = 'air-intra-1780331633566' 
     AND (images = '[]' OR images IS NULL) AND isActive = 1`
  )
  console.log(`Air Intra still without images: ${remaining.rows[0].count}`)
  
  // Stats by match quality
  console.log('\n--- Donor stats ---')
  const withImages = await db.execute(
    `SELECT COUNT(*) as count FROM products 
     WHERE providerId = 'air-intra-1780331633566' 
     AND images != '[]' AND images IS NOT NULL AND isActive = 1`
  )
  console.log(`Air Intra with images now: ${withImages.rows[0].count}`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
