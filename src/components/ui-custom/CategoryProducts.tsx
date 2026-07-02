'use client'

import { useState, useMemo, useEffect } from 'react'
import { formatARS } from '@/lib/format'
import { SlidersHorizontal, X, ChevronDown, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import ProductCard from './ProductCard'

interface Subcategory {
  id: string
  name: string
  slug: string
}

interface ProductItem {
  id: string
  name: string
  slug: string
  price: number
  comparePrice: number | null
  images: string
  stock: number
  createdAt?: string
  salePrice?: number | null
  saleStart?: string | null
  saleEnd?: string | null
  brandId?: string | null
  brandName?: string | null
  isFeatured?: number
  tags?: string[]
}

// ============================================
// Category Filter Definitions
// ============================================

interface CategoryFilterOption {
  key: string
  label: string
  value: string
  matchFn: (name: string, product?: ProductItem) => boolean
}

// ============================================
// Helper: Extract RAM from notebook product names
// Avoids matching VRAM (e.g., "RTX 3050 8GB") and SSD capacity.
// Handles split RAM notation: (8G+8G) → 16GB, (8GB+4GB) → 12GB
// ============================================
function extractNotebookRAM(name: string): number | null {
  const upper = name.toUpperCase()

  // 1) Check split RAM notation: (8G+8G), (8GB+4GB), (4G+4G), etc.
  const splitMatch = upper.match(/\((\d+)\s*GB?\s*\+\s*(\d+)\s*GB?\)/)
  if (splitMatch) {
    const total = parseInt(splitMatch[1]) + parseInt(splitMatch[2])
    if (total >= 4 && total <= 128) return total
  }
  // Also: 12GB(8GB+4GB) — total is the first number
  const splitTotal = upper.match(/(\d+)\s*GB\s*\(\s*\d+\s*GB\s*\+\s*\d+\s*GB\s*\)/)
  if (splitTotal) {
    const total = parseInt(splitTotal[1])
    if (total >= 4 && total <= 128) return total
  }

  // 2) Look for explicit RAM context: "8GB DDR4", "8GB DDR5", "8GB RAM", "8GBDDR4"
  const explicitMatch = upper.match(/(\d+)\s*GB\s*(?:DDR[345]|RAM)/)
  if (explicitMatch) {
    const gb = parseInt(explicitMatch[1])
    if (gb >= 4 && gb <= 128) return gb
  }

  // 3) Look for DDR right before: "DDR4 8GB", "DDR5 16GB"
  const ddrBefore = upper.match(/DDR[345]\s+(\d+)\s*GB/)
  if (ddrBefore) {
    const gb = parseInt(ddrBefore[1])
    if (gb >= 4 && gb <= 128) return gb
  }

  // 4) Pattern: RAM+SSD (very common in PC Armadas): "16g+ssd480", "8G+SSD240", "32g+ssd1t"
  const ramSsdMatch = upper.match(/(\d+)\s*G[BB]?\s*\+\s*SSD/i)
  if (ramSsdMatch) {
    const gb = parseInt(ramSsdMatch[1])
    if (gb >= 4 && gb <= 128) return gb
  }

  // 5) Find all "NGB" or "NG" occurrences, exclude those in GPU/VRAM/storage context
  // Extended GPU pattern: includes RTX A-series (A400, A1000, A2000...), VGA prefix, V-prefix
  const gpuVramPattern = /\b(RTX|GTX)\s*[A-Z]?\d{3,4}\s*(TI|SUPER)?|\bRADEON\s*RX\s*\d{4}|\bARC\s*A?\d{3}|\bVGA\s*\d+|\bV\d+\s*GB?/i
  const allGbMatches = [...upper.matchAll(/(\d+)\s*GB?\b/g)]

  for (const m of allGbMatches) {
    const gb = parseInt(m[1])
    if (gb < 4 || gb > 128) continue // Skip SSD sizes like 240GB, 480GB, 512GB

    const matchStart = m.index!
    // Check 30 chars before + the match itself for GPU/VRAM context
    const beforeText = upper.substring(Math.max(0, matchStart - 30), matchStart + m[0].length)
    if (gpuVramPattern.test(beforeText)) continue // This is VRAM, skip it

    // Also skip if preceded by SSD (e.g. "SSD240G", "SSD480GB")
    const prefixText = upper.substring(Math.max(0, matchStart - 10), matchStart)
    if (/SSD\s*$/i.test(prefixText)) continue

    return gb
  }

  // 6) After CPU model, standalone small number (Dell style: "I7-14700 16 512gb")
  // Only if the number is 4-64 and NOT followed by GB/TB
  const afterCpuMatch = upper.match(/(?:I[3-9]|CORE\s*\d|RYZEN\s*\d|U\d+|C\d+|R[3579])\s*-?\s*\d{3,5}[A-Z]*\s+(\d{1,2})\s+(?:\d{3,}|\d+[TGM])/i)
  if (afterCpuMatch) {
    const gb = parseInt(afterCpuMatch[1])
    if (gb >= 4 && gb <= 64) return gb
  }

  return null
}

// ============================================
// Helper: Detect GPU type in notebook names
// ============================================
type GPUType = 'dedicated' | 'integrated'

function detectNotebookGPUType(name: string): GPUType {
  const upper = name.toUpperCase()

  // Dedicated GPU: NVIDIA RTX/GTX (including A-series like RTX A400, A2000)
  if (/\bRTX\s*[A-Z]?\d{3,4}/.test(upper) || /\bGTX\s*\d{3,4}/.test(upper)) return 'dedicated'
  // Dedicated GPU: AMD Radeon RX
  if (/\bRADEON\s*RX\s*\d{4}/.test(upper)) return 'dedicated'
  // Dedicated GPU: Intel Arc
  if (/\bARC\s*A?\d{3}/.test(upper)) return 'dedicated'
  // Dedicated GPU: VGA prefix (VGA512MB, VGA1G, VGA16G) or V-prefix (V1GB, V1G)
  if (/\bVGA\s*\d+/i.test(upper)) return 'dedicated'
  if (/\bV\d+\s*GB?\b/i.test(upper)) return 'dedicated'
  // Dedicated GPU: GT models (GT 710, GT 1030, GT 210)
  if (/\bGT\s*\d{3,4}/.test(upper)) return 'dedicated'

  // Everything else is integrated
  return 'integrated'
}

// ============================================
// Helper: Detect if a PC Armadas product is "Gamer"
// Includes: RTX/GTX, VGA/V-prefix, GT models, gaming brands (Arkham, Gamemax, XPG),
// and any PC with a dedicated GPU (RTX A-series, Radeon RX, Arc)
// ============================================
function isPcArmadasGamer(name: string): boolean {
  const upper = name.toUpperCase()
  // Explicit gamer keywords
  if (/\bGAMER\b|\bGAMING\b/i.test(upper)) return true
  // NVIDIA RTX (including A-series like RTX A400, A2000)
  if (/\bRTX\s*[A-Z]?\d{3,4}/.test(upper)) return true
  // NVIDIA GTX
  if (/\bGTX\s*\d{3,4}/.test(upper)) return true
  // VGA prefix or V-prefix (VGA512MB, VGA1G, V1GB, V1G, VGA16G)
  if (/\bVGA\s*\d+/.test(upper)) return true
  if (/\bV\d+\s*GB?\b/.test(upper)) return true
  // GT models (GT 710, GT 1030, GT 210)
  if (/\bGT\s*\d{3,4}/.test(upper)) return true
  // Gaming brands
  if (/\bARKHAM\b/.test(upper)) return true
  if (/\bGAMEMAX\b/.test(upper)) return true
  if (/\bXPG\b/.test(upper)) return true
  // AMD Radeon RX (dedicated)
  if (/\bRADEON\s*RX\s*\d{4}/.test(upper)) return true
  // Intel Arc
  if (/\bARC\s*A?\d{3}/.test(upper)) return true
  return false
}

const CATEGORY_FILTERS: Record<string, CategoryFilterOption[]> = {
  'microprocesadores': [
    { key: 'brand', label: 'AMD', value: 'AMD', matchFn: (n) => /\bAMD\b|\bRYZEN\b|\bATHLON\b/i.test(n) },
    { key: 'brand', label: 'Intel', value: 'Intel', matchFn: (n) => /\bINTEL\b|\bCORE\s*I[3579]\b|\bPENTIUM\b|\bCELERON\b|\bCORE ULTRA\b/i.test(n) },
  ],
  'motherboards': [
    { key: 'brand', label: 'Asus', value: 'ASUS', matchFn: (n) => /\bASUS\b|\bROG\b|\bPRIME\b|\bTUF\b/i.test(n) },
    { key: 'brand', label: 'Gigabyte', value: 'GIGABYTE', matchFn: (n) => /\bGIGABYTE\b|\bAORUS\b/i.test(n) },
    { key: 'brand', label: 'MSI', value: 'MSI', matchFn: (n) => /\bMSI\b/i.test(n) },
    { key: 'brand', label: 'ASRock', value: 'ASROCK', matchFn: (n) => /\bASROCK\b|\bAS ROCK\b/i.test(n) },
    { key: 'brand', label: 'Biostar', value: 'BIOSTAR', matchFn: (n) => /\bBIOSTAR\b/i.test(n) },
    { key: 'socket', label: 'AM4', value: 'AM4', matchFn: (n) => /\bAM4\b|\bB550\b|\bA520\b|\bX570\b|\bB450\b|\bA320\b/i.test(n) },
    { key: 'socket', label: 'AM5', value: 'AM5', matchFn: (n) => /\bAM5\b|\bB650\b|\bB850\b|\bB840\b|\bA620\b|\bX870\b|\bX670E?\b/i.test(n) },
    { key: 'socket', label: 'LGA 1700', value: '1700', matchFn: (n) => /\b1700\b|\bB760\b|\bH610\b|\bB660\b|\bH670\b|\bZ690\b|\bZ790\b/i.test(n) },
    { key: 'socket', label: 'LGA 1851', value: '1851', matchFn: (n) => /\b1851\b|\bB860\b|\bZ890\b|\bH810\b/i.test(n) },
    { key: 'ddr', label: 'DDR4', value: 'DDR4', matchFn: (n) => /\bDDR4\b/i.test(n) },
    { key: 'ddr', label: 'DDR5', value: 'DDR5', matchFn: (n) => /\bDDR5\b/i.test(n) },
  ],
  'memorias-ram': [
    { key: 'brand', label: 'Kingston', value: 'kingston', matchFn: (n) => /\bKINGSTON\b|\bFURY\b/i.test(n) },
    { key: 'brand', label: 'Hiksemi', value: 'hiksemi', matchFn: (n) => /\bHIKSEMI\b/i.test(n) },
    { key: 'brand', label: 'ADATA / XPG', value: 'adata', matchFn: (n) => /\bADATA\b|\bXPG\b/i.test(n) },
    { key: 'brand', label: 'Corsair', value: 'corsair', matchFn: (n) => /\bCORSAIR\b|\bVENGEANCE\b/i.test(n) },
    { key: 'brand', label: 'Memox', value: 'memox', matchFn: (n) => /\bMEMOX\b/i.test(n) },
    { key: 'brand', label: 'Crucial', value: 'crucial', matchFn: (n) => /\bCRUCIAL\b/i.test(n) },
    { key: 'brand', label: 'Lexar', value: 'lexar', matchFn: (n) => /\bLEXAR\b/i.test(n) },
    { key: 'brand', label: 'G.Skill', value: 'gskill', matchFn: (n) => /\bG\.?SKILL\b|\bTRIDENT\b|\bRIPJAWS\b/i.test(n) },
    { key: 'brand', label: 'Patriot', value: 'patriot', matchFn: (n) => /\bPATRIOT\b/i.test(n) },
    { key: 'ddr', label: 'DDR3', value: 'ddr3', matchFn: (n) => /\bDDR3\b/i.test(n) },
    { key: 'ddr', label: 'DDR4', value: 'ddr4', matchFn: (n) => /\bDDR4\b/i.test(n) },
    { key: 'ddr', label: 'DDR5', value: 'ddr5', matchFn: (n) => /\bDDR5\b/i.test(n) },
    { key: 'capacity', label: '4GB', value: '4gb', matchFn: (n) => /\b4\s*G[Bb]?\b/i.test(n) },
    { key: 'capacity', label: '8GB', value: '8gb', matchFn: (n) => /\b8\s*G[Bb]?\b/i.test(n) },
    { key: 'capacity', label: '16GB', value: '16gb', matchFn: (n) => /\b16\s*G[Bb]?\b/i.test(n) },
    { key: 'capacity', label: '32GB', value: '32gb', matchFn: (n) => /\b32\s*G[Bb]?\b/i.test(n) },
    { key: 'capacity', label: '48GB+', value: '48gbplus', matchFn: (n) => { const m = n.match(/\b(\d+)\s*G[Bb]?\b/i); return m ? parseInt(m[1]) >= 48 : false } },
  ],
  'memoria-ram-pc': [
    { key: 'brand', label: 'Kingston', value: 'kingston', matchFn: (n) => /\bKINGSTON\b|\bFURY\b/i.test(n) },
    { key: 'brand', label: 'Hiksemi', value: 'hiksemi', matchFn: (n) => /\bHIKSEMI\b/i.test(n) },
    { key: 'brand', label: 'ADATA / XPG', value: 'adata', matchFn: (n) => /\bADATA\b|\bXPG\b/i.test(n) },
    { key: 'brand', label: 'Corsair', value: 'corsair', matchFn: (n) => /\bCORSAIR\b|\bVENGEANCE\b/i.test(n) },
    { key: 'brand', label: 'Memox', value: 'memox', matchFn: (n) => /\bMEMOX\b/i.test(n) },
    { key: 'brand', label: 'Crucial', value: 'crucial', matchFn: (n) => /\bCRUCIAL\b/i.test(n) },
    { key: 'brand', label: 'Lexar', value: 'lexar', matchFn: (n) => /\bLEXAR\b/i.test(n) },
    { key: 'brand', label: 'G.Skill', value: 'gskill', matchFn: (n) => /\bG\.?SKILL\b|\bTRIDENT\b|\bRIPJAWS\b/i.test(n) },
    { key: 'brand', label: 'Patriot', value: 'patriot', matchFn: (n) => /\bPATRIOT\b/i.test(n) },
    { key: 'ddr', label: 'DDR3', value: 'ddr3', matchFn: (n) => /\bDDR3\b/i.test(n) },
    { key: 'ddr', label: 'DDR4', value: 'ddr4', matchFn: (n) => /\bDDR4\b/i.test(n) },
    { key: 'ddr', label: 'DDR5', value: 'ddr5', matchFn: (n) => /\bDDR5\b/i.test(n) },
    { key: 'capacity', label: '4GB', value: '4gb', matchFn: (n) => /\b4\s*G[Bb]?\b/i.test(n) },
    { key: 'capacity', label: '8GB', value: '8gb', matchFn: (n) => /\b8\s*G[Bb]?\b/i.test(n) },
    { key: 'capacity', label: '16GB', value: '16gb', matchFn: (n) => /\b16\s*G[Bb]?\b/i.test(n) },
    { key: 'capacity', label: '32GB', value: '32gb', matchFn: (n) => /\b32\s*G[Bb]?\b/i.test(n) },
    { key: 'capacity', label: '48GB+', value: '48gbplus', matchFn: (n) => { const m = n.match(/\b(\d+)\s*G[Bb]?\b/i); return m ? parseInt(m[1]) >= 48 : false } },
  ],
  'placas-de-video': [
    { key: 'brand', label: 'Gigabyte', value: 'GIGABYTE', matchFn: (n) => /\bGIGABYTE\b|\bAORUS\b/i.test(n) && /\b(RTX|GTX|RADEON|GEFORCE)/i.test(n) },
    { key: 'brand', label: 'MSI', value: 'MSI', matchFn: (n) => /\bMSI\b/i.test(n) && /\b(RTX|GTX|RADEON|GEFORCE)/i.test(n) },
    { key: 'brand', label: 'Asus', value: 'ASUS', matchFn: (n) => /\bASUS\b|\bROG\b|\bTUF\b/i.test(n) && /\b(RTX|GTX|RADEON|GEFORCE)/i.test(n) },
    { key: 'brand', label: 'NVIDIA', value: 'NVIDIA', matchFn: (n) => /\b(RTX|GTX|GEFORCE|NVIDIA|QUADRO)|\bGT 1030\b/i.test(n) },
    { key: 'brand', label: 'AMD', value: 'AMD', matchFn: (n) => /\bRADEON\b|\bRX\s\d/i.test(n) },
    { key: 'brand', label: 'PNY', value: 'PNY', matchFn: (n) => /\bPNY\b/i.test(n) },
    { key: 'brand', label: 'PowerColor', value: 'POWERCOLOR', matchFn: (n) => /\bPOWERCOLOR\b|\bPOWER\s*COLOR\b/i.test(n) },
    { key: 'brand', label: 'Sapphire', value: 'SAPPHIRE', matchFn: (n) => /\bSAPPHIRE\b/i.test(n) },
    { key: 'brand', label: 'INNO3D', value: 'INNO3D', matchFn: (n) => /\bINNO3D\b|\bINNO\s*3D\b/i.test(n) },
    { key: 'brand', label: 'Intel Arc', value: 'INTEL_ARC', matchFn: (n) => /\bARC\s*A[37]\b/i.test(n) },
    { key: 'vram', label: '4GB', value: '4gb', matchFn: (n) => /\b4\s*G[Bb]?\b/i.test(n) && /\b(RTX|GTX|RADEON|GEFORCE|GT|QUADRO|ARC)/i.test(n) },
    { key: 'vram', label: '6GB', value: '6gb', matchFn: (n) => /\b6\s*G[Bb]?\b/i.test(n) && /\b(RTX|GTX|RADEON|GEFORCE|ARC)/i.test(n) },
    { key: 'vram', label: '8GB', value: '8gb', matchFn: (n) => /\b8\s*G[Bb]?\b/i.test(n) && /\b(RTX|GTX|RADEON|GEFORCE|QUADRO|ARC)/i.test(n) },
    { key: 'vram', label: '12GB', value: '12gb', matchFn: (n) => /\b12\s*G[Bb]?\b/i.test(n) && /\b(RTX|GTX|RADEON|GEFORCE|QUADRO)/i.test(n) },
    { key: 'vram', label: '16GB', value: '16gb', matchFn: (n) => /\b16\s*G[Bb]?\b/i.test(n) && /\b(RTX|GTX|RADEON|GEFORCE|QUADRO)/i.test(n) },
    { key: 'vram', label: '24GB', value: '24gb', matchFn: (n) => /\b24\s*G[Bb]?\b/i.test(n) && /\b(RTX|GTX|RADEON|GEFORCE|QUADRO)/i.test(n) },
    { key: 'vram', label: '32GB', value: '32gb', matchFn: (n) => /\b32\s*G[Bb]?\b/i.test(n) && /\b(RTX|GTX|RADEON|GEFORCE|QUADRO)/i.test(n) },
    { key: 'series', label: 'RTX 5090', value: 'rtx5090', matchFn: (n) => /RTX\s*5090/i.test(n) },
    { key: 'series', label: 'RTX 5080', value: 'rtx5080', matchFn: (n) => /RTX\s*5080/i.test(n) },
    { key: 'series', label: 'RTX 5070', value: 'rtx5070', matchFn: (n) => /RTX\s*5070/i.test(n) },
    { key: 'series', label: 'RTX 5060', value: 'rtx5060', matchFn: (n) => /RTX\s*5060/i.test(n) },
    { key: 'series', label: 'RTX 5050', value: 'rtx5050', matchFn: (n) => /RTX\s*5050/i.test(n) },
    { key: 'series', label: 'RTX 3050', value: 'rtx3050', matchFn: (n) => /RTX\s*3050/i.test(n) },
    { key: 'series', label: 'RX 9070 XT', value: 'rx9070xt', matchFn: (n) => /RX\s*9070/i.test(n) },
    { key: 'series', label: 'RX 9060 XT', value: 'rx9060xt', matchFn: (n) => /RX\s*9060/i.test(n) },
    { key: 'series', label: 'RX 7600', value: 'rx7600', matchFn: (n) => /RX\s*7600/i.test(n) },
    { key: 'series', label: 'Quadro / Pro', value: 'quadro', matchFn: (n) => /\bQUADRO\b|\bRTX\s*A\d|\bRTX\s*PRO\b/i.test(n) },
    { key: 'series', label: 'GT (Básicas)', value: 'gt_basic', matchFn: (n) => /\bGT\s*(210|1030)\b/i.test(n) },
  ],
  'discos-ssd': [
    { key: 'brand', label: 'Kingston', value: 'KINGSTON', matchFn: (n) => /\bKINGSTON\b|\bFURY\b|\bA400\b|\bKC3000\b|\bKC600\b|\bDC600\b|\bNV3\b/i.test(n) },
    { key: 'brand', label: 'WD', value: 'WD', matchFn: (n) => /\bWESTERN\b|\bWD[A-Z]|\bWD\b/i.test(n) && /\bSSD\b|\bNVME\b|\bM\.2\b|\bGREEN\b|\bBLUE\b|\bBLACK\b|\bRED\b/i.test(n) },
    { key: 'brand', label: 'Hiksemi', value: 'HIKSEMI', matchFn: (n) => /\bHIKSEMI\b/i.test(n) },
    { key: 'brand', label: 'ADATA / XPG', value: 'ADATA', matchFn: (n) => /\bADATA\b|\bXPG\b|\bGAMMIX\b|\bLEGEND\b|\bSPECTRIX\b|\bSU650\b|\bSU630\b/i.test(n) },
    { key: 'brand', label: 'Lexar', value: 'LEXAR', matchFn: (n) => /\bLEXAR\b|\bNM610\b|\bNM790\b|\bNQ100\b|\bNQ780\b/i.test(n) },
    { key: 'brand', label: 'Crucial', value: 'CRUCIAL', matchFn: (n) => /\bCRUCIAL\b|\bBX500\b|\bP310\b|\bE100\b/i.test(n) },
    { key: 'brand', label: 'Memox', value: 'MEMOX', matchFn: (n) => /\bMEMOX\b/i.test(n) },
    { key: 'brand', label: 'Samsung', value: 'SAMSUNG', matchFn: (n) => /\bSAMSUNG\b|\bEVO\b|\b9[79]0\b/i.test(n) && !/\bMONITOR\b/i.test(n) },
    { key: 'brand', label: 'MSI', value: 'MSI_SSD', matchFn: (n) => /\bMSI\b|\bSPATIUM\b/i.test(n) && /\bSSD\b|\bNVME\b|\bM\.2\b|\bS270\b/i.test(n) },
    { key: 'brand', label: 'Patriot', value: 'PATRIOT', matchFn: (n) => /\bPATRIOT\b|\bP300\b|\bP210\b|\bRENEGADE\b/i.test(n) },
    { key: 'brand', label: 'Seagate', value: 'SEAGATE', matchFn: (n) => /\bSEAGATE\b|\bFIRECUDA\b/i.test(n) && /\bSSD\b|\bNVME\b/i.test(n) },
    { key: 'brand', label: 'Corsair', value: 'CORSAIR', matchFn: (n) => /\bCORSAIR\b/i.test(n) && /\bSSD\b|\bNVME\b|\bM\.2\b/i.test(n) },
    { key: 'brand', label: 'Kioxia', value: 'KIOXIA', matchFn: (n) => /\bKIOXIA\b/i.test(n) },
    { key: 'brand', label: 'Silicon Power', value: 'SILICON_POWER', matchFn: (n) => /\bSILICON\s*POWER\b/i.test(n) },
    { key: 'brand', label: 'Leven', value: 'LEVEN', matchFn: (n) => /\bLEVEN\b/i.test(n) },
    { key: 'brand', label: 'PNY', value: 'PNY', matchFn: (n) => /\bPNY\b/i.test(n) },
    { key: 'brand', label: 'SOLIDIGM', value: 'SOLIDIGM', matchFn: (n) => /\bSOLIDIGM\b/i.test(n) },
    { key: 'brand', label: 'SanDisk', value: 'SANDISK', matchFn: (n) => /\bSANDISK\b/i.test(n) },
    { key: 'brand', label: 'Team Group', value: 'TEAM_GROUP', matchFn: (n) => /\bTEAM\s*GROUP\b/i.test(n) },
    { key: 'brand', label: 'Biwin', value: 'BIWIN', matchFn: (n) => /\bBIWIN\b/i.test(n) },
    { key: 'type', label: 'M.2 / NVMe', value: 'NVME', matchFn: (n) => /\bNVME\b|\bM\.2\b|\bM2\b/i.test(n) },
    { key: 'type', label: 'SATA', value: 'SATA', matchFn: (n) => /\bSATA\b/i.test(n) && !/\bNVME\b|\bM\.2\b/i.test(n) },
    { key: 'capacity', label: 'Hasta 256GB', value: 'upto256', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c <= 256 } },
    { key: 'capacity', label: '480GB - 512GB', value: '480-512', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 480 && c <= 600 } },
    { key: 'capacity', label: '960GB - 1TB', value: '960-1tb', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 960 && c <= 1100 } },
    { key: 'capacity', label: '2TB', value: '2tb', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 1900 && c <= 2100 } },
    { key: 'capacity', label: '4TB+', value: '4tbplus', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 3800 } },
  ],
  'discos-hdd': [
    { key: 'brand', label: 'Seagate', value: 'SEAGATE', matchFn: (n) => /\bSEAGATE\b|\bBARRACUDA\b|\bIRONWOLF\b|\bSKYHAWK\b/i.test(n) },
    { key: 'brand', label: 'WD', value: 'WD', matchFn: (n) => /\bWESTERN\b|\bWD\b[ _]?|\bBLUE\b|\bBLACK\b|\bGOLD\b|\bRED\b|\bRED PLUS\b|\bPURPLE\b/i.test(n) && /\bHDD\b|\bDISCO\b|\bRIGIDO\b|\bINTERNAL\b/i.test(n) },
    { key: 'brand', label: 'Toshiba', value: 'TOSHIBA', matchFn: (n) => /\bTOSHIBA\b/i.test(n) },
    { key: 'brand', label: 'Dell', value: 'DELL_HDD', matchFn: (n) => /\bDELL\b/i.test(n) },
    { key: 'brand', label: 'HPE', value: 'HPE_HDD', matchFn: (n) => /\bHPE\b/i.test(n) },
    { key: 'capacity', label: '1TB', value: '1tb', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 900 && c <= 1100 } },
    { key: 'capacity', label: '2TB', value: '2tb', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 1900 && c <= 2100 } },
    { key: 'capacity', label: '4TB', value: '4tb', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 3800 && c <= 4200 } },
    { key: 'capacity', label: '6TB - 8TB', value: '6-8tb', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 5800 && c <= 8200 } },
    { key: 'capacity', label: '10TB - 12TB', value: '10-12tb', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 9800 && c <= 12500 } },
    { key: 'capacity', label: '16TB+', value: '16tbplus', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 15800 } },
  ],
  'fuentes': [
    { key: 'brand', label: 'Gigabyte', value: 'GIGABYTE', matchFn: (n) => /\bGIGABYTE\b|\bAORUS\b/i.test(n) && /\bFUENTE\b|\bPSU\b|\bPOWER\b|\bW\b/i.test(n) },
    { key: 'brand', label: 'Gamemax', value: 'GAMEMAX', matchFn: (n) => /\bGAMEMAX\b/i.test(n) },
    { key: 'brand', label: 'Asus', value: 'ASUS', matchFn: (n) => /\bASUS\b|\bROG\b/i.test(n) },
    { key: 'brand', label: 'Thermaltake', value: 'THERMALTAKE', matchFn: (n) => /\bTHERMALTAKE\b/i.test(n) },
    { key: 'brand', label: 'Cooler Master', value: 'COOLERMASTER', matchFn: (n) => /\bCOOLER\s*MASTER\b/i.test(n) },
    { key: 'brand', label: 'Corsair', value: 'CORSAIR', matchFn: (n) => /\bCORSAIR\b/i.test(n) },
    { key: 'brand', label: 'MSI', value: 'MSI', matchFn: (n) => /\bMSI\b/i.test(n) && /\bFUENTE\b|\bPSU\b|\bPOWER\b/i.test(n) },
    { key: 'brand', label: 'XPG', value: 'XPG', matchFn: (n) => /\bXPG\b|\bCORE\s*REACTOR\b/i.test(n) },
    { key: 'brand', label: 'Seasonic', value: 'SEASONIC', matchFn: (n) => /\bSEASONIC\b|\bFOCUS\b/i.test(n) },
    { key: 'brand', label: 'EVGA', value: 'EVGA', matchFn: (n) => /\bEVGA\b/i.test(n) },
    { key: 'brand', label: 'Kelyx', value: 'KELYX', matchFn: (n) => /\bKELYX\b/i.test(n) },
    { key: 'brand', label: 'Aerocool', value: 'AEROCOOL', matchFn: (n) => /\bAEROCOOL\b/i.test(n) },
    { key: 'brand', label: 'Raptor', value: 'RAPTOR_PSU', matchFn: (n) => /\bRAPTOR\b/i.test(n) },
    { key: 'brand', label: 'Teros', value: 'TEROS_PSU', matchFn: (n) => /\bTEROS\b|\bTE-/i.test(n) },
    { key: 'brand', label: 'E-View', value: 'EVIEW_PSU', matchFn: (n) => /\bE[\s\-]?VIEW\b/i.test(n) },
    { key: 'brand', label: 'Cromax', value: 'CROMAX', matchFn: (n) => /\bCROMAX\b/i.test(n) },
    { key: 'brand', label: 'CX', value: 'CX_PSU', matchFn: (n) => /\bCX\b/i.test(n) },
    { key: 'wattage', label: 'Hasta 500W', value: 'upto500', matchFn: (n) => { const m = n.match(/(\d{3,4})\s*W/i); return m ? parseInt(m[1]) <= 500 : false } },
    { key: 'wattage', label: '550W - 650W', value: '550-650', matchFn: (n) => { const m = n.match(/(\d{3,4})\s*W/i); return m ? (parseInt(m[1]) >= 550 && parseInt(m[1]) <= 650) : false } },
    { key: 'wattage', label: '700W - 750W', value: '700-750', matchFn: (n) => { const m = n.match(/(\d{3,4})\s*W/i); return m ? (parseInt(m[1]) >= 700 && parseInt(m[1]) <= 750) : false } },
    { key: 'wattage', label: '800W - 850W', value: '800-850', matchFn: (n) => { const m = n.match(/(\d{3,4})\s*W/i); return m ? (parseInt(m[1]) >= 800 && parseInt(m[1]) <= 850) : false } },
    { key: 'wattage', label: '1000W+', value: '1000plus', matchFn: (n) => { const m = n.match(/(\d{3,4})\s*W/i); return m ? parseInt(m[1]) >= 1000 : false } },
  ],
  'gabinetes': [
    { key: 'brand', label: 'Corsair', value: 'CORSAIR', matchFn: (n) => /\bCORSAIR\b/i.test(n) },
    { key: 'brand', label: 'Cooler Master', value: 'COOLERMASTER', matchFn: (n) => /\bCOOLER\s*MASTER\b/i.test(n) },
    { key: 'brand', label: 'Thermaltake', value: 'THERMALTAKE', matchFn: (n) => /\bTHERMALTAKE\b|\bTT\b/i.test(n) },
    { key: 'brand', label: 'Gamemax', value: 'GAMEMAX', matchFn: (n) => /\bGAMEMAX\b/i.test(n) },
    { key: 'brand', label: 'XPG', value: 'XPG', matchFn: (n) => /\bXPG\b/i.test(n) },
    { key: 'brand', label: 'Asus', value: 'ASUS', matchFn: (n) => /\bASUS\b|\bROG\b/i.test(n) },
    { key: 'brand', label: 'Aerocool', value: 'AEROCOOL', matchFn: (n) => /\bAEROCOOL\b/i.test(n) },
    { key: 'brand', label: 'MSI', value: 'MSI', matchFn: (n) => /\bMSI\b/i.test(n) },
    { key: 'brand', label: 'DeepCool', value: 'DEEPCOOL', matchFn: (n) => /\bDEEPCOOL\b/i.test(n) },
    { key: 'brand', label: 'Gigabyte', value: 'GIGABYTE', matchFn: (n) => /\bGIGABYTE\b|\bAORUS\b/i.test(n) },
    { key: 'brand', label: 'NZXT', value: 'NZXT', matchFn: (n) => /\bNZXT\b/i.test(n) },
    { key: 'brand', label: 'Sentey', value: 'SENTEY', matchFn: (n) => /\bSENTEY\b/i.test(n) },
    { key: 'brand', label: 'Naceb', value: 'NACEB', matchFn: (n) => /\bNACEB\b/i.test(n) },
    { key: 'brand', label: 'Kelyx', value: 'KELYX', matchFn: (n) => /\bKELYX\b/i.test(n) },
    { key: 'brand', label: 'Arkham', value: 'ARKHAM', matchFn: (n) => /\bARKHAM\b/i.test(n) },
    { key: 'brand', label: 'Teros', value: 'TEROS_GAB', matchFn: (n) => /\bTEROS\b|\bTE-/i.test(n) },
  ],
  'refrigeracion': [
    { key: 'brand', label: 'Asus', value: 'ASUS', matchFn: (n) => /\bASUS\b|\bROG\b/i.test(n) && /\bCOOL\b|\bAIO\b|\bLIQUID\b|\bWATER\b|\bDISIPADOR\b|\bFAN\b/i.test(n) },
    { key: 'brand', label: 'Cooler Master', value: 'COOLERMASTER', matchFn: (n) => /\bCOOLER\s*MASTER\b|\bCM\s*(MASTER|ML|MF)/i.test(n) },
    { key: 'brand', label: 'MSI', value: 'MSI', matchFn: (n) => /\bMSI\b/i.test(n) && /\bCOOL\b|\bAIO\b|\bLIQUID\b|\bWATER\b|\bDISIPADOR\b|\bFAN\b/i.test(n) },
    { key: 'brand', label: 'Thermaltake', value: 'THERMALTAKE', matchFn: (n) => /\bTHERMALTAKE\b|\bTt\s*(CT|Liquid|LA|Ring|SWAFAN)/i.test(n) },
    { key: 'brand', label: 'Corsair', value: 'CORSAIR', matchFn: (n) => /\bCORSAIR\b/i.test(n) },
    { key: 'brand', label: 'Gamemax', value: 'GAMEMAX', matchFn: (n) => /\bGAMEMAX\b/i.test(n) },
    { key: 'brand', label: 'XPG', value: 'XPG', matchFn: (n) => /\bXPG\b/i.test(n) },
    { key: 'brand', label: 'DeepCool', value: 'DEEPCOOL', matchFn: (n) => /\bDEEPCOOL\b/i.test(n) },
    { key: 'brand', label: 'Noctua', value: 'NOCTUA', matchFn: (n) => /\bNOCTUA\b/i.test(n) },
    { key: 'brand', label: 'Arctic', value: 'ARCTIC', matchFn: (n) => /\bARCTIC\b/i.test(n) },
    { key: 'brand', label: 'be quiet!', value: 'BE_QUIET', matchFn: (n) => /\bBE\s*QUIET\b|\bDARK\s*POWER\b|\bPURE\s*LOOP\b|\bSILENT\s*LOOP\b/i.test(n) },
    { key: 'brand', label: 'Gigabyte', value: 'GIGABYTE', matchFn: (n) => /\bGIGABYTE\b/i.test(n) && /\bCOOL\b|\bAIO\b|\bLIQUID\b|\bWATER\b/i.test(n) },
    { key: 'brand', label: 'Aerocool', value: 'AEROCOOL', matchFn: (n) => /\bAEROCOOL\b/i.test(n) },
    { key: 'brand', label: 'Kelyx', value: 'KELYX', matchFn: (n) => /\bKELYX\b/i.test(n) },
    { key: 'brand', label: 'Raptor', value: 'RAPTOR_REF', matchFn: (n) => /\bRAPTOR\b/i.test(n) },
    { key: 'type', label: 'AIO / Líquida', value: 'LIQUID', matchFn: (n) => /\bWATER\s*COOL\b|\bAIO\b|\bLIQUID\b|\bWATERFORCE\b/i.test(n) },
    { key: 'type', label: 'Aire', value: 'AIR', matchFn: (n) => !/\bWATER\s*COOL\b|\bAIO\b|\bLIQUID\b|\bWATERFORCE\b/i.test(n) },
  ],
  'monitores': [
    { key: 'brand', label: 'Asus', value: 'ASUS', matchFn: (n) => /\bASUS\b|\bROG\b|\bTUF\b|\bPROART\b/i.test(n) },
    { key: 'brand', label: 'LG', value: 'LG', matchFn: (n) => /\bLG\b|\bULTRAGEAR\b/i.test(n) },
    { key: 'brand', label: 'Dell', value: 'DELL', matchFn: (n) => /\bDELL\b/i.test(n) },
    { key: 'brand', label: 'Gigabyte', value: 'GIGABYTE', matchFn: (n) => /\bGIGABYTE\b|\bAORUS\b|\bM\d{2,3}Q\b/i.test(n) },
    { key: 'brand', label: 'AOC', value: 'AOC', matchFn: (n) => /\bAOC\b|\bAGON\b/i.test(n) },
    { key: 'brand', label: 'Philips', value: 'PHILIPS', matchFn: (n) => /\bPHILIPS\b|\bEVNIA\b/i.test(n) },
    { key: 'brand', label: 'Samsung', value: 'SAMSUNG', matchFn: (n) => /\bSAMSUNG\b|\bODYSSEY\b|\bVIEWFINITY\b/i.test(n) },
    { key: 'brand', label: 'MSI', value: 'MSI', matchFn: (n) => /\bMSI\b/i.test(n) },
    { key: 'brand', label: 'HP', value: 'HP', matchFn: (n) => /\bHP\b/i.test(n) },
    { key: 'brand', label: 'Lenovo', value: 'LENOVO', matchFn: (n) => /\bLENOVO\b/i.test(n) },
    { key: 'brand', label: 'Hikvision', value: 'HIKVISION', matchFn: (n) => /\bHIKVISION\b/i.test(n) },
    { key: 'brand', label: 'Gamemax', value: 'GAMEMAX', matchFn: (n) => /\bGAMEMAX\b/i.test(n) },
    { key: 'brand', label: 'Acer', value: 'ACER', matchFn: (n) => /\bACER\b/i.test(n) },
    { key: 'brand', label: 'BenQ', value: 'BENQ', matchFn: (n) => /\bBENQ\b|\bZOWIE\b/i.test(n) },
    { key: 'brand', label: 'ViewSonic', value: 'VIEWSONIC', matchFn: (n) => /\bVIEWSONIC\b/i.test(n) },
    { key: 'brand', label: 'CX', value: 'CX', matchFn: (n) => /\bCX\b/i.test(n) },
    { key: 'brand', label: 'Teros', value: 'TEROS', matchFn: (n) => /\bTEROS\b|\bTE-/i.test(n) },
    { key: 'brand', label: 'Raptor', value: 'RAPTOR', matchFn: (n) => /\bRAPTOR\b/i.test(n) },
    { key: 'brand', label: 'E-View', value: 'EVIEW', matchFn: (n) => /\bE[\s\-]?VIEW\b/i.test(n) },
    { key: 'brand', label: 'Cooler Master', value: 'COOLERMASTER_MON', matchFn: (n) => /\bCOOLER\s*MASTER\b/i.test(n) },
    { key: 'size', label: '19"', value: '19', matchFn: (n) => /\b19[\s\"\-\.]\d|\b19\s*PULGAD/i.test(n) && !/\b19\d{2,}\b/i.test(n) },
    { key: 'size', label: '22"', value: '22', matchFn: (n) => /\b22[\s\"\-\.]\d|\b22\s*PULGAD/i.test(n) && !/\b22\d{2,}\b/i.test(n) },
    { key: 'size', label: '24"', value: '24', matchFn: (n) => /\b24\b/i.test(n) },
    { key: 'size', label: '27"', value: '27', matchFn: (n) => /\b27\b/i.test(n) },
    { key: 'size', label: '32"+', value: '32', matchFn: (n) => /\b3[2-9]\b|\b4[0-9]\b/i.test(n) },
    { key: 'hz', label: '100Hz', value: '100HZ', matchFn: (n) => /\b100\s*HZ\b|\b100HZ\b/i.test(n) },
    { key: 'hz', label: '144Hz', value: '144HZ', matchFn: (n) => /\b144\s*HZ\b|\b144HZ\b/i.test(n) },
    { key: 'hz', label: '165Hz', value: '165HZ', matchFn: (n) => /\b165\s*HZ\b|\b165HZ\b/i.test(n) },
    { key: 'hz', label: '180Hz', value: '180HZ', matchFn: (n) => /\b180\s*HZ\b|\b180HZ\b/i.test(n) },
    { key: 'resolution', label: 'Full HD', value: 'FHD', matchFn: (n) => /\bFULL\s*HD\b|\bFHD\b|\b1080\b/i.test(n) },
    { key: 'resolution', label: 'QHD', value: 'QHD', matchFn: (n) => /\bQHD\b|\b2K\b|\b1440\b/i.test(n) },
    { key: 'resolution', label: '4K / UHD', value: '4K', matchFn: (n) => /\b4K\b|\bUHD\b|\b2160\b/i.test(n) },
  ],
  'placas-de-red': [
    { key: 'brand', label: 'TP-Link', value: 'TPLINK', matchFn: (n) => /\bTP[\s\-]?LINK\b|\bARCHER\b|\bTL\s*W\b/i.test(n) },
    { key: 'brand', label: 'Mercusys', value: 'MERCUSYS', matchFn: (n) => /\bMERCUSYS\b/i.test(n) },
    { key: 'brand', label: 'Cudy', value: 'CUDY', matchFn: (n) => /\bCUDY\b/i.test(n) },
    { key: 'brand', label: 'Hikvision', value: 'HIKVISION', matchFn: (n) => /\bHIKVISION\b/i.test(n) },
    { key: 'brand', label: 'Asus', value: 'ASUS', matchFn: (n) => /\bASUS\b|\bROG\b/i.test(n) && /\bRED\b|\bWIFI\b|\bPCI\b|\bUSB\b/i.test(n) },
    { key: 'brand', label: 'Intel', value: 'INTEL', matchFn: (n) => /\bINTEL\b/i.test(n) && /\bRED\b|\bWIFI\b|\bLAN\b|\bNIC\b/i.test(n) },
    { key: 'brand', label: 'D-Link', value: 'DLINK', matchFn: (n) => /\bD[\s\-]?LINK\b/i.test(n) && !/\bTP/i.test(n) },
    { key: 'brand', label: 'Ubiquiti', value: 'UBIQUITI', matchFn: (n) => /\bUBIQUITI\b|\bUNIFI\b/i.test(n) },
    { key: 'brand', label: 'Mikrotik', value: 'MIKROTIK', matchFn: (n) => /\bMIKROTIK\b|\bROUTEROS\b/i.test(n) },
    { key: 'brand', label: 'Tenda', value: 'TENDA', matchFn: (n) => /\bTENDA\b/i.test(n) },
    { key: 'type', label: 'PCIe', value: 'PCIE', matchFn: (n) => /\bPCIEX?\b|\bPCI-E\b|\bPCIX\b/i.test(n) && !/\bUSB\b/i.test(n) },
    { key: 'type', label: 'USB', value: 'USB', matchFn: (n) => /\bP\.?REDW?\s.*USB|USB.*RED|\bARCHER T\b/i.test(n) },
    { key: 'type', label: 'WiFi 6 / 6E', value: 'WIFI6', matchFn: (n) => /\bWIFI\s*6E?\b|\bAX\d{3,4}\b/i.test(n) },
  ],
  'routers-wifi': [
    { key: 'brand', label: 'TP-Link', value: 'TPLINK', matchFn: (n) => /\bTP[\s\-]?LINK\b|\bARCHER\b|\bDECO\b|\bTL\s*W/i.test(n) },
    { key: 'brand', label: 'Mercusys', value: 'MERCUSYS', matchFn: (n) => /\bMERCUSYS\b/i.test(n) },
    { key: 'brand', label: 'Cudy', value: 'CUDY', matchFn: (n) => /\bCUDY\b/i.test(n) },
    { key: 'brand', label: 'Hikvision', value: 'HIKVISION', matchFn: (n) => /\bHIKVISION\b/i.test(n) },
    { key: 'brand', label: 'Asus', value: 'ASUS', matchFn: (n) => /\bASUS\b|\bROG\b/i.test(n) },
    { key: 'brand', label: 'D-Link', value: 'DLINK', matchFn: (n) => /\bD[\s\-]?LINK\b/i.test(n) && !/\bTP/i.test(n) },
    { key: 'brand', label: 'Tenda', value: 'TENDA', matchFn: (n) => /\bTENDA\b/i.test(n) },
    { key: 'brand', label: 'Aruba', value: 'ARUBA', matchFn: (n) => /\bARUBA\b/i.test(n) },
    { key: 'brand', label: 'GlcFi', value: 'GLCFI', matchFn: (n) => /\bGlcFi\b/i.test(n) },
  ],
  'switches': [
    { key: 'brand', label: 'TP-Link', value: 'TPLINK', matchFn: (n) => /\bTP[\s\-]?LINK\b/i.test(n) },
    { key: 'brand', label: 'HP', value: 'HP', matchFn: (n) => /\bHP\b/i.test(n) },
    { key: 'brand', label: 'Hikvision', value: 'HIKVISION', matchFn: (n) => /\bHIKVISION\b/i.test(n) },
    { key: 'brand', label: 'Cudy', value: 'CUDY', matchFn: (n) => /\bCUDY\b/i.test(n) },
    { key: 'brand', label: 'D-Link', value: 'DLINK', matchFn: (n) => /\bD[\s\-]?LINK\b/i.test(n) && !/\bTP/i.test(n) },
    { key: 'brand', label: 'Mercusys', value: 'MERCUSYS', matchFn: (n) => /\bMERCUSYS\b/i.test(n) },
    { key: 'brand', label: 'Tenda', value: 'TENDA', matchFn: (n) => /\bTENDA\b/i.test(n) },
    { key: 'brand', label: 'Huawei', value: 'HUAWEI', matchFn: (n) => /\bHUAWEI\b|\bEKIT\b/i.test(n) },
    { key: 'brand', label: 'Aruba', value: 'ARUBA', matchFn: (n) => /\bARUBA\b/i.test(n) },
    { key: 'brand', label: 'HPE', value: 'HPE', matchFn: (n) => /\bHPE\b/i.test(n) },
  ],
  'auriculares': [
    { key: 'brand', label: 'Logitech', value: 'LOGITECH', matchFn: (n) => /\bLOGITECH\b/i.test(n) },
    { key: 'brand', label: 'JBL', value: 'JBL', matchFn: (n) => /\bJBL\b/i.test(n) },
    { key: 'brand', label: 'Genius', value: 'GENIUS', matchFn: (n) => /\bGENIUS\b/i.test(n) },
    { key: 'brand', label: 'Corsair', value: 'CORSAIR', matchFn: (n) => /\bCORSAIR\b/i.test(n) },
    { key: 'brand', label: 'Redragon', value: 'REDRAGON', matchFn: (n) => /\bREDRAGON\b/i.test(n) },
    { key: 'brand', label: 'HyperX', value: 'HYPERX', matchFn: (n) => /\bHYPERX\b|\bCLOUD\b/i.test(n) },
    { key: 'brand', label: 'Razer', value: 'RAZER', matchFn: (n) => /\bRAZER\b|\bKRAKEN\b/i.test(n) },
    { key: 'brand', label: 'Asus', value: 'ASUS', matchFn: (n) => /\bASUS\b|\bROG\b/i.test(n) },
    { key: 'brand', label: 'Kelyx', value: 'KELYX', matchFn: (n) => /\bKELYX\b/i.test(n) },
    { key: 'brand', label: 'Philips', value: 'PHILIPS', matchFn: (n) => /\bPHILIPS\b/i.test(n) },
    { key: 'brand', label: 'Klipxtreme', value: 'KLIPXTREME_AUR', matchFn: (n) => /\bKLIPXTREME\b/i.test(n) },
    { key: 'brand', label: 'Raptor', value: 'RAPTOR_AUR', matchFn: (n) => /\bRAPTOR\b/i.test(n) },
    { key: 'brand', label: 'X-tech', value: 'XTECH_AUR', matchFn: (n) => /\bX[\s\-]?TECH\b/i.test(n) },
  ],
  'mouse': [
    { key: 'brand', label: 'Logitech', value: 'LOGITECH', matchFn: (n) => /\bLOGITECH\b/i.test(n) },
    { key: 'brand', label: 'Genius', value: 'GENIUS', matchFn: (n) => /\bGENIUS\b/i.test(n) },
    { key: 'brand', label: 'Corsair', value: 'CORSAIR', matchFn: (n) => /\bCORSAIR\b/i.test(n) },
    { key: 'brand', label: 'Redragon', value: 'REDRAGON', matchFn: (n) => /\bREDRAGON\b/i.test(n) },
    { key: 'brand', label: 'HyperX', value: 'HYPERX', matchFn: (n) => /\bHYPERX\b/i.test(n) },
    { key: 'brand', label: 'Razer', value: 'RAZER', matchFn: (n) => /\bRAZER\b|\bDEATHADDER\b|\bVIPER\b/i.test(n) },
    { key: 'brand', label: 'Asus', value: 'ASUS', matchFn: (n) => /\bASUS\b|\bROG\b/i.test(n) },
    { key: 'brand', label: 'MSI', value: 'MSI', matchFn: (n) => /\bMSI\b/i.test(n) },
    { key: 'brand', label: 'Dell', value: 'DELL', matchFn: (n) => /\bDELL\b/i.test(n) },
    { key: 'brand', label: 'Lenovo', value: 'LENOVO', matchFn: (n) => /\bLENOVO\b/i.test(n) },
    { key: 'brand', label: 'Klipxtreme', value: 'KLIPXTREME', matchFn: (n) => /\bKLIPXTREME\b/i.test(n) },
    { key: 'brand', label: 'X-tech', value: 'XTECH', matchFn: (n) => /\bX[\s\-]?TECH\b/i.test(n) },
    { key: 'brand', label: 'Raptor', value: 'RAPTOR_MOU', matchFn: (n) => /\bRAPTOR\b/i.test(n) },
    { key: 'brand', label: 'Teros', value: 'TEROS_MOU', matchFn: (n) => /\bTEROS\b|\bTE-/i.test(n) },
    { key: 'brand', label: 'CX', value: 'CX_MOU', matchFn: (n) => /\bCX\b/i.test(n) },
    { key: 'brand', label: 'EVGA', value: 'EVGA', matchFn: (n) => /\bEVGA\b/i.test(n) },
  ],
  'teclados': [
    { key: 'brand', label: 'Logitech', value: 'LOGITECH', matchFn: (n) => /\bLOGITECH\b/i.test(n) },
    { key: 'brand', label: 'Genius', value: 'GENIUS', matchFn: (n) => /\bGENIUS\b/i.test(n) },
    { key: 'brand', label: 'Corsair', value: 'CORSAIR', matchFn: (n) => /\bCORSAIR\b|\bK70\b|\bK95\b/i.test(n) },
    { key: 'brand', label: 'Redragon', value: 'REDRAGON', matchFn: (n) => /\bREDRAGON\b/i.test(n) },
    { key: 'brand', label: 'Razer', value: 'RAZER', matchFn: (n) => /\bRAZER\b|\bBLACKWIDOW\b|\bHUNSTMAN\b/i.test(n) },
    { key: 'brand', label: 'HyperX', value: 'HYPERX', matchFn: (n) => /\bHYPERX\b|\bALLOY\b/i.test(n) },
    { key: 'brand', label: 'Asus', value: 'ASUS', matchFn: (n) => /\bASUS\b|\bROG\b/i.test(n) },
    { key: 'brand', label: 'HP', value: 'HP', matchFn: (n) => /\bHP\b/i.test(n) },
    { key: 'brand', label: 'Gamemax', value: 'GAMEMAX', matchFn: (n) => /\bGAMEMAX\b/i.test(n) },
    { key: 'brand', label: 'CX', value: 'CX_TECL', matchFn: (n) => /\bCX\b/i.test(n) },
    { key: 'brand', label: 'Klipxtreme', value: 'KLIPXTREME_TEC', matchFn: (n) => /\bKLIPXTREME\b/i.test(n) },
    { key: 'brand', label: 'Dell', value: 'DELL_TEC', matchFn: (n) => /\bDELL\b/i.test(n) },
  ],
  'parlantes': [
    { key: 'brand', label: 'Genius', value: 'GENIUS', matchFn: (n) => /\bGENIUS\b/i.test(n) },
    { key: 'brand', label: 'JBL', value: 'JBL', matchFn: (n) => /\bJBL\b/i.test(n) },
    { key: 'brand', label: 'LG', value: 'LG', matchFn: (n) => /\bLG\b/i.test(n) },
    { key: 'brand', label: 'Kelyx', value: 'KELYX', matchFn: (n) => /\bKELYX\b/i.test(n) },
    { key: 'brand', label: 'Foxbox', value: 'FOXBOX', matchFn: (n) => /\bFOXBOX\b|\bCORVUS\b|\bPYXIS\b|\bWARP\b/i.test(n) },
    { key: 'brand', label: 'Harman Kardon', value: 'HARMANKARDON', matchFn: (n) => /\bHARMAN\b|\bKARDON\b/i.test(n) },
  ],
  'webcams': [
    { key: 'brand', label: 'Logitech', value: 'LOGITECH', matchFn: (n) => /\bLOGITECH\b|\bC920\b|\bC270\b|\bBRIO\b/i.test(n) },
    { key: 'brand', label: 'Genius', value: 'GENIUS', matchFn: (n) => /\bGENIUS\b/i.test(n) },
    { key: 'brand', label: 'Razer', value: 'RAZER', matchFn: (n) => /\bRAZER\b|\bKIYO\b/i.test(n) },
    { key: 'brand', label: 'Raptor', value: 'RAPTOR_CAM', matchFn: (n) => /\bRAPTOR\b/i.test(n) },
    { key: 'brand', label: 'Kelyx', value: 'KELYX_CAM', matchFn: (n) => /\bKELYX\b/i.test(n) },
  ],
  'impresion': [
    { key: 'brand', label: 'HP', value: 'HP', matchFn: (n) => /\bHP\b/i.test(n) },
    { key: 'brand', label: 'Brother', value: 'BROTHER', matchFn: (n) => /\bBROTHER\b/i.test(n) },
    { key: 'brand', label: 'Epson', value: 'EPSON', matchFn: (n) => /\bEPSON\b|\bECOTANK\b|\bWORKFORCE\b/i.test(n) },
    { key: 'brand', label: 'Lexmark', value: 'LEXMARK', matchFn: (n) => /\bLEXMARK\b/i.test(n) },
    { key: 'brand', label: 'Samsung', value: 'SAMSUNG', matchFn: (n) => /\bSAMSUNG\b/i.test(n) },
    { key: 'brand', label: 'Canon', value: 'CANON', matchFn: (n) => /\bCANON\b|\bPIXMA\b/i.test(n) },
    { key: 'brand', label: 'Honeywell', value: 'HONEYWELL', matchFn: (n) => /\bHONEYWELL\b/i.test(n) },
    { key: 'brand', label: 'Ocom', value: 'OCOM', matchFn: (n) => /\bOCOM\b/i.test(n) },
    { key: 'type', label: 'Inyección', value: 'INYECCION', matchFn: (n) => /\bIMPRESORA\b|\bINKJET\b|\bECOTANK\b|\bDESkJET\b|\bOFFICEJET\b|\bSMART TANK\b/i.test(n) },
    { key: 'type', label: 'Láser', value: 'LASER', matchFn: (n) => /\bLASER\b|bLASERJET\b|\bMFP\b/i.test(n) },
    { key: 'type', label: 'Proyector', value: 'PROYECTOR', matchFn: (n) => /\bPROYECTOR\b/i.test(n) },
    { key: 'type', label: 'Toner / Cartucho', value: 'TONER', matchFn: (n) => /\bTONER\b|\bCARTUCHO\b|\bBOTELLA\b|\bTINTA/i.test(n) },
  ],
  'toners-y-cartuchos': [
    { key: 'brand', label: 'HP', value: 'HP', matchFn: (n) => /\bHP\b/i.test(n) },
    { key: 'brand', label: 'Brother', value: 'BROTHER', matchFn: (n) => /\bBROTHER\b/i.test(n) },
    { key: 'brand', label: 'Lexmark', value: 'LEXMARK', matchFn: (n) => /\bLEXMARK\b/i.test(n) },
    { key: 'brand', label: 'Epson', value: 'EPSON', matchFn: (n) => /\bEPSON\b/i.test(n) },
    { key: 'brand', label: 'Samsung', value: 'SAMSUNG', matchFn: (n) => /\bSAMSUNG\b/i.test(n) },
    { key: 'brand', label: 'Canon', value: 'CANON', matchFn: (n) => /\bCANON\b/i.test(n) },
    { key: 'brand', label: 'Pantum', value: 'PANTUM', matchFn: (n) => /\bPANTUM\b/i.test(n) },
  ],
  'pendrives': [
    { key: 'brand', label: 'Kingston', value: 'KINGSTON', matchFn: (n) => /\bKINGSTON\b|\bDATATRAVELER\b|\bDATA TRAVELER\b/i.test(n) },
    { key: 'brand', label: 'Hiksemi', value: 'HIKSEMI', matchFn: (n) => /\bHIKSEMI\b/i.test(n) },
    { key: 'brand', label: 'Lexar', value: 'LEXAR', matchFn: (n) => /\bLEXAR\b|\bJUMPDRIVE\b/i.test(n) },
    { key: 'brand', label: 'SanDisk', value: 'SANDISK', matchFn: (n) => /\bSANDISK\b/i.test(n) },
  ],
  'discos-externos': [
    { key: 'brand', label: 'ADATA', value: 'ADATA', matchFn: (n) => /\bADATA\b|\bXPG\b/i.test(n) },
    { key: 'brand', label: 'WD', value: 'WD', matchFn: (n) => /\bWESTERN\b|\bWD\b|\bMY PASSPORT\b|\bELEMENTS\b/i.test(n) },
    { key: 'brand', label: 'Seagate', value: 'SEAGATE', matchFn: (n) => /\bSEAGATE\b|\bEXPANSION\b|\bONE TOUCH\b/i.test(n) },
    { key: 'brand', label: 'Kingston', value: 'KINGSTON', matchFn: (n) => /\bKINGSTON\b/i.test(n) },
    { key: 'brand', label: 'Hiksemi', value: 'HIKSEMI', matchFn: (n) => /\bHIKSEMI\b/i.test(n) },
    { key: 'brand', label: 'Crucial', value: 'CRUCIAL', matchFn: (n) => /\bCRUCIAL\b|\bX9\b|\bX8\b/i.test(n) },
    { key: 'brand', label: 'Toshiba', value: 'TOSHIBA', matchFn: (n) => /\bTOSHIBA\b|\bCANVIO\b/i.test(n) },
    { key: 'brand', label: 'SanDisk', value: 'SANDISK_EXT', matchFn: (n) => /\bSANDISK\b/i.test(n) },
    { key: 'capacity', label: 'Hasta 512GB', value: 'upto512', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c <= 600 } },
    { key: 'capacity', label: '1TB', value: '1tb', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 900 && c <= 1100 } },
    { key: 'capacity', label: '2TB', value: '2tb', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 1900 && c <= 2100 } },
    { key: 'capacity', label: '4TB+', value: '4tbplus', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 3800 } },
  ],
  'perifericos': [
    { key: 'brand', label: 'Logitech', value: 'LOGITECH', matchFn: (n) => /\bLOGITECH\b/i.test(n) },
    { key: 'brand', label: 'Genius', value: 'GENIUS', matchFn: (n) => /\bGENIUS\b/i.test(n) },
    { key: 'brand', label: 'Redragon', value: 'REDRAGON', matchFn: (n) => /\bREDRAGON\b/i.test(n) },
    { key: 'brand', label: 'Corsair', value: 'CORSAIR', matchFn: (n) => /\bCORSAIR\b/i.test(n) },
    { key: 'brand', label: 'Razer', value: 'RAZER', matchFn: (n) => /\bRAZER\b/i.test(n) },
    { key: 'brand', label: 'HyperX', value: 'HYPERX', matchFn: (n) => /\bHYPERX\b/i.test(n) },
    { key: 'brand', label: 'Kelyx', value: 'KELYX', matchFn: (n) => /\bKELYX\b/i.test(n) },
    { key: 'type', label: 'Mouse', value: 'MOUSE', matchFn: (n) => /\bMOUSE\b/i.test(n) && !/\bMOUSEPAD\b/i.test(n) },
    { key: 'type', label: 'Teclado', value: 'TECLADO', matchFn: (n) => /\bTECLADO\b|\bKEYBOARD\b/i.test(n) || (/(\bMECANICO\b|\bMECHANICAL\b)/i.test(n) && !/\bMOUSE\b/i.test(n)) },
    { key: 'type', label: 'Auricular', value: 'AURICULAR', matchFn: (n) => /\bAURICULAR\b|\bHEADSET\b/i.test(n) },
    { key: 'type', label: 'Webcam', value: 'WEBCAM', matchFn: (n) => /\bWEBCAM\b|\bWEB CAM\b/i.test(n) },
    { key: 'type', label: 'Micrófono', value: 'MICROFONO', matchFn: (n) => /\bMICROFONO\b|\bMICRÓFONO\b/i.test(n) },
    { key: 'type', label: 'Volante', value: 'VOLANTE', matchFn: (n) => /\bVOLANTE\b|\bWHEEL\b|\bRACING\s*(WHEEL|VOLANTE)\b/i.test(n) },
    { key: 'type', label: 'Parlante', value: 'PARLANTE', matchFn: (n) => /\bPARLANTE\b|\bSPEAKER\b/i.test(n) },
    { key: 'type', label: 'Joystick', value: 'JOYSTICK', matchFn: (n) => /\bJOYSTICK\b|\bGAMEPAD\b|\bCONTROL\s*(PS|XBOX|XBOX\s*ONE|DECK|SWITCH)\b/i.test(n) },
  ],
  'notebooks': [
    { key: 'brand', label: 'Lenovo', value: 'lenovo', matchFn: (n) => /\bLENOVO\b|\bTHINKPAD\b|\bIDEAPAD\b|\bLOQ\b|\bLEGION\b|\bYOGA\b/i.test(n) },
    { key: 'brand', label: 'HP', value: 'hp', matchFn: (n) => /\bHP\b|\bPAVILION\b|\bOMEN\b|\bVICTUS\b|\bDRAGONFLY\b|\bZBOOK\b/i.test(n) },
    { key: 'brand', label: 'Dell', value: 'dell', matchFn: (n) => /\bDELL\b|\bINSPIRON\b|\bLATITUDE\b|\bALIENWARE\b/i.test(n) },
    { key: 'brand', label: 'Asus', value: 'asus', matchFn: (n) => /\bASUS\b|\bROG\b|\bTUF\b|\bZENBOOK\b|\bVIVOBOOK\b/i.test(n) },
    { key: 'brand', label: 'MSI', value: 'msi', matchFn: (n) => /\bMSI\b|\bRAIDER\b|\bTHIN\b|\bCYBORG\b/i.test(n) },
    { key: 'brand', label: 'Acer', value: 'acer', matchFn: (n) => /\bACER\b|\bASPIRE\b|\bNITRO\b|\bPREDATOR\b/i.test(n) },
    { key: 'brand', label: 'CX', value: 'cx', matchFn: (n) => /\bCX\b/i.test(n) },
    { key: 'brand', label: 'Kelyx', value: 'kelyx', matchFn: (n) => /\bKELYX\b/i.test(n) },
    { key: 'processor', label: 'Core i9 / Ultra 9', value: 'i9', matchFn: (n) => /\bI9\b|\bCORE\s*9\b|\bCORE\s*ULTRA\s*9\b/i.test(n) },
    { key: 'processor', label: 'Core i7 / Ultra 7', value: 'i7', matchFn: (n) => /\bI7\b|\bCORE\s*7\b|\bCORE\s*ULTRA\s*7\b|\bU7[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Core i5 / Ultra 5', value: 'i5', matchFn: (n) => /\bI5\b|\bCORE\s*5\b|\bCORE\s*ULTRA\s*5\b|\bC5[- ]?\d|\bU5[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Core i3', value: 'i3', matchFn: (n) => /\bI3\b|\bCORE\s*3\b|\bC3[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Celeron / Pentium', value: 'celeron', matchFn: (n) => /\bCELERON\b|\bPENTIUM\b/i.test(n) },
    { key: 'processor', label: 'Intel N-Series', value: 'intel_n', matchFn: (n) => /\bN100\b|\bN305\b|\bN5030\b/i.test(n) },
    { key: 'processor', label: 'Ryzen 9', value: 'r9', matchFn: (n) => /\bRYZEN\s*9\b|\bR9[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Ryzen 7', value: 'r7', matchFn: (n) => /\bRYZEN\s*7\b|\bR7[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Ryzen 5', value: 'r5', matchFn: (n) => /\bRYZEN\s*5\b|\bR5[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Ryzen 3', value: 'r3', matchFn: (n) => /\bRYZEN\s*3\b|\bR3[- ]?\d/i.test(n) },
    { key: 'ram', label: '4GB', value: '4gb', matchFn: (n) => extractNotebookRAM(n) === 4 },
    { key: 'ram', label: '8GB', value: '8gb', matchFn: (n) => extractNotebookRAM(n) === 8 },
    { key: 'ram', label: '16GB', value: '16gb', matchFn: (n) => extractNotebookRAM(n) === 16 },
    { key: 'ram', label: '24GB', value: '24gb', matchFn: (n) => extractNotebookRAM(n) === 24 },
    { key: 'ram', label: '32GB', value: '32gb', matchFn: (n) => extractNotebookRAM(n) === 32 },
    { key: 'screen', label: '13"', value: '13', matchFn: (n) => /13[\."]|13\s/i.test(n) },
    { key: 'screen', label: '14"', value: '14', matchFn: (n) => /14[\."]|14\s/i.test(n) },
    { key: 'screen', label: '15"', value: '15', matchFn: (n) => /15[\."]|15\s/i.test(n) },
    { key: 'screen', label: '16"', value: '16', matchFn: (n) => /16[\."]|16\s/i.test(n) },
    { key: 'gpu', label: 'GPU dedicada', value: 'dedicated_gpu', matchFn: (n) => detectNotebookGPUType(n) === 'dedicated' },
    { key: 'gpu', label: 'GPU integrada', value: 'integrated_gpu', matchFn: (n) => detectNotebookGPUType(n) === 'integrated' },
  ],
  'smart-home': [
    { key: 'brand', label: 'EZVIZ', value: 'EZVIZ', matchFn: (n) => /\bEZVIZ\b/i.test(n) },
    { key: 'brand', label: 'TP-Link', value: 'TPLINK', matchFn: (n) => /\bTP[\s\-]?LINK\b|\bTAPO\b/i.test(n) },
    { key: 'brand', label: 'Hikvision', value: 'HIKVISION', matchFn: (n) => /\bHIKVISION\b/i.test(n) },
    { key: 'brand', label: 'Hilook', value: 'HILOOK', matchFn: (n) => /\bHILOOK\b/i.test(n) },
    { key: 'brand', label: 'Xiaomi', value: 'XIAOMI', matchFn: (n) => /\bXIAOMI\b|\bMI\b|\bROBOROCK\b/i.test(n) },
    { key: 'brand', label: 'Nexxt', value: 'NEXXT', matchFn: (n) => /\bNEXXT\b/i.test(n) },
    { key: 'brand', label: 'Loosafe', value: 'LOOSAFE', matchFn: (n) => /\bLOOSAFE\b/i.test(n) },
  ],
  // === Categorías agregadas sesión 30: filtros de marca para TODAS las categorías ===
  'cables-y-adaptadores': [
    { key: 'brand', label: 'TP-Link', value: 'TPLINK', matchFn: (n) => /\bTP[\s\-]?LINK\b/i.test(n) },
    { key: 'brand', label: 'Cudy', value: 'CUDY', matchFn: (n) => /\bCUDY\b/i.test(n) },
    { key: 'brand', label: 'ASUS', value: 'ASUS', matchFn: (n) => /\bASUS\b/i.test(n) },
    { key: 'brand', label: 'Genius', value: 'GENIUS', matchFn: (n) => /\bGENIUS\b/i.test(n) },
    { key: 'brand', label: 'Ugreen', value: 'UGREEN', matchFn: (n) => /\bUGREEN\b/i.test(n) },
    { key: 'brand', label: 'Vention', value: 'VENTION', matchFn: (n) => /\bVENTION\b/i.test(n) },
    { key: 'brand', label: 'Klipxtreme', value: 'KLIPXTREME', matchFn: (n) => /\bKLIPXTREME\b/i.test(n) },
    { key: 'brand', label: 'D-Link', value: 'DLINK', matchFn: (n) => /\bD[\s\-]?LINK\b/i.test(n) && !/\bTP/i.test(n) },
    { key: 'brand', label: 'Hikvision', value: 'HIKVISION', matchFn: (n) => /\bHIKVISION\b/i.test(n) },
    { key: 'type', label: 'Cable', value: 'CABLE', matchFn: (n) => /\bCABLE\b/i.test(n) && !/\bADAPTADOR\b/i.test(n) },
    { key: 'type', label: 'Adaptador', value: 'ADAPTADOR', matchFn: (n) => /\bADAPTADOR\b/i.test(n) },
    { key: 'type', label: 'Conversor', value: 'CONVERSOR', matchFn: (n) => /\bCONVERSOR\b|\bCONVERTIDOR\b/i.test(n) },
    { key: 'type', label: 'Hub / Repartidor', value: 'HUB', matchFn: (n) => /\bHUB\b|\bREPARTIDOR\b/i.test(n) },
  ],
  'oficina': [
    { key: 'brand', label: 'HP', value: 'HP', matchFn: (n) => /\bHP\b|\bPAVILION\b|\bVICTUS\b|\bDRAGONFLY\b/i.test(n) },
    { key: 'brand', label: 'Lenovo', value: 'LENOVO', matchFn: (n) => /\bLENOVO\b|\bTHINKPAD\b|\bIDEAPAD\b|\bYOGA\b/i.test(n) },
    { key: 'brand', label: 'Dell', value: 'DELL', matchFn: (n) => /\bDELL\b|\bINSPIRON\b|\bLATITUDE\b|\bVOSTRO\b/i.test(n) },
    { key: 'brand', label: 'Asus', value: 'ASUS', matchFn: (n) => /\bASUS\b|\bVIVOBOOK\b/i.test(n) },
    { key: 'brand', label: 'Acer', value: 'ACER', matchFn: (n) => /\bACER\b|\bASPIRE\b/i.test(n) },
    { key: 'brand', label: 'CX', value: 'CX', matchFn: (n) => /\bCX\b/i.test(n) },
    { key: 'brand', label: 'Kelyx', value: 'KELYX', matchFn: (n) => /\bKELYX\b/i.test(n) },
    { key: 'brand', label: 'MSI', value: 'MSI', matchFn: (n) => /\bMSI\b/i.test(n) },
    { key: 'type', label: 'Notebook', value: 'notebook', matchFn: (n) => /\bNB\b|\bNOTEBOOK\b|\bLAPTOP\b/i.test(n) },
    { key: 'type', label: 'Otro', value: 'otro', matchFn: (n) => !/\bNB\b|\bNOTEBOOK\b|\bLAPTOP\b/i.test(n) },
    { key: 'processor', label: 'Core i9 / Ultra 9', value: 'i9', matchFn: (n) => /\bI9\b|\bCORE\s*9\b|\bCORE\s*ULTRA\s*9\b/i.test(n) },
    { key: 'processor', label: 'Core i7 / Ultra 7', value: 'i7', matchFn: (n) => /\bI7\b|\bCORE\s*7\b|\bCORE\s*ULTRA\s*7\b|\bU7[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Core i5 / Ultra 5', value: 'i5', matchFn: (n) => /\bI5\b|\bCORE\s*5\b|\bCORE\s*ULTRA\s*5\b|\bC5[- ]?\d|\bU5[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Core i3', value: 'i3', matchFn: (n) => /\bI3\b|\bCORE\s*3\b|\bC3[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Celeron / Pentium', value: 'celeron', matchFn: (n) => /\bCELERON\b|\bPENTIUM\b/i.test(n) },
    { key: 'processor', label: 'Intel N-Series', value: 'intel_n', matchFn: (n) => /\bN100\b|\bN305\b|\bN5030\b/i.test(n) },
    { key: 'processor', label: 'Ryzen 9', value: 'r9', matchFn: (n) => /\bRYZEN\s*9\b|\bR9[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Ryzen 7', value: 'r7', matchFn: (n) => /\bRYZEN\s*7\b|\bR7[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Ryzen 5', value: 'r5', matchFn: (n) => /\bRYZEN\s*5\b|\bR5[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Ryzen 3', value: 'r3', matchFn: (n) => /\bRYZEN\s*3\b|\bR3[- ]?\d/i.test(n) },
    { key: 'ram', label: '4GB', value: '4gb', matchFn: (n) => extractNotebookRAM(n) === 4 },
    { key: 'ram', label: '8GB', value: '8gb', matchFn: (n) => extractNotebookRAM(n) === 8 },
    { key: 'ram', label: '16GB', value: '16gb', matchFn: (n) => extractNotebookRAM(n) === 16 },
    { key: 'ram', label: '24GB', value: '24gb', matchFn: (n) => extractNotebookRAM(n) === 24 },
    { key: 'ram', label: '32GB', value: '32gb', matchFn: (n) => extractNotebookRAM(n) === 32 },
    { key: 'screen', label: '13"', value: '13', matchFn: (n) => /13[\."]|13\s/i.test(n) },
    { key: 'screen', label: '14"', value: '14', matchFn: (n) => /14[\."]|14\s/i.test(n) },
    { key: 'screen', label: '15"', value: '15', matchFn: (n) => /15[\."]|15\s/i.test(n) },
    { key: 'screen', label: '16"', value: '16', matchFn: (n) => /16[\."]|16\s/i.test(n) },
    { key: 'gpu', label: 'GPU dedicada', value: 'dedicated_gpu', matchFn: (n) => detectNotebookGPUType(n) === 'dedicated' },
    { key: 'gpu', label: 'GPU integrada', value: 'integrated_gpu', matchFn: (n) => detectNotebookGPUType(n) === 'integrated' },
  ],
  'ups': [
    { key: 'brand', label: 'APC', value: 'APC', matchFn: (n) => /\bAPC\b/i.test(n) },
    { key: 'brand', label: 'Eaton', value: 'EATON', matchFn: (n) => /\bEATON\b/i.test(n) },
    { key: 'brand', label: 'Hikvision', value: 'HIKVISION', matchFn: (n) => /\bDS-UPS\b|\bHIKVISION\b/i.test(n) },
    { key: 'brand', label: 'CyberPower', value: 'CYBERPOWER', matchFn: (n) => /\bCYBER\s*POWER\b/i.test(n) },
    { key: 'brand', label: 'Tripp Lite', value: 'TRIPPLITE', matchFn: (n) => /\bTRIPP\s*LITE\b/i.test(n) },
    { key: 'wattage', label: 'Hasta 1000VA', value: 'upto1000', matchFn: (n) => { const m = n.match(/(\d{3,4})\s*VA/i); return m ? parseInt(m[1]) <= 1000 : false } },
    { key: 'wattage', label: '1000VA - 2000VA', value: '1000-2000', matchFn: (n) => { const m = n.match(/(\d{3,4})\s*VA/i); return m ? (parseInt(m[1]) >= 1000 && parseInt(m[1]) <= 2000) : false } },
    { key: 'wattage', label: '2000VA - 3000VA', value: '2000-3000', matchFn: (n) => { const m = n.match(/(\d{3,4})\s*VA/i); return m ? (parseInt(m[1]) >= 2000 && parseInt(m[1]) <= 3000) : false } },
    { key: 'wattage', label: '3000VA+', value: '3000plus', matchFn: (n) => { const m = n.match(/(\d{3,4})\s*VA/i); return m ? parseInt(m[1]) >= 3000 : false } },
  ],
  'memoria-ram-notebook': [
    { key: 'brand', label: 'Kingston', value: 'kingston', matchFn: (n) => /\bKINGSTON\b|\bKVR\b/i.test(n) },
    { key: 'brand', label: 'ADATA', value: 'adata', matchFn: (n) => /\bADATA\b/i.test(n) },
    { key: 'brand', label: 'Lexar', value: 'lexar', matchFn: (n) => /\bLEXAR\b/i.test(n) },
    { key: 'brand', label: 'Crucial', value: 'crucial', matchFn: (n) => /\bCRUCIAL\b/i.test(n) },
    { key: 'brand', label: 'Corsair', value: 'corsair', matchFn: (n) => /\bCORSAIR\b|\bVENGEANCE\b/i.test(n) },
    { key: 'brand', label: 'Hiksemi', value: 'hiksemi', matchFn: (n) => /\bHIKSEMI\b/i.test(n) },
    { key: 'brand', label: 'Samsung', value: 'samsung', matchFn: (n) => /\bSAMSUNG\b/i.test(n) },
    { key: 'ddr', label: 'DDR3', value: 'ddr3', matchFn: (n) => /\bDDR3\b/i.test(n) },
    { key: 'ddr', label: 'DDR4', value: 'ddr4', matchFn: (n) => /\bDDR4\b/i.test(n) },
    { key: 'ddr', label: 'DDR5', value: 'ddr5', matchFn: (n) => /\bDDR5\b/i.test(n) },
    { key: 'capacity', label: '4GB', value: '4gb', matchFn: (n) => /\b4\s*G[Bb]?\b/i.test(n) },
    { key: 'capacity', label: '8GB', value: '8gb', matchFn: (n) => /\b8\s*G[Bb]?\b/i.test(n) },
    { key: 'capacity', label: '16GB', value: '16gb', matchFn: (n) => /\b16\s*G[Bb]?\b/i.test(n) },
    { key: 'capacity', label: '24GB', value: '24gb', matchFn: (n) => /\b24\s*G[Bb]?\b/i.test(n) },
    { key: 'capacity', label: '32GB', value: '32gb', matchFn: (n) => /\b32\s*G[Bb]?\b/i.test(n) },
    { key: 'capacity', label: '48GB+', value: '48gbplus', matchFn: (n) => { const m = n.match(/\b(\d+)\s*G[Bb]?\b/i); return m ? parseInt(m[1]) >= 48 : false } },
  ],
  'fundas-mochilas': [
    { key: 'brand', label: 'Klipxtreme', value: 'KLIPXTREME', matchFn: (n) => /\bKLIPXTREME\b/i.test(n) },
    { key: 'brand', label: 'Targus', value: 'TARGUS', matchFn: (n) => /\bTARGUS\b/i.test(n) },
    { key: 'brand', label: 'Noganet', value: 'NOGANET', matchFn: (n) => /\bNOGANET\b/i.test(n) },
    { key: 'brand', label: 'Bags', value: 'BAGS', matchFn: (n) => /\bBAGS\b/i.test(n) },
    { key: 'type', label: 'Funda', value: 'FUNDA', matchFn: (n) => /\bFUNDA\b/i.test(n) },
    { key: 'type', label: 'Mochila / Bolso', value: 'MOCHILA', matchFn: (n) => /\bMOCHILA\b|\bBOLSO\b/i.test(n) },
  ],
  'micro-sd': [
    { key: 'brand', label: 'Kingston', value: 'KINGSTON', matchFn: (n) => /\bKINGSTON\b|\bCANVAS\b/i.test(n) },
    { key: 'brand', label: 'Hiksemi', value: 'HIKSEMI', matchFn: (n) => /\bHIKSEMI\b/i.test(n) },
    { key: 'brand', label: 'SanDisk', value: 'SANDISK', matchFn: (n) => /\bSANDISK\b/i.test(n) },
    { key: 'brand', label: 'Samsung', value: 'SAMSUNG', matchFn: (n) => /\bSAMSUNG\b|\bEVO\b/i.test(n) && !/\bMONITOR\b/i.test(n) },
    { key: 'brand', label: 'Lexar', value: 'LEXAR', matchFn: (n) => /\bLEXAR\b/i.test(n) },
    { key: 'capacity', label: '32GB', value: '32gb', matchFn: (n) => /\b32\s*G[Bb]?\b/i.test(n) },
    { key: 'capacity', label: '64GB', value: '64gb', matchFn: (n) => /\b64\s*G[Bb]?\b/i.test(n) },
    { key: 'capacity', label: '128GB', value: '128gb', matchFn: (n) => /\b128\s*G[Bb]?\b/i.test(n) },
    { key: 'capacity', label: '256GB', value: '256gb', matchFn: (n) => /\b256\s*G[Bb]?\b/i.test(n) },
    { key: 'capacity', label: '512GB+', value: '512gbplus', matchFn: (n) => { const m = n.match(/\b(\d+)\s*G[Bb]?\b/i); return m ? parseInt(m[1]) >= 512 : false } },
  ],
  'hogar-inteligente': [
    { key: 'brand', label: 'EZVIZ', value: 'EZVIZ', matchFn: (n) => /\bEZVIZ\b/i.test(n) },
    { key: 'brand', label: 'TP-Link', value: 'TPLINK', matchFn: (n) => /\bTP[\s\-]?LINK\b|\bTAPO\b/i.test(n) },
    { key: 'brand', label: 'Hikvision', value: 'HIKVISION', matchFn: (n) => /\bHIKVISION\b/i.test(n) },
    { key: 'brand', label: 'Xiaomi', value: 'XIAOMI', matchFn: (n) => /\bXIAOMI\b|\bROBOROCK\b/i.test(n) },
    { key: 'type', label: 'Cámara', value: 'CAMARA', matchFn: (n) => /\bCAMARA\b|\bCAMÁRA\b|\bIP\s*CAM\b|\bCÁMARA\b/i.test(n) },
    { key: 'type', label: 'Alarma / Sensor', value: 'ALARMA', matchFn: (n) => /\bALARMA\b|\bSENSOR\b|\bDETECTOR\b/i.test(n) },
    { key: 'type', label: 'Cerradura', value: 'CERRADURA', matchFn: (n) => /\bCERRADURA\b/i.test(n) },
    { key: 'type', label: 'Aspiradora Robot', value: 'ROBOT', matchFn: (n) => /\bASPIRADORA\b|\bROBOT\b/i.test(n) },
  ],
  'joysticks': [
    { key: 'brand', label: 'Redragon', value: 'REDRAGON', matchFn: (n) => /\bREDRAGON\b/i.test(n) },
    { key: 'brand', label: 'Genius', value: 'GENIUS', matchFn: (n) => /\bGENIUS\b|\bGX-/i.test(n) },
    { key: 'brand', label: 'Cooler Master', value: 'COOLERMASTER', matchFn: (n) => /\bCOOLER\s*MASTER\b/i.test(n) },
    { key: 'brand', label: 'Raptor', value: 'RAPTOR', matchFn: (n) => /\bRAPTOR\b/i.test(n) },
    { key: 'brand', label: 'Logitech', value: 'LOGITECH', matchFn: (n) => /\bLOGITECH\b|\bF710\b/i.test(n) },
    { key: 'brand', label: 'Microsoft', value: 'MICROSOFT', matchFn: (n) => /\bMICROSOFT\b|\bXBOX\b/i.test(n) },
    { key: 'brand', label: 'Sony', value: 'SONY', matchFn: (n) => /\bSONY\b|\bDUALSHOCK\b|\bDUALSENSE\b|\bPS[45]\b/i.test(n) },
    { key: 'brand', label: 'Noganet', value: 'NOGANET', matchFn: (n) => /\bNOGANET\b|\bXO-/i.test(n) },
  ],
  'cargadores': [
    { key: 'brand', label: 'Dell', value: 'DELL', matchFn: (n) => /\bDELL\b/i.test(n) },
    { key: 'brand', label: 'HP', value: 'HP', matchFn: (n) => /\bHP\b/i.test(n) },
    { key: 'brand', label: 'Lenovo', value: 'LENOVO', matchFn: (n) => /\bLENOVO\b/i.test(n) },
    { key: 'brand', label: 'Performance', value: 'PERFORMANCE', matchFn: (n) => /\bPERFORMANCE\b/i.test(n) },
    { key: 'brand', label: 'Noganet', value: 'NOGANET', matchFn: (n) => /\bNOGANET\b|\bXO-/i.test(n) },
    { key: 'brand', label: 'Motorola', value: 'MOTOROLA', matchFn: (n) => /\bMOTOROLA\b/i.test(n) },
    { key: 'type', label: 'Notebook', value: 'NOTEBOOK', matchFn: (n) => /\bNOTEBOOK\b|\bLAPTOP\b|\b19V\b|\b20V\b|\b45W\b|\b65W\b|\b90W\b/i.test(n) && !/\bCELULAR\b|\bPHONE\b/i.test(n) },
    { key: 'type', label: 'Celular / USB', value: 'CELULAR', matchFn: (n) => /\bCELULAR\b|\bPHONE\b|\bUSB[\s\-]?C\b|\bPOWER\s*BANK\b|\bPORTABLE\b|\bMAH\b/i.test(n) },
    { key: 'type', label: 'Fuente / Alimentación', value: 'FUENTE', matchFn: (n) => /\bFUENTE\b|\bALIMENTACION\b|\b12V\b|\b5V\b/i.test(n) },
  ],
  'sillas-gamer': [
    { key: 'brand', label: 'Cooler Master', value: 'COOLERMASTER', matchFn: (n) => /\bCOOLER\s*MASTER\b|\bCALIBER\b/i.test(n) },
    { key: 'brand', label: 'XPG', value: 'XPG', matchFn: (n) => /\bXPG\b|\bNEXUS\b/i.test(n) },
    { key: 'brand', label: 'Raptor', value: 'RAPTOR', matchFn: (n) => /\bRAPTOR\b/i.test(n) },
    { key: 'brand', label: 'Syx', value: 'SYX', matchFn: (n) => /\bSYX\b/i.test(n) },
    { key: 'brand', label: 'Thronos', value: 'THRONOS', matchFn: (n) => /\bTHRONOS\b/i.test(n) },
  ],
  'soportes-y-brazos': [
    { key: 'brand', label: 'Teros', value: 'TEROS', matchFn: (n) => /\bTEROS\b/i.test(n) },
    { key: 'brand', label: 'Klipxtreme', value: 'KLIPXTREME', matchFn: (n) => /\bKLIPXTREME\b/i.test(n) },
    { key: 'brand', label: 'Intelaid', value: 'INTELAID', matchFn: (n) => /\bINTELAID\b/i.test(n) },
    { key: 'brand', label: 'Genius', value: 'GENIUS', matchFn: (n) => /\bGENIUS\b/i.test(n) },
    { key: 'brand', label: 'Furukawa', value: 'FURUKAWA', matchFn: (n) => /\bFURUKAWA\b/i.test(n) },
    { key: 'type', label: 'Soporte Monitor / Brazo', value: 'MONITOR', matchFn: (n) => /\bMONITOR\b|\bBRAZO\b|\bARTICULADO\b/i.test(n) },
    { key: 'type', label: 'Soporte TV / Pared', value: 'TV', matchFn: (n) => /\bTV\b|\bPARED\b|\bTECHO\b|\bSOBRE\b/i.test(n) },
    { key: 'type', label: 'Soporte Notebook / Tablet', value: 'NOTEBOOK', matchFn: (n) => /\bNB\b|\bNOTEBOOK\b|\bTABLET\b|\bLAPTOP\b|\bSTAND\b/i.test(n) },
  ],
  'mousepads': [
    { key: 'brand', label: 'Razer', value: 'RAZER', matchFn: (n) => /\bRAZER\b|\bGIGANTUS\b/i.test(n) },
    { key: 'brand', label: 'Logitech', value: 'LOGITECH', matchFn: (n) => /\bLOGITECH\b/i.test(n) },
    { key: 'brand', label: 'Raptor', value: 'RAPTOR', matchFn: (n) => /\bRAPTOR\b/i.test(n) },
    { key: 'brand', label: 'Corsair', value: 'CORSAIR', matchFn: (n) => /\bCORSAIR\b/i.test(n) },
  ],
  'kits-gamer': [
    { key: 'brand', label: 'Logitech', value: 'LOGITECH', matchFn: (n) => /\bLOGITECH\b/i.test(n) },
    { key: 'brand', label: 'Genius', value: 'GENIUS', matchFn: (n) => /\bGENIUS\b|\bSLIMSTAR\b|\bKM-/i.test(n) },
    { key: 'brand', label: 'Kelyx', value: 'KELYX', matchFn: (n) => /\bKELYX\b/i.test(n) },
    { key: 'brand', label: 'Redragon', value: 'REDRAGON', matchFn: (n) => /\bREDRAGON\b/i.test(n) },
  ],
  'microfonos': [
    { key: 'brand', label: 'HyperX', value: 'HYPERX', matchFn: (n) => /\bHYPERX\b|\bQUADCAST\b/i.test(n) },
    { key: 'brand', label: 'Logitech', value: 'LOGITECH', matchFn: (n) => /\bLOGITECH\b|\bYETI\b/i.test(n) },
    { key: 'brand', label: 'Razer', value: 'RAZER', matchFn: (n) => /\bRAZER\b/i.test(n) },
    { key: 'brand', label: 'JBL', value: 'JBL', matchFn: (n) => /\bJBL\b|\bQUANTUM\b/i.test(n) },
    { key: 'brand', label: 'ASUS', value: 'ASUS', matchFn: (n) => /\bASUS\b|\bROG\b|\bCARNYX\b/i.test(n) },
    { key: 'brand', label: 'Genius', value: 'GENIUS', matchFn: (n) => /\bGENIUS\b/i.test(n) },
    { key: 'brand', label: 'Raptor', value: 'RAPTOR', matchFn: (n) => /\bRAPTOR\b/i.test(n) },
  ],
  'tablets': [
    { key: 'brand', label: 'Lenovo', value: 'LENOVO', matchFn: (n) => /\bLENOVO\b|\bIDEA\s*TAB\b|\bTAB\b/i.test(n) },
    { key: 'brand', label: 'CX', value: 'CX', matchFn: (n) => /\bCX\b/i.test(n) },
    { key: 'brand', label: 'Samsung', value: 'SAMSUNG', matchFn: (n) => /\bSAMSUNG\b|\bGALAXY\s*TAB\b/i.test(n) },
    { key: 'brand', label: 'Genius', value: 'GENIUS', matchFn: (n) => /\bGENIUS\b|\bEASYPEN\b/i.test(n) },
  ],
  'escaneres': [
    { key: 'brand', label: 'Brother', value: 'BROTHER', matchFn: (n) => /\bBROTHER\b/i.test(n) },
    { key: 'brand', label: 'HP', value: 'HP', matchFn: (n) => /\bHP\b|\bSCANJET\b/i.test(n) },
    { key: 'brand', label: 'Epson', value: 'EPSON', matchFn: (n) => /\bEPSON\b|\bPERFECTION\b/i.test(n) },
    { key: 'brand', label: 'Fujitsu', value: 'FUJITSU', matchFn: (n) => /\bFUJITSU\b|\bFI-/i.test(n) },
    { key: 'type', label: 'Escáner de escritorio', value: 'ESCRITORIO', matchFn: (n) => !/\bPORT[ÁA]TIL\b|\bMOBILE\b|\bDS-/i.test(n) },
    { key: 'type', label: 'Portátil', value: 'PORTATIL', matchFn: (n) => /\bPORT[ÁA]TIL\b|\bMOBILE\b|\bDS-/i.test(n) },
  ],
  'nas': [
    { key: 'brand', label: 'Asustor', value: 'ASUSTOR', matchFn: (n) => /\bASUSTOR\b/i.test(n) },
    { key: 'brand', label: 'QNAP', value: 'QNAP', matchFn: (n) => /\bQNAP\b/i.test(n) },
    { key: 'brand', label: 'Synology', value: 'SYNOLOGY', matchFn: (n) => /\bSYNOLOGY\b/i.test(n) },
    { key: 'type', label: '2 Bahías', value: '2BAY', matchFn: (n) => /\b2\s*X?\s*3\.5\b|\b2\s*BAH[ÍI]A/i.test(n) },
    { key: 'type', label: '4 Bahías', value: '4BAY', matchFn: (n) => /\b4\s*X?\s*3\.5\b|\b4\s*BAH[ÍI]A/i.test(n) },
  ],
  'pc-armadas': [
    // Tipo de PC — Gamer detection includes: RTX/GTX, VGA/V-prefix, GT models, gaming brands
    { key: 'type', label: 'Gamer', value: 'gamer', matchFn: (n) => isPcArmadasGamer(n) },
    { key: 'type', label: 'Oficina', value: 'oficina', matchFn: (n) => !isPcArmadasGamer(n) && !/\bMINI PC\b|\bSTICK PC\b|\bNUC\b|\bMELE\b|\bN100\b|\bAIO\b|\bALL[- ]?IN[- ]?ONE\b|\bDESIGN\b|\bDISE[ÑN]O\b|\bCREATOR\b|\bSTUDIO\b/i.test(n) && /\bSIST\.\b|\bKELYX\b|\bOFFICE\b|\bOFICINA\b|\bPC\b|\bCOMPUTADORA\b|\bDESKTOP\b/i.test(n) },
    { key: 'type', label: 'Diseño', value: 'diseno', matchFn: (n) => /\bDESIGN\b|\bDISE[ÑN]O\b|\bCREATOR\b|\bSTUDIO\b/i.test(n) },
    { key: 'type', label: 'Mini PC', value: 'mini_pc', matchFn: (n) => /\bMINI PC\b|\bSTICK PC\b|\bNUC\b|\bMELE\b|\bN100\b/i.test(n) },
    { key: 'type', label: 'All in One', value: 'aio', matchFn: (n) => /\bAIO\b|\bALL[- ]?IN[- ]?ONE\b/i.test(n) },
    // Marca
    { key: 'brand', label: 'HP', value: 'hp', matchFn: (n) => /\bHP\b|\bZ1G\b|\bZ2G\b|\bOMEN\b|\bVICTUS\b|\bELITEDESK\b|\bPRODESK\b/i.test(n) },
    { key: 'brand', label: 'Lenovo', value: 'lenovo', matchFn: (n) => /\bLENOVO\b|\bTHINKCENTRE\b|\bIDEACENTRE\b|\bLEGION\b|\bLOQ\b/i.test(n) },
    { key: 'brand', label: 'Dell', value: 'dell', matchFn: (n) => /\bDELL\b|\bINSPIRON\b|\bOPTIPLEX\b|\bALIENWARE\b/i.test(n) },
    { key: 'brand', label: 'CX', value: 'cx', matchFn: (n) => /\bCX\b/i.test(n) },
    { key: 'brand', label: 'Gamemax', value: 'gamemax', matchFn: (n) => /\bGAMEMAX\b/i.test(n) },
    { key: 'brand', label: 'Kelyx', value: 'kelyx', matchFn: (n) => /\bKELYX\b/i.test(n) },
    { key: 'brand', label: 'ASUS', value: 'asus', matchFn: (n) => /\bASUS\b|\bROG\b|\bTUF\b|\bPN\d/i.test(n) },
    { key: 'brand', label: 'Intel', value: 'intel', matchFn: (n) => /\bINTEL\b|\bNUC\b/i.test(n) },
    // Procesador
    { key: 'processor', label: 'Core i9 / Ultra 9', value: 'i9', matchFn: (n) => /\bI9\b|\bCORE\s*9\b|\bCORE\s*ULTRA\s*9\b/i.test(n) },
    { key: 'processor', label: 'Core i7 / Ultra 7', value: 'i7', matchFn: (n) => /\bI7\b|\bCORE\s*7\b|\bCORE\s*ULTRA\s*7\b|\bU7[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Core i5 / Ultra 5', value: 'i5', matchFn: (n) => /\bI5\b|\bCORE\s*5\b|\bCORE\s*ULTRA\s*5\b|\bC5[- ]?\d|\bU5[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Core i3', value: 'i3', matchFn: (n) => /\bI3\b|\bCORE\s*3\b|\bC3[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Celeron / Pentium', value: 'celeron', matchFn: (n) => /\bCELERON\b|\bPENTIUM\b/i.test(n) },
    { key: 'processor', label: 'Intel N-Series', value: 'intel_n', matchFn: (n) => /\bN100\b|\bN305\b|\bN5030\b/i.test(n) },
    { key: 'processor', label: 'Ryzen 9', value: 'r9', matchFn: (n) => /\bRYZEN\s*9\b|\bR9[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Ryzen 7', value: 'r7', matchFn: (n) => /\bRYZEN\s*7\b|\bR7[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Ryzen 5', value: 'r5', matchFn: (n) => /\bRYZEN\s*5\b|\bR5[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Ryzen 3', value: 'r3', matchFn: (n) => /\bRYZEN\s*3\b|\bR3[- ]?\d/i.test(n) },
    // RAM
    { key: 'ram', label: '4GB', value: '4gb', matchFn: (n) => extractNotebookRAM(n) === 4 },
    { key: 'ram', label: '8GB', value: '8gb', matchFn: (n) => extractNotebookRAM(n) === 8 },
    { key: 'ram', label: '16GB', value: '16gb', matchFn: (n) => extractNotebookRAM(n) === 16 },
    { key: 'ram', label: '24GB', value: '24gb', matchFn: (n) => extractNotebookRAM(n) === 24 },
    { key: 'ram', label: '32GB', value: '32gb', matchFn: (n) => extractNotebookRAM(n) === 32 },
    // GPU
    { key: 'gpu', label: 'GPU dedicada', value: 'dedicated_gpu', matchFn: (n) => detectNotebookGPUType(n) === 'dedicated' },
    { key: 'gpu', label: 'GPU integrada', value: 'integrated_gpu', matchFn: (n) => detectNotebookGPUType(n) === 'integrated' },
  ],
  'smarts-tv': [
    { key: 'brand', label: 'Philips', value: 'PHILIPS', matchFn: (n) => /\bPHILIPS\b/i.test(n) },
    { key: 'brand', label: 'Samsung', value: 'SAMSUNG', matchFn: (n) => /\bSAMSUNG\b/i.test(n) },
    { key: 'brand', label: 'LG', value: 'LG', matchFn: (n) => /\bLG\b/i.test(n) },
    { key: 'size', label: '32"', value: '32', matchFn: (n) => /\b32\b/i.test(n) },
    { key: 'size', label: '43"', value: '43', matchFn: (n) => /\b43\b/i.test(n) },
    { key: 'size', label: '50"', value: '50', matchFn: (n) => /\b50\b/i.test(n) },
    { key: 'size', label: '55"', value: '55', matchFn: (n) => /\b55\b/i.test(n) },
    { key: 'size', label: '65"+', value: '65', matchFn: (n) => /\b6[5-9]\b|\b7[0-9]\b/i.test(n) },
    { key: 'resolution', label: 'HD', value: 'HD', matchFn: (n) => /\bHD\b/i.test(n) && !/\bFULL\s*HD\b|\bFHD\b|\b4K\b|\bUHD\b|\bQHD\b/i.test(n) },
    { key: 'resolution', label: 'Full HD', value: 'FHD', matchFn: (n) => /\bFULL\s*HD\b|\bFHD\b|\b1080\b/i.test(n) },
    { key: 'resolution', label: '4K / UHD', value: '4K', matchFn: (n) => /\b4K\b|\bUHD\b|\b2160\b/i.test(n) },
  ],
  'bases': [
    { key: 'brand', label: 'Dell', value: 'DELL', matchFn: (n) => /\bDELL\b|\bDOCKING\b/i.test(n) },
    { key: 'brand', label: 'X-tech', value: 'XTECH', matchFn: (n) => /\bX[\s\-]?TECH\b/i.test(n) },
    { key: 'brand', label: 'Noganet', value: 'NOGANET', matchFn: (n) => /\bNOGANET\b|\bXO-/i.test(n) },
  ],
  'escritorios': [
    { key: 'brand', label: 'X-tech', value: 'XTECH', matchFn: (n) => /\bX[\s\-]?TECH\b/i.test(n) },
  ],
  'pastas-termicas': [
    { key: 'brand', label: 'Cooler Master', value: 'COOLERMASTER', matchFn: (n) => /\bCOOLER\s*MASTER\b|\bMASTERGEL\b/i.test(n) },
    { key: 'brand', label: 'Gamemax', value: 'GAMEMAX', matchFn: (n) => /\bGAMEMAX\b|\bTG3\b/i.test(n) },
    { key: 'brand', label: 'Arctic', value: 'ARCTIC', matchFn: (n) => /\bARCTIC\b|\bMX-/i.test(n) },
    { key: 'brand', label: 'Noctua', value: 'NOCTUA', matchFn: (n) => /\bNOCTUA\b|\bNT-H/i.test(n) },
  ],
  'sistema-continuo': [
    { key: 'brand', label: 'HP', value: 'HP', matchFn: (n) => /\bHP\b|\bSMART\s*TANK\b/i.test(n) },
    { key: 'brand', label: 'Brother', value: 'BROTHER', matchFn: (n) => /\bBROTHER\b|\bMF\b/i.test(n) },
    { key: 'brand', label: 'Epson', value: 'EPSON', matchFn: (n) => /\bEPSON\b|\bECOTANK\b/i.test(n) },
    { key: 'brand', label: 'Canon', value: 'CANON', matchFn: (n) => /\bCANON\b|\bPIXMA\b/i.test(n) },
    { key: 'type', label: 'Multifunción', value: 'MULTIFUNCION', matchFn: (n) => /\bMULTIFUNCION\b|\bMF\b|\bTODO\s*EN\s*UNO\b/i.test(n) },
    { key: 'type', label: 'Impresora sola', value: 'IMPRESORA', matchFn: (n) => /\bIMPRESORA\b/i.test(n) && !/\bMULTIFUNCION\b|\bMF\b|\bTODO\s*EN\s*UNO\b/i.test(n) },
  ],
  'gabinete-con-fuente': [
    { key: 'brand', label: 'Raptor', value: 'RAPTOR', matchFn: (n) => /\bRAPTOR\b|\bVOLT\b/i.test(n) },
    { key: 'brand', label: 'Kelyx', value: 'KELYX', matchFn: (n) => /\bKELYX\b/i.test(n) },
    { key: 'brand', label: 'Teros', value: 'TEROS', matchFn: (n) => /\bTEROS\b/i.test(n) },
    { key: 'brand', label: 'Cromax', value: 'CROMAX', matchFn: (n) => /\bCROMAX\b/i.test(n) },
    { key: 'brand', label: 'E-View', value: 'EVIEW', matchFn: (n) => /\bE[\s\-]?VIEW\b/i.test(n) },
    { key: 'brand', label: 'Gamemax', value: 'GAMEMAX', matchFn: (n) => /\bGAMEMAX\b/i.test(n) },
  ],
  'gamer-y-diseno': [
    { key: 'brand', label: 'HP', value: 'hp', matchFn: (n) => /\bHP\b|\bOMEN\b|\bVICTUS\b|\bZBOOK\b/i.test(n) },
    { key: 'brand', label: 'Lenovo', value: 'lenovo', matchFn: (n) => /\bLENOVO\b|\bLEGION\b|\bLOQ\b/i.test(n) },
    { key: 'brand', label: 'MSI', value: 'msi', matchFn: (n) => /\bMSI\b|\bKATANA\b|\bCROSSHAIR\b|\bCYBORG\b|\bGF\d/i.test(n) },
    { key: 'brand', label: 'Dell', value: 'dell', matchFn: (n) => /\bDELL\b|\bALIENWARE\b/i.test(n) },
    { key: 'brand', label: 'Asus', value: 'asus', matchFn: (n) => /\bASUS\b|\bROG\b|\bTUF\b/i.test(n) },
    { key: 'brand', label: 'Acer', value: 'acer', matchFn: (n) => /\bACER\b|\bNITRO\b|\bPREDATOR\b|\bASPIRE\b/i.test(n) },
    { key: 'processor', label: 'Core i9 / Ultra 9', value: 'i9', matchFn: (n) => /\bI9\b|\bCORE\s*9\b|\bCORE\s*ULTRA\s*9\b/i.test(n) },
    { key: 'processor', label: 'Core i7 / Ultra 7', value: 'i7', matchFn: (n) => /\bI7\b|\bCORE\s*7\b|\bCORE\s*ULTRA\s*7\b|\bU7[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Core i5 / Ultra 5', value: 'i5', matchFn: (n) => /\bI5\b|\bCORE\s*5\b|\bCORE\s*ULTRA\s*5\b|\bC5[- ]?\d|\bU5[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Core i3', value: 'i3', matchFn: (n) => /\bI3\b|\bCORE\s*3\b|\bC3[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Celeron / Pentium', value: 'celeron', matchFn: (n) => /\bCELERON\b|\bPENTIUM\b/i.test(n) },
    { key: 'processor', label: 'Intel N-Series', value: 'intel_n', matchFn: (n) => /\bN100\b|\bN305\b|\bN5030\b/i.test(n) },
    { key: 'processor', label: 'Ryzen 9', value: 'r9', matchFn: (n) => /\bRYZEN\s*9\b|\bR9[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Ryzen 7', value: 'r7', matchFn: (n) => /\bRYZEN\s*7\b|\bR7[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Ryzen 5', value: 'r5', matchFn: (n) => /\bRYZEN\s*5\b|\bR5[- ]?\d/i.test(n) },
    { key: 'processor', label: 'Ryzen 3', value: 'r3', matchFn: (n) => /\bRYZEN\s*3\b|\bR3[- ]?\d/i.test(n) },
    { key: 'ram', label: '8GB', value: '8gb', matchFn: (n) => extractNotebookRAM(n) === 8 },
    { key: 'ram', label: '16GB', value: '16gb', matchFn: (n) => extractNotebookRAM(n) === 16 },
    { key: 'ram', label: '24GB', value: '24gb', matchFn: (n) => extractNotebookRAM(n) === 24 },
    { key: 'ram', label: '32GB', value: '32gb', matchFn: (n) => extractNotebookRAM(n) === 32 },
    { key: 'screen', label: '15"', value: '15', matchFn: (n) => /15[\."]|15\s/i.test(n) },
    { key: 'screen', label: '16"', value: '16', matchFn: (n) => /16[\."]|16\s/i.test(n) },
    { key: 'gpu', label: 'RTX 5060', value: 'rtx5060', matchFn: (n) => /RTX\s*5060/i.test(n) },
    { key: 'gpu', label: 'RTX 5050', value: 'rtx5050', matchFn: (n) => /RTX\s*5050/i.test(n) },
    { key: 'gpu', label: 'RTX 4050', value: 'rtx4050', matchFn: (n) => /RTX\s*4050/i.test(n) },
    { key: 'gpu', label: 'RTX 3050', value: 'rtx3050', matchFn: (n) => /RTX\s*3050/i.test(n) },
    { key: 'gpu', label: 'RTX 1000/2000', value: 'rtx1000-2000', matchFn: (n) => /RTX\s*(1000|2000)/i.test(n) },
    { key: 'gpu', label: 'Radeon RX', value: 'radeon_rx', matchFn: (n) => /RADEON\s*RX\s*\d{4}/i.test(n) },
    { key: 'gpu', label: 'Otras dedicadas', value: 'other_gpu', matchFn: (n) => detectNotebookGPUType(n) === 'dedicated' && !/RTX\s*(5060|5050|4050|3050|1000|2000)/i.test(n) && !/RADEON\s*RX\s*\d{4}/i.test(n) },
  ],
}

const FILTER_GROUP_LABELS: Record<string, string> = {
  brand: 'Marca',
  socket: 'Socket',
  ddr: 'Memoria',
  type: 'Tipo',
  wattage: 'Potencia',
  size: 'Tamaño',
  resolution: 'Resolución',
  hz: 'Frecuencia',
  capacity: 'Capacidad',
  vram: 'VRAM',
  series: 'Serie',
  processor: 'Procesador',
  ram: 'RAM',
  screen: 'Pantalla',
  gpu: 'Placa de Video',
}

/**
 * Extract the primary storage capacity in GB from a product name.
 * Handles patterns like: 1TB, 1 TB, 2TB, 256GB, 480GB, 960GB, 1.92TB, etc.
 * Returns null if no recognizable storage capacity found.
 */
function extractCapacityGB(name: string): number | null {
  // Normalize: replace commas with dots for decimal values
  // Also add space before TB/GB if missing (e.g. "SSD1TB" -> "SSD 1TB")
  const n = name.replace(/,/g, '.').replace(/(SSD|HDD|DISCO)(\d)/gi, '$1 $2')
  
  // Try TB patterns first (more specific)
  // Match: 1TB, 1 TB, 1.92TB, 1.92 TB, 1T (when followed by space/end for short forms)
  const tbMatch = n.match(/\b(\d+\.?\d*)\s*TB?\b/i)
  if (tbMatch) {
    const val = parseFloat(tbMatch[1])
    // Sanity check: TB values should be between 0.1 and 100
    if (val >= 0.1 && val <= 100) return val * 1000
  }
  
  // Try GB patterns
  // Match: 256GB, 256 GB, 512GB, 960GB, 480GB, etc.
  // Avoid matching speed values like "6.0GB/S" or "6GBPS"
  const gbMatch = n.match(/\b(\d{2,4})\s*GB(?!\s*[\/PS])/i)
  if (gbMatch) {
    const val = parseInt(gbMatch[1])
    // Sanity check: GB values for storage should be between 32 and 16384
    if (val >= 32 && val <= 16384) return val
  }
  
  return null
}

/**
 * Apply category keyword filters to a product list.
 * AND between groups, OR within the same group.
 */
function applyCategoryFilters(products: ProductItem[], filters: Record<string, string[]>, categorySlug: string, dynamicBrandOptions?: CategoryFilterOption[]): ProductItem[] {
  const filterOptions = CATEGORY_FILTERS[categorySlug]
  // Combine hardcoded non-brand filters with dynamic brand options
  const allOptions: CategoryFilterOption[] = [
    ...(filterOptions || []).filter(o => o.key !== 'brand'),
    ...(dynamicBrandOptions || []),
  ]
  if (allOptions.length === 0) return products

  const activeGroups = new Map<string, CategoryFilterOption[]>()
  for (const [key, values] of Object.entries(filters)) {
    if (values.length === 0) continue
    const matching = allOptions.filter(o => o.key === key && values.includes(o.value))
    if (matching.length > 0) activeGroups.set(key, matching)
  }

  if (activeGroups.size === 0) return products

  return products.filter(product => {
    for (const [, options] of activeGroups) {
      const matchesGroup = options.some(opt => {
        // If product has explicit tags, use tag matching first
        if (product.tags && product.tags.length > 0) {
          return product.tags.includes(opt.value)
        }
        // Fallback to regex name matching for products without tags
        return opt.matchFn(product.name, product)
      })
      if (!matchesGroup) return false
    }
    return true
  })
}

interface Props {
  products: ProductItem[]
  subcategories: Subcategory[]
  currentCategory: { id: string; name: string; slug: string } | null
  parentCategory: { id: string; name: string; slug: string } | null
  categorySlug: string
  categoryName: string
  searchQuery: string | null
}

type SortOption = 'newest' | 'price-asc' | 'price-desc' | 'name-az'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Más recientes' },
  { value: 'price-asc', label: 'Precio: menor a mayor' },
  { value: 'price-desc', label: 'Precio: mayor a menor' },
  { value: 'name-az', label: 'Nombre A-Z' },
]

const parsePriceInput = (val: string): number | null => {
  const cleaned = val.replace(/[^0-9]/g, '')
  return cleaned ? parseInt(cleaned, 10) : null
}

export default function CategoryProducts({
  products,
  subcategories,
  currentCategory,
  parentCategory,
  categorySlug,
  categoryName,
  searchQuery,
}: Props) {
  const [sort, setSort] = useState<SortOption>('price-asc')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [onlyInStock, setOnlyInStock] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [categoryFilters, setCategoryFilters] = useState<Record<string, string[]>>({})
  // Paginación client-side (sesion 43): 50 productos por página para no recargar
  // la UI con cientos de tarjetas de golpe. Las queries siguen trayendo todos los
  // productos de la categoría (cacheados 5 min por revalidate=300), pero el
  // renderizado es por página.
  const PRODUCTS_PER_PAGE = 50
  const [currentPage, setCurrentPage] = useState(1)

  const hasCategoryFilters = Object.values(categoryFilters).some(v => v.length > 0)
  const hasActiveFilters = priceMin !== '' || priceMax !== '' || onlyInStock || hasCategoryFilters

  // Determine which slug to use for filters: prefer current slug, fall back to parent slug
  // This ensures subcategories (e.g. gamer-mon) inherit parent (monitores) filters
  const filterSlug = (CATEGORY_FILTERS[categorySlug] && CATEGORY_FILTERS[categorySlug].length > 0)
    ? categorySlug
    : (parentCategory?.slug && CATEGORY_FILTERS[parentCategory.slug]?.length > 0)
      ? parentCategory.slug
      : categorySlug

  // Get filter groups for current category
  // Non-brand filters remain hardcoded; brand filters are generated dynamically from brandId
  // EXCEPTION: categories in HARDCODED_BRAND_CATEGORIES use hardcoded brand filters (to avoid
  // Intel/AMD appearing as notebook manufacturers, etc.)
  const HARDCODED_BRAND_CATEGORIES = new Set(['notebooks', 'gamer-y-diseno', 'pc-armadas'])
  const currentCategoryFilterOptions = CATEGORY_FILTERS[filterSlug] || []
  const useHardcodedBrands = HARDCODED_BRAND_CATEGORIES.has(filterSlug)
  const filterGroups = useMemo(() => {
    const groups: { key: string; label: string; options: CategoryFilterOption[] }[] = []
    const keyMap = new Map<string, CategoryFilterOption[]>()

    // 1. Add non-brand hardcoded filters (always)
    for (const opt of currentCategoryFilterOptions) {
      if (opt.key === 'brand') {
        // For categories that need hardcoded brands (notebooks, gamer-y-diseno, pc-armadas),
        // use the hardcoded brand filters instead of dynamic ones
        if (useHardcodedBrands) {
          if (!keyMap.has(opt.key)) keyMap.set(opt.key, [])
          keyMap.get(opt.key)!.push(opt)
        }
        continue
      }
      if (!keyMap.has(opt.key)) keyMap.set(opt.key, [])
      keyMap.get(opt.key)!.push(opt)
    }

    // 2. Generate dynamic brand filters from product brandId/brandName
    // Only for categories NOT in HARDCODED_BRAND_CATEGORIES
    if (!useHardcodedBrands) {
      const brandMap = new Map<string, { id: string; name: string; count: number }>()
      for (const p of products) {
        if (!p.brandId || !p.brandName) continue
        if (!brandMap.has(p.brandId)) {
          brandMap.set(p.brandId, { id: p.brandId, name: p.brandName, count: 0 })
        }
        brandMap.get(p.brandId)!.count++
      }

    // Sort brands by product count (most products first) then alphabetically
    const sortedBrands = [...brandMap.values()].sort((a, b) =>
      b.count - a.count || a.name.localeCompare(b.name)
    )

    const brandOptions: CategoryFilterOption[] = sortedBrands.map(brand => ({
      key: 'brand',
      label: brand.name,
      value: brand.id, // Use brandId as filter value
      matchFn: (_name: string, product?: ProductItem) => {
        // Match by brandId instead of regex - much more accurate!
        return product?.brandId === brand.id
      },
    }))

    if (brandOptions.length > 0) {
      keyMap.set('brand', brandOptions)
    }
    } // end if (!useHardcodedBrands)

    // Build groups in a stable order (brand first, then others)
    const orderedKeys: string[] = []
    if (keyMap.has('brand')) orderedKeys.push('brand')
    for (const key of keyMap.keys()) {
      if (key !== 'brand') orderedKeys.push(key)
    }

    for (const key of orderedKeys) {
      const options = keyMap.get(key)!
      groups.push({ key, label: FILTER_GROUP_LABELS[key] || key, options })
    }
    return groups
  }, [currentCategoryFilterOptions.length, filterSlug, products, useHardcodedBrands])

  const setCategoryFilter = (key: string, value: string) => {
    setCategoryFilters(prev => {
      if (value === '') {
        const { [key]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [key]: [value] }
    })
  }

  const clearAllFilters = () => {
    setPriceMin('')
    setPriceMax('')
    setOnlyInStock(false)
    setCategoryFilters({})
  }

  const filteredAndSorted = useMemo(() => {
    let result = [...products]

    // Category keyword filters (brand, DDR, socket, etc.)
    result = applyCategoryFilters(result, categoryFilters, filterSlug, filterGroups.find(g => g.key === 'brand')?.options)

    // Price filter
    const min = parsePriceInput(priceMin)
    const max = parsePriceInput(priceMax)
    if (min !== null) {
      result = result.filter((p) => (p.comparePrice ?? p.price) >= min)
    }
    if (max !== null) {
      result = result.filter((p) => (p.comparePrice ?? p.price) <= max)
    }

    // Stock filter
    if (onlyInStock) {
      result = result.filter((p) => p.stock > 0)
    }

    // Sort
    switch (sort) {
      case 'newest':
        result.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return dateB - dateA
        })
        break
      case 'price-asc':
        result.sort((a, b) => (a.comparePrice ?? a.price) - (b.comparePrice ?? b.price))
        break
      case 'price-desc':
        result.sort((a, b) => (b.comparePrice ?? b.price) - (a.comparePrice ?? a.price))
        break
      case 'name-az':
        result.sort((a, b) => a.name.localeCompare(b.name, 'es'))
        break
    }

    return result
  }, [products, sort, priceMin, priceMax, onlyInStock, categoryFilters, filterSlug])

  // Reset a página 1 cuando cambian filtros, orden o la categoría misma.
  // Sin esto, si estás en página 5 y aplicás un filtro que deja 20 resultados,
  // la página 5 queda vacía y el usuario ve "no hay productos".
  useEffect(() => {
    setCurrentPage(1)
  }, [sort, priceMin, priceMax, onlyInStock, categoryFilters, categorySlug])

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PRODUCTS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pagedProducts = filteredAndSorted.slice(
    (safeCurrentPage - 1) * PRODUCTS_PER_PAGE,
    safeCurrentPage * PRODUCTS_PER_PAGE
  )

  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{categoryName}</h1>
          {searchQuery && (
            <a
              href={`/categoria/${categorySlug}`}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-compucity-green transition"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar búsqueda
            </a>
          )}
        </div>
        <span className="text-sm text-gray-500">
          {filteredAndSorted.length} producto{filteredAndSorted.length !== 1 ? 's' : ''}
          {hasActiveFilters && products.length !== filteredAndSorted.length && (
            <span className="text-gray-400"> de {products.length}</span>
          )}
        </span>
      </div>

      {/* Subcategories pills */}
      {subcategories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {parentCategory && parentCategory.id !== currentCategory?.id ? null : (
            <a
              href={`/categoria/${categorySlug}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                !currentCategory || categorySlug === currentCategory.slug
                  ? 'bg-compucity-green text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos
            </a>
          )}
          {subcategories.map((sub) => (
            <a
              key={sub.id}
              href={`/categoria/${sub.slug}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                currentCategory?.id === sub.id
                  ? 'bg-compucity-green text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {sub.name}
            </a>
          ))}
        </div>
      )}

      {/* Category Filter Dropdowns (brand, DDR, socket, etc.) */}
      {filterGroups.length > 0 && (
        <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filtros</span>
            </div>
            {hasCategoryFilters && (
              <button
                onClick={() => setCategoryFilters({})}
                className="text-xs text-red-500 hover:text-red-700 font-medium transition"
              >
                Limpiar filtros
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {filterGroups.map(group => {
              const selectedValue = (categoryFilters[group.key] || [])[0] || ''
              return (
                <div key={group.key} className="relative">
                  <select
                    value={selectedValue}
                    onChange={(e) => setCategoryFilter(group.key, e.target.value)}
                    className="text-xs border border-gray-200 rounded-md pl-2.5 pr-7 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-compucity-green cursor-pointer appearance-none"
                  >
                    <option value="">{group.label}</option>
                    {group.options.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                </div>
              )
            })}
          </div>
          {hasCategoryFilters && (
            <p className="text-[11px] text-gray-400 mt-2">
              Mostrando {filteredAndSorted.length} de {products.length} productos
            </p>
          )}
        </div>
      )}

      {/* Filter & Sort Bar - Desktop */}
      <div className="hidden md:flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
        {/* Sort */}
        <div className="relative flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-gray-500 shrink-0" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-compucity-green cursor-pointer"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="w-px h-6 bg-gray-300" />

        {/* Price range */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 whitespace-nowrap">Precio:</span>
          <input
            type="text"
            placeholder="Mín"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            className="w-28 px-2 py-1.5 text-sm border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:border-compucity-green placeholder:text-gray-400"
          />
          <span className="text-gray-400">-</span>
          <input
            type="text"
            placeholder="Máx"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            className="w-28 px-2 py-1.5 text-sm border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:border-compucity-green placeholder:text-gray-400"
          />
        </div>

        <div className="w-px h-6 bg-gray-300" />

        {/* Stock filter */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyInStock}
            onChange={(e) => setOnlyInStock(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-compucity-green focus:ring-compucity-green accent-compucity-green"
          />
          <span className="text-sm text-gray-700">Solo en stock</span>
        </label>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="ml-auto flex items-center gap-1 text-sm text-compucity-green hover:text-compucity-green-dark font-medium transition"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {/* Filter & Sort - Mobile */}
      <div className="md:hidden mb-4">
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filtros y orden
          </span>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <span className="bg-compucity-green text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {[priceMin !== '', priceMax !== '', onlyInStock, hasCategoryFilters].filter(Boolean).length}
              </span>
            )}
            <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {filtersOpen && (
          <div className="mt-2 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4 animate-fade-in">
            {/* Sort */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Ordenar por</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-700 focus:outline-none focus:border-compucity-green"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Price range */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Rango de precio</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Precio mín"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:border-compucity-green placeholder:text-gray-400"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="text"
                  placeholder="Precio máx"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:border-compucity-green placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Stock filter */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-compucity-green focus:ring-compucity-green accent-compucity-green"
              />
              <span className="text-sm text-gray-700">Solo en stock</span>
            </label>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 text-sm text-compucity-green hover:text-compucity-green-dark font-medium transition"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Product Grid */}
      {filteredAndSorted.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {pagedProducts.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                slug={product.slug}
                price={product.price}
                comparePrice={product.comparePrice}
                image={product.images ? JSON.parse(product.images)[0] : null}
                stock={product.stock}
                isFeatured={product.isFeatured === 1}
                salePrice={product.salePrice}
                saleStart={product.saleStart}
                saleEnd={product.saleEnd}
              />
            ))}
          </div>

          {/* Paginación (sesion 43) — 50 productos por página, client-side */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500 order-2 sm:order-1">
                Mostrando{' '}
                <span className="font-medium text-gray-700">
                  {(safeCurrentPage - 1) * PRODUCTS_PER_PAGE + 1}–{Math.min(safeCurrentPage * PRODUCTS_PER_PAGE, filteredAndSorted.length)}
                </span>{' '}
                de <span className="font-medium text-gray-700">{filteredAndSorted.length}</span> productos
              </p>
              <div className="flex items-center gap-1.5 order-1 sm:order-2">
                <button
                  onClick={() => {
                    setCurrentPage(p => Math.max(1, p - 1))
                    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={safeCurrentPage === 1}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Anterior</span>
                </button>

                {/* Números de página: muestra hasta 5 alrededor de la actual */}
                {(() => {
                  const pages: (number | '…')[] = []
                  const start = Math.max(1, safeCurrentPage - 2)
                  const end = Math.min(totalPages, safeCurrentPage + 2)
                  if (start > 1) {
                    pages.push(1)
                    if (start > 2) pages.push('…')
                  }
                  for (let i = start; i <= end; i++) pages.push(i)
                  if (end < totalPages) {
                    if (end < totalPages - 1) pages.push('…')
                    pages.push(totalPages)
                  }
                  return pages.map((p, idx) =>
                    p === '…' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 select-none">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => {
                          setCurrentPage(p)
                          if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className={`min-w-[2.25rem] px-2.5 py-2 text-sm font-medium rounded-md border transition ${
                          p === safeCurrentPage
                            ? 'bg-compucity-green text-white border-compucity-green'
                            : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
                        }`}
                        aria-current={p === safeCurrentPage ? 'page' : undefined}
                      >
                        {p}
                      </button>
                    )
                  )
                })()}

                <button
                  onClick={() => {
                    setCurrentPage(p => Math.min(totalPages, p + 1))
                    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={safeCurrentPage === totalPages}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  aria-label="Página siguiente"
                >
                  <span className="hidden sm:inline">Siguiente</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : products.length > 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500 text-lg mb-2">No hay productos que coincidan con los filtros</p>
          <button
            onClick={clearAllFilters}
            className="text-compucity-green hover:text-compucity-green-dark font-medium text-sm transition"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="text-center py-20 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500 text-lg mb-2">No hay productos en esta categoría</p>
          <p className="text-gray-400 text-sm">Estamos cargando el catálogo. Volvé pronto.</p>
        </div>
      )}
    </div>
  )
}
