/**
 * Direct Elit supplier sync script - OPTIMIZED
 * Fetches all products from Elit API and upserts them into the DB
 * Uses in-memory lookup for existing products to minimize DB round-trips
 */

import { createClient } from '@libsql/client';

const DB_URL = 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io';
const DB_AUTH = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw';
const ELIT_SUPPLIER_ID = '97ee58ad-279b-48c4-907d-1db97ae9e15e';

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
];
for (const [k, v] of _entries) EXACT_CASE[k.toUpperCase()] = v;

const MINOR_WORDS = new Set(['de','del','la','el','en','con','sin','por','para','y','e','o','u','a','un','una','los','las','al']);

function smartFormat(str) {
  const tokens = str.split(/(\s+)/);
  let wordIndex = 0;
  return tokens.map(token => {
    if (/^\s+$/.test(token)) return token;
    if (!token) return token;
    const cleanUpper = token.toUpperCase().replace(/[.,:;!?()]/g, '');
    const lower = token.toLowerCase();
    if (EXACT_CASE[cleanUpper]) { wordIndex++; return EXACT_CASE[cleanUpper]; }
    const hasDigit = /\d/.test(token);
    const hasLetter = /[a-zA-Z]/.test(token);
    if (hasDigit && hasLetter && token.length >= 3) {
      let fixed = token;
      if (/^I(\d)([-\/]|$)/.test(fixed)) fixed = fixed.replace(/^I(\d)/, 'i$1');
      if (/^I(\d)$/.test(fixed)) fixed = fixed.replace(/^I(\d)/, 'i$1');
      wordIndex++; return fixed;
    }
    if (/^\d+$/.test(token)) { wordIndex++; return token; }
    if (/^\d+[\.\d]*["″]$/.test(token)) { wordIndex++; return token; }
    if (/^\([\d.GB+KkMm]+\)$/i.test(token)) { wordIndex++; return token.toUpperCase(); }
    if (wordIndex === 0) { wordIndex++; return lower.charAt(0).toUpperCase() + lower.slice(1); }
    if (MINOR_WORDS.has(lower)) { wordIndex++; return lower; }
    wordIndex++;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join('');
}

function formatProductName(raw) {
  let name = raw.trim();
  name = name.replace(/<[^>]+>/g, '');
  name = name.replace(/\s*\(Nuevo\s*PN\)/gi, '');
  name = name.replace(/\s*\(Nuevo\)/gi, '');
  name = name.replace(/\s*\(II\)/g, '');
  name = name.replace(/\s*\(\d{3,5}\)/g, '');
  name = name.replace(/^[A-Z0-9]{5,12}\s+/, '');
  name = name.replace(/^[A-Z]\d{4,5}\/?\s*[A-Z0-9]*\s*-\s*/, '');
  name = name.replace(/^[A-Z]\d{5,6}-/, '');
  name = name.replace(/^\d{3}-\d{6}\s*/, '');
  name = name.replace(/\bc\/\s*/g, 'con ');
  name = name.replace(/\bProces\.\s*/g, 'Procesador ');
  name = name.replace(/\(GIGA\)/g, '');
  name = name.replace(/PC FreeDOs/gi, 'PC FreeDOS');
  name = name.replace(/Teclado\+Mouse/g, 'Teclado y Mouse');
  name = name.replace(/\s{2,}/g, ' ');
  name = name.replace(/^[\s,.\-]+/, '');
  name = name.replace(/[\s,.\-]+$/, '');
  name = smartFormat(name).trim();
  if (/^(LG|HP) \d+ (LED|UltraGear|UltraWide|Dual)/.test(name) && !name.startsWith('Monitor'))
    name = 'Monitor ' + name;
  name = name.replace(/\bI(\d)\b/g, 'i$1');
  name = name.replace(/(\d+)\s*Gb\b/g, '$1GB');
  name = name.replace(/(\d+)\s*Mb\b/g, '$1MB');
  name = name.replace(/(\d+)\s*Tb\b/g, '$1TB');
  name = name.replace(/(\d+)g\b/g, '$1GB');
  name = name.replace(/\bRtx\b/g, 'RTX');
  name = name.replace(/(\d+)\s*Mm\b/g, '$1mm');
  name = name.replace(/\bC\/video\b/gi, 'con Video');
  name = name.replace(/\bPc\b/g, 'PC');
  name = name.replace(/\bMini Pc\b/g, 'Mini PC');
  name = name.replace(/\bLenovo Ip\b/g, 'Lenovo IP');
  name = name.replace(/\bLenovo Ic\b/g, 'Lenovo IC');
  return name.trim();
}

function generateSlug(name) {
  return name.toLowerCase()
    .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i').replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u').replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .substring(0, 120);
}

// ─── Category Mapping ────────────────────────────────────────────────────────

const SUBCATEGORY_RULES = [
  { parentSlug: 'notebooks', rules: [
    { keywords: ['TABLET','TABLETA','IDEA TAB','TAB PLUS','EASYPEN'], subcategorySlug: 'tablets' },
    { keywords: ['GAMER','GAMING','LOQ','LEGION','RTX','GEFORCE','RADEON','THIN 15','TUF GAMING','PREDATOR','NITRO'], subcategorySlug: 'gamer' },
    { keywords: ['SLIM','ULTRABOOK','IDEAPAD SLIM','BORDER ULTRA','IP SLIM'], subcategorySlug: 'ultrabooks' },
    { keywords: ['TOUCH','TOUCHSCREEN','IPS 300','PANTALLA TACTIL','XPS','SPECTRE','ZENBOOK'], subcategorySlug: 'diseno' },
    { keywords: ['IDEAPAD','250 G','255 G','KELYX','OFFICE','CONSUMO','FREE'], subcategorySlug: 'oficina' },
  ]},
  { parentSlug: 'monitores', rules: [
    { keywords: ['ULTRAGEAR','GAMER','GAMING','RAPTOR HAWK','144HZ','165HZ','180HZ','200HZ','240HZ','1MS','0.5MS','FREESYNC','G-SYNC','CURVO','OLED'], subcategorySlug: 'gamer-mon' },
    { keywords: ['ULTRAFINE','ERGO','4K USB-C','COLOR CALIBRATED','THUNDERBOLT','DUAL ERGO'], subcategorySlug: 'diseno-mon' },
    { keywords: ['SOPORTE','BRAZO','MOUNT','STAND MONITOR'], subcategorySlug: 'soportes-y-brazos' },
    { keywords: ['MONITOR','LED','HDMI','FULL HD','CORPORATIVO','CONSUMO'], subcategorySlug: 'oficina-mon' },
  ]},
  { parentSlug: 'pc-armadas', rules: [
    { keywords: ['GAMER','GAMING','PC GAMER','RTX','GEFORCE','RADEON'], subcategorySlug: 'gamer-pc' },
    { keywords: ['MINI PC','STICK PC','NUC','MELE','N100'], subcategorySlug: 'mini-pc' },
    { keywords: ['DESIGN','DISEÑO','CREATOR','STUDIO'], subcategorySlug: 'diseno-pc' },
    { keywords: ['SIST.','KELYX','OFFICE','OFICINA','PC'], subcategorySlug: 'oficina-pc' },
  ]},
  { parentSlug: 'accesorios', rules: [
    { keywords: ['TAPO','SMART HOME','SENSOR DE MOVIMIENTO','TIMBRE VIDEO','PARTY LIGHT','LUZ PROYECCION','BARRA DE LUZ','SMART PLUG','BOMBILLA INTELIGENTE'], subcategorySlug: 'smart-home' },
    { keywords: ['HELADERA','LAVARROPAS','AIRE ACONDICIONADO','ELECTRODOMESTICO','SMART INVERTER','INSTAVIEW'], subcategorySlug: 'hogar-inteligente' },
    { keywords: ['UPS','ESTABILIZADOR','NOBREAK','SURGE PROTECTION'], subcategorySlug: 'ups' },
    { keywords: ['CARGADOR','CHARGER','POWER BANK'], subcategorySlug: 'cargadores' },
    { keywords: ['SILLA','GAMING CHAIR'], subcategorySlug: 'sillas-gamer' },
    { keywords: ['ESCRITORIO','DESK ','MESA GAMER'], subcategorySlug: 'escritorios' },
    { keywords: ['MOCHILA','FUNDA','BACKPACK'], subcategorySlug: 'fundas-mochilas' },
    { keywords: ['BASE CARGADORA','DOCK'], subcategorySlug: 'bases' },
  ]},
];

const CATEGORY_KEYWORD_MAP = [
  { keywords: ['AURICULAR','HEADSET','HEADPHONE','JBL TOUR','JBL QUANTUM'], categorySlug: 'auriculares' },
  { keywords: ['MOUSE'], categorySlug: 'mouse' },
  { keywords: ['TECLADO','KEYBOARD'], categorySlug: 'teclados' },
  { keywords: ['PARLANTE','SPEAKER','BARRA DE SONIDO','SOUND BAR','PARTY LIGHT'], categorySlug: 'parlantes' },
  { keywords: ['MOUSEPAD','PAD GAMER','ALFOMBRILLA','PAD '], categorySlug: 'mousepads' },
  { keywords: ['MICROFONO','MICROPHONE','MIC '], categorySlug: 'microfonos' },
  { keywords: ['WEBCAM','CAM WEB','WEB CAM','BRIO','FACECAM'], categorySlug: 'webcams' },
  { keywords: ['JOYSTICK','CONTROL ','GAMEPAD','CONTROLLER','GAME PAD','VOLANTE','G29','G923','F710'], categorySlug: 'joysticks' },
  { keywords: ['KIT GABINETE','KIT TECLADO','KIT GAMER'], categorySlug: 'kits-gamer' },
  { keywords: ['CARTUCHO','TONER','INK CARTRIDGE','PRINT C','IMAGING DRUM','PRINHEAD','CART.','TINTA.','CART.NEGRO','CART.CYAN','CART.MAGENTA','CART.YELLOW','CART.AMARILLO','CART.LIGHT','BOTELLA DE TINTA','HP 935','HP 951','HP 126','HP 122'], categorySlug: 'toners-y-cartuchos' },
  { keywords: ['IMPRESORA','EPSON L','EPSON M','SMART TANK','LASERJET','DESKJET','OFFICEJET','PROYECTOR EPSON'], categorySlug: 'impresion' },
  { keywords: ['MEMORIA DDR','DDR3','DDR4','DDR5','SODIMM','CORSAIR MEMORY'], categorySlug: 'memorias-ram' },
  { keywords: ['SSD','NVME','M.2','GEN4','GEN3'], categorySlug: 'discos-ssd' },
  { keywords: ['DISCO RIGIDO','HDD','IRONWOLF','SKYHAWK','HD SEAGATE INTERNO','HD TOSHIBA INTERNO'], categorySlug: 'discos-hdd' },
  { keywords: ['DISCO EXTERNO','EXTERNAL','PORTABLE DRIVE','HD SEAGATE EXTERNO','HD TOSHIBA EXTERNO','CANVIO','EXPANSION BLACK'], categorySlug: 'discos-externos' },
  { keywords: ['PENDRIVE','DATA TRAVELER','DATATRAVELER','FLASH DRIVE','PEN DRIVE'], categorySlug: 'pendrives' },
  { keywords: ['MICRO SD','MICROSD','SD CARD','MICRO MEMORY'], categorySlug: 'micro-sd' },
  { keywords: ['RYZEN','INTEL I3','INTEL I5','INTEL I7','INTEL I9','CORE I','PENTIUM','CORE ULTRA'], categorySlug: 'microprocesadores' },
  { keywords: ['MOTHER','H610','B760','H810','A520','A620','B650','B550','H510'], categorySlug: 'motherboards' },
  { keywords: ['RTX','GTX','RADEON RX','GEFORCE','GRAPHICS CARD','QUADRO RTX'], categorySlug: 'placas-de-video' },
  { keywords: ['FUENTE','POWER SUPPLY','PSU'], categorySlug: 'fuentes' },
  { keywords: ['GABINETE','CHASSIS','CASE ','TOWER','CTE 550','5000T','4500X','BLAZE FORCE','INFINITY GLASS'], categorySlug: 'gabinetes' },
  { keywords: ['COOLER','WATER COOL','LIQUID COOL','DISIPADOR','HEATSINK','SWAFAN','FAN COOLER','ICUE LINK','AIO '], categorySlug: 'refrigeracion' },
  { keywords: ['PASTA TERMICA','THERMAL PASTE'], categorySlug: 'pastas-termicas' },
  { keywords: ['MONITOR','ULTRAFINE','LED MONITOR'], categorySlug: 'monitores' },
  { keywords: ['NOTEBOOK','LAPTOP','PORTATIL'], categorySlug: 'notebooks' },
  { keywords: ['ARCHER','ROUTER','DECO','MESH WIFI','TL-WR','ROU WI'], categorySlug: 'routers-wifi' },
  { keywords: ['SWITCH'], categorySlug: 'switches' },
  { keywords: ['P.REDW','EAP','CPE','SFP','TL-WN','PREDW','RANGE EXTENDER','TAPO C','CAMARA IP'], categorySlug: 'placas-de-red' },
  { keywords: ['CABLE','ADAPTADOR','FICHA RJ45','CONVERTER','ROLLO','UTP CAT','PROTECTOR KELYX','PROLONGADOR','HUB KELYX','HUB USB'], categorySlug: 'cables-y-adaptadores' },
  { keywords: ['UPS','ESTABILIZADOR','NOBREAK','SURGE PROTECTION'], categorySlug: 'ups' },
  { keywords: ['CARGADOR','CHARGER','POWER BANK'], categorySlug: 'cargadores' },
  { keywords: ['SILLA','GAMING CHAIR'], categorySlug: 'sillas-gamer' },
  { keywords: ['SOPORTE','BRAZO','MOUNT','STAND'], categorySlug: 'soportes-y-brazos' },
  { keywords: ['MOCHILA','FUNDA','BACKPACK'], categorySlug: 'fundas-mochilas' },
  { keywords: ['MINI PC','STICK PC'], categorySlug: 'mini-pc' },
  { keywords: ['BASE CARGADORA','DOCK'], categorySlug: 'bases' },
  { keywords: ['ESCRITORIO','DESK ','MESA GAMER'], categorySlug: 'escritorios' },
];

const CATEGORY_CORRECTIONS = [
  { nameKeyword: 'MOTHER', targetSlug: 'motherboards', sourceSlugs: ['microprocesadores'] },
  { nameKeyword: 'NOTEBOOK', targetSlug: 'notebooks', sourceSlugs: ['placas-de-video','memorias-ram','discos-ssd'] },
  { nameKeyword: 'BASE NOTEBOOK', targetSlug: 'bases', sourceSlugs: ['notebooks','gamer','oficina','ultrabooks','diseno'] },
];

function getElitSupplierCategory(product) {
  if (product.categoria && product.sub_categoria) return `${product.categoria} > ${product.sub_categoria}`;
  return product.categoria || product.rubro || product.familia || product.grupo || product.linea || '';
}

function mapProductToCategory(productName, supplierCategory, supplierMappings, slugToId, idToParentId, parentSlugToChildSlugs) {
  let matchedCategoryId = null;
  let method = 'none';

  if (supplierCategory && supplierMappings[supplierCategory]) {
    matchedCategoryId = supplierMappings[supplierCategory];
    method = 'mapping';
  }

  if (!matchedCategoryId) {
    const name = (productName || '').toUpperCase();
    for (const mapping of CATEGORY_KEYWORD_MAP) {
      if (mapping.keywords.some(kw => name.includes(kw))) {
        const catId = slugToId[mapping.categorySlug];
        if (catId) { matchedCategoryId = catId; method = 'keyword'; break; }
      }
    }
  }

  if (!matchedCategoryId) return { categoryId: null, method: 'none' };

  const upperName = (productName || '').toUpperCase();
  for (const correction of CATEGORY_CORRECTIONS) {
    if (upperName.includes(correction.nameKeyword)) {
      const currentSlug = Object.entries(slugToId).find(([_, id]) => id === matchedCategoryId)?.[0];
      if (currentSlug && correction.sourceSlugs.includes(currentSlug)) {
        const correctedId = slugToId[correction.targetSlug];
        if (correctedId) { matchedCategoryId = correctedId; method = method.includes('corrected') ? method : method + '+corrected'; }
      }
    }
  }

  const isParent = idToParentId[matchedCategoryId] === null || idToParentId[matchedCategoryId] === undefined;
  if (isParent) {
    let parentSlug = null;
    for (const [slug, id] of Object.entries(slugToId)) {
      if (id === matchedCategoryId) { parentSlug = slug; break; }
    }
    if (parentSlug && parentSlugToChildSlugs[parentSlug]?.length > 0) {
      const subRules = SUBCATEGORY_RULES.find(r => r.parentSlug === parentSlug);
      if (subRules) {
        const name = (productName || '').toUpperCase();
        const supplierCatUpper = (supplierCategory || '').toUpperCase();
        for (const rule of subRules.rules) {
          if (rule.keywords.some(kw => name.includes(kw)) || rule.keywords.some(kw => supplierCatUpper.includes(kw))) {
            const subcategoryId = slugToId[rule.subcategorySlug];
            if (subcategoryId) { matchedCategoryId = subcategoryId; method = method === 'mapping' ? 'mapping+sub' : 'keyword+sub'; break; }
          }
        }
      }
    }
  }

  return { categoryId: matchedCategoryId, method };
}

// ─── Main Sync ──────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Elit Direct Sync (Optimized) ===\n');
  const startTime = Date.now();

  // 1. Get supplier credentials
  const supplierResult = await db.execute({ sql: 'SELECT * FROM suppliers WHERE id = ?', args: [ELIT_SUPPLIER_ID] });
  const supplier = supplierResult.rows[0];
  if (!supplier) { console.error('ERROR: Supplier not found'); process.exit(1); }

  const userId = parseInt(supplier.apiUserId || '0');
  const apiToken = supplier.apiToken || '';
  const markup = supplier.markup || 30;
  const baseUrl = supplier.apiBaseUrl || 'https://clientes.elit.com.ar';

  if (!userId || !apiToken) { console.error('ERROR: Missing user_id or token'); process.exit(1); }

  console.log(`Supplier: ${supplier.name}, User ID: ${userId}, Markup: ${markup}%`);

  // 2. Build category lookups
  console.log('Building lookups...');
  const { slugToId, idToParentId, parentSlugToChildSlugs } = await buildCategoryLookup();
  const supplierMappings = await buildSupplierMappingLookup(ELIT_SUPPLIER_ID);
  console.log(`  Categories: ${Object.keys(slugToId).length}, Supplier mappings: ${Object.keys(supplierMappings).length}`);

  // 3. Pre-load ALL existing Elit product SKUs and ALL slugs into memory
  console.log('Loading existing products...');
  const existingResult = await db.execute({ sql: 'SELECT id, providerSku FROM products WHERE providerId = ?', args: [ELIT_SUPPLIER_ID] });
  const existingSkus = new Map();
  for (const row of existingResult.rows) {
    existingSkus.set(row.providerSku, row.id);
  }
  // Also load all existing slugs to avoid UNIQUE constraint failures
  const allSlugsResult = await db.execute('SELECT slug FROM products');
  const allSlugs = new Set();
  for (const row of allSlugsResult.rows) allSlugs.add(row.slug);
  console.log(`  Found ${existingSkus.size} existing Elit products, ${allSlugs.size} total slugs in DB`);

  // 4. Fetch ALL products from Elit API
  console.log('\nFetching all products from Elit API...');
  const allProducts = [];
  let offset = 1;
  const pageSize = 100;
  let totalApiProducts = 0;

  while (true) {
    const url = `${baseUrl}/v1/api/productos?limit=${pageSize}&offset=${offset}`;
    console.log(`  Fetching offset=${offset}...`);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, token: apiToken }),
      });

      if (!res.ok) {
        console.error(`  ERROR: HTTP ${res.status} at offset ${offset}`);
        break;
      }

      const data = await res.json();
      const products = data.resultado || [];
      totalApiProducts = data.paginador?.total || totalApiProducts;

      if (!Array.isArray(products) || products.length === 0) break;

      allProducts.push(...products);
      console.log(`    Got ${products.length} (total so far: ${allProducts.length}/${totalApiProducts})`);

      if (products.length < pageSize) break;
      offset += pageSize;
    } catch (err) {
      console.error(`  ERROR at offset ${offset}:`, err.message);
      break;
    }
  }

  console.log(`\nTotal products fetched from API: ${allProducts.length}`);

  // 5. Process and build DB operations
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const batchSize = 50;

  const updateStmts = [];
  const insertStmts = [];

  for (const product of allProducts) {
    try {
      const price = parseFloat(product.precio || '0');
      if (price <= 0) { skipped++; continue; }

      const providerSku = product.codigo_alfa || '';
      if (!providerSku) { skipped++; continue; }

      const costPrice = price;
      const sellingPrice = costPrice * (1 + markup / 100);
      const supplierCategory = getElitSupplierCategory(product);
      const stockTotal = parseInt(product.stock_total || '0');
      const productName = product.nombre || product.descripcion || '';

      const { categoryId } = mapProductToCategory(productName, supplierCategory, supplierMappings, slugToId, idToParentId, parentSlugToChildSlugs);

      const existingId = existingSkus.get(providerSku);

      if (existingId) {
        // UPDATE
        updateStmts.push({
          sql: `UPDATE products SET costPrice = ?, price = ?, stock = ?, supplierCategory = ?, categoryId = ?, updatedAt = ? WHERE id = ?`,
          args: [costPrice, sellingPrice, stockTotal, supplierCategory, categoryId, new Date().toISOString(), existingId],
        });
        updated++;
      } else {
        // INSERT
        if (!product.nombre) { skipped++; continue; }

        const newId = crypto.randomUUID();
        const formattedName = formatProductName(product.nombre);
        let slug = generateSlug(formattedName);
        // Ensure slug uniqueness by appending suffix if needed
        if (allSlugs.has(slug)) {
          let suffix = 2;
          while (allSlugs.has(`${slug}-${suffix}`)) suffix++;
          slug = `${slug}-${suffix}`;
        }
        allSlugs.add(slug);
        const images = Array.isArray(product.imagenes) && product.imagenes.length > 0 ? JSON.stringify(product.imagenes) : '[]';
        const specs = {};
        if (product.marca) specs['Marca'] = product.marca;
        if (product.ean) specs['EAN'] = String(product.ean);
        if (product.garantia) specs['Garantía'] = product.garantia;
        if (product.peso) specs['Peso'] = `${product.peso} kg`;
        if (product.gamer) specs['Gamer'] = 'Sí';

        insertStmts.push({
          sql: `INSERT INTO products (id, name, slug, description, price, comparePrice, costPrice, sku, stock, isActive, isFeatured, images, specs, providerId, providerSku, categoryId, supplierCategory) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            newId, formattedName, slug, product.descripcion || '',
            sellingPrice, product.pvp_usd ? parseFloat(product.pvp_usd) * (1 + markup / 100) : null,
            costPrice, providerSku, stockTotal, 1, 0, images, JSON.stringify(specs),
            ELIT_SUPPLIER_ID, providerSku, categoryId, supplierCategory,
          ],
        });
        created++;
      }
    } catch (err) {
      console.error(`  Error:`, err.message);
      errors++;
    }
  }

  // 6. Execute DB operations in batches
  console.log(`\nExecuting DB operations (${updateStmts.length} updates, ${insertStmts.length} inserts)...`);

  // Execute updates in batches
  for (let i = 0; i < updateStmts.length; i += batchSize) {
    const batch = updateStmts.slice(i, i + batchSize);
    try {
      await db.batch(batch.map(s => ({ sql: s.sql, args: s.args })));
    } catch (err) {
      console.error(`  Batch update error at ${i}:`, err.message);
      // Try one by one
      for (const stmt of batch) {
        try { await db.execute(stmt); } catch (e2) { errors++; }
      }
    }
    if ((i + batchSize) % 200 === 0 || i + batchSize >= updateStmts.length) {
      console.log(`    Updates: ${Math.min(i + batchSize, updateStmts.length)}/${updateStmts.length}`);
    }
  }

  // Execute inserts in batches
  for (let i = 0; i < insertStmts.length; i += batchSize) {
    const batch = insertStmts.slice(i, i + batchSize);
    try {
      await db.batch(batch.map(s => ({ sql: s.sql, args: s.args })));
    } catch (err) {
      console.error(`  Batch insert error at ${i}:`, err.message);
      // Try one by one
      for (const stmt of batch) {
        try { await db.execute(stmt); } catch (e2) {
          console.error(`    Insert error for SKU ${stmt.args[7]}:`, e2.message?.substring(0, 100));
          errors++;
        }
      }
    }
    if ((i + batchSize) % 200 === 0 || i + batchSize >= insertStmts.length) {
      console.log(`    Inserts: ${Math.min(i + batchSize, insertStmts.length)}/${insertStmts.length}`);
    }
  }

  // 7. Update lastSyncAt
  const syncNow = new Date().toISOString();
  await db.execute({ sql: 'UPDATE suppliers SET lastSyncAt = ?, updatedAt = ? WHERE id = ?', args: [syncNow, syncNow, ELIT_SUPPLIER_ID] });

  // 8. Count total Elit products in DB
  const countResult = await db.execute({ sql: 'SELECT COUNT(*) as total FROM products WHERE providerId = ?', args: [ELIT_SUPPLIER_ID] });
  const totalInDb = countResult.rows[0].total;

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n=== SYNC RESULTS ===');
  console.log(`Products fetched from API:  ${allProducts.length}`);
  console.log(`New products created:       ${created}`);
  console.log(`Existing products updated:  ${updated}`);
  console.log(`Skipped (no price/name):    ${skipped}`);
  console.log(`Errors:                     ${errors}`);
  console.log(`Total Elit products in DB:  ${totalInDb}`);
  console.log(`Time elapsed:               ${elapsed}s`);

  process.exit(0);
}

async function buildCategoryLookup() {
  const result = await db.execute('SELECT id, name, slug, parentId FROM categories');
  const slugToId = {};
  const idToParentId = {};
  const parentSlugToChildSlugs = {};
  for (const row of result.rows) {
    if (row.slug) slugToId[row.slug] = row.id;
    idToParentId[row.id] = row.parentId || null;
    if (row.parentId) {
      const parentRow = result.rows.find(r => r.id === row.parentId);
      if (parentRow?.slug) {
        if (!parentSlugToChildSlugs[parentRow.slug]) parentSlugToChildSlugs[parentRow.slug] = [];
        parentSlugToChildSlugs[parentRow.slug].push(row.slug);
      }
    }
  }
  return { slugToId, idToParentId, parentSlugToChildSlugs };
}

async function buildSupplierMappingLookup(supplierId) {
  const result = await db.execute({ sql: 'SELECT supplierCategory, storeCategoryId FROM supplier_category_mappings WHERE supplierId = ?', args: [supplierId] });
  const map = {};
  for (const row of result.rows) map[row.supplierCategory] = row.storeCategoryId;
  return map;
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
