import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/admin-auth'

// Sesión 71: estado del último run de un workflow de GitHub Actions.
// Lo usa el admin para mostrar la barra de progreso de la sync de Air Intra.
// Devuelve siempre HTTP 200 con { ok } para que el frontend no truene en errores.
export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

    const token = process.env.GH_ACTIONS_TOKEN
    if (!token) return NextResponse.json({ ok: false, error: 'GH_ACTIONS_TOKEN no configurado' })

    const workflow = request.nextUrl.searchParams.get('workflow') || 'sync-air-intra.yml'
    const res = await fetch(
      `https://api.github.com/repos/vorterixgames-gif/compucity/actions/workflows/${workflow}/runs?per_page=1`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
    )
    if (!res.ok) return NextResponse.json({ ok: false, error: `GitHub API ${res.status}` })
    const data = await res.json()
    const run = data.workflow_runs?.[0]
    if (!run) return NextResponse.json({ ok: false, error: 'Sin runs' })
    return NextResponse.json({
      ok: true,
      run: {
        id: run.id,
        status: run.status,
        conclusion: run.conclusion,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message })
  }
}
