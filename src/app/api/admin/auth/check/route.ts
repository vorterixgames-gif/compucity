import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/admin-auth'

export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }
    return NextResponse.json({
      ok: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    })
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
}
