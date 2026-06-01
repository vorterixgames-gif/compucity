import { createClient } from '@libsql/client';

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw'
});

// Get all uncategorized products
const result = await db.execute(
  `SELECT id, name, providerSku, supplierCategory, price, stock FROM products WHERE categoryId IS NULL ORDER BY name ASC`
);

const rows = result.rows;
console.log(`Total uncategorized: ${rows.length}`);

// Group by patterns
const patterns = {
  'toner_ink': [],
  'apc_ups': [],
  'hp_ink': [],
  'epson': [],
  'cable_adapter': [],
  'nokia_cellphone': [],
  'wahl_hair': [],
  'herramientas': [],
  'lcd_panel': [],
  'software': [],
  'scanner': [],
  'prod_mkt': [],
  'label': [],
  'other': [],
};

for (const r of rows) {
  const n = r.name.toUpperCase();
  if (n.includes('EPSON') && (n.includes('T664') || n.includes('T694') || n.includes('NEGRO') || n.includes('CYAN') || n.includes('MAGENTA') || n.includes('AMARILLO') || n.includes('TINTA') || n.includes('CARTUCHO') || n.includes('TONER'))) {
    patterns.toner_ink.push(r.name);
  } else if (n.includes('APC') || n.includes('TRANSFORMADOR') || n.includes('ESTABILIZADOR') || n.includes('NOBREAK') || n.includes('UPS')) {
    patterns.apc_ups.push(r.name);
  } else if (n.includes('HP') && (n.includes('CART') || n.includes('C48') || n.includes('C38') || n.includes('CNR') || n.includes('C66') || n.includes('C47') || n.includes('MLT') || n.includes('CE') || n.includes('CF') || n.includes('CN'))) {
    patterns.hp_ink.push(r.name);
  } else if (n.includes('WAHL') || n.includes('DE PELO') || n.includes('CORTE')) {
    patterns.wahl_hair.push(r.name);
  } else if (n.includes('CELULAR') || n.includes('NOKIA') || n.includes('SAMSUNG') && n.includes('ABONO')) {
    patterns.nokia_cellphone.push(r.name);
  } else if (n.includes('KIT DE HERRAMIENTAS') || n.includes('HERRAMIENTA')) {
    patterns.herramientas.push(r.name);
  } else if (n.includes('LCD PANEL') || n.includes('LED SLIM') || n.includes('CCFL') || n.includes('PINES')) {
    patterns.lcd_panel.push(r.name);
  } else if (n.includes('SOFTWARE') || n.includes('DE SOFT') || n.includes('VIRUS')) {
    patterns.software.push(r.name);
  } else if (n.includes('SCANNER') || n.includes('DE SCANNER')) {
    patterns.scanner.push(r.name);
  } else if (n.includes('PROD MKT') || n.includes('LABEL CX') || n.includes('RE-CONFIGURATION')) {
    patterns.prod_mkt.push(r.name);
  } else if (n.includes('CABLE') || n.includes('ADAPTADOR') || n.includes('FICHA') || n.includes('CONVERTER')) {
    patterns.cable_adapter.push(r.name);
  } else {
    patterns.other.push(r.name);
  }
}

for (const [key, items] of Object.entries(patterns)) {
  console.log(`\n=== ${key} (${items.length}) ===`);
  items.slice(0, 15).forEach(n => console.log(`  ${n}`));
  if (items.length > 15) console.log(`  ... and ${items.length - 15} more`);
}

process.exit(0);
