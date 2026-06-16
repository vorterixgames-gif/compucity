import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formatProductName, generateSlug } from '@/lib/format-product'
import { getCurrentAdmin } from '@/lib/admin-auth'

// Allow up to 300s on Vercel Pro (Hobby plan caps at 60s — harmless if set higher)
// This matches the cron sync route's timeout.
export const maxDuration = 300

interface SyncResult {
  ok: boolean
  total: number
  created: number
  updated: number
  skipped: number
  errors: number
  message: string
  hasMore?: boolean       // true if there are more pages to sync (batch mode)
  nextPage?: number      // next page to start from (batch mode)
  token?: string         // Air Intra auth token to reuse (batch mode)
  exchangeRate?: number  // Exchange rate from login (batch mode)
  batchProgress?: { current: number; total: number }  // e.g. { current: 1, total: 4 }
}

// Batch parameters for Air Intra chunked sync
interface AirIntraBatchParams {
  startPage: number
  endPage: number
  token?: string
  exchangeRate?: number
  finalize?: boolean
}

// Number of pages per batch (1 × 500 = 500 products, keeps each batch well under 60s)
// Previously 2 (1000 products) but still timed out on Vercel Hobby 60s limit.
// 1 page per batch keeps total request time at ~10-15s including DB writes.
const PAGES_PER_BATCH = 1

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
      // Oficina PCs (default for most branded PCs) -> PC Armadas/Oficina
      { keywords: ['SIST.', 'KELYX', 'OFFICE', 'OFICINA', 'PC AIR', 'PC CX', 'PC ARKHAM', 'PC GAMEMAX', 'PC LENOVO', 'PC DELL', 'PC HP', 'PC'], subcategorySlug: 'oficina-pc', name: 'Oficina' },
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
  // Switches — MUST be before PC Armadas to catch "Desktop Switch" products
  { keywords: ['SWITCH'], categorySlug: 'switches', name: 'Switches' },
  // Routers — MUST be before PC Armadas to catch router products
  { keywords: ['ROUTER','ARCHER','DECO','MESH WIFI','TL-WR','ROU WI'], categorySlug: 'routers-wifi', name: 'Routers WiFi' },
  // PC Armadas — complete PCs that may contain RTX/DDR/SSD in name
  // NOTE: "DESKTOP" removed — too generic, matches "Desktop Switch", "Desktop Router"
  { keywords: ['PC GAMER','PC LENOVO','PC KELYX','PC AIR','PC ARKHAM','PC GAMEMAX','PC CX','PC PERFORMANCE','PC XPG','SIST. KELYX','SIST.','COMPUTADORA','BAREBONE','DESKTOP PC','ALL IN ONE','ALL-IN-ONE','AIO 22','AIO 24','POS '], categorySlug: 'pc-armadas', name: 'PC Armadas' },
  // Notebooks — contain RTX/DDR/SSD keywords but are NOT components
  { keywords: ['NOTEBOOK','LAPTOP','PORTATIL','NB CX','NB DELL','NB LENOVO'], categorySlug: 'notebooks', name: 'Notebooks' },
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
  // Routers WiFi (duplicate entry removed — already in GROUP 1 before PC Armadas)
  // Switches (duplicate entry removed — already in GROUP 1 before PC Armadas)
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
      // Switch products with "Desktop" in the name (e.g. "Switch 5P Tp-link Gigabit Desktop")
      nameKeyword: 'SWITCH',
      targetSlug: 'switches',
      sourceSlugs: ['pc-armadas', 'oficina-pc', 'gamer-pc', 'mini-pc', 'diseno-pc'],
    },
    {
      // Router products with "Desktop" in the name
      nameKeyword: 'ROUTER',
      targetSlug: 'routers-wifi',
      sourceSlugs: ['pc-armadas', 'oficina-pc', 'gamer-pc', 'mini-pc', 'diseno-pc'],
    },
    {
      // TP-Link products with "Desktop" (antennas, etc.) → Conectividad
      nameKeyword: 'TP-LINK',
      targetSlug: 'placas-de-red',
      sourceSlugs: ['pc-armadas', 'oficina-pc'],
    },
    {
      // PC AIR (Air Intra brand PCs) mis-categorized as components (contains PENTIUM/I3/etc.)
      nameKeyword: 'PC AIR',
      targetSlug: 'pc-armadas',
      sourceSlugs: ['microprocesadores', 'memorias-ram', 'discos-ssd', 'fuentes', 'gabinetes'],
    },
    {
      // PC ARKHAM mis-categorized as components
      nameKeyword: 'PC ARKHAM',
      targetSlug: 'pc-armadas',
      sourceSlugs: ['microprocesadores', 'memorias-ram', 'discos-ssd', 'fuentes', 'gabinetes'],
    },
    {
      // PC GAMEMAX mis-categorized as components
      nameKeyword: 'PC GAMEMAX',
      targetSlug: 'pc-armadas',
      sourceSlugs: ['microprocesadores', 'memorias-ram', 'discos-ssd', 'fuentes', 'gabinetes'],
    },
    {
      // PC CX (Air Intra brand PCs) mis-categorized as components
      nameKeyword: 'PC CX',
      targetSlug: 'pc-armadas',
      sourceSlugs: ['microprocesadores', 'memorias-ram', 'discos-ssd', 'fuentes', 'gabinetes'],
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
    {
      // Escritorios (desks) mis-categorized as PC Armadas
      nameKeyword: 'ESCRITORIO',
      targetSlug: 'escritorios',
      sourceSlugs: ['pc-armadas', 'oficina-pc', 'gamer-pc', 'mini-pc', 'diseno-pc'],
    },
    {
      // Antenas mis-categorized as PC Armadas
      nameKeyword: 'ANTENA',
      targetSlug: 'placas-de-red',
      sourceSlugs: ['pc-armadas', 'oficina-pc', 'gamer-pc'],
    },
    {
      // USB-C HDMI adapters mis-categorized as motherboards or placas-de-red
      nameKeyword: 'USB-C A HDMI',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['motherboards', 'placas-de-red'],
    },
    {
      // Adaptadores USB (card readers, video adapters) in placas-de-red → cables
      nameKeyword: 'ADAPTADOR TP-LINK USB',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['placas-de-red'],
    },
    {
      // Tensiómetros / health devices → no tech category (leave as null)
      nameKeyword: 'TENSIOMETRO',
      targetSlug: 'smart-home',
      sourceSlugs: ['pc-armadas', 'oficina-pc'],
    },
    {
      // Hikvision Switches mis-categorized as refrigeración or other categories
      nameKeyword: 'HIKVISION',
      targetSlug: 'switches',
      sourceSlugs: ['refrigeracion', 'placas-de-red'],
    },
    // === NEW: Prevent notebook accessories from going to notebooks category ===
    {
      // Notebook power adapters → cargadores
      nameKeyword: 'ALIMENTACION NOTEBOOK',
      targetSlug: 'cargadores',
      sourceSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno', 'tablets'],
    },
    {
      // "Fuente Notebook" → cargadores (not notebooks)
      nameKeyword: 'FUENTE NOTEBOOK',
      targetSlug: 'cargadores',
      sourceSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'],
    },
    {
      // "Fuente Alimentacion Notebook" → cargadores
      nameKeyword: 'FUENTE ALIMENTACION',
      targetSlug: 'cargadores',
      sourceSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'],
    },
    {
      // Cargador Universal → cargadores (not notebooks)
      nameKeyword: 'CARGADOR UNIVERSAL',
      targetSlug: 'cargadores',
      sourceSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'],
    },
    {
      // Notebook batteries → cargadores
      nameKeyword: 'BATERIA P/NOTEBOOK',
      targetSlug: 'cargadores',
      sourceSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'],
    },
    {
      // Soporte for laptops → bases (not notebooks)
      nameKeyword: 'SOPORTE P/ LAPTOP',
      targetSlug: 'bases',
      sourceSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'],
    },
    {
      // Auriculares for notebooks → auriculares (not notebooks)
      nameKeyword: 'AURICULAR',
      targetSlug: 'auriculares',
      sourceSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'],
    },
    {
      // Bolso/funda/mochila for notebooks → fundas-mochilas
      nameKeyword: 'BOLSO P/LAPTOP',
      targetSlug: 'fundas-mochilas',
      sourceSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'],
    },
    {
      // Parlante Portatil → parlantes (not notebooks - "portatil" triggers notebooks)
      nameKeyword: 'PARLANTE',
      targetSlug: 'parlantes',
      sourceSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'],
    },
    {
      // UPS Portatil → ups (not notebooks - "portatil" triggers notebooks)
      nameKeyword: 'UPS',
      targetSlug: 'ups',
      sourceSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'],
    },
    {
      // Bisagra Notebook → not notebooks (spare part)
      nameKeyword: 'BISAGRA NOTEBOOK',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'],
    },
    {
      // Caja P/Notebook → not notebooks
      nameKeyword: 'CAJA P/NOTEBOOK',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'],
    },
    {
      // Limpia Notebooks / Limpieza → not notebooks
      nameKeyword: 'LIMPIA NOTEBOOKS',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'],
    },
    {
      // Limpieza para equipos → not notebooks/pc-armadas
      nameKeyword: 'LIMPIEZA',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno', 'pc-armadas'],
    },
    {
      // Citizen PN (printer paper) → toners-y-cartuchos
      nameKeyword: 'CITIZEN PN',
      targetSlug: 'toners-y-cartuchos',
      sourceSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno'],
    },
    // === NEW: Prevent server fans from going to monitores ===
    {
      // Dell Standard Fan Cuskit → refrigeracion (not monitores)
      nameKeyword: 'STANDAR FAN',
      targetSlug: 'refrigeracion',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon', 'soportes-y-brazos'],
    },
    {
      nameKeyword: 'STANDARD FAN',
      targetSlug: 'refrigeracion',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon', 'soportes-y-brazos'],
    },
    {
      nameKeyword: 'FAN CUSKIT',
      targetSlug: 'refrigeracion',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon', 'soportes-y-brazos'],
    },
    {
      nameKeyword: 'FAN KIT',
      targetSlug: 'refrigeracion',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon', 'soportes-y-brazos'],
    },
    {
      nameKeyword: 'FAN CUSTOMER',
      targetSlug: 'refrigeracion',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon', 'soportes-y-brazos'],
    },
    {
      // Bandeja Gabitel Monitor Teclado → soportes-y-brazos (not monitores)
      nameKeyword: 'BANDEJA',
      targetSlug: 'soportes-y-brazos',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon'],
    },
    {
      // APC Rack LCD Monitor → soportes-y-brazos (KVM rack drawer)
      nameKeyword: 'RACK LCD MONITOR',
      targetSlug: 'soportes-y-brazos',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon'],
    },
    // === NEW: PC Performance in discos-ssd ===
    {
      nameKeyword: 'PC PERFORMANCE',
      targetSlug: 'pc-armadas',
      sourceSlugs: ['discos-ssd', 'memorias-ram', 'microprocesadores', 'fuentes', 'gabinetes'],
    },
    {
      nameKeyword: 'PC HP',
      targetSlug: 'pc-armadas',
      sourceSlugs: ['discos-ssd', 'memorias-ram', 'microprocesadores', 'fuentes', 'gabinetes'],
    },
    // === NEW: Motherboard Notebook in motherboards ===
    {
      nameKeyword: 'MOTHERBOARD NOTEBOOK',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['motherboards'],
    },
    {
      nameKeyword: 'MOTHERBOARD P/NOTEBOOK',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['motherboards'],
    },
    {
      nameKeyword: 'MOTHERBOARD PARA NOTEBOOK',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['motherboards'],
    },
    // === NEW: Projectors/Scanners with "Portatil" keyword → not notebooks ===
    {
      nameKeyword: 'PROYECTOR',
      targetSlug: 'impresion',
      sourceSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno', 'gamer-y-diseno'],
    },
    {
      nameKeyword: 'SCANNER',
      targetSlug: 'impresion',
      sourceSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno', 'gamer-y-diseno'],
    },
    // === NEW: "Notebook XXW" chargers that look like notebooks ===
    {
      nameKeyword: 'NOTEBOOK P/AUTO',
      targetSlug: 'cargadores',
      sourceSlugs: ['notebooks', 'gamer', 'oficina', 'ultrabooks', 'diseno', 'gamer-y-diseno'],
    },
    // APC Netbotz Rack Monitor (environmental monitoring, not display)
    {
      nameKeyword: 'NETBOTZ RACK MONITOR',
      targetSlug: 'placas-de-red',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon'],
    },
    // Plotter stands
    {
      nameKeyword: 'SOPORTE PLOTTER',
      targetSlug: 'impresion',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon', 'soportes-y-brazos'],
    },
    // === NEW: Prevent non-monitor products with "MONITOR" keyword from going to monitores ===
    {
      // "De Monitor Color" / "De Monitor Vga" are cables, not monitors
      nameKeyword: 'DE MONITOR',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon'],
    },
    {
      // "P/Monitor" or "P/Monitores" are cable/accessory bags
      nameKeyword: 'P/MONITOR',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon'],
    },
    {
      // "P/ Monitores" with space variant
      nameKeyword: 'P/ MONITORES',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon'],
    },
    {
      // "Monitor-pc Usb" cables
      nameKeyword: 'MONITOR-PC USB',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon'],
    },
    {
      // "Multiseñal de Monitor" KVM switches
      nameKeyword: 'MULTISE',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon'],
    },
    {
      // "Case Monitor" display cases (not monitors)
      nameKeyword: 'CASE MONITOR',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon'],
    },
    {
      // APC SNMP/Tarjeta Monitoreo (rack monitoring, not display)
      nameKeyword: 'SNMP CARD',
      targetSlug: 'placas-de-red',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon'],
    },
    {
      nameKeyword: 'SENSOR MONITOREO',
      targetSlug: 'placas-de-red',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon'],
    },
    {
      // "Monitor Plastic Black" generic plastic part
      nameKeyword: 'MONITOR PLASTIC',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon'],
    },
    {
      // "HP Shelf Monitor" rack shelf
      nameKeyword: 'SHELF MONITOR',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon'],
    },
    {
      // Baby monitors (Ezviz BM1 Rabbit)
      nameKeyword: 'BABY CALL MONITOR',
      targetSlug: 'hogar-inteligente',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon'],
    },
    {
      // "Monitor 15M/15H" cables
      nameKeyword: 'MONITOR 15M',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon'],
    },
    {
      // Aruba antennas with "MNT" (mount) in name
      nameKeyword: 'AP-ANT-MNT',
      targetSlug: 'placas-de-red',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon', 'soportes-y-brazos'],
    },
    {
      // Aruba Cx rack mount kits
      nameKeyword: 'ARUBA CX 10000',
      targetSlug: 'placas-de-red',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon', 'soportes-y-brazos'],
    },
    {
      // Aruba AP mount brackets
      nameKeyword: 'AP-MNT',
      targetSlug: 'placas-de-red',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon', 'soportes-y-brazos'],
    },
    {
      // "Palo Selfie" in soportes-y-brazos
      nameKeyword: 'SELFIE',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['soportes-y-brazos'],
    },
    {
      // Oracle/SQL licenses
      nameKeyword: 'ORACLE DATABASE',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['soportes-y-brazos'],
    },
    {
      nameKeyword: 'SQL SERVER',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['soportes-y-brazos'],
    },
    {
      nameKeyword: 'WINSSVR',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['soportes-y-brazos'],
    },
    {
      // Dell/HP server heatsinks and bezels
      nameKeyword: 'HEATSINK',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon', 'soportes-y-brazos'],
    },
    {
      nameKeyword: 'BEZEL',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon', 'soportes-y-brazos'],
    },
    {
      // "Canaleta Furukawa" cable trays
      nameKeyword: 'CANAleta FURUKAWA',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon', 'soportes-y-brazos'],
    },
    {
      // "Cctv Soporte" camera mounts
      nameKeyword: 'CCTV SOPORTE',
      targetSlug: 'hogar-inteligente',
      sourceSlugs: ['soportes-y-brazos'],
    },
    {
      // "Soporte Dahua" security accessories
      nameKeyword: 'SOPORTE DAHUA',
      targetSlug: 'hogar-inteligente',
      sourceSlugs: ['soportes-y-brazos'],
    },
    {
      // Printer sensor arms
      nameKeyword: 'BRAZO SENSOR',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['soportes-y-brazos'],
    },
    {
      // Samsung TV replacement stands (BN96 parts)
      nameKeyword: 'ASSY STAND',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['soportes-y-brazos'],
    },
    {
      // "Cover-stand" TV replacement parts
      nameKeyword: 'COVER-STAND',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['soportes-y-brazos'],
    },
    {
      // "Pad Poroso" printer parts
      nameKeyword: 'PAD POROSO',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['soportes-y-brazos'],
    },
    {
      // "Electro Canal" electrical conduits
      nameKeyword: 'ELECTRO CANAL',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['soportes-y-brazos'],
    },
    {
      // "No Vender" products
      nameKeyword: 'NO VENDER',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['soportes-y-brazos'],
    },
    {
      // "HP X410 Rack Mount Kit" server parts
      nameKeyword: 'RACK MOUNTING KIT',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon', 'soportes-y-brazos'],
    },
    {
      nameKeyword: 'RACK MOUNT KIT',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['monitores', 'oficina-mon', 'gamer-mon', 'diseno-mon', 'soportes-y-brazos'],
    },
    {
      // "Hpe Sy480" server drive kits
      nameKeyword: 'HPE SY480',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['soportes-y-brazos'],
    },
    {
      // "Dell Soporte Para Disco" server disk brackets
      nameKeyword: 'SOPORTE PARA DISCO',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['soportes-y-brazos'],
    },
    {
      // "Soporte Pared Epson" projector mounts
      nameKeyword: 'SOPORTE PARED EPSON',
      targetSlug: 'impresion',
      sourceSlugs: ['soportes-y-brazos'],
    },
    {
      // "Aspiracion Localizada" industrial arm
      nameKeyword: 'ASPIRACION LOCALIZADA',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['soportes-y-brazos'],
    },
    {
      // "Soporte Instalacion Poste" telecom pole mounts
      nameKeyword: 'SOPORTE INSTALACION',
      targetSlug: 'cables-y-adaptadores',
      sourceSlugs: ['soportes-y-brazos'],
    },
    {
      // "Soporte Ezviz" camera accessories
      nameKeyword: 'SOPORTE EZVIZ',
      targetSlug: 'hogar-inteligente',
      sourceSlugs: ['soportes-y-brazos'],
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

export async function syncInvid(supplier: any): Promise<SyncResult> {
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
    // Step 1: Remove <b> and </b> tags FIRST.
    // Air Intra wraps file paths AND line numbers in <b> tags:
    //   "in <b>/path/file.php</b> on line <b>54</b>"
    // The old regex expected "on line \d+" (plain digits) and failed to match,
    // leaving notices inside JSON objects and making them unparseable.
    .replace(/<\/?b>/gi, '')
    // Step 2: Remove <br /> and <br> tags
    .replace(/<br\s*\/?>\s*/gi, '')
    // Step 3: Remove PHP notice/warning/error blocks (now plain text after HTML tag removal).
    // Matches: "Notice: <any text> on line <digits>" — non-greedy so it stops at the
    // first "on line NNN" (one notice at a time, even if multiple are consecutive).
    // Uses [\s\S] instead of . + 's' flag so this works on ES2017 targets.
    .replace(/(?:Notice|Warning|Fatal error|Parse error|Deprecated):\s*[\s\S]*?on line\s+\d+\s*/gi, '')
    // Step 4: Fix trailing commas before ] or } (happens when a notice is removed from
    // between the last value and the closing brace, e.g. {"k":"v",Notice:...} → {"k":"v",})
    .replace(/,\s*([}\]])/g, '$1')
    // Step 5: Fix missing commas between objects: }{ should be },{
    .replace(/}\s*{/g, '},{')
    // Step 6: Fix double commas (happens when a notice is removed from between two commas)
    .replace(/,\s*,/g, ',')

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

    // Pre-load existing products for this supplier (in-memory lookup for speed)
    // This avoids a SELECT query per product during the upsert phase
    console.log('[Air Intra] Pre-loading existing products from DB...')
    const existingProductsResult = await db.execute({
      sql: 'SELECT id, providerSku, slug FROM products WHERE providerId = ?',
      args: [supplier.id],
    })
    const existingBySku: Record<string, { id: string; slug: string }> = {}
    const allExistingSlugs = new Set<string>()
    for (const row of existingProductsResult.rows as any[]) {
      if (row.providerSku) existingBySku[row.providerSku] = { id: row.id, slug: row.slug }
      if (row.slug) allExistingSlugs.add(row.slug)
    }
    console.log(`[Air Intra] Loaded ${Object.keys(existingBySku).length} existing products`)

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

    // Step 2: Use articulos endpoint for richer data (includes rubro, grupo, garantia)
    // The articulos endpoint has category and warranty data that syp lacks.
    // We use a robust multi-layer parser to handle PHP notices in the response.
    const endpoint = 'articulos'
    console.log(`[Air Intra] Using endpoint: ${endpoint}`)

    // Step 3: Fetch products page by page
    // Per Air Intra docs: pages can be fetched sequentially without delay.
    // The 5-minute wait is only between COMPLETE download cycles, not between pages.
    const MAX_PAGES = 30  // Safety limit: 30 pages × 500 = 15,000 products max
    let page = 0
    const pageSize = 500
    let totalFetched = 0
    let created = 0
    let updated = 0
    let skipped = 0
    let errors = 0
    let consecutiveEmptyPages = 0
    let usedExtractionFallback = false
    let totalRecoveredByExtractor = 0
    // Track all SKUs fetched to detect duplicates across pages
    const allFetchedSkus = new Set<string>()

    while (page < MAX_PAGES) {
      console.log(`[Air Intra] Fetching page ${page}...`)
      let products: any[] | null = null
      let pageSucceeded = false
      let retryCount = 0
      const MAX_RETRIES = 2

      // Retry loop: if a page fails to parse, retry up to MAX_RETRIES times
      while (!pageSucceeded && retryCount <= MAX_RETRIES) {
        try {
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

            // Check for rate limit error in the response body
            if (errText.includes('Too many queries') || errText.includes('error_id":403')) {
              console.log(`[Air Intra] Rate limited on page ${page}. Stopping sync.`)
              result.message = `Rate limit de Air Intra alcanzado en página ${page}. Se sincronizaron ${totalFetched} productos. Intente de nuevo en 5 minutos.`
              result.ok = totalFetched > 0
              result.total = totalFetched
              result.created = created
              result.updated = updated
              result.skipped = skipped
              result.errors = errors
              // Don't count as error — rate limit is expected behavior
              await db.execute({
                sql: 'UPDATE suppliers SET lastSyncAt = ?, updatedAt = ? WHERE id = ?',
                args: [new Date().toISOString(), new Date().toISOString(), supplier.id],
              })
              return result
            }

            if (retryCount < MAX_RETRIES) {
              console.log(`[Air Intra] HTTP ${productsRes.status} on page ${page}, retrying (${retryCount + 1}/${MAX_RETRIES})...`)
              retryCount++
              await new Promise(r => setTimeout(r, 2000)) // Wait 2s before retry
              continue
            }

            result.message = `Error HTTP ${productsRes.status} al obtener productos de Air Intra (página ${page}). ${errText.substring(0, 200)}`
            result.total = totalFetched
            result.created = created
            result.updated = updated
            result.skipped = skipped
            result.errors = errors + 1
            return result
          }

          // Get raw text first (we need it for fallback and verification)
          const rawResponseText = await productsRes.text()
          const { data: parsedProducts, error: parseError } = await (async () => {
            const fakeRes = new Response(rawResponseText, {
              headers: productsRes.headers,
              status: productsRes.status,
            })
            return safeParseAirIntraResponse(fakeRes)
          })()

          if (parseError) {
            console.log(`[Air Intra] Standard parse failed on page ${page}: ${parseError}. Trying object extraction...`)

            // Fallback: extract individual product objects from the corrupted response
            if (rawResponseText) {
              const cleanedText = stripPhpNotices(rawResponseText)
              products = extractProductsFromCorruptedJson(cleanedText)
              usedExtractionFallback = true
              console.log(`[Air Intra] Extracted ${products.length} products from corrupted page ${page}`)
            }

            if (!products || products.length === 0) {
              // Empty page could mean end of data OR unrecoverable corruption
              // If this is the first page, it's likely an error. Otherwise, it might be the end.
              if (page === 0) {
                result.message = `No se pudieron obtener productos de Air Intra: ${parseError}`
                result.errors = errors + 1
                result.total = totalFetched
                result.created = created
                result.updated = updated
                result.skipped = skipped
                return result
              }
              // On later pages, treat empty result as end of data
              console.log(`[Air Intra] Page ${page} returned 0 products (possibly end of data). Stopping.`)
              pageSucceeded = true  // Mark as succeeded so we exit retry loop
              consecutiveEmptyPages++
              break
            }
            pageSucceeded = true
          } else {
            if (!Array.isArray(parsedProducts) || parsedProducts.length === 0) {
              // Truly empty page — end of data
              console.log(`[Air Intra] Page ${page} returned empty array. End of data.`)
              pageSucceeded = true
              consecutiveEmptyPages++
              break
            }
            products = parsedProducts

            // ==========================================
            // ROBUSTNESS: Always run extractProductsFromCorruptedJson
            // as a verification layer on top of the standard parse.
            // Even when JSON.parse succeeds, some products can be lost because
            // PHP notices injected INSIDE the JSON array can cause the parser
            // to silently skip objects after the corruption point.
            // ==========================================
            if (rawResponseText) {
              const cleanedText = stripPhpNotices(rawResponseText)
              const extractedProducts = extractProductsFromCorruptedJson(cleanedText)

              if (extractedProducts.length > products.length) {
                const parsedSkus = new Set(
                  products.map((p: any) => p.codigo || p.codiart || '').filter(Boolean)
                )

                let recoveredCount = 0
                for (const extracted of extractedProducts) {
                  const sku = extracted.codigo || extracted.codiart || ''
                  if (sku && !parsedSkus.has(sku)) {
                    products.push(extracted)
                    recoveredCount++
                  }
                }

                if (recoveredCount > 0) {
                  totalRecoveredByExtractor += recoveredCount
                  console.log(`[Air Intra] ⚡ Recovery on page ${page}: standard parse had ${products.length - recoveredCount}, extractor found ${recoveredCount} additional. Total: ${products.length}`)
                }
              } else {
                console.log(`[Air Intra] Page ${page} verification: standard ${products.length} vs extractor ${extractedProducts.length}`)
              }
            }
            pageSucceeded = true
          }
        } catch (fetchErr: any) {
          if (retryCount < MAX_RETRIES) {
            console.log(`[Air Intra] Fetch error on page ${page}: ${fetchErr.message}. Retrying (${retryCount + 1}/${MAX_RETRIES})...`)
            retryCount++
            await new Promise(r => setTimeout(r, 2000))
            continue
          }
          console.error(`[Air Intra] Fetch error on page ${page} after ${MAX_RETRIES} retries:`, fetchErr)
          errors++
          // Skip this page and continue to next
          pageSucceeded = true
          break
        }
      } // end retry loop

      // If we got no products after retries, check if we should stop
      if (!products || products.length === 0) {
        // Two consecutive empty pages = definitely end of data
        if (consecutiveEmptyPages >= 2 || page === 0) {
          break
        }
        // One empty page might be corruption — try one more page
        console.log(`[Air Intra] Page ${page} had 0 products. Trying next page to confirm end of data...`)
        page++
        continue
      }

      consecutiveEmptyPages = 0  // Reset since we got products

      // Collect DB operations for batch processing (much faster than individual queries)
      const dbOperations: Promise<void>[] = []

      for (const product of products) {
        try {
          const providerSku = product.codigo || product.codiart || ''

          // Skip duplicate products across pages (API bug can return duplicates)
          if (providerSku && allFetchedSkus.has(providerSku)) {
            skipped++
            continue
          }
          if (providerSku) allFetchedSkus.add(providerSku)

          totalFetched++

          const price = parseFloat(product.precio || '0')
          const productName = product.descrip || product.descripcion || product.titulo || ''
          const supplierCategory = getAirIntraSupplierCategory(product)
          const costPrice = price
          const markup = supplier.markup || 30
          const sellingPrice = costPrice > 0 ? costPrice * (1 + markup / 100) : 0
          // Stock por depósito - stock total de todos los depósitos
          const stockByWarehouse = {
            air: product.air?.disponible || 0,
            lug: product.lug?.disponible || 0,
            ros: product.ros?.disponible || 0,
            cba: product.cba?.disponible || 0,
            mza: product.mza?.disponible || 0,
          }
          const totalStock = Object.values(stockByWarehouse).reduce((a: number, b: number) => a + b, 0)
          const stockByWarehouseJson = JSON.stringify(stockByWarehouse)

          const { categoryId } = mapProductToCategory(
            productName, supplierCategory, supplierMappings, slugToId, idToParentId, parentSlugToChildSlugs
          )

          // Air Intra isActive logic
          let airIntraIsActive = price > 0 ? 1 : 0

          if (airIntraIsActive === 1 && supplier.allowedCategories) {
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

          // Use in-memory lookup instead of DB query
          const existingProduct = existingBySku[providerSku]
          const now = new Date().toISOString()

          if (existingProduct) {
            // UPDATE existing product
            dbOperations.push(
              db.execute({
                sql: `UPDATE products SET costPrice = ?, price = ?, stock = ?, stockByWarehouse = ?, supplierCategory = ?, categoryId = ?, isActive = ?, updatedAt = ? WHERE id = ?`,
                args: [costPrice, sellingPrice, totalStock, stockByWarehouseJson, supplierCategory, categoryId, airIntraIsActive, now, existingProduct.id],
              }).then(() => { updated++ }).catch((err) => { console.error('Error updating Air Intra product:', err); errors++ })
            )
          } else if (productName && providerSku) {
            // INSERT new product
            const newId = crypto.randomUUID()
            const formattedName = formatProductName(productName)
            let slug = generateSlug(formattedName)

            // Handle slug collision
            if (allExistingSlugs.has(slug)) {
              slug = slug + '-' + providerSku.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10)
            }
            allExistingSlugs.add(slug)

            const specs: Record<string, string> = {}
            if (product.garantia) specs['Garantía'] = product.garantia
            if (product.moneda) specs['Moneda'] = product.moneda
            if (product.marca) specs['Marca'] = product.marca
            if (product.rubro) specs['Rubro'] = product.rubro
            if (product.grupo) specs['Grupo'] = product.grupo
            if (product.tipo?.name) specs['Tipo'] = product.tipo.name
            if (product.estado?.name) specs['Estado'] = product.estado.name

            dbOperations.push(
              db.execute({
                sql: `INSERT INTO products (id, name, slug, description, price, costPrice, sku, stock, stockByWarehouse, isActive, isFeatured, images, specs, providerId, providerSku, categoryId, supplierCategory)
                      VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?)`,
                args: [newId, formattedName, slug, sellingPrice, costPrice, providerSku, totalStock, stockByWarehouseJson, airIntraIsActive, 0, JSON.stringify(specs), supplier.id, providerSku, categoryId, supplierCategory],
              }).then(() => {
                created++
                existingBySku[providerSku] = { id: newId, slug }
              }).catch((err) => { console.error('Error inserting Air Intra product:', err); errors++ })
            )
          } else {
            skipped++
          }
        } catch (err) {
          console.error('Error processing Air Intra product:', err)
          errors++
        }
      }

      // Execute all DB operations in parallel (limited concurrency to avoid overwhelming Turso)
      const BATCH_CONCURRENCY = 20
      for (let i = 0; i < dbOperations.length; i += BATCH_CONCURRENCY) {
        const batch = dbOperations.slice(i, i + BATCH_CONCURRENCY)
        await Promise.all(batch)
      }

      console.log(`[Air Intra] Page ${page} processed: ${products.length} items (total: ${totalFetched})`)
      page++

      // ==========================================
      // CRITICAL FIX: Don't stop pagination just because a page returned < 500 products!
      // PHP notices in the JSON can corrupt pages, causing the parser to return fewer products.
      // The old logic `if (products.length < pageSize) { hasMore = false }` was the main cause
      // of the ~2800 missing products bug.
      // Instead, we only stop when we get a truly empty page (0 products).
      // The MAX_PAGES safety limit prevents infinite loops.
      // ==========================================
      if (products.length === 0) {
        console.log(`[Air Intra] Page ${page - 1} had 0 products — end of data.`)
        break
      }
      // NO delay between pages - Air Intra docs confirm pagination is immediate
    }

    // ==========================================
    // SUPPLEMENTARY SYNC: Also fetch from the 'syp' endpoint.
    // The 'articulos' endpoint may not include all products — specifically,
    // "esquema" products (PC builds like "PC AIR", "PC CX", etc.) that are
    // configured as component bundles on the Air Intra website may only appear
    // in the 'syp' endpoint. We paginate through 'syp' and add any products
    // that are not already in the DB from the 'articulos' pass.
    // ==========================================
    console.log('[Air Intra] Starting supplementary syp endpoint sync...')
    const sypMarkup = supplier.markup || 30
    let sypCreated = 0
    let sypUpdated = 0
    let sypPage = 0
    const SYP_MAX_PAGES = 30
    const sypEndpoint = 'syp'

    while (sypPage < SYP_MAX_PAGES) {
      console.log(`[Air Intra] Fetching syp page ${sypPage}...`)
      try {
        const sypRes = await fetch(`${baseUrl}/?q=${sypEndpoint}&page=${sypPage}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })

        if (!sypRes.ok) {
          const errText = await sypRes.text().catch(() => '')
          // Rate limit: stop the syp sync gracefully
          if (errText.includes('Too many queries') || errText.includes('error_id":403')) {
            console.log('[Air Intra] Rate limited during syp sync. Stopping supplementary pass.')
            break
          }
          console.log(`[Air Intra] syp HTTP ${sypRes.status}. Stopping supplementary pass.`)
          break
        }

        const { data: sypData, error: sypError } = await safeParseAirIntraResponse(sypRes)

        if (sypError || !Array.isArray(sypData) || sypData.length === 0) {
          console.log(`[Air Intra] syp page ${sypPage} returned 0 products or error. End of syp data.`)
          break
        }

        const sypDbOps: (() => Promise<void>)[] = []

        for (const product of sypData) {
          try {
            const providerSku = product.codigo || product.codiart || ''
            if (!providerSku) continue

            // Skip if already fetched from articulos
            if (allFetchedSkus.has(providerSku)) continue

            const price = parseFloat(product.precio || '0')
            const productName = product.descrip || product.descripcion || product.titulo || ''
            if (!productName) continue

            const costPrice = price
            const sellingPrice = costPrice > 0 ? costPrice * (1 + sypMarkup / 100) : 0
            // Stock por depósito - stock total de todos los depósitos
            const stockByWarehouse = {
              air: product.air?.disponible || 0,
              lug: product.lug?.disponible || 0,
              ros: product.ros?.disponible || 0,
              cba: product.cba?.disponible || 0,
              mza: product.mza?.disponible || 0,
            }
            const totalStock = Object.values(stockByWarehouse).reduce((a: number, b: number) => a + b, 0)
            const stockByWarehouseJson = JSON.stringify(stockByWarehouse)

            // syp has no rubro/grupo — use keyword-only category mapping
            const { categoryId } = mapProductToCategory(
              productName, '', supplierMappings, slugToId, idToParentId, parentSlugToChildSlugs
            )

            let isActive = price > 0 ? 1 : 0
            if (isActive === 1 && supplier.allowedCategories) {
              const supplierAllowedCategories: string[] | null = typeof supplier.allowedCategories === 'string'
                ? JSON.parse(supplier.allowedCategories) : supplier.allowedCategories
              if (supplierAllowedCategories !== null && categoryId) {
                const catSlug = Object.entries(slugToId).find(([_, id]) => id === categoryId)?.[0]
                const catParentId = idToParentId[categoryId]
                const catParentSlug = catParentId ? Object.entries(slugToId).find(([_, id]) => id === catParentId)?.[0] : null
                const isAllowedCategory = catSlug ? supplierAllowedCategories.includes(catSlug) : false
                const isChildOfAllowedCategory = catParentSlug ? supplierAllowedCategories.includes(catParentSlug) : false
                if (!isAllowedCategory && !isChildOfAllowedCategory) {
                  isActive = 0
                }
              }
            }

            const existingProduct = existingBySku[providerSku]
            const now = new Date().toISOString()

            if (existingProduct) {
              // Update stock/price for product already in DB
              sypDbOps.push(() =>
                db.execute({
                  sql: `UPDATE products SET costPrice = ?, price = ?, stock = ?, stockByWarehouse = ?, isActive = ?, updatedAt = ? WHERE id = ?`,
                  args: [costPrice, sellingPrice, totalStock, stockByWarehouseJson, isActive, now, existingProduct.id],
                }).then(() => { sypUpdated++ }).catch((err) => { console.error('Error updating syp product:', err); errors++ })
              )
            } else {
              // Insert new product from syp
              const newId = crypto.randomUUID()
              const formattedName = formatProductName(productName)
              let slug = generateSlug(formattedName)
              if (allExistingSlugs.has(slug)) {
                slug = slug + '-' + providerSku.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10)
              }
              allExistingSlugs.add(slug)

              const specs: Record<string, string> = {}
              if (product.moneda) specs['Moneda'] = product.moneda

              sypDbOps.push(() =>
                db.execute({
                  sql: `INSERT INTO products (id, name, slug, description, price, costPrice, sku, stock, stockByWarehouse, isActive, isFeatured, images, specs, providerId, providerSku, categoryId, supplierCategory)
                        VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?)`,
                  args: [newId, formattedName, slug, sellingPrice, costPrice, providerSku, totalStock, stockByWarehouseJson, isActive, 0, JSON.stringify(specs), supplier.id, providerSku, categoryId, ''],
                }).then(() => {
                  sypCreated++
                  created++
                  existingBySku[providerSku] = { id: newId, slug }
                  console.log(`[Air Intra] syp: added "${formattedName}" (SKU: ${providerSku})`)
                }).catch((err) => { console.error('Error inserting syp product:', err); errors++ })
              )
            }

            allFetchedSkus.add(providerSku)
            totalFetched++
          } catch (err) {
            console.error('[Air Intra] Error processing syp product:', err)
            errors++
          }
        }

        // Execute syp DB operations (lazy evaluation to limit concurrency)
        for (let i = 0; i < sypDbOps.length; i += 20) {
          const batch = sypDbOps.slice(i, i + 20)
          await Promise.all(batch.map(fn => fn()))
        }

        console.log(`[Air Intra] syp page ${sypPage}: ${sypData.length} items processed`)

        // If less than 500, this was the last page
        if (sypData.length < 500) {
          console.log('[Air Intra] syp: last page reached.')
          break
        }

        sypPage++
      } catch (sypErr: any) {
        console.error(`[Air Intra] syp fetch error on page ${sypPage}:`, sypErr.message)
        break // Stop syp sync on error
      }
    }

    if (sypCreated > 0 || sypUpdated > 0) {
      console.log(`[Air Intra] syp supplementary sync: ${sypCreated} new + ${sypUpdated} updated`)
    } else {
      console.log('[Air Intra] syp supplementary sync: no new products found')
    }

    // ==========================================
    // POST-SYNC RECATEGORIZATION: Fix products with NULL categoryId.
    // Many products get NULL category because their name doesn't match any keyword
    // and there's no supplier category mapping. We try to fix this by:
    // 1. Using the supplier category mapping (if available)
    // 2. Re-running keyword matching with a broader set of patterns
    // ==========================================
    try {
      const nullCatResult = await db.execute({
        sql: 'SELECT id, name, supplierCategory, providerSku FROM products WHERE providerId = ? AND categoryId IS NULL',
        args: [supplier.id],
      })
      const nullCatProducts = nullCatResult.rows as any[]
      if (nullCatProducts.length > 0) {
        console.log(`[Air Intra] Attempting to recategorize ${nullCatProducts.length} products with NULL category...`)
        let recategorized = 0
        for (const product of nullCatProducts) {
          const { categoryId: newCatId } = mapProductToCategory(
            product.name, product.supplierCategory, supplierMappings, slugToId, idToParentId, parentSlugToChildSlugs
          )
          if (newCatId) {
            await db.execute({
              sql: 'UPDATE products SET categoryId = ?, updatedAt = ? WHERE id = ?',
              args: [newCatId, new Date().toISOString(), product.id],
            })
            recategorized++
          }
        }
        console.log(`[Air Intra] Recategorized ${recategorized} of ${nullCatProducts.length} NULL-category products`)
      }
    } catch (recatErr) {
      console.error('[Air Intra] Recategorization error:', recatErr)
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

    // ==========================================
    // POST-SYNC RECOVERY: Search for products that may have been lost due to
    // JSON corruption. We use TWO strategies:
    // 1. `texto` search for known brand names (PC AIR, PC CX, etc.)
    // 2. `codiart` search for specific SKUs reported as missing
    // Both use query parameters (not body) per Air Intra API docs.
    // Rate limit handling: wait 5 min if rate-limited, then retry once.
    // ==========================================
    const recoveryMarkup = supplier.markup || 30

    // Helper: process a single recovery product
    const processRecoveryProduct = async (product: any): Promise<{ action: 'created' | 'updated' | 'skipped' }> => {
      const providerSku = product.codigo || product.codiart || ''
      if (!providerSku || allFetchedSkus.has(providerSku)) return { action: 'skipped' }

      const price = parseFloat(product.precio || '0')
      const productName = product.descrip || product.descripcion || product.titulo || ''
      if (!productName || !providerSku) return { action: 'skipped' }

      const supplierCategory = getAirIntraSupplierCategory(product)
      const costPrice = price
      const sellingPrice = costPrice > 0 ? costPrice * (1 + recoveryMarkup / 100) : 0
      // Stock por depósito - stock total de todos los depósitos
      const stockByWarehouse = {
        air: product.air?.disponible || 0,
        lug: product.lug?.disponible || 0,
        ros: product.ros?.disponible || 0,
        cba: product.cba?.disponible || 0,
        mza: product.mza?.disponible || 0,
      }
      const totalStock = Object.values(stockByWarehouse).reduce((a: number, b: number) => a + b, 0)
      const stockByWarehouseJson = JSON.stringify(stockByWarehouse)

      const { categoryId } = mapProductToCategory(
        productName, supplierCategory, supplierMappings, slugToId, idToParentId, parentSlugToChildSlugs
      )

      let isActive = price > 0 ? 1 : 0
      if (isActive === 1 && supplier.allowedCategories) {
        const supplierAllowedCategories: string[] | null = typeof supplier.allowedCategories === 'string'
          ? JSON.parse(supplier.allowedCategories) : supplier.allowedCategories
        if (supplierAllowedCategories !== null && categoryId) {
          const catSlug = Object.entries(slugToId).find(([_, id]) => id === categoryId)?.[0]
          const catParentId = idToParentId[categoryId]
          const catParentSlug = catParentId ? Object.entries(slugToId).find(([_, id]) => id === catParentId)?.[0] : null
          const isAllowed = catSlug ? supplierAllowedCategories.includes(catSlug) : false
          const isChildOfAllowed = catParentSlug ? supplierAllowedCategories.includes(catParentSlug) : false
          if (!isAllowed && !isChildOfAllowed) isActive = 0
        }
      }

      const existingProduct = existingBySku[providerSku]
      const now = new Date().toISOString()

      if (existingProduct) {
        await db.execute({
          sql: `UPDATE products SET costPrice = ?, price = ?, stock = ?, stockByWarehouse = ?, supplierCategory = ?, categoryId = ?, isActive = ?, updatedAt = ? WHERE id = ?`,
          args: [costPrice, sellingPrice, totalStock, stockByWarehouseJson, supplierCategory, categoryId, isActive, now, existingProduct.id],
        })
        return { action: 'updated' }
      } else {
        const newId = crypto.randomUUID()
        const formattedName = formatProductName(productName)
        let slug = generateSlug(formattedName)
        if (allExistingSlugs.has(slug)) {
          slug = slug + '-' + providerSku.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10)
        }
        allExistingSlugs.add(slug)

        const specs: Record<string, string> = {}
        if (product.garantia) specs['Garantía'] = product.garantia
        if (product.moneda) specs['Moneda'] = product.moneda
        if (product.marca) specs['Marca'] = product.marca
        if (product.rubro) specs['Rubro'] = product.rubro
        if (product.grupo) specs['Grupo'] = product.grupo
        if (product.tipo?.name) specs['Tipo'] = product.tipo.name
        if (product.estado?.name) specs['Estado'] = product.estado.name

        await db.execute({
          sql: `INSERT INTO products (id, name, slug, description, price, costPrice, sku, stock, stockByWarehouse, isActive, isFeatured, images, specs, providerId, providerSku, categoryId, supplierCategory)
                VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?)`,
          args: [newId, formattedName, slug, sellingPrice, costPrice, providerSku, totalStock, stockByWarehouseJson, isActive, 0, JSON.stringify(specs), supplier.id, providerSku, categoryId, supplierCategory],
        })
        existingBySku[providerSku] = { id: newId, slug }
        console.log(`[Air Intra] Recovery: added "${formattedName}" (SKU: ${providerSku})`)
        return { action: 'created' }
      }
    }

    // Helper: fetch recovery results with rate limit handling
    // IMPORTANT: Air Intra API search parameters (texto, codiart) MUST be in the POST body, NOT query params.
    // Query params are ignored by the API for search filtering.
    const fetchRecoveryResults = async (searchParams: Record<string, string>, description: string): Promise<any[] | null> => {
      const searchUrl = `${baseUrl}/?q=${endpoint}&page=0`
      
      try {
        console.log(`[Air Intra] Recovery search: ${description}`)
        let recoveryRes = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(searchParams),
        })

        // Handle rate limit: wait 5 minutes and retry ONCE
        if (recoveryRes.status === 403) {
          const errText = await recoveryRes.text().catch(() => '')
          if (errText.includes('Too many queries')) {
            console.log(`[Air Intra] Recovery "${description}" rate-limited. Waiting 5 minutes before retry...`)
            await new Promise(r => setTimeout(r, 5 * 60 * 1000))
            
            // Re-login after waiting (token may have expired)
            console.log('[Air Intra] Re-logging in after rate limit wait...')
            const reAuthRes = await fetch(`${baseUrl}/?q=login&user=${encodeURIComponent(supplier.apiUsername)}&pass=${encodeURIComponent(supplier.apiPassword)}`)
            if (reAuthRes.ok) {
              const { data: reAuthData, error: reAuthError } = await safeParseAirIntraResponse(reAuthRes)
              if (!reAuthError && reAuthData?.token) {
                const newToken = reAuthData.token
                recoveryRes = await fetch(searchUrl, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${newToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(searchParams),
                })
              } else {
                console.log(`[Air Intra] Re-login failed: ${reAuthError}. Skipping recovery "${description}".`)
                return null
              }
            } else {
              console.log(`[Air Intra] Re-login HTTP ${reAuthRes.status}. Skipping recovery "${description}".`)
              return null
            }
          }
        }

        if (!recoveryRes.ok) {
          console.log(`[Air Intra] Recovery "${description}" HTTP ${recoveryRes.status}. Skipping.`)
          return null
        }

        const { data: recoveryData, error: recoveryError } = await safeParseAirIntraResponse(recoveryRes)
        if (recoveryError) {
          console.log(`[Air Intra] Recovery "${description}" parse error: ${recoveryError}`)
          return null
        }
        if (!Array.isArray(recoveryData) || recoveryData.length === 0) {
          console.log(`[Air Intra] Recovery "${description}": 0 results`)
          return null
        }
        console.log(`[Air Intra] Recovery "${description}": found ${recoveryData.length} products`)
        return recoveryData
      } catch (recoveryErr) {
        console.error(`[Air Intra] Recovery search error for "${description}":`, recoveryErr)
        return null
      }
    }

    let recoveryCreated = 0
    let recoveryUpdated = 0

    // Strategy 1: Text search for known brand names
    const RECOVERY_TEXT_SEARCHES = ['PC AIR', 'PC CX', 'PC ARKHAM', 'PC GAMEMAX']
    for (const searchTerm of RECOVERY_TEXT_SEARCHES) {
      const products = await fetchRecoveryResults({ texto: searchTerm }, `texto="${searchTerm}"`)
      if (products) {
        for (const product of products) {
          const result = await processRecoveryProduct(product)
          if (result.action === 'created') { recoveryCreated++; created++ }
          else if (result.action === 'updated') { recoveryUpdated++; updated++ }
          const providerSku = product.codigo || product.codiart || ''
          if (providerSku) { allFetchedSkus.add(providerSku); totalFetched++ }
        }
      }
      // Wait 2 seconds between recovery searches to avoid rate limiting
      if (RECOVERY_TEXT_SEARCHES.indexOf(searchTerm) < RECOVERY_TEXT_SEARCHES.length - 1) {
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    // Strategy 2: Search by specific SKUs (codiart) for known missing products
    // These are SKUs that exist in Air Intra's catalog but were not imported
    // due to corrupted JSON pages or other issues.
    const MISSING_SKUS: string[] = [] // Will be populated dynamically
    
    // Detect missing SKUs by checking gaps in the API's SKU sequence
    // Products with SKUs near known products but missing from DB are likely lost
    try {
      const dbSkuResult = await db.execute({
        sql: 'SELECT providerSku FROM products WHERE providerId = ? AND providerSku IS NOT NULL ORDER BY CAST(providerSku AS INTEGER)',
        args: [supplier.id],
      })
      const dbSkuSet = new Set((dbSkuResult.rows as any[]).map(r => r.providerSku))
      
      // For each SKU we fetched from the API, check if nearby SKUs exist in the DB
      // If a gap is found (e.g., 52739 exists but 52751 doesn't and we fetched it from API),
      // we should try to search for it
      const fetchedSkuNums = Array.from(allFetchedSkus)
        .map(s => parseInt(s, 10))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b)
      
      // Find gaps: where a fetched SKU has nearby missing SKUs
      // Look for gaps of 1-50 between consecutive DB SKUs that we fetched from the API
      for (let i = 0; i < fetchedSkuNums.length - 1; i++) {
        const current = fetchedSkuNums[i]
        const next = fetchedSkuNums[i + 1]
        // If the gap is small (1-50) and we have products on both sides in the API
        // but some in between are missing from the DB, they might be lost
        if (next - current > 1 && next - current <= 50) {
          for (let sku = current + 1; sku < next; sku++) {
            const skuStr = String(sku)
            if (!dbSkuSet.has(skuStr) && allFetchedSkus.has(skuStr)) {
              // We fetched this SKU from API but it's not in DB - this is a processing error
              console.log(`[Air Intra] Detected fetched-but-not-in-DB SKU: ${skuStr}`)
              MISSING_SKUS.push(skuStr)
            }
          }
        }
      }
      
      // Also add any SKUs that were in the fetched set but somehow not processed
      for (const sku of Array.from(allFetchedSkus)) {
        if (!dbSkuSet.has(sku) && !isNaN(parseInt(sku, 10))) {
          // This SKU was fetched from the API but isn't in the DB
          // This could be a processing error during the main sync
          if (!MISSING_SKUS.includes(sku)) {
            MISSING_SKUS.push(sku)
          }
        }
      }
    } catch (gapErr) {
      console.error('[Air Intra] Error detecting missing SKUs:', gapErr)
    }
    
    if (MISSING_SKUS.length > 0) {
      console.log(`[Air Intra] Found ${MISSING_SKUS.length} potentially missing SKUs to recover: ${MISSING_SKUS.slice(0, 20).join(', ')}${MISSING_SKUS.length > 20 ? '...' : ''}`)
      // Search for each missing SKU using codiart parameter (max 20 to avoid excessive API calls)
      const skusToSearch = MISSING_SKUS.slice(0, 20)
      for (const sku of skusToSearch) {
        const products = await fetchRecoveryResults({ codiart: sku }, `codiart=${sku}`)
        if (products) {
          for (const product of products) {
            const result = await processRecoveryProduct(product)
            if (result.action === 'created') { recoveryCreated++; created++ }
            else if (result.action === 'updated') { recoveryUpdated++; updated++ }
            const providerSku = product.codigo || product.codiart || ''
            if (providerSku) { allFetchedSkus.add(providerSku); totalFetched++ }
          }
        }
        // Wait 3 seconds between codiart searches to avoid rate limiting
        if (skusToSearch.indexOf(sku) < skusToSearch.length - 1) {
          await new Promise(r => setTimeout(r, 3000))
        }
      }
    }

    if (recoveryCreated > 0 || recoveryUpdated > 0) {
      console.log(`[Air Intra] Recovery total: ${recoveryCreated} new + ${recoveryUpdated} updated via targeted search`)
    }

    result.ok = true
    result.total = totalFetched
    result.created = created
    result.updated = updated
    result.skipped = skipped
    result.errors = errors

    // Include recovery info in the message if products were recovered
    const recoveryNote = usedExtractionFallback
      ? ` (usando extracción de objetos por JSON corrupto, ${totalRecoveredByExtractor} recuperados)`
      : totalRecoveredByExtractor > 0
        ? ` (${totalRecoveredByExtractor} productos recuperados por extractor)`
        : ''
    const recoverySearchNote = recoveryCreated > 0 || recoveryUpdated > 0 ? ` + ${recoveryCreated} recuperados por búsqueda dirigida (${recoveryUpdated} actualizados)` : ''
    const sypNote = sypCreated > 0 || sypUpdated > 0 ? ` + ${sypCreated} nuevos del catálogo syp (${sypUpdated} actualizados)` : ''
    result.message = `Sincronización completada: ${totalFetched} productos, ${created} nuevos, ${updated} actualizados, ${skipped} omitidos, ${errors} errores${recoveryNote}${recoverySearchNote}${sypNote}`

  } catch (error: any) {
    result.message = `Error de conexión con Air Intra: ${error.message}`
  }

  return result
}

// ============================================
// Air Intra sync state (cooldown + resume)
// ============================================
// Stored in the store_config table so it survives across Vercel cold starts.
// Two keys:
//   - airintra_rate_limited_until : ISO timestamp; if in the future, sync refuses to start
//   - airintra_last_sync_page     : last successfully processed 0-indexed page; resume from page+1
//
// Lifecycle:
//   * Severe rate limit detected (page 0 of a batch returns only PHP notices / empty array)
//       → set airintra_rate_limited_until = now + 10 min
//   * Each page processed successfully → update airintra_last_sync_page
//   * Finalize step completes successfully → clear both keys (clean slate for next cycle)
//   * Finalize step fails              → keep airintra_last_sync_page (resume on retry)

const AIRINTRA_COOLDOWN_KEY = 'airintra_rate_limited_until'
const AIRINTRA_LAST_PAGE_KEY = 'airintra_last_sync_page'
const AIRINTRA_COOLDOWN_MS = 10 * 60 * 1000 // 10 minutes

async function getAirIntraCooldown(): Promise<number> {
  // Returns ms remaining in cooldown, or 0 if expired/not set.
  try {
    const r = await db.execute({ sql: `SELECT value FROM store_config WHERE key = ?`, args: [AIRINTRA_COOLDOWN_KEY] })
    const v = (r.rows as any[])[0]?.value
    if (!v) return 0
    const until = new Date(v).getTime()
    const remaining = until - Date.now()
    return remaining > 0 ? remaining : 0
  } catch {
    return 0
  }
}

async function setAirIntraCooldown(msFromNow: number = AIRINTRA_COOLDOWN_MS): Promise<void> {
  try {
    const until = new Date(Date.now() + msFromNow).toISOString()
    await db.execute({
      sql: `INSERT INTO store_config (id, key, value, updatedAt) VALUES (?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
      args: [`cfg_${AIRINTRA_COOLDOWN_KEY}`, AIRINTRA_COOLDOWN_KEY, until, new Date().toISOString()],
    })
    console.log(`[Air Intra] Cooldown set until ${until}`)
  } catch (e) {
    console.error('[Air Intra] Failed to set cooldown:', e)
  }
}

async function clearAirIntraCooldown(): Promise<void> {
  try {
    await db.execute({ sql: `DELETE FROM store_config WHERE key = ?`, args: [AIRINTRA_COOLDOWN_KEY] })
  } catch {
    /* ignore */
  }
}

async function getAirIntraLastSyncPage(): Promise<number> {
  try {
    const r = await db.execute({ sql: `SELECT value FROM store_config WHERE key = ?`, args: [AIRINTRA_LAST_PAGE_KEY] })
    const v = (r.rows as any[])[0]?.value
    const n = v ? parseInt(v, 10) : -1
    return Number.isFinite(n) ? n : -1
  } catch {
    return -1
  }
}

async function setAirIntraLastSyncPage(page: number): Promise<void> {
  try {
    await db.execute({
      sql: `INSERT INTO store_config (id, key, value, updatedAt) VALUES (?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
      args: [`cfg_${AIRINTRA_LAST_PAGE_KEY}`, AIRINTRA_LAST_PAGE_KEY, String(page), new Date().toISOString()],
    })
  } catch (e) {
    console.error('[Air Intra] Failed to persist last sync page:', e)
  }
}

async function clearAirIntraLastSyncPage(): Promise<void> {
  try {
    await db.execute({ sql: `DELETE FROM store_config WHERE key = ?`, args: [AIRINTRA_LAST_PAGE_KEY] })
  } catch {
    /* ignore */
  }
}

/**
 * Batched Air Intra sync: processes a range of pages from the 'articulos' endpoint.
 * Each batch processes PAGES_PER_BATCH pages (1 page × 500 products = ~500).
 * This keeps each request well within Vercel Hobby's 60s timeout (~10-15s per batch).
 *
 * When no token is provided, performs login first.
 * Returns partial results with hasMore/token so the frontend can continue.
 *
 * COOLDOWN + RESUME:
 *   - If a previous batch hit a severe rate limit, getAirIntraCooldown() > 0 and the
 *     POST handler refuses the call before we get here.
 *   - On the initial call (no token), we resume from airintra_last_sync_page + 1 if set,
 *     so retries don't waste Vercel budget re-syncing pages 0..N-1 that are already in DB.
 */
async function syncAirIntraBatch(supplier: any, batch: AirIntraBatchParams): Promise<SyncResult> {
  const baseUrl = supplier.apiBaseUrl || 'https://api.air-intra.com/v2'
  const result: SyncResult = { ok: false, total: 0, created: 0, updated: 0, skipped: 0, errors: 0, message: '' }
  const t0 = Date.now()
  const logTime = (label: string) => console.log(`[Air Intra Batch ⏱] ${label}: ${Date.now() - t0}ms`)

  try {
    // ─── Cooldown check ────────────────────────────────────────────────────
    // If a previous batch hit a severe rate limit, refuse ALL new sync attempts
    // (initial or continuation) until the cooldown expires. The frontend shows
    // a dedicated countdown UI when it sees the "RATE_LIMITED_COOLDOWN" marker.
    const cooldownMs = await getAirIntraCooldown()
    if (cooldownMs > 0) {
      const waitSeconds = Math.ceil(cooldownMs / 1000)
      const waitMinutes = Math.ceil(waitSeconds / 60)
      result.message = `RATE_LIMITED_COOLDOWN: Air Intra está enfriando tras un rate limit severo. Espere ~${waitMinutes} minuto(s) (${waitSeconds}s) e intente de nuevo.`
      console.log(`[Air Intra Batch] Refused: cooldown active for ${waitSeconds}s more.`)
      return result
    }

    // ─── Resume from last successful page ──────────────────────────────────
    // On the initial call (no token), if a previous sync was interrupted mid-way
    // (e.g. by a rate limit), resume from the page after the last one we wrote
    // to DB. This avoids re-fetching pages 0..N-1 that are already up to date.
    if (!batch.token && batch.startPage === 0) {
      const lastPage = await getAirIntraLastSyncPage()
      if (lastPage >= 0) {
        const resumeFrom = lastPage + 1
        console.log(`[Air Intra Batch] Resuming from page ${resumeFrom} (last successful page was ${lastPage}).`)
        batch = { ...batch, startPage: resumeFrom, endPage: resumeFrom + (batch.endPage - batch.startPage) }
      }
    }

    // ─── Legacy 5-min rate limit on a fully-completed cycle ────────────────
    // Only relevant on the initial call AND when we have no resume state.
    // (If we are resuming, the cooldown check above already gated us.)
    if (batch.startPage === 0 && !batch.token && supplier.lastSyncAt) {
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
    logTime('category lookups built')

    // Pre-load existing products for this supplier (fresh for each batch)
    console.log(`[Air Intra Batch] Pre-loading existing products from DB...`)
    const existingProductsResult = await db.execute({
      sql: 'SELECT id, providerSku, slug FROM products WHERE providerId = ?',
      args: [supplier.id],
    })
    const existingBySku: Record<string, { id: string; slug: string }> = {}
    const allExistingSlugs = new Set<string>()
    const allFetchedSkus = new Set<string>() // seeded from existing products for cross-batch dedup
    for (const row of existingProductsResult.rows as any[]) {
      if (row.providerSku) {
        existingBySku[row.providerSku] = { id: row.id, slug: row.slug }
        allFetchedSkus.add(row.providerSku)
      }
      if (row.slug) allExistingSlugs.add(row.slug)
    }
    console.log(`[Air Intra Batch] Loaded ${Object.keys(existingBySku).length} existing products`)
    logTime('existing products loaded')

    // Login if no token provided
    let token = batch.token || ''
    let exchangeRate = batch.exchangeRate || 0

    if (!token) {
      console.log('[Air Intra Batch] Logging in...')
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

      token = authData.token
      exchangeRate = parseFloat(authData.cotiza || '0')
      console.log(`[Air Intra Batch] Login OK. Cotización: ${exchangeRate}`)
      logTime('login')
    }

    // Fetch products page by page within the specified range
    const endpoint = 'articulos'
    const pageSize = 500
    let totalFetched = 0
    let created = 0
    let updated = 0
    let skipped = 0
    let errors = 0
    let usedExtractionFallback = false
    let totalRecoveredByExtractor = 0

    let reachedEnd = false
    let lastProcessedPage = batch.startPage - 1

    for (let page = batch.startPage; page <= batch.endPage; page++) {
      console.log(`[Air Intra Batch] Fetching page ${page}...`)
      const pageT0 = Date.now()
      let products: any[] | null = null
      let pageSucceeded = false
      let retryCount = 0
      const MAX_RETRIES = 2

      // Retry loop
      while (!pageSucceeded && retryCount <= MAX_RETRIES) {
        try {
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

            // Check for rate limit error
            if (errText.includes('Too many queries') || errText.includes('error_id":403')) {
              console.log(`[Air Intra Batch] Rate limited on page ${page}. Stopping batch.`)
              // Set a short cooldown (5 min) — the API explicitly told us to back off.
              await setAirIntraCooldown(5 * 60 * 1000)
              result.message = `RATE_LIMITED_COOLDOWN: Rate limit de Air Intra alcanzado en página ${page}. Se procesaron ${totalFetched} productos en este lote. Cooldown de 5 minutos activado.`
              result.ok = totalFetched > 0
              result.total = totalFetched
              result.created = created
              result.updated = updated
              result.skipped = skipped
              result.errors = errors
              result.hasMore = true
              result.nextPage = page
              result.token = token
              result.exchangeRate = exchangeRate
              return result
            }

            if (retryCount < MAX_RETRIES) {
              console.log(`[Air Intra Batch] HTTP ${productsRes.status} on page ${page}, retrying (${retryCount + 1}/${MAX_RETRIES})...`)
              retryCount++
              await new Promise(r => setTimeout(r, 2000))
              continue
            }

            result.message = `Error HTTP ${productsRes.status} al obtener productos de Air Intra (página ${page}). ${errText.substring(0, 200)}`
            result.total = totalFetched
            result.created = created
            result.updated = updated
            result.skipped = skipped
            result.errors = errors + 1
            result.hasMore = true
            result.nextPage = page
            result.token = token
            result.exchangeRate = exchangeRate
            return result
          }

          // Get raw text first
          const rawResponseText = await productsRes.text()
          const { data: parsedProducts, error: parseError } = await (async () => {
            const fakeRes = new Response(rawResponseText, {
              headers: productsRes.headers,
              status: productsRes.status,
            })
            return safeParseAirIntraResponse(fakeRes)
          })()

          if (parseError) {
            console.log(`[Air Intra Batch] Standard parse failed on page ${page}: ${parseError}. Trying object extraction...`)

            if (rawResponseText) {
              const cleanedText = stripPhpNotices(rawResponseText)
              products = extractProductsFromCorruptedJson(cleanedText)
              usedExtractionFallback = true
              console.log(`[Air Intra Batch] Extracted ${products.length} products from corrupted page ${page}`)
            }

            if (!products || products.length === 0) {
              if (page === batch.startPage && !batch.token) {
                result.message = `No se pudieron obtener productos de Air Intra: ${parseError}`
                result.errors = errors + 1
                result.total = totalFetched
                result.created = created
                result.updated = updated
                result.skipped = skipped
                return result
              }
              console.log(`[Air Intra Batch] Page ${page} returned 0 products. Treating as end of data.`)
              pageSucceeded = true
              reachedEnd = true
              break
            }
            pageSucceeded = true
          } else {
            if (!Array.isArray(parsedProducts) || parsedProducts.length === 0) {
              // Log BOTH raw and cleaned response for diagnostics
              const rawPreview = rawResponseText ? rawResponseText.substring(0, 500) : '(empty body)'
              const cleanedText = rawResponseText ? stripPhpNotices(rawResponseText) : ''
              const cleanedPreview = cleanedText.substring(0, 500)
              console.log(`[Air Intra Batch] Page ${page} returned 0 products.`)
              console.log(`[Air Intra Batch]   Raw response (${rawResponseText?.length || 0} bytes): ${rawPreview}`)
              console.log(`[Air Intra Batch]   Cleaned response (${cleanedText.length} bytes): ${cleanedPreview}`)

              // If page 0 returns 0 products, this is almost certainly a rate limit or auth issue
              // (Air Intra has ~10k products, so page 0 should never be empty).
              if (page === batch.startPage) {
                result.ok = false
                // Check if the cleaned response is just an empty array or very small
                if (cleanedText.trim() === '[]' || cleanedText.length < 10) {
                  // ─── Set cooldown so the next sync attempt is refused for 10 minutes ───
                  // This prevents the user from clicking "Sync" again immediately and
                  // burning another Vercel function call on a doomed request.
                  await setAirIntraCooldown(AIRINTRA_COOLDOWN_MS)
                  result.message = `RATE_LIMITED_COOLDOWN: Air Intra devolvió una respuesta vacía (notices PHP + array vacío, ${rawResponseText?.length || 0} bytes raw). Esto indica rate limit severo. Se activó un cooldown de 10 minutos — intente de nuevo después.`
                } else {
                  // Non-empty but 0 products — less severe, set a shorter 5-min cooldown
                  await setAirIntraCooldown(5 * 60 * 1000)
                  result.message = `RATE_LIMITED_COOLDOWN: Air Intra devolvió 0 productos en la página ${page}. Respuesta limpia: ${cleanedPreview}. Probablemente rate limit o token expirado. Se activó un cooldown de 5 minutos.`
                }
                result.total = totalFetched
                result.created = created
                result.updated = updated
                result.skipped = skipped
                result.errors = errors + 1
                return result
              }
              console.log(`[Air Intra Batch] Page ${page} returned empty array. End of data.`)
              pageSucceeded = true
              reachedEnd = true
              break
            }
            products = parsedProducts

            // Robustness verification: always run extractor as verification
            if (rawResponseText) {
              const cleanedText = stripPhpNotices(rawResponseText)
              const extractedProducts = extractProductsFromCorruptedJson(cleanedText)

              if (extractedProducts.length > products.length) {
                const parsedSkus = new Set(
                  products.map((p: any) => p.codigo || p.codiart || '').filter(Boolean)
                )

                let recoveredCount = 0
                for (const extracted of extractedProducts) {
                  const sku = extracted.codigo || extracted.codiart || ''
                  if (sku && !parsedSkus.has(sku)) {
                    products.push(extracted)
                    recoveredCount++
                  }
                }

                if (recoveredCount > 0) {
                  totalRecoveredByExtractor += recoveredCount
                  console.log(`[Air Intra Batch] ⚡ Recovery on page ${page}: ${recoveredCount} additional products recovered. Total: ${products.length}`)
                }
              }
            }
            pageSucceeded = true
          }
        } catch (fetchErr: any) {
          if (retryCount < MAX_RETRIES) {
            console.log(`[Air Intra Batch] Fetch error on page ${page}: ${fetchErr.message}. Retrying (${retryCount + 1}/${MAX_RETRIES})...`)
            retryCount++
            await new Promise(r => setTimeout(r, 2000))
            continue
          }
          console.error(`[Air Intra Batch] Fetch error on page ${page} after ${MAX_RETRIES} retries:`, fetchErr)
          errors++
          pageSucceeded = true
          break
        }
      } // end retry loop

      // If we got no products after retries, treat as end of data
      if (!products || products.length === 0) {
        reachedEnd = true
        break
      }

      lastProcessedPage = page

      // Process products on this page
      const dbOperations: (() => Promise<void>)[] = []

      for (const product of products) {
        try {
          const providerSku = product.codigo || product.codiart || ''

          // Skip duplicate products across pages
          if (providerSku && allFetchedSkus.has(providerSku)) {
            skipped++
            continue
          }
          if (providerSku) allFetchedSkus.add(providerSku)

          totalFetched++

          const price = parseFloat(product.precio || '0')
          const productName = product.descrip || product.descripcion || product.titulo || ''
          const supplierCategory = getAirIntraSupplierCategory(product)
          const costPrice = price
          const markup = supplier.markup || 30
          const sellingPrice = costPrice > 0 ? costPrice * (1 + markup / 100) : 0
          // Stock por depósito - stock total de todos los depósitos
          const stockByWarehouse = {
            air: product.air?.disponible || 0,
            lug: product.lug?.disponible || 0,
            ros: product.ros?.disponible || 0,
            cba: product.cba?.disponible || 0,
            mza: product.mza?.disponible || 0,
          }
          const totalStock = Object.values(stockByWarehouse).reduce((a: number, b: number) => a + b, 0)
          const stockByWarehouseJson = JSON.stringify(stockByWarehouse)

          const { categoryId } = mapProductToCategory(
            productName, supplierCategory, supplierMappings, slugToId, idToParentId, parentSlugToChildSlugs
          )

          // Air Intra isActive logic
          let airIntraIsActive = price > 0 ? 1 : 0

          if (airIntraIsActive === 1 && supplier.allowedCategories) {
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

          const existingProduct = existingBySku[providerSku]
          const now = new Date().toISOString()

          if (existingProduct) {
            // UPDATE existing product
            dbOperations.push(() =>
              db.execute({
                sql: `UPDATE products SET costPrice = ?, price = ?, stock = ?, stockByWarehouse = ?, supplierCategory = ?, categoryId = ?, isActive = ?, updatedAt = ? WHERE id = ?`,
                args: [costPrice, sellingPrice, totalStock, stockByWarehouseJson, supplierCategory, categoryId, airIntraIsActive, now, existingProduct.id],
              }).then(() => { updated++ }).catch((err) => { console.error('Error updating Air Intra product:', err); errors++ })
            )
          } else if (productName && providerSku) {
            // INSERT new product
            const newId = crypto.randomUUID()
            const formattedName = formatProductName(productName)
            let slug = generateSlug(formattedName)

            // Handle slug collision
            if (allExistingSlugs.has(slug)) {
              slug = slug + '-' + providerSku.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10)
            }
            allExistingSlugs.add(slug)

            const specs: Record<string, string> = {}
            if (product.garantia) specs['Garantía'] = product.garantia
            if (product.moneda) specs['Moneda'] = product.moneda
            if (product.marca) specs['Marca'] = product.marca
            if (product.rubro) specs['Rubro'] = product.rubro
            if (product.grupo) specs['Grupo'] = product.grupo
            if (product.tipo?.name) specs['Tipo'] = product.tipo.name
            if (product.estado?.name) specs['Estado'] = product.estado.name

            dbOperations.push(() =>
              db.execute({
                sql: `INSERT INTO products (id, name, slug, description, price, costPrice, sku, stock, stockByWarehouse, isActive, isFeatured, images, specs, providerId, providerSku, categoryId, supplierCategory)
                      VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?)`,
                args: [newId, formattedName, slug, sellingPrice, costPrice, providerSku, totalStock, stockByWarehouseJson, airIntraIsActive, 0, JSON.stringify(specs), supplier.id, providerSku, categoryId, supplierCategory],
              }).then(() => {
                created++
                existingBySku[providerSku] = { id: newId, slug }
              }).catch((err) => { console.error('Error inserting Air Intra product:', err); errors++ })
            )
          } else {
            skipped++
          }
        } catch (err) {
          console.error('Error processing Air Intra product:', err)
          errors++
        }
      }

      // Execute all DB operations with limited concurrency (lazy evaluation)
      const dbT0 = Date.now()
      const BATCH_CONCURRENCY = 20
      for (let i = 0; i < dbOperations.length; i += BATCH_CONCURRENCY) {
        const batchChunk = dbOperations.slice(i, i + BATCH_CONCURRENCY)
        await Promise.all(batchChunk.map(fn => fn()))
      }
      console.log(`[Air Intra Batch ⏱] Page ${page}: fetch=${Date.now() - pageT0}ms (API), DB writes=${Date.now() - dbT0}ms (${dbOperations.length} ops)`)
      logTime(`after page ${page} DB writes`)

      console.log(`[Air Intra Batch] Page ${page} processed: ${products.length} items (batch total: ${totalFetched})`)

      // Persist progress so a future retry can resume from page+1 instead of
      // re-fetching pages 0..N-1 that are already up-to-date in the DB.
      // Best-effort: failure here does not block the current batch.
      await setAirIntraLastSyncPage(page)

      // If this page returned 0 products, we've reached the end
      if (products.length === 0) {
        reachedEnd = true
        break
      }
    }

    // Determine if there are more pages to fetch
    const hasMore = !reachedEnd

    result.ok = true
    result.total = totalFetched
    result.created = created
    result.updated = updated
    result.skipped = skipped
    result.errors = errors
    result.hasMore = hasMore
    result.nextPage = hasMore ? (lastProcessedPage + 1) : undefined
    result.token = token
    result.exchangeRate = exchangeRate

    const recoveryNote = usedExtractionFallback
      ? ` (JSON corrupto, ${totalRecoveredByExtractor} recuperados por extractor)`
      : totalRecoveredByExtractor > 0
        ? ` (${totalRecoveredByExtractor} recuperados por extractor)`
        : ''
    result.message = hasMore
      ? `Lote procesado: ${totalFetched} productos, ${created} nuevos, ${updated} actualizados${recoveryNote}. Faltan más páginas.`
      : `Último lote procesado: ${totalFetched} productos, ${created} nuevos, ${updated} actualizados${recoveryNote}. Todas las páginas completadas.`

  } catch (error: any) {
    result.message = `Error de conexión con Air Intra: ${error.message}`
  }

  return result
}

/**
 * Finalize step for batched Air Intra sync.
 * Runs after all articulos pages have been processed in batches.
 * Handles: syp supplementary sync, recategorization, recovery, verification, lastSyncAt update.
 */
async function syncAirIntraFinalize(supplier: any, batch: AirIntraBatchParams): Promise<SyncResult> {
  const baseUrl = supplier.apiBaseUrl || 'https://api.air-intra.com/v2'
  const result: SyncResult = { ok: false, total: 0, created: 0, updated: 0, skipped: 0, errors: 0, message: '' }

  try {
    const token = batch.token || ''
    const exchangeRate = batch.exchangeRate || 0

    if (!token) {
      result.message = 'Token de Air Intra no proporcionado para finalización. Se requiere sincronizar desde el inicio.'
      return result
    }

    // Build category lookups
    const { slugToId, idToParentId, parentSlugToChildSlugs } = await buildCategoryLookup()
    const supplierMappings = await buildSupplierMappingLookup(supplier.id)

    // Pre-load existing products for syp/recovery dedup
    console.log('[Air Intra Finalize] Pre-loading existing products from DB...')
    const existingProductsResult = await db.execute({
      sql: 'SELECT id, providerSku, slug FROM products WHERE providerId = ?',
      args: [supplier.id],
    })
    const existingBySku: Record<string, { id: string; slug: string }> = {}
    const allExistingSlugs = new Set<string>()
    const allFetchedSkus = new Set<string>()
    for (const row of existingProductsResult.rows as any[]) {
      if (row.providerSku) {
        existingBySku[row.providerSku] = { id: row.id, slug: row.slug }
        allFetchedSkus.add(row.providerSku)
      }
      if (row.slug) allExistingSlugs.add(row.slug)
    }
    console.log(`[Air Intra Finalize] Loaded ${Object.keys(existingBySku).length} existing products`)

    let totalFetched = 0
    let created = 0
    let updated = 0
    let skipped = 0
    let errors = 0

    // ==========================================
    // SUPPLEMENTARY SYNC: syp endpoint
    // ==========================================
    console.log('[Air Intra Finalize] Starting supplementary syp endpoint sync...')
    const sypMarkup = supplier.markup || 30
    let sypCreated = 0
    let sypUpdated = 0
    let sypPage = 0
    // Reduced from 30 to 10 to avoid Vercel Hobby 60s timeout on the finalize step.
    // Each syp page adds ~1-2s of API fetch + DB writes; 10 pages = ~15-20s max.
    const SYP_MAX_PAGES = 10
    const sypEndpoint = 'syp'

    while (sypPage < SYP_MAX_PAGES) {
      console.log(`[Air Intra Finalize] Fetching syp page ${sypPage}...`)
      try {
        const sypRes = await fetch(`${baseUrl}/?q=${sypEndpoint}&page=${sypPage}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })

        if (!sypRes.ok) {
          const errText = await sypRes.text().catch(() => '')
          if (errText.includes('Too many queries') || errText.includes('error_id":403')) {
            console.log('[Air Intra Finalize] Rate limited during syp sync. Stopping supplementary pass.')
            break
          }
          console.log(`[Air Intra Finalize] syp HTTP ${sypRes.status}. Stopping supplementary pass.`)
          break
        }

        const { data: sypData, error: sypError } = await safeParseAirIntraResponse(sypRes)

        if (sypError || !Array.isArray(sypData) || sypData.length === 0) {
          console.log(`[Air Intra Finalize] syp page ${sypPage} returned 0 products or error. End of syp data.`)
          break
        }

        const sypDbOps: (() => Promise<void>)[] = []

        for (const product of sypData) {
          try {
            const providerSku = product.codigo || product.codiart || ''
            if (!providerSku) continue

            // Skip if already in DB from articulos batches
            if (allFetchedSkus.has(providerSku)) continue

            const price = parseFloat(product.precio || '0')
            const productName = product.descrip || product.descripcion || product.titulo || ''
            if (!productName) continue

            const costPrice = price
            const sellingPrice = costPrice > 0 ? costPrice * (1 + sypMarkup / 100) : 0
            // Stock por depósito - stock total de todos los depósitos
            const stockByWarehouse = {
              air: product.air?.disponible || 0,
              lug: product.lug?.disponible || 0,
              ros: product.ros?.disponible || 0,
              cba: product.cba?.disponible || 0,
              mza: product.mza?.disponible || 0,
            }
            const totalStock = Object.values(stockByWarehouse).reduce((a: number, b: number) => a + b, 0)
            const stockByWarehouseJson = JSON.stringify(stockByWarehouse)

            const { categoryId } = mapProductToCategory(
              productName, '', supplierMappings, slugToId, idToParentId, parentSlugToChildSlugs
            )

            let isActive = price > 0 ? 1 : 0
            if (isActive === 1 && supplier.allowedCategories) {
              const supplierAllowedCategories: string[] | null = typeof supplier.allowedCategories === 'string'
                ? JSON.parse(supplier.allowedCategories) : supplier.allowedCategories
              if (supplierAllowedCategories !== null && categoryId) {
                const catSlug = Object.entries(slugToId).find(([_, id]) => id === categoryId)?.[0]
                const catParentId = idToParentId[categoryId]
                const catParentSlug = catParentId ? Object.entries(slugToId).find(([_, id]) => id === catParentId)?.[0] : null
                const isAllowedCategory = catSlug ? supplierAllowedCategories.includes(catSlug) : false
                const isChildOfAllowedCategory = catParentSlug ? supplierAllowedCategories.includes(catParentSlug) : false
                if (!isAllowedCategory && !isChildOfAllowedCategory) {
                  isActive = 0
                }
              }
            }

            const existingProduct = existingBySku[providerSku]
            const now = new Date().toISOString()

            if (existingProduct) {
              sypDbOps.push(() =>
                db.execute({
                  sql: `UPDATE products SET costPrice = ?, price = ?, stock = ?, stockByWarehouse = ?, isActive = ?, updatedAt = ? WHERE id = ?`,
                  args: [costPrice, sellingPrice, totalStock, stockByWarehouseJson, isActive, now, existingProduct.id],
                }).then(() => { sypUpdated++ }).catch((err) => { console.error('Error updating syp product:', err); errors++ })
              )
            } else {
              const newId = crypto.randomUUID()
              const formattedName = formatProductName(productName)
              let slug = generateSlug(formattedName)
              if (allExistingSlugs.has(slug)) {
                slug = slug + '-' + providerSku.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10)
              }
              allExistingSlugs.add(slug)

              const specs: Record<string, string> = {}
              if (product.moneda) specs['Moneda'] = product.moneda

              sypDbOps.push(() =>
                db.execute({
                  sql: `INSERT INTO products (id, name, slug, description, price, costPrice, sku, stock, stockByWarehouse, isActive, isFeatured, images, specs, providerId, providerSku, categoryId, supplierCategory)
                        VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?)`,
                  args: [newId, formattedName, slug, sellingPrice, costPrice, providerSku, totalStock, stockByWarehouseJson, isActive, 0, JSON.stringify(specs), supplier.id, providerSku, categoryId, ''],
                }).then(() => {
                  sypCreated++
                  created++
                  existingBySku[providerSku] = { id: newId, slug }
                }).catch((err) => { console.error('Error inserting syp product:', err); errors++ })
              )
            }

            allFetchedSkus.add(providerSku)
            totalFetched++
          } catch (err) {
            console.error('[Air Intra Finalize] Error processing syp product:', err)
            errors++
          }
        }

        // Execute syp DB operations (lazy evaluation for limited concurrency)
        for (let i = 0; i < sypDbOps.length; i += 20) {
          const batchChunk = sypDbOps.slice(i, i + 20)
          await Promise.all(batchChunk.map(fn => fn()))
        }

        console.log(`[Air Intra Finalize] syp page ${sypPage}: ${sypData.length} items processed`)

        if (sypData.length < 500) {
          console.log('[Air Intra Finalize] syp: last page reached.')
          break
        }

        sypPage++
      } catch (sypErr: any) {
        console.error(`[Air Intra Finalize] syp fetch error on page ${sypPage}:`, sypErr.message)
        break
      }
    }

    if (sypCreated > 0 || sypUpdated > 0) {
      console.log(`[Air Intra Finalize] syp supplementary sync: ${sypCreated} new + ${sypUpdated} updated`)
    } else {
      console.log('[Air Intra Finalize] syp supplementary sync: no new products found')
    }

    // ==========================================
    // POST-SYNC RECATEGORIZATION: Fix products with NULL categoryId
    // ==========================================
    try {
      const nullCatResult = await db.execute({
        sql: 'SELECT id, name, supplierCategory, providerSku FROM products WHERE providerId = ? AND categoryId IS NULL',
        args: [supplier.id],
      })
      const nullCatProducts = nullCatResult.rows as any[]
      if (nullCatProducts.length > 0) {
        console.log(`[Air Intra Finalize] Attempting to recategorize ${nullCatProducts.length} products with NULL category...`)
        let recategorized = 0
        for (const product of nullCatProducts) {
          const { categoryId: newCatId } = mapProductToCategory(
            product.name, product.supplierCategory, supplierMappings, slugToId, idToParentId, parentSlugToChildSlugs
          )
          if (newCatId) {
            await db.execute({
              sql: 'UPDATE products SET categoryId = ?, updatedAt = ? WHERE id = ?',
              args: [newCatId, new Date().toISOString(), product.id],
            })
            recategorized++
          }
        }
        console.log(`[Air Intra Finalize] Recategorized ${recategorized} of ${nullCatProducts.length} NULL-category products`)
      }
    } catch (recatErr) {
      console.error('[Air Intra Finalize] Recategorization error:', recatErr)
    }

    // ==========================================
    // POST-SYNC VERIFICATION
    // ==========================================
    try {
      const dbCount = await db.execute({
        sql: 'SELECT COUNT(*) as cnt FROM products WHERE providerId = ?',
        args: [supplier.id],
      })
      const dbTotal = (dbCount.rows as any[])[0]?.cnt || 0
      console.log(`[Air Intra Finalize] Post-sync verification: ${dbTotal} products in DB for this supplier`)
    } catch (verifyErr) {
      console.error('[Air Intra Finalize] Post-sync verification error:', verifyErr)
    }

    // ==========================================
    // POST-SYNC RECOVERY: Search for missing products
    // ==========================================
    const recoveryMarkup = supplier.markup || 30
    const endpoint = 'articulos'

    // Helper: process a single recovery product
    const processRecoveryProduct = async (product: any): Promise<{ action: 'created' | 'updated' | 'skipped' }> => {
      const providerSku = product.codigo || product.codiart || ''
      if (!providerSku || allFetchedSkus.has(providerSku)) return { action: 'skipped' }

      const price = parseFloat(product.precio || '0')
      const productName = product.descrip || product.descripcion || product.titulo || ''
      if (!productName || !providerSku) return { action: 'skipped' }

      const supplierCategory = getAirIntraSupplierCategory(product)
      const costPrice = price
      const sellingPrice = costPrice > 0 ? costPrice * (1 + recoveryMarkup / 100) : 0
      // Stock por depósito - stock total de todos los depósitos
      const stockByWarehouse = {
        air: product.air?.disponible || 0,
        lug: product.lug?.disponible || 0,
        ros: product.ros?.disponible || 0,
        cba: product.cba?.disponible || 0,
        mza: product.mza?.disponible || 0,
      }
      const totalStock = Object.values(stockByWarehouse).reduce((a: number, b: number) => a + b, 0)
      const stockByWarehouseJson = JSON.stringify(stockByWarehouse)

      const { categoryId } = mapProductToCategory(
        productName, supplierCategory, supplierMappings, slugToId, idToParentId, parentSlugToChildSlugs
      )

      let isActive = price > 0 ? 1 : 0
      if (isActive === 1 && supplier.allowedCategories) {
        const supplierAllowedCategories: string[] | null = typeof supplier.allowedCategories === 'string'
          ? JSON.parse(supplier.allowedCategories) : supplier.allowedCategories
        if (supplierAllowedCategories !== null && categoryId) {
          const catSlug = Object.entries(slugToId).find(([_, id]) => id === categoryId)?.[0]
          const catParentId = idToParentId[categoryId]
          const catParentSlug = catParentId ? Object.entries(slugToId).find(([_, id]) => id === catParentId)?.[0] : null
          const isAllowed = catSlug ? supplierAllowedCategories.includes(catSlug) : false
          const isChildOfAllowed = catParentSlug ? supplierAllowedCategories.includes(catParentSlug) : false
          if (!isAllowed && !isChildOfAllowed) isActive = 0
        }
      }

      const existingProduct = existingBySku[providerSku]
      const now = new Date().toISOString()

      if (existingProduct) {
        await db.execute({
          sql: `UPDATE products SET costPrice = ?, price = ?, stock = ?, stockByWarehouse = ?, supplierCategory = ?, categoryId = ?, isActive = ?, updatedAt = ? WHERE id = ?`,
          args: [costPrice, sellingPrice, totalStock, stockByWarehouseJson, supplierCategory, categoryId, isActive, now, existingProduct.id],
        })
        return { action: 'updated' }
      } else {
        const newId = crypto.randomUUID()
        const formattedName = formatProductName(productName)
        let slug = generateSlug(formattedName)
        if (allExistingSlugs.has(slug)) {
          slug = slug + '-' + providerSku.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10)
        }
        allExistingSlugs.add(slug)

        const specs: Record<string, string> = {}
        if (product.garantia) specs['Garantía'] = product.garantia
        if (product.moneda) specs['Moneda'] = product.moneda
        if (product.marca) specs['Marca'] = product.marca
        if (product.rubro) specs['Rubro'] = product.rubro
        if (product.grupo) specs['Grupo'] = product.grupo
        if (product.tipo?.name) specs['Tipo'] = product.tipo.name
        if (product.estado?.name) specs['Estado'] = product.estado.name

        await db.execute({
          sql: `INSERT INTO products (id, name, slug, description, price, costPrice, sku, stock, stockByWarehouse, isActive, isFeatured, images, specs, providerId, providerSku, categoryId, supplierCategory)
                VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?)`,
          args: [newId, formattedName, slug, sellingPrice, costPrice, providerSku, totalStock, stockByWarehouseJson, isActive, 0, JSON.stringify(specs), supplier.id, providerSku, categoryId, supplierCategory],
        })
        existingBySku[providerSku] = { id: newId, slug }
        return { action: 'created' }
      }
    }

    // Helper: fetch recovery results with rate limit handling
    const fetchRecoveryResults = async (searchParams: Record<string, string>, description: string): Promise<any[] | null> => {
      const searchUrl = `${baseUrl}/?q=${endpoint}&page=0`

      try {
        console.log(`[Air Intra Finalize] Recovery search: ${description}`)
        const recoveryRes = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(searchParams),
        })

        // Handle rate limit: skip immediately (no 5-min wait, would exceed Vercel 60s timeout)
        if (recoveryRes.status === 403) {
          const errText = await recoveryRes.text().catch(() => '')
          if (errText.includes('Too many queries')) {
            console.log(`[Air Intra Finalize] Recovery "${description}" rate-limited. Skipping (no wait to fit in 60s).`)
            return null
          }
        }

        if (!recoveryRes.ok) {
          console.log(`[Air Intra Finalize] Recovery "${description}" HTTP ${recoveryRes.status}. Skipping.`)
          return null
        }

        const { data: recoveryData, error: recoveryError } = await safeParseAirIntraResponse(recoveryRes)
        if (recoveryError) {
          console.log(`[Air Intra Finalize] Recovery "${description}" parse error: ${recoveryError}`)
          return null
        }
        if (!Array.isArray(recoveryData) || recoveryData.length === 0) {
          console.log(`[Air Intra Finalize] Recovery "${description}": 0 results`)
          return null
        }
        console.log(`[Air Intra Finalize] Recovery "${description}": found ${recoveryData.length} products`)
        return recoveryData
      } catch (recoveryErr) {
        console.error(`[Air Intra Finalize] Recovery search error for "${description}":`, recoveryErr)
        return null
      }
    }

    let recoveryCreated = 0
    let recoveryUpdated = 0

    // Strategy 1: Text search for known brand names
    const RECOVERY_TEXT_SEARCHES = ['PC AIR', 'PC CX', 'PC ARKHAM', 'PC GAMEMAX']
    for (const searchTerm of RECOVERY_TEXT_SEARCHES) {
      const products = await fetchRecoveryResults({ texto: searchTerm }, `texto="${searchTerm}"`)
      if (products) {
        for (const product of products) {
          const recResult = await processRecoveryProduct(product)
          if (recResult.action === 'created') { recoveryCreated++; created++ }
          else if (recResult.action === 'updated') { recoveryUpdated++; updated++ }
          const providerSku = product.codigo || product.codiart || ''
          if (providerSku) { allFetchedSkus.add(providerSku); totalFetched++ }
        }
      }
      // Wait 500ms between recovery searches to avoid rate limiting (reduced from 2s for 60s budget)
      if (RECOVERY_TEXT_SEARCHES.indexOf(searchTerm) < RECOVERY_TEXT_SEARCHES.length - 1) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    // Strategy 2: Search by specific SKUs for known missing products
    const MISSING_SKUS: string[] = []

    try {
      const dbSkuResult = await db.execute({
        sql: 'SELECT providerSku FROM products WHERE providerId = ? AND providerSku IS NOT NULL ORDER BY CAST(providerSku AS INTEGER)',
        args: [supplier.id],
      })
      const dbSkuSet = new Set((dbSkuResult.rows as any[]).map(r => r.providerSku))

      const fetchedSkuNums = Array.from(allFetchedSkus)
        .map(s => parseInt(s, 10))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b)

      for (let i = 0; i < fetchedSkuNums.length - 1; i++) {
        const current = fetchedSkuNums[i]
        const next = fetchedSkuNums[i + 1]
        if (next - current > 1 && next - current <= 50) {
          for (let sku = current + 1; sku < next; sku++) {
            const skuStr = String(sku)
            if (!dbSkuSet.has(skuStr) && allFetchedSkus.has(skuStr)) {
              MISSING_SKUS.push(skuStr)
            }
          }
        }
      }

      for (const sku of Array.from(allFetchedSkus)) {
        if (!dbSkuSet.has(sku) && !isNaN(parseInt(sku, 10))) {
          if (!MISSING_SKUS.includes(sku)) {
            MISSING_SKUS.push(sku)
          }
        }
      }
    } catch (gapErr) {
      console.error('[Air Intra Finalize] Error detecting missing SKUs:', gapErr)
    }

    if (MISSING_SKUS.length > 0) {
      console.log(`[Air Intra Finalize] Found ${MISSING_SKUS.length} potentially missing SKUs to recover: ${MISSING_SKUS.slice(0, 20).join(', ')}${MISSING_SKUS.length > 20 ? '...' : ''}`)
      // Reduced from 20 to 5 to fit within Vercel Hobby 60s timeout.
      // Each SKU search costs ~500ms wait + ~500ms fetch + DB writes = ~1-2s.
      const skusToSearch = MISSING_SKUS.slice(0, 5)
      for (const sku of skusToSearch) {
        const products = await fetchRecoveryResults({ codiart: sku }, `codiart=${sku}`)
        if (products) {
          for (const product of products) {
            const recResult = await processRecoveryProduct(product)
            if (recResult.action === 'created') { recoveryCreated++; created++ }
            else if (recResult.action === 'updated') { recoveryUpdated++; updated++ }
            const providerSku = product.codigo || product.codiart || ''
            if (providerSku) { allFetchedSkus.add(providerSku); totalFetched++ }
          }
        }
        if (skusToSearch.indexOf(sku) < skusToSearch.length - 1) {
          // Reduced from 3s to 500ms to fit within 60s Vercel timeout budget.
          await new Promise(r => setTimeout(r, 500))
        }
      }
    }

    if (recoveryCreated > 0 || recoveryUpdated > 0) {
      console.log(`[Air Intra Finalize] Recovery total: ${recoveryCreated} new + ${recoveryUpdated} updated via targeted search`)
    }

    // Update lastSyncAt
    const syncNow = new Date().toISOString()
    await db.execute({
      sql: 'UPDATE suppliers SET lastSyncAt = ?, updatedAt = ? WHERE id = ?',
      args: [syncNow, syncNow, supplier.id],
    })

    // ─── Clear sync state: cooldown + last sync page ──────────────────────
    // The whole cycle (articulos pages + syp + recovery) completed successfully,
    // so there is nothing to resume from and no need to keep the cooldown active.
    await Promise.all([clearAirIntraCooldown(), clearAirIntraLastSyncPage()])
    console.log('[Air Intra Finalize] Cleared cooldown + last sync page (cycle complete).')

    result.ok = true
    result.total = totalFetched
    result.created = created
    result.updated = updated
    result.skipped = skipped
    result.errors = errors

    const recoverySearchNote = recoveryCreated > 0 || recoveryUpdated > 0 ? ` + ${recoveryCreated} recuperados por búsqueda dirigida (${recoveryUpdated} actualizados)` : ''
    const sypNote = sypCreated > 0 || sypUpdated > 0 ? ` + ${sypCreated} nuevos del catálogo syp (${sypUpdated} actualizados)` : ''
    result.message = `Sincronización finalizada: syp ${sypCreated} nuevos (${sypUpdated} actualizados)${recoverySearchNote}${sypNote}`

  } catch (error: any) {
    result.message = `Error en finalización de Air Intra: ${error.message}`
  }

  return result
}

export async function syncElit(supplier: any): Promise<SyncResult> {
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

export async function GET(request: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const url = new URL(request.url)
    const supplierId = url.searchParams.get('supplierId')
    if (!supplierId) {
      return NextResponse.json({ error: 'supplierId requerido' }, { status: 400 })
    }

    const supplierResult = await db.execute({
      sql: 'SELECT apiType, lastSyncAt FROM suppliers WHERE id = ?',
      args: [supplierId],
    })
    const supplier = (supplierResult.rows as any[])[0]
    if (!supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }
    if (supplier.apiType !== 'air_intra') {
      return NextResponse.json({ apiType: supplier.apiType, cooldownRemaining: 0, lastSyncPage: -1 })
    }

    const [cooldownMs, lastPage] = await Promise.all([
      getAirIntraCooldown(),
      getAirIntraLastSyncPage(),
    ])

    return NextResponse.json({
      apiType: 'air_intra',
      cooldownRemaining: cooldownMs,        // ms remaining (0 = no cooldown)
      lastSyncPage: lastPage,               // last successfully processed page (-1 = none)
      lastSyncAt: supplier.lastSyncAt ?? null,
    })
  } catch (error: any) {
    console.error('[sync GET] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { supplierId, batch } = body as { supplierId: string; batch?: AirIntraBatchParams }

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

    if (supplier.apiType === 'air_intra') {
      // Batched sync for Air Intra to avoid Vercel Hobby 60s timeout
      if (batch?.finalize) {
        // Finalize step: run syp, recategorization, recovery, update lastSyncAt
        syncResult = await syncAirIntraFinalize(supplier, batch)
      } else if (batch) {
        // Subsequent batch: use existing token, process specific page range
        syncResult = await syncAirIntraBatch(supplier, batch)
      } else {
        // First call: login + first batch (pages 0 to PAGES_PER_BATCH-1)
        syncResult = await syncAirIntraBatch(supplier, {
          startPage: 0,
          endPage: PAGES_PER_BATCH - 1,
        })
      }
    } else {
      // Invid / Elit: full sync as before (backward compatible)
      switch (supplier.apiType) {
        case 'invid':
          syncResult = await syncInvid(supplier)
          break
        case 'elit':
          syncResult = await syncElit(supplier)
          break
        default:
          return NextResponse.json({
            error: `Tipo de API "${supplier.apiType}" no soportado. Tipos disponibles: invid, air_intra, elit`,
          }, { status: 400 })
      }
    }

    // Run post-sync category validation to fix any miscategorized products
    // IMPORTANT: This now runs on EVERY sync (not just when new products are created)
    // because even existing products may have been categorized incorrectly by a previous sync
    // For Air Intra batch mode: skip validation on intermediate batches (hasMore=true),
    // it will run after the finalize step when all pages are done.
    if (syncResult.ok && !syncResult.hasMore) {
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
          { namePattern: "name LIKE '%NOTEBOOK%' OR name LIKE '%LAPTOP%' OR name LIKE 'NB %' OR name LIKE 'NB CX%'", wrongSlug: 'microprocesadores', correctSlug: 'notebooks' },
          { namePattern: "name LIKE '%PC GAMER%' OR name LIKE '%PC LENOVO%' OR name LIKE '%SIST.%' OR name LIKE 'PC %' OR name LIKE 'PC Arkham%' OR name LIKE 'PC Performance%' OR name LIKE 'PC Gamemax%' OR name LIKE 'PC Xpg%'", wrongSlug: 'microprocesadores', correctSlug: 'pc-armadas' },
          { namePattern: "name LIKE '%MOTHER%'", wrongSlug: 'microprocesadores', correctSlug: 'motherboards' },
          { namePattern: "name LIKE '%MINI PC%' OR name LIKE '%BAREBONE%'", wrongSlug: 'microprocesadores', correctSlug: 'pc-armadas' },
          { namePattern: "name LIKE 'AIO %' OR name LIKE 'SSD PC Mini%'", wrongSlug: 'microprocesadores', correctSlug: 'pc-armadas' },
          // === Memorias RAM corrections ===
          { namePattern: "name LIKE '%NOTEBOOK%' OR name LIKE '%LAPBOOK%'", wrongSlug: 'memorias-ram', correctSlug: 'notebooks' },
          { namePattern: "name LIKE '%PC GAMER%' OR name LIKE '%PC LENOVO%'", wrongSlug: 'memorias-ram', correctSlug: 'pc-armadas' },
          { namePattern: "name LIKE '%PROCESADOR%'", wrongSlug: 'memorias-ram', correctSlug: 'microprocesadores' },
          // === Discos SSD corrections ===
          { namePattern: "name LIKE '%EXTERNO%' OR name LIKE '%EXTERNA%' OR name LIKE '%PORTABLE%'", wrongSlug: 'discos-ssd', correctSlug: 'discos-externos' },
          { namePattern: "name LIKE '%NOTEBOOK%' OR name LIKE '%LAPTOP%'", wrongSlug: 'discos-ssd', correctSlug: 'notebooks' },
          { namePattern: "name LIKE '%PC GAMER%' OR name LIKE '%PC LENOVO%'", wrongSlug: 'discos-ssd', correctSlug: 'pc-armadas' },
          { namePattern: "name LIKE '%PENDRIVE%' OR name LIKE '%FLASH DRIVE%'", wrongSlug: 'discos-ssd', correctSlug: 'pendrives' },
          // === Discos HDD corrections ===
          { namePattern: "name LIKE '%EXTERNO%' OR name LIKE '%EXTERNA%' OR name LIKE '%PORTABLE%'", wrongSlug: 'discos-hdd', correctSlug: 'discos-externos' },
          // === Fuentes corrections ===
          { namePattern: "name LIKE '%PC GAMER%'", wrongSlug: 'fuentes', correctSlug: 'pc-armadas' },
          { namePattern: "name LIKE '%GABINETE%'", wrongSlug: 'fuentes', correctSlug: 'gabinetes' },
          // === Gabinetes corrections ===
          { namePattern: "name LIKE '%PC GAMER%'", wrongSlug: 'gabinetes', correctSlug: 'pc-armadas' },
          // === Monitores corrections ===
          { namePattern: "name LIKE '%CABLE%'", wrongSlug: 'monitores', correctSlug: 'cables-y-adaptadores' },
          { namePattern: "name LIKE '%SOPORTE%'", wrongSlug: 'monitores', correctSlug: 'soportes-y-brazos' },
          // === Notebooks corrections ===
          { namePattern: "name LIKE '%FUNDA%' OR name LIKE '%MOCHILA%'", wrongSlug: 'notebooks', correctSlug: 'fundas-mochilas' },
          { namePattern: "name LIKE '%MOTHERBOARD%'", wrongSlug: 'notebooks', correctSlug: 'motherboards' },
          { namePattern: "name LIKE 'CABLE%NOTEBOOK%' OR name LIKE 'CABLE INTERLOCK%'", wrongSlug: 'notebooks', correctSlug: 'cables-y-adaptadores' },
          { namePattern: "name LIKE 'FUENTE%NOTEBOOK%'", wrongSlug: 'notebooks', correctSlug: 'cargadores' },
          { namePattern: "name LIKE 'BASE%NOTEBOOK%' OR name LIKE 'BASE GENIUS%'", wrongSlug: 'notebooks', correctSlug: 'bases' },
          { namePattern: "name LIKE 'MONITOR%PORTATIL%' OR name LIKE 'MONITOR%USB%'", wrongSlug: 'notebooks', correctSlug: 'monitores' },
        ]

        // Run all QUICK_FIXES UPDATEs in parallel (limited concurrency) to avoid
        // spending 30+ sequential UPDATE round-trips inside the 60s Vercel timeout.
        let autoFixed = 0
        const fixOps = QUICK_FIXES.map(fix => async () => {
          const wrongCatId = slugToId[fix.wrongSlug]
          const correctCatId = slugToId[fix.correctSlug]
          if (!wrongCatId || !correctCatId) return 0
          const r = await db.execute({
            sql: `UPDATE products SET categoryId = ?, categorySource = 'auto', updatedAt = datetime('now') WHERE categoryId = ? AND (${fix.namePattern}) AND (categorySource IS NULL OR categorySource != 'manual')`,
            args: [correctCatId, wrongCatId],
          })
          return (r.rowsAffected as number) || 0
        })
        const FIX_CONCURRENCY = 10
        for (let i = 0; i < fixOps.length; i += FIX_CONCURRENCY) {
          const chunk = fixOps.slice(i, i + FIX_CONCURRENCY)
          const results = await Promise.all(chunk.map(fn => fn()))
          autoFixed += results.reduce((a, b) => a + b, 0)
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
