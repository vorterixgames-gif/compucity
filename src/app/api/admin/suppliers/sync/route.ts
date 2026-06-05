import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formatProductName, generateSlug } from '@/lib/format-product'
import { getCurrentAdmin } from '@/lib/admin-auth'

interface SyncResult {
  ok: boolean
  total: number
  created: number
  updated: number
  skipped: number
  errors: number
  message: string
}

// Subcategory keyword rules: when a product maps to a parent category that has subcategories,
// these rules determine which subcategory to assign based on product name/supplier category.
// Format: { parentSlug, rules: [{ keywords, subcategorySlug }] }
const SUBCATEGORY_RULES: { parentSlug: string; rules: { keywords: string[]; subcategorySlug: string; name: string }[] }[] = [
  {
    parentSlug: 'notebooks',
    rules: [
      // Tablets -> Notebooks/Tablets
      { keywords: ['TABLET', 'TABLETA', 'IDEA TAB', 'TAB PLUS', 'EASYPEN'], subcategorySlug: 'tablets', name: 'Tablets' },
      // Gamer notebooks -> Notebooks/Gamer
      { keywords: ['GAMER', 'GAMING', 'LOQ', 'LEGION', 'RTX', 'GEFORCE', 'RADEON', 'THIN 15', 'TUF GAMING', 'PREDATOR', 'NITRO'], subcategorySlug: 'gamer', name: 'Gamer' },
      // Ultrabooks -> Notebooks/Ultrabooks
      { keywords: ['SLIM', 'ULTRABOOK', 'IDEAPAD SLIM', 'BORDER ULTRA', 'IP SLIM'], subcategorySlug: 'ultrabooks', name: 'Ultrabooks' },
      // Design notebooks -> Notebooks/Diseño
      { keywords: ['TOUCH', 'TOUCHSCREEN', 'IPS 300', 'PANTALLA TACTIL', 'XPS', 'SPECTRE', 'ZENBOOK'], subcategorySlug: 'diseno', name: 'Diseño' },
      // Oficina notebooks (default for notebooks) -> Notebooks/Oficina
      { keywords: ['IDEAPAD', '250 G', '255 G', 'KELYX', 'OFFICE', 'CONSUMO', 'FREE'], subcategorySlug: 'oficina', name: 'Oficina' },
    ],
  },
  {
    parentSlug: 'monitores',
    rules: [
      // Gamer monitors -> Monitores/Gamer
      { keywords: ['ULTRAGEAR', 'GAMER', 'GAMING', 'RAPTOR HAWK', '144HZ', '165HZ', '180HZ', '200HZ', '240HZ', '1MS', '0.5MS', 'FREESYNC', 'G-SYNC', 'CURVO', 'OLED'], subcategorySlug: 'gamer-mon', name: 'Gamer' },
      // Design monitors -> Monitores/Diseño
      { keywords: ['ULTRAFINE', 'ERGO', '4K USB-C', 'COLOR CALIBRATED', 'THUNDERBOLT', 'DUAL ERGO'], subcategorySlug: 'diseno-mon', name: 'Diseño' },
      // Monitor stands/arms -> Monitores/Soportes y Brazos
      { keywords: ['SOPORTE', 'BRAZO', 'MOUNT', 'STAND MONITOR'], subcategorySlug: 'soportes-y-brazos', name: 'Soportes y Brazos' },
      // Oficina monitors (default) -> Monitores/Oficina
      { keywords: ['MONITOR', 'LED', 'HDMI', 'FULL HD', 'CORPORATIVO', 'CONSUMO'], subcategorySlug: 'oficina-mon', name: 'Oficina' },
    ],
  },
  {
    parentSlug: 'pc-armadas',
    rules: [
      // Gamer PCs -> PC Armadas/Gamer
      { keywords: ['GAMER', 'GAMING', 'PC GAMER', 'RTX', 'GEFORCE', 'RADEON'], subcategorySlug: 'gamer-pc', name: 'Gamer' },
      // Mini PC -> PC Armadas/Mini PC
      { keywords: ['MINI PC', 'STICK PC', 'NUC', 'MELE', 'N100'], subcategorySlug: 'mini-pc', name: 'Mini PC' },
      // Design PCs -> PC Armadas/Diseño
      { keywords: ['DESIGN', 'DISEÑO', 'CREATOR', 'STUDIO'], subcategorySlug: 'diseno-pc', name: 'Diseño' },
      // Oficina PCs (default) -> PC Armadas/Oficina
      { keywords: ['SIST.', 'KELYX', 'OFFICE', 'OFICINA', 'PC'], subcategorySlug: 'oficina-pc', name: 'Oficina' },
    ],
  },
  {
    parentSlug: 'accesorios',
    rules: [
      // Smart Home -> Accesorios/Smart Home
      { keywords: ['TAPO', 'SMART HOME', 'SENSOR DE MOVIMIENTO', 'TIMBRE VIDEO', 'PARTY LIGHT', 'LUZ PROYECCION', 'BARRA DE LUZ', 'SMART PLUG', 'BOMBILLA INTELIGENTE'], subcategorySlug: 'smart-home', name: 'Smart Home' },
      // Hogar Inteligente -> Accesorios/Hogar Inteligente
      { keywords: ['HELADERA', 'LAVARROPAS', 'AIRE ACONDICIONADO', 'ELECTRODOMESTICO', 'SMART INVERTER', 'INSTAVIEW'], subcategorySlug: 'hogar-inteligente', name: 'Hogar Inteligente' },
      // UPS -> Accesorios/UPS
      { keywords: ['UPS', 'ESTABILIZADOR', 'NOBREAK', 'SURGE PROTECTION'], subcategorySlug: 'ups', name: 'UPS' },
      // Cargadores -> Accesorios/Cargadores
      { keywords: ['CARGADOR', 'CHARGER', 'POWER BANK'], subcategorySlug: 'cargadores', name: 'Cargadores' },
      // Sillas Gamer -> Accesorios/Sillas Gamer
      { keywords: ['SILLA', 'GAMING CHAIR'], subcategorySlug: 'sillas-gamer', name: 'Sillas Gamer' },
      // Escritorios -> Accesorios/Escritorios
      { keywords: ['ESCRITORIO', 'DESK ', 'MESA GAMER'], subcategorySlug: 'escritorios', name: 'Escritorios' },
      // Fundas/Mochilas -> Accesorios/Fundas/Mochilas
      { keywords: ['MOCHILA', 'FUNDA', 'BACKPACK'], subcategorySlug: 'fundas-mochilas', name: 'Fundas/Mochilas' },
      // Bases -> Accesorios/Bases
      { keywords: ['BASE CARGADORA', 'DOCK'], subcategorySlug: 'bases', name: 'Bases' },
    ],
  },
]

// Category keyword mapping: keyword patterns -> store category SLUG
// Used as fallback when no explicit supplier category mapping exists
// *** CRITICAL ORDERING: Complete products (PCs, Notebooks, Monitors) MUST come BEFORE ***
// *** individual components (RTX, DDR, SSD) to prevent miscategorization.             ***
// A "NOTEBOOK GAMER RTX 4060" should match NOTEBOOK first, not RTX (placas-de-video).
const CATEGORY_KEYWORD_MAP: { keywords: string[]; categorySlug: string; name: string }[] = [
  // ==========================================
  // GROUP 1: COMPLETE PRODUCTS — MUST BE FIRST
  // These match entire product types that contain component keywords in their names
  // ==========================================
  // PC Armadas — complete PCs that may contain RTX/DDR/SSD in name
  { keywords: ['PC GAMER','PC LENOVO','PC KELYX','SIST. KELYX','SIST.','COMPUTADORA','BAREBONE','DESKTOP','ALL IN ONE','ALL-IN-ONE'], categorySlug: 'pc-armadas', name: 'PC Armadas' },
  // Notebooks — contain RTX/DDR/SSD keywords but are NOT components
  { keywords: ['NOTEBOOK','LAPTOP','PORTATIL'], categorySlug: 'notebooks', name: 'Notebooks' },
  // Mini PC — complete PCs that may contain component keywords
  { keywords: ['MINI PC','STICK PC','NUC','MELE','N100'], categorySlug: 'pc-armadas', name: 'Mini PC' },
  // Monitores — may contain HDMI/VGA but are NOT cables
  { keywords: ['MONITOR','ULTRAFINE','LED MONITOR'], categorySlug: 'monitores', name: 'Monitores' },

  // ==========================================
  // GROUP 2: PERIPHERALS & ACCESSORIES
  // ==========================================
  // Auriculares
  { keywords: ['AURICULAR','HEADSET','HEADPHONE','JBL TOUR','JBL QUANTUM'], categorySlug: 'auriculares', name: 'Auriculares' },
  // Mouse
  { keywords: ['MOUSE'], categorySlug: 'mouse', name: 'Mouse' },
  // Teclados
  { keywords: ['TECLADO','KEYBOARD'], categorySlug: 'teclados', name: 'Teclados' },
  // Parlantes
  { keywords: ['PARLANTE','SPEAKER','BARRA DE SONIDO','SOUND BAR','PARTY LIGHT'], categorySlug: 'parlantes', name: 'Parlantes' },
  // Mousepads
  { keywords: ['MOUSEPAD','PAD GAMER','ALFOMBRILLA','PAD '], categorySlug: 'mousepads', name: 'Mousepads' },
  // Micrófonos
  { keywords: ['MICROFONO','MICROPHONE','MIC '], categorySlug: 'microfonos', name: 'Micrófonos' },
  // Webcams
  { keywords: ['WEBCAM','CAM WEB','WEB CAM','BRIO','FACECAM'], categorySlug: 'webcams', name: 'Webcams' },
  // Joysticks
  { keywords: ['JOYSTICK','CONTROL ','GAMEPAD','CONTROLLER','GAME PAD','VOLANTE','G29','G923','F710'], categorySlug: 'joysticks', name: 'Joysticks' },
  // Kits Gamer
  { keywords: ['KIT GABINETE','KIT TECLADO','KIT GAMER'], categorySlug: 'kits-gamer', name: 'Kits Gamer' },
  // Impresión
  { keywords: ['IMPRESORA','EPSON L','EPSON M','SMART TANK','LASERJET','DESKJET','OFFICEJET','PROYECTOR EPSON'], categorySlug: 'impresion', name: 'Impresión' },
  // Toners y Cartuchos
  { keywords: ['CARTUCHO','TONER','INK CARTRIDGE','PRINT C','IMAGING DRUM','PRINHEAD','CART.','TINTA.','CART.NEGRO','CART.CYAN','CART.MAGENTA','CART.YELLOW','CART.AMARILLO','CART.LIGHT','BOTELLA DE TINTA','HP 935','HP 951','HP 126','HP 122'], categorySlug: 'toners-y-cartuchos', name: 'Toners y Cartuchos' },

  // ==========================================
  // GROUP 3: STORAGE (order matters: externos before internos)
  // ==========================================
  // Discos Externos — MUST be before SSD/HDD internals
  { keywords: ['DISCO EXTERNO','EXTERNAL','PORTABLE DRIVE','HD SEAGATE EXTERNO','HD TOSHIBA EXTERNO','CANVIO','EXPANSION BLACK'], categorySlug: 'discos-externos', name: 'Discos Externos' },
  // Pendrives
  { keywords: ['PENDRIVE','DATA TRAVELER','DATATRAVELER','FLASH DRIVE','PEN DRIVE'], categorySlug: 'pendrives', name: 'Pendrives' },
  // Micro SD
  { keywords: ['MICRO SD','MICROSD','SD CARD','MICRO MEMORY'], categorySlug: 'micro-sd', name: 'Micro SD' },

  // ==========================================
  // GROUP 4: INDIVIDUAL COMPONENTS (PC Builder categories)
  // These come AFTER complete products to avoid miscategorization
  // ==========================================
  // Microprocesadores
  { keywords: ['RYZEN','INTEL I3','INTEL I5','INTEL I7','INTEL I9','CORE I','PENTIUM','CORE ULTRA'], categorySlug: 'microprocesadores', name: 'Microprocesadores' },
  // Motherboards
  { keywords: ['MOTHER','H610','B760','H810','A520','A620','B650','B550','H510'], categorySlug: 'motherboards', name: 'Motherboards' },
  // Memorias RAM
  { keywords: ['MEMORIA DDR','DDR3','DDR4','DDR5','SODIMM','CORSAIR MEMORY'], categorySlug: 'memorias-ram', name: 'Memorias RAM' },
  // Placas de Video — comes AFTER notebooks/PCs to prevent "NOTEBOOK RTX" → placas-de-video
  { keywords: ['RTX','GTX','RADEON RX','GEFORCE','GRAPHICS CARD','QUADRO RTX'], categorySlug: 'placas-de-video', name: 'Placas de Video' },
  // Discos SSD
  { keywords: ['SSD','NVME','M.2','GEN4','GEN3'], categorySlug: 'discos-ssd', name: 'Discos SSD' },
  // Discos HDD
  { keywords: ['DISCO RIGIDO','HDD','IRONWOLF','SKYHAWK','HD SEAGATE INTERNO','HD TOSHIBA INTERNO'], categorySlug: 'discos-hdd', name: 'Discos HDD' },
  // Fuentes
  { keywords: ['FUENTE','POWER SUPPLY','PSU'], categorySlug: 'fuentes', name: 'Fuentes' },
  // Gabinetes
  { keywords: ['GABINETE','CHASSIS','CASE ','TOWER','CTE 550','5000T','4500X','BLAZE FORCE','INFINITY GLASS'], categorySlug: 'gabinetes', name: 'Gabinetes' },
  // Refrigeración
  { keywords: ['COOLER','WATER COOL','LIQUID COOL','DISIPADOR','HEATSINK','SWAFAN','FAN COOLER','ICUE LINK','AIO '], categorySlug: 'refrigeracion', name: 'Refrigeración' },
  // Pastas Térmicas
  { keywords: ['PASTA TERMICA','THERMAL PASTE'], categorySlug: 'pastas-termicas', name: 'Pastas Térmicas' },

  // ==========================================
  // GROUP 5: NETWORKING & MISC
  // ==========================================
  // Routers WiFi
  { keywords: ['ARCHER','ROUTER','DECO','MESH WIFI','TL-WR','ROU WI'], categorySlug: 'routers-wifi', name: 'Routers WiFi' },
  // Switches
  { keywords: ['SWITCH'], categorySlug: 'switches', name: 'Switches' },
  // Placas de Red
  { keywords: ['P.REDW','EAP','CPE','SFP','TL-WN','PREDW','RANGE EXTENDER','TAPO C','CAMARA IP'], categorySlug: 'placas-de-red', name: 'Placas de Red' },
  // Cables y Adaptadores — MUST be near the end; "CABLE" is very generic
  { keywords: ['CABLE','ADAPTADOR','FICHA RJ45','CONVERTER','ROLLO','UTP CAT','PROTECTOR KELYX','PROLONGADOR','HUB KELYX','HUB USB'], categorySlug: 'cables-y-adaptadores', name: 'Cables y Adaptadores' },
  // UPS / Estabilizadores
  { keywords: ['UPS','ESTABILIZADOR','NOBREAK','SURGE PROTECTION'], categorySlug: 'ups', name: 'UPS' },
  // Cargadores
  { keywords: ['CARGADOR','CHARGER','POWER BANK'], categorySlug: 'cargadores', name: 'Cargadores' },
  // Sillas Gamer
  { keywords: ['SILLA','GAMING CHAIR'], categorySlug: 'sillas-gamer', name: 'Sillas Gamer' },
  // Soportes y Brazos
  { keywords: ['SOPORTE','BRAZO','MOUNT','STAND'], categorySlug: 'soportes-y-brazos', name: 'Soportes y Brazos' },
  // Fundas/Mochilas
  { keywords: ['MOCHILA','FUNDA','BACKPACK'], categorySlug: 'fundas-mochilas', name: 'Fundas/Mochilas' },
  // Bases
  { keywords: ['BASE CARGADORA','DOCK'], categorySlug: 'bases', name: 'Bases' },
  // Escritorios
  { keywords: ['ESCRITORIO','DESK ','MESA GAMER'], categorySlug: 'escritorios', name: 'Escritorios' },
]

/**
 * Build a category lookup from the database.
 * Returns slug -> id map, name -> id map, and parent info for subcategory logic.
 */
async function buildCategoryLookup(): Promise<{
  slugToId: Record<string, string>
  nameToId: Record<string, string>
  idToParentId: Record<string, string | null>
  parentSlugToChildSlugs: Record<string, string[]>
}> {
  const result = await db.execute('SELECT id, name, slug, parentId FROM categories')
  const slugToId: Record<string, string> = {}
  const nameToId: Record<string, string> = {}
  const idToParentId: Record<string, string | null> = {}
  const parentSlugToChildSlugs: Record<string, string[]> = {}
  for (const row of result.rows as any[]) {
    if (row.slug) slugToId[row.slug] = row.id
    if (row.name) nameToId[row.name.toLowerCase()] = row.id
    idToParentId[row.id] = row.parentId || null
    if (row.parentId) {
      // Find parent slug
      const parentRow = (result.rows as any[]).find((r: any) => r.id === row.parentId)
      if (parentRow?.slug) {
        if (!parentSlugToChildSlugs[parentRow.slug]) parentSlugToChildSlugs[parentRow.slug] = []
        parentSlugToChildSlugs[parentRow.slug].push(row.slug)
      }
    }
  }
  return { slugToId, nameToId, idToParentId, parentSlugToChildSlugs }
}

/**
 * Build supplier category mappings from the database.
 * Returns supplierCategory -> storeCategoryId map for a given supplier.
 */
async function buildSupplierMappingLookup(supplierId: string): Promise<Record<string, string>> {
  const result = await db.execute({
    sql: 'SELECT supplierCategory, storeCategoryId FROM supplier_category_mappings WHERE supplierId = ?',
    args: [supplierId],
  })
  const map: Record<string, string> = {}
  for (const row of result.rows as any[]) {
    map[row.supplierCategory] = row.storeCategoryId
  }
  return map
}

/**
 * Map a product to a store category using:
 * 1. Supplier category mapping (if available)
 * 2. Keyword matching with slug-based lookup
 * 3. Subcategory refinement: if the matched category is a parent with subcategories,
 *    use subcategory rules to find the best subcategory match
 * 4. Default: null (no category)
 */
function mapProductToCategory(
  productName: string,
  supplierCategory: string | null,
  supplierMappings: Record<string, string>,
  slugToId: Record<string, string>,
  idToParentId: Record<string, string | null>,
  parentSlugToChildSlugs: Record<string, string[]>,
  slugToParentSlug?: Record<string, string>
): { categoryId: string | null; method: string } {
  let matchedCategoryId: string | null = null
  let method = 'none'

  // 1. Check supplier category mapping first
  if (supplierCategory && supplierMappings[supplierCategory]) {
    matchedCategoryId = supplierMappings[supplierCategory]
    method = 'mapping'
  }

  // 2. Keyword matching (only if no mapping match)
  if (!matchedCategoryId) {
    const name = (productName || '').toUpperCase()
    for (const mapping of CATEGORY_KEYWORD_MAP) {
      if (mapping.keywords.some(kw => name.includes(kw))) {
        const categoryId = slugToId[mapping.categorySlug]
        if (categoryId) {
          matchedCategoryId = categoryId
          method = 'keyword'
          break
        }
      }
    }
  }

  if (!matchedCategoryId) {
    return { categoryId: null, method: 'none' }
  }

  // 2.5. Category correction: if a product was mapped to a category by supplier mapping
  // but its name indicates it should be in a different category, correct it.
  // This handles cases like "Plataforma AMD/Intel" mapping to microprocesadores
  // but containing both processors and motherboards.
  const upperName = (productName || '').toUpperCase()
  const CATEGORY_CORRECTIONS: { nameKeyword: string; targetSlug: string; sourceSlugs: string[] }[] = [
    {
      // Motherboards incorrectly mapped to microprocesadores
      nameKeyword: 'MOTHER',
      targetSlug: 'motherboards',
      sourceSlugs: ['microprocesadores'],
    },
    {
      // Notebooks with RTX/GTX incorrectly mapped to placas-de-video
      nameKeyword: 'NOTEBOOK',
      targetSlug: 'notebooks',
      sourceSlugs: ['placas-de-video'],
    },
    {
      // Notebooks with DDR4/DDR5 incorrectly mapped to memorias-ram
      nameKeyword: 'NOTEBOOK',
      targetSlug: 'notebooks',
      sourceSlugs: ['memorias-ram'],
    },
    {
      // Notebooks with SSD incorrectly mapped to discos-ssd
      nameKeyword: 'NOTEBOOK',
      targetSlug: 'notebooks',
      sourceSlugs: ['discos-ssd'],
    },
    {
      // "Base Notebook" in notebook categories -> bases
      nameKeyword: 'BASE NOTEBOOK',
      targetSlug: 'bases',
      sourceSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'],
    },
    {
      // Mini PCs / Barebones mis-categorized as components
      nameKeyword: 'MINI PC',
      targetSlug: 'pc-armadas',
      sourceSlugs: ['microprocesadores', 'memorias-ram', 'discos-ssd', 'fuentes'],
    },
    {
      // Barebones mis-categorized as components
      nameKeyword: 'BAREBONE',
      targetSlug: 'pc-armadas',
      sourceSlugs: ['microprocesadores', 'memorias-ram', 'discos-ssd', 'fuentes'],
    },
    {
      // Complete PCs (Lenovo Neo, Kelyx) mis-categorized as components
      nameKeyword: 'PC LENOVO',
      targetSlug: 'pc-armadas',
      sourceSlugs: ['discos-ssd', 'memorias-ram', 'microprocesadores', 'fuentes', 'gabinetes'],
    },
    {
      // Kelyx PCs mis-categorized as components
      nameKeyword: 'PC KELYX',
      targetSlug: 'pc-armadas',
      sourceSlugs: ['discos-ssd', 'memorias-ram', 'microprocesadores', 'fuentes', 'gabinetes'],
    },
    {
      // Sist. Kelyx mis-categorized as components
      nameKeyword: 'SIST.',
      targetSlug: 'pc-armadas',
      sourceSlugs: ['discos-ssd', 'memorias-ram', 'microprocesadores', 'fuentes', 'gabinetes'],
    },
    {
      // PC Gamer mis-categorized as fuentes (e.g. "PC Gamer Raptor con Fuente")
      nameKeyword: 'PC GAMER',
      targetSlug: 'pc-armadas',
      sourceSlugs: ['fuentes', 'gabinetes'],
    },
    {
      // Desktop PCs mis-categorized
      nameKeyword: 'DESKTOP',
      targetSlug: 'pc-armadas',
      sourceSlugs: ['switches', 'discos-ssd'],
    },
    // === NEW CORRECTIONS: prevent future miscategorization in PC Builder slots ===
    {
      // VGA cables (e.g. "Vga 15PIN M/m", "Vga 15M/15M 1.4 Mts") in placas-de-video -> cables
      nameKeyword: 'M/M',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['placas-de-video'],
    },
    {
      // VGA cables with "Mts" (meters) in placas-de-video -> cables
      nameKeyword: 'MTS',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['placas-de-video'],
    },
    {
      // IP cameras in placas-de-video -> placas-de-red
      nameKeyword: 'IP CAM',
      targetSlug: 'placas-de-red',
      sourceSlugs: ['placas-de-video'],
    },
    {
      // Laptop motherboards (Mb + Vga) in placas-de-video -> motherboards
      nameKeyword: 'MB',
      targetSlug: 'motherboards',
      sourceSlugs: ['placas-de-video'],
    },
    {
      // HP Z workstations with RTX in placas-de-video -> pc-armadas
      nameKeyword: 'HP Z',
      targetSlug: 'pc-armadas',
      sourceSlugs: ['placas-de-video', 'microprocesadores', 'memorias-ram', 'discos-ssd'],
    },
    {
      // Dell workstations in placas-de-video -> pc-armadas
      nameKeyword: 'DELL P',
      targetSlug: 'pc-armadas',
      sourceSlugs: ['placas-de-video', 'microprocesadores'],
    },
    {
      // Laptop motherboard repuestos (P/ Repuesto) in component categories -> motherboards
      nameKeyword: 'REPUESTO',
      targetSlug: 'motherboards',
      sourceSlugs: ['placas-de-video', 'microprocesadores', 'memorias-ram'],
    },
    {
      // RMA products should not be in component categories
      nameKeyword: '(RMA)',
      targetSlug: 'motherboards',
      sourceSlugs: ['placas-de-video', 'microprocesadores', 'memorias-ram'],
    },
  ]

  // Apply corrections regardless of mapping method
  for (const correction of CATEGORY_CORRECTIONS) {
    if (upperName.includes(correction.nameKeyword)) {
      // Check if current category is one of the source slugs
      const currentSlug = Object.entries(slugToId).find(([_, id]) => id === matchedCategoryId)?.[0]
      if (currentSlug && correction.sourceSlugs.includes(currentSlug)) {
        const correctedCategoryId = slugToId[correction.targetSlug]
        if (correctedCategoryId) {
          matchedCategoryId = correctedCategoryId
          method = method.includes('corrected') ? method : method + '+corrected'
        }
      }
    }
  }

  // 3. Subcategory refinement: if the matched category is a parent, try to find a subcategory
  const isParent = idToParentId[matchedCategoryId] === null || idToParentId[matchedCategoryId] === undefined
  if (isParent) {
    // Find the parent slug
    let parentSlug: string | null = null
    for (const [slug, id] of Object.entries(slugToId)) {
      if (id === matchedCategoryId) {
        parentSlug = slug
        break
      }
    }

    if (parentSlug && parentSlugToChildSlugs[parentSlug]?.length > 0) {
      // Check subcategory rules
      const subRules = SUBCATEGORY_RULES.find(r => r.parentSlug === parentSlug)
      if (subRules) {
        const name = (productName || '').toUpperCase()
        const supplierCatUpper = (supplierCategory || '').toUpperCase()
        for (const rule of subRules.rules) {
          const nameMatch = rule.keywords.some(kw => name.includes(kw))
          const supplierCatMatch = rule.keywords.some(kw => supplierCatUpper.includes(kw))
          if (nameMatch || supplierCatMatch) {
            const subcategoryId = slugToId[rule.subcategorySlug]
            if (subcategoryId) {
              matchedCategoryId = subcategoryId
              method = method === 'mapping' ? 'mapping+sub' : 'keyword+sub'
              break
            }
          }
        }
      }
    }
  }

  return { categoryId: matchedCategoryId, method }
}

/**
 * Extract the supplier category from an Invid product.
 * Invid may return RUBRO, CATEGORIA, GRUPO, or FAMILY fields.
 */
function getInvidSupplierCategory(product: any): string {
  return product.RUBRO || product.CATEGORIA || product.GRUPO || product.FAMILY || product.CATEGORY || ''
}

/**
 * Extract the supplier category from an Air Intra product.
 */
function getAirIntraSupplierCategory(product: any): string {
  return product.rubro || product.categoria || product.familia || product.grupo || ''
}

/**
 * Extract the supplier category from an ELIT product.
 */
function getElitSupplierCategory(product: any): string {
  // Elit provides categoria + sub_categoria which are more specific
  if (product.categoria && product.sub_categoria) {
    return `${product.categoria} > ${product.sub_categoria}`
  }
  return product.categoria || product.rubro || product.familia || product.grupo || product.linea || ''
}

async function syncInvid(supplier: any): Promise<SyncResult> {
  const baseUrl = supplier.apiBaseUrl || 'https://www.invidcomputers.com'
  const result: SyncResult = { ok: false, total: 0, created: 0, updated: 0, skipped: 0, errors: 0, message: '' }

  try {
    // Build category lookups
    const { slugToId, idToParentId, parentSlugToChildSlugs } = await buildCategoryLookup()
    const supplierMappings = await buildSupplierMappingLookup(supplier.id)

    // Step 1: Authenticate
    const authRes = await fetch(`${baseUrl}/api/v1/auth.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: supplier.apiUsername,
        password: supplier.apiPassword,
      }),
    })

    if (!authRes.ok) {
      const errText = await authRes.text()
      result.message = `Error de autenticación Invid: ${errText}`
      return result
    }

    const authData = await authRes.json()
    if (!authData.access_token) {
      result.message = 'No se recibió token de Invid'
      return result
    }

    const token = authData.access_token

    // Step 2: Fetch all products (paginated)
    let offset = 0
    const pageSize = 100
    let hasMore = true
    let totalFetched = 0
    let created = 0
    let updated = 0
    let skipped = 0
    let errors = 0

    while (hasMore) {
      const productsRes = await fetch(`${baseUrl}/api/v1/articulo.php?offset=${offset}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (!productsRes.ok) {
        result.message = `Error fetching products from Invid: ${productsRes.status}`
        result.total = totalFetched
        result.created = created
        result.updated = updated
        result.skipped = skipped
        result.errors = errors + 1
        return result
      }

      const productsData = await productsRes.json()
      const products = productsData.data || []

      if (!Array.isArray(products) || products.length === 0) {
        hasMore = false
        break
      }

      for (const product of products) {
        totalFetched++
        try {
          // Skip products without price
          const price = parseFloat(product.PRICE || '0')
          if (price <= 0) {
            skipped++
            continue
          }

          const providerSku = product.ID || ''
          const finalPrice = parseFloat(product.FINAL_PRICE || '0')

          // Get supplier category
          const supplierCategory = getInvidSupplierCategory(product)

          // Check if product already exists with this providerSku
          const existing = await db.execute({
            sql: 'SELECT id FROM products WHERE providerId = ? AND providerSku = ?',
            args: [supplier.id, providerSku],
          })

          const existingRows = existing.rows as any[]

          // Find matching category using mapping -> keyword -> subcategory -> default
          const { categoryId } = mapProductToCategory(
            product.TITLE || product.DESCRIPTION || '',
            supplierCategory,
            supplierMappings,
            slugToId,
            idToParentId,
            parentSlugToChildSlugs
          )

          // Calculate selling price using supplier markup
          const costPrice = price
          const markup = supplier.markup || 30
          const sellingPrice = costPrice * (1 + markup / 100)

          if (existingRows.length > 0) {
            // Update existing product
            await db.execute({
              sql: `UPDATE products SET
                costPrice = ?, price = ?,
                stock = CASE
                  WHEN ? = 'STOCK OK' THEN GREATEST(COALESCE(stock, 0), 10)
                  WHEN ? = 'BAJO STOCK' THEN GREATEST(COALESCE(stock, 0), 3)
                  WHEN ? = 'SIN STOCK' THEN 0
                  ELSE stock
                END,
                supplierCategory = ?,
                updatedAt = ?
              WHERE id = ?`,
              args: [
                costPrice,
                sellingPrice,
                product.STOCK_STATUS || '',
                product.STOCK_STATUS || '',
                product.STOCK_STATUS || '',
                supplierCategory,
                new Date().toISOString(),
                existingRows[0].id,
              ],
            })
            updated++
          } else {
            // Create new product (only if it has a name and price)
            if (!product.TITLE || price <= 0) {
              skipped++
              continue
            }

            const newId = crypto.randomUUID()
            const formattedName = formatProductName(product.TITLE)
            const slug = generateSlug(formattedName)

            const images = product.IMAGE_URL ? JSON.stringify([product.IMAGE_URL]) : '[]'
            const specs: Record<string, string> = {}
            if (product.BRAND) specs['Marca'] = product.BRAND
            if (product.PART_NUMBER) specs['Part Number'] = product.PART_NUMBER
            if (product.WEIGHT) specs['Peso'] = `${product.WEIGHT} ${product.WEIGHT_UNIT || ''}`
            if (product.HEIGHT && product.WIDTH && product.LENGTH) {
              specs['Dimensiones'] = `${product.LENGTH}x${product.WIDTH}x${product.HEIGHT} ${product.DIMENSIONS_UNIT || ''}`
            }

            // Map stock status to numeric
            let stock = 0
            if (product.STOCK_STATUS === 'STOCK OK') stock = 10
            else if (product.STOCK_STATUS === 'BAJO STOCK') stock = 3

            await db.execute({
              sql: `INSERT INTO products (id, name, slug, description, price, comparePrice, costPrice, sku, stock, isActive, isFeatured, images, specs, providerId, providerSku, categoryId, supplierCategory)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                newId,
                formattedName,
                slug,
                product.DESCRIPTION || product.LONG_DESCRIPTION || '',
                sellingPrice,
                finalPrice > 0 ? finalPrice * (1 + markup / 100) : null,
                costPrice,
                providerSku,
                stock,
                price > 0 ? 1 : 0,
                0,
                images,
                JSON.stringify(specs),
                supplier.id,
                providerSku,
                categoryId,
                supplierCategory,
              ],
            })
            created++
          }
        } catch (err) {
          console.error('Error processing Invid product:', err)
          errors++
        }
      }

      offset += pageSize
      // If we got less than pageSize, we've reached the end
      if (products.length < pageSize) {
        hasMore = false
      }
    }

    // Update lastSyncAt
    const syncNow = new Date().toISOString()
    await db.execute({
      sql: 'UPDATE suppliers SET lastSyncAt = ?, updatedAt = ? WHERE id = ?',
      args: [syncNow, syncNow, supplier.id],
    })

    result.ok = true
    result.total = totalFetched
    result.created = created
    result.updated = updated
    result.skipped = skipped
    result.errors = errors
    result.message = `Sincronización completada: ${totalFetched} productos procesados, ${created} nuevos, ${updated} actualizados, ${skipped} sin precio omitidos`

  } catch (error: any) {
    result.message = `Error de conexión con Invid: ${error.message}`
  }

  return result
}

/**
 * Strip PHP notices/warnings/errors from Air Intra API response text.
 * Air Intra's PHP server injects HTML-formatted PHP notices like:
 *   <br /> <b>Notice</b>: Undefined property: stdClass::$estado in /path/file.php on line 54
 * These can appear BEFORE, AFTER, or INSIDE the JSON array (between product objects).
 * This function removes them while preserving the actual JSON data.
 */
function stripPhpNotices(text: string): string {
  let cleaned = text
    // Remove complete PHP notice/warning/error blocks (HTML format with <b> tags)
    // Pattern: optional <br />, then <b>Type</b>: message in /path/file.php on line NNN
    .replace(/(?:<br\s*\/?>\s*)?<b>(?:Notice|Warning|Fatal error|Parse error|Deprecated)<\/b>:\s*.*?on line \d+\s*/gis, '')
    // Remove plain-text PHP notices (without HTML tags)
    .replace(/(?:^|\n)\s*(?:Notice|Warning|Fatal error|Parse error|Deprecated):\s*.*?on line \d+\s*/gis, '')
    // Remove any remaining standalone <br /> tags
    .replace(/<br\s*\/?>\s*/gi, '')
    // Remove leftover <b> or </b> tags
    .replace(/<\/?b>/gi, '')
    // Fix trailing commas before ] or } (can happen after removing notices)
    .replace(/,\s*([}\]])/g, '$1')

  return cleaned.trim()
}

/**
 * Safely parse JSON from Air Intra API response.
 * Handles cases where the API returns:
 * - PHP notices/warnings BEFORE, AFTER, or INSIDE the JSON array
 * - HTML error pages instead of JSON
 * - Proper API error objects with error_id
 */
async function safeParseAirIntraResponse(res: Response): Promise<{ data: any; error: string | null }> {
  const rawText = await res.text()

  // Step 1: Strip PHP notices from the entire response
  const text = stripPhpNotices(rawText)

  // Step 2: Find the start of JSON ({ or [)
  let jsonStart = -1
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{' || ch === '[') {
      jsonStart = i
      break
    }
  }

  if (jsonStart === -1) {
    const cleanText = text.substring(0, 300)
    return { data: null, error: `La API no devolvió datos JSON. ${cleanText || 'Respuesta vacía'}` }
  }

  const jsonText = text.substring(jsonStart)

  // Step 3: Try direct parse first
  try {
    const data = JSON.parse(jsonText)
    // Check for API-level errors
    if (data && typeof data === 'object' && !Array.isArray(data) && data.error_id) {
      if (data.error_id === 401) {
        return { data: null, error: `Token expirado o inválido. ${data.error_detail || ''}` }
      }
      if (data.error_id === 403) {
        return { data: null, error: `Demasiadas solicitudes. La API de Air Intra requiere esperar 5 minutos entre ciclos de consulta. ${data.error_detail || ''}` }
      }
      return { data: null, error: `Error API Air Intra (${data.error_id}): ${data.error_name || ''} - ${data.error_detail || ''}` }
    }
    return { data, error: null }
  } catch (firstError: any) {
    console.log(`[Air Intra] First JSON parse failed (${jsonText.length} chars): ${firstError.message}`)
  }

  // Step 4: If direct parse failed, try more aggressive cleanup
  let aggressiveClean = jsonText
    // Remove any remaining HTML tags
    .replace(/<[^>]*>/g, '')
    // Fix double commas (,,) that can appear after removing notices
    .replace(/,\s*,/g, ',')
    // Fix missing commas between objects: }{ should be },{
    .replace(/}\s*{/g, '},{')
    // Fix trailing commas before ] or }
    .replace(/,\s*([}\]])/g, '$1')

  try {
    const data = JSON.parse(aggressiveClean)
    if (data && typeof data === 'object' && !Array.isArray(data) && data.error_id) {
      if (data.error_id === 401) {
        return { data: null, error: `Token expirado o inválido. ${data.error_detail || ''}` }
      }
      if (data.error_id === 403) {
        return { data: null, error: `Demasiadas solicitudes. ${data.error_detail || ''}` }
      }
      return { data: null, error: `Error API Air Intra (${data.error_id}): ${data.error_name || ''}` }
    }
    console.log('[Air Intra] Aggressive cleanup parse succeeded')
    return { data, error: null }
  } catch (secondError: any) {
    console.log(`[Air Intra] Aggressive cleanup parse also failed: ${secondError.message}`)

    // Try to find the error position for debugging
    const posMatch = secondError.message.match(/position\s+(\d+)/i)
    if (posMatch) {
      const pos = parseInt(posMatch[1])
      const context = aggressiveClean.substring(Math.max(0, pos - 80), pos + 80)
      return { data: null, error: `Error JSON en posición ${pos}. Contexto: ...${context}...` }
    }

    const preview = aggressiveClean.substring(0, 200)
    return { data: null, error: `No se pudo interpretar la respuesta JSON (${aggressiveClean.length} chars). Preview: ${preview}` }
  }
}

/**
 * Parse a potentially corrupted Air Intra JSON array by extracting individual
 * product objects using regex. This is the ultimate fallback when the entire
 * JSON array can't be parsed due to PHP notices injected between/inside objects.
 * Returns an array of successfully parsed product objects.
 */
function extractProductsFromCorruptedJson(text: string): any[] {
  const products: any[] = []

  // Find all top-level JSON objects in the text
  // We look for patterns like {"codigo": ...} which are product objects
  // We track brace depth to find complete objects
  let i = 0
  while (i < text.length) {
    // Find the start of a JSON object
    if (text[i] !== '{') {
      i++
      continue
    }

    // Try to parse a complete object starting at position i
    let depth = 0
    let inStr = false
    let esc = false
    let objEnd = -1

    for (let j = i; j < text.length; j++) {
      const ch = text[j]

      if (esc) {
        esc = false
        continue
      }
      if (ch === '\\' && inStr) {
        esc = true
        continue
      }
      if (ch === '"') {
        inStr = !inStr
        continue
      }
      if (inStr) continue

      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          objEnd = j
          break
        }
      }
    }

    if (objEnd === -1) {
      i++
      continue
    }

    const objText = text.substring(i, objEnd + 1)

    // Quick check: skip objects that are clearly not products
    // (e.g., error objects, impuesto_iva fragments, etc.)
    if (objText.includes('"codigo"') || objText.includes('"codiart"')) {
      try {
        const obj = JSON.parse(objText)
        products.push(obj)
      } catch {
        // Object itself is corrupted, skip it
      }
    }

    i = objEnd + 1
  }

  return products
}

async function syncAirIntra(supplier: any): Promise<SyncResult> {
  const baseUrl = supplier.apiBaseUrl || 'https://api.air-intra.com/v2'
  const result: SyncResult = { ok: false, total: 0, created: 0, updated: 0, skipped: 0, errors: 0, message: '' }

  try {
    // Check if we synced recently (Air Intra has a 5-min rate limit between cycles)
    if (supplier.lastSyncAt) {
      const lastSync = new Date(supplier.lastSyncAt).getTime()
      const elapsed = Date.now() - lastSync
      const minInterval = 5 * 60 * 1000 // 5 minutes
      if (elapsed < minInterval) {
        const waitSeconds = Math.ceil((minInterval - elapsed) / 1000)
        result.message = `Debe esperar ${waitSeconds} segundos antes de sincronizar nuevamente (la API de Air Intra tiene un límite de 5 minutos entre solicitudes).`
        return result
      }
    }

    // Build category lookups
    const { slugToId, idToParentId, parentSlugToChildSlugs } = await buildCategoryLookup()
    const supplierMappings = await buildSupplierMappingLookup(supplier.id)

    // Step 1: Login to get a fresh token
    console.log('[Air Intra] Logging in...')
    const authRes = await fetch(`${baseUrl}/?q=login&user=${encodeURIComponent(supplier.apiUsername)}&pass=${encodeURIComponent(supplier.apiPassword)}`)

    if (!authRes.ok) {
      result.message = `Error de autenticación Air Intra: ${authRes.status}`
      return result
    }

    const { data: authData, error: authError } = await safeParseAirIntraResponse(authRes)
    if (authError || !authData?.token) {
      result.message = authError || 'No se recibió token de Air Intra'
      return result
    }

    const token = authData.token
    const exchangeRate = parseFloat(authData.cotiza || '0')
    console.log(`[Air Intra] Login OK. Cotización: ${exchangeRate}`)

    // Step 2: Always use syp endpoint (Stock & Price)
    // The articulos endpoint has complex nested objects and PHP notices that corrupt the JSON.
    // syp returns simpler, flatter objects that are easier to parse.
    const endpoint = 'syp'
    console.log(`[Air Intra] Using endpoint: ${endpoint}`)

    // Step 3: Fetch products page by page
    // Per Air Intra docs: pages can be fetched sequentially without delay.
    // The 5-minute wait is only between COMPLETE download cycles, not between pages.
    let page = 0
    const pageSize = 500
    let hasMore = true
    let totalFetched = 0
    let created = 0
    let updated = 0
    let skipped = 0
    let errors = 0
    let usedExtractionFallback = false

    while (hasMore) {
      console.log(`[Air Intra] Fetching page ${page}...`)
      const productsRes = await fetch(`${baseUrl}/?q=${endpoint}&page=${page}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      if (!productsRes.ok) {
        const errText = await productsRes.text().catch(() => '')
        result.message = `Error HTTP ${productsRes.status} al obtener productos de Air Intra (página ${page}). ${errText.substring(0, 200)}`
        result.total = totalFetched
        result.created = created
        result.updated = updated
        result.skipped = skipped
        result.errors = errors + 1
        return result
      }

      // Get raw text first (we need it for fallback and verification), then try standard parse
      let products: any[] | null = null
      const rawResponseText = await productsRes.text()
      const { data: parsedProducts, error: parseError } = await (async () => {
        // Create a new Response from the cached text for our parser
        const fakeRes = new Response(rawResponseText, {
          headers: productsRes.headers,
          status: productsRes.status,
        })
        return safeParseAirIntraResponse(fakeRes)
      })()

      if (parseError) {
        console.log(`[Air Intra] Standard parse failed: ${parseError}. Trying object extraction...`)

        // Fallback: extract individual product objects from the corrupted response
        if (rawResponseText) {
          const cleanedText = stripPhpNotices(rawResponseText)
          products = extractProductsFromCorruptedJson(cleanedText)
          usedExtractionFallback = true
          console.log(`[Air Intra] Extracted ${products.length} products from corrupted response`)
        }

        if (!products || products.length === 0) {
          // Check if it's a rate limit error — don't count as fatal
          if (rawResponseText.includes('Too many queries') || rawResponseText.includes('error_id":403')) {
            result.message = `Rate limit de Air Intra alcanzado. Se sincronizaron ${totalFetched} productos antes del límite. Intente de nuevo en 5 minutos.`
            result.ok = totalFetched > 0
          } else {
            result.message = parseError
            result.errors = errors + 1
          }
          result.total = totalFetched
          result.created = created
          result.updated = updated
          result.skipped = skipped
          return result
        }
      } else {
        if (!Array.isArray(parsedProducts) || parsedProducts.length === 0) {
          hasMore = false
          break
        }
        products = parsedProducts

        // ==========================================
        // ROBUSTNESS IMPROVEMENT: Always run extractProductsFromCorruptedJson
        // as a verification layer on top of the standard parse.
        // Even when JSON.parse succeeds, some products can be lost because
        // PHP notices injected INSIDE the JSON array can cause the parser
        // to silently skip objects after the corruption point.
        // We extract by object from the raw text and merge any missing products.
        // ==========================================
        if (rawResponseText) {
          const cleanedText = stripPhpNotices(rawResponseText)
          const extractedProducts = extractProductsFromCorruptedJson(cleanedText)

          if (extractedProducts.length > products.length) {
            // The extractor found more products than the standard parse!
            // This means the standard JSON.parse silently dropped some products.
            // Build a Set of SKUs already in our parsed array for fast lookup.
            const parsedSkus = new Set(
              products.map((p: any) => p.codigo || p.codiart || '').filter(Boolean)
            )

            let recoveredCount = 0
            for (const extracted of extractedProducts) {
              const sku = extracted.codigo || extracted.codiart || ''
              if (sku && !parsedSkus.has(sku)) {
                // This product was missed by the standard parse — add it
                products.push(extracted)
                recoveredCount++
              }
            }

            if (recoveredCount > 0) {
              console.log(`[Air Intra] ⚡ Recovery: standard parse had ${products.length - recoveredCount} products, extractor found ${recoveredCount} additional products that were lost in corrupted JSON. Total: ${products.length}`)
            }
          } else if (extractedProducts.length > 0 && extractedProducts.length < products.length * 0.8) {
            // Extractor found significantly fewer products — likely the response was clean
            // and the extractor is just less efficient. No action needed.
            console.log(`[Air Intra] Verification OK: standard parse ${products.length} vs extractor ${extractedProducts.length} products`)
          }
        }
      }

      for (const product of products) {
        totalFetched++
        try {
          const price = parseFloat(product.precio || '0')
          if (price <= 0) {
            skipped++
            continue
          }

          const providerSku = product.codigo || product.codiart || ''
          const costPrice = price
          const supplierCategory = getAirIntraSupplierCategory(product)

          // Air Intra prices are in USD
          const markup = supplier.markup || 30
          const sellingPrice = costPrice * (1 + markup / 100)

          // Check total available stock across warehouses
          const totalStock = (product.air?.disponible || 0) +
            (product.lug?.disponible || 0) +
            (product.ros?.disponible || 0) +
            (product.cba?.disponible || 0) +
            (product.mza?.disponible || 0) +
            (product.stock_disponible || 0)

          const productName = product.descrip || product.descripcion || product.titulo || ''

          const existing = await db.execute({
            sql: 'SELECT id FROM products WHERE providerId = ? AND providerSku = ?',
            args: [supplier.id, providerSku],
          })

          const existingRows = existing.rows as any[]

          const { categoryId } = mapProductToCategory(
            productName,
            supplierCategory,
            supplierMappings,
            slugToId,
            idToParentId,
            parentSlugToChildSlugs
          )

          // ==========================================
          // Air Intra isActive logic — aligned with Invid/Elit:
          // Products with price > 0 are active (same as Invid).
          // Products with price <= 0 are inactive.
          // If allowedCategories is configured (non-null), additionally filter by category.
          // ==========================================
          let airIntraIsActive = price > 0 ? 1 : 0

          if (airIntraIsActive === 1 && supplier.allowedCategories) {
            // allowedCategories is configured — apply category filter on top
            const supplierAllowedCategories: string[] | null = typeof supplier.allowedCategories === 'string'
              ? JSON.parse(supplier.allowedCategories)
              : supplier.allowedCategories

            if (supplierAllowedCategories !== null && categoryId) {
              const catSlug = Object.entries(slugToId).find(([_, id]) => id === categoryId)?.[0]
              const catParentId = idToParentId[categoryId]
              const catParentSlug = catParentId ? Object.entries(slugToId).find(([_, id]) => id === catParentId)?.[0] : null

              const isAllowedCategory = catSlug ? supplierAllowedCategories.includes(catSlug) : false
              const isChildOfAllowedCategory = catParentSlug ? supplierAllowedCategories.includes(catParentSlug) : false

              if (!isAllowedCategory && !isChildOfAllowedCategory) {
                airIntraIsActive = 0
              }
            }
          }

          if (existingRows.length > 0) {
            await db.execute({
              sql: `UPDATE products SET
                costPrice = ?, price = ?, stock = ?,
                supplierCategory = ?,
                categoryId = ?,
                isActive = ?,
                updatedAt = ?
              WHERE id = ?`,
              args: [costPrice, sellingPrice, totalStock, supplierCategory, categoryId, airIntraIsActive, new Date().toISOString(), existingRows[0].id],
            })
            updated++
          } else {
            if (!productName) {
              skipped++
              continue
            }

            const newId = crypto.randomUUID()
            const formattedName = formatProductName(productName)
            const slug = generateSlug(formattedName)

            // Build specs from syp data (limited fields)
            const specs: Record<string, string> = {}
            if (product.garantia) specs['Garantía'] = product.garantia
            if (product.moneda) specs['Moneda'] = product.moneda
            if (product.marca) specs['Marca'] = product.marca
            if (product.rubro) specs['Rubro'] = product.rubro

            await db.execute({
              sql: `INSERT INTO products (id, name, slug, description, price, costPrice, sku, stock, isActive, isFeatured, images, specs, providerId, providerSku, categoryId, supplierCategory)
                    VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?)`,
              args: [
                newId,
                formattedName,
                slug,
                sellingPrice,
                costPrice,
                providerSku,
                totalStock,
                airIntraIsActive,
                0,
                JSON.stringify(specs),
                supplier.id,
                providerSku,
                categoryId,
                supplierCategory,
              ],
            })
            created++
          }
        } catch (err) {
          console.error('Error processing Air Intra product:', err)
          errors++
        }
      }

      console.log(`[Air Intra] Page ${page} processed: ${products.length} items`)
      page++
      if (products.length < pageSize) {
        hasMore = false
      }
      // NO delay between pages - Air Intra docs confirm pagination is immediate
    }

    const syncNow2 = new Date().toISOString()
    await db.execute({
      sql: 'UPDATE suppliers SET lastSyncAt = ?, updatedAt = ? WHERE id = ?',
      args: [syncNow2, syncNow2, supplier.id],
    })

    // ==========================================
    // POST-SYNC VERIFICATION: Compare synced total with DB count.
    // If we synced significantly fewer products than what Air Intra has in the DB,
    // it may indicate that the API response was corrupted and products were lost.
    // We log a warning so the admin knows to re-sync.
    // ==========================================
    try {
      const dbCount = await db.execute({
        sql: 'SELECT COUNT(*) as cnt FROM products WHERE providerId = ?',
        args: [supplier.id],
      })
      const dbTotal = (dbCount.rows as any[])[0]?.cnt || 0
      console.log(`[Air Intra] Post-sync verification: synced ${totalFetched} from API, ${dbTotal} in DB`)

      if (totalFetched > 0 && dbTotal > 0 && totalFetched < dbTotal * 0.85) {
        // We synced way fewer products than what the DB has — this is normal
        // because the DB accumulates products over time and some may have been
        // deleted from the supplier. But if it's a FRESH sync and the API
        // returned fewer than expected, it could indicate data loss.
        console.log(`[Air Intra] ⚠️ Warning: synced ${totalFetched} products but DB has ${dbTotal}. Some products may have been lost during sync due to corrupted JSON.`)
      }
    } catch (verifyErr) {
      // Don't fail the sync if verification fails
      console.error('[Air Intra] Post-sync verification error:', verifyErr)
    }

    result.ok = true
    result.total = totalFetched
    result.created = created
    result.updated = updated
    result.skipped = skipped
    result.errors = errors

    // Include recovery info in the message if products were recovered
    const recoveryNote = usedExtractionFallback
      ? ' (usando extracción de objetos por JSON corrupto)'
      : ''
    result.message = `Sincronización completada: ${totalFetched} productos, ${created} nuevos, ${updated} actualizados, ${skipped} omitidos${recoveryNote}`

  } catch (error: any) {
    result.message = `Error de conexión con Air Intra: ${error.message}`
  }

  return result
}

async function syncElit(supplier: any): Promise<SyncResult> {
  const baseUrl = supplier.apiBaseUrl || 'https://clientes.elit.com.ar'
  const result: SyncResult = { ok: false, total: 0, created: 0, updated: 0, skipped: 0, errors: 0, message: '' }

  try {
    // Build category lookups
    const { slugToId, idToParentId, parentSlugToChildSlugs } = await buildCategoryLookup()
    const supplierMappings = await buildSupplierMappingLookup(supplier.id)

    const userId = parseInt(supplier.apiUserId || '0')
    const token = supplier.apiToken || ''

    if (!userId || !token) {
      result.message = 'Falta user_id o token para ELIT. Verifique las credenciales de la API.'
      return result
    }

    let offset = 1
    const pageSize = 100
    let hasMore = true
    let totalFetched = 0
    let created = 0
    let updated = 0
    let skipped = 0
    let errors = 0

    while (hasMore) {
      const productsRes = await fetch(
        `${baseUrl}/v1/api/productos?limit=${pageSize}&offset=${offset}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, token }),
        }
      )

      if (!productsRes.ok) {
        result.message = `Error fetching products from ELIT: ${productsRes.status}`
        result.total = totalFetched
        result.created = created
        result.updated = updated
        result.skipped = skipped
        result.errors = errors + 1
        return result
      }

      const data = await productsRes.json()
      const products = data.resultado || []

      if (!Array.isArray(products) || products.length === 0) {
        hasMore = false
        break
      }

      for (const product of products) {
        totalFetched++
        try {
          const price = parseFloat(product.precio || '0')
          if (price <= 0) {
            skipped++
            continue
          }

          const providerSku = product.codigo_alfa || ''
          const costPrice = price
          const markup = supplier.markup || 30
          const sellingPrice = costPrice * (1 + markup / 100)
          const supplierCategory = getElitSupplierCategory(product)
          const stockTotal = parseInt(product.stock_total || '0')

          const existing = await db.execute({
            sql: 'SELECT id FROM products WHERE providerId = ? AND providerSku = ?',
            args: [supplier.id, providerSku],
          })

          const existingRows = existing.rows as any[]

          const { categoryId } = mapProductToCategory(
            product.nombre || product.descripcion || '',
            supplierCategory,
            supplierMappings,
            slugToId,
            idToParentId,
            parentSlugToChildSlugs
          )

          if (existingRows.length > 0) {
            await db.execute({
              sql: `UPDATE products SET
                costPrice = ?, price = ?, stock = ?,
                supplierCategory = ?,
                updatedAt = ?
              WHERE id = ?`,
              args: [costPrice, sellingPrice, stockTotal, supplierCategory, new Date().toISOString(), existingRows[0].id],
            })
            updated++
          } else {
            if (!product.nombre) {
              skipped++
              continue
            }

            const newId = crypto.randomUUID()
            const formattedName = formatProductName(product.nombre)
            const slug = generateSlug(formattedName)

            const images = Array.isArray(product.imagenes) && product.imagenes.length > 0
              ? JSON.stringify(product.imagenes)
              : '[]'

            const specs: Record<string, string> = {}
            if (product.marca) specs['Marca'] = product.marca
            if (product.ean) specs['EAN'] = product.ean
            if (product.garantia) specs['Garantía'] = product.garantia
            if (product.peso) specs['Peso'] = `${product.peso} kg`
            if (product.gamer) specs['Gamer'] = 'Sí'

            await db.execute({
              sql: `INSERT INTO products (id, name, slug, description, price, comparePrice, costPrice, sku, stock, isActive, isFeatured, images, specs, providerId, providerSku, categoryId, supplierCategory)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                newId,
                formattedName,
                slug,
                product.descripcion || '',
                sellingPrice,
                product.pvp_usd ? parseFloat(product.pvp_usd) * (1 + markup / 100) : null,
                costPrice,
                providerSku,
                stockTotal,
                1,
                0,
                images,
                JSON.stringify(specs),
                supplier.id,
                providerSku,
                categoryId,
                supplierCategory,
              ],
            })
            created++
          }
        } catch (err) {
          console.error('Error processing ELIT product:', err)
          errors++
        }
      }

      offset += pageSize
      if (products.length < pageSize) {
        hasMore = false
      }
    }

    const syncNow3 = new Date().toISOString()
    await db.execute({
      sql: 'UPDATE suppliers SET lastSyncAt = ?, updatedAt = ? WHERE id = ?',
      args: [syncNow3, syncNow3, supplier.id],
    })

    result.ok = true
    result.total = totalFetched
    result.created = created
    result.updated = updated
    result.skipped = skipped
    result.errors = errors
    result.message = `Sincronización completada: ${totalFetched} productos, ${created} nuevos, ${updated} actualizados, ${skipped} omitidos`

  } catch (error: any) {
    result.message = `Error de conexión con ELIT: ${error.message}`
  }

  return result
}

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { supplierId } = await request.json()

    if (!supplierId) {
      return NextResponse.json({ error: 'supplierId requerido' }, { status: 400 })
    }

    const supplierResult = await db.execute({
      sql: 'SELECT * FROM suppliers WHERE id = ?',
      args: [supplierId],
    })

    const supplier = (supplierResult.rows as any[])[0]
    if (!supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    let syncResult: SyncResult

    switch (supplier.apiType) {
      case 'invid':
        syncResult = await syncInvid(supplier)
        break
      case 'air_intra':
        syncResult = await syncAirIntra(supplier)
        break
      case 'elit':
        syncResult = await syncElit(supplier)
        break
      default:
        return NextResponse.json({
          error: `Tipo de API "${supplier.apiType}" no soportado. Tipos disponibles: invid, air_intra, elit`,
        }, { status: 400 })
    }

    // Run post-sync category validation to fix any miscategorized products
    // IMPORTANT: This now runs on EVERY sync (not just when new products are created)
    // because even existing products may have been categorized incorrectly by a previous sync
    if (syncResult.ok) {
      try {
        console.log('[sync] Running post-sync category validation...')
        const catResult = await db.execute('SELECT id, slug FROM categories')
        const slugToId: Record<string, string> = {}
        for (const row of catResult.rows as any[]) {
          slugToId[row.slug] = row.id
        }

        // Comprehensive list of miscategorization fixes for PC Builder categories
        // These patterns catch products that keyword-matching placed in the wrong category
        const QUICK_FIXES: { namePattern: string; wrongSlug: string; correctSlug: string }[] = [
          // === Placas de Video corrections ===
          { namePattern: "name LIKE 'Vga %M/m%' OR name LIKE 'Vga %Mts%' OR name LIKE 'Vga %Pin%'", wrongSlug: 'placas-de-video', correctSlug: 'cables-y-adaptadores' },
          { namePattern: "name LIKE 'Ip Cam%' OR name LIKE 'IP Cam%'", wrongSlug: 'placas-de-video', correctSlug: 'placas-de-red' },
          { namePattern: "name LIKE 'HP Z%'", wrongSlug: 'placas-de-video', correctSlug: 'pc-armadas' },
          { namePattern: "name LIKE 'DELL P%'", wrongSlug: 'placas-de-video', correctSlug: 'pc-armadas' },
          { namePattern: "name LIKE '%NOTEBOOK%' OR name LIKE '%LAPTOP%'", wrongSlug: 'placas-de-video', correctSlug: 'notebooks' },
          { namePattern: "name LIKE '%PC GAMER%' OR name LIKE '%PC LENOVO%' OR name LIKE '%PC KELYX%'", wrongSlug: 'placas-de-video', correctSlug: 'pc-armadas' },
          { namePattern: "name LIKE '%MINI PC%' OR name LIKE '%BAREBONE%'", wrongSlug: 'placas-de-video', correctSlug: 'pc-armadas' },
          { namePattern: "name LIKE '%REPUESTO%' OR name LIKE '%(RMA)%'", wrongSlug: 'placas-de-video', correctSlug: 'motherboards' },
          { namePattern: "name LIKE '%CABLE%' OR name LIKE '%ADAPTADOR%'", wrongSlug: 'placas-de-video', correctSlug: 'cables-y-adaptadores' },
          { namePattern: "name LIKE '%MONITOR%'", wrongSlug: 'placas-de-video', correctSlug: 'monitores' },
          { namePattern: "name LIKE '%MB %' OR name LIKE '%MB+%'", wrongSlug: 'placas-de-video', correctSlug: 'motherboards' },
          // === Microprocesadores corrections ===
          { namePattern: "name LIKE '%NOTEBOOK%' OR name LIKE '%LAPTOP%'", wrongSlug: 'microprocesadores', correctSlug: 'notebooks' },
          { namePattern: "name LIKE '%PC GAMER%' OR name LIKE '%PC LENOVO%' OR name LIKE '%SIST.%'", wrongSlug: 'microprocesadores', correctSlug: 'pc-armadas' },
          { namePattern: "name LIKE '%MOTHER%'", wrongSlug: 'microprocesadores', correctSlug: 'motherboards' },
          { namePattern: "name LIKE '%MINI PC%' OR name LIKE '%BAREBONE%'", wrongSlug: 'microprocesadores', correctSlug: 'pc-armadas' },
          // === Memorias RAM corrections ===
          { namePattern: "name LIKE '%NOTEBOOK%' OR name LIKE '%LAPTOP%'", wrongSlug: 'memorias-ram', correctSlug: 'notebooks' },
          { namePattern: "name LIKE '%PC GAMER%' OR name LIKE '%PC LENOVO%'", wrongSlug: 'memorias-ram', correctSlug: 'pc-armadas' },
          // === Discos SSD corrections ===
          { namePattern: "name LIKE '%EXTERNO%' OR name LIKE '%EXTERNA%' OR name LIKE '%PORTABLE%'", wrongSlug: 'discos-ssd', correctSlug: 'discos-externos' },
          { namePattern: "name LIKE '%NOTEBOOK%' OR name LIKE '%LAPTOP%'", wrongSlug: 'discos-ssd', correctSlug: 'notebooks' },
          { namePattern: "name LIKE '%PC GAMER%' OR name LIKE '%PC LENOVO%'", wrongSlug: 'discos-ssd', correctSlug: 'pc-armadas' },
          { namePattern: "name LIKE '%PENDRIVE%' OR name LIKE '%FLASH DRIVE%'", wrongSlug: 'discos-ssd', correctSlug: 'pendrives' },
          // === Discos HDD corrections ===
          { namePattern: "name LIKE '%EXTERNO%' OR name LIKE '%EXTERNA%' OR name LIKE '%PORTABLE%'", wrongSlug: 'discos-hdd', correctSlug: 'discos-externos' },
          // === Fuentes corrections ===
          { namePattern: "name LIKE '%PC GAMER%'", wrongSlug: 'fuentes', correctSlug: 'pc-armadas' },
          // === Gabinetes corrections ===
          { namePattern: "name LIKE '%PC GAMER%'", wrongSlug: 'gabinetes', correctSlug: 'pc-armadas' },
        ]

        let autoFixed = 0
        for (const fix of QUICK_FIXES) {
          const wrongCatId = slugToId[fix.wrongSlug]
          const correctCatId = slugToId[fix.correctSlug]
          if (!wrongCatId || !correctCatId) continue
          const r = await db.execute({
            sql: `UPDATE products SET categoryId = ?, categorySource = 'auto', updatedAt = datetime('now') WHERE categoryId = ? AND (${fix.namePattern}) AND (categorySource IS NULL OR categorySource != 'manual')`,
            args: [correctCatId, wrongCatId],
          })
          autoFixed += (r.rowsAffected as number) || 0
        }
        if (autoFixed > 0) {
          console.log(`[sync] Post-sync validation: auto-fixed ${autoFixed} miscategorized products`)
          syncResult.message += ` | ${autoFixed} categorías corregidas automáticamente`
        }
      } catch (validationErr) {
        console.warn('[sync] Post-sync validation failed (non-critical):', validationErr)
      }
    }

    return NextResponse.json({ ...syncResult })
  } catch (error) {
    console.error('Error syncing supplier:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
