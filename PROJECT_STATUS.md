# Compucity - Project Status

**Última actualización:** 2026-05-29

## 🏪 Proyecto
- **Nombre:** Compucity - Tu Mundo Digital
- **Tipo:** E-commerce de informática (sin pasarela de pagos, pedidos por WhatsApp)
- **Ubicación:** La Falda, Valle de Punilla, Córdoba, Argentina
- **WhatsApp:** 3517656918

## 🛠️ Stack Tecnológico
- **Framework:** Next.js 16 + TypeScript
- **Estilos:** Tailwind CSS 4 + shadcn/ui
- **Base de datos:** Turso (libSQL) + Prisma ORM (solo schema, raw SQL en runtime)
- **Auth:** Custom HMAC cookie auth (admin_token + customer_token)
- **Estado:** Zustand + React Query
- **Deploy:** GitHub → Vercel (auto-deploy on push)

## 🎨 Identidad Visual — Paleta Verde Aprobada
| Clase                  | Hex       | Uso                              |
|------------------------|-----------|----------------------------------|
| compucity-green-50     | #EFF5F2   | Fondos suaves                    |
| compucity-green-100    | #D7E7E0   | Bordes claros                    |
| compucity-green-200    | #B0D4C2   | Textos secundarios claros        |
| compucity-green-300    | #8CC0A8   | Acentos suaves                   |
| compucity-green-400    | #5FA882   | Bordes hover                     |
| compucity-green-500    | #3A8B68   | Color principal de marca         |
| compucity-green-600    | #2F7A5A   | Botones, textos destacados       |
| compucity-green-700    | #256549   | Precios, botones hover           |
| compucity-green-800    | #1B4D37   | Gradientes navbar, badges        |
| compucity-green-900    | #1A3E2E   | Fondos oscuros, sección CTA      |
| compucity-green-950    | #0F2A1E   | Marquee, fondos muy oscuros      |
| compucity-green        | #3A8B68   | Color base                       |
| compucity-green-light  | #75AD95   | Acentos claros                   |
| compucity-green-dark   | #2F6F55   | Hover botones                    |
| compucity-dark         | #1a1a2e   | Dark mode fallback               |
| compucity-dark-light   | #2d2d44   | Dark mode fallback               |

**⚠️ IMPORTANTE:** Esta paleta fue aprobada por el dueño. NO modificar sin autorización explícita.
Ver `SAFETY-RULES.md` para reglas de protección.

## 🖼️ Logo
- **Archivo:** `public/images/logo-compucity-icon.png` (191x180px, recortado sin padding transparente)
- **Componente:** `src/components/ui-custom/CompucityLogo.tsx`
  - Variantes: full (icono + COMPU+CITY + tagline), icon, horizontal
  - Tamaños: sm(30px), md(36px), lg(42px), xl(48px) para el ícono
  - Gap: gap-1.5 (6px) entre ícono y texto
  - Texto: "COMPU" en color texto + "CITY" en verde #3A8B68
  - Tagline: "TU MUNDO DIGITAL"

## 📄 Favicon
- `/public/favicon.ico` (16, 32, 48, 64px)
- `/public/favicon-32x32.png`
- `/public/favicon-16x16.png`
- `/public/apple-touch-icon.png` (180x180)
- `/public/android-chrome-192x192.png` (192x192)

## 🏠 Homepage
- **Hero:** Carrusel full-width con 4 slides, autoplay (5s), Framer Motion
- **Barra de beneficios:** Gradiente verde con íconos (envíos, compra segura, WhatsApp, asesoramiento)
- **Marcas:** 8 logos via SimpleIcons CDN (AMD, Intel, NVIDIA, Kingston, Corsair, ASUS, Samsung, Seagate)
- **Categorías:** Íconos con bordes verdes y hover verde
- **PC Armadas:** Fondo con gradiente verde suave
- **Monitores:** Fondo verde oscuro (compucity-green-900) para contraste
- **Notebooks:** Fondo con gradiente verde suave
- **CTA "¿No encontrás lo que buscás?":** Fondo gradiente verde oscuro (green-900/800/950), botón blanco
- **Barra superior:** Marquee dinámico con gradiente verde oscuro (green-950/800/700)

### Hero Slides
| # | Badge | Título | CTA | Imagen |
|---|-------|--------|-----|--------|
| 1 | Armá tu PC | Armá tu PC **gamer** | Comenzar a armar → `/arma-tu-pc` | `hero-slide-pc-builder.png` |
| 2 | Notebooks | Notebooks y **laptops** | Ver notebooks → `/categoria/notebooks` | `hero-slide-notebooks.png` |
| 3 | Componentes | Placas de video y **componentes** | Ver componentes → `/categoria/componentes-de-pc` | `hero-slide-components.png` |
| 4 | Periféricos | Periféricos **gaming** | Ver periféricos → `/categoria/perifericos` | `hero-slide-perifericos.png` |

## 🧭 Navbar
- **Top bar:** Marquee con gradiente verde oscuro (green-950→800→700)
- **Barra principal:** Fondo blanco, logo + buscador + usuario + carrito
  - Buscador: Input con borde verde al focus, botón verde
  - Usuario: Dropdown con avatar si está logueado, link "Mi Cuenta" si no
  - Carrito: Badge verde con cantidad, animación de bounce al agregar
  - Ícono usuario mobile: A la izquierda del carrito
- **Barra de navegación:** Gradiente verde (green-800→700→800)
  - Dropdown de categorías: Panel con fondo verde-50 a la izquierda
  - Links: Arma tu PC, Contacto, + 4 primeras categorías
- **Menú mobile:** Categorías desplegables, ícono usuario, SIN "Arma tu PC/Contacto/WhatsApp" (ya están en el nav)

## 🔘 Botones Flotantes
- **Scroll-to-top:** Abajo a la derecha, círculo verde, aparece después de 400px scroll
- **WhatsApp:** Abajo a la izquierda, tooltip a la derecha

## 🔐 Sistema de Autenticación de Clientes
- **Login/Registro:** `/mis-pedidos` — Página con tabs Login / Registrarse
- **Cookie:** `customer_token` = `email.hmac_signature` (httpOnly, 30 días)
- **Perfil editable:** Nombre, teléfono, DNI, dirección, ciudad, provincia, CP
- **Navbar:** Dropdown con avatar del usuario logueado, link a Mis Pedidos, cerrar sesión
- **APIs:** Login, Registro, Perfil, Pedidos, Update, Logout

## 📦 Datos de Envío
- **Provincia:** Dropdown con las 24 provincias argentinas
- **shippingDetails:** JSON con carrier, serviceName, estimatedDays, price
- **Tracking URLs:** Andreani, Correo Argentino, OCA con links de seguimiento
- **Pre-fill:** Dirección autocompletada si el cliente está logueado

## 🖥️ Arma tu PC — Configurador de PCs
- **Ruta:** `/arma-tu-pc`
- **API:** `GET /api/pc-builder` — productos por slot con filtros de compatibilidad
- **Motor:** `src/lib/compatibility.ts` — Extracción de socket, DDR, TDP y wattage desde nombres de productos
- **10 slots:** Procesador, Motherboard, RAM, Placa de Video, SSD, HDD, Fuente, Gabinete, Refrigeración, Pasta Térmica
- **Checkout:** WhatsApp con resumen de componentes y precios
- **Colores:** Paleta verde completa (badges verdes, sidebar verde, botones verdes)

### 🔄 Sistema de Compatibilidad
- **Procesador → Motherboard:** Filtra por socket (AM4, AM5, LGA 1700, LGA 1851)
- **Motherboard → RAM:** Filtra por DDR (DDR4, DDR5) + excluye SODIMM
- **GPU → Fuente:** Recomienda wattaje mínimo según la placa de video
- **Procesador → Refrigeración:** Filtra por socket compatible + TDP del procesador

### TDP de Procesadores (estimado)
| Rango | Modelos | TDP |
|-------|---------|-----|
| Entry | Ryzen 3 3200G, i3-12100F, i3-14100F | 58-65W |
| Mid | Ryzen 5 5500/8500G/8600G, i5-12400F/14400 | 65W |
| Mid-High | Ryzen 5 7600X, Ryzen 7 5700X, i7-12700F/14700F | 105-125W |
| High | Ryzen 7 7700X/9700X, Ryzen 9 7900X, i9-14900F | 105-170W |
| Ultra | Core Ultra 7 265KF, Core Ultra 9 285K | 125W |

### Capacidad de Refrigeración (estimada)
| Tipo | Capacidad |
|------|-----------|
| Air Cooler básico (95W) | 95W |
| Air Cooler tower / premium | 200W |
| AIO 120mm | 120W |
| AIO 240mm | 200W |
| AIO 280mm | 250W |
| AIO 360mm | 280W |
| AIO 420mm | 350W |
| Fan Cooler (gabinete) | Siempre compatible |

### UI de Compatibilidad
- **Badges:** Socket (verde), DDR (azul), Wattage (ámbar), Tipo cooler (púrpura), TDP (verde)
- **Banners azules:** Indican qué filtro está activo y por qué componente
- **Sección incompatibles:** Colapsable con motivo de incompatibilidad
- **Sidebar:** Estado de compatibilidad en tiempo real (socket, DDR, wattage, TDP)

## 📊 Base de Datos
- **Productos:** 2,697 activos
- **Categorías:** 66 (jerárquicas con parentId)
- **Proveedores:** 2
- **Mapeos proveedor→categoría:** 85
- **Config de tienda:** 20 registros (dollar, markup, etc.)

### Árbol de Categorías
- **Notebooks** → gamer, oficina, diseño, ultrabooks
- **PC Armadas** → gamer-pc, oficina-pc, diseño-pc, mini-pc
- **Componentes de PC** → placas-de-video, microprocesadores, motherboards, memorias-ram, discos-ssd, discos-hdd, fuentes, gabinetes, refrigeracion, pastas-termicas, combos
- **Monitores** → gamer-mon, oficina-mon, diseño-mon, soportes-y-brazos
- **Periféricos** → teclados, mouse, auriculares, mousepads, parlantes, webcams, microfonos, joysticks, kits-gamer
- **Impresión** → laser, inyeccion, sistema-continuo, toners-y-cartuchos
- **Conectividad y Redes** → routers-wifi, switches, cables-y-adaptadores, placas-de-red
- **Almacenamiento Externo** → discos-externos, pendrives, micro-sd
- **Accesorios** → cargadores, bases, fundas-mochilas, ups, sillas-gamer, escritorios
- **Tablets** → (categoría independiente)

## 🔗 Sincronización de Proveedores
- **Proveedor:** Invid Computers (invidcomputers.com) + Elit
- **API:** `/api/admin/suppliers/sync` — Sincroniza productos desde Invid
- **Mapeo:** `supplier_category_mappings` — 85 mapeos de categorías Invid → categorías Compucity
- **Mapeo inteligente:** Palabras clave en nombres de categoría para mapeo automático
- **Precios dinámicos:** costPrice × dollarRate × (1 + markup/100), con descuento efectivo

## 📁 Estructura Key Files
```
src/app/page.tsx                           — Home (Hero + Productos + Marcas)
src/app/layout.tsx                         — Layout con marquee + favicon
src/app/globals.css                        — Variables CSS, paleta completa verde, animaciones
src/app/arma-tu-pc/page.tsx                — Configurador de PCs con compatibilidad
src/app/api/pc-builder/route.ts            — API de PC Builder con filtros compat
src/lib/compatibility.ts                   — Motor de compatibilidad (socket, DDR, TDP, wattage)
src/lib/queries.ts                         — Queries de DB (homepage, productos, etc.)
src/lib/db.ts                              — Conexión Turso
src/lib/dollar.ts                          — Cotización del dólar
src/lib/format-product.ts                  — Formateo de nombres de productos
src/components/ui-custom/HeroSection.tsx   — Hero Carrusel (4 slides, autoplay)
src/components/ui-custom/ProductCard.tsx   — Cards con bordes/badges/precios verdes
src/components/ui-custom/CompucityLogo.tsx — Logo componente
src/components/layout/Navbar.tsx           — Nav con user dropdown, marquee verde, categorías
src/components/layout/Footer.tsx           — Footer con links
src/components/layout/CategoryIcons.tsx    — Íconos de categorías con acentos verdes
src/components/layout/BrandLogos.tsx       — Logos de marcas con bordes verdes
src/components/layout/WhatsAppButton.tsx   — Botón flotante WhatsApp (izquierda)
src/components/layout/ScrollToTop.tsx      — Botón scroll-to-top (derecha)
scripts/pre-change-safeguard.sh            — Verifica integridad de colores antes de cambios
scripts/auto-backup.sh                     — Backup automático código + git + BD
SAFETY-RULES.md                            — Reglas obligatorias para cambios
```

## 🔗 Repositorio y Deploy
- **GitHub:** https://github.com/vorterixgames-gif/compucity
- **Vercel:** Auto-deploy desde main
- **DB:** Turso `libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io`

## 📦 Backups
- `backups/compucity-backup-20260529-safe/` — **BACKUP SEGURO** post-paleta verde (29/05 15:40)
  - `codigo-compucity.tar.gz` (35MB) — Código sin git
  - `codigo-con-git.tar.gz` (118MB) — Código + git history completo
  - `turso-db.json` (2.9MB) — 2,697 productos, 66 categorías, todo completo
- `backups/compucity-backup-20260529-133354` — Backup anterior
- `backups/2026-05-28/compucity-db.json` — Backup de BD

### Cómo restaurar un backup
```bash
# Restaurar código
cd /home/z/my-project/compucity-repo
tar xzf /home/z/my-project/backups/compucity-backup-20260529-safe/codigo-con-git.tar.gz

# Restaurar base de datos (requiere script personalizado con turso-db.json)
```

## 🛡️ Protecciones y Reglas de Seguridad
Ver `SAFETY-RULES.md` para reglas completas. Resumen:
1. **SIEMPRE** hacer backup antes de cambios mayores: `bash scripts/auto-backup.sh "descripción"`
2. **NUNCA** reescribir un archivo completo — solo ediciones quirúrgicas
3. **NUNCA** modificar `globals.css` o `tailwind.config.ts` sin autorización
4. **Verificar** colores después de cada cambio: `bash scripts/pre-change-safeguard.sh`
5. **Proceso seguro:** backup → branch → editar → verificar → build → push

## ✅ Funcionalidades Completadas
- [x] Homepage con hero carrusel, productos por categoría, logos de marcas, marquee
- [x] Paleta verde completa aprobada (14 tonos de green + dark)
- [x] Catálogo de productos con categorías jerárquicas
- [x] Configurador "Arma tu PC" con 10 slots y sistema de compatibilidad
- [x] Autenticación de clientes (login/registro/perfil)
- [x] Checkout con provincia y cotización de envío
- [x] Mis Pedidos con tracking y perfil editable
- [x] Sincronización de proveedores (Invid Computers + Elit)
- [x] Precios dinámicos (dólar × markup × descuento efectivo)
- [x] Formateo automático de nombres de productos
- [x] Navbar con marquee verde, dropdown categorías, menú mobile mejorado
- [x] Botón scroll-to-top (abajo derecha)
- [x] Botón WhatsApp flotante (abajo izquierda)
- [x] Mobile: ícono usuario al lado del carrito, categorías desplegables
- [x] Mobile: fix overflow en Arma tu PC
- [x] Sistema de safeguards y backups automáticos
- [x] Backups seguros en GitHub

## 📝 Pendientes
- [ ] SEO optimization (meta tags, sitemap, structured data)
- [ ] Carrito de compras (actualmente solo WhatsApp)
- [ ] Mejora de imágenes de productos (sin saturar la BD)
- [ ] Integración con pasarela de pagos (futuro)
- [ ] 3 productos no muestran en frontend (investigar)
- [ ] Credenciales API Invid (verificar)

## 📝 Historial de Cambios
- **2026-05-29:** Safeguards y protección de paleta — Scripts pre-change-safeguard.sh y auto-backup.sh, SAFETY-RULES.md, backup seguro post-paleta verde
- **2026-05-29:** Restauración de paleta verde — Force push para revertir commits que rompieron colores, restauración al commit e8a990e
- **2026-05-29:** Fix mobile overflow — overflow-x:hidden en html/body, responsive adjustments en Arma tu PC
- **2026-05-29:** Menú mobile mejorado — Ícono usuario al lado del carrito, categorías desplegables, sin Arma tu PC/Contacto/WhatsApp
- **2026-05-29:** Botón scroll-to-top abajo a la derecha
- **2026-05-29:** Botón WhatsApp movido a la izquierda
- **2026-05-29:** Dropdown categorías sin IIFE (compatible con Turbopack), muestra subcategorías al abrir
- **2026-05-29:** Paleta verde expandida — Agregar tonos 200-800 y 950, ProductCard con bordes/badges verdes, secciones alternadas con gradientes, Navbar marquee con gradiente verde
- **2026-05-28:** Compatibilidad de refrigeración — Filtrado por socket + TDP del procesador
- **2026-05-28:** Deploy a Vercel — Sincronización del repo local con GitHub
- **2026-05-27:** Sistema de compatibilidad en Arma tu PC — Filtrado de mothers por socket, RAM por DDR, fuentes por wattaje
- **2026-05-27:** Homepage mejorada — Productos, logos SimpleIcons CDN, marquee, hero sin texto en imágenes
- **2026-05-27:** Categorías — Tablets separada de Notebooks
- **2026-05-27:** Sincronización Invid — Mapeo inteligente, 1,212 productos sincronizados
- **2026-05-27:** Login de clientes + datos de envío
- **2026-05-27:** Rediseño del Hero — Carrusel full-width con 4 slides
- **2026-05-27:** Deploy inicial, logo, favicon, paleta de colores, navbar, footer
