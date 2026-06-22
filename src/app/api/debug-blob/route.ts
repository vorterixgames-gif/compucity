import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    BLOB_STORE_ID: process.env.BLOB_STORE_ID || 'NOT SET',
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ? 'SET (' + process.env.BLOB_READ_WRITE_TOKEN.length + ' chars)' : 'NOT SET',
    BLOB_WEBHOOK_PUBLIC_KEY: process.env.BLOB_WEBHOOK_PUBLIC_KEY ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
  })
}
