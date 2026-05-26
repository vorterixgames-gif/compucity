# Compucity - Project Status

**Última actualización:** 2026-05-27

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

## 🏠 Hero Section — Carrusel Full-Width
- **Componente:** `src/components/ui-custom/HeroSection.tsx`
- **Tipo:** Carrusel full-width con 4 slides y autoplay (5s)
- **Navegación:** Flechas laterales, dots indicadores, swipe táctil, teclado (←→)
- **Barra de progreso** animada en la parte inferior
- **Pausa automática** al hacer hover
- **Animaciones:** Framer Motion (slide transitions + fade-up de contenido)
- **Sin info de pagos ni envíos** en el hero (a petición del cliente)

### Slides
| # | Badge | Título | CTA Principal | CTA Secundario | Imagen |
|---|-------|--------|---------------|----------------|--------|
| 1 | Armá tu PC | Armá tu PC **gamer** | Comenzar a armar → `/arma-tu-pc` | Ver componentes → `/categoria/componentes` | `hero-slide-pc-builder.png` |
| 2 | Notebooks | Notebooks y **laptops** | Ver notebooks → `/categoria/notebooks` | Ver todas las marcas → `/categoria/todos` | `hero-slide-notebooks.png` |
| 3 | Componentes | Placas de video y **componentes** | Ver componentes → `/categoria/componentes` | Ver productos → `/categoria/todos` | `hero-slide-components.png` |
| 4 | Periféricos | Periféricos **gaming** | Ver periféricos → `/categoria/perifericos` | Ver todo → `/categoria/todos` | `hero-slide-perifericos.png` |

### Imágenes del Hero
- `public/images/hero-slide-pc-builder.png` — PC gaming con RGB
- `public/images/hero-slide-notebooks.png` — Notebook premium
- `public/images/hero-slide-components.png` — Placa de video / GPU
- `public/images/hero-slide-perifericos.png` — Teclado y mouse gaming
- `public/images/pcb-pattern.svg` — Patrón PCB (uso legacy, ya no en hero)
- `public/images/circuit-pattern.svg` — Patrón circuito (uso legacy)

## 🔐 Sistema de Autenticación de Clientes
- **Login/Registro:** `/mis-pedidos` — Página con tabs Login / Registrarse
- **Cookie:** `customer_token` = `email.hmac_signature` (httpOnly, 30 días)
- **Perfil editable:** Nombre, teléfono, DNI, dirección, ciudad, provincia, CP
- **Navbar:** Dropdown con avatar del usuario logueado, link a Mis Pedidos, cerrar sesión
- **Mobile:** Sección de usuario en menú móvil con avatar, nombre, botones
- **APIs:**
  - `POST /api/customer/login` — Login con email + contraseña
  - `POST /api/customer/register` — Registro con datos personales + dirección
  - `GET /api/customer/me` — Obtener perfil actual
  - `GET /api/customer/orders` — Pedidos del cliente (match por email o customerId)
  - `PUT /api/customer/profile` — Actualizar perfil (dirección, teléfono, etc.)
  - `POST /api/customer/logout` — Cerrar sesión

## 📦 Datos de Envío (Mejorados)
- **Provincia:** Campo agregado al checkout (dropdown con las 24 provincias argentinas)
- **shippingDetails:** Nuevo campo en la tabla `orders` — JSON estructurado con carrier, serviceName, estimatedDays, price
- **Migración:** `POST /api/admin/migrate` — Agrega la columna `shippingDetails` a la DB existente
- **Vista en Mis Pedidos:** Muestra carrier, servicio, plazo estimado, y tracking con link externo
- **Tracking URLs:** Detecta Andreani, Correo Argentino, OCA y genera links de seguimiento
- **Legacy:** Pedidos antiguos con info de envío en `notes` se parsean automáticamente
- **Pre-fill:** Si el cliente está logueado, su dirección se autocompleta en el checkout

## 📁 Estructura Key Files
```
src/app/page.tsx              — Home (Hero Carrusel + Productos)
src/app/layout.tsx            — Layout con favicon metadata
src/app/globals.css           — Variables CSS, paleta #3A8B68
src/app/checkout/page.tsx     — Checkout con provincia + shippingDetails JSON
src/app/mis-pedidos/page.tsx  — Login/Registro/Dashboard de pedidos + perfil editable
src/components/ui-custom/HeroSection.tsx  — Hero Carrusel (4 slides, autoplay)
src/components/ui-custom/CompucityLogo.tsx — Logo componente
src/components/layout/Navbar.tsx  — Nav con user dropdown (avatar + logout)
src/components/layout/Footer.tsx  — Footer con logo lg whiteText
src/components/layout/WhatsAppButton.tsx — Botón flotante
src/lib/customer-auth.ts      — Auth de clientes (login, registro, perfil, updateCustomer)
src/lib/admin-auth.ts         — Auth de admin (compartido: hash, verify, sign)
src/app/api/customer/profile/route.ts — PUT actualizar perfil
src/app/api/customer/login/route.ts   — POST login
src/app/api/customer/register/route.ts — POST registro
src/app/api/customer/orders/route.ts  — GET pedidos del cliente
src/app/api/customer/me/route.ts      — GET perfil actual
src/app/api/admin/migrate/route.ts    — POST migración DB
src/app/api/orders/route.ts           — GET/POST pedidos (shippingDetails en campo propio)
tailwind.config.ts            — Paleta Compucity
public/images/hero-slide-*.png — Imágenes del carrusel hero
public/images/logo-compucity-icon.png — Logo recortado
```

## 🔗 Repositorio
- **GitHub:** https://github.com/vorterixgames-gif/compucity
- **Vercel:** Auto-deploy desde main

## 📦 Backups
- `/home/z/my-project/download/backups/compucity-backup-2026-05-27_04-35.tar.gz` (13MB)

## 📝 Historial de Cambios
- **2026-05-27:** Login de clientes + datos de envío — Sistema completo de autenticación (login/registro/perfil editable), provincia en checkout, shippingDetails como campo propio (JSON), tracking URLs, dropdown de usuario en navbar, perfil editable desde Mis Pedidos, migración DB para columna nueva
- **2026-05-27:** Rediseño del Hero — de sección estática a carrusel full-width con 4 slides (inspirado en análisis de competencia: Gaming City, Mexx, FullH4rd, CompraGamer, Venex)
- **2026-05-27:** Deploy inicial, logo, favicon, paleta de colores, navbar, footer
