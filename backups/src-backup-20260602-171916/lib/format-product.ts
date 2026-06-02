/**
 * Product Name Formatter
 * Cleans and formats raw product names from suppliers into professional display names.
 * Used during sync and for batch updates.
 */

// Exact-case lookup for brands and tech terms
const EXACT_CASE: Record<string, string> = {}
const _entries: [string, string][] = [
  ['NVIDIA','NVIDIA'],['AMD','AMD'],['ASUS','ASUS'],['MSI','MSI'],['JBL','JBL'],
  ['LG','LG'],['HP','HP'],['USB','USB'],['HDMI','HDMI'],['RGB','RGB'],
  ['DDR4','DDR4'],['DDR5','DDR5'],['GDDR6','GDDR6'],['GDDR5','GDDR5'],['GDDR6X','GDDR6X'],
  ['SSD','SSD'],['HDD','HDD'],['NVME','NVMe'],['OLED','OLED'],
  ['PCIE','PCIe'],['WIFI','WiFi'],['ATX','ATX'],['ITX','ITX'],['SATA','SATA'],
  ['FHD','FHD'],['QHD','QHD'],['UHD','UHD'],['WUXGA','WUXGA'],['WQXGA','WQXGA'],
  ['WFHD','WFHD'],['SDQHD','SDQHD'],['WQHD','WQHD'],['DQHD','DQHD'],
  ['FREESYNC','FreeSync'],['GEFORCE','GeForce'],['RYZEN','Ryzen'],
  ['CORE','Core'],['PENTIUM','Pentium'],['CELERON','Celeron'],
  ['LENOVO','Lenovo'],['KINGSTON','Kingston'],['SAMSUNG','Samsung'],
  ['CORSAIR','Corsair'],['LOGITECH','Logitech'],['GIGABYTE','Gigabyte'],
  ['PALIT','Palit'],['GENIUS','Genius'],['RAPTOR','Raptor'],['KELYX','Kelyx'],
  ['IDEAPAD','IdeaPad'],['LEGION','Legion'],['LOQ','LOQ'],
  ['ULTRAGEAR','UltraGear'],['ULTRAWIDE','UltraWide'],
  ['STORMX','StormX'],['VOLT','Volt'],['FREEDOS','FreeDOS'],['FREEDOSS','FreeDOS'],
  ['WINDOWS','Windows'],['BORDERLESS','Borderless'],
  ['CHERRY','Cherry'],['PBT','PBT'],['PRO','Pro'],
  ['MINI','Mini'],['WIRELESS','Wireless'],['BAREBONE','Barebone'],
  ['PIVOT','Pivot'],['CURVO','Curvo'],['LED','LED'],['IPS','IPS'],
  ['MONITOR','Monitor'],['NOTEBOOK','Notebook'],['TABLET','Tablet'],
  ['AURICULAR','Auricular'],['MOUSE','Mouse'],['TECLADO','Teclado'],
  ['DISCO','Disco'],['MEMORIA','Memoria'],['FUENTE','Fuente'],
  ['PLACA','Placa'],['PROCESADOR','Procesador'],['PEN','Pen'],
  ['DRIVE','Drive'],['WEBCAM','Webcam'],['OCTA','Octa'],
  ['DOLBY','Dolby'],['PLUS','Plus'],['FURY','FURY'],['BEAST','BEAST'],
  ['BLACK','Black'],['WHITE','White'],['EXPO','EXPO'],
  ['BLANCA','Blanca'],['BLANCO','Blanco'],['NEGRO','Negro'],
  ['AZUL','Azul'],['GRIS','Gris'],['ROJO','Rojo'],['ROSA','Rosa'],
  ['BLUETOOTH','Bluetooth'],['MECANICO','Mecánico'],['MECÁNICO','Mecánico'],
  ['AIO','AIO'],['RAM','RAM'],['ULTRA','Ultra'],['GAMING','Gaming'],['GAMER','Gamer'],
  ['TYPE','Type'],['GBPS','Gbps'],['DUAL','Dual'],['ERGO','Ergo'],
  ['NARROW','Narrow'],['BEZEL','Bezel'],['EMMC','eMMC'],['SLOT','SLOT'],
]
for (const [k, v] of _entries) EXACT_CASE[k.toUpperCase()] = v

const MINOR_WORDS = new Set(['de','del','la','el','en','con','sin','por','para','y','e','o','u','a','un','una','los','las','al'])

function smartFormat(str: string): string {
  const tokens = str.split(/(\s+)/)
  let wordIndex = 0

  return tokens.map(token => {
    if (/^\s+$/.test(token)) return token
    if (!token) return token

    const cleanUpper = token.toUpperCase().replace(/[.,:;!?()]/g, '')
    const lower = token.toLowerCase()

    // Check exact case lookup
    if (EXACT_CASE[cleanUpper]) { wordIndex++; return EXACT_CASE[cleanUpper] }

    // Model codes: mix of digits and letters (27GP750-B, i5-12450H, R7-7735HS, 15IRH10)
    const hasDigit = /\d/.test(token)
    const hasLetter = /[a-zA-Z]/.test(token)
    if (hasDigit && hasLetter && token.length >= 3) {
      let fixed = token
      // Fix I5 → i5, I7 → i7 (Intel processors)
      if (/^I(\d)([-\/]|$)/.test(fixed)) fixed = fixed.replace(/^I(\d)/, 'i$1')
      if (/^I(\d)$/.test(fixed)) fixed = fixed.replace(/^I(\d)/, 'i$1')
      wordIndex++
      return fixed
    }

    // Pure numbers
    if (/^\d+$/.test(token)) { wordIndex++; return token }

    // Size patterns: 15.6"
    if (/^\d+[\.\d]*["″]$/.test(token)) { wordIndex++; return token }

    // Patterns like (8G+8G) or (8GB+4GB)
    if (/^\([\d.GB+KkMm]+\)$/i.test(token)) { wordIndex++; return token.toUpperCase() }

    // First word - always capitalize
    if (wordIndex === 0) {
      wordIndex++
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    }

    // Minor words
    if (MINOR_WORDS.has(lower)) { wordIndex++; return lower }

    // Default - title case
    wordIndex++
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }).join('')
}

/**
 * Format a raw product name from a supplier into a clean, professional display name.
 * Removes SKU codes, supplier codes, HTML tags, and applies smart capitalization.
 */
export function formatProductName(raw: string): string {
  let name = raw.trim()

  // Remove HTML tags
  name = name.replace(/<[^>]+>/g, '')

  // Remove (Nuevo PN), (Nuevo), (II), digit codes in parens
  name = name.replace(/\s*\(Nuevo\s*PN\)/gi, '')
  name = name.replace(/\s*\(Nuevo\)/gi, '')
  name = name.replace(/\s*\(II\)/g, '')
  name = name.replace(/\s*\(\d{3,5}\)/g, '')

  // Remove SKU prefixes like 3ED58A, CF353A, P2V62A, 7FP38VL
  name = name.replace(/^[A-Z0-9]{5,12}\s+/, '')

  // Remove HP ink prefixes like L8180/ L8160 -
  name = name.replace(/^[A-Z]\d{4,5}\/?\s*[A-Z0-9]*\s*-\s*/, '')

  // Remove internal codes at start like T195420-
  name = name.replace(/^[A-Z]\d{5,6}-/, '')

  // Remove model codes at start like 981-001416, 920-007820
  name = name.replace(/^\d{3}-\d{6}\s*/, '')

  // Fix abbreviations
  name = name.replace(/\bc\/\s*/g, 'con ')
  name = name.replace(/\bProces\.\s*/g, 'Procesador ')
  name = name.replace(/\(GIGA\)/g, '')
  name = name.replace(/PC FreeDOs/gi, 'PC FreeDOS')
  name = name.replace(/Teclado\+Mouse/g, 'Teclado y Mouse')

  // Clean spaces and edges
  name = name.replace(/\s{2,}/g, ' ')
  name = name.replace(/^[\s,.\-]+/, '')
  name = name.replace(/[\s,.\-]+$/, '')

  name = smartFormat(name).trim()

  // Post-processing fixes
  // Add 'Monitor' prefix for LG/HP monitor products that lost it
  if (/^(LG|HP) \d+ (LED|UltraGear|UltraWide|Dual)/.test(name) && !name.startsWith('Monitor')) {
    name = 'Monitor ' + name
  }

  // Fix standalone I3/I5/I7/I9 → i3/i5/i7/i9
  name = name.replace(/\bI(\d)\b/g, 'i$1')

  // Fix Gb → GB, Mb → MB, Tb → TB
  name = name.replace(/(\d+)\s*Gb\b/g, '$1GB')
  name = name.replace(/(\d+)\s*Mb\b/g, '$1MB')
  name = name.replace(/(\d+)\s*Tb\b/g, '$1TB')

  // Fix number + g without B: 8g → 8GB, 16g → 16GB
  name = name.replace(/(\d+)g\b/g, '$1GB')

  // Fix Rtx → RTX
  name = name.replace(/\bRtx\b/g, 'RTX')

  // Fix Mm → mm
  name = name.replace(/(\d+)\s*Mm\b/g, '$1mm')

  // Fix C/video → con Video
  name = name.replace(/\bC\/video\b/gi, 'con Video')

  // Fix Pc → PC
  name = name.replace(/\bPc\b/g, 'PC')
  name = name.replace(/\bMini Pc\b/g, 'Mini PC')

  // Fix Lenovo Ip → Lenovo IP
  name = name.replace(/\bLenovo Ip\b/g, 'Lenovo IP')

  // Fix Lenovo Ic → Lenovo IC
  name = name.replace(/\bLenovo Ic\b/g, 'Lenovo IC')

  return name.trim()
}

/**
 * Generate a URL-safe slug from a product name.
 * Uses the formatted name as base.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 120)
}
