import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const result = await db.execute('SELECT * FROM store_config')
    const config: Record<string, string> = {}
    for (const row of result.rows as any[]) {
      config[row.key] = row.value
    }
    return NextResponse.json({ ok: true, config })
  } catch (error) {
    console.error('Get config error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { configs } = body as { configs: Record<string, string> }

    if (!configs || typeof configs !== 'object') {
      return NextResponse.json({ error: 'Configs es requerido' }, { status: 400 })
    }

    const now = new Date().toISOString()

    for (const [key, value] of Object.entries(configs)) {
      const existing = await db.execute({
        sql: 'SELECT id FROM store_config WHERE key = ?',
        args: [key],
      })

      if (existing.rows.length > 0) {
        await db.execute({
          sql: 'UPDATE store_config SET value = ?, updatedAt = ? WHERE key = ?',
          args: [value, now, key],
        })
      } else {
        const id = crypto.randomUUID()
        await db.execute({
          sql: 'INSERT INTO store_config (id, key, value, updatedAt) VALUES (?, ?, ?, ?)',
          args: [id, key, value, now],
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Update config error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
