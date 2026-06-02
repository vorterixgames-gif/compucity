import { NextRequest, NextResponse } from 'next/server'
import { getCurrentCustomer, updateCustomer } from '@/lib/customer-auth'

/**
 * PUT /api/customer/profile — Update customer profile (address, phone, etc.)
 */
export async function PUT(request: NextRequest) {
  try {
    const customer = await getCurrentCustomer()

    if (!customer) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, phone, dni, address, city, province, postalCode } = body

    const updated = await updateCustomer(customer.id, {
      name,
      phone,
      dni,
      address,
      city,
      province,
      postalCode,
    })

    if (!updated) {
      return NextResponse.json(
        { error: 'Error al actualizar perfil' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      customer: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        dni: updated.dni,
        address: updated.address,
        city: updated.city,
        province: updated.province,
        postalCode: updated.postalCode,
      },
    })
  } catch (error) {
    console.error('Update profile error:', error)
    return NextResponse.json(
      { error: 'Error del servidor' },
      { status: 500 }
    )
  }
}
