# Worklog: Tasks 4, 5, 6 — AI Description Feature for Compucity

## Date: 2026-03-04

## Task 4: Create API `/api/generate-description`

**File created:** `/home/z/my-project/src/app/api/generate-description/route.ts`

### Implementation details:
- **Feature flag check**: Reuses the same `isAiEnabled()` pattern from `/api/validate-build` — queries `store_config` for `ai_enabled` key, parses JSON `{ value: true }`.
- **Single product flow** (`{ productId }`): Validates product exists in DB, fetches name/category/specs, builds prompt, calls LLM, saves description to DB, returns the new description.
- **Batch flow** (`{ productIds: [...] }`): Iterates over provided product IDs, generates description for each, returns count of updated products.
- **Auto-batch flow** (`{ batch: true }`): Finds up to 20 active products where description is NULL or empty, generates descriptions for all.
- **System prompt**: Spanish prompt for Argentine IT store product descriptions (2-4 sentences, no emojis, no prices, no markdown).
- **User prompt**: Includes product name, category, and specs (parsed from JSON).
- **LLM call**: Uses `z-ai-web-dev-sdk` with temperature 0.7, max_tokens 200.
- **DB update**: `UPDATE products SET description = ?, updatedAt = ? WHERE id = ?`
- **Error handling**: If LLM fails, error is returned without saving a bad description.

## Task 5: Add AI description button in admin products

**File modified:** `/home/z/my-project/src/app/admin/productos/page.tsx`

### Changes:
1. Added `Sparkles` icon import from `lucide-react`
2. Added `generatingDescription` state variable
3. Added "Generar con IA" button next to the "Descripción" label in the product edit dialog:
   - Only shows when editing an existing product (`editingId` is set)
   - Shows a `Sparkles` icon, or `Loader2` spinner when generating
   - Calls `POST /api/generate-description` with `{ productId: editingId }`
   - On success, updates the description form field with the generated text
   - On error, logs to console
   - Disabled while generating or if product name is empty

## Task 6: Feature flag setup

**File modified:** `/home/z/my-project/src/lib/db.ts`

### Changes:
- Added migration #23 to `ensureMigrations()`:
  ```sql
  INSERT OR IGNORE INTO store_config (id, key, value, updatedAt) VALUES (?, 'ai_enabled', ?, ?)
  ```
  - Uses `INSERT OR IGNORE` to be idempotent (won't overwrite existing value)
  - Default value: `{"value": true}`
  - Fixed ID: `cfg-ai-enabled`
  - Follows the existing migration pattern in the file

## Lint Results:
- Pre-existing errors only (ThemeToggle.tsx, sync-elit.js) — none related to our changes.
- All new code passes lint cleanly.
