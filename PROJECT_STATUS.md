# Compucity - Project Status

**Ultima actualizacion:** 2026-06-02

---

## Tienda Proyecto
- **Nombre:** Compucity - Tu Mundo Digital
- **Tipo:** E-commerce de informatica (sin pasarela de pagos, pedidos por WhatsApp)
- **Ubicacion:** La Falda, Valle de Punilla, Cordoba, Argentina
- **WhatsApp:** 3517656918
- **Estado:** EN PRODUCCION (Vercel auto-deploy desde GitHub main)

## Stack Tecnologico
- **Framework:** Next.js 16 + TypeScript
- **Estilos:** Tailwind CSS 4 + shadcn/ui
- **Base de datos:** Turso (libSQL) + Prisma ORM (solo schema, raw SQL en runtime)
- **Auth:** Custom HMAC cookie auth (admin_token + customer_token)
- **Estado:** Zustand + React Query
- **Deploy:** GitHub push a main → Vercel auto-deploy

### Credenciales y Accesos
- **GitHub:** https://github.com/vorterixgames-gif/compucity
- **Turso DB URL:** Ver `.env` (DATABASE_URL + TURSO_AUTH_TOKEN)
- **Admin Secret:** Ver `.env` (ADMIN_SECRET)
- **Air Intra API:** Ver `.env` (credenciales del proveedor)
- **Nota:** Todas las credenciales sensibles estan en `.env` (no commiteado al repo)

---

## Proveedores (Regla CRITICA)

### REGLA DE FILTRADO POR PROVEEDOR
- **Air Intra:** SOLO perifericos, componentes-de-pc, cables-y-adaptadores, pc-armadas
- **Elit:** MANTIENE TODOS sus productos (notebooks, impresion, toners, UPS, etc.)
- **Invid Computers:** MANTIENE TODOS sus productos (notebooks, routers, switches, etc.)

### Estado actual de productos (2026-06-02)
| Proveedor | Activos | Total | Con imagen | Sin imagen |
|-----------|---------|-------|------------|------------|
| Air Intra | 1,532 | 1,755 | ~195 | ~1,337 |
| Elit | 1,508 | 1,519 | ~1,506 | ~2 |
| Invid Computers | 1,187 | 1,191 | ~1,187 | ~4 |
| **Total** | **4,228** | **4,466** | **2,871** | **1,357** |

---

## Identidad Visual
- **Verde principal:** #3A8B68
- **Verde oscuro:** #2F6F55
- **Verde claro:** #75AD95
- **Verde 50:** #EFF5F2
- **Verde 100:** #D7E7E0
- **Verde 900:** #1A3E2E
- **Estilo:** Claro, elegante, limpio

## Logo
- **Archivo:** `public/images/logo-compucity-icon.png` (191x180px)
- **Componente:** `src/components/ui-custom/CompucityLogo.tsx`
- Variantes: full (icono + COMPU+CITY + tagline), icon, horizontal
- Tamanos: sm(30px), md(36px), lg(42px), xl(48px)
- Texto: "COMPU" en color texto + "CITY" en verde #3A8B68
- Tagline: "TU MUNDO DIGITAL"

## Favicon
- `/public/favicon.ico` (16, 32, 48, 64px)
- `/public/favicon-32x32.png`
- `/public/favicon-16x16.png`
- `/public/apple-touch-icon.png` (180x180)
- `/public/android-chrome-192x192.png` (192x192)

---

## Hero Section - Carrusel Full-Width
- **Componente:** `src/components/ui-custom/HeroSection.tsx`
- **Tipo:** Carrusel full-width con 4 slides y autoplay (5s)
- **Navegacion:** Flechas laterales, dots indicadores, swipe tactil, teclado
- **Barra de progreso** animada en la parte inferior
- **Pausa automatica** al hacer hover
- **Animaciones:** Framer Motion (slide transitions + fade-up de contenido)
- **Sin info de pagos ni envios** en el hero (a peticion del cliente)

### Slides
| # | Badge | Titulo | CTA Principal | CTA Secundario | Imagen |
|---|-------|--------|---------------|----------------|--------|
| 1 | Arma tu PC | Arma tu PC **gamer** | Comenzar a armar → `/arma-tu-pc` | Ver componentes → `/categoria/componentes` | `hero-slide-pc-builder.png` |
| 2 | Notebooks | Notebooks y **laptops** | Ver notebooks → `/categoria/notebooks` | Ver todas las marcas → `/categoria/todos` | `hero-slide-notebooks.png` |
| 3 | Componentes | Placas de video y **componentes** | Ver componentes → `/categoria/componentes` | Ver productos → `/categoria/todos` | `hero-slide-components.png` |
| 4 | Perifericos | Perifericos **gaming** | Ver perifericos → `/categoria/perifericos` | Ver todo → `/categoria/todos` | `hero-slide-perifericos.png` |

---

## Sistema de Autenticacion de Clientes
- **Login/Registro:** `/mis-pedidos` - Pagina con tabs Login / Registrarse
- **Cookie:** `customer_token` = `email.hmac_signature` (httpOnly, 30 dias)
- **Perfil editable:** Nombre, telefono, DNI, direccion, ciudad, provincia, CP
- **Navbar:** Dropdown con avatar del usuario logueado, link a Mis Pedidos, cerrar sesion
- **Mobile:** Seccion de usuario en menu movil con avatar, nombre, botones

### APIs de Clientes
- `POST /api/customer/login` - Login con email + contrasena
- `POST /api/customer/register` - Registro con datos personales + direccion
- `GET /api/customer/me` - Obtener perfil actual
- `GET /api/customer/orders` - Pedidos del cliente (match por email o customerId)
- `PUT /api/customer/profile` - Actualizar perfil (direccion, telefono, etc.)
- `POST /api/customer/logout` - Cerrar sesion
- `POST /api/customer/forgot-password` - Recuperar contrasena (email)
- `POST /api/customer/reset-password` - Resetear contrasena con token

---

## Datos de Envio
- **Provincia:** Campo agregado al checkout (dropdown con las 24 provincias argentinas)
- **shippingDetails:** Campo en la tabla `orders` - JSON con carrier, serviceName, estimatedDays, price
- **Migracion:** `POST /api/admin/migrate` - Agrega la columna `shippingDetails` a la DB
- **Vista en Mis Pedidos:** Muestra carrier, servicio, plazo estimado, y tracking con link externo
- **Tracking URLs:** Detecta Andreani, Correo Argentino, OCA y genera links de seguimiento
- **Pre-fill:** Si el cliente esta logueado, su direccion se autocompleta en el checkout

---

## Arma tu PC a medida (`/arma-tu-pc`)
- **Componente:** `src/app/(tienda)/arma-tu-pc/page.tsx`
- **API:** `src/app/api/pc-builder/route.ts`
- **Lib compatibilidad:** `src/lib/compatibility.ts`

### 10 Slots de Componentes
| Slot | Label | Categoria Slug | Requerido | Max Cantidad |
|------|-------|---------------|-----------|-------------|
| processor | Microprocesador | microprocesadores | Si | 1 |
| motherboard | Motherboard | motherboards | Si | 1 |
| ram | Memoria RAM | memorias-ram | Si | 4 |
| gpu | Placa de Video | placas-de-video | No | 1 |
| ssd | Disco SSD | discos-ssd | Si | 4 |
| hdd | Disco HDD | discos-hdd | No | 2 |
| psu | Fuente | fuentes | Si | 1 |
| case | Gabinete | gabinetes | Si | 1 |
| cooling | Refrigeracion | refrigeracion | No | 1 |
| thermal | Pasta Termica | pastas-termicas | No | 1 |

### Sistema de Compatibilidad
- Filtrado automatico por socket (CPU → Mother), DDR (Mother → RAM), wattaje (GPU → PSU)
- Badges de compatibilidad: ShieldCheck + socket/DDR/wattage en cada producto
- Productos incompatibles: Se muestran aparte con razon de incompatibilidad, toggle para verlos
- Banner de filtro activo: Indica cuando se esta filtrando por compatibilidad
- **SODIMM (RAM notebook):** Se detectan y marcan como incompatibles (no sirven para PCs de escritorio)

### Selector de Cantidades
- RAM: 1 a 4 unidades
- SSD: 1 a 4 unidades
- HDD: 1 a 2 unidades
- Los precios se multiplican automaticamente por la cantidad
- WhatsApp muestra "2x Kingston 16GB DDR4 - $50.000 c/u = $100.000"

### Layout Mobile (2 pasos)
- **Paso 1:** Seleccion de componentes con stepper horizontal scrolleable
- **Barra sticky inferior:** Boton verde "Ver Tu PC a medida" + Anterior/Siguiente siempre visibles
- **Paso 2:** Al tocar "Ver Tu PC a medida", se oculta seleccion y se muestra resumen con componentes elegidos, precios y boton WhatsApp. Boton "Volver" para regresar

### Layout Desktop
- Dos columnas lado a lado: seleccion (flex-1) + resumen sticky (w-80)
- Navegacion inline debajo de la lista de productos
- Resumen siempre visible con compatibilidad, precios y WhatsApp

### Categorias en DB (Turso)
- microprocesadores, motherboards, memorias-ram, placas-de-video, discos-ssd, discos-hdd, fuentes, gabinetes, refrigeracion, pastas-termicas

### Problemas conocidos de categorizacion
- **SODIMM en memorias-ram:** Hay ~40 memorias SODIMM (notebook) en la categoria memorias-ram. El sistema de compatibilidad las marca como incompatibles, pero estan visibles. Se podrian mover a una subcategoria "memorias-notebook" o filtrar del PC builder.
- **"Extension M.2 Universal":** El usuario reporto que este producto aparecia en discos-ssd pero NO es un disco (es un adaptador/extension). Actualmente no aparece en la busqueda de productos activos - puede haber sido desactivado o movido en sesion anterior.

---

## PC Armadas (`/categoria/pc-armadas`)
- **Categoria padre:** pc-armadas
- **Subcategorias:** mini-pc (24), oficina-pc (22), gamer-pc (7) = 53 productos total
- **Homepage:** Seccion "PC Armadas" que muestra productos de pc-armadas parent
- **Keywords de deteccion:** PC GAMER, PC LENOVO, PC KELYX, SIST., BAREBONE
- **Correcciones aplicadas:** 33 PCs movidas de categorias incorrectas (microprocesadores, memorias-ram, discos-ssd, fuentes, switches) a subcategorias de pc-armadas
- **Air Intra:** 108 productos de networking (placas-de-red: SFP, Aruba, HP) desactivados

---

## Categorias del Sitio (66 total)

### Con productos activos (top 20):
| Slug | Nombre | Productos |
|------|--------|-----------|
| mouse | Mouse | 384 |
| cables-y-adaptadores | Cables y Adaptadores | 382 |
| motherboards | Motherboards | 325 |
| toners-y-cartuchos | Toners y Cartuchos | 303 |
| memorias-ram | Memorias RAM | 284 |
| gabinetes | Gabinetes | 277 |
| refrigeracion | Refrigeracion | 212 |
| auriculares | Auriculares | 207 |
| placas-de-video | Placas de Video | 172 |
| discos-ssd | Discos SSD | 168 |
| fuentes | Fuentes | 166 |
| microprocesadores | Microprocesadores | 140 |
| teclados | Teclados | 139 |
| parlantes | Parlantes | 101 |
| pendrives | Pendrives | 62 |
| joysticks | Joysticks | 62 |
| placas-de-red | Placas de Red | 59 |
| impresion | Impresion | 58 |
| oficina | Oficina | 42 |
| routers-wifi | Routers WiFi | 42 |

---

## Filtro Global de Stock
- Productos sin stock (`stock <= 0`) NO se muestran en toda la tienda: home, categorias, buscador, productos relacionados, Arma tu PC
- Queries afectadas: `getAllActiveProducts`, `getFeaturedProducts`, `getProductsByCategory`, `searchProducts`, `getTopProductsByCategorySlug`, related-products API, pc-builder count
- **No se filtraron:** detalle de producto individual (SEO), endpoint por ID (favoritos), todas las queries de admin

---

## Estructura Key Files
```
src/app/page.tsx                          — Home (Hero Carrusel + PC Armadas + Productos)
src/app/layout.tsx                        — Layout con favicon metadata
src/app/globals.css                       — Variables CSS, paleta #3A8B68
src/app/checkout/page.tsx                 — Checkout con provincia + shippingDetails JSON
src/app/mis-pedidos/page.tsx              — Login/Registro/Dashboard de pedidos + perfil editable
src/app/(tienda)/arma-tu-pc/page.tsx      — Arma tu PC (mobile sticky bar + compatibilidad + cantidades)
src/app/api/pc-builder/route.ts           — API de productos por slot + filtros compatibilidad
src/lib/compatibility.ts                  — Logica de compatibilidad (socket, DDR, wattage)
src/components/ui-custom/HeroSection.tsx   — Hero Carrusel (4 slides, autoplay)
src/components/ui-custom/CompucityLogo.tsx — Logo componente
src/components/layout/Navbar.tsx          — Nav con user dropdown (avatar + logout)
src/components/layout/Footer.tsx          — Footer con logo lg whiteText
src/components/layout/WhatsAppButton.tsx  — Boton flotante
src/lib/customer-auth.ts                  — Auth de clientes (login, registro, perfil, updateCustomer)
src/lib/admin-auth.ts                     — Auth de admin (compartido: hash, verify, sign)
src/lib/db.ts                             — Conexion Turso DB
src/lib/queries.ts                        — Queries SQL (con filtro de stock)
src/lib/dollar.ts                         — Cotizacion del dolar
src/lib/format-product.ts                 — Formateo de productos
src/app/api/admin/enrich/route.ts         — Enrichment de categorias (Air Intra only filter)
src/app/api/admin/suppliers/sync/route.ts — Sync Air Intra (con filtro de categorias)
src/app/api/admin/suppliers/enrich-images/route.ts — Enriquecimiento de imagenes (WebP)
src/app/api/products/route.ts             — API publica de productos
src/app/api/categories/route.ts           — API de categorias
src/app/api/orders/route.ts               — API de pedidos
src/app/api/customer/                     — APIs de auth de clientes
tailwind.config.ts                        — Paleta Compucity
public/images/hero-slide-*.png            — Imagenes del carrusel hero
public/images/logo-compucity-icon.png     — Logo recortado
```

---

## Panel Admin (`/admin`)
- **Dashboard:** Stats (productos, pedidos, clientes, categorias, proveedores)
- **Productos:** CRUD completo, filtro por proveedor/categoria/estado
- **Categorias:** Arbol de categorias con mapeos de proveedores
- **Proveedores:** 3 proveedores, sync manual, conteo de productos activos
- **Pedidos:** Lista de pedidos, gestion de estados
- **Clientes:** Lista con busqueda, detalle expandible
- **Configuracion:** Cotizacion del dolar, config de la tienda

### APIs Admin
- `POST /api/admin/auth/login` / `check` / `logout`
- `GET/POST/PUT/DELETE /api/admin/products`
- `GET/POST /api/admin/categories`
- `GET/POST /api/admin/suppliers`
- `POST /api/admin/suppliers/sync` - Sync Air Intra
- `POST /api/admin/suppliers/recategorize`
- `GET/POST /api/admin/suppliers/category-mappings`
- `POST /api/admin/suppliers/enrich-images` - Carga de imagenes WebP
- `POST /api/admin/enrich` - Enriquecimiento de categorias (Air Intra only)
- `GET /api/admin/stats`
- `GET/POST /api/admin/orders`
- `GET/POST/DELETE /api/admin/customers`
- `POST /api/admin/customers/reset-password`
- `GET/POST /api/admin/dollar`
- `POST /api/admin/migrate` - Migraciones de DB
- `POST /api/admin/cleanup`
- `POST /api/admin/seed`
- `GET /api/admin/export/emails` / `products`
- `GET/PUT /api/admin/config`

---

## Imagenes de Productos
- **Total con imagen:** 2,871 (68%)
- **Total sin imagen:** 1,357 (32%)
- **Air Intra:** ~1,337 sin imagen (el API syp no devuelve imagenes)
- **Elit:** ~2 sin imagen (ya tienen WebP del API)
- **Invid:** ~4 sin imagen (ya tienen imagenes del API)
- **Formato:** WebP (max 800px, calidad 75) almacenadas en tabla `product_images`
- **Endpoint:** `/api/image/[id]` - Sirve imagenes desde product_images
- **Cross-provider matching:** Sistema para copiar imagenes entre proveedores por brand+model
- **Scripts:** `scripts/enrich-images.mjs`, `scripts/batch-images.mjs`, `scripts/cross-provider-images.mjs`

---

## Base de Datos (Turso)
- **Host:** compucity-vorterixgames-gif.aws-us-east-1.turso.io
- **Tablas:** products (4,466), categories (66), suppliers (3), orders (0), order_items (0), customers (1), product_images (144), dollar_rates (1), store_config (20), supplier_category_mappings (85), admins (1)

### Schema Products
```
id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, 
description TEXT, price REAL NOT NULL, comparePrice REAL, costPrice REAL,
sku TEXT UNIQUE, stock INTEGER DEFAULT 0, isActive INTEGER DEFAULT 1,
isFeatured INTEGER DEFAULT 0, images TEXT, specs TEXT,
providerId TEXT, providerSku TEXT, categoryId TEXT,
createdAt TEXT, updatedAt TEXT, supplierCategory TEXT, duplicateOfId TEXT
```

---

## Backups
| Fecha | Archivo | Tamano | Contenido |
|-------|---------|--------|-----------|
| 2026-06-02 | `compucity-backup-2026-06-02.tar.gz` | 443MB | Codigo completo (sin node_modules/.next) |
| 2026-06-02 | `compucity-db-2026-06-02.json` | 8MB | Base de datos completa (11 tablas, JSON) |
| 2026-06-01 | `compucity-backup-2026-06-01.tar.gz` | 85MB | Backup anterior |
| 2026-05-27 | `compucity-backup-2026-05-27_04-35.tar.gz` | 13MB | Backup inicial |

Todos los backups en `/home/z/my-project/download/backups/`

---

## Tareas Pendientes

### Alta Prioridad
1. **Revisar categorizacion en Arma tu PC:** Verificar que todos los productos en las categorias del PC builder esten correctamente categorizados (especialmente discos-ssd, memorias-ram)
2. **SODIMM en memorias-ram:** ~40 memorias SODIMM (notebook) aparecen en la categoria memorias-ram del PC builder. El sistema las marca como incompatibles, pero seria mejor moverlas a una subcategoria separada o filtrarlas del PC builder
3. **Cargar imagenes faltantes:** ~1,357 productos sin imagen (mayormente Air Intra). Usar cross-provider matching + web search

### Media Prioridad
4. **Recuperacion de contrasena por email:** El endpoint `/api/customer/forgot-password` existe pero necesita configuracion de servicio de email (Resend)
5. **3 productos faltantes:** Verificar que productos especificos faltan en el catalogo
6. **Verificar compatibilidad en Arma tu PC:** Testing exhaustivo del sistema de compatibilidad

### Baja Prioridad
7. **Optimizar imagenes:** Los thumbnails del catalogo podrian usar tamano reducido
8. **SEO:** Meta tags, sitemap dinamico, structured data

---

## Historial de Cambios
- **2026-06-02:** Backup completo (codigo 443MB + DB 8MB). Actualizacion de PROJECT_STATUS.md con estado completo del proyecto
- **2026-06-01:** Selector de cantidades en Arma tu PC - RAM (1-4), SSD (1-4), HDD (1-2). Precios se multiplican automaticamente. WhatsApp muestra "2x Producto - $precio c/u = $total"
- **2026-06-01:** PC Armadas - Categoria agregada con 53 productos (24 mini-pc, 22 oficina-pc, 7 gamer-pc). 33 PCs movidas de categorias incorrectas. 108 productos networking Air Intra desactivados. Homepage muestra seccion PC Armadas
- **2026-06-01:** Filtro global de stock - Productos sin stock no se muestran en toda la tienda
- **2026-06-01:** Arma tu PC - Mobile sticky bottom bar, sistema de compatibilidad funcional (socket, DDR, wattage), correccion de filtros de categorias en DB
- **2026-05-27:** Filtro Air Intra only - Solo Air Intra se filtra a perifericos/componentes/cables. Elit e Invid mantienen TODOS sus productos. Re-sync de Elit (1,519) e Invid (1,191)
- **2026-05-27:** Login de clientes + datos de envio - Sistema completo de autenticacion, provincia en checkout, shippingDetails como campo propio, tracking URLs
- **2026-05-27:** Redisenio del Hero - de seccion estatica a carrusel full-width con 4 slides
- **2026-05-27:** Deploy inicial, logo, favicon, paleta de colores, navbar, footer
