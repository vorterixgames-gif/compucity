import { createClient } from '@libsql/client';

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw'
});

// ============================================
// CATEGORY KEYWORD MAP
// ============================================
const CATEGORY_KEYWORD_MAP = [
  ['auriculares', ['AURICULAR', 'HEADSET', 'HEADPHONE', 'JBL TOUR', 'JBL QUANTUM']],
  ['mouse', ['MOUSE']],
  ['teclados', ['TECLADO', 'KEYBOARD']],
  ['parlantes', ['PARLANTE', 'SPEAKER', 'BARRA DE SONIDO', 'SOUND BAR', 'PARTY LIGHT']],
  ['mousepads', ['MOUSEPAD', 'PAD GAMER', 'ALFOMBRILLA']],
  ['microfonos', ['MICROFONO', 'MICROPHONE']],
  ['webcams', ['WEBCAM', 'CAM WEB', 'WEB CAM', 'BRIO', 'FACECAM']],
  ['joysticks', ['JOYSTICK', 'GAMEPAD', 'CONTROLLER', 'GAME PAD', 'VOLANTE', 'G29', 'G923', 'F710']],
  ['kits-gamer', ['KIT GABINETE', 'KIT TECLADO', 'KIT GAMER']],
  ['toners-y-cartuchos', ['CARTUCHO', 'TONER', 'INK CARTRIDGE', 'IMAGING DRUM', 'PRINHEAD', 'BOTELLA DE TINTA']],
  ['impresion', ['IMPRESORA', 'SMART TANK', 'LASERJET', 'DESKJET', 'OFFICEJET', 'PROYECTOR EPSON']],
  ['memorias-ram', ['MEMORIA DDR', 'DDR3', 'DDR4', 'DDR5', 'SODIMM', 'CORSAIR MEMORY']],
  ['discos-ssd', ['SSD', 'NVME', 'M.2', 'GEN4', 'GEN3']],
  ['discos-hdd', ['DISCO RIGIDO', 'HDD', 'IRONWOLF', 'SKYHAWK']],
  ['discos-externos', ['DISCO EXTERNO', 'EXTERNAL', 'PORTABLE DRIVE', 'CANVIO', 'EXPANSION BLACK']],
  ['pendrives', ['PENDRIVE', 'DATA TRAVELER', 'DATATRAVELER', 'FLASH DRIVE', 'PEN DRIVE']],
  ['micro-sd', ['MICRO SD', 'MICROSD', 'SD CARD', 'MICRO MEMORY']],
  ['microprocesadores', ['RYZEN', 'INTEL I3', 'INTEL I5', 'INTEL I7', 'INTEL I9', 'CORE I', 'PENTIUM', 'CORE ULTRA']],
  ['motherboards', ['MOTHER', 'H610', 'B760', 'H810', 'A520', 'A620', 'B650', 'B550', 'H510']],
  ['placas-de-video', ['RTX', 'GTX', 'RADEON RX', 'GEFORCE', 'GRAPHICS CARD', 'QUADRO RTX']],
  ['fuentes', ['FUENTE', 'POWER SUPPLY', 'PSU']],
  ['gabinetes', ['GABINETE', 'CHASSIS', 'TOWER', 'BLAZE FORCE', 'INFINITY GLASS']],
  ['refrigeracion', ['COOLER', 'WATER COOL', 'LIQUID COOL', 'DISIPADOR', 'HEATSINK', 'SWAFAN', 'FAN COOLER', 'AIO']],
  ['pastas-termicas', ['PASTA TERMICA', 'THERMAL PASTE']],
  ['monitores', ['MONITOR', 'ULTRAFINE', 'LED MONITOR']],
  ['notebooks', ['NOTEBOOK', 'LAPTOP', 'PORTATIL']],
  ['routers-wifi', ['ARCHER', 'ROUTER', 'DECO', 'MESH WIFI', 'TL-WR']],
  ['switches', ['SWITCH']],
  ['placas-de-red', ['P.REDW', 'EAP', 'CPE', 'SFP', 'TL-WN', 'PREDW', 'RANGE EXTENDER']],
  ['cables-y-adaptadores', ['CABLE', 'ADAPTADOR', 'FICHA RJ45', 'CONVERTER', 'ROLLO', 'UTP CAT', 'HUB USB']],
  ['ups', ['UPS', 'ESTABILIZADOR', 'NOBREAK', 'SURGE PROTECTION']],
  ['cargadores', ['CARGADOR', 'CHARGER', 'POWER BANK']],
  ['sillas-gamer', ['SILLA', 'GAMING CHAIR']],
  ['soportes-y-brazos', ['SOPORTE', 'BRAZO', 'MOUNT', 'STAND MONITOR']],
  ['fundas-mochilas', ['MOCHILA', 'FUNDA', 'BACKPACK']],
  ['mini-pc', ['MINI PC', 'STICK PC']],
  ['bases', ['BASE CARGADORA', 'DOCK']],
  ['escritorios', ['ESCRITORIO', 'MESA GAMER']],
];

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
    { slug: 'ups', keywords: ['UPS', 'ESTABILIZADOR', 'NOBREAK', 'SURGE PROTECTION'] },
    { slug: 'cargadores', keywords: ['CARGADOR', 'CHARGER', 'POWER BANK'] },
    { slug: 'sillas-gamer', keywords: ['SILLA', 'GAMING CHAIR'] },
    { slug: 'escritorios', keywords: ['ESCRITORIO', 'MESA GAMER'] },
    { slug: 'fundas-mochilas', keywords: ['MOCHILA', 'FUNDA', 'BACKPACK'] },
    { slug: 'bases', keywords: ['BASE CARGADORA', 'DOCK'] },
  ],
};

function mapNameToCategory(name, slugToId, parentSlugToChildSlugs) {
  const nameUpper = name.toUpperCase();

  let matchedSlug = null;
  for (const [slug, keywords] of CATEGORY_KEYWORD_MAP) {
    for (const kw of keywords) {
      if (nameUpper.includes(kw)) {
        matchedSlug = slug;
        break;
      }
    }
    if (matchedSlug) break;
  }

  if (!matchedSlug) return null;

  // Corrections
  if (matchedSlug === 'microprocesadores' && nameUpper.includes('MOTHER')) matchedSlug = 'motherboards';
  if (['placas-de-video', 'memorias-ram', 'discos-ssd'].includes(matchedSlug) && nameUpper.includes('NOTEBOOK')) matchedSlug = 'notebooks';
  if (matchedSlug === 'notebooks' && nameUpper.includes('BASE NOTEBOOK')) matchedSlug = 'bases';

  // Subcategory refinement
  if (SUBCATEGORY_RULES[matchedSlug]) {
    for (const sub of SUBCATEGORY_RULES[matchedSlug]) {
      for (const kw of sub.keywords) {
        if (nameUpper.includes(kw)) {
          matchedSlug = sub.slug;
          break;
        }
      }
      // Check if we already changed
      if (!slugToId.has(matchedSlug) || parentSlugToChildSlugs.get(matchedSlug) === undefined) {
        // It's been changed to a child, stop
        break;
      }
    }
  }

  // Also check parent with child slugs
  if (parentSlugToChildSlugs.has(matchedSlug)) {
    const childSlugs = parentSlugToChildSlugs.get(matchedSlug);
    if (SUBCATEGORY_RULES[matchedSlug]) {
      for (const rule of SUBCATEGORY_RULES[matchedSlug]) {
        for (const kw of rule.keywords) {
          if (nameUpper.includes(kw) && childSlugs.includes(rule.slug)) {
            matchedSlug = rule.slug;
            break;
          }
        }
        if (slugToId.has(matchedSlug) && !parentSlugToChildSlugs.has(matchedSlug)) break;
      }
    }
  }

  return slugToId.get(matchedSlug) || null;
}

async function enrich() {
  console.log('Building category lookup...');
  const catResult = await db.execute('SELECT id, slug, parentId FROM categories');
  const slugToId = new Map();
  const parentSlugToChildSlugs = new Map();
  const idToSlug = new Map();
  const idToParentId = new Map();

  for (const row of catResult.rows) {
    slugToId.set(row.slug, row.id);
    idToSlug.set(row.id, row.slug);
    idToParentId.set(row.id, row.parentId);
  }

  // Build parent slug -> child slugs
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

  console.log(`Found ${slugToId.size} categories`);

  // ==========================================
  // STEP 1: Assign categories
  // ==========================================
  console.log('\n--- STEP 1: CATEGORY ENRICHMENT ---');
  const uncategorized = await db.execute(
    `SELECT id, name, providerSku, supplierCategory FROM products WHERE categoryId IS NULL`
  );
  const rows = uncategorized.rows;
  console.log(`Found ${rows.length} products without category`);

  let assigned = 0;
  let notMatched = 0;
  const unmatched = [];

  for (const product of rows) {
    const categoryId = mapNameToCategory(product.name, slugToId, parentSlugToChildSlugs);
    if (categoryId) {
      await db.execute({
        sql: "UPDATE products SET categoryId = ?, updatedAt = datetime('now') WHERE id = ?",
        args: [categoryId, product.id],
      });
      assigned++;
    } else {
      notMatched++;
      if (unmatched.length < 50) {
        unmatched.push(product.name);
      }
    }
  }

  console.log(`Categories assigned: ${assigned}`);
  console.log(`No match found: ${notMatched}`);
  if (unmatched.length > 0) {
    console.log('\nSample unmatched products:');
    unmatched.forEach(n => console.log(`  - ${n}`));
  }

  // ==========================================
  // STEP 2: Fix null createdAt
  // ==========================================
  console.log('\n--- STEP 2: FIX NULL CREATED AT ---');
  const dateResult = await db.execute(
    `UPDATE products SET createdAt = COALESCE(createdAt, updatedAt, datetime('now')) WHERE createdAt IS NULL`
  );
  console.log(`Fixed ${dateResult.rowsAffected} products with null createdAt`);

  // ==========================================
  // STEP 3: Stats after enrichment
  // ==========================================
  console.log('\n--- STEP 3: POST-ENRICHMENT STATS ---');
  const [
    stillUncategorized,
    withoutImages,
    totalProducts,
    visibleProducts,
  ] = await Promise.all([
    db.execute(`SELECT COUNT(*) as count FROM products WHERE categoryId IS NULL`),
    db.execute(`SELECT COUNT(*) as count FROM products WHERE (images = '[]' OR images IS NULL)`),
    db.execute(`SELECT COUNT(*) as count FROM products`),
    db.execute(`SELECT COUNT(*) as count FROM products WHERE isActive = 1 AND stock > 0 AND categoryId IS NOT NULL`),
  ]);

  console.log(`Total products: ${totalProducts.rows[0].count}`);
  console.log(`Still uncategorized: ${stillUncategorized.rows[0].count}`);
  console.log(`Without images: ${withoutImages.rows[0].count}`);
  console.log(`Visible in store: ${visibleProducts.rows[0].count}`);

  process.exit(0);
}

enrich().catch(e => { console.error(e); process.exit(1); });
