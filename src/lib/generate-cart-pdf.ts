'use client'

import jsPDF from 'jspdf'
import { COMPUCITY_LOGO_BASE64 } from '@/lib/compucity-logo-base64'

interface CartPdfItem {
  name: string
  price: number
  quantity: number
}

/**
 * Generate a PDF for the shopping cart.
 * Reuses the same header/footer style as the PC Builder PDF.
 */
export function generateCartPDF(items: CartPdfItem[], subtotal: number, couponCode?: string, couponDiscount?: number): void {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  let y = 10

  // Header - Compucity logo image
  const logoW = 55
  const logoH = (logoW * 220) / 547 // ~22.1
  doc.addImage(COMPUCITY_LOGO_BASE64, 'PNG', margin, y, logoW, logoH)

  // Date on the right
  const dateStr = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text(dateStr, pageWidth - margin, y + 6, { align: 'right' })
  doc.text('Presupuesto generado en compucityonline.com.ar', pageWidth - margin, y + 12, { align: 'right' })

  y = y + logoH + 8

  // Green separator line
  doc.setDrawColor(58, 139, 104)
  doc.setLineWidth(1)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // Title
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Presupuesto de Carrito', margin, y)
  y += 10

  // Separator line
  doc.setDrawColor(58, 139, 104)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // Helper: format price in ARS
  const formatARS = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

  // Items list
  doc.setFontSize(11)
  items.forEach((item, idx) => {
    const lineTotal = item.price * item.quantity

    // Check if we need a new page
    if (y > 265) {
      doc.addPage()
      y = 20
    }

    // Item number (green)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(58, 139, 104)
    doc.text(`${idx + 1}.`, margin, y)

    // Product name
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(50, 50, 50)
    const nameX = margin + 8
    const maxNameWidth = pageWidth - margin * 2 - 50
    const nameLines = doc.splitTextToSize(item.name, maxNameWidth)
    doc.text(nameLines[0], nameX, y)

    // If name wraps to multiple lines, adjust y
    if (nameLines.length > 1) {
      for (let i = 1; i < nameLines.length; i++) {
        y += 5
        if (y > 265) { doc.addPage(); y = 20 }
        doc.text(nameLines[i], nameX, y + 5)
      }
    }

    // Price on the right
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    const priceText = item.quantity > 1
      ? `${item.quantity}x ${formatARS(item.price)} c/u = ${formatARS(lineTotal)}`
      : formatARS(item.price)
    doc.text(priceText, pageWidth - margin, y + 5, { align: 'right' })

    y += 14
  })

  // Check if we need a new page for totals
  if (y > 240) {
    doc.addPage()
    y = 20
  }

  // Separator line before totals
  y += 2
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // Subtotal
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text('Subtotal:', margin, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formatARS(subtotal), pageWidth - margin, y, { align: 'right' })
  y += 8

  // Coupon discount (if any)
  if (couponCode && couponDiscount && couponDiscount > 0) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(220, 50, 50)
    doc.text(`Cupón ${couponCode}:`, margin, y)
    doc.setFont('helvetica', 'bold')
    doc.text(`-${formatARS(couponDiscount)}`, pageWidth - margin, y, { align: 'right' })
    y += 8
  }

  // Total (highlighted)
  const total = subtotal - (couponDiscount || 0)
  doc.setFillColor(232, 245, 242) // #EFF5F2
  doc.roundedRect(margin - 3, y - 6, pageWidth - margin * 2 + 6, 14, 2, 2, 'F')
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(58, 139, 104)
  doc.text('Total:', margin, y)
  doc.text(formatARS(total), pageWidth - margin, y, { align: 'right' })
  y += 18

  // Note
  if (y < 270) {
    doc.setFillColor(255, 248, 225)
    doc.roundedRect(margin - 3, y - 5, pageWidth - margin * 2 + 6, 12, 2, 2, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(146, 100, 0)
    doc.text('Los precios están sujetos a disponibilidad y pueden variar al momento de la compra.', margin, y + 2)
    y += 18
  }

  // Sesión 51 d4: textos legales adicionales (cambios de marca, stock, validez de precios, garantía)
  if (y > 220) {
    doc.addPage()
    y = 20
  }

  // 1. Nota sobre variación de marcas por stock
  doc.setFontSize(7)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100, 100, 100)
  const marcasText = 'LAS MARCAS DE LOS COMPONENTES UTILIZADOS PUEDEN VARIAR DE ACUERDO A LA DISPONIBILIDAD DE STOCK EN LOS PROVEEDORES, SIN PERJUICIO DE LAS PRESTACIONES DE LOS PRESUPUESTADOS Y VALORES DE LOS MISMOS. EN CASO DE CAMBIO NECESARIO POR FALTA DE STOCK Y VARIACIÓN EN LAS PRESTACIONES DE LOS DISPONIBLES, COMPUCITY SE COMUNICARÁ PARA INFORMAR DEL HECHO Y SOLICITAR CONFORMIDAD DEL CAMBIO Y VARIACIONES EN EL PRECIO.'
  const marcasLines = doc.splitTextToSize(marcasText, pageWidth - margin * 2)
  doc.text(marcasLines, margin, y)
  y += marcasLines.length * 3.5 + 4

  // 2. Link a política de garantía y devoluciones
  if (y > 280) { doc.addPage(); y = 20 }
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(58, 139, 104)
  doc.text('POLITICA DE GARANTIA Y DEVOLUCIONES', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.textWithLink('https://www.compucityonline.com.ar/garantia-y-devoluciones', margin, y, {
    url: 'https://www.compucityonline.com.ar/garantia-y-devoluciones'
  })
  y += 8

  // 3. Antes de abonar consultar stock
  if (y > 285) { doc.addPage(); y = 20 }
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(180, 60, 60)
  doc.text('ANTES DE ABONAR CONSULTA POR DISPONIBILIDAD DE STOCK', margin, y)
  y += 7

  // 4. Validez de precios (7 días desde la fecha del presupuesto)
  if (y > 285) { doc.addPage(); y = 20 }
  const validezFecha = new Date()
  validezFecha.setDate(validezFecha.getDate() + 7)
  const validezStr = validezFecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(`PRECIOS VALIDOS HASTA EL ${validezStr} INCLUSIVE`, margin, y)
  y += 8

  // Footer on every page
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text('Compucity - Av. Sarmiento 462, La Falda, Córdoba | WhatsApp: 3548 40-2056', margin, 290)
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, 290, { align: 'right' })
  }

  // Download
  doc.save('Compucity-Presupuesto.pdf')
}
