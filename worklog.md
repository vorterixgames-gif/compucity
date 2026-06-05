---
Task ID: 1
Agent: Main Agent
Task: Investigate and fix missing "PC AIR INTEL PENTIUM G6400 COMETLAKE" product from Air Intra sync

Work Log:
- Investigated the Air Intra sync code (route.ts, sync-air-intra-direct.mjs)
- Searched the Turso DB for "PC AIR" products - found ZERO
- Searched the Air Intra API (articulos endpoint, 7,847 products) - found ZERO "PC AIR" products
- Searched the Air Intra API (syp endpoint, 4,500 products) - found ZERO "PC AIR" products
- Used the API's `texto` parameter to search for "PC AIR" - returned 0 results
- Discovered API documentation at api.air-intra.com/docs/ with `texto`, `rubro`, `grupo`, `categoria` filter parameters
- Found 4,321 products with NULL categoryId in the DB (invisible in store)
- Added "PC AIR", "PC ARKHAM", "PC GAMEMAX" to CATEGORY_KEYWORD_MAP for pc-armadas
- Added category corrections for PC AIR/CX/ARKHAM/GAMEMAX from microprocesadores to pc-armadas
- Added these brands to SUBCATEGORY_RULES for pc-armadas/oficina
- Added post-sync recovery using API `texto` parameter to find missing PC AIR/CX/ARKHAM/GAMEMAX products
- Added NULL categoryId recategorization step after sync
- Pushed all changes to git (commit 73001d4)

Stage Summary:
- The product "PC AIR INTEL PENTIUM G6400 COMETLAKE" does NOT exist in the Air Intra API
- Air Intra API was thoroughly searched using multiple methods (full scan, texto parameter, both endpoints)
- Code improvements made to handle PC AIR/CX/ARKHAM/GAMEMAX products if they ever appear in the API
- 4,321 products with NULL category identified as a major issue - recategorization logic added
- Post-sync recovery search added to catch products lost to JSON corruption
