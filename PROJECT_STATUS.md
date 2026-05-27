# Compucity - Project Status

**Última actualización:** 2026-05-28

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

## 🎨 Identidad Visual
- **Verde principal:** #3A8B68
- **Verde oscuro:** #2F6F55
- **Verde claro:** #75AD95
- **Verde 50:** #EFF5F2
- **Verde 100:** #D7E7E0
- **Verde 900:** #1A3E2E
- **Estilo:** Claro, elegante, limpio

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
- **Nuestros Productos:** 3 secciones — Notebooks, PCs Armadas, Monitores
- **Marcas:** 8 logos via SimpleIcons CDN (AMD, Intel, NVIDIA, Kingston, Corsair, ASUS, Samsung, Seagate)
- **Barra superior:** Marquee dinámico con info de la tienda

### Hero Slides
| # | Badge | Título | CTA | Imagen |
|---|-------|--------|-----|--------|
| 1 | Armá tu PC | Armá tu PC **gamer** | Comenzar a armar → `/arma-tu-pc` | `hero-slide-pc-builder.png` |
| 2 | Notebooks | Notebooks y **laptops** | Ver notebooks → `/categoria/notebooks` | `hero-slide-notebooks.png` |
| 3 | Componentes | Placas de video y **componentes** | Ver componentes → `/categoria/componentes` | `hero-slide-components.png` |
| 4 | Periféricos | Periféricos **gaming** | Ver periféricos → `/categoria/perifericos` | `hero-slide-perifericos.png` |

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
- **Productos:** 1,212 activos
- **Categorías:** 61 (jerárquicas con parentId)
- **Proveedores:** 1 (Invid Computers)
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
- **Proveedor:** Invid Computers (invidcomputers.com)
- **API:** `/api/admin/suppliers/sync` — Sincroniza productos desde Invid
- **Mapeo:** `supplier_category_mappings` — 85 mapeos de categorías Invid → categorías Compucity
- **Mapeo inteligente:** Palabras clave en nombres de categoría para mapeo automático
- **Precios dinámicos:** costPrice × dollarRate × (1 + markup/100), con descuento efectivo

## 📁 Estructura Key Files
```
src/app/page.tsx                           — Home (Hero + Productos + Marcas)
src/app/layout.tsx                         — Layout con marquee + favicon
src/app/globals.css                        — Variables CSS, paleta, animación marquee
src/app/arma-tu-pc/page.tsx                — Configurador de PCs (851 líneas)
src/app/api/pc-builder/route.ts            — API de PC Builder con filtros compat
src/lib/compatibility.ts                   — Motor de compatibilidad (socket, DDR, TDP, wattage)
src/lib/queries.ts                         — Queries de DB (homepage, productos, etc.)
src/lib/db.ts                              — Conexión Turso
src/lib/dollar.ts                          — Cotización del dólar
src/lib/format-product.ts                  — Formateo de nombres de productos
src/components/ui-custom/HeroSection.tsx   — Hero Carrusel (4 slides, autoplay)
src/components/ui-custom/CompucityLogo.tsx — Logo componente
src/components/layout/Navbar.tsx           — Nav con user dropdown + Arma tu PC
src/components/layout/Footer.tsx           — Footer con links
src/components/layout/WhatsAppButton.tsx   — Botón flotante WhatsApp
src/components/BrandLogos.tsx              — Logos de marcas (SimpleIcons CDN)
```

## 🔗 Repositorio y Deploy
- **GitHub:** https://github.com/vorterixgames-gif/compucity
- **Vercel:** Auto-deploy desde main → https://my-project-eight-liard-96.vercel.app
- **DB:** Turso `libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io`

## 📦 Backups
- `backups/2026-05-27/` — Primer backup completo (BD + código)
- `backups/2026-05-28/compucity-db.json` — Backup de BD (1,212 productos, 61 categorías)

## ✅ Funcionalidades Completadas
- [x] Homepage con hero carrusel, productos por categoría, logos de marcas, marquee
- [x] Catálogo de productos con categorías jerárquicas
- [x] Configurador "Arma tu PC" con 10 slots
- [x] Sistema de compatibilidad (socket, DDR, wattage, TDP)
- [x] Autenticación de clientes (login/registro/perfil)
- [x] Checkout con provincia y cotización de envío
- [x] Mis Pedidos con tracking y perfil editable
- [x] Sincronización de proveedores (Invid Computers)
- [x] Precios dinámicos (dólar × markup × descuento efectivo)
- [x] Formateo automático de nombres de productos
- [x] Tablets como categoría independiente
- [x] Backups en GitHub

## 📝 Pendientes
- [ ] SEO optimization (meta tags, sitemap, structured data)
- [ ] Carrito de compras (actualmente solo WhatsApp)
- [ ] Mejora de imágenes de productos (sin saturar la BD)
- [ ] Integración con pasarela de pagos (futuro)

## 📝 Historial de Cambios
- **2026-05-28:** Compatibilidad de refrigeración — Filtrado por socket + TDP del procesador, estimación de TDP para 40+ modelos de CPUs, badges de tipo/capacidad/sockets en coolers, fans de gabinete siempre compatibles
- **2026-05-28:** Deploy a Vercel — Sincronización del repo local con GitHub, primer deploy exitoso del sistema de compatibilidad
- **2026-05-27:** Sistema de compatibilidad en Arma tu PC — Filtrado de mothers por socket, RAM por DDR, fuentes por wattaje de GPU. Motor de compatibilidad basado en regex de nombres de productos
- **2026-05-27:** Homepage mejorada — Productos (Notebooks/PCs/Monitores), logos SimpleIcons CDN, marquee dinámico, hero sin texto en imágenes
- **2026-05-27:** Categorías — Tablets separada de Notebooks como categoría independiente
- **2026-05-27:** Sincronización Invid — Mapeo inteligente de categorías, 1,212 productos sincronizados
- **2026-05-27:** Login de clientes + datos de envío — Auth completa, provincia, shippingDetails, tracking
- **2026-05-27:** Rediseño del Hero — Carrusel full-width con 4 slides y autoplay
- **2026-05-27:** Deploy inicial, logo, favicon, paleta de colores, navbar, footer
