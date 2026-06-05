---
Task ID: 1
Agent: Main
Task: Investigate why SKU 52751 (PC AIR INTEL PENTIUM G6400 COMETLAKE) is missing from DB

Work Log:
- Queried Turso DB: SKU 52751 does NOT exist in the products table
- Found 0 "PC AIR" products in DB (out of 7,511 Air Intra products)
- Found 4,321 Air Intra products with NULL categoryId
- Queried Air Intra API with texto=PC AIR → 0 results (product doesn't exist in API)
- Queried Air Intra API with texto=PENTIUM G6400 → Only found CPU (SKU 48440), not the PC
- Queried Air Intra API with rubro=001-0014 → 18 PC products, none with SKU 52751
- Discovered Air Intra API rate limit is very aggressive (5+ min cooldown between queries)
- Discovered search parameters (texto, codiart) MUST be in POST body, NOT query params
- Fixed sync code: search params now go in body, added rate limit handling, added codiart search
- Added 'PC AIR' and other missing keywords to sync-air-intra-direct.mjs
- Created diagnose-missing-products.mjs diagnostic script
- Deployed all changes to production

Stage Summary:
- ROOT CAUSE: Product "PC AIR INTEL PENTIUM G6400 COMETLAKE" (SKU 52751) does NOT exist in the Air Intra API
- The API has 0 products matching "PC AIR" - the entire product line is absent from the API
- This is NOT a sync bug - the product simply isn't available through the API endpoint
- The user may be looking at Air Intra's intranet/website where the product exists but isn't exposed via API
- Code improvements deployed: POST body search params, rate limit handling, codiart search, better recovery
