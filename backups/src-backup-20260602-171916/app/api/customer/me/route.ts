import { NextResponse } from 'next/server'
import { getCurrentCustomer } from '@/lib/customer-auth'

export async function GET() {
  try {
    const customer = await getCurrentCustomer()

    if (!customer) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      ok: true,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        dni: customer.dni,
        address: customer.address,
        city: customer.city,
        province: customer.province,
        postalCode: customer.postalCode,
      },
    })
  } catch (error) {
    console.error('Customer me error:', error)
    return NextResponse.json(
      { error: 'Error del servidor' },
      { status: 500 }
    )
  }
}
