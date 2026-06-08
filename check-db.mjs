import { createClient } from '@libsql/client';

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw',
});

const sep = '='.repeat(70);

async function run() {
  try {
    // 1. List ALL tables with row counts
    console.log(sep);
    console.log('1. ALL TABLES WITH ROW COUNTS');
    console.log(sep);
    const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    for (const row of tables.rows) {
      const tName = row.name;
      const count = await db.execute(`SELECT COUNT(*) as cnt FROM "${tName}"`);
      console.log(`  ${tName}: ${count.rows[0].cnt} rows`);
    }

    // 2. Total products: active, inactive, with image, without image
    console.log('\n' + sep);
    console.log('2. PRODUCT STATS');
    console.log(sep);
    const total = await db.execute('SELECT COUNT(*) as cnt FROM products');
    const active = await db.execute("SELECT COUNT(*) as cnt FROM products WHERE isActive = 1");
    const inactive = await db.execute("SELECT COUNT(*) as cnt FROM products WHERE isActive = 0 OR isActive IS NULL");
    const withImage = await db.execute("SELECT COUNT(*) as cnt FROM products WHERE images IS NOT NULL AND images != '' AND images != '[]'");
    const withoutImage = await db.execute("SELECT COUNT(*) as cnt FROM products WHERE images IS NULL OR images = '' OR images = '[]'");
    console.log(`  Total products:      ${total.rows[0].cnt}`);
    console.log(`  Active (isActive=1): ${active.rows[0].cnt}`);
    console.log(`  Inactive/Null:       ${inactive.rows[0].cnt}`);
    console.log(`  With images:         ${withImage.rows[0].cnt}`);
    console.log(`  Without images:      ${withoutImage.rows[0].cnt}`);

    // 3. Products by supplier (using providerId FK)
    console.log('\n' + sep);
    console.log('3. PRODUCTS BY SUPPLIER');
    console.log(sep);
    const bySupplier = await db.execute(`
      SELECT s.name as supplier_name,
             COUNT(p.id) as total,
             SUM(CASE WHEN p.isActive = 1 THEN 1 ELSE 0 END) as active_count,
             SUM(CASE WHEN p.images IS NOT NULL AND p.images != '' AND p.images != '[]' THEN 1 ELSE 0 END) as with_image
      FROM suppliers s
      LEFT JOIN products p ON p.providerId = s.id
      GROUP BY s.id, s.name
      ORDER BY total DESC
    `);
    for (const row of bySupplier.rows) {
      console.log(`  ${row.supplier_name}: total=${row.total}, active=${row.active_count}, with_image=${row.with_image}`);
    }

    // 4. ivaRate distribution
    console.log('\n' + sep);
    console.log('4. IVA RATE DISTRIBUTION');
    console.log(sep);
    const iva = await db.execute(`
      SELECT ivaRate, COUNT(*) as cnt
      FROM products
      GROUP BY ivaRate
      ORDER BY cnt DESC
    `);
    for (const row of iva.rows) {
      console.log(`  ivaRate=${row.ivaRate}: ${row.cnt} products`);
    }

    // 5. Count of products with salePrice
    console.log('\n' + sep);
    console.log('5. PRODUCTS WITH salePrice');
    console.log(sep);
    const salePrice = await db.execute("SELECT COUNT(*) as cnt FROM products WHERE salePrice IS NOT NULL AND salePrice != 0");
    const salePriceNull = await db.execute("SELECT COUNT(*) as cnt FROM products WHERE salePrice IS NULL OR salePrice = 0");
    console.log(`  With salePrice (non-null, non-zero): ${salePrice.rows[0].cnt}`);
    console.log(`  Without salePrice (null or zero):    ${salePriceNull.rows[0].cnt}`);

    // 6. Products with markup individual and cashDiscount individual
    console.log('\n' + sep);
    console.log('6. PRODUCTS WITH INDIVIDUAL markup AND cashDiscount');
    console.log(sep);
    const markupCount = await db.execute("SELECT COUNT(*) as cnt FROM products WHERE markup IS NOT NULL");
    const cashDiscountCount = await db.execute("SELECT COUNT(*) as cnt FROM products WHERE cashDiscount IS NOT NULL");
    const bothCount = await db.execute("SELECT COUNT(*) as cnt FROM products WHERE markup IS NOT NULL AND cashDiscount IS NOT NULL");
    console.log(`  With markup (not null):       ${markupCount.rows[0].cnt}`);
    console.log(`  With cashDiscount (not null): ${cashDiscountCount.rows[0].cnt}`);
    console.log(`  With both:                    ${bothCount.rows[0].cnt}`);

    // 7. Banners count
    console.log('\n' + sep);
    console.log('7. BANNERS COUNT');
    console.log(sep);
    try {
      const banners = await db.execute('SELECT COUNT(*) as cnt FROM banners');
      console.log(`  Total banners: ${banners.rows[0].cnt}`);
      const bannerRows = await db.execute('SELECT * FROM banners');
      for (const row of bannerRows.rows) {
        const img = row.imageUrl ? (row.imageUrl.length > 60 ? row.imageUrl.substring(0, 60) + '...' : row.imageUrl) : 'NULL';
        console.log(`  - id=${row.id}, title=${row.title || 'N/A'}, isActive=${row.isActive}, order=${row.order}, imageUrl=${img}`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }

    // 8. Orders count
    console.log('\n' + sep);
    console.log('8. ORDERS COUNT');
    console.log(sep);
    try {
      const orders = await db.execute('SELECT COUNT(*) as cnt FROM orders');
      console.log(`  Total orders: ${orders.rows[0].cnt}`);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }

    // 9. Customers count
    console.log('\n' + sep);
    console.log('9. CUSTOMERS COUNT');
    console.log(sep);
    try {
      const customers = await db.execute('SELECT COUNT(*) as cnt FROM customers');
      console.log(`  Total customers: ${customers.rows[0].cnt}`);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }

    // 10. Store config key-value pairs
    console.log('\n' + sep);
    console.log('10. STORE CONFIG KEY-VALUE PAIRS');
    console.log(sep);
    try {
      const config = await db.execute('SELECT * FROM store_config ORDER BY key');
      for (const row of config.rows) {
        const val = row.value ? (row.value.length > 120 ? row.value.substring(0, 120) + '...' : row.value) : 'NULL';
        console.log(`  ${row.key} = ${val}`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }

    // 11. Banners table structure
    console.log('\n' + sep);
    console.log('11. BANNERS TABLE STRUCTURE');
    console.log(sep);
    try {
      const bannerInfo = await db.execute("PRAGMA table_info(banners)");
      for (const col of bannerInfo.rows) {
        console.log(`  ${col.name} | type=${col.type} | notnull=${col.notnull} | default=${col.dflt_value} | pk=${col.pk}`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }

    // 12. Products table column names
    console.log('\n' + sep);
    console.log('12. PRODUCTS TABLE COLUMN NAMES (PRAGMA table_info)');
    console.log(sep);
    const prodInfo = await db.execute("PRAGMA table_info(products)");
    for (const col of prodInfo.rows) {
      console.log(`  ${col.name} | type=${col.type} | notnull=${col.notnull} | default=${col.dflt_value} | pk=${col.pk}`);
    }

    console.log('\n' + sep);
    console.log('DONE - ALL QUERIES COMPLETED');
    console.log(sep);

  } catch (err) {
    console.error('FATAL ERROR:', err.message);
    console.error(err);
  } finally {
    db.close();
  }
}

run();
