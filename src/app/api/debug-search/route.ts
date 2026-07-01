import { NextResponse } from 'next/server'
import { searchProducts } from '@/lib/queries'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Debug endpoint - will be removed after fixing search
export async function GET(request: Request) {
  const url = new URL(request.url)
  const q = url.searchParams.get('q') || 'notebook'

  const results: Record<string, any> = {}

  // Test 1: Direct DB query
  try {
    const directRes = await db.execute({
      sql: "SELECT id, name FROM products WHERE isActive = 1 AND stock > 0 AND name LIKE ? LIMIT 3",
      args: [`%${q}%`],
    })
    results.directQueryCount = directRes.rows.length
    results.directQueryNames = (directRes.rows as any[]).map(r => r.name)
  } catch (e: any) {
    results.directQueryError = e.message
  }

  // Test 2: Call searchProducts directly
  try {
    const searchResults = await searchProducts(q)
    results.searchProductsCount = searchResults.length
    results.searchProductsNames = searchResults.slice(0, 3).map((p: any) => p.name)
  } catch (e: any) {
    results.searchProductsError = e.message
    results.searchProductsStack = e.stack?.split('\n').slice(0, 5).join('\n')
  }

  // Test 3: fetchDollarRate
  try {
    const { fetchDollarRate } = await import('@/lib/dollar')
    const dollar = await fetchDollarRate()
    results.dollarRate = dollar.rate
    results.dollarSource = dollar.source
  } catch (e: any) {
    results.dollarError = e.message
  }

  // Test 4: getStoreConfigNumber
  try {
    const { getStoreConfigNumber } = await import('@/lib/dollar')
    const markup = await getStoreConfigNumber('markup', 30)
    results.storeMarkup = markup
  } catch (e: any) {
    results.storeConfigError = e.message
  }

  // Test 5: getCategoryMarkupMap
  try {
    const { getCategoryMarkupMap } = await import('@/lib/queries')
    const catMap = await getCategoryMarkupMap()
    results.categoryMarkupMapSize = catMap.size
  } catch (e: any) {
    results.categoryMarkupError = e.message
  }

  return NextResponse.json({ ok: true, query: q, diagnostics: results })
}
