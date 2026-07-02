/**
 * Migration: Add `tags` column to products table.
 * Tags store a JSON array of strings for explicit filter matching,
 * e.g. ["gamer","ddr4","hp","dedicated_gpu"]
 * This allows manually created products to appear in storefront filters
 * even if their name doesn't match the regex patterns.
 */

import { createClient } from '@libsql/client';

const db = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw',
});

async function migrate() {
  console.log('=== ADD TAGS COLUMN TO PRODUCTS ===\n');

  // 1. Check if column already exists
  const columns = await db.execute({ sql: 'PRAGMA table_info(products)' });
  const hasTags = columns.rows.some(r => r.name === 'tags');
  
  if (hasTags) {
    console.log('Column "tags" already exists. Skipping.');
    return;
  }

  // 2. Add the column
  await db.execute({
    sql: "ALTER TABLE products ADD COLUMN tags TEXT DEFAULT '[]'",
  });
  console.log('Added column "tags" (TEXT, default "[]") to products table.');

  // 3. Verify
  const verify = await db.execute({ sql: 'PRAGMA table_info(products)' });
  const tagsCol = verify.rows.find(r => r.name === 'tags');
  console.log('Verification:', tagsCol);

  console.log('\n✅ Migration complete!');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
