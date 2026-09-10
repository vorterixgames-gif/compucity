import { db } from '@/lib/db'

// SESIÓN 78 (propuesta 2): Revalidación de stock al momento del pedido, aplicada a
// TODOS los proveedores (Air Intra, Invid, Elit). Es agnóstica al proveedor: usa el
// providerId de cada producto y el intervalo de sync de cada uno para medir frescura.
//
// No consulta la API del proveedor en vivo en cada pedido (no hay endpoint por-SKU y
// los rate limits lo harían inviable en checkout). En su lugar revalida contra el dato
// más fresco que tenemos del proveedor (stock + lastSeenAt/updatedAt) y marca riesgo
// cuando el dato es viejo o el producto ya no está activo/listado.
//
// Estados:
//  ok        -> hay stock suficiente y el dato del proveedor es fresco
//  no_stock  -> el stock en DB es menor al pedido (o 0)
//  inactive  -> producto desactivado en nuestro catálogo
//  missing   -> el producto no existe en la DB
//  stale     -> el dato del proveedor es más viejo que su intervalo de sync + gracia
//               (no podemos garantizar que el stock siga vigente)

// Intervalo de sync de cada proveedor (horas) + gracia
const AIR_PREFIX = 'air-intra'
const INVID_ID = '8c7b9e2c-c004-4f70-9e17-abda903395af'
const ELIT_ID = '97ee58ad-279b-48c4-907d-1db97ae9e15e'
const GRACE_H = 6

function providerSyncHours(providerId: string | null): number {
  if (!providerId) return 12
  if (providerId.startsWith(AIR_PREFIX)) return 12
  if (providerId === INVID_ID || providerId === ELIT_ID) return 6
  return 12
}

export interface StockCheckItem {
  productId: string
  quantity: number
}
export interface StockCheckResult {
  productId: string
  name: string | null
  provider: 'air-intra' | 'invid' | 'elit' | 'otro'
  status: 'ok' | 'no_stock' | 'inactive' | 'missing' | 'stale'
  stock: number | null
  requested: number
  ageHours: number | null
  note: string
}

function providerLabel(providerId: string | null): StockCheckResult['provider'] {
  if (!providerId) return 'otro'
  if (providerId.startsWith(AIR_PREFIX)) return 'air-intra'
  if (providerId === INVID_ID) return 'invid'
  if (providerId === ELIT_ID) return 'elit'
  return 'otro'
}

export async function checkItemsStock(items: StockCheckItem[]): Promise<StockCheckResult[]> {
  const ids = items.map(i => i.productId).filter(Boolean)
  if (ids.length === 0) return []
  const ph = ids.map(() => '?').join(',')
  const res = await db.execute({
    sql: `SELECT id, name, stock, isActive, providerId, providerSku, updatedAt, lastSeenAt
          FROM products WHERE id IN (${ph})`,
    args: ids,
  })
  const byId = new Map((res.rows as any[]).map(r => [r.id, r]))
  const now = Date.now()
  const out: StockCheckResult[] = []
  for (const item of items) {
    const row = byId.get(item.productId)
    const qty = Math.max(1, Number(item.quantity) || 1)
    if (!row) {
      out.push({ productId: item.productId, name: null, provider: 'otro', status: 'missing', stock: null, requested: qty, ageHours: null, note: 'El producto no existe en el catálogo' })
      continue
    }
    const prov = providerLabel(row.providerId)
    const stock = Number(row.stock) || 0
    const ref = row.lastSeenAt || row.updatedAt
    const ageHours = ref ? (now - new Date(ref).getTime()) / 3600000 : null
    const base = { productId: item.productId, name: row.name as string, provider: prov, requested: qty, stock, ageHours }
    if (Number(row.isActive) !== 1) {
      out.push({ ...base, status: 'inactive', note: 'Producto desactivado en el catálogo' })
      continue
    }
    if (stock < qty) {
      out.push({ ...base, status: 'no_stock', note: `Stock insuficiente en ${prov} (hay ${stock}, se pidieron ${qty})` })
      continue
    }
    const limit = providerSyncHours(row.providerId) + GRACE_H
    if (ageHours !== null && ageHours > limit) {
      out.push({ ...base, status: 'stale', note: `Dato de ${prov} de hace ${ageHours.toFixed(1)}h (>${limit}h); confirmar stock` })
      continue
    }
    out.push({ ...base, status: 'ok', note: '' })
  }
  return out
}

export function stockCheckWarnings(results: StockCheckResult[]): StockCheckResult[] {
  return results.filter(r => r.status !== 'ok')
}
