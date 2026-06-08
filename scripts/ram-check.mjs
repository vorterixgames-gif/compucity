import { createClient } from '@libsql/client';
import 'dotenv/config';

const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// List all categories
const cats = await db.execute(`SELECT id, slug, name FROM categories ORDER BY name`);
for (const r of cats.rows) {
  console.log(r.slug, '|', r.name, '|', r.id);
}
