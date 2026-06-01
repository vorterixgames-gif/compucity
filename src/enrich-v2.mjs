import { createClient } from '@libsql/client';

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw'
});

// Build category lookup
const catResult = await db.execute('SELECT id, slug, parentId FROM categories');
const slugToId = new Map();
const idToSlug = new Map();
const idToParentId = new Map();
const parentSlugToChildSlugs = new Map();

for (const row of catResult.rows) {
  slugToId.set(row.slug, row.id);
  idToSlug.set(row.id, row.slug);
  idToParentId.set(row.id, row.parentId);
}
for (const row of catResult.rows) {
  if (row.parentId) {
    const parentSlug = idToSlug.get(row.parentId);
    if (parentSlug) {
      const children = parentSlugToChildSlugs.get(parentSlug) || [];
      children.push(row.slug);
      parentSlugToChildSlugs.set(parentSlug, children);
    }
  }
}

// Comprehensive keyword matching — order matters, first match wins
const KEYWORD_MAP = [
  // === PERIFERICOS ===
  ['auriculares', ['AURICULAR', 'HEADSET', 'HEADPHONE', 'JBL TOUR', 'JBL QUANTUM']],
  ['mouse', ['MOUSE']],
  ['teclados', ['TECLADO', 'KEYBOARD']],
  ['parlantes', ['PARLANTE', 'SPEAKER', 'BARRA DE SONIDO', 'SOUND BAR', 'PARTY LIGHT']],
  ['mousepads', ['MOUSEPAD', 'PAD GAMER', 'ALFOMBRILLA']],
  ['microfonos', ['MICROFONO', 'MICROPHONE']],
  ['webcams', ['WEBCAM', 'CAM WEB', 'WEB CAM', 'BRIO', 'FACECAM']],
  ['joysticks', ['JOYSTICK', 'GAMEPAD', 'CONTROLLER', 'GAME PAD', 'VOLANTE', 'G29', 'G923', 'F710']],
  ['kits-gamer', ['KIT GABINETE', 'KIT TECLADO', 'KIT GAMER']],
  
  // === IMPRESION / TONERS ===
  ['toners-y-cartuchos', ['CARTUCHO', 'TONER', 'INK CARTRIDGE', 'IMAGING DRUM', 'PRINHEAD', 'BOTELLA DE TINTA', 'EPSON T5', 'EPSON T6', 'EPSON T4', 'EPSON T664', 'EPSON T504', 'EPSON T534', 'EPSON T544', 'EPSON T574', 'EPSON T49H', 'BROTHER BT-', 'BROTHER TN-', 'BROTHER LC-', 'HP 9', 'HP 772', 'HP 550', 'C4801', 'C4815', 'C4816', 'C4837', 'C6628', 'C6658', 'CN621', 'CN624', 'CN631', 'CF404', 'MLT-', 'NEGRO P/L', 'CYAN P/L', 'MAGENTA P/L', 'AMARILLO P/L']],
  ['impresion', ['IMPRESORA', 'SMART TANK', 'LASERJET', 'DESKJET', 'OFFICEJET', 'PROYECTOR EPSON']],
  
  // === COMPONENTES ===
  ['memorias-ram', ['MEMORIA DDR', 'DDR3', 'DDR4', 'DDR5', 'SODIMM', 'CORSAIR MEMORY', 'RAM DDR', 'SIMM DE']],
  ['discos-ssd', ['SSD', 'NVME', 'M.2', 'GEN4', 'GEN3', 'DISCO SSD']],
  ['discos-hdd', ['DISCO RIGIDO', 'HDD', 'IRONWOLF', 'SKYHAWK', 'DISCO INTERNO']],
  ['microprocesadores', ['RYZEN', 'INTEL I3', 'INTEL I5', 'INTEL I7', 'INTEL I9', 'CORE I', 'PENTIUM', 'CORE ULTRA', 'PROCESADOR']],
  ['motherboards', ['MOTHER', 'H610', 'B760', 'H810', 'A520', 'A620', 'B650', 'B550', 'H510', 'PLACA BASE']],
  ['placas-de-video', ['RTX', 'GTX', 'RADEON RX', 'GEFORCE', 'GRAPHICS CARD', 'QUADRO RTX', 'PLACA DE VIDEO']],
  ['fuentes', ['FUENTE', 'POWER SUPPLY', 'PSU', '600W', '700W', '800W', 'FTE']],
  ['gabinetes', ['GABINETE', 'CHASSIS', 'GAB ', 'GAB.', 'TOWER', 'BLAZE FORCE', 'INFINITY GLASS', 'GAMEMAX', 'ARKHAM', 'THERMALTAKE VERSA']],
  ['refrigeracion', ['COOLER', 'WATER COOL', 'LIQUID COOL', 'DISIPADOR', 'HEATSINK', 'SWAFAN', 'FAN COOLER', 'AIO']],
  ['pastas-termicas', ['PASTA TERMICA', 'THERMAL PASTE']],
  
  // === MONITORES ===
  ['monitores', ['MONITOR', 'ULTRAFINE', 'LED MONITOR', 'LCD PANEL', 'DISPLAY PORT']],
  
  // === NOTEBOOKS ===
  ['notebooks', ['NOTEBOOK', 'LAPTOP', 'PORTATIL', 'NB HP', 'NB LENOVO', 'NB DELL', 'NB ASUS']],
  
  // === CONECTIVIDAD Y REDES ===
  ['routers-wifi', ['ARCHER', 'ROUTER', 'DECO', 'MESH WIFI', 'TL-WR', 'DE RANGO', 'RANGE EXTENDER', 'REPEATER']],
  ['switches', ['SWITCH']],
  ['placas-de-red', ['P.REDW', 'EAP', 'CPE', 'SFP', 'TL-WN', 'PREDW', 'RED PCI-E', 'RED USB', 'RED PCIE', 'PLACA DE RED', 'TP-LINK WN', 'TP-LINK TG']],
  ['cables-y-adaptadores', ['CABLE', 'ADAPTADOR', 'FICHA RJ45', 'CONVERTER', 'ROLLO', 'UTP CAT', 'HUB USB', 'CAT.5E', 'CAT.6', 'CAT.5', 'RJ45', 'GLC CAT', 'PLUG RJ', 'HDMI', 'DISPLAYPORT', 'USB-C', 'USBC', 'HUB GENIUS']],
  
  // === ALMACENAMIENTO EXTERNO ===
  ['discos-externos', ['DISCO EXTERNO', 'EXTERNAL', 'PORTABLE DRIVE', 'CANVIO', 'EXPANSION BLACK', 'WD ELEMENTS', 'WD MY PASSPORT', 'SEAGATE EXTERNO']],
  ['pendrives', ['PENDRIVE', 'DATA TRAVELER', 'DATATRAVELER', 'FLASH DRIVE', 'PEN DRIVE']],
  ['micro-sd', ['MICRO SD', 'MICROSD', 'SD CARD', 'MICRO MEMORY']],
  
  // === ACCESORIOS ===
  ['ups', ['UPS', 'ESTABILIZADOR', 'NOBREAK', 'SURGE PROTECTION', 'APC ', 'TRANSFORMADOR DE AISLAMIENTO']],
  ['cargadores', ['CARGADOR', 'CHARGER', 'POWER BANK']],
  ['sillas-gamer', ['SILLA', 'GAMING CHAIR']],
  ['soportes-y-brazos', ['SOPORTE', 'BRAZO', 'MOUNT', 'STAND MONITOR', 'VESA']],
  ['fundas-mochilas', ['MOCHILA', 'FUNDA', 'BACKPACK']],
  ['mini-pc', ['MINI PC', 'STICK PC']],
  ['bases', ['BASE CARGADORA', 'DOCK', 'BASE NOTEBOOK']],
  ['escritorios', ['ESCRITORIO', 'MESA GAMER']],
  
  // === BRAND-BASED matching for abbreviated names ===
  ['placas-de-red', ['TP-LINK WN7', 'TP-LINK WN8', 'TP-LINK TG-3']],
  ['routers-wifi', ['TP-LINK WA', 'TP-LINK RE', 'TP-LINK ARCHER']],
  ['toners-y-cartuchos', ['EPSON T664', 'EPSON T504', 'EPSON T544', 'EPSON T574', 'EPSON T49H', 'BROTHER BT-', 'BROTHER TN-']],
  ['gabinetes', ['GAB GAMEMAX', 'GAB ARKHAM', 'GAB PERF', 'GAB NZXT', 'GAB CORSAIR']],
  ['notebooks', ['NB HP ', 'NB LENOVO', 'NB DELL', 'NB BANGHO', 'NB ASUS ', 'NB ACER', 'NB MSI']],
  ['cables-y-adaptadores', ['CAT.5E', 'CAT.6', 'CAT.5', 'GLC CAT', 'PLUG RJ45']],
  
  // === SECURITY / CAMERAS (new - put in accesorios) ===
  ['cables-y-adaptadores', ['NVR', 'HILOOK', 'HIKVISION', 'EZVIZ', 'OCOM IMAGER', 'PROXIMIDAD EZVIZ', 'ROBOT EZVIZ']],
];

// Subcategory rules
const SUBCATEGORY_RULES = {
  'notebooks': [
    { slug: 'gamer', keywords: ['GAMER', 'GAMING', 'LOQ', 'LEGION', 'RTX', 'GEFORCE', 'RADEON', 'TUF GAMING', 'PREDATOR', 'NITRO'] },
    { slug: 'ultrabooks', keywords: ['SLIM', 'ULTRABOOK', 'IDEAPAD SLIM', 'BORDER ULTRA'] },
    { slug: 'diseno', keywords: ['TOUCH', 'XPS', 'SPECTRE', 'ZENBOOK'] },
    { slug: 'oficina', keywords: ['IDEAPAD', 'OFFICE', 'CONSUMO'] },
  ],
  'monitores': [
    { slug: 'gamer-mon', keywords: ['ULTRAGEAR', 'GAMER', 'GAMING', '144HZ', '165HZ', '180HZ', '200HZ', '240HZ', '1MS', '0.5MS', 'FREESYNC', 'G-SYNC', 'CURVO', 'OLED'] },
    { slug: 'diseno-mon', keywords: ['ULTRAFINE', 'ERGO', 'THUNDERBOLT', 'DUAL ERGO'] },
    { slug: 'soportes-y-brazos', keywords: ['SOPORTE', 'BRAZO', 'MOUNT', 'STAND MONITOR'] },
    { slug: 'oficina-mon', keywords: ['MONITOR', 'LED', 'HDMI', 'FULL HD', 'CORPORATIVO'] },
  ],
  'pc-armadas': [
    { slug: 'gamer-pc', keywords: ['GAMER', 'GAMING', 'PC GAMER', 'RTX', 'GEFORCE', 'RADEON'] },
    { slug: 'mini-pc', keywords: ['MINI PC', 'STICK PC', 'NUC', 'N100'] },
    { slug: 'diseno-pc', keywords: ['DESIGN', 'CREATOR', 'STUDIO'] },
    { slug: 'oficina-pc', keywords: ['SIST.', 'KELYX', 'OFFICE', 'OFICINA'] },
  ],
  'accesorios': [
    { slug: 'ups', keywords: ['UPS', 'ESTABILIZADOR', 'NOBREAK', 'SURGE PROTECTION', 'APC'] },
    { slug: 'cargadores', keywords: ['CARGADOR', 'CHARGER', 'POWER BANK'] },
    { slug: 'sillas-gamer', keywords: ['SILLA', 'GAMING CHAIR'] },
    { slug: 'escritorios', keywords: ['ESCRITORIO', 'MESA GAMER'] },
    { slug: 'fundas-mochilas', keywords: ['MOCHILA', 'FUNDA', 'BACKPACK'] },
    { slug: 'bases', keywords: ['BASE CARGADORA', 'DOCK'] },
  ],
};

// Non-IT products to deactivate
const NON_IT_KEYWORDS = [
  'WAHL', 'DE PELO', 'CORTADORA DE PELOS', 'HAIR TRIMMER', 'MONOPATIN', 'CELULAR', 'NOKIA',
  'PARA CELULARES', 'FILM PARA CELULARES', 'SMARTWATCH', 'WATCH PERFORMANCE',
  'PROD MKT', 'LABEL CX', 'RE-CONFIGURATION', 'ESPEJADO',
  'DE BILLETES', 'CONTADOR DE BILLETES', 'TV BOX',
  'HELADERA', 'LAVARROPAS', 'MICROONDAS', 'AIRE ACONDICIONADO',
  'TRANSPORTE PARA MONOPATIN', 'C/LLAVE PARA MONOPATIN',
];

function mapNameToCategory(name) {
  const nameUpper = name.toUpperCase();

  // Check if non-IT first
  for (const kw of NON_IT_KEYWORDS) {
    if (nameUpper.includes(kw)) {
      return { categoryId: null, isNonIT: true };
    }
  }

  // Keyword matching
  let matchedSlug = null;
  for (const [slug, keywords] of KEYWORD_MAP) {
    for (const kw of keywords) {
      if (nameUpper.includes(kw)) {
        matchedSlug = slug;
        break;
      }
    }
    if (matchedSlug) break;
  }

  if (!matchedSlug) return { categoryId: null, isNonIT: false };

  // Corrections
  if (matchedSlug === 'microprocesadores' && nameUpper.includes('MOTHER')) matchedSlug = 'motherboards';
  if (['placas-de-video', 'memorias-ram', 'discos-ssd'].includes(matchedSlug) && nameUpper.includes('NOTEBOOK')) matchedSlug = 'notebooks';
  if (matchedSlug === 'notebooks' && nameUpper.includes('BASE NOTEBOOK')) matchedSlug = 'bases';
  // APC switches/networking should go to networking, not UPS
  if (matchedSlug === 'ups' && (nameUpper.includes('SWITCH') || nameUpper.includes('RACK') || nameUpper.includes('SENSOR') || nameUpper.includes('CAMERA') || nameUpper.includes('MODBUS') || nameUpper.includes('NETBOTZ') || nameUpper.includes('NETSHELTER') || nameUpper.includes('LCD CONSOLE'))) {
    matchedSlug = 'cables-y-adaptadores';
  }
  // NVR/Cameras → cables-y-adaptadores (as a catch-all for networking/security)
  // Actually, let's check if the "gab" match is really a gabinete
  // "GAB" can also mean other things in Spanish abbreviations

  // Subcategory refinement
  if (SUBCATEGORY_RULES[matchedSlug]) {
    for (const sub of SUBCATEGORY_RULES[matchedSlug]) {
      for (const kw of sub.keywords) {
        if (nameUpper.includes(kw) && slugToId.has(sub.slug)) {
          matchedSlug = sub.slug;
          break;
        }
      }
      if (!SUBCATEGORY_RULES[matchedSlug] && slugToId.has(matchedSlug)) break;
    }
  }

  const categoryId = slugToId.get(matchedSlug);
  return { categoryId, isNonIT: false };
}

async function enrich() {
  console.log('=== COMPREHENSIVE ENRICHMENT V2 ===\n');

  const uncategorized = await db.execute(
    `SELECT id, name, providerSku, supplierCategory, stock, price FROM products WHERE categoryId IS NULL`
  );
  const rows = uncategorized.rows;
  console.log(`Total uncategorized products: ${rows.length}`);

  let assigned = 0;
  let deactivatedNonIT = 0;
  let notMatched = 0;
  const unmatchedSample = [];
  const assignedByCategory = {};

  for (const product of rows) {
    const result = mapNameToCategory(product.name);

    if (result.isNonIT) {
      // Deactivate non-IT products
      await db.execute({
        sql: "UPDATE products SET isActive = 0, updatedAt = datetime('now') WHERE id = ?",
        args: [product.id],
      });
      deactivatedNonIT++;
    } else if (result.categoryId) {
      await db.execute({
        sql: "UPDATE products SET categoryId = ?, updatedAt = datetime('now') WHERE id = ?",
        args: [result.categoryId, product.id],
      });
      assigned++;
      // Track by category
      const catSlug = idToSlug.get(result.categoryId) || 'unknown';
      assignedByCategory[catSlug] = (assignedByCategory[catSlug] || 0) + 1;
    } else {
      notMatched++;
      if (unmatchedSample.length < 40) {
        unmatchedSample.push(`[${product.stock > 0 ? 'STOCK' : 'NO-STOCK'}] ${product.name}`);
      }
    }
  }

  console.log(`\n--- RESULTS ---`);
  console.log(`Categories assigned: ${assigned}`);
  console.log(`Non-IT products deactivated: ${deactivatedNonIT}`);
  console.log(`Still unmatched: ${notMatched}`);

  console.log(`\n--- Assigned by category ---`);
  const sorted = Object.entries(assignedByCategory).sort((a,b) => b[1] - a[1]);
  for (const [cat, count] of sorted) {
    console.log(`  ${cat}: ${count}`);
  }

  if (unmatchedSample.length > 0) {
    console.log(`\n--- Sample unmatched products ---`);
    unmatchedSample.forEach(n => console.log(`  ${n}`));
  }

  // Post-enrichment stats
  const [stillUncategorized, visibleProducts, totalActive] = await Promise.all([
    db.execute(`SELECT COUNT(*) as c FROM products WHERE categoryId IS NULL`),
    db.execute(`SELECT COUNT(*) as c FROM products WHERE isActive = 1 AND stock > 0 AND categoryId IS NOT NULL`),
    db.execute(`SELECT COUNT(*) as c FROM products WHERE isActive = 1`),
  ]);
  console.log(`\n--- POST-ENRICHMENT STATS ---`);
  console.log(`Still uncategorized: ${stillUncategorized.rows[0].c}`);
  console.log(`Visible in store: ${visibleProducts.rows[0].c}`);
  console.log(`Total active: ${totalActive.rows[0].c}`);

  process.exit(0);
}

enrich().catch(e => { console.error(e); process.exit(1); });
