import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface SyncResult {
  ok: boolean
  total: number
  created: number
  updated: number
  skipped: number
  errors: number
  message: string
}

// Category keyword mapping: keyword patterns -> store category SLUG
// Used as fallback when no explicit supplier category mapping exists
const CATEGORY_KEYWORD_MAP: { keywords: string[]; categorySlug: string; name: string }[] = [
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
  // Toners y Cartuchos
  { keywords: ['CARTUCHO','TONER','INK CARTRIDGE','PRINT C','IMAGING DRUM','PRINHEAD','CART.','TINTA.','CART.NEGRO','CART.CYAN','CART.MAGENTA','CART.YELLOW','CART.AMARILLO','CART.LIGHT','BOTELLA DE TINTA','HP 935','HP 951','HP 126','HP 122'], categorySlug: 'toners-y-cartuchos', name: 'Toners y Cartuchos' },
  // Impresión
  { keywords: ['IMPRESORA','EPSON L','EPSON M','SMART TANK','LASERJET','DESKJET','OFFICEJET','PROYECTOR EPSON'], categorySlug: 'impresion', name: 'Impresión' },
  // Memorias RAM
  { keywords: ['MEMORIA DDR','DDR3','DDR4','DDR5','SODIMM','CORSAIR MEMORY'], categorySlug: 'memorias-ram', name: 'Memorias RAM' },
  // Discos SSD
  { keywords: ['SSD','NVME','M.2','GEN4','GEN3'], categorySlug: 'discos-ssd', name: 'Discos SSD' },
  // Discos HDD
  { keywords: ['DISCO RIGIDO','HDD','IRONWOLF','SKYHAWK','HD SEAGATE INTERNO','HD TOSHIBA INTERNO'], categorySlug: 'discos-hdd', name: 'Discos HDD' },
  // Discos Externos
  { keywords: ['DISCO EXTERNO','EXTERNAL','PORTABLE DRIVE','HD SEAGATE EXTERNO','HD TOSHIBA EXTERNO','CANVIO','EXPANSION BLACK'], categorySlug: 'discos-externos', name: 'Discos Externos' },
  // Pendrives
  { keywords: ['PENDRIVE','DATA TRAVELER','DATATRAVELER','FLASH DRIVE','PEN DRIVE'], categorySlug: 'pendrives', name: 'Pendrives' },
  // Micro SD
  { keywords: ['MICRO SD','MICROSD','SD CARD','MICRO MEMORY'], categorySlug: 'micro-sd', name: 'Micro SD' },
  // Microprocesadores
  { keywords: ['RYZEN','INTEL I3','INTEL I5','INTEL I7','INTEL I9','CORE I','PENTIUM','CORE ULTRA'], categorySlug: 'microprocesadores', name: 'Microprocesadores' },
  // Motherboards
  { keywords: ['MOTHER','H610','B760','H810','A520','A620','B650','B550','H510'], categorySlug: 'motherboards', name: 'Motherboards' },
  // Placas de Video
  { keywords: ['RTX','GTX','RADEON RX','GEFORCE','GRAPHICS CARD','QUADRO RTX'], categorySlug: 'placas-de-video', name: 'Placas de Video' },
  // Fuentes
  { keywords: ['FUENTE','POWER SUPPLY','PSU'], categorySlug: 'fuentes', name: 'Fuentes' },
  // Gabinetes
  { keywords: ['GABINETE','CHASSIS','CASE ','TOWER','CTE 550','5000T','4500X','BLAZE FORCE','INFINITY GLASS'], categorySlug: 'gabinetes', name: 'Gabinetes' },
  // Refrigeración
  { keywords: ['COOLER','WATER COOL','LIQUID COOL','DISIPADOR','HEATSINK','SWAFAN','FAN COOLER','ICUE LINK','AIO '], categorySlug: 'refrigeracion', name: 'Refrigeración' },
  // Pastas Térmicas
  { keywords: ['PASTA TERMICA','THERMAL PASTE'], categorySlug: 'pastas-termicas', name: 'Pastas Térmicas' },
  // Monitores
  { keywords: ['MONITOR','ULTRAFINE','LED MONITOR'], categorySlug: 'monitores', name: 'Monitores' },
  // Notebooks
  { keywords: ['NOTEBOOK','LAPTOP','PORTATIL'], categorySlug: 'notebooks', name: 'Notebooks' },
  // Routers WiFi
  { keywords: ['ARCHER','ROUTER','DECO','MESH WIFI','TL-WR','ROU WI'], categorySlug: 'routers-wifi', name: 'Routers WiFi' },
  // Switches
  { keywords: ['SWITCH'], categorySlug: 'switches', name: 'Switches' },
  // Placas de Red
  { keywords: ['P.REDW','EAP','CPE','SFP','TL-WN','PREDW','RANGE EXTENDER','TAPO C','CAMARA IP'], categorySlug: 'placas-de-red', name: 'Placas de Red' },
  // Cables y Adaptadores
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
  // Mini PC
  { keywords: ['MINI PC','STICK PC'], categorySlug: 'mini-pc', name: 'Mini PC' },
  // Bases
  { keywords: ['BASE CARGADORA','DOCK'], categorySlug: 'bases', name: 'Bases' },
  // Escritorios
  { keywords: ['ESCRITORIO','DESK ','MESA GAMER'], categorySlug: 'escritorios', name: 'Escritorios' },
]

/**
 * Build a category lookup from the database.
 * Returns slug -> id map and name -> id map.
 */
async function buildCategoryLookup(): Promise<{
  slugToId: Record<string, string>
  nameToId: Record<string, string>
}> {
  const result = await db.execute('SELECT id, name, slug FROM categories')
  const slugToId: Record<string, string> = {}
  const nameToId: Record<string, string> = {}
  for (const row of result.rows as any[]) {
    if (row.slug) slugToId[row.slug] = row.id
    if (row.name) nameToId[row.name.toLowerCase()] = row.id
  }
  return { slugToId, nameToId }
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
 * 3. Default: null (no category)
 */
function mapProductToCategory(
  productName: string,
  supplierCategory: string | null,
  supplierMappings: Record<string, string>,
  slugToId: Record<string, string>
): { categoryId: string | null; method: string } {
  // 1. Check supplier category mapping first
  if (supplierCategory && supplierMappings[supplierCategory]) {
    return { categoryId: supplierMappings[supplierCategory], method: 'mapping' }
  }

  // 2. Keyword matching
  const name = (productName || '').toUpperCase()
  for (const mapping of CATEGORY_KEYWORD_MAP) {
    if (mapping.keywords.some(kw => name.includes(kw))) {
      const categoryId = slugToId[mapping.categorySlug]
      if (categoryId) {
        return { categoryId, method: 'keyword' }
      }
    }
  }

  // 3. No match
  return { categoryId: null, method: 'none' }
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
  return product.rubro || product.categoria || product.familia || product.grupo || product.linea || ''
}

async function syncInvid(supplier: any): Promise<SyncResult> {
  const baseUrl = supplier.apiBaseUrl || 'https://www.invidcomputers.com'
  const result: SyncResult = { ok: false, total: 0, created: 0, updated: 0, skipped: 0, errors: 0, message: '' }

  try {
    // Build category lookups
    const { slugToId } = await buildCategoryLookup()
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

          // Find matching category using mapping -> keyword -> default
          const { categoryId } = mapProductToCategory(
            product.TITLE || product.DESCRIPTION || '',
            supplierCategory,
            supplierMappings,
            slugToId
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
            const slug = product.TITLE
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')
              .substring(0, 100)

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
                product.TITLE,
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

async function syncAirIntra(supplier: any): Promise<SyncResult> {
  const baseUrl = supplier.apiBaseUrl || 'https://api.air-intra.com/v2'
  const result: SyncResult = { ok: false, total: 0, created: 0, updated: 0, skipped: 0, errors: 0, message: '' }

  try {
    // Build category lookups
    const { slugToId } = await buildCategoryLookup()
    const supplierMappings = await buildSupplierMappingLookup(supplier.id)

    // Step 1: Authenticate
    const authRes = await fetch(`${baseUrl}/?q=login&user=${encodeURIComponent(supplier.apiUsername)}&pass=${encodeURIComponent(supplier.apiPassword)}`)

    if (!authRes.ok) {
      result.message = `Error de autenticación Air Intra: ${authRes.status}`
      return result
    }

    const authData = await authRes.json()
    if (!authData.token) {
      result.message = `Air Intra: ${authData.error_detail || 'No se recibió token'}`
      return result
    }

    const token = authData.token
    const exchangeRate = parseFloat(authData.cotiza || '0')

    // Step 2: Fetch all products using syp (stock & price) endpoint
    let page = 0
    const pageSize = 500
    let hasMore = true
    let totalFetched = 0
    let created = 0
    let updated = 0
    let skipped = 0
    let errors = 0

    while (hasMore) {
      const productsRes = await fetch(`${baseUrl}/?q=syp&page=${page}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      if (!productsRes.ok) {
        result.message = `Error fetching products from Air Intra: ${productsRes.status}`
        result.total = totalFetched
        result.created = created
        result.updated = updated
        result.skipped = skipped
        result.errors = errors + 1
        return result
      }

      const products = await productsRes.json()

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

          const providerSku = product.codigo || ''
          const costPrice = price
          const supplierCategory = getAirIntraSupplierCategory(product)

          // Air Intra prices are in USD
          const markup = supplier.markup || 30
          const sellingPrice = costPrice * (1 + markup / 100)

          // Check total available stock
          const totalStock = (product.air?.disponible || 0) +
            (product.lug?.disponible || 0) +
            (product.ros?.disponible || 0) +
            (product.cba?.disponible || 0) +
            (product.mza?.disponible || 0)

          const existing = await db.execute({
            sql: 'SELECT id FROM products WHERE providerId = ? AND providerSku = ?',
            args: [supplier.id, providerSku],
          })

          const existingRows = existing.rows as any[]

          const { categoryId } = mapProductToCategory(
            product.descrip || '',
            supplierCategory,
            supplierMappings,
            slugToId
          )

          if (existingRows.length > 0) {
            await db.execute({
              sql: `UPDATE products SET
                costPrice = ?, price = ?, stock = ?,
                supplierCategory = ?,
                updatedAt = ?
              WHERE id = ?`,
              args: [costPrice, sellingPrice, totalStock, supplierCategory, new Date().toISOString(), existingRows[0].id],
            })
            updated++
          } else {
            if (!product.descrip) {
              skipped++
              continue
            }

            const newId = crypto.randomUUID()
            const slug = product.descrip
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')
              .substring(0, 100)

            const specs: Record<string, string> = {}
            if (product.garantia) specs['Garantía'] = product.garantia
            if (product.moneda) specs['Moneda'] = product.moneda

            await db.execute({
              sql: `INSERT INTO products (id, name, slug, description, price, costPrice, sku, stock, isActive, isFeatured, images, specs, providerId, providerSku, categoryId, supplierCategory)
                    VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?)`,
              args: [
                newId,
                product.descrip,
                slug,
                sellingPrice,
                costPrice,
                providerSku,
                totalStock,
                1,
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

      page++
      if (products.length < pageSize) {
        hasMore = false
      }
    }

    const syncNow2 = new Date().toISOString()
    await db.execute({
      sql: 'UPDATE suppliers SET lastSyncAt = ?, updatedAt = ? WHERE id = ?',
      args: [syncNow2, syncNow2, supplier.id],
    })

    result.ok = true
    result.total = totalFetched
    result.created = created
    result.updated = updated
    result.skipped = skipped
    result.errors = errors
    result.message = `Sincronización completada: ${totalFetched} productos, ${created} nuevos, ${updated} actualizados, ${skipped} omitidos`

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
    const { slugToId } = await buildCategoryLookup()
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
            slugToId
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
            const slug = product.nombre
              .toLowerCase()
              .replace(/[^a-z0-9áéíóúñ]+/g, '-')
              .replace(/^-|-$/g, '')
              .substring(0, 100)

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
                product.nombre,
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

    return NextResponse.json({ ok: syncResult.ok, ...syncResult })
  } catch (error) {
    console.error('Error syncing supplier:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
