import { createClient } from '@libsql/client';

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw',
});

async function run() {
  try {
    console.log('=== CONNECTED TO TURSO DB ===\n');

    // 0. Quick sanity: total product count
    const totalRes = await db.execute('SELECT COUNT(*) as total FROM products');
    console.log(`Total products in DB: ${totalRes.rows[0].total}\n`);

    // 1. Count of products without categoryId
    const q1 = await db.execute("SELECT COUNT(*) as cnt FROM products WHERE categoryId IS NULL");
    console.log('1. Products WITHOUT categoryId:', q1.rows[0].cnt, '\n');

    // 2. Count of products with empty images
    const q2 = await db.execute("SELECT COUNT(*) as cnt FROM products WHERE images = '[]' OR images IS NULL");
    console.log('2. Products with EMPTY images ([] or NULL):', q2.rows[0].cnt, '\n');

    // 3. Count of products without BOTH categoryId AND images
    const q3 = await db.execute("SELECT COUNT(*) as cnt FROM products WHERE categoryId IS NULL AND (images = '[]' OR images IS NULL)");
    console.log('3. Products WITHOUT BOTH categoryId AND images:', q3.rows[0].cnt, '\n');

    // 4. Specific product "32 ASUS PG32UCDP-J Rog Swift OLED Gaming"
    const q4 = await db.execute("SELECT * FROM products WHERE name LIKE '%PG32UCDP%' OR name LIKE '%Rog Swift OLED Gaming%'");
    console.log('4. Product "32 ASUS PG32UCDP-J Rog Swift OLED Gaming":');
    if (q4.rows.length === 0) {
      console.log('   NOT FOUND with LIKE search. Trying broader search...');
      const q4b = await db.execute("SELECT * FROM products WHERE name LIKE '%PG32UCDP-J%'");
      if (q4b.rows.length === 0) {
        console.log('   Still not found. Trying just ASUS + 32...');
        const q4c = await db.execute("SELECT * FROM products WHERE name LIKE '%ASUS%32%' AND name LIKE '%OLED%'");
        if (q4c.rows.length === 0) {
          console.log('   NOT FOUND at all.');
        } else {
          for (const row of q4c.rows) {
            console.log(JSON.stringify(row, null, 2));
          }
        }
      } else {
        for (const row of q4b.rows) {
          console.log(JSON.stringify(row, null, 2));
        }
      }
    } else {
      for (const row of q4.rows) {
        console.log(JSON.stringify(row, null, 2));
      }
    }
    console.log('');

    // 5. List all categories
    const q5 = await db.execute("SELECT id, name, slug FROM categories ORDER BY name");
    console.log('5. ALL CATEGORIES:');
    for (const row of q5.rows) {
      console.log(`   id=${row.id}  name=${row.name}  slug=${row.slug}`);
    }
    console.log(`   Total categories: ${q5.rows.length}\n`);

    // 6. Count of products by providerId
    const q6 = await db.execute("SELECT providerId, COUNT(*) as cnt FROM products GROUP BY providerId ORDER BY cnt DESC");
    console.log('6. Products by providerId:');
    for (const row of q6.rows) {
      console.log(`   providerId=${row.providerId}  count=${row.cnt}`);
    }
    console.log('');

    // 7. Sample of 20 products without categoryId
    const q7 = await db.execute("SELECT name, providerSku, supplierCategory, providerId FROM products WHERE categoryId IS NULL LIMIT 20");
    console.log('7. Sample of 20 products WITHOUT categoryId:');
    for (const row of q7.rows) {
      console.log(`   name="${row.name}"  providerSku=${row.providerSku}  supplierCategory="${row.supplierCategory}"  providerId=${row.providerId}`);
    }
    console.log('');

    // Bonus: schema info
    const schema = await db.execute("PRAGMA table_info(products)");
    console.log('BONUS - Products table schema:');
    for (const col of schema.rows) {
      console.log(`   ${col.name} (${col.type}) nullable=${col.notnull === 0 ? 'YES' : 'NO'} default=${col.dflt_value}`);
    }

  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    db.close();
  }
}

run();
