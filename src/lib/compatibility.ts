/**
 * Compatibility system for the PC Builder.
 * Extracts socket, DDR type, and wattage from product names
 * to enable compatibility filtering between components.
 */

// ============================================
// Types
// ============================================

export interface CompatibilityInfo {
  socket?: string       // AM4, AM5, 1700, 1851
  ddr?: string          // DDR4, DDR5
  ddrType?: 'desktop' | 'sodimm'  // Desktop DIMM or laptop SODIMM
  wattage?: number      // PSU wattage in watts
  gpuTdp?: number       // Estimated GPU TDP in watts
  cpuTdp?: number       // Estimated CPU TDP in watts
  brand?: string        // AMD or Intel (for processors)
  sockets?: string[]    // For coolers: list of supported sockets
  coolingCapacity?: number // Cooler TDP capacity in watts
  coolerType?: 'air' | 'aio' | 'fan'  // Type of cooling product
}

export interface CompatibilityFilters {
  socket?: string       // Filter motherboards/cooling by processor socket
  ddr?: string          // Filter RAM by motherboard DDR type
  minWattage?: number   // Filter PSUs by minimum wattage (based on GPU)
  cpuTdp?: number       // Filter cooling by minimum TDP capacity (based on CPU)
}

// ============================================
// Extraction Functions
// ============================================

/**
 * Extract compatibility info from a processor name.
 * Examples:
 *   "Procesador AMD Ryzen 5 5600GT AM4 con Video con Cooler" → { socket: "AM4", brand: "AMD" }
 *   "Procesador Intel Core i5-12400F Alder Lake S1700" → { socket: "1700", brand: "Intel" }
 *   "Procesador Intel Core Ultra 5 225 S1851" → { socket: "1851", brand: "Intel" }
 */
export function extractProcessorCompatibility(name: string): CompatibilityInfo {
  const upper = name.toUpperCase()

  // Brand detection
  const brand = upper.includes('AMD') ? 'AMD' : upper.includes('INTEL') ? 'Intel' : undefined

  // Socket detection
  let socket: string | undefined

  // AMD sockets
  if (/\bAM5\b/i.test(upper)) {
    socket = 'AM5'
  } else if (/\bAM4\b/i.test(upper)) {
    socket = 'AM4'
  }

  // Intel sockets - S1700, S1851, or just 1700/1851 in context
  if (/\bS?1851\b/i.test(upper)) {
    socket = '1851'
  } else if (/\bS?1700\b/i.test(upper)) {
    socket = '1700'
  }

  // Fallback: Intel brand implies at least LGA1700 if not detected
  if (!socket && brand === 'Intel') {
    socket = '1700' // Default for Intel processors without explicit socket
  }

  // TDP estimation based on processor model
  const cpuTdp = estimateProcessorTdp(name, brand, socket)

  return { socket, brand, cpuTdp }
}

/**
 * Estimate processor TDP from the name.
 * This is a conservative estimate based on common models.
 */
export function estimateProcessorTdp(name: string, brand?: string, socket?: string): number {
  const upper = name.toUpperCase()

  // Specific model TDP estimates (conservative, max turbo power considered)
  const tdpMap: { pattern: RegExp; tdp: number }[] = [
    // AMD Ryzen 9 / high-end Ryzen 7
    { pattern: /\bRYZEN\s*9\s*9900X\b/i, tdp: 120 },
    { pattern: /\bRYZEN\s*9\s*7900X\b/i, tdp: 170 },
    { pattern: /\bRYZEN\s*9\s*5900XT\b/i, tdp: 105 },
    { pattern: /\bRYZEN\s*7\s*9800X3D\b/i, tdp: 120 },
    { pattern: /\bRYZEN\s*7\s*9850X3D\b/i, tdp: 120 },
    { pattern: /\bRYZEN\s*7\s*7800X3D\b/i, tdp: 120 },
    { pattern: /\bRYZEN\s*7\s*7700X\b/i, tdp: 105 },
    { pattern: /\bRYZEN\s*7\s*9700X\b/i, tdp: 105 },
    { pattern: /\bRYZEN\s*7\s*7900X\b/i, tdp: 170 },
    // AMD Ryzen 7 mid-range
    { pattern: /\bRYZEN\s*7\s*7700\b/i, tdp: 65 },
    { pattern: /\bRYZEN\s*7\s*8700[FG]\b/i, tdp: 65 },
    { pattern: /\bRYZEN\s*7\s*5700X\b/i, tdp: 105 },
    { pattern: /\bRYZEN\s*7\s*5700G\b/i, tdp: 65 },
    { pattern: /\bRYZEN\s*7\s*5700\b/i, tdp: 65 },
    // AMD Ryzen 5
    { pattern: /\bRYZEN\s*5\s*9600X\b/i, tdp: 65 },
    { pattern: /\bRYZEN\s*5\s*7600X\b/i, tdp: 105 },
    { pattern: /\bRYZEN\s*5\s*9600\b/i, tdp: 65 },
    { pattern: /\bRYZEN\s*5\s*8600G\b/i, tdp: 65 },
    { pattern: /\bRYZEN\s*5\s*8400F\b/i, tdp: 65 },
    { pattern: /\bRYZEN\s*5\s*8500G\b/i, tdp: 65 },
    { pattern: /\bRYZEN\s*5\s*5600GT\b/i, tdp: 65 },
    { pattern: /\bRYZEN\s*5\s*5500\b/i, tdp: 65 },
    // AMD Ryzen 3
    { pattern: /\bRYZEN\s*3\s*3200G\b/i, tdp: 65 },
    // Intel Core Ultra 9
    { pattern: /\bULTRA\s*9\s*285K\b/i, tdp: 125 },
    // Intel Core Ultra 7
    { pattern: /\bULTRA\s*7\s*265KF\b/i, tdp: 125 },
    { pattern: /\bULTRA\s*7\s*265[FK]?\b/i, tdp: 125 },
    // Intel Core Ultra 5
    { pattern: /\bULTRA\s*5\s*250KF\b/i, tdp: 125 },
    { pattern: /\bULTRA\s*5\s*250K\b/i, tdp: 125 },
    { pattern: /\bULTRA\s*5\s*245KF\b/i, tdp: 125 },
    { pattern: /\bULTRA\s*5\s*245K\b/i, tdp: 125 },
    { pattern: /\bULTRA\s*5\s*225F\b/i, tdp: 65 },
    { pattern: /\bULTRA\s*5\s*225\b/i, tdp: 65 },
    // Intel Core i9
    { pattern: /\bI9[-\s]*14900F?\b/i, tdp: 125 },
    // Intel Core i7
    { pattern: /\bI7[-\s]*14700F?\b/i, tdp: 125 },
    { pattern: /\bI7[-\s]*12700F?\b/i, tdp: 125 },
    // Intel Core i5
    { pattern: /\bI5[-\s]*14400\b/i, tdp: 65 },
    { pattern: /\bI5[-\s]*12400F\b/i, tdp: 65 },
    // Intel Core i3
    { pattern: /\bI3[-\s]*14100F\b/i, tdp: 58 },
    { pattern: /\bI3[-\s]*12100F\b/i, tdp: 58 },
  ]

  for (const entry of tdpMap) {
    if (entry.pattern.test(upper)) {
      return entry.tdp
    }
  }

  // Fallback TDP by brand and socket
  if (brand === 'Intel') {
    if (socket === '1851') return 125 // Arrow/Lunar Lake tends to be hotter
    if (socket === '1700') return 65   // Alder/Raptor Lake i5/i7 default
  }
  if (brand === 'AMD') {
    if (socket === 'AM5') return 65     // Ryzen 7000/9000 default
    if (socket === 'AM4') return 65     // Ryzen 5000 default
  }

  return 65 // Conservative default
}

/**
 * Extract compatibility info from a motherboard name.
 * Examples:
 *   "Mother Gigabyte B550M DS3H Ac R2 DDR4 AM4" → { socket: "AM4", ddr: "DDR4" }
 *   "Mother MSI B760M Gaming Plus WiFi DDR5 1700" → { socket: "1700", ddr: "DDR5" }
 *   "Mother Gigabyte B860M Eagle WIFI6 DDR5 1851" → { socket: "1851", ddr: "DDR5" }
 */
export function extractMotherboardCompatibility(name: string): CompatibilityInfo {
  const upper = name.toUpperCase()

  // DDR type detection
  let ddr: string | undefined
  if (/\bDDR5\b/i.test(upper)) {
    ddr = 'DDR5'
  } else if (/\bDDR4\b/i.test(upper)) {
    ddr = 'DDR4'
  } else if (/\bDDR3\b/i.test(upper)) {
    ddr = 'DDR3'
  }

  // Socket detection
  let socket: string | undefined

  // AMD sockets
  if (/\bAM5\b/i.test(upper)) {
    socket = 'AM5'
  } else if (/\bAM4\b/i.test(upper)) {
    socket = 'AM4'
  }

  // Intel sockets
  if (/\b1851\b/i.test(upper)) {
    socket = '1851'
  } else if (/\b1700\b/i.test(upper)) {
    socket = '1700'
  }

  // Fallback: if not detected, try chipset-based inference
  if (!socket) {
    // B850, B840, X870, B650, A620 → AM5
    if (/\b(B850|B840|X870|B650|A620)\b/i.test(upper)) {
      socket = 'AM5'
    }
    // B550, A520 → AM4
    else if (/\b(B550|A520)\b/i.test(upper)) {
      socket = 'AM4'
    }
    // B860, Z890, H810 → 1851
    else if (/\b(B860|Z890|H810)\b/i.test(upper)) {
      socket = '1851'
    }
    // B760, H610 → 1700
    else if (/\b(B760|H610)\b/i.test(upper)) {
      socket = '1700'
    }
  }

  return { socket, ddr }
}

/**
 * Extract compatibility info from a RAM name.
 * Examples:
 *   "Memoria DDR4 Kingston 16GB 3200 Mhz FURY BEAST" → { ddr: "DDR4", ddrType: "desktop" }
 *   "Memoria DDR5 Corsair 16GB 6000 Mhz" → { ddr: "DDR5", ddrType: "desktop" }
 *   "Memoria Sodimm DDR4 Kingston 8GB 3200 Mhz" → { ddr: "DDR4", ddrType: "sodimm" }
 */
export function extractRamCompatibility(name: string): CompatibilityInfo {
  const upper = name.toUpperCase()

  // DDR type detection
  let ddr: string | undefined
  if (/\bDDR5\b/i.test(upper)) {
    ddr = 'DDR5'
  } else if (/\bDDR4\b/i.test(upper)) {
    ddr = 'DDR4'
  } else if (/\bDDR3\b/i.test(upper)) {
    ddr = 'DDR3'
  }

  // SODIMM detection (laptop RAM, not compatible with desktop motherboards)
  const isSodimm = /\bSODIMM\b/i.test(upper)
  const ddrType: 'desktop' | 'sodimm' = isSodimm ? 'sodimm' : 'desktop'

  return { ddr, ddrType }
}

/**
 * Extract wattage from a PSU name.
 * Examples:
 *   "Fuente Corsair RM750x Shift 750W 80 Plus Gold" → { wattage: 750 }
 *   "Fuente Raptor Volt 500W 80 Plus Bronze" → { wattage: 500 }
 */
export function extractPsuCompatibility(name: string): CompatibilityInfo {
  const match = name.match(/(\d{3,4})\s*W/i)
  return { wattage: match ? parseInt(match[1]) : undefined }
}

/**
 * Estimate GPU TDP from the name and recommend minimum PSU wattage.
 * This is a rough estimate based on common GPU models.
 */
export function extractGpuCompatibility(name: string): CompatibilityInfo {
  const upper = name.toUpperCase()

  // GPU TDP estimates (approximate, conservative)
  const gpuTdpMap: { pattern: RegExp; tdp: number; minPsu: number }[] = [
    // NVIDIA RTX 50 series
    { pattern: /\bRTX\s*5090\b/i, tdp: 575, minPsu: 1000 },
    { pattern: /\bRTX\s*5080\b/i, tdp: 360, minPsu: 850 },
    { pattern: /\bRTX\s*5070\b/i, tdp: 250, minPsu: 750 },
    { pattern: /\bRTX\s*5060\s*TI\b/i, tdp: 200, minPsu: 650 },
    { pattern: /\bRTX\s*5060\b/i, tdp: 175, minPsu: 600 },
    { pattern: /\bRTX\s*5050\b/i, tdp: 150, minPsu: 550 },
    // NVIDIA RTX 40 series
    { pattern: /\bRTX\s*4090\b/i, tdp: 450, minPsu: 850 },
    { pattern: /\bRTX\s*4080\b/i, tdp: 320, minPsu: 750 },
    { pattern: /\bRTX\s*4070\s*TI\b/i, tdp: 285, minPsu: 700 },
    { pattern: /\bRTX\s*4070\b/i, tdp: 200, minPsu: 650 },
    { pattern: /\bRTX\s*4060\s*TI\b/i, tdp: 160, minPsu: 550 },
    { pattern: /\bRTX\s*4060\b/i, tdp: 115, minPsu: 500 },
    // NVIDIA RTX 30 series
    { pattern: /\bRTX\s*3090\b/i, tdp: 350, minPsu: 750 },
    { pattern: /\bRTX\s*3080\b/i, tdp: 320, minPsu: 750 },
    { pattern: /\bRTX\s*3070\b/i, tdp: 220, minPsu: 650 },
    { pattern: /\bRTX\s*3060\s*TI\b/i, tdp: 200, minPsu: 600 },
    { pattern: /\bRTX\s*3060\b/i, tdp: 170, minPsu: 550 },
    { pattern: /\bRTX\s*3050\b/i, tdp: 130, minPsu: 500 },
    // AMD Radeon RX 7000 series
    { pattern: /\bRX\s*7900\s*XTX\b/i, tdp: 355, minPsu: 850 },
    { pattern: /\bRX\s*7900\b/i, tdp: 315, minPsu: 800 },
    { pattern: /\bRX\s*7800\b/i, tdp: 263, minPsu: 700 },
    { pattern: /\bRX\s*7700\b/i, tdp: 245, minPsu: 700 },
    { pattern: /\bRX\s*7600\b/i, tdp: 165, minPsu: 550 },
    // AMD Radeon RX 6000 series
    { pattern: /\bRX\s*6800\b/i, tdp: 250, minPsu: 650 },
    { pattern: /\bRX\s*6700\b/i, tdp: 220, minPsu: 650 },
    { pattern: /\bRX\s*6600\b/i, tdp: 160, minPsu: 500 },
    // Intel Arc
    { pattern: /\bARC\s*A770\b/i, tdp: 225, minPsu: 650 },
    { pattern: /\bARC\s*A750\b/i, tdp: 225, minPsu: 650 },
    // Low-end
    { pattern: /\bGT\s*1030\b/i, tdp: 30, minPsu: 300 },
    { pattern: /\bGTX\s*1650\b/i, tdp: 75, minPsu: 400 },
    { pattern: /\bGTX\s*1660\b/i, tdp: 120, minPsu: 450 },
  ]

  for (const entry of gpuTdpMap) {
    if (entry.pattern.test(upper)) {
      return { gpuTdp: entry.tdp, wattage: entry.minPsu }
    }
  }

  // Default estimate for unknown GPUs
  return { gpuTdp: 150, wattage: 500 }
}

/**
 * Extract compatibility info from any product based on its slot type.
 */
export function extractCompatibility(slot: string, name: string): CompatibilityInfo {
  switch (slot) {
    case 'processor':
      return extractProcessorCompatibility(name)
    case 'motherboard':
      return extractMotherboardCompatibility(name)
    case 'ram':
      return extractRamCompatibility(name)
    case 'gpu':
      return extractGpuCompatibility(name)
    case 'psu':
      return extractPsuCompatibility(name)
    case 'cooling':
      return extractCoolingCompatibility(name)
    default:
      return {}
  }
}

/**
 * Extract compatibility info from a cooling product name.
 * Examples:
 *   "Cpu Cooler Kelyx Potencia Max 95W Pamd/intel" → { sockets: ['AM4','AM5','1700','1851'], coolingCapacity: 95, coolerType: 'air' }
 *   "Water Cooling Corsair Nautilus 240mm" → { sockets: ['AM4','AM5','1700','1851'], coolerType: 'aio' }
 *   "Fan Cooler Raptor Frost Slim Ring120mm" → { coolerType: 'fan' }
 */
export function extractCoolingCompatibility(name: string): CompatibilityInfo {
  const upper = name.toUpperCase()

  // Determine cooler type
  let coolerType: 'air' | 'aio' | 'fan' | undefined
  if (/\bWATER\s*COOL/i.test(upper) || /\bAIO\b/i.test(upper)) {
    coolerType = 'aio'
  } else if (/\bCPU\s*COOL/i.test(upper)) {
    coolerType = 'air'
  } else if (/\bFAN\s*COOL/i.test(upper)) {
    coolerType = 'fan'
  }

  // Detect supported sockets from name
  const sockets: string[] = []

  // "AMD" or "P/amd" or "Pamd" in cooler name means AMD support (AM4+AM5)
  const supportsAmd = /\bAMD\b/i.test(upper) || /PAMD/i.test(upper) || /P\/AMD/i.test(upper) || /PARA\s*AMD/i.test(upper)
  // "Intel" in cooler name means Intel support (1700+1851)
  const supportsIntel = /\bINTEL\b/i.test(upper) || /PINTEL/i.test(upper) || /P\/INTEL/i.test(upper) || /PARA\s*INTEL/i.test(upper)

  if (supportsAmd) {
    sockets.push('AM4', 'AM5')
  }
  if (supportsIntel) {
    sockets.push('1700', '1851')
  }

  // If neither AMD nor Intel is mentioned, assume universal compatibility
  // (most CPU coolers and AIOs support both)
  if (sockets.length === 0 && (coolerType === 'air' || coolerType === 'aio')) {
    sockets.push('AM4', 'AM5', '1700', '1851')
  }

  // Detect cooling capacity (TDP rating) from name
  // Examples: "Potencia Max 95W", "220W", "TDP 200W"
  let coolingCapacity: number | undefined
  const tdpMatch = upper.match(/(?:POTENCIA\s*MAX|TDP|CAPACIDAD)[\s:]*(\d{2,3})\s*W/i)
    || upper.match(/(\d{2,3})\s*W\s*(?:TDP|MAX|POTENCIA)/i)
    || upper.match(/(\d{2,3})W\s*(?:TDP)/i)
  if (tdpMatch) {
    coolingCapacity = parseInt(tdpMatch[1])
  }

  // Estimate cooling capacity based on cooler type if not specified
  if (!coolingCapacity) {
    if (coolerType === 'aio') {
      // AIO size-based capacity estimate
      if (/\b420\s*MM\b/i.test(upper)) coolingCapacity = 350
      else if (/\b360\s*MM\b/i.test(upper)) coolingCapacity = 280
      else if (/\b280\s*MM\b/i.test(upper)) coolingCapacity = 250
      else if (/\b240\s*MM\b/i.test(upper)) coolingCapacity = 200
      else if (/\b120\s*MM\b/i.test(upper)) coolingCapacity = 120
      else coolingCapacity = 200 // Default AIO
    } else if (coolerType === 'air') {
      // Air cooler - check for size hints
      if (/\bTOWER\b/i.test(upper) || /\bDUAL/i.test(upper)) coolingCapacity = 200
      else if (/\b(ASTRIA\s*400|COREFROZR)\b/i.test(upper)) coolingCapacity = 200
      else coolingCapacity = 95 // Default basic air cooler
    }
    // Fan coolers don't have meaningful TDP capacity (they're case fans)
  }

  return { sockets, coolingCapacity, coolerType }
}

// ============================================
// Filter Application
// ============================================

/**
 * Build compatibility filters based on currently selected components.
 * When a processor is selected, we can filter motherboards by socket.
 * When a motherboard is selected, we can filter RAM by DDR type.
 * When a GPU is selected, we can recommend minimum PSU wattage.
 */
export function buildCompatibilityFilters(
  selectedComponents: { slot: string; product: { name: string } }[]
): CompatibilityFilters {
  const filters: CompatibilityFilters = {}

  for (const comp of selectedComponents) {
    const info = extractCompatibility(comp.slot, comp.product.name)

    switch (comp.slot) {
      case 'processor':
        // Processor determines motherboard socket
        if (info.socket) filters.socket = info.socket
        break
      case 'motherboard':
        // Motherboard determines RAM DDR type
        if (info.ddr) filters.ddr = info.ddr
        break
      case 'processor':
        // Processor TDP determines minimum cooling capacity
        if (info.cpuTdp) filters.cpuTdp = info.cpuTdp
        break
      case 'gpu':
        // GPU determines minimum PSU wattage
        if (info.wattage) filters.minWattage = info.wattage
        break
    }
  }

  return filters
}

/**
 * Apply compatibility filters to a product list.
 * Returns filtered products and adds compatibility info to each.
 */
export function applyCompatibilityFilters(
  products: { name: string; [key: string]: any }[],
  slot: string,
  filters: CompatibilityFilters
): { product: any; compatInfo: CompatibilityInfo; isCompatible: boolean }[] {
  return products.map(product => {
    const compatInfo = extractCompatibility(slot, product.name)
    let isCompatible = true

    // Socket filter (for motherboards)
    if (filters.socket && slot === 'motherboard') {
      if (compatInfo.socket && compatInfo.socket !== filters.socket) {
        isCompatible = false
      }
    }

    // DDR filter (for RAM)
    if (filters.ddr && slot === 'ram') {
      // Filter out SODIMM (laptop RAM) for desktop builds
      if (compatInfo.ddrType === 'sodimm') {
        isCompatible = false
      }
      // Filter by DDR generation
      if (compatInfo.ddr && compatInfo.ddr !== filters.ddr) {
        isCompatible = false
      }
      // If DDR type couldn't be detected, still show it
    }

    // Min wattage filter (for PSUs)
    if (filters.minWattage && slot === 'psu') {
      if (compatInfo.wattage && compatInfo.wattage < filters.minWattage) {
        isCompatible = false
      }
    }

    // Socket + TDP filter (for cooling)
    if (slot === 'cooling') {
      // Filter by socket compatibility
      if (filters.socket && compatInfo.sockets && compatInfo.sockets.length > 0) {
        if (!compatInfo.sockets.includes(filters.socket)) {
          isCompatible = false
        }
      }
      // Filter by TDP capacity (cooler must handle at least the CPU TDP)
      if (filters.cpuTdp && compatInfo.coolingCapacity) {
        if (compatInfo.coolingCapacity < filters.cpuTdp) {
          isCompatible = false
        }
      }
      // Fan coolers (case fans) are always compatible - they don't cool the CPU directly
      if (compatInfo.coolerType === 'fan') {
        isCompatible = true
      }
    }

    return { product, compatInfo, isCompatible }
  })
}

// ============================================
// Socket/DDR Display Helpers
// ============================================

export const SOCKET_LABELS: Record<string, string> = {
  'AM4': 'Socket AM4 (AMD)',
  'AM5': 'Socket AM5 (AMD)',
  '1700': 'Socket LGA 1700 (Intel)',
  '1851': 'Socket LGA 1851 (Intel)',
}

export const DDR_LABELS: Record<string, string> = {
  'DDR3': 'DDR3',
  'DDR4': 'DDR4',
  'DDR5': 'DDR5',
}
