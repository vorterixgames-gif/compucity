import { createClient } from '@libsql/client';
import { randomUUID } from 'crypto';

const client = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw',
});

async function main() {
  console.log('=== Step 1: Fetching categories ===\n');
  const catResult = await client.execute('SELECT id, slug, name, parentId FROM categories');
  const categoryMap = {};
  for (const row of catResult.rows) {
    categoryMap[row.slug] = row.id;
    console.log(`  ${row.slug} => ${row.id} (${row.name}, parentId=${row.parentId})`);
  }

  console.log('\n=== Step 2: Applying fixes ===\n');

  // A. Move 22 switches from PC Armadas (and subcategories) → Switches
  {
    const sql = `
      UPDATE products SET categoryId = (SELECT id FROM categories WHERE slug = 'switches') 
      WHERE UPPER(name) LIKE '%SWITCH%' 
      AND categoryId IN (SELECT id FROM categories WHERE slug IN ('pc-armadas', 'oficina-pc', 'gamer-pc', 'mini-pc', 'diseno-pc'))
    `;
    const result = await client.execute(sql);
    console.log(`A. Switches moved to 'switches' category: ${result.rowsAffected} row(s) affected`);
  }

  // B. Move Hikvision Switch from Refrigeración → Switches
  {
    const sql = `
      UPDATE products SET categoryId = (SELECT id FROM categories WHERE slug = 'switches') 
      WHERE UPPER(name) LIKE '%HIKVISION%SWITCH%' 
      AND categoryId IN (SELECT id FROM categories WHERE slug = 'refrigeracion')
    `;
    const result = await client.execute(sql);
    console.log(`B. Hikvision Switch moved to 'switches' category: ${result.rowsAffected} row(s) affected`);
  }

  // C. Move Antena from PC Armadas → Placas de Red
  {
    const sql = `
      UPDATE products SET categoryId = (SELECT id FROM categories WHERE slug = 'placas-de-red') 
      WHERE UPPER(name) LIKE '%ANTENA%' 
      AND categoryId IN (SELECT id FROM categories WHERE slug IN ('pc-armadas', 'oficina-pc'))
    `;
    const result = await client.execute(sql);
    console.log(`C. Antena moved to 'placas-de-red' category: ${result.rowsAffected} row(s) affected`);
  }

  // D. Move Escritorio from PC Armadas → Escritorios
  {
    const sql = `
      UPDATE products SET categoryId = (SELECT id FROM categories WHERE slug = 'escritorios') 
      WHERE UPPER(name) LIKE '%ESCRITORIO%' 
      AND categoryId IN (SELECT id FROM categories WHERE slug IN ('pc-armadas', 'oficina-pc', 'gamer-pc', 'mini-pc', 'diseno-pc'))
    `;
    const result = await client.execute(sql);
    console.log(`D. Escritorio moved to 'escritorios' category: ${result.rowsAffected} row(s) affected`);
  }

  // E. Move USB-C HDMI adapter from Motherboards → Cables y Adaptadores
  {
    const sql = `
      UPDATE products SET categoryId = (SELECT id FROM categories WHERE slug = 'cables-y-adaptadores') 
      WHERE UPPER(name) LIKE '%USB-C%A HDMI%' 
      AND categoryId IN (SELECT id FROM categories WHERE slug IN ('motherboards', 'placas-de-red'))
    `;
    const result = await client.execute(sql);
    console.log(`E. USB-C HDMI adapter moved to 'cables-y-adaptadores' category: ${result.rowsAffected} row(s) affected`);
  }

  // F. Move TP-Link USB adapters from Placas de Red → Cables y Adaptadores
  {
    const sql = `
      UPDATE products SET categoryId = (SELECT id FROM categories WHERE slug = 'cables-y-adaptadores') 
      WHERE UPPER(name) LIKE '%ADAPTADOR TP-LINK USB%' 
      AND categoryId IN (SELECT id FROM categories WHERE slug = 'placas-de-red')
    `;
    const result = await client.execute(sql);
    console.log(`F. TP-Link USB adapters moved to 'cables-y-adaptadores' category: ${result.rowsAffected} row(s) affected`);
  }

  // G. Move Tensiómetro from PC Armadas → Smart Home
  {
    const sql = `
      UPDATE products SET categoryId = (SELECT id FROM categories WHERE slug = 'smart-home') 
      WHERE UPPER(name) LIKE '%TENSIOMETRO%' 
      AND categoryId IN (SELECT id FROM categories WHERE slug IN ('pc-armadas', 'oficina-pc'))
    `;
    const result = await client.execute(sql);
    console.log(`G. Tensiómetro moved to 'smart-home' category: ${result.rowsAffected} row(s) affected`);
  }

  console.log('\n=== Step 3: Adding supplier_category_mapping ===\n');

  // Insert supplier category mapping for Air Intra category '001-0430' → switches
  {
    const uuid = randomUUID();
    const switchesId = categoryMap['switches'];
    const sql = `
      INSERT OR IGNORE INTO supplier_category_mappings (id, supplierId, supplierCategory, storeCategoryId, createdAt, updatedAt)
      VALUES (?, (SELECT id FROM suppliers WHERE apiType = 'air_intra'), '001-0430', ?, datetime('now'), datetime('now'))
    `;
    const result = await client.execute({ sql, args: [uuid, switchesId] });
    console.log(`Supplier category mapping inserted: ${result.rowsAffected} row(s) affected (UUID: ${uuid}, storeCategoryId: ${switchesId})`);
  }

  console.log('\n=== Step 4: Verification ===\n');

  // Verify no switches remain in PC categories
  {
    const sql = `
      SELECT p.name, c.slug as categorySlug FROM products p LEFT JOIN categories c ON p.categoryId = c.id 
      WHERE UPPER(p.name) LIKE '%SWITCH%' AND c.slug IN ('pc-armadas', 'oficina-pc', 'gamer-pc', 'mini-pc', 'diseno-pc')
    `;
    const result = await client.execute(sql);
    console.log(`Verification: ${result.rows.length} switch product(s) still in PC categories (should be 0)`);
    if (result.rows.length > 0) {
      for (const row of result.rows) {
        console.log(`  - "${row.name}" in category: ${row.categorySlug}`);
      }
    }
  }

  console.log('\n=== Done! ===');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
