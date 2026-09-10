import { NextRequest, NextResponse } from 'next/server'
import { checkItemsStock, stockCheckWarnings } from '@/lib/order-stock-check'

// SESIÓN 78 (propuesta 2): endpoint público liviano para revalidar stock del carrito
// contra el dato más fresco de cada proveedor (Air Intra / Invid / Elit) antes de
// confirmar el pedido por WhatsApp. Devuelve el detalle por ítem y los warnings.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const items = Array.isArray(body.items) ? body.items : []
    if (items.length === 0) return NextResponse.json({ ok: true, results: [], warnings: [] })
    const results = await checkItemsStock(items.map((i: any) => ({ productId: String(i.productId || ''), quantity: Number(i.quantity) || 1 })))
    const warnings = stockCheckWarnings(results)
    return NextResponse.json({ ok: true, results, warnings })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || 'Error interno' }, { status: 500 })
  }
}
