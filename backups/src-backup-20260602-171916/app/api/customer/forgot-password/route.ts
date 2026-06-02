import { NextRequest, NextResponse } from 'next/server'
import { getCustomerByEmail } from '@/lib/customer-auth'
import { db } from '@/lib/db'
import { Resend } from 'resend'

// Lazy initialize Resend to avoid build-time errors (no API key during build)
let resendInstance: Resend | null = null
function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY)
  }
  return resendInstance
}

// Token expires in 1 hour
const TOKEN_EXPIRY_HOURS = 1

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'El email es requerido' },
        { status: 400 }
      )
    }

    // Check if customer exists (but don't reveal this to the user)
    const customer = await getCustomerByEmail(email.toLowerCase().trim())

    if (!customer) {
      // Return success anyway to prevent email enumeration
      return NextResponse.json({
        ok: true,
        message: 'Si existe una cuenta con ese email, vas a recibir un enlace para restablecer tu contraseña.',
      })
    }

    // Generate a secure random token
    const token = crypto.randomUUID() + crypto.randomUUID()
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()

    // Ensure password_reset_tokens table exists
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        customerId TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expiresAt TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT (datetime('now'))
      )`,
      args: [],
    })

    // Invalidate any existing tokens for this customer
    await db.execute({
      sql: `UPDATE password_reset_tokens SET used = 1 WHERE customerId = ? AND used = 0`,
      args: [customer.id],
    })

    // Save the new token
    const tokenId = crypto.randomUUID()
    await db.execute({
      sql: `INSERT INTO password_reset_tokens (id, customerId, token, expiresAt, used, createdAt)
            VALUES (?, ?, ?, ?, 0, datetime('now'))`,
      args: [tokenId, customer.id, token, expiresAt],
    })

    // Build the reset URL
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://compucity.vercel.app'
    const resetUrl = `${baseUrl}/resetear-contrasena?token=${token}`

    // Send the email
    try {
      await getResend().emails.send({
        from: 'Compucity <onboarding@resend.dev>',
        to: email.toLowerCase().trim(),
        subject: 'Restablecer tu contraseña - Compucity',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #16a34a; margin: 0;">Compucity</h1>
              <p style="color: #666; margin: 5px 0 0;">Tu Mundo Digital</p>
            </div>

            <div style="background: #f9fafb; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
              <h2 style="color: #111; margin: 0 0 15px;">Restablecer tu contraseña</h2>
              <p style="color: #555; line-height: 1.6; margin: 0 0 20px;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta. Si no fuiste vos, podés ignorar este email.
              </p>

              <a href="${resetUrl}"
                 style="display: inline-block; background: #16a34a; color: #fff; text-decoration: none;
                        padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Restablecer contraseña
              </a>

              <p style="color: #888; font-size: 13px; margin: 20px 0 0; line-height: 1.5;">
                Este enlace expira en 1 hora. Si el botón no funciona, copiá este enlace en tu navegador:<br>
                <a href="${resetUrl}" style="color: #16a34a; word-break: break-all;">${resetUrl}</a>
              </p>
            </div>

            <div style="text-align: center; color: #aaa; font-size: 12px; padding-top: 20px; border-top: 1px solid #eee;">
              <p>Compucity - La Falda, Córdoba, Argentina</p>
              <p>Este email fue enviado a ${email.toLowerCase().trim()}</p>
            </div>
          </div>
        `,
      })
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError)
      // Don't reveal email sending failure to prevent info leakage
    }

    return NextResponse.json({
      ok: true,
      message: 'Si existe una cuenta con ese email, vas a recibir un enlace para restablecer tu contraseña.',
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Error del servidor' },
      { status: 500 }
    )
  }
}
