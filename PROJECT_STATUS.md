# Compucity - Project Status

**Ultima actualizacion:** 2026-06-04 (sesion 9)

---

## Tienda Proyecto
- **Nombre:** Compucity - Tu Mundo Digital
- **Tipo:** E-commerce de informatica (sin pasarela de pagos, pedidos por WhatsApp)
- **Ubicacion:** La Falda, Valle de Punilla, Cordoba, Argentina
- **WhatsApp:** 3517656918
- **Estado:** EN PRODUCCION (Vercel auto-deploy desde GitHub main)
- **URL produccion:** https://my-project-eight-liard-96.vercel.app/
- **URL admin:** https://my-project-eight-liard-96.vercel.app/admin
- **Credenciales admin:** admin@compucity.com / compucity2026

## Stack Tecnologico
- **Framework:** Next.js 16 + TypeScript
- **Estilos:** Tailwind CSS 4 + shadcn/ui
- **Base de datos:** Turso (libSQL) + Prisma ORM (solo schema, raw SQL en runtime)
- **Auth:** Custom HMAC cookie auth (admin_token + customer_token)
- **Estado:** Zustand + React Query
- **Deploy:** GitHub push a main -> Vercel auto-deploy
- **Runtime:** Bun

### Credenciales y Accesos
- **GitHub:** https://github.com/vorterixgames-gif/compucity
- **Turso DB URL:** Ver `.env` (DATABASE_URL + TURSO_AUTH_TOKEN)
- **Admin Secret:** Ver `.env` (ADMIN_SECRET = compucity_hmac_prod_2026_a8f3e1b9c7d2)
- **Air Intra API:** Ver `.env` (credenciales del proveedor)
- **Nota:** Todas las credenciales sensibles estan en `.env` (no commiteado al repo)

---

## Proveedores (Regla CRITICA)

### REGLA DE FILTRADO POR PROVEEDOR
- **Air Intra:** SOLO perifericos, componentes-de-pc, cables-y-adaptadores, pc-armadas
- **Elit:** MANTIENE TODOS sus productos (notebooks, impresion, toners, UPS, etc.)
- **Invid Computers:** MANTIENE TODOS sus productos (notebooks, routers, switches, etc.)

### Estado actual de productos (2026-06-03 sesion 7)
| Proveedor | Activos | Total | Con imagen | Sin imagen | Con costPrice |
|-----------|---------|-------|------------|------------|---------------|
| Air Intra | 1,489 | 1,754 | 191 | 1,563 | 1,754 |
| Elit | 1,506 | 1,518 | 1,516 | 2 | 1,518 |
| Invid Computers | 1,187 | 1,191 | 1,191 | 0 | 1,191 |
| Manual | 1 | 1 | 1 | 0 | 1 |
| **Total** | **4,179** | **4,459** | **2,899** | **1,565** | **4,459** |

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
| 1 | Arma tu PC | Arma tu PC | Comenzar a armar -> `/arma-tu-pc` | Ver componentes -> `/categoria/componentes` | `hero-slide-pc-builder.png` |
| 2 | Notebooks | Notebooks y **laptops** | Ver notebooks -> `/categoria/notebooks` | Ver todas las marcas -> `/categoria/todos` | `hero-slide-notebooks.png` |
| 3 | Componentes | Placas de video y **componentes** | Ver componentes -> `/categoria/componentes` | Ver productos -> `/categoria/todos` | `hero-slide-components.png` |
| 4 | Perifericos | Perifericos **gaming** | Ver perifericos -> `/categoria/perifericos` | Ver todo -> `/categoria/todos` | `hero-slide-perifericos.png` |

---

## Sistema de Precios (Global + Categoría + Individual + IVA)

### Configuracion Global
- **Markup (margen de ganancia):** 15% (store_config: markup = 15)
- **Descuento efectivo:** 0% (store_config: cash_discount = 0)
- **IVA por defecto:** 10.5% (campo ivaRate en products, default 10.5)
- **Fuente dolar:** Banco Nacion (dolar_api)
- **Panel admin:** `/admin/configuracion` - Permite cambiar dolar, markup, descuento global

### Sistema de 3 Niveles de Markup (IMPLEMENTADO sesion 8)
- **Prioridad:** Producto individual → Categoría → Global
- **Campos en categorías:** `markup` y `cashDiscount` (nullable, si es null usa el global)
- **Campos en productos:** `markup` y `cashDiscount` (nullable, si es null usa categoría o global)
- **Vista previa en admin productos:** Muestra si se usa "(individual)", "(categoría)" o global
- **Badges en tabla:** M (markup individual), MC (markup categoría), D (dto individual), DC (dto categoría)
- **Cálculo en vivo:** Al cambiar categoría en el formulario, se recalculan precios considerando markup de categoría
- **APIs actualizadas:** Todas las APIs (pública, admin, export, PC Builder) usan el sistema de 3 niveles
- **Estado actual:** 0 categorías con markup propio (todas usan global 15%), 2 productos con markup individual

### Markup y Descuento Individual por Producto
- Cada producto puede tener su propio **markup** y **cashDiscount** (campos nullable en la DB)
- Si el producto tiene valor individual, se usa ese; si es NULL, se verifica la categoría, y si tampoco tiene, se usa el global
- **Interfaz admin:** Campos "Margen individual (%)" y "Descuento efectivo individual (%)" en el formulario de productos
- **Indicadores visuales:** Badges "M" (markup) y "D" (descuento) en la tabla de productos
- **Vista previa:** El calculo automatico muestra si se estan usando valores individuales con etiqueta "(individual)"
- **Estado actual:** 2 productos con markup individual, 12 con cashDiscount individual

### IVA Diferenciado (IMPLEMENTADO sesion 7, actualizado sesion 9)
- **Campo products:** `ivaRate REAL` (nullable, NULL = heredar de categoria o default 10.5%)
- **Campo categories:** `ivaRate REAL` (nullable, NULL = usar default 10.5%)
- **Prioridad:** Producto individual → Categoría → Default (10.5%)
- **Distribucion actual:** 4,445 productos con ivaRate=NULL (heredan de categoria), 14 productos con IVA 21% individual
- **Categorias con IVA:** Notebooks=21%
- **Interfaz admin productos:** Selector IVA con opcion "Heredar de categoria (default 10,5%)" + "10,5%" + "21%"
- **Interfaz admin categorias:** Selector IVA con opcion "Default (10,5%)" + "10,5%" + "21%"
- **Fix sesion 9:** Se corrigio que todos los productos tenian ivaRate=10.5 forzado (nunca heredaban de categoria). Ahora ivaRate=NULL en productos significa heredar de categoria

### Precio de Oferta (salePrice)
- **Campos:** `salePrice REAL`, `saleStart TEXT`, `saleEnd TEXT` en tabla products
- **Logica:** Si salePrice > 0 y estamos dentro del rango de fechas, se muestra como precio de oferta
- **Estado actual:** 1 producto con salePrice configurado
- **Admin:** Se gestiona desde el formulario de productos o desde Promociones

### Formulas de Precio
```
Precio de lista  = costUSD x (1 + ivaRate/100) x (1 + markup/100) x cotizacionDolar
Precio efectivo  = costUSD x (1 + ivaRate/100) x (1 + (markup - cashDiscount)/100) x cotizacionDolar
Precio oferta    = salePrice (si esta dentro del rango de fechas, reemplaza precio de lista)
```
Donde markup, cashDiscount e ivaRate siguen prioridad: Producto individual → Categoría → Global/Default.

---

## Sistema de Promociones (`/admin/promociones`) (IMPLEMENTADO sesion 7)

### Cupones de Descuento
- **Componente:** `src/app/admin/promociones/page.tsx` (tab Cupones)
- **API:** `src/app/api/admin/coupons/route.ts`
- **Campos:** codigo, descripcion, tipo (porcentaje/monto fijo), valor, compra minima, usos maximos, vigencia (desde/hasta), estado activo/inactivo
- **Tabla DB:** `coupons`
- **Integracion checkout:** Los cupones se aplican en el checkout con descuento sobre el total
- **Estado actual:** 0 cupones creados

### Banners Promocionales
- **Componente:** `src/app/admin/promociones/page.tsx` (tab Banners)
- **API:** `src/app/api/admin/banners/route.ts`
- **Campos:** titulo, subtitulo, texto del boton, link del boton (selector de categorias o URL custom), color de fondo, color de texto, imagen de fondo (con upload + compresion WebP), posicion (arriba/debajo del hero), orden, estado activo/inactivo
- **Tabla DB:** `banners` (con columna `imageUrl`)
- **Upload de imagenes:** `POST /api/admin/upload` - Comprime a WebP (max 1600px, calidad 85%) y guarda en `/public/uploads/`
- **Vista previa:** Se muestra en tiempo real al crear/editar un banner en el admin
- **Storefront:** Los banners activos se muestran arriba y debajo del hero en la homepage
- **API publica:** `GET /api/banners` - Retorna banners activos ordenados por posicion y orden
- **Estado actual:** 0 banners creados

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

### Sistema de Filtrado de Productos (3 capas - FIX PERMANENTE)
El PC Builder usa **3 capas de defensa** para garantizar que solo productos correctos aparezcan en cada slot:

| Capa | Mecanismo | Descripcion |
|------|-----------|-------------|
| **1. Inclusion (Whitelist)** | `BUILDER_INCLUDE_PATTERNS` | Cada slot define que palabras clave DEBE tener el nombre del producto (ej: GPU requiere "RTX/GTX/RADEON"). Si no coincide con NINGUN patron, no aparece. **Es la defensa principal: funciona incluso si la categoria en la DB esta mal** |
| **2. Exclusion (Blacklist)** | `BUILDER_EXCLUDE_PATTERNS` | Patrones que excluyen productos no deseados (notebooks en GPU, discos externos en SSD, etc.) |
| **3. Compatibilidad** | `applyCompatibilityFilters` | Filtra por socket (CPU->Mother), DDR (Mother->RAM), wattaje (GPU->PSU) |

### Por que se desordenaba antes (Causa raiz resuelta)
El problema recurrente tenia 3 causas encadenadas:
1. **Sync categorizaba mal**: El `CATEGORY_KEYWORD_MAP` chequeaba keywords de componentes (RTX, DDR, SSD) ANTES que productos completos (NOTEBOOK, PC ARMADAS). "NOTEBOOK RTX 4060" coincidia con "RTX" primero -> placas-de-video
2. **PC Builder no validaba nombres**: Solo usaba categoria de DB + blacklist chica. No verificaba que el producto realmente fuera lo que dice la categoria
3. **Cada sync traia productos nuevos mal categorizados**: Aunque corrijas manualmente, la proxima sync "contaminaba" otra vez

### Solucion permanente (implementada sesion 3)
1. **Whitelist en PC Builder**: `BUILDER_INCLUDE_PATTERNS` - cada slot valida el nombre del producto en runtime
2. **Keywords ordenadas en sync**: Productos completos (NOTEBOOK, PC ARMADAS) se chequean ANTES que componentes (RTX, DDR, SSD)
3. **Validacion post-sync automatica**: Despues de cada sync, se corrigen automaticamente productos mal categorizados en TODAS las categorias del PC Builder

### Categorias en DB (productos con stock, 2026-06-02)
| Categoria | Productos |
|-----------|-----------|
| Memorias RAM | 239 |
| Motherboards | 239 |
| Gabinetes | 192 |
| Refrigeracion | 164 |
| Fuentes | 146 |
| Discos SSD | 138 |
| Placas de Video | 124 |
| Microprocesadores | 110 |
| Discos HDD | 26 |
| Pastas Termicas | 1 |

### Sistema de Compatibilidad
- Filtrado automatico por socket (CPU -> Mother), DDR (Mother -> RAM), wattaje (GPU -> PSU)
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

---

## PC Armadas (`/categoria/pc-armadas`)
- **Categoria padre:** pc-armadas
- **Subcategorias:** mini-pc (19), oficina-pc (20), gamer-pc (0), diseno-pc (0) = 39 productos total
- **Homepage:** Seccion "PC Armadas" con mezcla balanceada por subcategoria (round-robin), productos con foto primero
- **Keywords de deteccion:** PC LENOVO, PC KELYX, SIST., BAREBONE
- **Correcciones sesion 5:** 7 "PC Gamer Raptor" (eran gabinete+fuente, no PCs completas) movidas de gamer-pc a gabinetes. 4 Gabinete Raptor movidas de joysticks a gabinetes. 3 Switches TP-Link movidas de oficina-pc a switches
- **Air Intra:** 108 productos de networking (placas-de-red: SFP, Aruba, HP) desactivados
- **Nota:** La subcategoria gamer-pc esta vacia hasta que se consigan PCs gamer reales de los proveedores

---

## Categorias del Sitio (63 total en DB)

### Con productos activos (top 25):
| Slug | Nombre | Productos |
|------|--------|-----------|
| cables-y-adaptadores | Cables y Adaptadores | 393 |
| mouse | Mouse | 384 |
| motherboards | Motherboards | 309 |
| toners-y-cartuchos | Toners y Cartuchos | 303 |
| memorias-ram | Memorias RAM | 284 |
| gabinetes | Gabinetes | 216 |
| refrigeracion | Refrigeracion | 211 |
| auriculares | Auriculares | 207 |
| fuentes | Fuentes | 187 |
| placas-de-video | Placas de Video | 173 |
| discos-ssd | Discos SSD | 168 |
| microprocesadores | Microprocesadores | 140 |
| teclados | Teclados | 140 |
| parlantes | Parlantes | 101 |
| pendrives | Pendrives | 62 |
| joysticks | Joysticks | 62 |
| placas-de-red | Placas de Red | 61 |
| impresion | Impresion | 58 |
| oficina | Oficina | 42 |
| routers-wifi | Routers WiFi | 42 |
| gamer | Gamer | 41 |
| discos-hdd | Discos HDD | 40 |
| discos-externos | Discos Externos | 38 |
| micro-sd | Micro SD | 36 |
| ups | UPS | 31 |

---

## Filtro Global de Stock
- Productos sin stock (`stock <= 0`) NO se muestran en toda la tienda: home, categorias, buscador, productos relacionados, Arma tu PC
- Queries afectadas: `getAllActiveProducts`, `getFeaturedProducts`, `getProductsByCategory`, `searchProducts`, `getTopProductsByCategorySlug`, related-products API, pc-builder count
- **No se filtraron:** detalle de producto individual (SEO), endpoint por ID (favoritos), todas las queries de admin

---

## Prioridad Global de Imagenes (sesion 5)
- **Regla:** Los productos CON imagen aparecen primero en TODAS las listas del sitio
- **Queries afectadas:** `getAllActiveProducts`, `getFeaturedProducts`, `getProductsByCategory`, `searchProducts`, `getTopProductsByCategorySlug`, PC Builder API, Related Products API
- **SQL:** `ORDER BY CASE WHEN images IS NOT NULL AND images != '[]' THEN 0 ELSE 1 END, ...`
- **Busqueda:** Prioridad es: 1ro con imagen, 2do coincidencia en nombre, 3ro fecha
- **PC Armadas Homepage:** Mezcla balanceada por subcategoria (round-robin interleave) para que se vean gamer-pc, oficina-pc y mini-pc
- **PC Builder:** Componentes con foto aparecen primero dentro de cada slot

---

## Admin Productos - Filtros y Ordenamiento (IMPLEMENTADO sesion 7)
- **Filtros por columna:** Busqueda por nombre, filtro por proveedor, filtro por categoria, filtro por estado (activo/inactivo), filtro por IVA (10.5%/21%), filtro por stock (con/sin)
- **Ordenamiento:** Click en encabezados de columna para ordenar asc/desc (nombre, costo USD, precio lista, stock, IVA, marca)
- **Indicadores visuales:** Flechas de ordenamiento, badges de filtro activo, contador de resultados
- **Limpiar filtros:** Boton para resetear todos los filtros y ordenamiento

---

## Protecciones contra Deploy de Versiones Viejas (IMPLEMENTADO sesion 7)

### Problema que resolvio
Se pusheo una version vieja del codigo que sobreescribio la version correcta en produccion. La causa raiz fue una carpeta `compucity-repo/` duplicada dentro del proyecto que apuntaba al mismo remote de GitHub.

### Capa 1: Pre-push hook
- **Archivo:** `githooks/pre-push` (configurado via `git config core.hooksPath githooks`)
- **Funcion:** Antes de cada `git push`, verifica que el local no este atras del remoto
- **Si el local esta atras:** Bloquea el push y muestra instrucciones para hacer `git pull --rebase origin main`
- **Si hay divergencia:** Tambien bloquea y sugiere rebase

### Capa 2: Script de deploy seguro
- **Archivo:** `scripts/deploy.sh`
- **Uso:** `bash scripts/deploy.sh "mensaje del commit"`
- **Verificaciones:** Rama correcta, fetch remoto, comparar commits, verificar cambios pendientes, solo pushea si todo esta OK

### Capa 3: Eliminacion del repo duplicado
- **Accion:** Se elimino la carpeta `compucity-repo/` que causaba confusion
- **Proteccion:** Se agrego `compucity-repo/` al `.gitignore` para prevenir recrearlo accidentalmente

### Workflow recomendado
1. Siempre hacer `git pull --rebase origin main` antes de trabajar
2. Hacer cambios, probar localmente
3. Usar `bash scripts/deploy.sh "feat: descripcion"` para pushear de forma segura
4. Vercel se actualiza automaticamente con el push

---

## Estructura Key Files
```
src/app/page.tsx                          — Home (Hero + Banners + PC Armadas + Productos)
src/app/layout.tsx                        — Layout con favicon metadata
src/app/globals.css                       — Variables CSS, paleta #3A8B68
src/app/checkout/page.tsx                 — Checkout con provincia + shippingDetails JSON + cupones
src/app/mis-pedidos/page.tsx              — Login/Registro/Dashboard de pedidos + perfil editable
src/app/(tienda)/arma-tu-pc/page.tsx      — Arma tu PC (mobile sticky bar + compatibilidad + cantidades)
src/app/api/pc-builder/route.ts           — API de productos por slot + filtros compatibilidad
src/app/admin/productos/page.tsx          — Admin productos (CRUD + filtros + ordenamiento + IVA + salePrice)
src/app/admin/promociones/page.tsx        — Admin promociones (Cupones + Banners con imagen)
src/lib/compatibility.ts                  — Logica de compatibilidad (socket, DDR, wattage)
src/components/ui-custom/HeroSection.tsx   — Hero Carrusel (4 slides, autoplay)
src/components/ui-custom/CompucityLogo.tsx — Logo componente
src/components/layout/Navbar.tsx          — Nav con user dropdown (avatar + logout)
src/components/layout/Footer.tsx          — Footer con logo lg whiteText
src/components/layout/WhatsAppButton.tsx  — Boton flotante
src/lib/customer-auth.ts                  — Auth de clientes (login, registro, perfil, updateCustomer)
src/lib/admin-auth.ts                     — Auth de admin (compartido: hash, verify, sign)
src/lib/db.ts                             — Conexion Turso DB + migraciones automaticas
src/lib/queries.ts                        — Queries SQL (con filtro de stock + markup individual)
src/lib/dollar.ts                         — Cotizacion del dolar + calculateProductPrices (con IVA + markup individual)
src/lib/andreani.ts                       — Login JWT, cotizacion domicilio/sucursal (INACTIVO)
src/lib/format-product.ts                 — Formateo de productos
src/app/api/admin/enrich/route.ts         — Enrichment de categorias (Air Intra only filter)
src/app/api/admin/products/route.ts       — CRUD productos (soporta markup/cashDiscount/ivaRate/salePrice)
src/app/api/admin/banners/route.ts        — CRUD banners promocionales
src/app/api/admin/coupons/route.ts        — CRUD cupones de descuento
src/app/api/admin/upload/route.ts         — Upload de imagenes (WebP, max 1600px)
src/app/api/admin/export/products/route.ts — Export CSV (respeta markup individual)
src/app/api/admin/suppliers/sync/route.ts — Sync Air Intra (con filtro de categorias)
src/app/api/admin/suppliers/enrich-images/route.ts — Enriquecimiento de imagenes (WebP)
src/app/api/banners/route.ts              — API publica de banners
src/app/api/shipping/route.ts             — API de cotizacion de envio
src/app/api/products/route.ts             — API publica de productos
src/app/api/categories/route.ts           — API de categorias
src/app/api/orders/route.ts               — API de pedidos
src/app/api/customer/                     — APIs de auth de clientes
tailwind.config.ts                        — Paleta Compucity
public/images/hero-slide-*.png            — Imagenes del carrusel hero
public/images/logo-compucity-icon.png     — Logo recortado
githooks/pre-push                         — Pre-push hook de proteccion
scripts/deploy.sh                         — Script de deploy seguro
```

---

## Panel Admin (`/admin`)
- **Dashboard:** Stats (productos, pedidos, clientes, categorias, proveedores)
- **Productos:** CRUD completo, markup/descuento individual, IVA (10.5%/21%), salePrice, filtros por columna, ordenamiento
- **Categorias:** Arbol de categorias con mapeos de proveedores
- **Proveedores:** 3 proveedores, sync manual, conteo de productos activos
- **Pedidos:** Lista de pedidos, gestion de estados
- **Clientes:** Lista con busqueda, detalle expandible
- **Promociones:** Cupones de descuento + Banners promocionales (con imagen de fondo)
- **Configuracion:** Cotizacion del dolar, markup global, descuento global, config de la tienda

### Paginas Admin
- `/admin` - Dashboard
- `/admin/productos` - CRUD productos con filtros y ordenamiento
- `/admin/categorias` - Arbol de categorias
- `/admin/proveedores` - Sync y gestion de proveedores
- `/admin/pedidos` - Lista de pedidos
- `/admin/clientes` - Lista de clientes
- `/admin/promociones` - Cupones + Banners
- `/admin/configuracion` - Config global (dolar, markup, Andreani)
- `/admin/login` - Login de admin

### APIs Admin
- `POST /api/admin/auth/login` / `check` / `logout`
- `GET/POST/PUT/DELETE /api/admin/products` (soporta markup/cashDiscount/ivaRate/salePrice)
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
- `GET/POST/PUT/DELETE /api/admin/banners` - CRUD banners
- `GET/POST/PUT/DELETE /api/admin/coupons` - CRUD cupones
- `POST /api/admin/upload` - Upload de imagenes (WebP)

### APIs Publicas
- `GET /api/products` - Productos con filtros
- `GET /api/categories` - Categorias
- `GET /api/banners` - Banners activos
- `GET /api/pc-builder` - Productos por slot con compatibilidad
- `GET /api/related-products` - Productos relacionados
- `GET /api/search` - Busqueda de productos
- `GET /api/dolar` - Cotizacion del dolar
- `POST /api/orders` - Crear pedido
- `POST /api/shipping` - Cotizacion de envio

---

## Imagenes de Productos
- **Total con imagen:** 2,899 (65%)
- **Total sin imagen:** 1,565 (35%)
- **Air Intra:** 1,563 sin imagen (el API syp no devuelve imagenes)
- **Elit:** 2 sin imagen (ya tienen WebP del API)
- **Invid:** 0 sin imagen (ya tienen imagenes del API)
- **Formato:** WebP (max 800px, calidad 75) almacenadas en tabla `product_images`
- **Endpoint:** `/api/image/[id]` - Sirve imagenes desde product_images
- **Cross-provider matching:** Sistema para copiar imagenes entre proveedores por brand+model
- **Scripts:** `scripts/enrich-images.mjs`, `scripts/batch-images.mjs`, `scripts/cross-provider-images.mjs`
- **product_images:** 147 imagenes

---

## Base de Datos (Turso)
- **Host:** compucity-vorterixgames-gif.aws-us-east-1.turso.io
- **Tablas (14):** products (4,464), categories (63), suppliers (3), orders (0), order_items (0), customers (1), product_images (147), dollar_rates (1), store_config (20), supplier_category_mappings (85), admins (1), banners (0), coupons (0), password_reset_tokens (2)

### Schema Products
```
id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
description TEXT, price REAL NOT NULL, comparePrice REAL, costPrice REAL,
markup INTEGER, cashDiscount INTEGER,
sku TEXT UNIQUE, stock INTEGER DEFAULT 0, isActive INTEGER DEFAULT 1,
isFeatured INTEGER DEFAULT 0, images TEXT, specs TEXT,
providerId TEXT, providerSku TEXT, categoryId TEXT,
supplierCategory TEXT, duplicateOfId TEXT, categorySource TEXT DEFAULT 'auto',
ivaRate REAL,          -- NULL = heredar de categoria, 10.5 o 21 = valor individual
salePrice REAL, saleStart TEXT, saleEnd TEXT,
createdAt TEXT, updatedAt TEXT
```

### Schema Categories (campos de precio)
```
markup INTEGER,        -- NULL = usar global (15%), numero = markup de categoria
cashDiscount INTEGER,  -- NULL = usar global (0%), numero = dto efectivo de categoria
ivaRate REAL,          -- NULL = usar default (10.5%), 10.5 o 21 = IVA de categoria
```

### Nuevos campos (2026-06-03 sesion 7)
- `ivaRate REAL DEFAULT 10.5` - IVA por producto (10.5% o 21%)
- `salePrice REAL` - Precio de oferta (si no es null y estamos en rango, reemplaza precio de lista)
- `saleStart TEXT` - Fecha inicio de oferta
- `saleEnd TEXT` - Fecha fin de oferta
- `categorySource TEXT DEFAULT 'auto'` - Origen de la categorizacion (auto/manual)

### Schema Banners
```
id TEXT PRIMARY KEY, title TEXT NOT NULL, subtitle TEXT,
buttonText TEXT, buttonLink TEXT,
bgColor TEXT DEFAULT '#3A8B68', textColor TEXT DEFAULT '#FFFFFF',
imageUrl TEXT,
position TEXT DEFAULT 'top', isActive INTEGER DEFAULT 1,
"order" INTEGER DEFAULT 0,
createdAt TEXT, updatedAt TEXT
```

### Schema Coupons
```
id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, description TEXT,
discountType TEXT NOT NULL, discountValue REAL NOT NULL,
minPurchase REAL DEFAULT 0, maxUses INTEGER DEFAULT 0,
usedCount INTEGER DEFAULT 0,
validFrom TEXT, validUntil TEXT,
isActive INTEGER DEFAULT 1,
createdAt TEXT, updatedAt TEXT
```

### Store Config (20 claves)
| Clave | Valor | Descripcion |
|-------|-------|-------------|
| markup | 15 | Margen de ganancia global (%) |
| cash_discount | 0 | Descuento efectivo global (%) |
| dollar_source | nacion | Fuente de cotizacion |
| origin_cp | 5172 | Codigo postal origen (La Falda) |
| store_name | {"value":"Compucity"} | Nombre de la tienda |
| store_slogan | {"value":"Tu Mundo Digital"} | Eslogan |
| whatsapp_number | {"value":"3517656918"} | WhatsApp |
| andreani_user | admin@compucity.com | Usuario Andreani |
| andreani_password | compucity2026 | Password Andreani |
| andreani_cliente | NULL | Codigo cliente Andreani (FALTA) |
| andreani_contrato_domicilio | NULL | Contrato domicilio Andreani (FALTA) |
| andreani_contrato_sucursal | NULL | Contrato sucursal Andreani (FALTA) |
| shipping_markup | 0 | Recargo envio (%) |
| weight_per_item | 2 | Peso por item (kg) |
| correo_email | NULL | Email Correo Argentino |
| correo_password | NULL | Password Correo Argentino |
| correo_user_token | NULL | Token usuario Correo Argentino |
| correo_password_token | NULL | Token password Correo Argentino |
| slogan | NULL | (duplicado, usar store_slogan) |
| whatsapp | NULL | (duplicado, usar whatsapp_number) |

---

## Busqueda de Productos (FIX sesion 4)
- **Bug corregido:** Al buscar desde la barra y clickear "Buscar en todos los productos" mostraba todos los productos en vez de los que coinciden con la busqueda
- **Causa raiz:** La pagina `/categoria/[slug]` extraia el parametro `q` de la URL pero nunca lo usaba. Siempre llamaba `getAllActiveProducts()` ignorando la busqueda
- **Solucion:** Ahora se llama `searchProducts(q)` cuando el parametro `q` esta presente
- **Mejoras adicionales:**
  - `searchProducts()` acepta parametro `limit` (default 20, usado 200 para busqueda completa)
  - `searchProducts()` ahora ordena por relevancia (coincidencias en nombre primero)
  - El titulo muestra "Resultados para \"X\"" cuando hay busqueda activa
  - Link "Limpiar busqueda" para volver a ver todos los productos

---

## Backups
| Fecha | Archivo | Tamano | Contenido |
|-------|---------|--------|----------|
| 2026-06-03 (s8) | `compucity-db-backup-2026-06-03T15-36-48-764Z.json` | 8.9MB | Base de datos completa (14 tablas, 4,459 productos, categorías con markup) |
| 2026-06-03 (s8) | `compucity-db-sql-backup-2026-06-03T15-37-45-192Z.sql` | 8.0MB | Base de datos completa en SQL (schema + INSERT) |
| 2026-06-04 (s9) | `src-backup-20260603-161033.tar.gz` | 831KB | Código con fix IVA por categoría (null = heredar) |
| 2026-06-03 (s8) | `compucity-code-backup-2026-06-03-1538.tar.gz` | 40MB | Código completo con sistema de 3 niveles de markup |
| 2026-06-03 (s7) | `compucity-backup-2026-06-03s7.tar.gz` | 121MB | Codigo completo con IVA, salePrice, promociones, filtros, protecciones deploy |
| 2026-06-03 (s7) | `compucity-db-2026-06-03s7.json` | 8.87MB | Base de datos completa (14 tablas, 4,464 productos, banners, coupons) |
| 2026-06-02 (s6) | `compucity-backup-2026-06-02s6.tar.gz` | 246MB | Codigo completo + propuesta IVA + investigacion Andreani |
| 2026-06-02 (s5) | `compucity-backup-2026-06-02s5.tar.gz` | 42MB | Codigo completo con prioridad imagenes + recategorizacion |
| 2026-06-02 (s5) | `compucity-db-2026-06-02s5.json` | 8.4MB | Base de datos completa (11 tablas, 4,787 filas) |
| 2026-06-02 (s4) | `compucity-backup-2026-06-02s4.tar.gz` | 42MB | Codigo completo con fix de busqueda |
| 2026-06-02 (s3) | `compucity-backup-2026-06-02s3.tar.gz` | 35MB | Codigo completo con fix permanente de categorizacion |
| 2026-06-02 (s3) | `compucity-db-2026-06-02s3.json` | 8.3MB | Base de datos completa (11 tablas, 4,787 filas) |
| 2026-06-02 (s2) | `compucity-backup-2026-06-02b.tar.gz` | 417MB | Codigo completo (sin node_modules/.next) |
| 2026-06-02 (s2) | `compucity-db-2026-06-02b.json` | 8.2MB | Base de datos completa (11 tablas, 4,787 filas) |
| 2026-06-02 | `compucity-backup-2026-06-02.tar.gz` | 443MB | Backup anterior |
| 2026-06-02 | `compucity-db-2026-06-02.json` | 8MB | DB anterior |
| 2026-05-27 | `compucity-backup-2026-05-27_04-35.tar.gz` | 13MB | Backup inicial |

Todos los backups en `/home/z/my-project/download/backups/`

---

## Envio - Andreani (Investigacion sesion 6)
- **Estado:** Implementado pero INACTIVO - las credenciales estan incompletas
- **Codigo:** `src/lib/andreani.ts` - Login JWT, cotizacion domicilio/sucursal - FUNCIONA
- **API shipping:** `src/app/api/shipping/route.ts` - Intenta Andreani -> Correo Argentino -> fallback tablas
- **Credenciales en DB (store_config):**
  - `andreani_user` = admin@compucity.com
  - `andreani_password` = compucity2026
  - `andreani_cliente` = NULL (FALTA)
  - `andreani_contrato_domicilio` = NULL (FALTA)
- **`hasAndreaniCredentials()`:** Requiere los 4 campos para habilitar llamadas a Andreani
- **Fallback actual:** Tablas de precios estimados por provincia (sin API real)
- **Accion necesaria:** El dueño debe obtener de Andreani: codigoCliente + contratoDomicilio y cargarlos en el panel admin

---

## Tareas Pendientes

### Alta Prioridad
1. **IVA 21% en categorías correspondientes:** Solo la categoría Notebooks tiene IVA 21%. El dueño debe configurar IVA 21% en categorías como Monitores, Periféricos, etc. desde `/admin/categorias`. Los productos heredan automáticamente el IVA de su categoría
2. **Credenciales Andreani:** El dueño debe proporcionar codigoCliente + contratoDomicilio
3. **Cargar imagenes faltantes:** ~1,565 productos sin imagen (mayormente Air Intra). Usar cross-provider matching + web search
4. **SODIMM en memorias-ram:** ~40 memorias SODIMM (notebook) aparecen en la categoria memorias-ram del PC builder. El sistema las marca como incompatibles, pero seria mejor moverlas a una subcategoria separada o filtrarlas del PC builder
5. **Crear banners y cupones:** Las tablas estan vacias, el dueño puede empezar a crear promociones desde `/admin/promociones`

### Media Prioridad
6. **Recuperacion de contrasena por email:** El endpoint `/api/customer/forgot-password` existe pero necesita configuracion de servicio de email (Resend)
7. **Verificar compatibilidad en Arma tu PC:** Testing exhaustivo del sistema de compatibilidad
8. **Configurar markup/descuento individual:** Empezar a usar el feature nuevo en productos que lo necesiten
9. **Correo Argentino:** Credenciales todas NULL en store_config, sin API de envio funcional

### Baja Prioridad
10. **Optimizar imagenes:** Los thumbnails del catalogo podrian usar tamano reducido
11. **SEO:** Meta tags, sitemap dinamico, structured data
12. **Limpiar claves duplicadas en store_config:** slogan/whatsapp estan duplicados con store_slogan/whatsapp_number

---

## Historial de Cambios
- **2026-06-04 (s9):** Fix IVA por categoría - La columna ivaRate no existía en tabla categories (migración #21 nunca se ejecutó en Turso). Se agregó manualmente. Se corrigió que todos los productos tenían ivaRate=10.5 forzado (4,445 productos actualizados a NULL para que hereden de categoría). Admin productos: selector IVA ahora tiene opción "Heredar de categoría" en vez de forzar 10.5%. API productos: ivaRate vacío ahora guarda NULL en vez de 10.5. Fórmula preview muestra IVA heredado correctamente. Categoría Notebooks configurada con IVA 21%. Deploy + backup
- **2026-06-03 (s8):** Sistema de 3 niveles de markup implementado - Producto individual → Categoría → Global. Todas las APIs (pública, admin, export, PC Builder) actualizadas para respetar prioridad. Admin categorías: campos markup/cashDiscount (ya existían). Admin productos: badges MC/DC para markup por categoría, vista previa muestra "(categoría)" cuando aplica, cálculo en vivo al cambiar categoría. Admin products API: GET usa calculateProductPrices con category markup map, POST/PUT usan 3 niveles al crear/actualizar. Export CSV usa 3 niveles. Backups completos (código 40MB + DB JSON 8.9MB + DB SQL 8.0MB)
- **2026-06-03 (s7):** IVA diferenciado implementado - campo ivaRate (10.5%/21%) en productos, formula de precios actualizada con IVA. Sistema de promociones completo - cupones de descuento + banners promocionales con imagen de fondo. Filtros y ordenamiento en tabla de admin productos. Precio de oferta (salePrice/saleStart/saleEnd). Protecciones contra deploy de versiones viejas (pre-push hook + deploy script + eliminacion repo duplicado + .gitignore). Fix error en promociones (Image import + upload API + columna imageUrl en banners). Backups completos (codigo 121MB + DB 8.87MB)
- **2026-06-02 (s6):** Investigacion Andreani (credenciales incompletas, falta codigoCliente + contratoDomicilio). Propuesta de implementacion IVA diferenciado (10.5% / 21%) - 3 opciones presentadas, en espera de confirmacion del dueño. Backup codigo 246MB
- **2026-06-02 (s5):** Prioridad global de imagenes - Productos con foto aparecen primero en todo el sitio (home, categorias, busqueda, PC Builder, relacionados). Recategorizacion: 7 PC Gamer Raptor (gabinete+fuente) movidas a gabinetes, 4 Gabinete Raptor de joysticks a gabinetes, 3 Switches TP-Link de oficina-pc a switches. Homepage PC Armadas: mezcla balanceada por subcategoria (round-robin). Backup completo (codigo 42MB + DB 8.4MB)
- **2026-06-02 (s4):** Fix de busqueda de productos - El boton "Buscar en todos los productos" ahora muestra los resultados correctos. Causa: parametro q se extraia pero no se usaba. Solucion: searchProducts(q) cuando hay query. Mejoras: orden por relevancia, titulo dinamico, link limpiar busqueda. Push a GitHub exitoso
- **2026-06-02 (s3):** Fix PERMANENTE de categorizacion en PC Builder - 3 capas de defensa: (1) Whitelist BUILDER_INCLUDE_PATTERNS que valida nombre de producto en runtime, (2) CATEGORY_KEYWORD_MAP reordenado con productos completos antes de componentes, (3) Validacion post-sync automatica mejorada. Bug corregido: markup/cashDiscount faltantes en SELECT de pc-builder. Eliminadas rutas duplicadas (recuperar-contrasena, resetear-contrasena). Instalado paquete resend. Backup completo (codigo 35MB + DB 8.3MB)
- **2026-06-02 (s2):** Markup y descuento individual por producto - Cada producto puede tener su propio markup y cashDiscount (si es NULL, usa el global). Bug corregido en pc-builder (formula cash price). Badges M/D en tabla de admin. Migracion ejecutada en Turso (columnas markup, cashDiscount). Backup completo (codigo 417MB + DB 8.2MB)
- **2026-06-02:** Limpieza de categorias en Arma tu PC - Motherboards: 14 productos desactivados + 2 recategorizados. Gabinetes: limpieza masiva (15 monitores desactivados, 21 fuentes movidas, 8 coolers movidos, etc.). Refrigeracion: 9 cables iCUE movidos a cables. PC builder categorias limpias. Backup completo
- **2026-06-02:** Backup completo (codigo 443MB + DB 8MB). Actualizacion de PROJECT_STATUS.md
- **2026-06-01:** Selector de cantidades en Arma tu PC - RAM (1-4), SSD (1-4), HDD (1-2). Precios se multiplican automaticamente. WhatsApp muestra "2x Producto - $precio c/u = $total"
- **2026-06-01:** PC Armadas - Categoria agregada con 53 productos (24 mini-pc, 22 oficina-pc, 7 gamer-pc). 33 PCs movidas de categorias incorrectas. 108 productos networking Air Intra desactivados. Homepage muestra seccion PC Armadas
- **2026-06-01:** Filtro global de stock - Productos sin stock no se muestran en toda la tienda
- **2026-06-01:** Arma tu PC - Mobile sticky bottom bar, sistema de compatibilidad funcional (socket, DDR, wattage), correccion de filtros de categorias en DB
- **2026-05-27:** Filtro Air Intra only - Solo Air Intra se filtra a perifericos/componentes/cables. Elit e Invid mantienen TODOS sus productos. Re-sync de Elit (1,519) e Invid (1,191)
- **2026-05-27:** Login de clientes + datos de envio - Sistema completo de autenticacion, provincia en checkout, shippingDetails como campo propio, tracking URLs
- **2026-05-27:** Redisenio del Hero - de seccion estatica a carrusel full-width con 4 slides
- **2026-05-27:** Deploy inicial, logo, favicon, paleta de colores, navbar, footer
