import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldCheck, RefreshCw, Truck, AlertTriangle, Clock, Package } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Garantía y Devoluciones',
  description: 'Política completa de garantía y devoluciones de Compucity. 10 días para cambios, 12 meses de garantía en nuestro local en La Falda, Córdoba.',
  alternates: {
    canonical: 'https://www.compucityonline.com.ar/garantia-y-devoluciones',
  },
  openGraph: {
    title: 'Garantía y Devoluciones | Compucity',
    description: 'Política completa de garantía y devoluciones de Compucity. 10 días para cambios, 12 meses de garantía en nuestro local.',
    url: 'https://www.compucityonline.com.ar/garantia-y-devoluciones',
  },
}

export default function GarantiaDevolucionesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <ShieldCheck className="h-8 w-8 text-compucity-green" />
          <h1 className="text-3xl font-bold text-gray-900">Garantía y Devoluciones</h1>
        </div>
        <p className="text-gray-600">
          En Compucity queremos que compres con confianza. Te explicamos cómo funcionan nuestros cambios, devoluciones y garantías.
        </p>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div className="bg-compucity-green-50 border border-compucity-green-100 rounded-lg p-4 text-center">
          <RefreshCw className="h-6 w-6 text-compucity-green mx-auto mb-2" />
          <p className="text-2xl font-bold text-compucity-green-dark">10 días</p>
          <p className="text-xs text-gray-600 mt-1">para cambios y devoluciones</p>
        </div>
        <div className="bg-compucity-green-50 border border-compucity-green-100 rounded-lg p-4 text-center">
          <ShieldCheck className="h-6 w-6 text-compucity-green mx-auto mb-2" />
          <p className="text-2xl font-bold text-compucity-green-dark">12 meses</p>
          <p className="text-xs text-gray-600 mt-1">garantía en nuestro local</p>
        </div>
        <div className="bg-compucity-green-50 border border-compucity-green-100 rounded-lg p-4 text-center">
          <Clock className="h-6 w-6 text-compucity-green mx-auto mb-2" />
          <p className="text-2xl font-bold text-compucity-green-dark">48h hábiles</p>
          <p className="text-xs text-gray-600 mt-1">demora mínima de reposición</p>
        </div>
      </div>

      {/* Sección: Plazo para cambio */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Plazo para cambio o devolución</h2>
        <p className="text-gray-700 leading-relaxed">
          En el supuesto que decidieras cambiar el producto adquirido, contás con un plazo de <strong>diez (10) días corridos</strong> contados a partir de la fecha en que sea recibido el producto en cuestión.
        </p>
      </section>

      {/* Sección: Motivos válidos */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Motivos por los cuales se puede gestionar el cambio o devolución</h2>
        <ul className="space-y-2 text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-compucity-green mt-1">•</span>
            <span><strong>Producto defectuoso antes de probarse:</strong> el producto recibido posee alguna falla o rotura.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-compucity-green mt-1">•</span>
            <span><strong>Producto defectuoso después de probarse:</strong> el producto recibido posee alguna falla o rotura, luego de ser utilizado.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-compucity-green mt-1">•</span>
            <span><strong>El producto recibido es diferente al que solicitó.</strong></span>
          </li>
        </ul>
      </section>

      {/* Sección: Cambio SIN defectos */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Cambio de un producto SIN defectos (producto diferente al solicitado)</h2>
        <div className="bg-gray-50 border-l-4 border-compucity-green p-4 rounded-r-lg">
          <p className="text-gray-700 leading-relaxed">
            Si el producto es nuevo y está sin defectos, tendrás hasta <strong>30 días consecutivos</strong>, a partir de la fecha de recepción, para poder sustituirlo por otro, siempre y cuando conserve las mismas condiciones en que fue recibido (en el embalaje original, sin indicios de uso, con la factura / ticket original, manual y todos los accesorios si correspondiera).
          </p>
          <p className="text-gray-700 leading-relaxed mt-3">
            Los gastos del flete serán <strong>gratuitos para el usuario</strong> cuando se trate del primer cambio realizado. En caso de que sea necesario uno nuevamente, los gastos de flete serán a cargo del usuario.
          </p>
        </div>
      </section>

      {/* Sección: Cambio CON defectos */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Cambio de un producto CON defectos</h2>
        <p className="text-gray-700 leading-relaxed">
          En caso de que el producto esté con defectos propios de fabricación, se disponen de <strong>10 días</strong>, a partir de la fecha en que recibió el pedido, para solicitar el cambio directo del mismo. De lo contrario, contará con <strong>180 días como mínimo</strong> (dependiendo lo establecido por el fabricante en cada producto) para hacer uso de la garantía del mismo. El plazo y forma de utilización están mencionados en las condiciones de garantía que acompañan al producto.
        </p>
      </section>

      {/* Sección: Devolución */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Devolución de un producto</h2>
        <p className="text-gray-700 leading-relaxed">
          Conforme lo establece el <strong>art. 34 de la ley 24.240 de Defensa del Consumidor</strong>, en concordancia con los artículos 1.111 y 1.112 del Código Civil y Comercial de la República Argentina, el usuario tendrá también <strong>10 días</strong> contados a partir de que se entregue el bien o se celebre el contrato para poder revocar la aceptación de la compra. Si así lo decidiera, se aplica lo dispuesto por el art. 10 ter de la Ley 24.240 de Defensa del Consumidor.
        </p>
        <p className="text-gray-700 leading-relaxed mt-3">
          En tal caso, el consumidor deberá comunicarse con nosotros para gestionar la devolución del producto, el cual deberá estar sin uso y en perfecto estado, con sus etiquetas, envoltorios y todos los accesorios adicionales que pudieren corresponder.
        </p>
      </section>

      {/* Sección: Política de Garantía */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Política de Garantía</h2>
        <p className="text-gray-700 leading-relaxed">
          Todos los productos comercializados en Compucity tienen <strong>diez (10) días de cambio directo</strong> por fallas y/o desperfectos, debiendo presentar la factura de compra original, con su respectivo embalaje, etiquetas y accesorios en perfecto estado.
        </p>
        <p className="text-gray-700 leading-relaxed mt-3">
          Vencido el plazo de los diez días, todos los productos cuentan con <strong>garantía oficial del fabricante</strong>, debiendo ser gestionada por el cliente con la marca correspondiente.
        </p>
        <p className="text-gray-700 leading-relaxed mt-3">
          Si el producto presenta indicios de golpes o mal uso, la garantía queda anulada. Dicha garantía no cubre los inconvenientes ocasionados por malware o el uso indebido del sistema operativo, programas incompatibles o configuraciones erróneas.
        </p>
      </section>

      {/* Sección: 12 meses de garantía local */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">12 meses de garantía en nuestro local</h2>
        <div className="bg-compucity-green-50 border border-compucity-green-100 rounded-lg p-5">
          <p className="text-sm font-medium text-compucity-green-dark mb-3">Productos cubiertos:</p>
          <ul className="space-y-1 text-gray-700 text-sm">
            <li className="flex items-start gap-2">
              <Package className="h-4 w-4 text-compucity-green mt-0.5 shrink-0" />
              <span>PC ensambladas por Compucity</span>
            </li>
            <li className="flex items-start gap-2">
              <Package className="h-4 w-4 text-compucity-green mt-0.5 shrink-0" />
              <span><strong>Hardware:</strong> periféricos, discos, memorias, RAM, motherboard, etc.</span>
            </li>
            <li className="flex items-start gap-2">
              <Package className="h-4 w-4 text-compucity-green mt-0.5 shrink-0" />
              <span><strong>Conectividad:</strong> router, modem router, access point, switch, antenas, etc.</span>
            </li>
            <li className="flex items-start gap-2">
              <Package className="h-4 w-4 text-compucity-green mt-0.5 shrink-0" />
              <span>Memorias y pendrives</span>
            </li>
          </ul>
        </div>
        <p className="text-gray-700 leading-relaxed mt-3">
          El plazo de demora mínimo para que se te entregue el nuevo producto son <strong>48h hábiles</strong>. Este tiempo empieza a correr una vez que nuestros asesores hayan aprobado el cambio o devolución. No se realizará la entrega hasta que no se haya abonado la diferencia de dinero, en caso de ser necesario.
        </p>
      </section>

      {/* Sección: Envío dentro de los 10 días */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Truck className="h-5 w-5 text-compucity-green" />
          ¿Debo abonar el envío nuevamente?
        </h2>
        <p className="text-gray-700 leading-relaxed">
          Dentro de los <strong>diez días</strong> desde que recibiste el producto, Compucity cubrirá los gastos de envío del producto fallado como su reposición, siempre y cuando al recibirlo no encuadre dentro de las <a href="#exclusiones" className="text-compucity-green hover:underline">Exclusiones y Consideraciones</a>. De ser así, el cliente deberá abonar por adelantado el costo del envío como el de reposición, previo al despacho.
        </p>
        <p className="text-gray-700 leading-relaxed mt-3">
          Si no tenemos stock de un producto a la hora de realizar un cambio, podemos devolverte el dinero u ofrecerte otro similar.
        </p>
        <p className="text-gray-700 leading-relaxed mt-3">
          Recordá que el producto debe estar en las mismas condiciones en que fue recibido (en el embalaje original, sin indicios de uso, con la factura/ticket original, manual y todos los accesorios si correspondiera).
        </p>
      </section>

      {/* Sección: Gestión pasados los 10 días */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Gestión de garantía pasados los 10 días</h2>
        <p className="text-gray-700 leading-relaxed">
          Vencido el plazo de los diez días, todos los productos cuentan con <strong>garantía oficial</strong>, debiendo ser gestionada por el cliente con la marca correspondiente o tramitada por medio de Compucity como intermediario, dependiendo del caso.
        </p>
        <p className="text-gray-700 leading-relaxed mt-3">
          Si el producto presenta indicios de golpes o mal uso, la garantía queda anulada. Dicha garantía no cubre los inconvenientes ocasionados por malware o el uso indebido del sistema operativo, programas incompatibles o configuraciones erróneas.
        </p>
        <p className="text-gray-700 leading-relaxed mt-3">
          El producto debe ser enviado de vuelta a Compucity para probarlo, luego de esto nosotros se lo enviamos al proveedor, quien decidirá si debe ser cambiado, reparado o si se debe generar una nota de crédito. El plazo de demora es de <strong>15 a 20 días hábiles como mínimo</strong>.
        </p>

        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-900 mb-2">¿Debo abonar el envío nuevamente?</p>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-compucity-green mt-1">•</span>
              <span><strong>Dentro de Córdoba Capital, Sierras Chicas y Valle de Punilla:</strong> no es necesario que abones envío de vuelta si el producto presentó fallas o no recibiste lo que pediste.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-compucity-green mt-1">•</span>
              <span><strong>Si sos del interior de la Provincia de Córdoba u otra Provincia</strong> y el producto presentó fallas, el cliente debe abonar el envío del producto de vuelta a Compucity.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-compucity-green mt-1">•</span>
              <span>El costo del envío corre por cuenta del cliente sin excepción. Podés enviarnos el producto por la compañía de correo/transporte que prefieras.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-compucity-green mt-1">•</span>
              <span>Nosotros nos encargamos de abonar el envío del producto para el proveedor y el de vuelta a tu hogar.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Sección: Exclusiones */}
      <section id="exclusiones" className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Exclusiones
        </h2>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
          <p className="text-sm font-medium text-amber-900 mb-3">La garantía NO cubre los siguientes casos:</p>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2"><span className="text-amber-600 mt-1">•</span><span>Daño físico del producto o muestras de maltrato/mal uso, aun cuando el mismo no afecte el funcionamiento del equipo.</span></li>
            <li className="flex items-start gap-2"><span className="text-amber-600 mt-1">•</span><span>Daños total, parcial o ausencia de calcos de garantía, cualquiera sea su causa (ejemplo: calcos de garantía cortado por las bahías del gabinete, calcos sobre tornillos).</span></li>
            <li className="flex items-start gap-2"><span className="text-amber-600 mt-1">•</span><span>Daños causados por agentes externos (ejemplo: sobretensión por tormentas).</span></li>
            <li className="flex items-start gap-2"><span className="text-amber-600 mt-1">•</span><span>Daños causados por errores de ensamble.</span></li>
            <li className="flex items-start gap-2"><span className="text-amber-600 mt-1">•</span><span>Componentes quemados, transistores, integrados, pistas, chips.</span></li>
            <li className="flex items-start gap-2"><span className="text-amber-600 mt-1">•</span><span>Modificaciones del producto, cambio de frente en lectores ópticos, pintura, escritura, etc.</span></li>
            <li className="flex items-start gap-2"><span className="text-amber-600 mt-1">•</span><span>Fallas provocadas por software.</span></li>
            <li className="flex items-start gap-2"><span className="text-amber-600 mt-1">•</span><span>Todo equipo que contenga fuente de alimentación externa y ésta haya sido reemplazada por otra que no sea original (monitores, notebooks, impresoras, AIO, conectividades, modem, router, cámaras, etc.).</span></li>
            <li className="flex items-start gap-2"><span className="text-amber-600 mt-1">•</span><span>Equipos de impresión que no contengan insumos originales (cartuchos, toner, tintas).</span></li>
            <li className="flex items-start gap-2"><span className="text-amber-600 mt-1">•</span><span>Insumos con carga menor al 90% del peso original del mismo (toners, cartuchos, tintas).</span></li>
          </ul>
        </div>
      </section>

      {/* Sección: Consideraciones */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Consideraciones</h2>

        <div className="space-y-4">
          {/* Monitores */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Monitores LCD</h3>
            <p className="text-sm text-gray-700 mb-2">
              Las pantallas con tecnología LCD/LED estarán sujetas a las normativas del fabricante. En todos los casos será considerado "producto en normal estado" a las pantallas y/o monitores que tengan una cantidad igual o menor de píxeles defectuosos según la siguiente lista:
            </p>
            <ul className="text-sm text-gray-700 ml-4 space-y-1">
              <li>• Monitores 15" hasta 7 píxeles defectuosos</li>
              <li>• Monitores 17", 19" hasta 10 píxeles defectuosos</li>
              <li>• Monitores 21", 24" hasta 17 píxeles defectuosos</li>
              <li>• Notebooks entre 5 y 10 píxeles defectuosos o de 4 a 7 píxeles defectuosos consecutivos</li>
            </ul>
          </div>

          {/* Gabinetes y kits */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Gabinetes y kits</h3>
            <ul className="text-sm text-gray-700 ml-4 space-y-1">
              <li>• Los teclados, mouse y parlantes provistos en "Kits" tienen <strong>1 (un) mes</strong> de garantía.</li>
              <li>• Las fuentes de los gabinetes tienen <strong>1 (un) mes</strong> de garantía (no aplica a fuentes certificadas).</li>
            </ul>
          </div>

          {/* Notebooks */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Notebooks</h3>
            <ul className="text-sm text-gray-700 ml-4 space-y-1">
              <li>• Los packs de baterías, transformadores y fuentes de alimentación tienen <strong>1 (un) mes</strong> de garantía.</li>
              <li>• Las pantallas con tecnología LCD/LED estarán sujetas a las normativas del fabricante. Se considera "producto en normal estado" a las pantallas que tengan entre 5 y 10 píxeles defectuosos o de 4 a 7 píxeles defectuosos consecutivos.</li>
            </ul>
          </div>

          {/* Tablets */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Tablets</h3>
            <p className="text-sm text-gray-700">
              Las tablets se reemplazan directamente dentro de las <strong>72 hs hábiles</strong> posteriores a la fecha de factura de compra, una vez constatada la falla de la misma. Transcurrido ese tiempo, la empresa sólo recepcionará el equipo y el mismo se enviará a su respectivo Centro autorizado de servicio. La demora en la reparación o reemplazo dependerá de la respuesta de dicho Centro de servicio (la demora dependerá de la falla, disponibilidad de repuestos o de stock de reemplazo por parte de la marca), con tiempos de respuesta entre <strong>30 y 90 días aproximadamente</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* CTA: contacto */}
      <div className="mt-10 pt-6 border-t border-gray-200 text-center">
        <p className="text-gray-600 mb-4">¿Tenés dudas sobre nuestra política de garantía o necesitas gestionar un cambio?</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/contacto"
            className="inline-flex items-center gap-2 bg-compucity-green hover:bg-compucity-green-dark text-white font-medium px-5 py-2.5 rounded-lg transition"
          >
            Contactanos
          </Link>
          <a
            href="https://wa.me/5493548402056?text=Hola!%20Quisiera%20hacer%20una%20consulta%20sobre%20garantía"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium px-5 py-2.5 rounded-lg transition"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
