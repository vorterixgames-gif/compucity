import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/admin-auth'

// Dispara el workflow de GitHub Actions para sync de Air Intra.
// No consume Vercel CPU (la sync corre en GitHub, no en Vercel).
export async function POST() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const token = process.env.GH_ACTIONS_TOKEN
    if (!token) {
      return NextResponse.json({ error: 'GH_ACTIONS_TOKEN no configurado' }, { status: 500 })
    }

    // Disparar el workflow via GitHub API
    const res = await fetch(
      'https://api.github.com/repos/vorterixgames-gif/compucity/actions/workflows/sync-air-intra.yml/dispatches',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'main' }),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: `GitHub API error: ${res.status}` }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      message: 'Sync de Air Intra disparada en GitHub Actions. Va a tardar ~5 minutos.',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
