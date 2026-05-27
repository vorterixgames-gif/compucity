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

// Category mapping: keyword patterns -> store category ID
// Used to auto-assign products from supplier APIs to the correct store category
const CATEGORY_KEYWORD_MAP: { keywords: string[]; categoryId: string; name: string }[] = [
  // Auriculares
  { keywords: ['AURICULAR','HEADSET','HEADPHONE','JBL TOUR','JBL QUANTUM'], categoryId: 'f1f9d31f-9482-4429-a7d2-4208668e3ba3', name: 'Auriculares' },
  // Mouse
  { keywords: ['MOUSE'], categoryId: 'ac551783-8734-4858-a316-d0a54701e437', name: 'Mouse' },
  // Teclados
  { keywords: ['TECLADO','KEYBOARD'], categoryId: 'dede1e27-d8b0-44b1-9ac0-8112ad91a57d', name: 'Teclados' },
  // Parlantes
  { keywords: ['PARLANTE','SPEAKER','BARRA DE SONIDO','SOUND BAR','PARTY LIGHT'], categoryId: 'a4ca4e17-7730-4feb-a6c6-a7a8b96075ac', name: 'Parlantes' },
  // Mousepads
  { keywords: ['MOUSEPAD','PAD GAMER','ALFOMBRILLA','PAD '], categoryId: '724ec70f-dab0-496f-b3a2-7ddee9a4770d', name: 'Mousepads' },
  // Micrófonos
  { keywords: ['MICROFONO','MICROPHONE','MIC '], categoryId: '6498104b-2a0e-4770-86af-bd7c2572555a', name: 'Micrófonos' },
  // Webcams
  { keywords: ['WEBCAM','CAM WEB','WEB CAM','BRIO','FACECAM'], categoryId: '8e03c174-cb16-4b19-b920-73fc96236fbd', name: 'Webcams' },
  // Joysticks
  { keywords: ['JOYSTICK','CONTROL ','GAMEPAD','CONTROLLER','GAME PAD','VOLANTE','G29','G923','F710'], categoryId: '964647bd-67e5-4483-91ea-fb74f8f49ca4', name: 'Joysticks' },
  // Kits Gamer
  { keywords: ['KIT GABINETE','KIT TECLADO','KIT GAMER'], categoryId: 'b19a7241-88e7-454f-8b5e-b0030d9c6716', name: 'Kits Gamer' },
  // Toners y Cartuchos
  { keywords: ['CARTUCHO','TONER','INK CARTRIDGE','PRINT C','IMAGING DRUM','PRINHEAD','CART.','TINTA.','CART.NEGRO','CART.CYAN','CART.MAGENTA','CART.YELLOW','CART.AMARILLO','CART.LIGHT','BOTELLA DE TINTA','HP 935','HP 951','HP 126','HP 122'], categoryId: '66f20839-0487-433a-930f-9705ca43365d', name: 'Toners y Cartuchos' },
  // Impresión
  { keywords: ['IMPRESORA','EPSON L','EPSON M','SMART TANK','LASERJET','DESKJET','OFFICEJET','PROYECTOR EPSON'], categoryId: '18191d04-ecf3-412c-b627-7674c148013c', name: 'Impresión' },
  // Memorias RAM
  { keywords: ['MEMORIA DDR','DDR3','DDR4','DDR5','SODIMM','CORSAIR MEMORY'], categoryId: '8fec8068-83c9-43a9-a972-9eeafe9e0bda', name: 'Memorias RAM' },
  // Discos SSD
  { keywords: ['SSD','NVME','M.2','GEN4','GEN3'], categoryId: '18b32130-e146-4843-95c5-860142417306', name: 'Discos SSD' },
  // Discos HDD
  { keywords: ['DISCO RIGIDO','HDD','IRONWOLF','SKYHAWK','HD SEAGATE INTERNO','HD TOSHIBA INTERNO'], categoryId: '63761dd5-d992-4bab-b9a6-fb95c3ff2cef', name: 'Discos HDD' },
  // Discos Externos
  { keywords: ['DISCO EXTERNO','EXTERNAL','PORTABLE DRIVE','HD SEAGATE EXTERNO','HD TOSHIBA EXTERNO','CANVIO','EXPANSION BLACK'], categoryId: '404bbe6d-bc9a-471c-b264-fcf18d693295', name: 'Discos Externos' },
  // Pendrives
  { keywords: ['PENDRIVE','DATA TRAVELER','DATATRAVELER','FLASH DRIVE','PEN DRIVE'], categoryId: 'f78dc8a5-69e0-4097-b4f9-c928fd90069f', name: 'Pendrives' },
  // Micro SD
  { keywords: ['MICRO SD','MICROSD','SD CARD','MICRO MEMORY'], categoryId: '797adcdf-c7ae-4aa0-9b14-18b3a5b8ea45', name: 'Micro SD' },
  // Microprocesadores
  { keywords: ['RYZEN','INTEL I3','INTEL I5','INTEL I7','INTEL I9','CORE I','PENTIUM','CORE ULTRA'], categoryId: 'b4211f62-d18d-430e-a918-8dadafde4723', name: 'Microprocesadores' },
  // Motherboards
  { keywords: ['MOTHER','H610','B760','H810','A520','A620','B650','B550','H510'], categoryId: '50aed4ad-61dd-4e5d-ad30-2aae7a32504e', name: 'Motherboards' },
  // Placas de Video
  { keywords: ['RTX','GTX','RADEON RX','GEFORCE','GRAPHICS CARD','QUADRO RTX'], categoryId: 'cfbf9b6c-5d7b-4d42-aaa3-066a52848fbd', name: 'Placas de Video' },
  // Fuentes
  { keywords: ['FUENTE','POWER SUPPLY','PSU'], categoryId: 'bce97e5d-3ccf-4e49-9c23-1af8ece63612', name: 'Fuentes' },
  // Gabinetes
  { keywords: ['GABINETE','CHASSIS','CASE ','TOWER','CTE 550','5000T','4500X','BLAZE FORCE','INFINITY GLASS'], categoryId: 'b24872b5-c02e-4969-892b-aa03f1acdae8', name: 'Gabinetes' },
  // Refrigeración
  { keywords: ['COOLER','WATER COOL','LIQUID COOL','DISIPADOR','HEATSINK','SWAFAN','FAN COOLER','ICUE LINK','AIO '], categoryId: '57b1e5cc-59e6-49f0-a9d1-b3f388c19f79', name: 'Refrigeración' },
  // Pastas Térmicas
  { keywords: ['PASTA TERMICA','THERMAL PASTE'], categoryId: 'b8cc805f-10f4-4bb1-b4d2-dacc0ad395c4', name: 'Pastas Térmicas' },
  // Monitores
  { keywords: ['MONITOR','ULTRAFINE','LED MONITOR'], categoryId: 'cat4', name: 'Monitores' },
  // Notebooks
  { keywords: ['NOTEBOOK','LAPTOP'], categoryId: 'cat1', name: 'Notebooks' },
  // Routers WiFi
  { keywords: ['ARCHER','ROUTER','DECO','MESH WIFI','TL-WR','ROU WI'], categoryId: '172af915-f189-476c-a735-e9a7b05bd16c', name: 'Routers WiFi' },
  // Switches
  { keywords: ['SWITCH'], categoryId: '2624baab-e1ba-4f28-aa2f-2d4d1b726b84', name: 'Switches' },
  // Placas de Red
  { keywords: ['P.REDW','EAP','CPE','SFP','TL-WN','PREDW','RANGE EXTENDER','TAPO C','CAMARA IP'], categoryId: 'be240fd6-301f-405a-a42d-e6937fa9bcf9', name: 'Placas de Red' },
  // Cables y Adaptadores
  { keywords: ['CABLE','ADAPTADOR','FICHA RJ45','CONVERTER','ROLLO','UTP CAT','PROTECTOR KELYX','PROLONGADOR','HUB KELYX','HUB USB'], categoryId: '3f166420-a367-43a9-96d6-55760385bbb5', name: 'Cables y Adaptadores' },
  // UPS / Estabilizadores
  { keywords: ['UPS','ESTABILIZADOR','NOBREAK','SURGE PROTECTION'], categoryId: 'b854e149-1790-4cad-abc6-0a4fb187740b', name: 'UPS' },
  // Cargadores
  { keywords: ['CARGADOR','CHARGER','POWER BANK'], categoryId: '6af5a32c-f21d-4498-9927-c33a97e72a16', name: 'Cargadores' },
  // Sillas Gamer
  { keywords: ['SILLA','GAMING CHAIR'], categoryId: 'bdf7ba10-c068-4b61-845c-5d38e2b87a61', name: 'Sillas Gamer' },
  // Soportes y Brazos
  { keywords: ['SOPORTE','BRAZO','MOUNT','STAND'], categoryId: '3d84075f-2bb7-4d20-b321-7f3f9f9fe6f0', name: 'Soportes y Brazos' },
  // Fundas/Mochilas
  { keywords: ['MOCHILA','FUNDA','BACKPACK'], categoryId: '4e82d540-2eb2-4d4b-b349-44fe6af49e00', name: 'Fundas/Mochilas' },
  // Mini PC
  { keywords: ['MINI PC','STICK PC'], categoryId: '00176d39-d1cb-4f68-a01e-617fb37679cb', name: 'Mini PC' },
  // Bases
  { keywords: ['BASE CARGADORA','DOCK'], categoryId: 'ebce56d0-c6a3-46cb-b737-3e69f5163847', name: 'Bases' },
  // Escritorios
  { keywords: ['ESCRITORIO','DESK ','MESA GAMER'], categoryId: '9a877f10-5486-4918-97e1-654f457c7420', name: 'Escritorios' },
]

/**
 * Map a product name to a store category using keyword matching.
 * Returns the category ID or null if no match found.
 */
function mapProductToCategory(productName: string): string | null {
  const name = (productName || '').toUpperCase()
  for (const mapping of CATEGORY_KEYWORD_MAP) {
    if (mapping.keywords.some(kw => name.includes(kw))) {
      return mapping.categoryId
    }
  }
  // Default: Periféricos as catch-all
  return 'cat3'
}

async function syncInvid(supplier: any): Promise<SyncResult> {
  const baseUrl = supplier.apiBaseUrl || 'https://www.invidcomputers.com'
  const result: SyncResult = { ok: false, total: 0, created: 0, updated: 0, skipped: 0, errors: 0, message: '' }

  try {
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

          // Check if product already exists with this providerSku
          const existing = await db.execute({
            sql: 'SELECT id FROM products WHERE providerId = ? AND providerSku = ?',
            args: [supplier.id, providerSku],
          })

          const existingRows = existing.rows as any[]

          // Find matching category using keyword mapping
          const categoryId = mapProductToCategory(product.TITLE || product.DESCRIPTION || '')

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
                updatedAt = ?
              WHERE id = ?`,
              args: [
                costPrice,
                sellingPrice,
                product.STOCK_STATUS || '',
                product.STOCK_STATUS || '',
                product.STOCK_STATUS || '',
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
              sql: `INSERT INTO products (id, name, slug, description, price, comparePrice, costPrice, sku, stock, isActive, isFeatured, images, specs, providerId, providerSku, categoryId)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

          const categoryId = mapProductToCategory(product.descrip || '')

          if (existingRows.length > 0) {
            await db.execute({
              sql: `UPDATE products SET
                costPrice = ?, price = ?, stock = ?,
                updatedAt = ?
              WHERE id = ?`,
              args: [costPrice, sellingPrice, totalStock, new Date().toISOString(), existingRows[0].id],
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
              sql: `INSERT INTO products (id, name, slug, description, price, costPrice, sku, stock, isActive, isFeatured, images, specs, providerId, providerSku, categoryId)
                    VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?)`,
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

          const stockTotal = parseInt(product.stock_total || '0')

          const existing = await db.execute({
            sql: 'SELECT id FROM products WHERE providerId = ? AND providerSku = ?',
            args: [supplier.id, providerSku],
          })

          const existingRows = existing.rows as any[]

          const categoryId = mapProductToCategory(product.nombre || product.descripcion || '')

          if (existingRows.length > 0) {
            await db.execute({
              sql: `UPDATE products SET
                costPrice = ?, price = ?, stock = ?,
                updatedAt = ?
              WHERE id = ?`,
              args: [costPrice, sellingPrice, stockTotal, new Date().toISOString(), existingRows[0].id],
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
              sql: `INSERT INTO products (id, name, slug, description, price, comparePrice, costPrice, sku, stock, isActive, isFeatured, images, specs, providerId, providerSku, categoryId)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
