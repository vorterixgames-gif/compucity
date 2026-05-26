import { MapPin, Phone, Mail, MessageCircle, Clock } from 'lucide-react'

export default function ContactoPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Contacto</h1>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Info */}
        <div className="space-y-6">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-compucity-green mt-1 shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900">Dirección</h3>
              <p className="text-gray-600 text-sm">La Falda, Valle de Punilla, Córdoba, Argentina</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 text-compucity-green mt-1 shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900">Teléfono / WhatsApp</h3>
              <a href="https://wa.me/5493517656918" target="_blank" className="text-compucity-green hover:text-compucity-green-dark text-sm">
                +54 9 351 765-6918
              </a>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-compucity-green mt-1 shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900">Email</h3>
              <p className="text-gray-600 text-sm">info@compucity.com.ar</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-compucity-green mt-1 shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900">Horarios</h3>
              <p className="text-gray-600 text-sm">Lunes a Viernes: 9:00 - 18:00</p>
              <p className="text-gray-600 text-sm">Sábados: 9:00 - 13:00</p>
            </div>
          </div>

          <a
            href="https://wa.me/5493517656918?text=Hola!%20Quiero%20hacer%20una%20consulta"
            target="_blank"
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition"
          >
            <MessageCircle className="h-5 w-5" />
            Escribinos por WhatsApp
          </a>
        </div>

        {/* Map placeholder */}
        <div className="bg-gray-100 rounded-lg flex items-center justify-center min-h-[300px] border">
          <div className="text-center text-gray-400">
            <MapPin className="h-12 w-12 mx-auto mb-2" />
            <p className="text-sm">Google Maps</p>
            <p className="text-xs">La Falda, Córdoba</p>
          </div>
        </div>
      </div>
    </div>
  )
}
