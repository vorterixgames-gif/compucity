#!/usr/bin/env node
/**
 * Optimized cross-provider image copy with inverted index matching
 */

import { createClient } from '@libsql/client'
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env')
const envContent = readFileSync(envPath, 'utf-8')
const envVars = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) envVars[match[1].trim()] = match[2].trim()
}

const db = createClient({ url: envVars.DATABASE_URL, authToken: envVars.TURSO_AUTH_TOKEN })

function extractBrandAndModel(name) {
  const upper = name.toUpperCase()
  const brands = ['LOGITECH', 'CORSAIR', 'RAZER', 'HYPERX', 'KINGSTON', 'COOLER MASTER', 'ASUS ROG', 'ASUS TUF', 'ASUS', 'MSI', 'GIGABYTE', 'LENOVO', 'HP', 'DELL', 'TP-LINK', 'GENIUS', 'SAMSUNG', 'LG', 'SEAGATE', 'ADATA', 'CRUCIAL', 'BE QUIET', 'THERMALTAKE', 'NZXT', 'STEELSERIES', 'REDRAGON', 'MARVO', 'NOCTUA', 'ARCTIC', 'DEEPCOOL', 'GAMEMAX', 'X-TECH', 'KLIPXTREME', 'VERBATIM', 'SANDISK', 'WESTERN', 'INTEL', 'AMD', 'NVIDIA']
  
  let brand = ''
  for (const b of brands) {
    if (upper.includes(b)) { brand = b; break }
  }
  
  // Extract model tokens
  const modelTokens = new Set()
  // Common model patterns
  const patterns = [
    /\b(RTX\s?\d{4})\b/gi,
    /\b(GTX\s?\d{4})\b/gi,
    /\b(R[3579]\s?\d{3,4}[XG]?)\b/gi,  // Ryzen
    /\b(I[3579][- ]?\d{4,5}[KF]?)\b/gi,  // Intel Core
    /\b(B\d{3}|H\d{3}|Z\d{3}|X\d{3})\b/gi,  // Motherboard chipsets
    /\b(DDR[45])\b/gi,
    /\b(\d+GB)\b/gi,
    /\b(\d+TB)\b/gi,
    /\b(\d+MBPS)\b/gi,
    /\b(GX-\d+|HS-\d+|G-\d+)\b/gi,  // Genius models
    /\b(NX-\d+)\b/gi,  // Genius mouse models
    /\b(WN\d{4})\b/gi,  // TP-Link models
    /\b(Archer\s\w+)\b/gi,
    /\b(Smart\s?Tank\s?\d+)\b/gi,
    /\b(G\d{2,3}|G923|G29|F710)\b/gi,  // Logitech gaming
    /\b(K\d{3,4})\b/gi,  // Logitech keyboards
    /\b(M\d{2,3})\b/gi,  // Logitech mice
  ]
  
  for (const pattern of patterns) {
    const matches = upper.match(pattern)
    if (matches) matches.forEach(m => modelTokens.add(m.toUpperCase().replace(/\s+/g, '')))
  }
  
  return { brand, modelTokens: [...modelTokens] }
}

async function ensureImageTable() {
  await db.execute(`CREATE TABLE IF NOT EXISTS product_images (id TEXT PRIMARY KEY, data TEXT NOT NULL, size INTEGER NOT NULL, width INTEGER, height INTEGER, createdAt TEXT NOT NULL DEFAULT (datetime('now')))`)
}

async function downloadAndConvert(imageUrl) {
  try {
    const buffer = execSync(`curl -s -m 15 -L -A "Mozilla/5.0" "${imageUrl}"`, { maxBuffer: 10 * 1024 * 1024 })
    if (!buffer || buffer.length < 100 || buffer.length > 5 * 1024 * 1024) return null
    const webpBuffer = await sharp(buffer).resize(800, 800, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 75, effort: 6 }).toBuffer()
    const metadata = await sharp(webpBuffer).metadata()
    return { data: webpBuffer.toString('base64'), size: webpBuffer.length, width: metadata.width || 0, height: metadata.height || 0 }
  } catch { return null }
}

async function main() {
  console.log('=== Optimized Cross-Provider Image Copy ===\n')
  await ensureImageTable()

  // Step 1: Get Air Intra products without images
  console.log('Loading Air Intra products...')
  const airIntra = await db.execute(`SELECT id, name FROM products WHERE providerId = 'air-intra-1780331633566' AND (images = '[]' OR images IS NULL) AND isActive = 1 AND stock > 0 AND categoryId IS NOT NULL`)
  console.log(`  ${airIntra.rows.length} products need images`)

  // Step 2: Build inverted index from Elit/Invid
  console.log('Building inverted index from Elit/Invid...')
  const elitInvid = await db.execute(`SELECT p.name, p.images, s.name as supplier FROM products p JOIN suppliers s ON p.providerId = s.id WHERE s.name IN ('Elit', 'Invid Computers') AND p.images != '[]' AND p.images IS NOT NULL AND p.isActive = 1`)
  console.log(`  ${elitInvid.rows.length} products with images`)

  // Inverted index: modelToken -> [{ imageUrl, brand, name }]
  const invertedIndex = new Map()
  
  for (const row of elitInvid.rows) {
    const images = JSON.parse(row.images || '[]')
    if (images.length === 0) continue
    const { brand, modelTokens } = extractBrandAndModel(row.name)
    
    for (const token of modelTokens) {
      if (!invertedIndex.has(token)) invertedIndex.set(token, [])
      invertedIndex.get(token).push({ url: images[0], brand, name: row.name, supplier: row.supplier })
    }
  }

  console.log(`  Inverted index: ${invertedIndex.size} unique tokens`)

  // Step 3: Match and process
  let enriched = 0, failed = 0, noMatch = 0

  for (const ai of airIntra.rows) {
    const { brand: aiBrand, modelTokens: aiTokens } = extractBrandAndModel(ai.name)
    
    if (aiTokens.length === 0) { noMatch++; continue }

    // Find best match using inverted index
    let bestMatch = null
    let bestScore = 0

    for (const token of aiTokens) {
      const candidates = invertedIndex.get(token)
      if (!candidates) continue

      for (const candidate of candidates) {
        // Score: brand match + shared model tokens
        let score = 1 // at least this model token matched
        if (aiBrand && candidate.brand === aiBrand) score += 3

        // Check other model tokens
        for (const otherToken of aiTokens) {
          if (otherToken === token) continue
          const otherCandidates = invertedIndex.get(otherToken)
          if (otherCandidates?.some(c => c.url === candidate.url && c.brand === candidate.brand)) {
            score += 2
          }
        }

        if (score > bestScore) {
          bestScore = score
          bestMatch = candidate
        }
      }
    }

    if (!bestMatch || bestScore < 2) { noMatch++; continue }

    // Download and convert
    const imageData = await downloadAndConvert(bestMatch.url)

    if (!imageData) {
      failed++
      console.log(`✗ ${ai.name}`)
      continue
    }

    // Store in product_images
    const imageId = crypto.randomUUID()
    await db.execute({
      sql: `INSERT INTO product_images (id, data, size, width, height, createdAt) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      args: [imageId, imageData.data, imageData.size, imageData.width, imageData.height],
    })

    await db.execute({
      sql: `UPDATE products SET images = ?, updatedAt = datetime('now') WHERE id = ?`,
      args: [JSON.stringify([`/api/image/${imageId}`]), ai.id],
    })

    enriched++
    const sizeKB = (imageData.size / 1024).toFixed(1)
    if (enriched % 20 === 0 || enriched <= 5) {
      console.log(`✓ [${enriched}] ${ai.name} -> ${bestMatch.supplier} (score:${bestScore}) ${imageData.width}x${imageData.height} ${sizeKB}KB`)
    }

    await new Promise(r => setTimeout(r, 100))
  }

  console.log('\n========================================')
  console.log(`Enriched: ${enriched}`)
  console.log(`Failed: ${failed}`)
  console.log(`No match: ${noMatch}`)

  const remaining = await db.execute(`SELECT COUNT(*) as count FROM products WHERE providerId = 'air-intra-1780331633566' AND (images = '[]' OR images IS NULL) AND isActive = 1`)
  console.log(`Air Intra still without images: ${remaining.rows[0].count}`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
