#!/usr/bin/env node
/**
 * Critical Files Checker for Compucity
 *
 * This script validates that all critical API routes and components exist.
 * It was created after a bug where a commit accidentally deleted /api/admin/upload/route.ts,
 * breaking image uploads in the admin panel for ~2 days.
 *
 * Run: node scripts/check-critical-files.mjs
 *
 * CRITICAL: If this script reports any MISSING files, DO NOT deploy until they are restored.
 */

import { existsSync } from 'fs';
import { join } from 'path';

const CRITICAL_FILES = [
  // API Routes - Admin
  { path: 'src/app/api/admin/upload/route.ts', desc: 'Image upload API (POST/DELETE)' },
  { path: 'src/app/api/admin/products/route.ts', desc: 'Product CRUD API' },
  { path: 'src/app/api/admin/banners/route.ts', desc: 'Banner CRUD API' },
  { path: 'src/app/api/admin/categories/route.ts', desc: 'Category CRUD API' },
  { path: 'src/app/api/admin/auth/login/route.ts', desc: 'Admin login API' },
  { path: 'src/app/api/admin/auth/check/route.ts', desc: 'Admin auth check API' },
  { path: 'src/app/api/admin/auth/logout/route.ts', desc: 'Admin logout API' },
  { path: 'src/app/api/admin/enrich/route.ts', desc: 'Product enrichment API' },
  { path: 'src/app/api/admin/seed/route.ts', desc: 'Database seed API' },
  { path: 'src/app/api/admin/stats/route.ts', desc: 'Admin stats API' },
  { path: 'src/app/api/admin/dollar/route.ts', desc: 'Dollar rate API' },

  // API Routes - Public
  { path: 'src/app/api/image/[id]/route.ts', desc: 'Image serving API' },
  { path: 'src/app/api/products/route.ts', desc: 'Public products API' },
  { path: 'src/app/api/categories/route.ts', desc: 'Public categories API' },
  { path: 'src/app/api/search/route.ts', desc: 'Search API' },

  // API Routes - Cron
  { path: 'src/app/api/cron/sync/route.ts', desc: 'Cron sync API' },

  // Components - Critical
  { path: 'src/components/ui-custom/ImageUploader.tsx', desc: 'Image upload component' },
  { path: 'src/components/ui-custom/WhatsAppIcon.tsx', desc: 'WhatsApp icon component' },

  // Lib - Critical
  { path: 'src/lib/db.ts', desc: 'Database client' },
  { path: 'src/lib/admin-auth.ts', desc: 'Admin authentication' },
];

const root = new URL('../', import.meta.url).pathname;

let missing = 0;
let found = 0;

console.log('🔍 Checking critical files...\n');

for (const file of CRITICAL_FILES) {
  const fullPath = join(root, file.path);
  if (existsSync(fullPath)) {
    found++;
    console.log(`  ✓ ${file.path}`);
  } else {
    missing++;
    console.log(`  ✗ MISSING: ${file.path} — ${file.desc}`);
  }
}

console.log(`\n📊 Results: ${found} found, ${missing} missing`);

if (missing > 0) {
  console.log('\n🚨 CRITICAL: Some files are missing! Do NOT deploy until restored.');
  console.log('   Check git history for the last valid version of each missing file.');
  process.exit(1);
} else {
  console.log('\n✅ All critical files present. Safe to deploy.');
  process.exit(0);
}
