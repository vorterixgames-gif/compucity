import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw'
});

console.log('=== CATEGORIES TABLE SCHEMA ===');
const schema = await client.execute('PRAGMA table_info(categories)');
console.log(JSON.stringify(schema.rows, null, 2));

console.log('\n=== PRODUCTS TABLE SCHEMA ===');
const productSchema = await client.execute('PRAGMA table_info(products)');
console.log(JSON.stringify(productSchema.rows, null, 2));

console.log('\n=== ALL CATEGORIES ===');
const result = await client.execute('SELECT * FROM categories ORDER BY id');
console.log(JSON.stringify(result.rows, null, 2));

console.log('\n=== PRODUCT COUNTS PER CATEGORY ===');
const counts = await client.execute(`
  SELECT c.id, c.name, COUNT(p.id) as product_count 
  FROM categories c 
  LEFT JOIN products p ON p.categoryId = c.id 
  GROUP BY c.id 
  ORDER BY c.id
`);
console.log(JSON.stringify(counts.rows, null, 2));

await client.close();
