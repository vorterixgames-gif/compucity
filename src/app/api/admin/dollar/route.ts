import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const result = await db.execute(
      'SELECT * FROM dollar_rates ORDER BY updatedAt DESC LIMIT 1'
    )
    const rate = (result.rows as any[])[0] ?? null
    return NextResponse.json({ ok: true, rate })
  } catch (error) {
    console.error('Get dollar error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { rate, source } = await request.json()

    if (!rate || isNaN(Number(rate))) {
      return NextResponse.json({ error: 'Tasa válida es requerida' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await db.execute({
      sql: 'INSERT INTO dollar_rates (id, rate, source, updatedAt) VALUES (?, ?, ?, ?)',
      args: [id, Number(rate), source || 'blue', now],
    })

    return NextResponse.json({ ok: true, rate: { id, rate: Number(rate) } })
  } catch (error) {
    console.error('Update dollar error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
