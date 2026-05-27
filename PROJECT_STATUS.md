# Compucity - Project Status

**Última actualización:** 2026-05-27 (sesión 3)

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
- **shippingDetails:** Campo en la tabla `orders` — JSON estructurado con carrier, serviceName, estimatedDays, price
- **Vista en Mis Pedidos:** Muestra carrier, servicio, plazo estimado, y tracking con link externo
- **Tracking URLs:** Detecta Andreani, Correo Argentino, OCA y genera links de seguimiento
- **Pre-fill:** Si el cliente está logueado, su dirección se autocompleta en el checkout

## 🚚 Proveedores (Suppliers) — Sistema Completo
- **Página admin:** `/admin/proveedores` — CRUD completo con expand/collapse
- **APIs soportadas:** Invid Computers, Air Intra, ELIT
- **Tabla `suppliers`:** name, contactName, contactEmail, contactPhone, website, apiType, apiBaseUrl, apiUserId, apiToken, apiUsername, apiPassword, markup, currency, isActive, lastSyncAt, notes
- **Sincronización:** Importa productos desde la API del proveedor con paginación, aplica markup, mapea stock status
- **Test de conexión:** Prueba autenticación antes de sincronizar
- **Dashboard:** Card de proveedores con count en el dashboard admin

### APIs de Proveedores
| Proveedor | Auth | Productos | Precios | Stock |
|-----------|------|-----------|---------|-------|
| Invid Computers | JWT (user/pass) | `articulo.php` paginado (100/pág) | USD | STOCK OK / BAJO STOCK / SIN STOCK |
| Air Intra | Bearer Token (user/pass) | `syp` paginado (500/pág) | USD | Por depósito (air, lug, ros, cba, mza) |
| ELIT | user_id + token fijo | `productos` paginado (100/pág) | USD | stock_total numérico |

### Mapeo de Categorías (Category Mapping)
- **Problema resuelto:** Los productos sincronizados caían en categorías incorrectas (ej: notebooks en PC Armadas) porque se usaban IDs hardcodeados
- **Sistema implementado:**
  1. La sync guarda la categoría original del proveedor (`supplierCategory`) en cada producto
  2. El admin mapea categorías del proveedor → categorías de la tienda con un diálogo visual
  3. Botón "Re-categorizar" aplica los mapeos a todos los productos existentes
- **Prioridad de asignación:** 1) Mapeo explícito → 2) Keywords en nombre → 3) Sin categoría
- **Búsqueda dinámica:** Las categorías se buscan por slug en la DB (no más IDs hardcodeados)
- **Tabla `supplier_category_mappings`:** supplierId, supplierCategory, storeCategoryId

### Endpoints de Proveedores
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/admin/suppliers` | GET, POST, PUT, DELETE | CRUD de proveedores |
| `/api/admin/suppliers/sync` | POST | Sincronizar productos desde API del proveedor |
| `/api/admin/suppliers/test` | POST | Probar conexión a la API del proveedor |
| `/api/admin/suppliers/category-mappings` | GET, POST, DELETE | Mapeos de categorías proveedor→tienda |
| `/api/admin/suppliers/recategorize` | POST | Re-categorizar productos según mapeos |

## 🗃️ Base de Datos — Tablas

| Tabla | Filas aprox. | Descripción |
|-------|-------------|-------------|
| admins | 1 | Administradores |
| categories | 58 | Categorías y subcategorías (9 padres + 49 hijas) |
| customers | 1 | Clientes registrados |
| dollar_rates | 1 | Cotización del dólar |
| order_items | 3 | Items de pedidos |
| orders | 3 | Pedidos con shippingDetails |
| product_images | 8 | Imágenes de productos |
| products | 1,214 | Productos (incluye supplierCategory) |
| store_config | 6 | Configuración de la tienda |
| suppliers | 1 | Proveedores (Invid) |
| supplier_category_mappings | 0 | Mapeos de categorías proveedor→tienda |

### Estructura de Categorías de la Tienda
```
Notebooks/        → Gamer, Oficina, Diseño, Ultrabooks
PC Armadas/       → Gamer, Oficina, Diseño, Mini PC
Componentes de PC/ → Placas de Video, Microprocesadores, Motherboards, Memorias RAM,
                     Discos SSD, Discos HDD, Fuentes, Gabinetes, Refrigeración,
                     Pastas Térmicas, Combos
Monitores/        → Gamer, Oficina, Diseño, Soportes y Brazos
Periféricos/      → Teclados, Mouse, Auriculares, Mousepads, Parlantes,
                     Webcams, Micrófonos, Joysticks, Kits Gamer
Impresión/        → Láser, Inyección, Sistema Continuo, Toners y Cartuchos
Conectividad y Redes/ → Routers WiFi, Switches, Cables y Adaptadores, Placas de Red
Almacenamiento Externo/ → Discos Externos, Pendrives, Micro SD
Accesorios/       → Cargadores, Bases, Fundas/Mochilas, UPS, Sillas Gamer, Escritorios
```

## 📁 Estructura Key Files
```
src/app/page.tsx              — Home (Hero Carrusel + Productos)
src/app/layout.tsx            — Layout con favicon metadata
src/app/globals.css           — Variables CSS, paleta #3A8B68
src/app/checkout/page.tsx     — Checkout con provincia + shippingDetails JSON
src/app/mis-pedidos/page.tsx  — Login/Registro/Dashboard de pedidos + perfil editable
src/app/admin/proveedores/page.tsx — Proveedores (CRUD + sync + mapeo categorías)
src/app/admin/categorias/page.tsx  — Categorías (CRUD + orden + visibilidad)
src/app/api/admin/suppliers/route.ts — CRUD proveedores
src/app/api/admin/suppliers/sync/route.ts — Sync productos (Invid/AirIntra/ELIT)
src/app/api/admin/suppliers/test/route.ts — Test conexión proveedor
src/app/api/admin/suppliers/category-mappings/route.ts — Mapeo categorías
src/app/api/admin/suppliers/recategorize/route.ts — Re-categorizar productos
src/app/api/admin/categories/route.ts — CRUD categorías
src/app/api/admin/init-categories/route.ts — Seed categorías
src/components/ui-custom/HeroSection.tsx  — Hero Carrusel (4 slides, autoplay)
src/components/ui-custom/CompucityLogo.tsx — Logo componente
src/components/layout/Navbar.tsx  — Nav con user dropdown (avatar + logout)
src/components/layout/Footer.tsx  — Footer con logo lg whiteText
src/components/layout/WhatsAppButton.tsx — Botón flotante
src/lib/customer-auth.ts      — Auth de clientes (login, registro, perfil, updateCustomer)
src/lib/admin-auth.ts         — Auth de admin (compartido: hash, verify, sign)
src/lib/db.ts                 — DB connection + auto-migrations
tailwind.config.ts            — Paleta Compucity
public/images/hero-slide-*.png — Imágenes del carrusel hero
public/images/logo-compucity-icon.png — Logo recortado
```

## 🔗 Repositorio
- **GitHub:** https://github.com/vorterixgames-gif/compucity
- **Vercel:** Auto-deploy desde main

## 📦 Backups
| Fecha | Archivo | Tamaño | Contenido |
|-------|---------|--------|-----------|
| 2026-05-27 | `compucity-turso-backup-2026-05-27.json` | 1.9 MB | DB completa (JSON) |
| 2026-05-27 | `compucity-turso-backup-2026-05-27.sql` | 1.7 MB | DB completa (SQL restaurable) |
| 2026-05-27 | `compucity-project-backup-2026-05-27_2.tar.gz` | 153 KB | Código del proyecto |
| 2026-05-27 | `compucity-public-backup-2026-05-27_2.tar.gz` | 635 KB | Assets públicos |
| 2026-05-27 | `compucity-full-backup-2026-05-27.tar.gz` | 2.0 MB | Todo lo anterior combinado |

## 📝 Historial de Cambios
- **2026-05-27 (sesión 3):** Sistema de mapeo de categorías — Soluciona productos desordenados tras sync. Nueva tabla `supplier_category_mappings`, columna `supplierCategory` en products, sync con búsqueda dinámica por slug, diálogo "Mapear Categorías" en admin, botón "Re-categorizar" para aplicar mapeos masivamente. Backup completo.
- **2026-05-27 (sesión 2):** Proveedores + Clientes — Sección completa de Proveedores en admin (CRUD, APIs Invid/AirIntra/ELIT, sync, test conexión). Sección de Clientes en admin. Dashboard con cards. Migraciones auto.
- **2026-05-27 (sesión 1):** Login de clientes + datos de envío — Sistema completo de autenticación (login/registro/perfil editable), provincia en checkout, shippingDetails como campo propio (JSON), tracking URLs, dropdown de usuario en navbar, perfil editable desde Mis Pedidos
- **2026-05-27 (sesión 0):** Rediseño del Hero — de sección estática a carrusel full-width con 4 slides (inspirado en análisis de competencia: Gaming City, Mexx, FullH4rd, CompraGamer, Venex)
- **2026-05-27:** Deploy inicial, logo, favicon, paleta de colores, navbar, footer
