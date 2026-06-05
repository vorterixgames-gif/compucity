/**
 * Diagnostic script to find missing Air Intra products
 * 
 * This script searches the Air Intra API for specific products by their SKU (codiart)
 * and reports whether they exist in the API but not in the database.
 * 
 * Usage:
 *   node diagnose-missing-products.mjs                    # Search for known missing SKUs
 *   node diagnose-missing-products.mjs 52751              # Search for specific SKU
 *   node diagnose-missing-products.mjs 52751 52752 52753  # Search for multiple SKUs
 *   node diagnose-missing-products.mjs --search "PC AIR"  # Search by text
 *   node diagnose-missing-products.mjs --page 10          # Fetch and analyze a specific page
 *   node diagnose-missing-products.mjs --full-scan        # Scan ALL pages and find gaps
 */

import { createClient } from '@libsql/client';

const DB_URL = 'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io';
const DB_AUTH = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw';
const BASE_URL = 'https://api.air-intra.com/v2';
const USER = 'c4078';
const PASS = 'buA4XNOAAB';
const SUPPLIER_ID = 'air-intra-1780331633566';

const db = createClient({ url: DB_URL, authToken: DB_AUTH });

function stripPhpNotices(text) {
  return text
    .replace(/(?:<br\s*\/?>\s*)?<b>(?:Notice|Warning|Fatal error|Parse error|Deprecated)<\/b>:\s*.*?on line \d+\s*/gis, '')
    .replace(/(?:^|\n)\s*(?:Notice|Warning|Fatal error|Parse error|Deprecated):\s*.*?on line \d+\s*/gis, '')
    .replace(/<br\s*\/?>\s*/gi, '')
    .replace(/<\/?b>/gi, '')
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}

function safeParse(text) {
  const cleaned = stripPhpNotices(text);
  let jsonStart = -1;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '{' || ch === '[') { jsonStart = i; break; }
  }
  if (jsonStart === -1) return { data: null, error: 'No JSON found' };
  const jsonText = cleaned.substring(jsonStart);
  try {
    const data = JSON.parse(jsonText);
    if (data && typeof data === 'object' && !Array.isArray(data) && data.error_id) {
      return { data: null, error: `API Error (${data.error_id}): ${data.error_name || ''} - ${data.error_detail || ''}` };
    }
    return { data, error: null };
  } catch (e1) {
    let aggressive = jsonText
      .replace(/<[^>]*>/g, '')
      .replace(/,\s*,/g, ',')
      .replace(/}\s*{/g, '},{')
      .replace(/,\s*([}\]])/g, '$1');
    try {
      const data = JSON.parse(aggressive);
      if (data && typeof data === 'object' && !Array.isArray(data) && data.error_id) {
        return { data: null, error: `API Error (${data.error_id}): ${data.error_name || ''}` };
      }
      return { data, error: null };
    } catch (e2) {
      return { data: null, error: e2.message };
    }
  }
}

function extractProductsFromCorruptedJson(text) {
  const products = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '{') { i++; continue; }
    let depth = 0, inStr = false, esc = false, objEnd = -1;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (esc) { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { objEnd = j; break; }
      }
    }
    if (objEnd === -1) { i++; continue; }
    const objText = text.substring(i, objEnd + 1);
    if (objText.includes('"codigo"') || objText.includes('"codiart"')) {
      try {
        products.push(JSON.parse(objText));
      } catch {
        try {
          const cleaned = stripPhpNotices(objText);
          products.push(JSON.parse(cleaned));
        } catch { /* skip */ }
      }
    }
    i = objEnd + 1;
  }
  return products;
}

async function login() {
  console.log('[1] Logging in to Air Intra API...');
  const authRes = await fetch(`${BASE_URL}/?q=login&user=${USER}&pass=${PASS}`);
  const authText = await authRes.text();
  const { data: authData, error } = safeParse(authText);
  if (error || !authData?.token) {
    console.error('Login failed:', error || 'No token received');
    process.exit(1);
  }
  console.log(`  Token: ${authData.token.substring(0, 20)}...`);
  console.log(`  Cotización: ${authData.cotiza}`);
  return authData.token;
}

async function fetchPage(token, page, extraParams = {}) {
  const params = new URLSearchParams({ q: 'articulos', page: String(page) });
  for (const [key, value] of Object.entries(extraParams)) {
    params.set(key, String(value));
  }
  const url = `${BASE_URL}/?${params.toString()}`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  
  const rawText = await res.text();
  
  if (rawText.includes('Too many queries') || rawText.includes('"error_id":403')) {
    return { data: null, error: 'RATE_LIMITED', rawText };
  }
  
  const { data, error } = safeParse(rawText);
  
  if (error) {
    // Try extraction fallback
    const cleaned = stripPhpNotices(rawText);
    const extracted = extractProductsFromCorruptedJson(cleaned);
    if (extracted.length > 0) {
      return { data: extracted, error: null, usedFallback: true };
    }
    return { data: null, error, rawText };
  }
  
  // Also run extractor as verification
  if (Array.isArray(data) && rawText) {
    const cleaned = stripPhpNotices(rawText);
    const extracted = extractProductsFromCorruptedJson(cleaned);
    if (extracted.length > data.length) {
      const parsedSkus = new Set(data.map(p => p.codigo || p.codiart || '').filter(Boolean));
      const additional = extracted.filter(p => {
        const sku = p.codigo || p.codiart || '';
        return sku && !parsedSkus.has(sku);
      });
      if (additional.length > 0) {
        console.log(`  ⚡ Recovery: extractor found ${additional.length} additional products on page ${page}`);
        data.push(...additional);
      }
    }
  }
  
  return { data, error: null, rawText };
}

async function searchByCodiart(token, codiart) {
  console.log(`\n[Search] Looking for codiart=${codiart}...`);
  const { data, error, rawText } = await fetchPage(token, 0, { codiart });
  
  if (error === 'RATE_LIMITED') {
    console.log('  ⚠️ Rate limited! Waiting 5 minutes...');
    await new Promise(r => setTimeout(r, 5 * 60 * 1000));
    // Retry with fresh login
    const newToken = await login();
    return searchByCodiart(newToken, codiart);
  }
  
  if (error) {
    console.log(`  ❌ Error: ${error}`);
    return null;
  }
  
  if (Array.isArray(data) && data.length > 0) {
    return data;
  }
  
  console.log(`  ❌ Product not found (empty result)`);
  return null;
}

async function searchByText(token, texto) {
  console.log(`\n[Search] Looking for texto="${texto}"...`);
  const { data, error } = await fetchPage(token, 0, { texto });
  
  if (error === 'RATE_LIMITED') {
    console.log('  ⚠️ Rate limited! Waiting 5 minutes...');
    await new Promise(r => setTimeout(r, 5 * 60 * 1000));
    const newToken = await login();
    return searchByText(newToken, texto);
  }
  
  if (error) {
    console.log(`  ❌ Error: ${error}`);
    return null;
  }
  
  if (Array.isArray(data) && data.length > 0) {
    return data;
  }
  
  console.log(`  ❌ No results found`);
  return null;
}

async function getDbSkus() {
  const result = await db.execute({
    sql: 'SELECT providerSku, name, isActive, categoryId FROM products WHERE providerId = ?',
    args: [SUPPLIER_ID],
  });
  const skuMap = {};
  for (const row of result.rows) {
    skuMap[row.providerSku] = row;
  }
  return skuMap;
}

async function main() {
  const args = process.argv.slice(2);
  console.log('=== Air Intra Missing Products Diagnostic ===');
  console.log('Time:', new Date().toISOString());
  
  // Get existing DB SKUs
  console.log('\n[0] Loading existing products from DB...');
  const dbSkus = await getDbSkus();
  console.log(`  Found ${Object.keys(dbSkus).length} Air Intra products in DB`);
  
  // Login
  const token = await login();
  
  if (args.length === 0) {
    // Default: search for the known missing product
    console.log('\n=== Default: Searching for SKU 52751 ===');
    const products = await searchByCodiart(token, '52751');
    if (products) {
      for (const p of products) {
        const sku = p.codigo || p.codiart || '';
        const name = p.descrip || p.descripcion || p.titulo || '';
        const price = p.precio || '0';
        const inDb = dbSkus[sku] ? 'YES' : 'NO';
        console.log(`  ✅ Found in API: SKU=${sku}, Name="${name}", Price=${price}, In DB=${inDb}`);
        if (!dbSkus[sku]) {
          console.log(`  📋 Full product data:`, JSON.stringify(p, null, 2));
        }
      }
    }
    
    // Also search for PC AIR
    console.log('\n=== Searching for PC AIR products ===');
    const pcAirProducts = await searchByText(token, 'PC AIR');
    if (pcAirProducts) {
      console.log(`  Found ${pcAirProducts.length} PC AIR products in API`);
      for (const p of pcAirProducts) {
        const sku = p.codigo || p.codiart || '';
        const name = (p.descrip || p.descripcion || p.titulo || '').substring(0, 80);
        const inDb = dbSkus[sku] ? 'YES' : 'NO';
        console.log(`  SKU=${sku} | In DB=${inDb} | ${name}`);
      }
    }
    
  } else if (args[0] === '--search') {
    // Text search
    const query = args.slice(1).join(' ');
    const products = await searchByText(token, query);
    if (products) {
      console.log(`\n  Found ${products.length} products matching "${query}"`);
      for (const p of products) {
        const sku = p.codigo || p.codiart || '';
        const name = (p.descrip || p.descripcion || p.titulo || '').substring(0, 80);
        const inDb = dbSkus[sku] ? 'YES' : 'NO';
        console.log(`  SKU=${sku} | In DB=${inDb} | ${name}`);
      }
    }
    
  } else if (args[0] === '--page') {
    // Fetch specific page
    const pageNum = parseInt(args[1]) || 0;
    console.log(`\n=== Fetching page ${pageNum} ===`);
    const { data, error, usedFallback } = await fetchPage(token, pageNum);
    if (error) {
      console.log(`  Error: ${error}`);
    } else if (data) {
      console.log(`  Products on page ${pageNum}: ${data.length}${usedFallback ? ' (using extraction fallback)' : ''}`);
      for (const p of data.slice(0, 20)) {
        const sku = p.codigo || p.codiart || '';
        const name = (p.descrip || p.descripcion || p.titulo || '').substring(0, 80);
        const inDb = dbSkus[sku] ? 'YES' : 'NO';
        const hasPcAir = name.toUpperCase().includes('PC AIR') ? ' ⭐ PC AIR' : '';
        console.log(`  SKU=${sku} | In DB=${inDb}${hasPcAir} | ${name}`);
      }
      if (data.length > 20) {
        console.log(`  ... and ${data.length - 20} more`);
        // Check for PC AIR products
        const pcAirInPage = data.filter(p => {
          const name = (p.descrip || p.descripcion || p.titulo || '').toUpperCase();
          return name.includes('PC AIR');
        });
        if (pcAirInPage.length > 0) {
          console.log(`\n  ⭐ PC AIR products found on page ${pageNum}:`);
          pcAirInPage.forEach(p => {
            const sku = p.codigo || p.codiart || '';
            const name = (p.descrip || p.descripcion || p.titulo || '');
            console.log(`    SKU=${sku} | ${name}`);
          });
        }
      }
    }
    
  } else if (args[0] === '--full-scan') {
    // Full scan: fetch ALL pages and find which products exist in API but not in DB
    console.log('\n=== Full Scan: Fetching ALL pages ===');
    const allApiSkus = new Set();
    let page = 0;
    const MAX_PAGES = 30;
    
    while (page < MAX_PAGES) {
      console.log(`\n  Fetching page ${page}...`);
      const { data, error } = await fetchPage(token, page);
      
      if (error === 'RATE_LIMITED') {
        console.log('  Rate limited! Waiting 5 minutes...');
        await new Promise(r => setTimeout(r, 5 * 60 * 1000));
        const newToken = await login();
        // Retry same page with new token
        const retryResult = await fetchPage(newToken, page);
        if (retryResult.error) {
          console.log(`  Still failing on page ${page}: ${retryResult.error}`);
          break;
        }
        if (!retryResult.data || retryResult.data.length === 0) break;
        for (const p of retryResult.data) {
          const sku = p.codigo || p.codiart || '';
          if (sku) allApiSkus.add(sku);
        }
        page++;
        continue;
      }
      
      if (error) {
        console.log(`  Error on page ${page}: ${error}`);
        page++;
        continue;
      }
      
      if (!data || data.length === 0) {
        console.log(`  Page ${page} returned 0 products. End of data.`);
        break;
      }
      
      let pcAirCount = 0;
      for (const p of data) {
        const sku = p.codigo || p.codiart || '';
        if (sku) allApiSkus.add(sku);
        const name = (p.descrip || p.descripcion || p.titulo || '').toUpperCase();
        if (name.includes('PC AIR')) pcAirCount++;
      }
      
      console.log(`  Page ${page}: ${data.length} products (${pcAirCount} PC AIR) | Total API SKUs: ${allApiSkus.size}`);
      page++;
      
      // Small delay between pages to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }
    
    console.log(`\n=== Scan Complete ===`);
    console.log(`  Total API SKUs: ${allApiSkus.size}`);
    console.log(`  Total DB SKUs: ${Object.keys(dbSkus).length}`);
    
    // Find missing products
    const missing = [];
    for (const sku of allApiSkus) {
      if (!dbSkus[sku]) {
        missing.push(sku);
      }
    }
    
    console.log(`  Missing from DB: ${missing.length}`);
    if (missing.length > 0 && missing.length <= 100) {
      console.log(`  Missing SKUs: ${missing.join(', ')}`);
    } else if (missing.length > 100) {
      console.log(`  First 100 missing SKUs: ${missing.slice(0, 100).join(', ')}`);
    }
    
  } else {
    // Search for specific SKU(s)
    for (const sku of args) {
      const products = await searchByCodiart(token, sku);
      if (products) {
        for (const p of products) {
          const pSku = p.codigo || p.codiart || '';
          const name = p.descrip || p.descripcion || p.titulo || '';
          const price = p.precio || '0';
          const inDb = dbSkus[pSku] ? 'YES' : 'NO';
          console.log(`  ✅ Found: SKU=${pSku}, Name="${name}", Price=${price}, In DB=${inDb}`);
          if (!dbSkus[pSku]) {
            console.log(`  📋 Full data:`, JSON.stringify(p, null, 2));
          }
        }
      }
      // Wait between searches to avoid rate limit
      if (args.indexOf(sku) < args.length - 1) {
        console.log('  Waiting 10s before next search...');
        await new Promise(r => setTimeout(r, 10000));
      }
    }
  }
  
  console.log('\n=== Diagnostic Complete ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
