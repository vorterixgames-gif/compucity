import { NextResponse } from 'next/server'
import { getCustomerCookieName } from '@/lib/customer-auth'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(getCustomerCookieName(), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return response
}
