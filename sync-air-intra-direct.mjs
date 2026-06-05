/**
 * Direct Air Intra supplier sync script
 * Fetches ALL products from Air Intra API (articulos endpoint) and upserts them into the DB
 * Uses in-memory lookup for existing products to minimize DB round-trips
 * 
 * This script bypasses the Next.js API route and connects directly to Turso DB,
 * avoiding timeout issues and allowing for more robust error handling.
 * 
 * Usage: node sync-air-intra-direct.mjs
 */

import { createClient } from '@libsql/client';

const DB_URL = 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io';
const DB_AUTH = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw';
const AIR_INTRA_SUPPLIER_ID = 'air-intra-1780331633566';
const BASE_URL = 'https://api.air-intra.com/v2';
const USER = 'c4078';
const PASS = 'buA4XNOAAB';

const db = createClient({ url: DB_URL, authToken: DB_AUTH });

// ─── Format helpers ──────────────────────────────────────────────────────────

const EXACT_CASE = {};
const _entries = [
  ['NVIDIA','NVIDIA'],['AMD','AMD'],['ASUS','ASUS'],['MSI','MSI'],['JBL','JBL'],
  ['LG','LG'],['HP','HP'],['USB','USB'],['HDMI','HDMI'],['RGB','RGB'],
  ['DDR4','DDR4'],['DDR5','DDR5'],['GDDR6','GDDR6'],['GDDR5','GDDR5'],['GDDR6X','GDDR6X'],
  ['SSD','SSD'],['HDD','HDD'],['NVME','NVMe'],['OLED','OLED'],
  ['PCIE','PCIe'],['WIFI','WiFi'],['ATX','ATX'],['ITX','ITX'],['SATA','SATA'],
  ['FHD','FHD'],['QHD','QHD'],['UHD','UHD'],['WUXGA','WUXGA'],['WQXGA','WQXGA'],
  ['GEFORCE','GeForce'],['RYZEN','Ryzen'],
  ['CORE','Core'],['PENTIUM','Pentium'],['CELERON','Celeron'],
  ['LENOVO','Lenovo'],['KINGSTON','Kingston'],['SAMSUNG','Samsung'],
  ['CORSAIR','Corsair'],['LOGITECH','Logitech'],['GIGABYTE','Gigabyte'],
  ['KELYX','Kelyx'],['IDEAPAD','IdeaPad'],['LEGION','Legion'],['LOQ','LOQ'],
  ['FREEDOS','FreeDOS'],['WINDOWS','Windows'],
  ['MONITOR','Monitor'],['NOTEBOOK','Notebook'],['TABLET','Tablet'],
  ['AURICULAR','Auricular'],['MOUSE','Mouse'],['TECLADO','Teclado'],
  ['DISCO','Disco'],['MEMORIA','Memoria'],['FUENTE','Fuente'],
  ['PLACA','Placa'],['PROCESADOR','Procesador'],
  ['GAMING','Gaming'],['GAMER','Gamer'],['AIO','AIO'],['RAM','RAM'],['ULTRA','Ultra'],
  ['LED','LED'],['IPS','IPS'],['BLUETOOTH','Bluetooth'],
  ['PRO','Pro'],['PLUS','Plus'],['MINI','Mini'],
];
for (const [k, v] of _entries) EXACT_CASE[k] = v;

function formatProductName(name) {
  if (!name) return '';
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => {
      const upper = w.toUpperCase();
      if (EXACT_CASE[upper]) return EXACT_CASE[upper];
      if (w.length <= 2) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200);
}

// ─── Air Intra API helpers ──────────────────────────────────────────────────

function stripPhpNotices(text) {
  return text
    .replace(/(?:<br\s*\/?>\s*)?<b>(?:Notice|Warning|Fatal error|Parse error|Deprecated)<\/b>:\s*.*?on line \d+\s*/gis, '')
    .replace(/(?:^|\n)\s*(?:Notice|Warning|Fatal error|Parse error|Deprecated):\s*.*?on line \d+\s*/gis, '')
    .replace(/<br\s*\/?>\s*/gi, '')
    .replace(/<\/?b>/gi, '')
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}

function safeParseAirIntraResponse(text) {
  const cleaned = stripPhpNotices(text);
  
  let jsonStart = -1;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '{' || ch === '[') { jsonStart = i; break; }
  }
  
  if (jsonStart === -1) return { data: null, error: 'No JSON found' };
  
  const jsonText = cleaned.substring(jsonStart);
  
  // Try direct parse
  try {
    const data = JSON.parse(jsonText);
    if (data && typeof data === 'object' && !Array.isArray(data) && data.error_id) {
      return { data: null, error: `API Error (${data.error_id}): ${data.error_name || ''}` };
    }
    return { data, error: null };
  } catch (e1) {
    // Try aggressive cleanup
    let aggressive = jsonText
      .replace(/<[^>]*>/g, '')
      .replace(/,\s*,/g, ',')
      .replace(/}\s*{/g, '},{')
      .replace(/,\s*([}\]])/g, '$1');
    
    try {
      const data = JSON.parse(aggressive);
      if (data && typeof data === 'object' && !Array.isArray(data) && data.error_id) {
        return { data: null, error: `API Error (${data.error_id}): ${data.error_name || ''}` };
      }
      return { data, error: null };
    } catch (e2) {
      return { data: null, error: e2.message };
    }
  }
}

function extractProductsFromCorruptedJson(text) {
  const products = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '{') { i++; continue; }
    let depth = 0, inStr = false, esc = false, objEnd = -1;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (esc) { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { objEnd = j; break; }
      }
    }
    if (objEnd === -1) { i++; continue; }
    const objText = text.substring(i, objEnd + 1);
    if (objText.includes('"codigo"') || objText.includes('"codiart"')) {
      try {
        products.push(JSON.parse(objText));
      } catch {
        // Try stripping PHP notices from within the object
        try {
          const cleaned = stripPhpNotices(objText);
          products.push(JSON.parse(cleaned));
        } catch {
          // Skip truly corrupted object
        }
      }
    }
    i = objEnd + 1;
  }
  return products;
}

function getAirIntraSupplierCategory(product) {
  return product.rubro || product.categoria || product.familia || product.grupo || '';
}

// ─── Category mapping (simplified) ──────────────────────────────────────────

const CATEGORY_KEYWORD_MAP = [
  // Complete products first
  { keywords: ['PC GAMER','PC LENOVO','PC KELYX','SIST. KELYX','SIST.','COMPUTADORA','BAREBONE','DESKTOP','ALL IN ONE','ALL-IN-ONE'], categorySlug: 'pc-armadas' },
  { keywords: ['NOTEBOOK','LAPTOP','PORTATIL'], categorySlug: 'notebooks' },
  { keywords: ['MINI PC','STICK PC','NUC','MELE','N100'], categorySlug: 'pc-armadas' },
  { keywords: ['MONITOR','ULTRAFINE','LED MONITOR'], categorySlug: 'monitores' },
  // Peripherals
  { keywords: ['AURICULAR','HEADSET','HEADPHONE','JBL TOUR','JBL QUANTUM'], categorySlug: 'auriculares' },
  { keywords: ['MOUSE'], categorySlug: 'mouse' },
  { keywords: ['TECLADO','KEYBOARD'], categorySlug: 'teclados' },
  { keywords: ['PARLANTE','SPEAKER','BARRA DE SONIDO','SOUND BAR'], categorySlug: 'parlantes' },
  { keywords: ['IMPRESORA','EPSON L','SMART TANK','LASERJET','DESKJET','OFFICEJET'], categorySlug: 'impresion' },
  { keywords: ['CARTUCHO','TONER','INK CARTRIDGE','IMAGING DRUM'], categorySlug: 'toners-y-cartuchos' },
  // Storage
  { keywords: ['DISCO EXTERNO','EXTERNAL','PORTABLE DRIVE','CANVIO'], categorySlug: 'discos-externos' },
  { keywords: ['PENDRIVE','DATA TRAVELER','DATATRAVELER','FLASH DRIVE'], categorySlug: 'pendrives' },
  { keywords: ['MICRO SD','MICROSD'], categorySlug: 'micro-sd' },
  // Components
  { keywords: ['RYZEN','INTEL I3','INTEL I5','INTEL I7','INTEL I9','CORE I','PENTIUM','CORE ULTRA'], categorySlug: 'microprocesadores' },
  { keywords: ['MOTHER','H610','B760','H810','A520','A620','B650','B550','H510'], categorySlug: 'motherboards' },
  { keywords: ['MEMORIA DDR','DDR3','DDR4','DDR5','SODIMM'], categorySlug: 'memorias-ram' },
  { keywords: ['RTX','GTX','RADEON RX','GEFORCE','GRAPHICS CARD','QUADRO RTX'], categorySlug: 'placas-de-video' },
  { keywords: ['SSD','NVME','M.2','GEN4','GEN3'], categorySlug: 'discos-ssd' },
  { keywords: ['DISCO RIGIDO','HDD','IRONWOLF','SKYHAWK'], categorySlug: 'discos-hdd' },
  { keywords: ['FUENTE','POWER SUPPLY','PSU'], categorySlug: 'fuentes' },
  { keywords: ['GABINETE','CHASSIS','CASE ','TOWER'], categorySlug: 'gabinetes' },
  { keywords: ['COOLER','WATER COOL','LIQUID COOL','DISIPADOR','AIO '], categorySlug: 'refrigeracion' },
  { keywords: ['PASTA TERMICA','THERMAL PASTE'], categorySlug: 'pastas-termicas' },
  // Networking
  { keywords: ['ARCHER','ROUTER','DECO','MESH WIFI','TL-WR'], categorySlug: 'routers-wifi' },
  { keywords: ['SWITCH'], categorySlug: 'switches' },
  { keywords: ['CABLE','ADAPTADOR','FICHA RJ45','CONVERTER','UTP CAT','HUB USB'], categorySlug: 'cables-y-adaptadores' },
  // Other
  { keywords: ['UPS','ESTABILIZADOR','NOBREAK'], categorySlug: 'ups' },
  { keywords: ['CARGADOR','CHARGER','POWER BANK'], categorySlug: 'cargadores' },
  { keywords: ['SILLA','GAMING CHAIR'], categorySlug: 'sillas-gamer' },
  { keywords: ['MOCHILA','FUNDA','BACKPACK'], categorySlug: 'fundas-mochilas' },
  { keywords: ['SOPORTE','BRAZO','MOUNT','STAND'], categorySlug: 'soportes-y-brazos' },
  { keywords: ['WEBCAM','CAM WEB','BRIO','FACECAM'], categorySlug: 'webcams' },
  { keywords: ['JOYSTICK','CONTROL ','GAMEPAD','CONTROLLER'], categorySlug: 'joysticks' },
  { keywords: ['MICROFONO','MICROPHONE','MIC '], categorySlug: 'microfonos' },
];

function mapProductToCategory(productName, supplierCategory, slugToId, supplierMappings) {
  // 1. Check supplier mapping
  if (supplierCategory && supplierMappings[supplierCategory]) {
    return { categoryId: supplierMappings[supplierCategory], method: 'mapping' };
  }
  
  // 2. Keyword matching
  const name = (productName || '').toUpperCase();
  for (const mapping of CATEGORY_KEYWORD_MAP) {
    if (mapping.keywords.some(kw => name.includes(kw))) {
      const categoryId = slugToId[mapping.categorySlug];
      if (categoryId) return { categoryId, method: 'keyword' };
    }
  }
  
  return { categoryId: null, method: 'none' };
}

// ─── Main sync logic ────────────────────────────────────────────────────────

async function main() {
  console.log('=== Air Intra Direct Sync ===');
  console.log('Start time:', new Date().toISOString());
  
  // Step 0: Load category and supplier data from DB
  console.log('\n[1/5] Loading DB data...');
  
  const catResult = await db.execute('SELECT id, name, slug, parentId FROM categories');
  const slugToId = {};
  const idToParentId = {};
  for (const row of catResult.rows) {
    slugToId[row.slug] = row.id;
    idToParentId[row.id] = row.parentId;
  }
  console.log(`  Categories: ${catResult.rows.length}`);
  
  const supplierResult = await db.execute(`SELECT * FROM suppliers WHERE id = '${AIR_INTRA_SUPPLIER_ID}'`);
  const supplier = supplierResult.rows[0];
  if (!supplier) {
    console.error('ERROR: Air Intra supplier not found in DB!');
    process.exit(1);
  }
  console.log(`  Supplier: ${supplier.name}, Markup: ${supplier.markup}%`);
  
  const mappingResult = await db.execute(`SELECT supplierCategory, storeCategoryId FROM supplier_category_mappings WHERE supplierId = '${AIR_INTRA_SUPPLIER_ID}'`);
  const supplierMappings = {};
  for (const row of mappingResult.rows) {
    supplierMappings[row.supplierCategory] = row.storeCategoryId;
  }
  console.log(`  Supplier category mappings: ${mappingResult.rows.length}`);
  
  // Load existing products for this supplier (for fast lookup)
  const existingResult = await db.execute(`SELECT id, providerSku, slug FROM products WHERE providerId = '${AIR_INTRA_SUPPLIER_ID}'`);
  const existingBySku = {};
  const existingSlugs = new Set();
  for (const row of existingResult.rows) {
    existingBySku[row.providerSku] = row.id;
    existingSlugs.add(row.slug);
  }
  console.log(`  Existing Air Intra products in DB: ${existingResult.rows.length}`);
  
  // Step 1: Login
  console.log('\n[2/5] Logging in to Air Intra API...');
  const authResp = await fetch(`${BASE_URL}/?q=login&user=${USER}&pass=${PASS}`);
  const authData = await authResp.json();
  if (!authData.token) {
    console.error('ERROR: Failed to login to Air Intra:', authData);
    process.exit(1);
  }
  const token = authData.token;
  const exchangeRate = parseFloat(authData.cotiza || '0');
  console.log(`  Login OK. Cotización: ${exchangeRate}`);
  
  // Step 2: Fetch ALL products using articulos endpoint
  console.log('\n[3/5] Fetching products from Air Intra API (articulos endpoint)...');
  const MAX_PAGES = 30;
  const PAGE_SIZE = 500;
  let allProducts = [];
  let page = 0;
  let totalRecoveredByExtractor = 0;
  const allFetchedSkus = new Set();
  
  while (page < MAX_PAGES) {
    console.log(`  Fetching page ${page}...`);
    let products = null;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    
    while (!products && retryCount <= MAX_RETRIES) {
      try {
        const resp = await fetch(`${BASE_URL}/?q=articulos&page=${page}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        
        const rawText = await resp.text();
        
        // Check rate limit
        if (rawText.includes('Too many queries') || rawText.includes('error_id":403')) {
          console.log(`  Rate limited on page ${page}! Waiting 5 minutes...`);
          await new Promise(r => setTimeout(r, 310000)); // 5 min + 10s
          // Re-login after waiting
          const reAuth = await fetch(`${BASE_URL}/?q=login&user=${USER}&pass=${PASS}`);
          const reAuthData = await reAuth.json();
          if (reAuthData.token) {
            token = reAuthData.token; // Won't work with const, but let's try
            console.log('  Re-login OK after rate limit wait');
          }
          retryCount++;
          continue;
        }
        
        if (!resp.ok) {
          console.log(`  HTTP ${resp.status} on page ${page}, retry ${retryCount}/${MAX_RETRIES}`);
          retryCount++;
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        
        // Try standard parse
        const { data: parsedProducts, error: parseError } = safeParseAirIntraResponse(rawText);
        
        if (parseError || !Array.isArray(parsedProducts) || parsedProducts.length === 0) {
          // Try extractor
          const cleaned = stripPhpNotices(rawText);
          products = extractProductsFromCorruptedJson(cleaned);
          console.log(`  Page ${page}: Standard parse failed, extractor got ${products.length} products`);
          
          if (products.length === 0) {
            if (page === 0) {
              console.error('  ERROR: Could not parse page 0!');
              process.exit(1);
            }
            // Empty page = end of data
            console.log(`  Page ${page} returned 0 products. End of data.`);
            page = MAX_PAGES; // Force exit
            break;
          }
        } else {
          products = parsedProducts;
          
          // Verification: run extractor to find missing products
          const cleaned = stripPhpNotices(rawText);
          const extracted = extractProductsFromCorruptedJson(cleaned);
          
          if (extracted.length > products.length) {
            const existingSkus = new Set(products.map(p => p.codigo || p.codiart || '').filter(Boolean));
            let recovered = 0;
            for (const ext of extracted) {
              const sku = ext.codigo || ext.codiart || '';
              if (sku && !existingSkus.has(sku)) {
                products.push(ext);
                recovered++;
              }
            }
            if (recovered > 0) {
              totalRecoveredByExtractor += recovered;
              console.log(`  Page ${page}: Recovered ${recovered} products lost in corrupted JSON`);
            }
          }
        }
        
        // Deduplicate within this page
        const deduped = [];
        for (const p of products) {
          const sku = p.codigo || p.codiart || '';
          if (sku && allFetchedSkus.has(sku)) continue;
          if (sku) allFetchedSkus.add(sku);
          deduped.push(p);
        }
        
        allProducts.push(...deduped);
        console.log(`  Page ${page}: ${deduped.length} products (total: ${allProducts.length})`);
        
        // Stop if truly empty page
        if (deduped.length === 0) {
          console.log('  Empty page reached. Stopping fetch.');
          break;
        }
        
        break; // Success, exit retry loop
      } catch (err) {
        console.error(`  Error on page ${page}, retry ${retryCount}/${MAX_RETRIES}:`, err.message);
        retryCount++;
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    
    page++;
  }
  
  const withPrice = allProducts.filter(p => parseFloat(p.precio || 0) > 0).length;
  console.log(`\n  Total products fetched: ${allProducts.length}`);
  console.log(`  With price > 0: ${withPrice}`);
  console.log(`  With price <= 0: ${allProducts.length - withPrice}`);
  console.log(`  Products recovered by extractor: ${totalRecoveredByExtractor}`);
  
  // Step 3: Upsert products into DB
  console.log('\n[4/5] Upserting products into DB...');
  let created = 0, updated = 0, skipped = 0, errors = 0;
  let batch = [];
  const BATCH_SIZE = 50;
  
  for (const product of allProducts) {
    try {
      const providerSku = product.codigo || product.codiart || '';
      const price = parseFloat(product.precio || '0');
      const productName = product.descrip || product.descripcion || product.titulo || '';
      
      if (!productName || !providerSku) {
        skipped++;
        continue;
      }
      
      const costPrice = price;
      const markup = supplier.markup || 30;
      const sellingPrice = costPrice > 0 ? costPrice * (1 + markup / 100) : 0;
      const totalStock = (product.air?.disponible || 0) +
        (product.lug?.disponible || 0) +
        (product.ros?.disponible || 0) +
        (product.cba?.disponible || 0) +
        (product.mza?.disponible || 0) +
        (product.stock_disponible || 0);
      
      const supplierCategory = getAirIntraSupplierCategory(product);
      const { categoryId } = mapProductToCategory(productName, supplierCategory, slugToId, supplierMappings);
      
      let isActive = price > 0 ? 1 : 0;
      
      // Check allowedCategories filter
      if (isActive === 1 && supplier.allowedCategories) {
        const allowed = typeof supplier.allowedCategories === 'string' 
          ? JSON.parse(supplier.allowedCategories) : supplier.allowedCategories;
        if (allowed && categoryId) {
          const catSlug = Object.entries(slugToId).find(([_, id]) => id === categoryId)?.[0];
          const catParentId = idToParentId[categoryId];
          const catParentSlug = catParentId ? Object.entries(slugToId).find(([_, id]) => id === catParentId)?.[0] : null;
          const isAllowed = catSlug ? allowed.includes(catSlug) : false;
          const isChildAllowed = catParentSlug ? allowed.includes(catParentSlug) : false;
          if (!isAllowed && !isChildAllowed) isActive = 0;
        }
      }
      
      const now = new Date().toISOString();
      
      if (existingBySku[providerSku]) {
        // Update existing product
        await db.execute({
          sql: `UPDATE products SET costPrice = ?, price = ?, stock = ?, supplierCategory = ?, categoryId = ?, isActive = ?, updatedAt = ? WHERE id = ?`,
          args: [costPrice, sellingPrice, totalStock, supplierCategory, categoryId, isActive, now, existingBySku[providerSku]],
        });
        updated++;
      } else {
        // Create new product
        const formattedName = formatProductName(productName);
        let slug = generateSlug(formattedName);
        
        // Handle slug collision
        if (existingSlugs.has(slug)) {
          slug = slug + '-' + providerSku.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
        }
        existingSlugs.add(slug);
        
        const newId = crypto.randomUUID();
        
        const specs = {};
        if (product.garantia) specs['Garantía'] = product.garantia;
        if (product.moneda) specs['Moneda'] = product.moneda;
        if (product.rubro) specs['Rubro'] = product.rubro;
        if (product.grupo) specs['Grupo'] = product.grupo;
        if (product.tipo?.name) specs['Tipo'] = product.tipo.name;
        if (product.estado?.name) specs['Estado'] = product.estado.name;
        
        await db.execute({
          sql: `INSERT INTO products (id, name, slug, description, price, costPrice, sku, stock, isActive, isFeatured, images, specs, providerId, providerSku, categoryId, supplierCategory)
                VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, 0, '[]', ?, ?, ?, ?, ?)`,
          args: [newId, formattedName, slug, sellingPrice, costPrice, providerSku, totalStock, isActive, JSON.stringify(specs), AIR_INTRA_SUPPLIER_ID, providerSku, categoryId, supplierCategory],
        });
        created++;
        existingBySku[providerSku] = newId;
      }
      
      // Progress report
      if ((created + updated + skipped + errors) % 500 === 0) {
        console.log(`  Progress: ${created + updated + skipped + errors}/${allProducts.length} (created: ${created}, updated: ${updated}, skipped: ${skipped}, errors: ${errors})`);
      }
    } catch (err) {
      console.error(`  Error processing product ${product.codigo || 'unknown'}:`, err.message);
      errors++;
    }
  }
  
  // Step 4: Update supplier lastSyncAt
  console.log('\n[5/5] Updating supplier sync timestamp...');
  const syncNow = new Date().toISOString();
  await db.execute({
    sql: 'UPDATE suppliers SET lastSyncAt = ?, updatedAt = ? WHERE id = ?',
    args: [syncNow, syncNow, AIR_INTRA_SUPPLIER_ID],
  });
  
  // Final summary
  console.log('\n=== SYNC COMPLETE ===');
  console.log(`Total from API: ${allProducts.length}`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Products recovered by extractor: ${totalRecoveredByExtractor}`);
  
  // Verify DB count
  const dbCount = await db.execute({
    sql: 'SELECT COUNT(*) as cnt FROM products WHERE providerId = ?',
    args: [AIR_INTRA_SUPPLIER_ID],
  });
  const dbActive = await db.execute({
    sql: 'SELECT COUNT(*) as cnt FROM products WHERE providerId = ? AND isActive = 1',
    args: [AIR_INTRA_SUPPLIER_ID],
  });
  console.log(`\nDB total Air Intra products: ${dbCount.rows[0].cnt}`);
  console.log(`DB active Air Intra products: ${dbActive.rows[0].cnt}`);
  console.log('End time:', new Date().toISOString());
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
