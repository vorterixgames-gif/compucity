/**
 * Tag definitions for the admin product form.
 * Each category (or category group) has tag groups with options.
 * Tags are stored as a flat string array in the product's `tags` column.
 * 
 * Format: each tag is a string like "gamer", "ddr4", "hp", "dedicated_gpu"
 * Tag values use lowercase snake_case for consistency.
 */

export interface TagGroup {
  key: string        // group identifier (e.g. 'type', 'brand', 'ddr')
  label: string      // display label (e.g. 'Tipo', 'Marca', 'DDR')
  options: TagOption[]
}

export interface TagOption {
  value: string      // tag value stored in product.tags (e.g. 'gamer', 'ddr4')
  label: string      // display label (e.g. 'Gamer', 'DDR4')
}

// Map from category slug (or parent slug) to tag groups
export const CATEGORY_TAG_GROUPS: Record<string, TagGroup[]> = {
  'pc-armadas': [
    {
      key: 'type',
      label: 'Tipo',
      options: [
        { value: 'gamer', label: 'Gamer' },
        { value: 'oficina', label: 'Oficina' },
        { value: 'diseno', label: 'Diseño' },
        { value: 'mini_pc', label: 'Mini PC' },
        { value: 'aio', label: 'All in One' },
      ],
    },
    {
      key: 'brand',
      label: 'Marca',
      options: [
        { value: 'hp', label: 'HP' },
        { value: 'lenovo', label: 'Lenovo' },
        { value: 'dell', label: 'Dell' },
        { value: 'cx', label: 'CX' },
        { value: 'gamemax', label: 'Gamemax' },
        { value: 'kelyx', label: 'Kelyx' },
        { value: 'asus', label: 'ASUS' },
        { value: 'intel', label: 'Intel' },
        { value: 'arkham', label: 'Arkham' },
        { value: 'xpg', label: 'XPG' },
      ],
    },
    {
      key: 'processor',
      label: 'Procesador',
      options: [
        { value: 'i9', label: 'Core i9 / Ultra 9' },
        { value: 'i7', label: 'Core i7 / Ultra 7' },
        { value: 'i5', label: 'Core i5 / Ultra 5' },
        { value: 'i3', label: 'Core i3' },
        { value: 'celeron', label: 'Celeron / Pentium' },
        { value: 'intel_n', label: 'Intel N-Series' },
        { value: 'r9', label: 'Ryzen 9' },
        { value: 'r7', label: 'Ryzen 7' },
        { value: 'r5', label: 'Ryzen 5' },
        { value: 'r3', label: 'Ryzen 3' },
      ],
    },
    {
      key: 'ram',
      label: 'RAM',
      options: [
        { value: '4gb', label: '4GB' },
        { value: '8gb', label: '8GB' },
        { value: '16gb', label: '16GB' },
        { value: '24gb', label: '24GB' },
        { value: '32gb', label: '32GB' },
      ],
    },
    {
      key: 'gpu',
      label: 'GPU',
      options: [
        { value: 'dedicated_gpu', label: 'GPU Dedicada' },
        { value: 'integrated_gpu', label: 'GPU Integrada' },
      ],
    },
  ],

  'notebooks': [
    {
      key: 'brand',
      label: 'Marca',
      options: [
        { value: 'lenovo', label: 'Lenovo' },
        { value: 'hp', label: 'HP' },
        { value: 'dell', label: 'Dell' },
        { value: 'asus', label: 'Asus' },
        { value: 'msi', label: 'MSI' },
        { value: 'acer', label: 'Acer' },
        { value: 'cx', label: 'CX' },
        { value: 'kelyx', label: 'Kelyx' },
      ],
    },
    {
      key: 'processor',
      label: 'Procesador',
      options: [
        { value: 'i9', label: 'Core i9 / Ultra 9' },
        { value: 'i7', label: 'Core i7 / Ultra 7' },
        { value: 'i5', label: 'Core i5 / Ultra 5' },
        { value: 'i3', label: 'Core i3' },
        { value: 'celeron', label: 'Celeron / Pentium' },
        { value: 'intel_n', label: 'Intel N-Series' },
        { value: 'r9', label: 'Ryzen 9' },
        { value: 'r7', label: 'Ryzen 7' },
        { value: 'r5', label: 'Ryzen 5' },
        { value: 'r3', label: 'Ryzen 3' },
      ],
    },
    {
      key: 'ram',
      label: 'RAM',
      options: [
        { value: '4gb', label: '4GB' },
        { value: '8gb', label: '8GB' },
        { value: '16gb', label: '16GB' },
        { value: '24gb', label: '24GB' },
        { value: '32gb', label: '32GB' },
      ],
    },
    {
      key: 'screen',
      label: 'Pantalla',
      options: [
        { value: '13pul', label: '13"' },
        { value: '14pul', label: '14"' },
        { value: '15pul', label: '15"' },
        { value: '16pul', label: '16"' },
      ],
    },
    {
      key: 'gpu',
      label: 'GPU',
      options: [
        { value: 'dedicated_gpu', label: 'GPU Dedicada' },
        { value: 'integrated_gpu', label: 'GPU Integrada' },
      ],
    },
  ],

  'gamer-y-diseno': [
    // Same as notebooks - gamer/diseño notebooks share filters
    {
      key: 'brand',
      label: 'Marca',
      options: [
        { value: 'lenovo', label: 'Lenovo' },
        { value: 'hp', label: 'HP' },
        { value: 'dell', label: 'Dell' },
        { value: 'asus', label: 'Asus' },
        { value: 'msi', label: 'MSI' },
        { value: 'acer', label: 'Acer' },
        { value: 'cx', label: 'CX' },
        { value: 'kelyx', label: 'Kelyx' },
      ],
    },
    {
      key: 'processor',
      label: 'Procesador',
      options: [
        { value: 'i9', label: 'Core i9 / Ultra 9' },
        { value: 'i7', label: 'Core i7 / Ultra 7' },
        { value: 'i5', label: 'Core i5 / Ultra 5' },
        { value: 'i3', label: 'Core i3' },
        { value: 'celeron', label: 'Celeron / Pentium' },
        { value: 'intel_n', label: 'Intel N-Series' },
        { value: 'r9', label: 'Ryzen 9' },
        { value: 'r7', label: 'Ryzen 7' },
        { value: 'r5', label: 'Ryzen 5' },
        { value: 'r3', label: 'Ryzen 3' },
      ],
    },
    {
      key: 'ram',
      label: 'RAM',
      options: [
        { value: '4gb', label: '4GB' },
        { value: '8gb', label: '8GB' },
        { value: '16gb', label: '16GB' },
        { value: '24gb', label: '24GB' },
        { value: '32gb', label: '32GB' },
      ],
    },
    {
      key: 'gpu',
      label: 'GPU',
      options: [
        { value: 'dedicated_gpu', label: 'GPU Dedicada' },
        { value: 'integrated_gpu', label: 'GPU Integrada' },
      ],
    },
  ],

  'memorias-ram': [
    {
      key: 'ram_type',
      label: 'Tipo',
      options: [
        { value: 'ram_pc', label: 'PC (DIMM)' },
        { value: 'ram_notebook', label: 'Notebook (SODIMM)' },
      ],
    },
    {
      key: 'brand',
      label: 'Marca',
      options: [
        { value: 'kingston', label: 'Kingston' },
        { value: 'hiksemi', label: 'Hiksemi' },
        { value: 'adata', label: 'ADATA / XPG' },
        { value: 'corsair', label: 'Corsair' },
        { value: 'memox', label: 'Memox' },
        { value: 'crucial', label: 'Crucial' },
        { value: 'lexar', label: 'Lexar' },
        { value: 'gskill', label: 'G.Skill' },
        { value: 'patriot', label: 'Patriot' },
      ],
    },
    {
      key: 'ddr',
      label: 'DDR',
      options: [
        { value: 'ddr3', label: 'DDR3' },
        { value: 'ddr4', label: 'DDR4' },
        { value: 'ddr5', label: 'DDR5' },
      ],
    },
    {
      key: 'capacity',
      label: 'Capacidad',
      options: [
        { value: '4gb', label: '4GB' },
        { value: '8gb', label: '8GB' },
        { value: '16gb', label: '16GB' },
        { value: '32gb', label: '32GB' },
        { value: '48gbplus', label: '48GB+' },
      ],
    },
  ],

  // memoria-ram-pc and memoria-ram-notebook inherit from memorias-ram
  'memoria-ram-pc': 'memorias-ram',
  'memoria-ram-notebook': 'memorias-ram',

  // Placas de video
  'placas-de-video': [
    {
      key: 'brand',
      label: 'Marca',
      options: [
        { value: 'nvidia', label: 'NVIDIA' },
        { value: 'amd', label: 'AMD' },
        { value: 'gigabyte', label: 'Gigabyte' },
        { value: 'msi', label: 'MSI' },
        { value: 'asus', label: 'Asus' },
        { value: 'pny', label: 'PNY' },
        { value: 'powercolor', label: 'PowerColor' },
        { value: 'sapphire', label: 'Sapphire' },
        { value: 'inno3d', label: 'INNO3D' },
        { value: 'intel_arc', label: 'Intel Arc' },
      ],
    },
  ],

  // Motherboards
  'motherboards': [
    {
      key: 'brand',
      label: 'Marca',
      options: [
        { value: 'asus', label: 'Asus' },
        { value: 'gigabyte', label: 'Gigabyte' },
        { value: 'msi', label: 'MSI' },
        { value: 'asrock', label: 'ASRock' },
        { value: 'biostar', label: 'Biostar' },
      ],
    },
    {
      key: 'socket',
      label: 'Socket',
      options: [
        { value: 'am4', label: 'AM4' },
        { value: 'am5', label: 'AM5' },
        { value: 'lga1700', label: 'LGA 1700' },
        { value: 'lga1851', label: 'LGA 1851' },
      ],
    },
    {
      key: 'ddr',
      label: 'DDR',
      options: [
        { value: 'ddr4', label: 'DDR4' },
        { value: 'ddr5', label: 'DDR5' },
      ],
    },
  ],

  // Microprocesadores
  'microprocesadores': [
    {
      key: 'brand',
      label: 'Marca',
      options: [
        { value: 'amd', label: 'AMD' },
        { value: 'intel', label: 'Intel' },
      ],
    },
  ],
}

/**
 * Auto-detect tags from a product name.
 * Used when creating products to pre-fill tag checkboxes,
 * and by the sync engine to auto-tag products.
 */
export function autoDetectTags(name: string, categorySlug: string): string[] {
  const upper = name.toUpperCase()
  const tags: string[] = []

  // Get the tag groups for this category (resolve aliases)
  let slug = categorySlug
  const groups = CATEGORY_TAG_GROUPS[slug]
  if (typeof groups === 'string') slug = groups
  const tagGroups = CATEGORY_TAG_GROUPS[slug]
  if (!tagGroups || typeof tagGroups === 'string') return tags

  for (const group of tagGroups) {
    for (const option of group.options) {
      if (nameMatchesTag(upper, group.key, option.value)) {
        tags.push(option.value)
      }
    }
  }

  return [...new Set(tags)] // deduplicate
}

function nameMatchesTag(upperName: string, groupKey: string, tagValue: string): boolean {
  switch (tagValue) {
    // PC Armadas / Notebooks types
    case 'gamer': return /\bGAMER\b|\bGAMING\b/.test(upperName)
    case 'oficina': return /\bOFICINA\b|\bOFFICE\b/.test(upperName)
    case 'diseno': return /\bDESIGN\b|\bDISE[ÑN]O\b|\bCREATOR\b|\bSTUDIO\b/.test(upperName)
    case 'mini_pc': return /\bMINI PC\b|\bSTICK PC\b|\bNUC\b|\bMELE\b|\bN100\b/.test(upperName)
    case 'aio': return /\bAIO\b|\bALL[- ]?IN[- ]?ONE\b/.test(upperName)

    // Brands - PC Armadas
    case 'hp': return /\bHP\b|\bZ[12]G\b|\bOMEN\b|\bVICTUS\b|\bELITEDESK\b|\bPRODESK\b|\bPAVILION\b|\bDRAGONFLY\b|\bZBOOK\b/.test(upperName)
    case 'lenovo': return /\bLENOVO\b|\bTHINKPAD\b|\bIDEAPAD\b|\bLOQ\b|\bLEGION\b|\bYOGA\b|\bTHINKCENTRE\b|\bIDEACENTRE\b/.test(upperName)
    case 'dell': return /\bDELL\b|\bINSPIRON\b|\bLATITUDE\b|\bOPTIPLEX\b|\bALIENWARE\b/.test(upperName)
    case 'cx': return /\bCX\b/.test(upperName) && !/\bXC\b/.test(upperName)
    case 'gamemax': return /\bGAMEMAX\b/.test(upperName)
    case 'kelyx': return /\bKELYX\b/.test(upperName)
    case 'asus': return /\bASUS\b|\bROG\b|\bTUF\b|\bZENBOOK\b|\bVIVOBOOK\b|\bPN\d/.test(upperName)
    case 'intel': return /\bINTEL\b|\bNUC\b|\bCORE\b/.test(upperName)
    case 'arkham': return /\bARKHAM\b/.test(upperName)
    case 'xpg': return /\bXPG\b/.test(upperName)
    // Brands - Notebooks extra
    case 'msi': return /\bMSI\b|\bRAIDER\b|\bTHIN\b|\bCYBORG\b|\bSPATIUM\b/.test(upperName)
    case 'acer': return /\bACER\b|\bASPIRE\b|\bNITRO\b|\bPREDATOR\b/.test(upperName)
    // Brands - RAM
    case 'kingston': return /\bKINGSTON\b|\bFURY\b/.test(upperName)
    case 'hiksemi': return /\bHIKSEMI\b/.test(upperName)
    case 'adata': return /\bADATA\b|\bXPG\b/.test(upperName)
    case 'corsair': return /\bCORSAIR\b|\bVENGEANCE\b/.test(upperName)
    case 'memox': return /\bMEMOX\b/.test(upperName)
    case 'crucial': return /\bCRUCIAL\b/.test(upperName)
    case 'lexar': return /\bLEXAR\b/.test(upperName)
    case 'gskill': return /\bG\.?SKILL\b|\bTRIDENT\b|\bRIPJAWS\b/.test(upperName)
    case 'patriot': return /\bPATRIOT\b/.test(upperName)
    // Brands - GPUs
    case 'nvidia': return /\bRTX\b|\bGTX\b|\bGEFORCE\b|\bNVIDIA\b|\bQUADRO\b|\bGT\s*\d{3,4}/.test(upperName)
    case 'amd': return /\bRADEON\b|\bRX\s\d|\bRYZEN\b|\bATHLON\b/.test(upperName) && !/\bADATA\b/.test(upperName)
    case 'gigabyte': return /\bGIGABYTE\b|\bAORUS\b/.test(upperName)
    case 'pny': return /\bPNY\b/.test(upperName)
    case 'powercolor': return /\bPOWERCOLOR\b|\bPOWER\s*COLOR\b/.test(upperName)
    case 'sapphire': return /\bSAPPHIRE\b/.test(upperName)
    case 'inno3d': return /\bINNO3D\b|\bINNO\s*3D\b/.test(upperName)
    case 'intel_arc': return /\bARC\s*A?\d{3}/.test(upperName)
    // Brands - Motherboards
    case 'asrock': return /\bASROCK\b|\bAS\s*ROCK\b/.test(upperName)
    case 'biostar': return /\bBIOSTAR\b/.test(upperName)

    // Processors
    case 'i9': return /\bI9\b|\bCORE\s*9\b|\bCORE\s*ULTRA\s*9\b/.test(upperName)
    case 'i7': return /\bI7\b|\bCORE\s*7\b|\bCORE\s*ULTRA\s*7\b|\bU7[- ]?\d/.test(upperName)
    case 'i5': return /\bI5\b|\bCORE\s*5\b|\bCORE\s*ULTRA\s*5\b|\bC5[- ]?\d|\bU5[- ]?\d/.test(upperName)
    case 'i3': return /\bI3\b|\bCORE\s*3\b|\bC3[- ]?\d/.test(upperName)
    case 'celeron': return /\bCELERON\b|\bPENTIUM\b/.test(upperName)
    case 'intel_n': return /\bN100\b|\bN305\b|\bN5030\b/.test(upperName)
    case 'r9': return /\bRYZEN\s*9\b|\bR9[- ]?\d/.test(upperName)
    case 'r7': return /\bRYZEN\s*7\b|\bR7[- ]?\d/.test(upperName)
    case 'r5': return /\bRYZEN\s*5\b|\bR5[- ]?\d/.test(upperName)
    case 'r3': return /\bRYZEN\s*3\b|\bR3[- ]?\d/.test(upperName)

    // RAM
    case '4gb': return /\b4\s*G[Bb]?\b/.test(upperName) && !/\bRTX\b|\bGTX\b|\bRADEON\b|\bGEFORCE\b|\bGT\b|\bSSD\b/.test(upperName)
    case '8gb': return /\b8\s*G[Bb]?\b/.test(upperName) && !/\bRTX\b|\bGTX\b|\bRADEON\b|\bGEFORCE\b|\bGT\b/.test(upperName)
    case '16gb': return /\b16\s*G[Bb]?\b/.test(upperName) && !/\bRTX\b|\bGTX\b|\bRADEON\b|\bGEFORCE\b|\bGT\b/.test(upperName)
    case '24gb': return /\b24\s*G[Bb]?\b/.test(upperName)
    case '32gb': return /\b32\s*G[Bb]?\b/.test(upperName)
    case '48gbplus': return /\b(48|64|96|128)\s*G[Bb]?\b/.test(upperName)

    // RAM type
    case 'ram_pc': return !/\bSODIMM\b|\bSodimm\b/.test(upperName) && /\bDDR[345]\b|\bUDIMM\b|\bDIMM\b/.test(upperName)
    case 'ram_notebook': return /\bSODIMM\b|\bSodimm\b/.test(upperName)

    // DDR
    case 'ddr3': return /\bDDR3\b/.test(upperName)
    case 'ddr4': return /\bDDR4\b/.test(upperName)
    case 'ddr5': return /\bDDR5\b/.test(upperName)

    // Screen
    case '13pul': return /13[\."]|13\s/.test(upperName)
    case '14pul': return /14[\."]|14\s/.test(upperName)
    case '15pul': return /15[\."]|15\s/.test(upperName)
    case '16pul': return /16[\."]|16\s/.test(upperName)

    // GPU
    case 'dedicated_gpu': return /\bRTX\b|\bGTX\b|\bRADEON\s*RX\b|\bARC\s*A?\d{3}|\bVGA\s*\d+|\bV\d+\s*GB?|\bGT\s*\d{3,4}/.test(upperName)
    case 'integrated_gpu': return !/\bRTX\b|\bGTX\b|\bRADEON\s*RX\b|\bARC\s*A?\d{3}|\bVGA\s*\d+|\bV\d+\s*GB?|\bGT\s*\d{3,4}/.test(upperName)

    // Motherboard sockets
    case 'am4': return /\bAM4\b|\bB550\b|\bA520\b|\bX570\b|\bB450\b|\bA320\b/.test(upperName)
    case 'am5': return /\bAM5\b|\bB650\b|\bB850\b|\bB840\b|\bA620\b|\bX870\b|\bX670E?\b/.test(upperName)
    case 'lga1700': return /\b1700\b|\bB760\b|\bH610\b|\bB660\b|\bH670\b|\bZ690\b|\bZ790\b/.test(upperName)
    case 'lga1851': return /\b1851\b|\bB860\b|\bZ890\b|\bH810\b/.test(upperName)

    default: return false
  }
}

/**
 * Resolve a category slug to its effective tag groups.
 * Handles aliases (e.g. 'memoria-ram-pc' → 'memorias-ram')
 */
export function getTagGroupsForCategory(slug: string): TagGroup[] {
  let resolved = CATEGORY_TAG_GROUPS[slug]
  if (typeof resolved === 'string') {
    resolved = CATEGORY_TAG_GROUPS[resolved]
  }
  if (!resolved || typeof resolved === 'string') return []
  return resolved
}
