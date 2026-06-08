'use client'

import { useState, useMemo } from 'react'
import { SlidersHorizontal, X, ChevronDown, ArrowUpDown } from 'lucide-react'
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
}

// ============================================
// Category Filter Definitions
// ============================================

interface CategoryFilterOption {
  key: string
  label: string
  value: string
  matchFn: (name: string) => boolean
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
    { key: 'socket', label: 'AM4', value: 'AM4', matchFn: (n) => /\bAM4\b|\bB550\b|\bA520\b|\bX570\b|\bB450\b|\bA320\b/i.test(n) },
    { key: 'socket', label: 'AM5', value: 'AM5', matchFn: (n) => /\bAM5\b|\bB650\b|\bB850\b|\bB840\b|\bA620\b|\bX870\b|\bX670E?\b/i.test(n) },
    { key: 'socket', label: 'LGA 1700', value: '1700', matchFn: (n) => /\b1700\b|\bB760\b|\bH610\b|\bB660\b|\bH670\b|\bZ690\b|\bZ790\b/i.test(n) },
    { key: 'socket', label: 'LGA 1851', value: '1851', matchFn: (n) => /\b1851\b|\bB860\b|\bZ890\b|\bH810\b/i.test(n) },
    { key: 'ddr', label: 'DDR4', value: 'DDR4', matchFn: (n) => /\bDDR4\b/i.test(n) },
    { key: 'ddr', label: 'DDR5', value: 'DDR5', matchFn: (n) => /\bDDR5\b/i.test(n) },
  ],
  'memorias-ram': [
    { key: 'brand', label: 'Kingston', value: 'KINGSTON', matchFn: (n) => /\bKINGSTON\b|\bFURY\b/i.test(n) },
    { key: 'brand', label: 'Hiksemi', value: 'HIKSEMI', matchFn: (n) => /\bHIKSEMI\b/i.test(n) },
    { key: 'brand', label: 'ADATA / XPG', value: 'ADATA', matchFn: (n) => /\bADATA\b|\bXPG\b/i.test(n) },
    { key: 'brand', label: 'Corsair', value: 'CORSAIR', matchFn: (n) => /\bCORSAIR\b|\bVENGEANCE\b/i.test(n) },
    { key: 'brand', label: 'Memox', value: 'MEMOX', matchFn: (n) => /\bMEMOX\b/i.test(n) },
    { key: 'brand', label: 'Crucial', value: 'CRUCIAL', matchFn: (n) => /\bCRUCIAL\b/i.test(n) },
    { key: 'brand', label: 'Lexar', value: 'LEXAR', matchFn: (n) => /\bLEXAR\b/i.test(n) },
    { key: 'brand', label: 'G.Skill', value: 'GSKILL', matchFn: (n) => /\bG\.?SKILL\b|\bTRIDENT\b|\bRIPJAWS\b/i.test(n) },
    { key: 'brand', label: 'Patriot', value: 'PATRIOT', matchFn: (n) => /\bPATRIOT\b/i.test(n) },
    { key: 'ddr', label: 'DDR3', value: 'DDR3', matchFn: (n) => /\bDDR3\b/i.test(n) },
    { key: 'ddr', label: 'DDR4', value: 'DDR4', matchFn: (n) => /\bDDR4\b/i.test(n) },
    { key: 'ddr', label: 'DDR5', value: 'DDR5', matchFn: (n) => /\bDDR5\b/i.test(n) },
  ],
  'placas-de-video': [
    { key: 'brand', label: 'Gigabyte', value: 'GIGABYTE', matchFn: (n) => /\bGIGABYTE\b|\bAORUS\b/i.test(n) && /\bRTX\b|\bGTX\b|\bRADEON\b|\bGEFORCE\b/i.test(n) },
    { key: 'brand', label: 'MSI', value: 'MSI', matchFn: (n) => /\bMSI\b/i.test(n) && /\bRTX\b|\bGTX\b|\bRADEON\b|\bGEFORCE\b/i.test(n) },
    { key: 'brand', label: 'Asus', value: 'ASUS', matchFn: (n) => /\bASUS\b|\bROG\b|\bTUF\b/i.test(n) && /\bRTX\b|\bGTX\b|\bRADEON\b|\bGEFORCE\b/i.test(n) },
    { key: 'brand', label: 'NVIDIA', value: 'NVIDIA', matchFn: (n) => /\bRTX\b|\bGTX\b|\bGEFORCE\b|\bNVIDIA\b|\bQUADRO\b|\bGT 1030\b/i.test(n) },
    { key: 'brand', label: 'AMD', value: 'AMD', matchFn: (n) => /\bRADEON\b|\bRX\s\d/i.test(n) },
    { key: 'brand', label: 'PNY', value: 'PNY', matchFn: (n) => /\bPNY\b/i.test(n) },
    { key: 'brand', label: 'Intel Arc', value: 'INTEL_ARC', matchFn: (n) => /\bARC\s*A[37]\b/i.test(n) },
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
    { key: 'brand', label: 'Patriot', value: 'PATRIOT', matchFn: (n) => /\bPATRIOT\b|\bP300\b|\bP210\b/i.test(n) },
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
  ],
  'refrigeracion': [
    { key: 'brand', label: 'Asus', value: 'ASUS', matchFn: (n) => /\bASUS\b|\bROG\b/i.test(n) && /\bCOOL\b|\bAIO\b|\bLIQUID\b|\bWATER\b|\bDISIPADOR\b|\bFAN\b/i.test(n) },
    { key: 'brand', label: 'Cooler Master', value: 'COOLERMASTER', matchFn: (n) => /\bCOOLER\s*MASTER\b/i.test(n) },
    { key: 'brand', label: 'MSI', value: 'MSI', matchFn: (n) => /\bMSI\b/i.test(n) && /\bCOOL\b|\bAIO\b|\bLIQUID\b|\bWATER\b|\bDISIPADOR\b|\bFAN\b/i.test(n) },
    { key: 'brand', label: 'Thermaltake', value: 'THERMALTAKE', matchFn: (n) => /\bTHERMALTAKE\b/i.test(n) },
    { key: 'brand', label: 'Corsair', value: 'CORSAIR', matchFn: (n) => /\bCORSAIR\b/i.test(n) },
    { key: 'brand', label: 'Gamemax', value: 'GAMEMAX', matchFn: (n) => /\bGAMEMAX\b/i.test(n) },
    { key: 'brand', label: 'XPG', value: 'XPG', matchFn: (n) => /\bXPG\b/i.test(n) },
    { key: 'brand', label: 'DeepCool', value: 'DEEPCOOL', matchFn: (n) => /\bDEEPCOOL\b/i.test(n) },
    { key: 'brand', label: 'Noctua', value: 'NOCTUA', matchFn: (n) => /\bNOCTUA\b/i.test(n) },
    { key: 'brand', label: 'Arctic', value: 'ARCTIC', matchFn: (n) => /\bARCTIC\b/i.test(n) },
    { key: 'brand', label: 'be quiet!', value: 'BE_QUIET', matchFn: (n) => /\bBE\s*QUIET\b/i.test(n) },
    { key: 'brand', label: 'Gigabyte', value: 'GIGABYTE', matchFn: (n) => /\bGIGABYTE\b/i.test(n) && /\bCOOL\b|\bAIO\b|\bLIQUID\b|\bWATER\b/i.test(n) },
    { key: 'brand', label: 'Aerocool', value: 'AEROCOOL', matchFn: (n) => /\bAEROCOOL\b/i.test(n) },
    { key: 'brand', label: 'Kelyx', value: 'KELYX', matchFn: (n) => /\bKELYX\b/i.test(n) },
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
    { key: 'brand', label: 'KOORUI', value: 'KOORUI', matchFn: (n) => /\bKOORUI\b/i.test(n) },
    { key: 'brand', label: 'Genius', value: 'GENIUS', matchFn: (n) => /\bGENIUS\b/i.test(n) },
    { key: 'brand', label: 'Epson', value: 'EPSON', matchFn: (n) => /\bEPSON\b/i.test(n) },
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
  ],
  'switches': [
    { key: 'brand', label: 'TP-Link', value: 'TPLINK', matchFn: (n) => /\bTP[\s\-]?LINK\b/i.test(n) },
    { key: 'brand', label: 'HP', value: 'HP', matchFn: (n) => /\bHP\b/i.test(n) },
    { key: 'brand', label: 'Hikvision', value: 'HIKVISION', matchFn: (n) => /\bHIKVISION\b/i.test(n) },
    { key: 'brand', label: 'Cudy', value: 'CUDY', matchFn: (n) => /\bCUDY\b/i.test(n) },
    { key: 'brand', label: 'D-Link', value: 'DLINK', matchFn: (n) => /\bD[\s\-]?LINK\b/i.test(n) && !/\bTP/i.test(n) },
    { key: 'brand', label: 'Mercusys', value: 'MERCUSYS', matchFn: (n) => /\bMERCUSYS\b/i.test(n) },
    { key: 'brand', label: 'Tenda', value: 'TENDA', matchFn: (n) => /\bTENDA\b/i.test(n) },
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
  ],
  'parlantes': [
    { key: 'brand', label: 'Genius', value: 'GENIUS', matchFn: (n) => /\bGENIUS\b/i.test(n) },
    { key: 'brand', label: 'JBL', value: 'JBL', matchFn: (n) => /\bJBL\b/i.test(n) },
    { key: 'brand', label: 'LG', value: 'LG', matchFn: (n) => /\bLG\b/i.test(n) },
    { key: 'brand', label: 'Kelyx', value: 'KELYX', matchFn: (n) => /\bKELYX\b/i.test(n) },
  ],
  'webcams': [
    { key: 'brand', label: 'Logitech', value: 'LOGITECH', matchFn: (n) => /\bLOGITECH\b|\bC920\b|\bC270\b|\bBRIO\b/i.test(n) },
    { key: 'brand', label: 'Genius', value: 'GENIUS', matchFn: (n) => /\bGENIUS\b/i.test(n) },
    { key: 'brand', label: 'Razer', value: 'RAZER', matchFn: (n) => /\bRAZER\b|\bKIYO\b/i.test(n) },
  ],
  'impresion': [
    { key: 'brand', label: 'HP', value: 'HP', matchFn: (n) => /\bHP\b/i.test(n) },
    { key: 'brand', label: 'Brother', value: 'BROTHER', matchFn: (n) => /\bBROTHER\b/i.test(n) },
    { key: 'brand', label: 'Epson', value: 'EPSON', matchFn: (n) => /\bEPSON\b|\bECOTANK\b|\bWORKFORCE\b/i.test(n) },
    { key: 'brand', label: 'Lexmark', value: 'LEXMARK', matchFn: (n) => /\bLEXMARK\b/i.test(n) },
    { key: 'brand', label: 'Samsung', value: 'SAMSUNG', matchFn: (n) => /\bSAMSUNG\b/i.test(n) },
    { key: 'brand', label: 'Canon', value: 'CANON', matchFn: (n) => /\bCANON\b|\bPIXMA\b/i.test(n) },
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
    { key: 'capacity', label: 'Hasta 512GB', value: 'upto512', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c <= 600 } },
    { key: 'capacity', label: '1TB', value: '1tb', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 900 && c <= 1100 } },
    { key: 'capacity', label: '2TB', value: '2tb', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 1900 && c <= 2100 } },
    { key: 'capacity', label: '4TB+', value: '4tbplus', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 3800 } },
  ],
  'perifericos': [
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
    { key: 'brand', label: 'Lenovo', value: 'LENOVO', matchFn: (n) => /\bLENOVO\b|\bTHINKPAD\b|\bIDEAPAD\b/i.test(n) },
    { key: 'brand', label: 'HP', value: 'HP', matchFn: (n) => /\bHP\b|\bPAVILION\b|\bOMEN\b|\bVICTUS\b/i.test(n) },
    { key: 'brand', label: 'Dell', value: 'DELL', matchFn: (n) => /\bDELL\b|\bINSPIRON\b|\bLATITUDE\b|\bALIENWARE\b/i.test(n) },
    { key: 'brand', label: 'Asus', value: 'ASUS', matchFn: (n) => /\bASUS\b|\bROG\b|\bTUF\b|\bZENBOOK\b|\bVIVOBOOK\b/i.test(n) },
    { key: 'brand', label: 'MSI', value: 'MSI', matchFn: (n) => /\bMSI\b|\bRAIDER\b|\bTHIN\b/i.test(n) },
    { key: 'brand', label: 'Acer', value: 'ACER', matchFn: (n) => /\bACER\b|\bASPIRE\b|\bNITRO\b|\bPREDATOR\b/i.test(n) },
    { key: 'brand', label: 'Samsung', value: 'SAMSUNG', matchFn: (n) => /\bSAMSUNG\b|\bGALAXY BOOK\b/i.test(n) },
    { key: 'brand', label: 'Kelyx', value: 'KELYX', matchFn: (n) => /\bKELYX\b/i.test(n) },
  ],
  'smart-home': [
    { key: 'brand', label: 'TP-Link', value: 'TPLINK', matchFn: (n) => /\bTP[\s\-]?LINK\b|\bTAPO\b/i.test(n) },
    { key: 'brand', label: 'Hikvision', value: 'HIKVISION', matchFn: (n) => /\bHIKVISION\b/i.test(n) },
    { key: 'brand', label: 'Xiaomi', value: 'XIAOMI', matchFn: (n) => /\bXIAOMI\b|\bMI\b|\bROBOROCK\b/i.test(n) },
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
function applyCategoryFilters(products: ProductItem[], filters: Record<string, string[]>, categorySlug: string): ProductItem[] {
  const filterOptions = CATEGORY_FILTERS[categorySlug]
  if (!filterOptions || filterOptions.length === 0) return products

  const activeGroups = new Map<string, CategoryFilterOption[]>()
  for (const [key, values] of Object.entries(filters)) {
    if (values.length === 0) continue
    const matching = filterOptions.filter(o => o.key === key && values.includes(o.value))
    if (matching.length > 0) activeGroups.set(key, matching)
  }

  if (activeGroups.size === 0) return products

  return products.filter(product => {
    for (const [, options] of activeGroups) {
      const matchesGroup = options.some(opt => opt.matchFn(product.name))
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

const formatPrice = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

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
  const currentCategoryFilterOptions = CATEGORY_FILTERS[filterSlug] || []
  const filterGroups = useMemo(() => {
    const groups: { key: string; label: string; options: CategoryFilterOption[] }[] = []
    const keyMap = new Map<string, CategoryFilterOption[]>()
    for (const opt of currentCategoryFilterOptions) {
      if (!keyMap.has(opt.key)) keyMap.set(opt.key, [])
      keyMap.get(opt.key)!.push(opt)
    }
    for (const [key, options] of keyMap) {
      groups.push({ key, label: FILTER_GROUP_LABELS[key] || key, options })
    }
    return groups
  }, [currentCategoryFilterOptions.length, filterSlug])

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
    result = applyCategoryFilters(result, categoryFilters, filterSlug)

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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredAndSorted.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              slug={product.slug}
              price={product.price}
              comparePrice={product.comparePrice}
              image={product.images ? JSON.parse(product.images)[0] : null}
              stock={product.stock}
              salePrice={product.salePrice}
              saleStart={product.saleStart}
              saleEnd={product.saleEnd}
            />
          ))}
        </div>
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
