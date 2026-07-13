'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { formatARS } from '@/lib/format'
import Link from 'next/link'
import jsPDF from 'jspdf'
import {
  Cpu,
  CircuitBoard,
  Zap,
  HardDrive,
  Box,
  Monitor,
  Wind,
  Droplets,
  ChevronRight,
  ChevronLeft,
  ShoppingCart,
  MessageCircle,
  Trash2,
  Plus,
  Check,
  Loader2,
  Search,
  X,
  AlertTriangle,
  ShieldCheck,
  Info,
  Minus,
  Wifi,
  Mouse,
  Gamepad2,
  Plug,
  SlidersHorizontal,
  Download,
  ChevronDown,

} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCart } from '@/store/cart'
import { Input } from '@/components/ui/input'
import {
  extractCompatibility,
  buildCompatibilityFilters,
  SOCKET_LABELS,
  DDR_LABELS,
  type CompatibilityInfo,
  type CompatibilityFilters,
} from '@/lib/compatibility'
import { getVisibleSpecs } from '@/lib/product-specs'
import { COMPUCITY_LOGO_BASE64 } from '@/lib/compucity-logo-base64'
import PCAssistantChat from '@/components/pc-assistant-chat'
import { WhatsAppIcon } from '@/components/ui-custom/WhatsAppIcon'

// ============================================
// Types
// ============================================

interface ComponentSlot {
  slot: string
  label: string
  categorySlug: string
  count: number
  icon: React.ElementType
  required: boolean
}

interface BuilderProduct {
  id: string
  name: string
  slug: string
  price: number
  comparePrice: number | null
  costPrice: number | null
  images: string
  stock: number
  specs: string
  _calculated: boolean
  compatInfo?: CompatibilityInfo
  isCompatible?: boolean
}

interface SelectedComponent {
  slot: string
  product: BuilderProduct
  quantity: number
}

// ============================================
// Slot Filter Definitions
// ============================================

interface FilterOption {
  key: string        // filter group key (e.g., 'brand', 'ddr', 'type')
  label: string      // display label
  value: string      // filter value
  matchFn: (name: string) => boolean  // function to check if product name matches
}

/**
 * Extract the primary storage capacity in GB from a product name.
 * Handles patterns like: 1TB, 1 TB, 2TB, 256GB, 480GB, 960GB, 1.92TB, etc.
 * Returns null if no recognizable storage capacity found.
 */
function extractCapacityGB(name: string): number | null {
  const n = name.replace(/,/g, '.').replace(/(SSD|HDD|DISCO)(\d)/gi, '$1 $2')
  const tbMatch = n.match(/\b(\d+\.?\d*)\s*TB?\b/i)
  if (tbMatch) {
    const val = parseFloat(tbMatch[1])
    if (val >= 0.1 && val <= 100) return val * 1000
  }
  const gbMatch = n.match(/\b(\d{2,4})\s*GB(?!\s*[\/PS])/i)
  if (gbMatch) {
    const val = parseInt(gbMatch[1])
    if (val >= 32 && val <= 16384) return val
  }
  return null
}

const SLOT_FILTERS: Record<string, FilterOption[]> = {
  processor: [
    { key: 'brand', label: 'AMD', value: 'AMD', matchFn: (n) => /\bAMD\b|\bRYZEN\b|\bATHLON\b/i.test(n) },
    { key: 'brand', label: 'Intel', value: 'Intel', matchFn: (n) => /\bINTEL\b|\bCORE\s*I[3579]\b|\bPENTIUM\b|\bCELERON\b|\bCORE ULTRA\b/i.test(n) },
  ],
  motherboard: [
    { key: 'socket', label: 'AM4', value: 'AM4', matchFn: (n) => /\bAM4\b|\bB550\b|\bA520\b|\bX570\b|\bB450\b|\bA320\b/i.test(n)},
    { key: 'socket', label: 'AM5', value: 'AM5', matchFn: (n) => /\bAM5\b|\bB650\b|\bB850\b|\bB840\b|\bA620\b|\bX870\b|\bX670E?\b/i.test(n) },
    { key: 'socket', label: 'LGA 1700', value: '1700', matchFn: (n) => /(?:S|LGA\s*)?1700|\bB760\b|\bH610\b|\bB660\b|\bH670\b|\bZ690\b|\bZ790\b/i.test(n) },
    { key: 'socket', label: 'LGA 1851', value: '1851', matchFn: (n) => /(?:S|LGA\s*)?1851|\bB860\b|\bZ890\b|\bH810\b/i.test(n) },
    { key: 'ddr', label: 'DDR4', value: 'DDR4', matchFn: (n) => /\bDDR4\b/i.test(n) },
    { key: 'ddr', label: 'DDR5', value: 'DDR5', matchFn: (n) => /\bDDR5\b/i.test(n) },
  ],
  ram: [
    { key: 'ddr', label: 'DDR3', value: 'DDR3', matchFn: (n) => /\bDDR3\b/i.test(n) },
    { key: 'ddr', label: 'DDR4', value: 'DDR4', matchFn: (n) => /\bDDR4\b/i.test(n) },
    { key: 'ddr', label: 'DDR5', value: 'DDR5', matchFn: (n) => /\bDDR5\b/i.test(n) },
    { key: 'capacity', label: '8GB', value: '8gb', matchFn: (n) => /\b8\s*GB\b/i.test(n) },
    { key: 'capacity', label: '16GB', value: '16gb', matchFn: (n) => /\b16\s*GB\b/i.test(n) },
    { key: 'capacity', label: '32GB', value: '32gb', matchFn: (n) => /\b32\s*GB\b/i.test(n) },
    { key: 'capacity', label: '48GB+', value: '48gbplus', matchFn: (n) => { const m = n.match(/\b(\d+)\s*GB\b/i); return m ? parseInt(m[1]) >= 48 : false } },
  ],
  gpu: [
    { key: 'brand', label: 'NVIDIA', value: 'NVIDIA', matchFn: (n) => /\bRTX\b|\bGTX\b|\bGEFORCE\b|\bNVIDIA\b|\bQUADRO\b|\bGT 1030\b/i.test(n) },
    { key: 'brand', label: 'AMD', value: 'AMD', matchFn: (n) => /\bRADEON\b|\bRX\s\d/i.test(n) },
    { key: 'brand', label: 'Intel Arc', value: 'INTEL_ARC', matchFn: (n) => /\bARC\s*A[37]\b/i.test(n) },
    { key: 'vram', label: '4GB', value: '4gb', matchFn: (n) => /\b4\s*GB\b/i.test(n) && /\bRTX\b|\bGTX\b|\bRADEON\b|\bGEFORCE\b|\bGT\b|\bQUADRO\b|\bARC\b/i.test(n) },
    { key: 'vram', label: '6GB', value: '6gb', matchFn: (n) => /\b6\s*GB\b/i.test(n) && /\bRTX\b|\bGTX\b|\bRADEON\b|\bGEFORCE\b|\bARC\b/i.test(n) },
    { key: 'vram', label: '8GB', value: '8gb', matchFn: (n) => /\b8\s*GB\b/i.test(n) && /\bRTX\b|\bGTX\b|\bRADEON\b|\bGEFORCE\b|\bQUADRO\b|\bARC\b/i.test(n) },
    { key: 'vram', label: '12GB', value: '12gb', matchFn: (n) => /\b12\s*GB\b/i.test(n) && /\bRTX\b|\bGTX\b|\bRADEON\b|\bGEFORCE\b|\bQUADRO\b/i.test(n) },
    { key: 'vram', label: '16GB', value: '16gb', matchFn: (n) => /\b16\s*GB\b/i.test(n) && /\bRTX\b|\bGTX\b|\bRADEON\b|\bGEFORCE\b|\bQUADRO\b/i.test(n) },
    { key: 'vram', label: '24GB', value: '24gb', matchFn: (n) => /\b24\s*GB\b/i.test(n) && /\bRTX\b|\bGTX\b|\bRADEON\b|\bGEFORCE\b|\bQUADRO\b/i.test(n) },
    { key: 'series', label: 'RTX 5090', value: 'rtx5090', matchFn: (n) => /RTX\s*5090/i.test(n) },
    { key: 'series', label: 'RTX 5080', value: 'rtx5080', matchFn: (n) => /RTX\s*5080/i.test(n) },
    { key: 'series', label: 'RTX 5070', value: 'rtx5070', matchFn: (n) => /RTX\s*5070/i.test(n) },
    { key: 'series', label: 'RTX 5060', value: 'rtx5060', matchFn: (n) => /RTX\s*5060/i.test(n) },
    { key: 'series', label: 'RTX 5050', value: 'rtx5050', matchFn: (n) => /RTX\s*5050/i.test(n) },
    { key: 'series', label: 'RTX 3050', value: 'rtx3050', matchFn: (n) => /RTX\s*3050/i.test(n) },
    { key: 'series', label: 'RX 9070 XT', value: 'rx9070xt', matchFn: (n) => /RX\s*9070/i.test(n) },
    { key: 'series', label: 'RX 9060 XT', value: 'rx9060xt', matchFn: (n) => /RX\s*9060/i.test(n) },
    { key: 'series', label: 'RX 7600', value: 'rx7600', matchFn: (n) => /RX\s*7600/i.test(n) },
  ],
  ssd: [
    { key: 'brand', label: 'Kingston', value: 'KINGSTON', matchFn: (n) => /\bKINGSTON\b|\bFURY\b|\bA400\b|\bKC3000\b|\bKC600\b|\bNV3\b/i.test(n) },
    { key: 'brand', label: 'WD', value: 'WD', matchFn: (n) => /\bWESTERN\b|\bWD\b/i.test(n) && /\bSSD\b|\bNVME\b|\bM\.2\b|\bGREEN\b|\bBLUE\b|\bBLACK\b|\bRED\b/i.test(n) },
    { key: 'brand', label: 'Hiksemi', value: 'HIKSEMI', matchFn: (n) => /\bHIKSEMI\b/i.test(n) },
    { key: 'brand', label: 'ADATA / XPG', value: 'ADATA', matchFn: (n) => /\bADATA\b|\bXPG\b|\bGAMMIX\b|\bLEGEND\b|\bSPECTRIX\b/i.test(n) },
    { key: 'brand', label: 'Lexar', value: 'LEXAR', matchFn: (n) => /\bLEXAR\b/i.test(n) },
    { key: 'brand', label: 'Crucial', value: 'CRUCIAL', matchFn: (n) => /\bCRUCIAL\b/i.test(n) },
    { key: 'brand', label: 'Memox', value: 'MEMOX', matchFn: (n) => /\bMEMOX\b/i.test(n) },
    { key: 'brand', label: 'Samsung', value: 'SAMSUNG', matchFn: (n) => /\bSAMSUNG\b|\bEVO\b|\b9[79]0\b/i.test(n) && !/\bMONITOR\b/i.test(n) },
    { key: 'brand', label: 'MSI', value: 'MSI', matchFn: (n) => /\bMSI\b|\bSPATIUM\b/i.test(n) && /\bSSD\b|\bNVME\b|\bM\.2\b/i.test(n) },
    { key: 'type', label: 'M.2 / NVMe', value: 'NVME', matchFn: (n) => /\bNVME\b|\bM\.2\b|\bM2\b/i.test(n) },
    { key: 'type', label: 'SATA', value: 'SATA', matchFn: (n) => /\bSATA\b/i.test(n) && !/\bNVME\b|\bM\.2\b/i.test(n) },
    { key: 'capacity', label: 'Hasta 256GB', value: 'upto256', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c <= 256 } },
    { key: 'capacity', label: '480GB - 512GB', value: '480-512', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 480 && c <= 600 } },
    { key: 'capacity', label: '960GB - 1TB', value: '960-1tb', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 960 && c <= 1100 } },
    { key: 'capacity', label: '2TB', value: '2tb', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 1900 && c <= 2100 } },
    { key: 'capacity', label: '4TB+', value: '4tbplus', matchFn: (n) => { const c = extractCapacityGB(n); return c !== null && c >= 3800 } },
  ],
  hdd: [
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
  psu: [
    { key: 'wattage', label: 'Hasta 500W', value: 'upto500', matchFn: (n) => { const m = n.match(/(\d{3,4})\s*W/i); return m ? parseInt(m[1]) <= 500 : false; } },
    { key: 'wattage', label: '550W - 650W', value: '550-650', matchFn: (n) => { const m = n.match(/(\d{3,4})\s*W/i); return m ? (parseInt(m[1]) >= 550 && parseInt(m[1]) <= 650) : false; } },
    { key: 'wattage', label: '700W - 750W', value: '700-750', matchFn: (n) => { const m = n.match(/(\d{3,4})\s*W/i); return m ? (parseInt(m[1]) >= 700 && parseInt(m[1]) <= 750) : false; } },
    { key: 'wattage', label: '800W - 850W', value: '800-850', matchFn: (n) => { const m = n.match(/(\d{3,4})\s*W/i); return m ? (parseInt(m[1]) >= 800 && parseInt(m[1]) <= 850) : false; } },
    { key: 'wattage', label: '1000W+', value: '1000plus', matchFn: (n) => { const m = n.match(/(\d{3,4})\s*W/i); return m ? parseInt(m[1]) >= 1000 : false; } },
  ],
  cooling: [
    { key: 'type', label: 'AIO / Líquida', value: 'LIQUID', matchFn: (n) => /\bWATER\s*COOL\b|\bAIO\b|\bLIQUID\b|\bWATERFORCE\b|\bWATER COOL\b/i.test(n) },
    { key: 'type', label: 'Aire', value: 'AIR', matchFn: (n) => !/\bWATER\s*COOL\b|\bAIO\b|\bLIQUID\b|\bWATERFORCE\b/i.test(n) },
  ],
  case: [
    { key: 'type', label: 'Con Fuente', value: 'CON_FUENTE', matchFn: (n) => /\bCON FUENTE\b|\bC\/FUENTE\b|\bCF\b|\bINCLUYE FUENTE\b/i.test(n) },
    { key: 'type', label: 'Sin Fuente', value: 'SIN_FUENTE', matchFn: (n) => !/\bCON FUENTE\b|\bC\/FUENTE\b|\bCF\b|\bINCLUYE FUENTE\b/i.test(n) },
  ],
  monitor: [
    { key: 'size', label: '19"', value: '19', matchFn: (n) => /\b19[\s"']\s*\b/i.test(n) && !/\b190\d\b/.test(n) },
    { key: 'size', label: '22"', value: '22', matchFn: (n) => /\b22[\s"']\s*\b/i.test(n) && !/\b220\d\b/.test(n) },
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
  network: [
    { key: 'type', label: 'PCIe', value: 'PCIE', matchFn: (n) => /\bPCIEX?\b|\bPCI-E\b|\bPCIX\b/i.test(n) && !/\bUSB\b/i.test(n) },
    { key: 'type', label: 'USB', value: 'USB', matchFn: (n) => /\bP\.?REDW?\s.*USB|USB.*RED|\bARCHER T\b/i.test(n) },
    { key: 'type', label: 'WiFi 6 / 6E', value: 'WIFI6', matchFn: (n) => /\bWIFI\s*6E?\b|\bAX\d{3,4}\b/i.test(n) },
  ],
  peripherals: [
    { key: 'type', label: 'Mouse', value: 'MOUSE', matchFn: (n) => /\bMOUSE\b/i.test(n) && !/\bMOUSEPAD\b/i.test(n) },
    { key: 'type', label: 'Teclado', value: 'TECLADO', matchFn: (n) => /\bTECLADO\b|\bKEYBOARD\b/i.test(n) || (/(\bMECANICO\b|\bMECHANICAL\b)/i.test(n) && !/\bMOUSE\b/i.test(n)) },
    { key: 'type', label: 'Auricular', value: 'AURICULAR', matchFn: (n) => /\bAURICULAR\b|\bHEADSET\b/i.test(n) },
    { key: 'type', label: 'Webcam', value: 'WEBCAM', matchFn: (n) => /\bWEBCAM\b|\bWEB CAM\b/i.test(n) },
    { key: 'type', label: 'Micrófono', value: 'MICROFONO', matchFn: (n) => /\bMICROFONO\b|\bMICRÓFONO\b/i.test(n) },
    { key: 'type', label: 'Volante', value: 'VOLANTE', matchFn: (n) => /\bVOLANTE\b|\bWHEEL\b|\bRACING\s*(WHEEL|VOLANTE)\b/i.test(n) },
    { key: 'type', label: 'Parlante', value: 'PARLANTE', matchFn: (n) => /\bPARLANTE\b|\bSPEAKER\b/i.test(n) },
    { key: 'type', label: 'Joystick', value: 'JOYSTICK', matchFn: (n) => /\bJOYSTICK\b|\bGAMEPAD\b|\bCONTROL\s*(PS|XBOX|XBOX\s*ONE|DECK|SWITCH)\b/i.test(n) },
  ],
}

/**
 * Apply manual filters to a product list.
 * Logic: AND between different filter groups, OR within the same group.
 * If no filters active for a group, all products pass that group.
 */
function applyManualFilters(products: BuilderProduct[], filters: Record<string, string[]>, slotKey: string): BuilderProduct[] {
  const slotFilterOptions = SLOT_FILTERS[slotKey]
  if (!slotFilterOptions || slotFilterOptions.length === 0) return products

  // Get active filter groups
  const activeGroups = new Map<string, FilterOption[]>()
  for (const [key, values] of Object.entries(filters)) {
    if (values.length === 0) continue
    const matchingOptions = slotFilterOptions.filter(o => o.key === key && values.includes(o.value))
    if (matchingOptions.length > 0) {
      activeGroups.set(key, matchingOptions)
    }
  }

  if (activeGroups.size === 0) return products

  return products.filter(product => {
    // Product must pass ALL active filter groups (AND logic between groups)
    for (const [, options] of activeGroups) {
      // Product must match at least one option in the group (OR logic within group)
      const matchesGroup = options.some(opt => opt.matchFn(product.name))
      if (!matchesGroup) return false
    }
    return true
  })
}

// ============================================
// Slot Definitions
// ============================================

// Default slots (fallback when API is unavailable)
// IMPORTANT: Keep in sync with DEFAULT_SLOTS in /api/admin/pc-builder-slots/route.ts
const DEFAULT_SLOTS: { slot: string; label: string; categorySlug: string; icon: React.ElementType; required: boolean; maxQty: number }[] = [
  { slot: 'processor', label: 'Microprocesador', categorySlug: 'microprocesadores', icon: Cpu, required: true, maxQty: 1 },
  { slot: 'motherboard', label: 'Motherboard', categorySlug: 'motherboards', icon: CircuitBoard, required: true, maxQty: 1 },
  { slot: 'ram', label: 'Memoria RAM', categorySlug: 'memoria-ram-pc', icon: Zap, required: true, maxQty: 4 },
  { slot: 'gpu', label: 'Placa de Video', categorySlug: 'placas-de-video', icon: Gamepad2, required: false, maxQty: 1 },
  { slot: 'ssd', label: 'Disco SSD', categorySlug: 'discos-ssd', icon: HardDrive, required: true, maxQty: 4 },
  { slot: 'hdd', label: 'Disco HDD', categorySlug: 'discos-hdd', icon: HardDrive, required: false, maxQty: 2 },
  { slot: 'psu', label: 'Fuente', categorySlug: 'fuentes', icon: Plug, required: true, maxQty: 1 },
  { slot: 'case', label: 'Gabinete', categorySlug: 'gabinetes', icon: Box, required: true, maxQty: 1 },
  { slot: 'cooling', label: 'Refrigeración', categorySlug: 'refrigeracion', icon: Wind, required: false, maxQty: 1 },
  { slot: 'thermal', label: 'Pasta Térmica', categorySlug: 'pastas-termicas', icon: Droplets, required: false, maxQty: 1 },
  { slot: 'monitor', label: 'Monitor', categorySlug: 'monitores', icon: Monitor, required: false, maxQty: 2 },
  { slot: 'network', label: 'Placa de Red / WiFi', categorySlug: 'placas-de-red', icon: Wifi, required: false, maxQty: 1 },
  { slot: 'peripherals', label: 'Periféricos', categorySlug: 'perifericos', icon: Mouse, required: false, maxQty: 3 },
]

// Icon name to component mapping (for dynamic slot loading from API)
const ICON_MAP: Record<string, React.ElementType> = {
  Cpu, CircuitBoard, Zap, Gamepad2, HardDrive, Plug, Box, Wind, Droplets, Monitor, Wifi, Mouse,
  SlidersHorizontal, Download, Search, X, AlertTriangle, ShieldCheck, Info, ShoppingCart, MessageCircle, Plus, Check, Minus, ChevronRight, ChevronLeft, Trash2, Loader2, ChevronDown
}

// ============================================
// Helpers
// ============================================

function safeParseFirstImage(images: string | null): string | null {
  if (!images) return null
  try { return JSON.parse(images)[0] } catch { return null }
}

function parseSpecs(specs: string): Record<string, string> {
  try {
    return JSON.parse(specs)
  } catch {
    return {}
  }
}

// ============================================
// Main Component
// ============================================

export default function ArmaTuPCPage() {
  // Slots loaded from API (falls back to DEFAULT_SLOTS)
  const [SLOTS, setSLOTS] = useState(DEFAULT_SLOTS)
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedComponents, setSelectedComponents] = useState<SelectedComponent[]>([])
  const [products, setProducts] = useState<BuilderProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [slotsWithCounts, setSlotsWithCounts] = useState<ComponentSlot[]>([])
  const [showIncompatible, setShowIncompatible] = useState(false)
  const [activeFilters, setActiveFilters] = useState<CompatibilityFilters>({})
  const [showMobileSummary, setShowMobileSummary] = useState(false)
  const [manualFilters, setManualFilters] = useState<Record<string, string[]>>({})
  const [addedToCart, setAddedToCart] = useState(false)
  const addItem = useCart((s) => s.addItem)

  // Load slots from API on mount (safe fallback to DEFAULT_SLOTS)
  useEffect(() => {
    fetch('/api/pc-builder-slots')
      .then(res => res.json())
      .then(data => {
        if (data.ok && Array.isArray(data.slots) && data.slots.length > 0) {
          const apiSlots = data.slots.map((s: any) => ({
            slot: s.slot,
            label: s.label,
            categorySlug: s.categorySlug,
            icon: (s.icon && ICON_MAP[s.icon]) || ICON_MAP.Cpu, // fallback icon
            required: s.required ?? false,
            maxQty: s.maxQty ?? 1,
          }))
          setSLOTS(apiSlots)
        }
      })
      .catch(() => {
        // Silently keep DEFAULT_SLOTS on error
      })
  }, [])

  const handleAddToCart = () => {
    selectedComponents.forEach(c => {
      addItem({
        id: c.product.id,
        name: c.product.name,
        price: c.product.comparePrice || c.product.price,
        image: c.product.images ? JSON.parse(c.product.images)[0] : '/placeholder-product.png',
        slug: c.product.slug,
      })
    })
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 5000)
  }


  const currentSlot = SLOTS[currentStep]
  const selectedForCurrentSlot = selectedComponents.filter(c => c.slot === currentSlot.slot)
  const isMultiDiskSlot = currentSlot.slot === 'ssd' || currentSlot.slot === 'hdd'

  // Build compatibility filters from selected components
  const compatibilityFilters = useMemo(() => {
    return buildCompatibilityFilters(selectedComponents.map(c => ({
      slot: c.slot,
      product: { name: c.product.name },
    })))
  }, [selectedComponents])

  // Get compatibility info for the currently selected processor
  const selectedProcessor = selectedComponents.find(c => c.slot === 'processor')
  const processorInfo = selectedProcessor
    ? extractCompatibility('processor', selectedProcessor.product.name)
    : null

  // Get compatibility info for the currently selected motherboard
  const selectedMotherboard = selectedComponents.find(c => c.slot === 'motherboard')
  const motherboardInfo = selectedMotherboard
    ? extractCompatibility('motherboard', selectedMotherboard.product.name)
    : null

  // Get compatibility info for the currently selected GPU
  const selectedGpu = selectedComponents.find(c => c.slot === 'gpu')
  const gpuInfo = selectedGpu
    ? extractCompatibility('gpu', selectedGpu.product.name)
    : null

  // Load slot counts on mount
  useEffect(() => {
    async function loadSlotCounts() {
      try {
        const res = await fetch('/api/pc-builder')
        const data = await res.json()
        if (data.ok && data.slots) {
          setSlotsWithCounts(
            data.slots.map((s: any) => {
              const slotDef = SLOTS.find(sl => sl.slot === s.slot)
              return {
                ...s,
                icon: slotDef?.icon || Cpu,
                required: slotDef?.required || false,
              }
            })
          )
        }
      } catch (error) {
        console.error('Error loading slot counts:', error)
      }
    }
    loadSlotCounts()
  }, [])

  // Load products when step changes or compatibility filters change
  const loadProducts = useCallback(async () => {
    setLoading(true)
    setSearch('')
    setManualFilters({})
    try {
      const params = new URLSearchParams({ slot: currentSlot.slot })

      // Pass compatibility filters to API
      if (currentSlot.slot === 'motherboard' && compatibilityFilters.socket) {
        params.set('socket', compatibilityFilters.socket)
      }
      if (currentSlot.slot === 'ram' && compatibilityFilters.ddr) {
        params.set('ddr', compatibilityFilters.ddr)
      }
      if (currentSlot.slot === 'psu' && compatibilityFilters.minWattage) {
        params.set('minWattage', String(compatibilityFilters.minWattage))
      }

      const res = await fetch(`/api/pc-builder?${params.toString()}`)
      const data = await res.json()
      if (data.ok) {
        setProducts(data.products || [])
        setActiveFilters(data.filters || {})
      }
    } catch (error) {
      console.error('Error loading products:', error)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [currentSlot.slot, compatibilityFilters])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const selectProduct = (product: BuilderProduct) => {
    const slot = currentSlot.slot
    setSelectedComponents(prev => {
      if (slot === 'ssd' || slot === 'hdd') {
        // Multi-disk: add new product or increment quantity of existing
        const existing = prev.find(c => c.slot === slot && c.product.id === product.id)
        if (existing) {
          // Product already selected in this slot - increment quantity
          const slotDef = SLOTS.find(s => s.slot === slot)
          const maxQty = slotDef?.maxQty || 4
          return prev.map(c =>
            c.slot === slot && c.product.id === product.id
              ? { ...c, quantity: Math.min(maxQty, c.quantity + 1) }
              : c
          )
        } else {
          // New product for this slot
          return [...prev, { slot, product, quantity: 1 }]
        }
      } else {
        // Single-product slot: replace existing selection
        const filtered = prev.filter(c => c.slot !== slot)
        return [...filtered, { slot, product, quantity: 1 }]
      }
    })

    // Auto-advance to next slot for non-disk AND non-RAM slots
    // Sesión 47: RAM tampoco avanza automáticamente, el usuario debe presionar "Siguiente"
    if (slot !== 'ssd' && slot !== 'hdd' && slot !== 'ram') {
      setTimeout(() => {
        if (currentStep < SLOTS.length - 1) {
          setCurrentStep(currentStep + 1)
        }
      }, 300)
    }
  }

  const updateQuantity = (slot: string, delta: number) => {
    setSelectedComponents(prev =>
      prev.map(c => {
        if (c.slot !== slot) return c
        const slotDef = SLOTS.find(s => s.slot === slot)
        const maxQty = slotDef?.maxQty || 1
        const newQty = Math.max(1, Math.min(maxQty, c.quantity + delta))
        return { ...c, quantity: newQty }
      })
    )
  }

  const updateQuantityForProduct = (slot: string, productId: string, delta: number) => {
    setSelectedComponents(prev =>
      prev.map(c => {
        if (c.slot !== slot || c.product.id !== productId) return c
        const slotDef = SLOTS.find(s => s.slot === slot)
        const maxQty = slotDef?.maxQty || 4
        const newQty = Math.max(1, Math.min(maxQty, c.quantity + delta))
        return { ...c, quantity: newQty }
      })
    )
  }

  const removeProduct = (slot: string, productId?: string) => {
    if (productId) {
      // Remove a specific product from a multi-disk slot
      setSelectedComponents(prev => prev.filter(c => !(c.slot === slot && c.product.id === productId)))
    } else {
      // Remove all products from the slot
      setSelectedComponents(prev => prev.filter(c => c.slot !== slot))
    }
  }

  const totalPrice = selectedComponents.reduce((sum, c) => sum + (c.product.comparePrice || c.product.price) * c.quantity, 0)
  const totalListPrice = selectedComponents.reduce((sum, c) => sum + c.product.price * c.quantity, 0)
  const completedRequired = SLOTS.filter(s => s.required).every(s => selectedComponents.some(c => c.slot === s.slot))
  const completedCount = selectedComponents.length

  // Separate compatible and incompatible products
  const compatibleProducts = products.filter(p => p.isCompatible !== false)
  const incompatibleProducts = products.filter(p => p.isCompatible === false)

  // Apply manual filters then search filter
  const manualFilteredCompatible = applyManualFilters(compatibleProducts, manualFilters, currentSlot.slot)
  const manualFilteredIncompatible = applyManualFilters(incompatibleProducts, manualFilters, currentSlot.slot)

  const filteredCompatible = manualFilteredCompatible.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )
  const filteredIncompatible = manualFilteredIncompatible.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  // Get available filter options for the current slot
  const currentSlotFilterOptions = SLOT_FILTERS[currentSlot.slot] || []
  // Group filter options by key for rendering
  const filterGroups = useMemo(() => {
    const groups: { key: string; label: string; options: FilterOption[] }[] = []
    const keyMap = new Map<string, FilterOption[]>()
    const keyLabels: Record<string, string> = {
      brand: 'Marca',
      socket: 'Socket',
      ddr: 'Memoria',
      type: 'Tipo',
      wattage: 'Potencia',
      size: 'Tamaño',
      hz: 'Frecuencia',
      resolution: 'Resolución',
      capacity: 'Capacidad',
      vram: 'VRAM',
      series: 'Serie',
    }
    for (const opt of currentSlotFilterOptions) {
      if (!keyMap.has(opt.key)) keyMap.set(opt.key, [])
      keyMap.get(opt.key)!.push(opt)
    }
    for (const [key, options] of keyMap) {
      groups.push({ key, label: keyLabels[key] || key, options })
    }
    return groups
  }, [currentSlot.slot])

  // Toggle a manual filter value (kept for backward compat)
  const toggleFilter = (key: string, value: string) => {
    setManualFilters(prev => {
      const current = prev[key] || []
      const isActive = current.includes(value)
      const updated = isActive ? current.filter(v => v !== value) : [...current, value]
      return { ...prev, [key]: updated }
    })
  }

  // Set a single-select filter value for a group (dropdown style)
  const setSelectFilter = (key: string, value: string) => {
    setManualFilters(prev => {
      if (value === '') {
        const { [key]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [key]: [value] }
    })
  }

  const clearFilters = () => setManualFilters({})
  const hasActiveFilters = Object.values(manualFilters).some(v => v.length > 0)

  const goNext = () => {
    if (currentStep < SLOTS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Generate WhatsApp message
  const buildWhatsAppUrl = () => {
    let msg = '🔧 *Quiero armar una PC a medida!*\n\n'
    selectedComponents.forEach(c => {
      const slotLabel = SLOTS.find(s => s.slot === c.slot)?.label || c.slot
      const unitPrice = c.product.comparePrice || c.product.price
      const totalPrice = unitPrice * c.quantity
      if (c.quantity > 1) {
        msg += `*${slotLabel}:* ${c.quantity}x ${c.product.name} - ${formatARS(unitPrice)} c/u = ${formatARS(totalPrice)}\n`
      } else {
        msg += `*${slotLabel}:* ${c.product.name} - ${formatARS(unitPrice)}\n`
      }
    })
    msg += `\n💰 *Total en efectivo:* ${formatARS(totalPrice)}\n`
    msg += `📋 *Total de lista:* ${formatARS(totalListPrice)}\n\n`
    msg += `Consulto por la disponibilidad y tiempo de armado. Gracias!`
    return `https://wa.me/5493548402056?text=${encodeURIComponent(msg)}`
  }

  // Generate PDF with selected components
  const generatePDF = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    let y = 10

    // Header - Compucity logo image
    // Logo: 547x220px, scale to fit header nicely
    const logoW = 55
    const logoH = (logoW * 220) / 547 // ~22.1
    doc.addImage(COMPUCITY_LOGO_BASE64, 'PNG', margin, y, logoW, logoH)

    // Date on the right
    const dateStr = new Date().toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text(dateStr, pageWidth - margin, y + 6, { align: 'right' })
    doc.text('Presupuesto generado en compucity.com.ar', pageWidth - margin, y + 12, { align: 'right' })

    y = y + logoH + 8

    // Green separator line
    doc.setDrawColor(58, 139, 104)
    doc.setLineWidth(1)
    doc.line(margin, y, pageWidth - margin, y)
    y += 8

    // Title
    doc.setTextColor(30, 30, 30)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('PC a Medida - Presupuesto', margin, y)
    y += 10

    // Separator line
    doc.setDrawColor(58, 139, 104)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    y += 8

    // Components list
    doc.setFontSize(11)
    selectedComponents.forEach(c => {
      const slotLabel = SLOTS.find(s => s.slot === c.slot)?.label || c.slot
      const unitPrice = c.product.comparePrice || c.product.price
      const lineTotal = unitPrice * c.quantity

      // Check if we need a new page
      if (y > 265) {
        doc.addPage()
        y = 20
      }

      // Slot label (green)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(58, 139, 104)
      doc.text(`${slotLabel}:`, margin, y)

      // Product name
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(50, 50, 50)
      const nameX = margin + 2
      const maxNameWidth = pageWidth - margin * 2 - 45
      const nameLines = doc.splitTextToSize(c.product.name, maxNameWidth)
      doc.text(nameLines[0], nameX, y + 5)

      // If name wraps to multiple lines, adjust y
      if (nameLines.length > 1) {
        for (let i = 1; i < nameLines.length; i++) {
          y += 5
          if (y > 265) { doc.addPage(); y = 20 }
          doc.text(nameLines[i], nameX, y + 5)
        }
      }

      // Price on the right
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 30, 30)
      const priceText = c.quantity > 1
        ? `${c.quantity}x ${formatARS(unitPrice)} c/u = ${formatARS(lineTotal)}`
        : formatARS(unitPrice)
      doc.text(priceText, pageWidth - margin, y + 5, { align: 'right' })

      y += 14
    })

    // Check if we need a new page for totals
    if (y > 240) {
      doc.addPage()
      y = 20
    }

    // Separator line before totals
    y += 2
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageWidth - margin, y)
    y += 8

    // Total de lista
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('Precio de lista:', margin, y)
    doc.setFont('helvetica', 'bold')
    doc.text(formatARS(totalListPrice), pageWidth - margin, y, { align: 'right' })
    y += 8

    // Total en efectivo (highlighted)
    doc.setFillColor(232, 245, 242) // #EFF5F2
    doc.roundedRect(margin - 3, y - 6, pageWidth - margin * 2 + 6, 14, 2, 2, 'F')
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(58, 139, 104)
    doc.text('Precio en efectivo:', margin, y)
    doc.text(formatARS(totalPrice), pageWidth - margin, y, { align: 'right' })
    y += 18

    // 96hs note
    if (y < 270) {
      doc.setFillColor(255, 248, 225)
      doc.roundedRect(margin - 3, y - 5, pageWidth - margin * 2 + 6, 12, 2, 2, 'F')
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(146, 100, 0)
      doc.text('El armado de los equipos puede tener una demora de hasta 96 horas hábiles.', margin, y + 2)
      y += 18
    }

    // Sesión 51 d4: textos legales adicionales (cambios de marca, stock, validez de precios, garantía)
    // Si no hay espacio suficiente, agregar nueva página
    if (y > 220) {
      doc.addPage()
      y = 20
    }

    // 1. Nota sobre variación de marcas por stock
    doc.setFontSize(7)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(100, 100, 100)
    const marcasText = 'LAS MARCAS DE LOS COMPONENTES UTILIZADOS PUEDEN VARIAR DE ACUERDO A LA DISPONIBILIDAD DE STOCK EN LOS PROVEEDORES, SIN PERJUICIO DE LAS PRESTACIONES DE LOS PRESUPUESTADOS Y VALORES DE LOS MISMOS. EN CASO DE CAMBIO NECESARIO POR FALTA DE STOCK Y VARIACIÓN EN LAS PRESTACIONES DE LOS DISPONIBLES, COMPUCITY SE COMUNICARÁ PARA INFORMAR DEL HECHO Y SOLICITAR CONFORMIDAD DEL CAMBIO Y VARIACIONES EN EL PRECIO.'
    const marcasLines = doc.splitTextToSize(marcasText, pageWidth - margin * 2)
    doc.text(marcasLines, margin, y)
    y += marcasLines.length * 3.5 + 4

    // 2. Link a política de garantía y devoluciones
    if (y > 280) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(58, 139, 104)
    doc.text('POLITICA DE GARANTIA Y DEVOLUCIONES', margin, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.textWithLink('https://www.compucityonline.com.ar/garantia-y-devoluciones', margin, y, {
      url: 'https://www.compucityonline.com.ar/garantia-y-devoluciones'
    })
    y += 8

    // 3. Antes de abonar consultar stock
    if (y > 285) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(180, 60, 60)
    doc.text('ANTES DE ABONAR CONSULTA POR DISPONIBILIDAD DE STOCK', margin, y)
    y += 7

    // 4. Validez de precios (7 días desde la fecha del presupuesto)
    if (y > 285) { doc.addPage(); y = 20 }
    const validezFecha = new Date()
    validezFecha.setDate(validezFecha.getDate() + 7)
    const validezStr = validezFecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(`PRECIOS VALIDOS HASTA EL ${validezStr} INCLUSIVE`, margin, y)
    y += 8

    // Footer on every page
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(150, 150, 150)
      doc.text('Compucity - Av. Sarmiento 462, La Falda, Córdoba | WhatsApp: 3548 40-2056', margin, 290)
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, 290, { align: 'right' })
    }

    // Download
    doc.save('Compucity-PC-a-Medida.pdf')
  }

  // Handle WhatsApp (no PDF)
  const handleWhatsApp = () => {
    window.open(buildWhatsAppUrl(), '_blank')
  }

  // Build compatibility info banner text
  const getFilterBanner = () => {
    if (currentSlot.slot === 'motherboard' && compatibilityFilters.socket) {
      const label = SOCKET_LABELS[compatibilityFilters.socket] || compatibilityFilters.socket
      return {
        icon: <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />,
        text: `Mostrando mothers compatibles con ${label}`,
        detail: selectedProcessor ? `Procesador: ${selectedProcessor.product.name}` : undefined,
      }
    }
    if (currentSlot.slot === 'ram' && compatibilityFilters.ddr) {
      return {
        icon: <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />,
        text: `Mostrando memorias ${compatibilityFilters.ddr} (compatibles con tu mother)`,
        detail: selectedMotherboard ? `Mother: ${selectedMotherboard.product.name}` : undefined,
      }
    }
    if (currentSlot.slot === 'psu' && compatibilityFilters.minWattage) {
      return {
        icon: <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />,
        text: `Se recomienda fuente de ${compatibilityFilters.minWattage}W o más para tu placa de video`,
        detail: selectedGpu ? `GPU: ${selectedGpu.product.name}` : undefined,
      }
    }
    return null
  }

  const filterBanner = getFilterBanner()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Arma tu PC a medida</h1>
          <p className="text-gray-300">Elegí los componentes y te la armamos. Envíos a todo el país.</p>
          <div className="mt-3 flex items-start gap-2 text-sm bg-amber-900/40 border border-amber-500/30 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span className="text-amber-200">
              El armado de los equipos puede tener una demora de hasta <strong>96 horas hábiles</strong>.
            </span>
          </div>
          {processorInfo?.socket && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4 text-green-400" />
              <span className="text-green-300">
                Filtrado por compatibilidad activado
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 pb-32 lg:pb-6 overflow-x-hidden">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* ============================================ */}
          {/* Left: Stepper + Product Selection */}
          {/* ============================================ */}
          <div className={`flex-1 min-w-0 max-w-full ${showMobileSummary ? 'hidden lg:block' : ''}`}>
            {/* Step Indicator - Horizontal on desktop, progress on mobile */}
            <div className="bg-white rounded-xl border p-4 mb-6 overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max">
                {SLOTS.map((slot, idx) => {
                  const Icon = slot.icon
                  const isSelected = selectedComponents.some(c => c.slot === slot.slot)
                  const isCurrent = idx === currentStep
                  // Check if this slot has a compatibility filter active
                  const hasFilter =
                    (slot.slot === 'motherboard' && !!compatibilityFilters.socket) ||
                    (slot.slot === 'ram' && !!compatibilityFilters.ddr) ||
                    (slot.slot === 'psu' && !!compatibilityFilters.minWattage)
                  const hasManualFilter = slot.slot === currentSlot.slot && hasActiveFilters
                  return (
                    <button
                      key={slot.slot}
                      onClick={() => setCurrentStep(idx)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                        isCurrent
                          ? 'bg-compucity-green text-white shadow-md'
                          : isSelected
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : hasFilter
                          ? 'bg-blue-50 text-blue-600 border border-blue-200'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {isSelected ? (
                        <Check className="h-3.5 w-3.5 shrink-0" />
                      ) : hasManualFilter ? (
                        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                      ) : hasFilter ? (
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="hidden sm:inline">{slot.label}</span>
                      {slot.required && !isSelected && (
                        <span className="text-[10px] text-red-400">*</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Current Step Header */}
            <div className="bg-white rounded-xl border p-5 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-compucity-green-100 text-compucity-green flex items-center justify-center">
                    {(() => { const Icon = currentSlot.icon; return <Icon className="h-5 w-5" /> })()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {currentSlot.label}
                      {currentSlot.required && <span className="text-red-500 ml-1">*</span>}
                    </h2>
                    <p className="text-sm text-gray-500">
                      Paso {currentStep + 1} de {SLOTS.length}
                      {!currentSlot.required && ' · Opcional'}
                    </p>
                  </div>
                </div>
                {selectedForCurrentSlot.length > 0 && !isMultiDiskSlot && (
                  <button
                    onClick={() => removeProduct(currentSlot.slot)}
                    className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                    Quitar
                  </button>
                )}
                {selectedForCurrentSlot.length > 0 && isMultiDiskSlot && (
                  <button
                    onClick={() => removeProduct(currentSlot.slot)}
                    className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                    Quitar todo
                  </button>
                )}
              </div>

              {/* Currently selected for this slot */}
              {selectedForCurrentSlot.length > 0 && !isMultiDiskSlot && (() => {
                const sel = selectedForCurrentSlot[0]
                return (
                  <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-900 truncate">{sel.product.name}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-green-700">
                          Efectivo: {formatARS((sel.product.comparePrice || sel.product.price) * sel.quantity)}
                          {sel.quantity > 1 && (
                            <span className="text-green-500 ml-1">
                              ({sel.quantity}x {formatARS(sel.product.comparePrice || sel.product.price)} c/u)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    {/* Quantity selector for slots that allow multiple */}
                    {currentSlot.maxQty > 1 && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); updateQuantity(currentSlot.slot, -1) }}
                          className="w-7 h-7 rounded-md bg-white border border-green-300 flex items-center justify-center text-green-700 hover:bg-green-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={sel.quantity <= 1}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center text-sm font-bold text-green-800">{sel.quantity}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateQuantity(currentSlot.slot, 1) }}
                          className="w-7 h-7 rounded-md bg-white border border-green-300 flex items-center justify-center text-green-700 hover:bg-green-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={sel.quantity >= currentSlot.maxQty}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Multi-disk selected list (SSD/HDD) */}
              {selectedForCurrentSlot.length > 0 && isMultiDiskSlot && (
                <div className="mt-3 space-y-2">
                  {selectedForCurrentSlot.map(sel => (
                    <div key={sel.product.id} className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
                      <Check className="h-5 w-5 text-green-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-green-900 truncate">{sel.product.name}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-green-700">
                            Efectivo: {formatARS((sel.product.comparePrice || sel.product.price) * sel.quantity)}
                            {sel.quantity > 1 && (
                              <span className="text-green-500 ml-1">
                                ({sel.quantity}x {formatARS(sel.product.comparePrice || sel.product.price)} c/u)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      {/* Per-product quantity selector */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); updateQuantityForProduct(currentSlot.slot, sel.product.id, -1) }}
                          className="w-7 h-7 rounded-md bg-white border border-green-300 flex items-center justify-center text-green-700 hover:bg-green-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={sel.quantity <= 1}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center text-sm font-bold text-green-800">{sel.quantity}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateQuantityForProduct(currentSlot.slot, sel.product.id, 1) }}
                          className="w-7 h-7 rounded-md bg-white border border-green-300 flex items-center justify-center text-green-700 hover:bg-green-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={sel.quantity >= currentSlot.maxQty}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {/* Per-product remove button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeProduct(currentSlot.slot, sel.product.id) }}
                        className="text-red-400 hover:text-red-600 transition shrink-0"
                        title="Quitar este disco"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Compatibility Filter Banner */}
            {filterBanner && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-2">
                  {filterBanner.icon}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-800">{filterBanner.text}</p>
                    {filterBanner.detail && (
                      <p className="text-xs text-blue-600 mt-0.5">{filterBanner.detail}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder={`Buscar ${currentSlot.label.toLowerCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Chips */}
            {filterGroups.length > 0 && (
              <div className="bg-white rounded-xl border p-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filtros</span>
                  </div>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-xs text-red-500 hover:text-red-700 font-medium transition"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {filterGroups.map(group => {
                    const selectedValue = (manualFilters[group.key] || [])[0] || ''
                    return (
                      <div key={group.key} className="relative">
                        <select
                          value={selectedValue}
                          onChange={(e) => setSelectFilter(group.key, e.target.value)}
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
                {hasActiveFilters && (
                  <p className="text-[11px] text-gray-400 mt-2">
                    Mostrando {filteredCompatible.length + filteredIncompatible.length} de {compatibleProducts.length + incompatibleProducts.length} productos
                  </p>
                )}
              </div>
            )}

            {/* Product List */}
            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-16 bg-white rounded-xl border">
                  <Loader2 className="w-8 h-8 animate-spin text-compucity-green" />
                </div>
              ) : filteredCompatible.length === 0 && filteredIncompatible.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border">
                  <Cpu className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 mb-1">No hay productos disponibles</p>
                  <p className="text-sm text-gray-400">
                    {products.length === 0
                      ? 'Próximamente agregaremos productos de esta categoría'
                      : 'No se encontraron resultados para tu búsqueda'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Compatible products */}
                  {filteredCompatible.map((product) => {
                    const isSelected = selectedForCurrentSlot.some(c => c.product.id === product.id)
                    const image = safeParseFirstImage(product.images)
                    const specs = parseSpecs(product.specs)
                    const specEntries = getVisibleSpecs(specs).slice(0, 4)
                    const compatInfo = product.compatInfo

                    return (
                      <button
                        key={product.id}
                        onClick={() => selectProduct(product)}
                        className={`w-full text-left bg-white rounded-xl border p-4 flex items-start gap-4 transition hover:shadow-md ${
                          isSelected
                            ? 'border-compucity-green bg-compucity-green-50/50 ring-2 ring-compucity-green-100'
                            : 'border-gray-200 hover:border-compucity-green-100'
                        }`}
                      >
                        {/* Image */}
                        <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                          {image ? (
                            <img src={image} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <Cpu className="w-6 h-6" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 text-sm mb-1 line-clamp-2">{product.name}</h3>
                          {/* Compatibility badges */}
                          {compatInfo && (compatInfo.socket || compatInfo.ddr) && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {compatInfo.socket && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                                  <ShieldCheck className="w-3 h-3" />
                                  {SOCKET_LABELS[compatInfo.socket] || compatInfo.socket}
                                </span>
                              )}
                              {compatInfo.ddr && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                                  <Zap className="w-3 h-3" />
                                  {compatInfo.ddr}
                                </span>
                              )}
                              {compatInfo.wattage && currentSlot.slot === 'psu' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                                  <Zap className="w-3 h-3" />
                                  {compatInfo.wattage}W
                                </span>
                              )}
                            </div>
                          )}
                          {specEntries.length > 0 && (
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-2">
                              {specEntries.map(([key, value]) => (
                                <span key={key} className="text-xs text-gray-500">
                                  <span className="text-gray-400">{key}:</span> {value}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400">Lista: {formatARS(product.price)}</span>
                            {product.comparePrice && product.comparePrice < product.price && (
                              <span className="text-sm font-bold text-green-600">
                                Efectivo: {formatARS(product.comparePrice)}
                              </span>
                            )}
                            {!product.comparePrice && (
                              <span className="text-sm font-bold text-gray-900">{formatARS(product.price)}</span>
                            )}

                          </div>
                        </div>

                        {/* Selection indicator */}
                        <div className="shrink-0 mt-1">
                          {isSelected ? (
                            <div className="w-8 h-8 rounded-full bg-compucity-green flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center group-hover:border-compucity-cyan-light transition">
                              <Plus className="w-4 h-4 text-gray-300" />
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}

                  {/* Incompatible products toggle */}
                  {filteredIncompatible.length > 0 && (
                    <div className="mt-4">
                      <button
                        onClick={() => setShowIncompatible(!showIncompatible)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium hover:bg-amber-100 transition"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        {showIncompatible
                          ? 'Ocultar productos no compatibles'
                          : `${filteredIncompatible.length} producto${filteredIncompatible.length > 1 ? 's' : ''} no compatible${filteredIncompatible.length > 1 ? 's' : ''} (ver todos)`}
                      </button>

                      {showIncompatible && (
                        <div className="mt-2 space-y-2">
                          {filteredIncompatible.map((product) => {
                            const isSelected = selectedForCurrentSlot.some(c => c.product.id === product.id)
                            const image = safeParseFirstImage(product.images)
                            const specs = parseSpecs(product.specs)
                            const specEntries = getVisibleSpecs(specs).slice(0, 4)
                            const compatInfo = product.compatInfo

                            // Determine incompatibility reason
                            let reason = ''
                            if (currentSlot.slot === 'motherboard' && compatibilityFilters.socket && compatInfo?.socket && compatInfo.socket !== compatibilityFilters.socket) {
                              reason = `Socket ${compatInfo.socket} no compatible con tu procesador (${SOCKET_LABELS[compatibilityFilters.socket] || compatibilityFilters.socket})`
                            } else if (currentSlot.slot === 'ram' && compatibilityFilters.ddr && compatInfo?.ddr && compatInfo.ddr !== compatibilityFilters.ddr) {
                              reason = `${compatInfo.ddr} no compatible con tu mother (requiere ${compatibilityFilters.ddr})`
                            } else if (currentSlot.slot === 'ram' && compatInfo?.ddrType === 'sodimm' && !compatibilityFilters.ddr) {
                              reason = 'Memoria SODIMM (notebook), no compatible con PCs de escritorio'
                            } else if (currentSlot.slot === 'psu' && compatibilityFilters.minWattage && compatInfo?.wattage && compatInfo.wattage < compatibilityFilters.minWattage) {
                              reason = `${compatInfo.wattage}W insuficiente (se recomienda ${compatibilityFilters.minWattage}W+ para tu placa de video)`
                            }

                            return (
                              <button
                                key={product.id}
                                onClick={() => selectProduct(product)}
                                className={`w-full text-left bg-white rounded-xl border p-4 flex items-start gap-4 transition hover:shadow-md opacity-60 hover:opacity-80 ${
                                  isSelected
                                    ? 'border-amber-400 bg-amber-50/50'
                                    : 'border-amber-200 hover:border-amber-300'
                                }`}
                              >
                                {/* Image */}
                                <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                                  {image ? (
                                    <img src={image} alt={product.name} className="w-full h-full object-cover grayscale" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                                      <Cpu className="w-6 h-6" />
                                    </div>
                                  )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-medium text-gray-700 text-sm mb-1 line-clamp-2">{product.name}</h3>
                                  {/* Incompatibility reason */}
                                  {reason && (
                                    <div className="flex items-start gap-1.5 mb-2 p-1.5 rounded bg-amber-50 border border-amber-100">
                                      <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                                      <span className="text-[11px] text-amber-700">{reason}</span>
                                    </div>
                                  )}
                                  {specEntries.length > 0 && (
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-2">
                                      {specEntries.map(([key, value]) => (
                                        <span key={key} className="text-xs text-gray-500">
                                          <span className="text-gray-400">{key}:</span> {value}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-400">Lista: {formatARS(product.price)}</span>
                                    {product.comparePrice && product.comparePrice < product.price && (
                                      <span className="text-sm font-bold text-gray-500">
                                        Efectivo: {formatARS(product.comparePrice)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Selection indicator */}
                                <div className="shrink-0 mt-1">
                                  {isSelected ? (
                                    <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center">
                                      <AlertTriangle className="w-4 h-4 text-white" />
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 rounded-full border-2 border-amber-200 flex items-center justify-center">
                                      <Plus className="w-4 h-4 text-amber-300" />
                                    </div>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center justify-between mt-4">
              <Button
                variant="outline"
                onClick={goPrev}
                disabled={currentStep === 0}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>

              {currentStep < SLOTS.length - 1 ? (
                <Button onClick={goNext} className="bg-compucity-green hover:bg-compucity-green-dark gap-2">
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      if (completedRequired) {
                        handleAddToCart()
                      }
                    }}
                    className="bg-compucity-green hover:bg-compucity-green-dark gap-2"
                    disabled={!completedRequired}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Sumar al carrito
                  </Button>
                  <Button
                    onClick={() => {
                      if (completedRequired) {
                        handleWhatsApp()
                      }
                    }}
                    className="bg-[#25D366] hover:bg-[#20BD5A] gap-2"
                    disabled={!completedRequired}
                  >
                    <WhatsAppIcon className="w-4 h-4" />
                    WhatsApp
                  </Button>
                  <Button
                    onClick={() => {
                      if (completedRequired) {
                        generatePDF()
                      }
                    }}
                    variant="outline"
                    className="gap-2"
                    disabled={!completedRequired}
                  >
                    <Download className="w-4 h-4" />
                    PDF
                  </Button>
                </div>
              )}
            </div>

            {/* Desktop Skip optional */}
            {!currentSlot.required && currentStep < SLOTS.length - 1 && (
              <div className="hidden lg:block text-center mt-3">
                <button
                  onClick={goNext}
                  className="text-sm text-gray-400 hover:text-gray-600 transition"
                >
                  Saltar este paso →
                </button>
              </div>
            )}
          </div>

          {/* ============================================ */}
          {/* Right: Summary Sidebar */}
          {/* ============================================ */}
          <div className={`w-full lg:w-80 shrink-0 ${!showMobileSummary ? 'hidden lg:block' : ''}`}>
            <div className="bg-white rounded-xl border lg:sticky lg:top-24">
              {/* Summary Header */}
              <div className="p-5 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Tu PC a medida</h3>
                    <p className="text-sm text-gray-500">{completedCount} de {SLOTS.length} componentes</p>
                  </div>
                  {/* Mobile: Back button */}
                  <Button
                    variant="ghost"
                    onClick={() => setShowMobileSummary(false)}
                    className="lg:hidden gap-1 text-sm text-gray-500 hover:text-gray-700 -mr-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Volver
                  </Button>
                </div>
              </div>

              {/* Compatibility Status */}
              {(processorInfo || motherboardInfo) && (
                <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
                  <div className="flex items-center gap-2 mb-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-semibold text-blue-800">Compatibilidad</span>
                  </div>
                  <div className="space-y-1">
                    {processorInfo?.socket && (
                      <p className="text-[11px] text-blue-700">
                        Procesador: {SOCKET_LABELS[processorInfo.socket] || processorInfo.socket}
                      </p>
                    )}
                    {motherboardInfo?.ddr && (
                      <p className="text-[11px] text-blue-700">
                        Memoria: {motherboardInfo.ddr} requerida
                      </p>
                    )}
                    {gpuInfo?.wattage && (
                      <p className="text-[11px] text-blue-700">
                        Fuente recomendada: {gpuInfo.wattage}W+
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Selected Components List */}
              <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
                {SLOTS.map((slot) => {
                  const selected = selectedComponents.find(c => c.slot === slot.slot)
                  const Icon = slot.icon

                  if (selected) {
                    const unitPrice = selected.product.comparePrice || selected.product.price
                    const lineTotal = unitPrice * selected.quantity
                    return (
                      <div key={slot.slot} className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                        <Icon className="w-4 h-4 text-green-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-green-700 font-medium">
                            {slot.label}
                            {selected.quantity > 1 && <span className="ml-1 text-green-500">({selected.quantity}u)</span>}
                          </p>
                          <p className="text-xs text-green-900 truncate">{selected.product.name}</p>
                        </div>
                        <span className="text-xs font-medium text-green-700 whitespace-nowrap">
                          {formatARS(lineTotal)}
                        </span>
                      </div>
                    )
                  }

                  // Show filtered status for unselected slots
                  const hasFilter =
                    (slot.slot === 'motherboard' && !!compatibilityFilters.socket) ||
                    (slot.slot === 'ram' && !!compatibilityFilters.ddr) ||
                    (slot.slot === 'psu' && !!compatibilityFilters.minWattage)

                  return (
                    <div key={slot.slot} className={`flex items-center gap-2 p-2 rounded-lg ${hasFilter ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}>
                      {hasFilter ? (
                        <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                      ) : (
                        <Icon className="w-4 h-4 text-gray-300 shrink-0" />
                      )}
                      <span className={`text-xs flex-1 ${hasFilter ? 'text-blue-600' : 'text-gray-400'}`}>
                        {slot.label}
                        {slot.slot === 'motherboard' && compatibilityFilters.socket && (
                          <span className="text-blue-500 ml-1">({SOCKET_LABELS[compatibilityFilters.socket] || compatibilityFilters.socket})</span>
                        )}
                        {slot.slot === 'ram' && compatibilityFilters.ddr && (
                          <span className="text-blue-500 ml-1">({compatibilityFilters.ddr})</span>
                        )}
                        {slot.slot === 'psu' && compatibilityFilters.minWattage && (
                          <span className="text-blue-500 ml-1">({compatibilityFilters.minWattage}W+)</span>
                        )}
                      </span>
                      {slot.required && <span className="text-[10px] text-red-400">Requerido</span>}
                    </div>
                  )
                })}
              </div>

              {/* Totals */}
              <div className="p-5 border-t space-y-2">
                {totalListPrice > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Precio de lista</span>
                    <span className="text-gray-900">{formatARS(totalListPrice)}</span>
                  </div>
                )}
                {totalPrice > 0 && totalPrice < totalListPrice && (
                  <div className="flex items-center justify-between">
                    <span className="text-green-700 font-medium">Precio en efectivo</span>
                    <span className="text-green-700 font-bold text-lg">{formatARS(totalPrice)}</span>
                  </div>
                )}
                {totalPrice === 0 && (
                  <div className="text-center text-sm text-gray-400 py-2">
                    Seleccioná componentes para ver el total
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-5 border-t space-y-3">
                {completedCount > 0 && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span>El armado de los equipos puede tener una demora de hasta <strong>96 horas hábiles</strong>.</span>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      if (completedCount > 0) handleAddToCart()
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition ${
                      completedCount > 0
                        ? 'bg-compucity-green hover:bg-compucity-green-dark text-white cursor-pointer'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={completedCount === 0}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Sumar al carrito
                  </button>
                  <a
                    href={completedCount > 0 ? buildWhatsAppUrl() : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm transition ${
                      completedCount > 0
                        ? 'bg-[#25D366] hover:bg-[#20BD5A] text-white cursor-pointer'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                    onClick={(e) => {
                      if (completedCount === 0) {
                        e.preventDefault()
                      }
                    }}
                  >
                    <WhatsAppIcon className="w-4 h-4" />
                    Consultar por WhatsApp
                  </a>
                  <button
                    onClick={() => {
                      if (completedCount > 0) generatePDF()
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition ${
                      completedCount > 0
                        ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={completedCount === 0}
                  >
                    <Download className="w-4 h-4" />
                    Descargar PDF
                  </button>
                  {/* Notificación agregado al carrito */}
                  {addedToCart && (
                    <div className="bg-compucity-green-50 border border-compucity-green-200 rounded-lg p-3 flex items-center justify-between gap-3">
                      <p className="text-sm text-compucity-green-dark font-medium">✓ Componentes agregados al carrito</p>
                      <Link href="/carrito" prefetch={false} className="text-xs text-white bg-compucity-green hover:bg-compucity-green-dark px-3 py-1.5 rounded-lg font-medium transition">
                        Ir al carrito
                      </Link>
                    </div>
                  )}
                </div>

                {completedCount > 0 && (
                  <button
                    onClick={() => {
                      setSelectedComponents([])
                      setCurrentStep(0)
                    }}
                    className="w-full text-sm text-gray-400 hover:text-red-500 transition py-1"
                  >
                    Limpiar selección
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* Mobile Sticky Bottom Bar */}
        {/* ============================================ */}
        {!showMobileSummary && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] z-50 safe-area-bottom">
            {/* Ver Tu PC a medida */}
            <div className="px-3 pt-2">
              <Button
                onClick={() => setShowMobileSummary(true)}
                className="w-full bg-compucity-green hover:bg-compucity-green-dark gap-2 py-2.5 text-sm"
              >
                <ShoppingCart className="w-4 h-4" />
                Ver Tu PC a medida{completedCount > 0 ? ` (${completedCount})` : ''}
              </Button>
            </div>
            {/* Navigation row */}
            <div className="flex items-center gap-2 px-3 py-2">
              <Button
                variant="outline"
                onClick={goPrev}
                disabled={currentStep === 0}
                className="gap-1 flex-1 h-9 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Anterior
              </Button>
              {!currentSlot.required && currentStep < SLOTS.length - 1 && (
                <Button
                  variant="ghost"
                  onClick={goNext}
                  className="text-xs text-gray-400 h-9"
                >
                  Saltar →
                </Button>
              )}
              {currentStep < SLOTS.length - 1 ? (
                <Button onClick={goNext} className="bg-compucity-green hover:bg-compucity-green-dark gap-1 flex-1 h-9 text-xs">
                  Siguiente
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <div className="flex gap-1 flex-1">
                  <Button
                    onClick={() => {
                      if (completedRequired) {
                        generatePDF()
                      }
                    }}
                    variant="outline"
                    className="gap-1 h-9 text-xs flex-1"
                    disabled={!completedRequired}
                  >
                    <Download className="w-3.5 h-3.5" />
                    PDF
                  </Button>
                  <Button
                    onClick={() => {
                      if (completedRequired) {
                        handleWhatsApp()
                      }
                    }}
                    className="bg-[#25D366] hover:bg-[#20BD5A] gap-1 h-9 text-xs flex-1"
                    disabled={!completedRequired}
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5" />
                    WhatsApp
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* AI Assistant Chat */}
      <PCAssistantChat
        onLoadBuild={(components) => {
          setSelectedComponents(components)
          setCurrentStep(0)
        }}
      />
    </div>
  )
}
