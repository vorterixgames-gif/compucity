# Compucity - Project Status

**Ultima actualizacion:** 2026-08-13 (sesión 66 — alta manual SKU 214348 ASUS X870 + descripción IA)

---

## Tienda Proyecto
- **Nombre:** Compucity - Tu Mundo Digital
- **Tipo:** E-commerce de informatica (sin pasarela de pagos, pedidos por WhatsApp)
- **Ubicacion:** La Falda, Valle de Punilla, Cordoba, Argentina
- **WhatsApp:** +54 9 3548 40-2056
- **Email:** compucitylafalda@gmail.com
- **Direccion:** Av. Sarmiento 462 - La Falda, Cordoba
- **Estado:** EN PRODUCCION (Vercel auto-deploy desde GitHub main)
- **URL produccion:** https://www.compucityonline.com.ar/
- **URL admin:** https://www.compucityonline.com.ar/admin
- **Commit estable:** 9f5591b (fix: generate-description + fallback modelos Groq)
- **Commit actual:** 9f5591b
- **Git tag ultimo:** v-seo-optimized (commit c5b7458)
- **Credenciales admin:** admin@compucity.com / compucity2026
- **Sesiones totales:** 66
- **Plan Turso:** Scaler ($5.99/mes, 2.5B rows reads) - upgradeado sesion 43

## Stack Tecnologico
- **Framework:** Next.js 16.2.10 + TypeScript 6
- **Estilos:** Tailwind CSS 4 + shadcn/ui
- **Base de datos:** Turso (libSQL) + Prisma ORM (solo schema, raw SQL en runtime)
- **Auth:** Custom HMAC cookie auth (admin_token + customer_token)
- **Estado:** Zustand + React Query (@tanstack/react-query)
- **Deploy:** GitHub push a main -> Vercel auto-deploy
- **Runtime:** Bun
- **Carousel:** Embla Carousel (Hero + Productos Destacados)
- **Animaciones:** Framer Motion
- **PDF:** jsPDF (client-side)
- **Graficos:** Recharts
- **Iconos:** Lucide React
- **Formularios:** React Hook Form + Zod

### Credenciales y Accesos
- **GitHub:** https://github.com/vorterixgames-gif/compucity
- **Turso DB URL:** libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io
- **Turso Auth Token:** Ver `.env` (TURSO_AUTH_TOKEN)
- **Admin Secret:** Ver `.env` (ADMIN_SECRET = compucity_hmac_prod_2026_a8f3e1b9c7d2)
- **Air Intra API:** Ver `.env` (credenciales del proveedor)
- **CRON Secret:** Ver `.env` (CRON_SECRET)
- **Nota:** Todas las credenciales sensibles estan en `.env` (no commiteado al repo)

---

## Proveedores (Regla CRITICA)

### REGLA DE FILTRADO POR PROVEEDOR
- **Air Intra:** Todos los productos con precio > 0 se activan (igual que Invid/Elit). Si `allowedCategories` esta configurado (no null), se aplica como filtro adicional
- **Elit:** MANTIENE TODOS sus productos (notebooks, impresion, toners, UPS, etc.)
- **Invid Computers:** MANTIENE TODOS sus productos (notebooks, routers, switches, etc.)

### Proveedores en DB (5 registros)
| ID | Nombre | Productos | Sync | Notas |
|----|--------|-----------|------|-------|
| air-intra | Air Intra | ~4,568 | GitHub Actions cada 12h | Stock total (suma de todos los depositos) + filtro de rubros |
| elit | Elit | ~1,543 | GitHub Actions cada 6h | Stock total único (s47: migrado de cron Vercel a GitHub Actions) |
| invid | Invid Computers | ~1,322 | GitHub Actions cada 6h | STOCK_STATUS texto → número (s47: migrado de cron Vercel a GitHub Actions) |
| (otros) | - | - | - | Proveedores con 0 productos |

### FIX sesion 47: Migración sincronización Elit+Invid a GitHub Actions
- **Problema:** el cron de Vercel Hobby fallaba silenciosamente. El dueño reportó productos Elit marcados como "sin stock" cuando en realidad tenían stock en el centro de distribución (CD). SKU de ejemplo: MSIMONM274CFX24 (API reportaba stock_total=38, DB tenía stock=0).
- **Causa raíz:** el cron diario `0 6 * * *` definido en `vercel.json` no se estaba ejecutando. Confirmado por tabla `rate_limits` vacía y productos con `updatedAt` de hace 14 días aunque la API reportaba cambios.
- **Investigación API Elit:** la API devuelve 3 campos: `stock_total`, `stock_deposito_cliente`, `stock_deposito_cd`. NO oculta información por depósito. El bug no era de lectura de campos, era que el cron simplemente no corría.
- **Sync manual one-shot:** se ejecutó script directo contra Turso. 309 productos actualizados (21 pasaron de stock=0 → con stock, 6 de con stock → 0, 56 con cambios de precio).
- **Solución permanente:** migración a GitHub Actions (igual que Air Intra en s43).
  - `scripts/sync-elit-external.mjs` (nuevo): sync Elit con retry HTTP (3 intentos, 30s entre cada uno).
  - `scripts/sync-invid-external.mjs` (nuevo): sync Invid con retry auth (3 intentos, 30s).
  - `.github/workflows/sync-elit-invid.yml` (nuevo): cron cada 6h (00:00, 06:00, 12:00, 18:00 UTC = 21:00, 03:00, 09:00, 15:00 Argentina).
  - 4 secrets nuevos en GitHub: `ELIT_USER_ID`, `ELIT_TOKEN`, `INVID_USER`, `INVID_PASS`.
  - `src/app/api/cron/sync/route.ts`: limpiado. Solo queda `revalidateTag('products')` como fallback manual.
  - `vercel.json`: removido el cron job.
- **Validación:** workflow disparado manualmente (run 28455692930) → success. Elit: 1600 productos, 6 updates, 5.6s. Invid: 5761 productos, 0 updates (sin cambios), 15.2s, Auth OK intento 1/3.
- **Beneficio:** GitHub Actions manda mail automáticamente si el workflow falla. Vercel Hobby fallaba silenciosamente.
- **Estado actual de workflows en GitHub Actions:**
  - `sync-air-intra.yml` (cada 12h) — s43
  - `sync-elit-invid.yml` (cada 6h) — s47 ← NUEVO
  - `sync-brands.yml` (1 vez/día) — s44
- **Costo:** $0 (GitHub Actions free tier, ~15 min/run × 4 runs/día = 1h/día, muy por debajo del límite de 2000 min/mes).
- **Commit:** 6f2006e

### FIX sesion 17: isActive de Air Intra alineado con Invid/Elit
- **Antes:** Air Intra usaba logica compleja de `allowedCategories` que por defecto desactivaba productos (isActive=0 si no tenian categoria o la categoria no estaba en la lista)
- **Despues:** Productos con precio > 0 son activos por defecto (igual que Invid). `allowedCategories` solo filtra si esta configurado (no null)
- **Resultado:** 230 productos de Air Intra que estaban inactivos ahora estan activos
- **sync-providers.mjs:** Se agrego Air Intra al script de sincronizacion batch (antes solo sincronizaba Invid y Elit)

### FIX sesion 18: Air Intra sync error handling + rate limit detection
- **Bug:** Air Intra sync fallaba con errores de rate limiting (HTTP 429) y no los manejaba correctamente
- **Fix:** Se mejoro el manejo de errores en la sync de Air Intra con deteccion de rate limiting, retry automatico con backoff, y mensajes de error mas descriptivos
- **Commit:** cd980cc

### MEJORA sesion 19: Air Intra Batched Sync (evita timeout de Vercel)
- **Problema:** El sync completo de Air Intra (~7,500 productos, 16 paginas de 500) puede tardar 30-60+ segundos, excediendo el limite de 60s de Vercel Hobby plan para serverless functions
- **Solucion:** Sync por lotes (batched) - divide la sincronizacion en chunks de 4 paginas (~2,000 productos, ~10-15s por lote)
- **Arquitectura:**
  1. Primer call: Login + lote 1 (paginas 0-3). Retorna `hasMore: true`, `nextPage: 4`, `token`, `exchangeRate`
  2. Calls subsiguientes: Frontend envia `batch: { startPage, endPage, token, exchangeRate }` para cada lote
  3. Finalize step: Despues de todos los lotes, frontend envia `batch: { token, exchangeRate, finalize: true }` que ejecuta syp sync, recategorizacion, recovery, y actualiza lastSyncAt
- **Backend:** `syncAirIntraBatch()` y `syncAirIntraFinalize()` en `src/app/api/admin/suppliers/sync/route.ts`
- **Frontend:** `handleSync()` en `src/app/admin/proveedores/page.tsx` - orquesta los lotes automaticamente con barra de progreso
- **vercel.json:** `maxDuration` corregido a 60 (antes decia 300, pero Hobby plan limita a 60s)
- **PAGES_PER_BATCH:** 4 (constante, 4 x 500 = 2,000 productos por lote)
- **Compatibilidad:** Invid y Elit siguen usando sync completo (no necesitan batched, son mas chicos)

### MEJORA sesion 18: Sync robusto de Air Intra - Verificacion doble + post-sync check
- **Problema de fondo:** El sync de Air Intra pierde productos cuando el JSON se corrompe por PHP notices. Incluso cuando `JSON.parse` tiene exito, algunos productos pueden perderse silenciosamente
- **Mejora 1 - Verificacion doble:** `extractProductsFromCorruptedJson` ahora se ejecuta SIEMPRE (no solo como fallback). Despues del parse standard, compara la cantidad de productos extraidos vs parseados. Si el extractor encuentra mas productos, los recupera y los agrega al array de productos. Esto atrapa productos que se pierden cuando PHP notices corrompen el JSON entre objetos
- **Mejora 2 - Post-sync verification:** Despues de completar la sync, compara el total de productos sincronizados vs el total en la DB. Si la sincronizacion trajo significativamente menos productos que los que ya existen, genera un warning en el log
- **Mensaje informativo:** El resultado del sync ahora indica si se uso la extraccion de objetos como fallback
- **Commit:** 94bdbd4

### MEJORA sesion 26 (REVERTIDA sesion 43): Stock por deposito - Suma de todos los depositos
- **Sesion 26 (anterior):** El sync usaba SOLO el stock del deposito de Cordoba (`cba`). Esto ocultaba productos con stock en otros depositos.
- **Sesion 43 (revertido):** Se volvio a la logica de SUMAR TODOS los depositos (`air + lug + ros + cba + mza`).
- **Justificacion:** El negocio envia desde cualquier deposito, no solo Cordoba. Filtrar por CBA dejaba muchos productos como "sin stock" cuando en realidad habia disponibilidad.
- **Depositos de Air Intra:** `air` (Buenos Aires), `lug` (Lugo), `ros` (Rosario), `cba` (Cordoba), `mza` (Mendoza)
- **Campo DB:** `stockByWarehouse TEXT` - JSON con stock por deposito, ej: `{"air":100,"lug":100,"ros":37,"cba":50,"mza":0}`
- **Campo DB:** `stock INTEGER` - suma total de todos los depositos
- **Archivos donde se aplica esta logica:**
  - `src/app/api/admin/suppliers/sync/route.ts` (syncAirIntraBatch, syncAirIntraFinalize, syncAirIntra)
  - `src/app/api/cron/sync/route.ts` (syncAirIntraStock)
- **Elit:** Sin cambios - solo devuelve `stock_total`, no tiene desglose por deposito
- **Invid:** Sin cambios - no tiene datos de depositos
- **Frontend:** El Filtro Global de Stock oculta productos con `stock <= 0` (donde stock = suma total)

### MEJORA sesion 21: FIX CRITICO Air Intra sync - Productos faltantes
- **Bug:** Paginacion se detenida prematuramente cuando JSON corrupto causaba que una pagina devolviera <500 productos
- **Fix:** Cambio de endpoint `syp` a `articulos` (7,499 productos vs 4,500 de syp)
- **Resultado:** Air Intra paso de 1,702 a 7,511 productos (7,324 activos)
- **Commits:** da050a3, 3ed8b21, 2cf33b5

### Estado actual de productos (2026-06-16 sesion 43 - backup)
| Metrica | Cantidad |
|---------|----------|
| Total productos en DB | 10,960 |
| Marcas en DB | 112 |
| Categorias | 73 |
| Proveedores | 5 |
| Imagenes (product_images) | 1,192 |
| Clientes | 2 |
| Admins | 1 |
| Mapeos proveedor-categoria | 86 |
| Store config keys | 25 |

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
- **Logo PDF:** `public/images/logo-compucity-pdf.png` (547x220px, RGBA) - Logo completo con forma geometrica verde + COMPU CITY + TU MUNDO DIGITAL
- **Logo base64:** `src/lib/compucity-logo-base64.ts` - Encoding base64 para uso en jsPDF
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

## Sistema de Precios (Global + Categoria + Individual + IVA)

### Configuracion Global
- **Markup (margen de ganancia):** 15% (store_config: markup = 15)
- **Descuento efectivo:** 0% (store_config: cash_discount = 0)
- **IVA por defecto:** 10.5% (campo ivaRate en products, default 10.5)
- **Fuente dolar:** Banco Nacion (dolar_api) o Dolar Blue (configurable)
- **Cache dolar:** 15 minutos (Next.js revalidate + memoria admin)
- **API externa:** DolarApi.com (dolarapi.com/v1/dolares/oficial o /blue)
- **Flujo cache:** Memoria (15 min) -> DB -> Next.js fetch cache (15 min) -> API externa -> Fallback 1415
- **Panel admin:** `/admin/configuracion` - Permite cambiar dolar, markup, descuento global

### Sistema de 3 Niveles de Markup (IMPLEMENTADO sesion 8)
- **Prioridad:** Producto individual -> Categoria -> Global
- **Campos en categorias:** `markup` y `cashDiscount` (nullable, si es null usa el global)
- **Campos en productos:** `markup` y `cashDiscount` (nullable, si es null usa categoria o global)
- **Vista previa en admin productos:** Muestra si se usa "(individual)", "(categoria)" o global
- **Badges en tabla:** M (markup individual), MC (markup categoria), D (dto individual), DC (dto categoria)
- **Calculo en vivo:** Al cambiar categoria en el formulario, se recalculan precios considerando markup de categoria
- **APIs actualizadas:** Todas las APIs (publica, admin, export, PC Builder) usan el sistema de 3 niveles
- **Estado actual:** 0 categorias con markup propio (todas usan global 15%), 2 productos con markup individual

### Markup y Descuento Individual por Producto
- Cada producto puede tener su propio **markup** y **cashDiscount** (campos nullable en la DB)
- Si el producto tiene valor individual, se usa ese; si es NULL, se verifica la categoria, y si tampoco tiene, se usa el global
- **Interfaz admin:** Campos "Margen individual (%)" y "Descuento efectivo individual (%)" en el formulario de productos
- **Indicadores visuales:** Badges "M" (markup) y "D" (descuento) en la tabla de productos
- **Vista previa:** El calculo automatico muestra si se estan usando valores individuales con etiqueta "(individual)"
- **Estado actual:** 2 productos con markup individual, 12 con cashDiscount individual

### IVA Diferenciado (IMPLEMENTADO sesion 7, actualizado sesiones 9-10, FIX sesion 45)
- **Campo products:** `ivaRate REAL` (nullable, NULL = heredar de categoria o default 10.5%)
- **Campo categories:** `ivaRate REAL` (nullable, NULL = usar default 10.5%)
- **Prioridad:** Producto individual -> Categoria (con herencia padre) -> Default (10.5%)
- **Herencia de categoria padre (GLOBAL, sesion 10):** Las subcategorias heredan ivaRate/markup/cashDiscount de su categoria padre si no tienen valor propio. Funciona en TODAS las categorias, no solo una especifica
- **Categorias con IVA propio:** Notebooks=21%, Monitores=21%
- **Interfaz admin productos:** Selector IVA con opcion "Heredar de categoria -> X%" (muestra valor heredado) + "10,5%" + "21%". Texto de ayuda: "Usando IVA X% de la categoria [nombre]"
- **Interfaz admin categorias:** Selector IVA con opcion "Default (10,5%)" + "10,5%" + "21%"
- **Columna IVA en tabla admin:** Muestra IVA efectivo con colores (violeta=categoria, morado=individual, gris=default)
- **FIX sesion 45 dia 2 (commit 167f8f6):** Bug critico descubierto: la columna `ivaRate` fue creada con `DEFAULT 10.5` (db.ts linea 224). Los INSERTs del sync (Air Intra, Invid, Elit) NO incluian `ivaRate`, asi que SQLite les asignaba automaticamente 10.5 (el DEFAULT) en vez de NULL. Como `product.ivaRate = 10.5` (no NULL), `calculateProductPrices` usaba 10.5% individual y NUNCA consultaba la categoria (que tiene 21%). Resultado: 74 productos en Monitores con IVA 10.5% en vez de 21%. Fix aplicado: (1) UPDATE directo en DB para setear ivaRate=NULL en los 74 productos afectados de Monitores, (2) agregado `ivaRate, NULL` explicito en los 9 INSERTs de sync (sync-air-intra-external.mjs: 1 INSERT, suppliers/sync/route.ts: 8 INSERTs). NOTA: Notebooks NO fue afectado porque los productos ya tenian ivaRate=NULL correctamente (verificado). El DEFAULT de la columna NO se cambio (SQLite no soporta ALTER COLUMN DEFAULT), el fix en los INSERTs es la solucion correcta.

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
Donde markup, cashDiscount e ivaRate siguen prioridad: Producto individual -> Categoria (heredando de padre si no tiene) -> Global/Default.

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

### 13 Slots de Componentes
| Slot | Label | Categoria Slug | Requerido | Max Cantidad |
|------|-------|---------------|-----------|-------------|
| processor | Microprocesador | microprocesadores | Si | 1 |
| motherboard | Motherboard | motherboards | Si | 1 |
| ram | Memoria RAM | memorias-ram | Si | 4 |
| gpu | Placa de Video | placas-de-video | No | 1 |
| ssd | Disco SSD | discos-ssd | Si | 4 |
| hdd | Disco HDD | discos-hdd | No | 2 |
| psu | Fuente | fuentes | Si | 1 |
| case | Gabinete | gabinetes + gabinetes-con-fuente | Si | 1 |
| cooling | Refrigeracion | refrigeracion | No | 1 |
| thermal | Pasta Termica | pastas-termicas | No | 1 |
| monitor | Monitor | monitores | No | 2 |
| network | Placa de Red / WiFi | placas-de-red | No | 1 |
| peripherals | Perifericos | perifericos | No | 3 |

### Sistema de Filtrado de Productos (3 capas - FIX PERMANENTE)
El PC Builder usa **3 capas de defensa** para garantizar que solo productos correctos aparezcan en cada slot:

| Capa | Mecanismo | Descripcion |
|------|-----------|-------------|
| **1. Inclusion (Whitelist)** | `BUILDER_INCLUDE_PATTERNS` | Cada slot define que palabras clave DEBE tener el nombre del producto. Si no coincide con NINGUN patron, no aparece. **Es la defensa principal: funciona incluso si la categoria en la DB esta mal** |
| **2. Exclusion (Blacklist)** | `BUILDER_EXCLUDE_PATTERNS` | Patrones que excluyen productos no deseados (notebooks en GPU, discos externos en SSD, etc.) |
| **3. Compatibilidad** | `applyCompatibilityFilters` | Filtra por socket (CPU->Mother), DDR (Mother->RAM), wattaje (GPU->PSU) |

### Sistema de Compatibilidad
- Filtrado automatico por socket (CPU -> Mother), DDR (Mother -> RAM), wattaje (GPU -> PSU)
- Badges de compatibilidad: ShieldCheck + socket/DDR/wattage en cada producto
- Productos incompatibles: Se muestran aparte con razon de incompatibilidad, toggle para verlos
- Banner de filtro activo: Indica cuando se esta filtrando por compatibilidad
- **SODIMM (RAM notebook):** Excluidas del PC Builder (SODIMM en blacklist del slot RAM)

### Deteccion de Socket (FIX sesion 16)
- **Bug:** Intel Core Ultra 5 225F con "LGA1851" (sin espacio) en el nombre era detectado como Socket LGA 1700
- **Causa raiz:** El regex `/\bS?1851\b/` no matcheaba "LGA1851" porque `\b` no detecta boundary entre "A" y "1"
- **Fix 1 - Regex:** Cambiado a `/(?:S|LGA\s*)?1851/` que matchea S1851, LGA 1851, LGA1851 y 1851 standalone
- **Fix 2 - Intel Core Ultra:** Si el nombre contiene "CORE ULTRA", siempre se asigna socket 1851 (Arrow Lake)
- **Archivos:** `src/lib/compatibility.ts`, `src/app/(tienda)/arma-tu-pc/page.tsx`

### Proteccion de Slugs de Categorias (FIX sesion 16)
- **Bug:** Cambiar el nombre de una categoria usada en Arma tu PC rompia el PC Builder porque el slug se regeneraba automaticamente
- **Fix:** API PUT `/api/categories` ya no auto-regenera el slug al cambiar el nombre. El slug solo se actualiza si se envia explicitamente en el body
- **Admin categorias:** Campo slug ahora editable manualmente con advertencia amarilla "No cambiar si se usa en Arma tu PC"

### PDF Download (IMPLEMENTADO sesion 15, MEJORA sesion 20, SEPARADO sesion 27)
- **Libreria:** jsPDF (client-side, no necesita server)
- **Cuando:** Boton separado "Descargar PDF" en Arma tu PC (ya NO se descarga automaticamente al tocar WhatsApp)
- **Contenido del PDF:**
  - Header con logo real de Compucity (imagen PNG, 55x22mm) a la izquierda
  - Fecha, hora y URL a la derecha del header
  - Separador verde debajo del header
  - Lista de componentes con slot, nombre, precio unitario y total
  - Precio de lista y precio en efectivo (destacado en verde)
  - Nota de 96 horas habiles
  - Footer con datos de contacto y paginacion
- **Nombre del archivo:** `Compucity-PC-a-Medida.pdf`
- **MEJORA sesion 20:** Header del PDF reemplazado de texto a logo real de Compucity usando base64 encoding
- **MEJORA sesion 27:** PDF y WhatsApp separados en botones distintos - "Descargar PDF" (oscuro) y "Consultar por WhatsApp" (verde)

### Sistema de Filtros Manuales (IMPLEMENTADO sesion 14, MEJORA sesion 28)
- **Filtros por categoria:** Cada slot tiene filtros relevantes que el usuario puede activar/desactivar
- **Logica:** AND entre grupos de filtros, OR dentro del mismo grupo
- **Auto-reset:** Los filtros se limpian automaticamente al cambiar de slot
- **UI:** Desplegables `<select>` dropdown (MEJORA sesion 28)

| Slot | Filtros Disponibles |
|------|-------------------|
| Processor | Marca: AMD, Intel |
| Motherboard | Socket: AM4, AM5, LGA 1700, LGA 1851 . Memoria: DDR4, DDR5 |
| RAM | Memoria: DDR3, DDR4, DDR5 . Capacidad: 4GB, 8GB, 16GB, 32GB, 64GB+ |
| GPU | Marca: NVIDIA, AMD, Intel Arc . VRAM: 4GB, 6GB, 8GB, 10GB, 12GB, 16GB, 24GB . Serie: RTX 3050/3060/4060/4060Ti/4070/4070S/4070TiS/4080S/5060/5060Ti/5070/5070Ti/5080, RX 6600/6700/7600/7700/7800/7900, Arc A750/A770 |
| SSD | Marca: Kingston, WD, Hiksemi, ADATA/XPG, Lexar, Crucial, Memox, Samsung, MSI . Tipo: M.2/NVMe, SATA . Capacidad: Hasta 256GB, 480-512GB, 960GB-1TB, 2TB, 4TB+ |
| HDD | Marca: Seagate, WD, Toshiba . Capacidad: 1TB, 2TB, 4TB, 6-8TB, 10-12TB, 16TB+ |
| PSU | Potencia: Hasta 500W, 550-650W, 700-750W, 800-850W, 1000W+ |
| Cooling | Tipo: AIO/Liquida, Aire |
| Case | Tipo: Con Fuente, Sin Fuente |
| Monitor | Tamano: 19", 22", 24", 27", 32"+ . Resolucion: Full HD, QHD, 4K/UHD . Frecuencia: 100Hz, 144Hz, 165Hz, 180Hz |
| Network | Tipo: PCIe, USB, WiFi 6/6E |
| Perifericos | Tipo: Mouse, Teclado, Auricular, Webcam, Microfono, Volante, Parlante, Joystick |

### Selector de Cantidades (MEJORA sesion 27)
- RAM: 1 a 4 unidades (un solo producto)
- SSD: 1 a 4 unidades, **permite modelos diferentes** (ej: 1x SSD 500GB + 1x SSD 1TB)
- HDD: 1 a 2 unidades, **permite modelos diferentes**
- Los precios se multiplican automaticamente por la cantidad de cada disco
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
- **Homepage:** 3 secciones con variedad de precios (1 barato, 2 medios, 1 caro por seccion). Orden: Notebooks, Monitores, PCs
- **Keywords de deteccion:** PC LENOVO, PC KELYX, SIST., BAREBONE

---

## Categorias del Sitio (72 total en DB)

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

### Filtros por Categoria en Tienda (IMPLEMENTADO sesion 14, ACTUALIZADO sesiones 27-31)
- **Componente:** `src/components/ui-custom/CategoryProducts.tsx`
- **Tipo:** Filtros desplegables `<select>` por grupo (marca, tipo, capacidad, tamano, resolucion, frecuencia, Hz)
- **Config:** `CATEGORY_FILTERS` - define grupos de filtros y opciones por slug de categoria
- **Logica:** Single-select por grupo (elegir una opcion limpia la anterior). AND entre grupos, OR dentro del mismo grupo
- **Herencia subcategorias:** Las subcategorias sin filtros propios heredan del padre via `filterSlug`
- **Categorias con filtros:** TODAS las categorias con productos activos tienen filtros de marca (sesion 30)

---

## Productos Destacados (IMPLEMENTADO sesion 35, MEJORA sesion 36)

### Funcionalidad completa
- **Campo DB:** `products.isFeatured INTEGER` (0 o 1, por defecto 0)
- **Query:** `getFeaturedProducts()` - Trae productos con `isFeatured = 1 AND isActive = 1 AND stock > 0`, max 8
- **Badge visual:** Badge verde "DESTACADO" en el ProductCard (solo si no esta en oferta)

### Seccion en la Home (Carrusel)
- **Ubicacion:** Despues de BrandLogos, antes de CategoryIcons
- **Componente:** `src/components/ui-custom/FeaturedProductsCarousel.tsx` - Embla Carousel + Autoplay (4s)
- **Responsive:** 2 cards mobile, 3 tablet, 4 desktop
- **Loop infinito** para navegacion continua
- **Condicion:** Solo se muestra si hay productos destacados

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

---

## Admin Productos - Filtros y Ordenamiento (IMPLEMENTADO sesion 7, actualizado sesion 16)
- **Filtros por columna:** Busqueda por nombre, filtro por proveedor, filtro por categoria, filtro por estado (activo/inactivo), filtro por IVA (10.5%/21%), filtro por stock (con/sin)
- **Filtro "Sin categoria":** Opcion en el dropdown de categorias para encontrar productos sin categoria asignada
- **Filtro por proveedor:** Columna y dropdown de proveedor en la tabla de productos
- **Filtro "Ingresado manualmente":** Opcion en el dropdown de proveedor para filtrar productos sin proveedor
- **Ordenamiento:** Click en encabezados de columna para ordenar asc/desc (nombre, costo USD, precio lista, stock, IVA, marca)
- **Seleccion Multiple y Eliminacion Masiva:** Checkboxes en cada fila, select all, barra de acciones, DELETE paralelo (sesion 16)

---

## Protecciones contra Deploy de Versiones Viejas (IMPLEMENTADO sesion 7)

### Capa 1: Pre-push hook
- **Archivo:** `githooks/pre-push` (configurado via `git config core.hooksPath githooks`)
- **Funcion:** Antes de cada `git push`, verifica que el local no este atras del remoto
- **Si el local esta atras:** Bloquea el push y muestra instrucciones para hacer `git pull --rebase origin main`

### Capa 2: Script de deploy seguro
- **Archivo:** `scripts/deploy.sh`
- **Uso:** `bash scripts/deploy.sh "mensaje del commit"`
- **Verificaciones:** Rama correcta, fetch remoto, comparar commits, verificar cambios pendientes

### Capa 3: Eliminacion del repo duplicado
- **Accion:** Se elimino la carpeta `compucity-repo/` que causaba confusion
- **Proteccion:** Se agrego `compucity-repo/` al `.gitignore`

### Workflow recomendado
1. Siempre hacer `git pull --rebase origin main` antes de trabajar
2. Hacer cambios, probar localmente
3. Usar `bash scripts/deploy.sh "feat: descripcion"` para pushear de forma segura
4. Vercel se actualiza automaticamente con el push

---

## Chatbot de Notebooks "Citi" (IMPLEMENTADO sesion 37)
- **Componente:** `src/components/notebook-assistant-chat.tsx` - Chat flotante con asistente IA
- **API:** `POST /api/notebook-assistant` - Busca notebooks en DB, genera 3 opciones (Economica, Recomendada, Premium)
- **Banner:** `src/components/ui-custom/NotebookChatBanner.tsx` - Banner verde en pagina de categorias de notebooks
- **Categorias:** Aparece en notebooks, gamer-y-diseno, oficina
- **Colores:** Compucity green (no blue/indigo)
- **Integracion:** Seleccionar una notebook recomendada la agrega al carrito

## Chatbot PC Builder "Citi" (IMPLEMENTADO sesion 33)
- **Componente:** `src/components/pc-assistant-chat.tsx` - Boton flotante "Arma tu setup"
- **API:** `POST /api/pc-assistant` - Genera 3 builds (Economica, Recomendada, Premium) con criterio de precios por tier
- **priceBias:** low (maxMultiplier=1.0), mid (maxMultiplier=1.2), high (maxMultiplier=1.4)
- **Mensaje "Compartir con equipo"** despues de cada build

---

## SEO + GEO (IMPLEMENTADO sesion 41)
1. **Root layout:** Title template (%s | Compucity), OG completo (locale es_AR, siteName, image 1200x630), Twitter Cards (summary_large_image), canonical URL, viewport (themeColor), metadataBase, robots config (max-image-preview large)
2. **Product pages:** generateMetadata dinamico con title, description, OG image del producto, Twitter Cards, canonical URL, Product JSON-LD schema (precio, stock, imagen, seller)
3. **Category pages:** generateMetadata dinamico con title, description, OG, canonical, BreadcrumbList JSON-LD
4. **Metadata para paginas estaticas:** contacto, arma-tu-pc, elige-tu-notebook (con canonical y OG)
5. **Layout wrappers para client pages:** carrito, checkout, favoritos, mis-pedidos, recuperar/resetear-contrasena (metadata con noindex para paginas privadas)
6. **Admin:** layout convertido a server component + AdminLayoutClient separado, metadata noindex/nofollow para todo /admin/*
7. **JSON-LD structured data:** LocalBusiness/ElectronicsStore en tienda layout. WebSite schema con SearchAction. Product schema en producto/[slug]. BreadcrumbList en Breadcrumbs component (global)
8. **Sitemap dinamico:** `src/app/sitemap.ts` genera entradas para paginas estaticas + categorias habilitadas + productos activos
9. **Robots.ts dinamico:** Disallow /admin/, /api/, /carrito, /checkout, /favoritos, /mis-pedidos, /recuperar-contrasena, /resetear-contrasena. Sitemap: https://www.compucityonline.com.ar/sitemap.xml
10. **Homepage H1 fix:** h1 sr-only accesible para crawlers + HeroSection carousel h1->h2
11. **Canonical URLs** en todas las paginas
12. **Custom 404 page** (not-found.tsx)
13. **OG image generada** (1344x768)
14. **next.config:** poweredByHeader: false

---

## Estructura Key Files
```
src/app/(tienda)/page.tsx                  -- Home (Hero + Banners + PC Armadas + Productos)
src/app/layout.tsx                          -- Layout con favicon metadata
src/app/globals.css                         -- Variables CSS, paleta #3A8B68
src/app/checkout/page.tsx                   -- Checkout con provincia + shippingDetails + cupones
src/app/mis-pedidos/page.tsx               -- Login/Registro/Dashboard de pedidos + perfil editable
src/app/(tienda)/arma-tu-pc/page.tsx       -- Arma tu PC (mobile sticky bar + compatibilidad + cantidades)
src/app/(tienda)/elige-tu-notebook/         -- Elige tu Notebook client component
src/app/(tienda)/producto/[slug]/           -- Detalle de producto con SEO metadata
src/app/(tienda)/categoria/[slug]/          -- Catalogo por categoria con SEO metadata
src/app/api/pc-builder/route.ts            -- API de productos por slot + filtros compatibilidad
src/app/api/pc-assistant/route.ts          -- API chatbot PC Builder
src/app/api/notebook-assistant/route.ts    -- API chatbot Notebooks
src/app/api/admin/products/route.ts        -- CRUD productos (markup/cashDiscount/ivaRate/salePrice)
src/app/api/admin/suppliers/sync/route.ts  -- Sync proveedores (Air Intra batched, Invid/Elit full)
src/app/api/admin/upload/route.ts          -- Upload imagenes (WebP)
src/app/api/cron/sync/route.ts            -- Cron sync diario (Elit + Invid, 6AM UTC)
src/app/admin/productos/page.tsx           -- Admin productos (CRUD + filtros + ordenamiento)
src/app/admin/promociones/page.tsx         -- Admin promociones (Cupones + Banners)
src/app/admin/proveedores/page.tsx         -- Admin proveedores (sync + gestion)
src/app/admin/categorias/page.tsx          -- Admin categorias (arbol + mapeos)
src/app/admin/configuracion/page.tsx       -- Admin configuracion global
src/app/sitemap.ts                          -- Sitemap dinamico (SEO)
src/app/robots.ts                           -- Robots.txt dinamico (SEO)
src/app/not-found.tsx                       -- Pagina 404 custom
src/lib/compatibility.ts                    -- Logica de compatibilidad (socket, DDR, wattage)
src/lib/db.ts                               -- Conexion Turso DB + migraciones automaticas
src/lib/queries.ts                          -- Queries SQL (con filtro de stock + markup individual)
src/lib/dollar.ts                           -- Cotizacion del dolar + calculateProductPrices
src/lib/pricing.ts                          -- Logica de precios (3 niveles + IVA)
src/lib/admin-auth.ts                       -- Auth de admin (HMAC)
src/lib/customer-auth.ts                    -- Auth de clientes
src/lib/brand-patterns.ts                   -- Patrones regex para deteccion de marcas
src/lib/compucity-logo-base64.ts            -- Logo en base64 para jsPDF
src/lib/shipping.ts                         -- Cotizacion de envio + retiro en local
src/lib/andreani.ts                         -- Login JWT, cotizacion (INACTIVO)
src/lib/correo-argentino.ts                 -- Correo Argentino (INACTIVO)
src/lib/product-specs.ts                    -- Parseo de especificaciones tecnicas
src/lib/format-product.ts                   -- Formateo de productos
src/components/ui-custom/HeroSection.tsx    -- Hero Carrusel (4 slides, autoplay)
src/components/ui-custom/CompucityLogo.tsx  -- Logo componente
src/components/ui-custom/ProductCard.tsx    -- Tarjeta de producto (destacado/oferta)
src/components/ui-custom/CategoryProducts.tsx -- Catalogo con filtros desplegables
src/components/ui-custom/FeaturedProductsCarousel.tsx -- Carrusel destacados
src/components/ui-custom/ProductGallery.tsx -- Galeria de imagenes de producto
src/components/ui-custom/ProductTabs.tsx    -- Tabs de especificaciones
src/components/ui-custom/RelatedProducts.tsx -- Productos relacionados
src/components/ui-custom/Breadcrumbs.tsx    -- Breadcrumbs con JSON-LD
src/components/ui-custom/NotebookChatBanner.tsx -- Banner chatbot notebooks
src/components/ui-custom/PromoBanners.tsx   -- Banners promocionales en home
src/components/ui-custom/ImageUploader.tsx  -- Upload de imagenes WebP
src/components/ui-custom/FadeIn.tsx         -- Animacion fade-in
src/components/ui-custom/ThemeToggle.tsx    -- Toggle dark/light
src/components/layout/Navbar.tsx            -- Nav con user dropdown + marquee
src/components/layout/Footer.tsx            -- Footer con logo + contacto
src/components/layout/WhatsAppButton.tsx    -- Boton flotante WhatsApp
src/components/layout/ScrollToTop.tsx       -- Scroll al inicio
src/components/layout/CategoryIcons.tsx     -- Iconos de categorias
src/components/layout/BrandLogos.tsx        -- Logos de marcas (lista curada fija)
src/components/notebook-assistant-chat.tsx  -- Chatbot notebooks "Citi"
src/components/pc-assistant-chat.tsx        -- Chatbot PC Builder "Citi"
src/components/seo/JsonLd.tsx              -- Structured data JSON-LD
src/components/admin/AdminLayoutClient.tsx  -- Layout admin client component
src/store/wishlist.ts                       -- Zustand store favoritos
src/store/cart.ts                           -- Zustand store carrito
src/hooks/use-toast.ts                      -- Hook de notificaciones
src/hooks/use-scroll-animation.ts           -- Hook animacion scroll
src/hooks/use-mobile.ts                     -- Hook deteccion mobile
src/middleware.ts                           -- Auth middleware (admin routes)
tailwind.config.ts                          -- Paleta Compucity
public/images/hero-slide-*.png             -- Imagenes del carrusel hero
public/images/logo-compucity*.png          -- Logos
githooks/pre-push                           -- Pre-push hook de proteccion
scripts/deploy.sh                          -- Script de deploy seguro
scripts/auto-backup.sh                     -- Script de backup automatico
scripts/backup-turso.mjs                   -- Script backup DB Turso
scripts/check-critical-files.mjs           -- Verificacion pre-deploy
```

---

## Panel Admin (`/admin`)
- **Dashboard:** Stats (productos, pedidos, clientes, categorias, proveedores)
- **Productos:** CRUD completo, markup/descuento individual, IVA (10.5%/21%), salePrice, filtros por columna, ordenamiento, seleccion multiple, eliminacion masiva
- **Categorias:** Arbol de categorias con mapeos de proveedores, slug editable con advertencia de PC Builder
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
- `/admin/configuracion` - Config global (dolar, markup)
- `/admin/login` - Login de admin

### APIs Admin
- `POST /api/admin/auth/login` / `check` / `logout`
- `GET/POST/PUT/DELETE /api/admin/products` (soporta markup/cashDiscount/ivaRate/salePrice)
- `GET/POST /api/admin/categories`
- `GET/POST /api/admin/suppliers`
- `POST /api/admin/suppliers/sync` - Sync proveedores (Air Intra batched, Invid/Elit full)
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
- `POST /api/admin/brands` - Init brands (asignar brandId)
- `POST /api/admin/validate-categories` - Validar categorias de productos

### APIs Publicas
- `GET /api/products` - Productos con filtros
- `GET /api/categories` - Categorias
- `GET /api/brands` - Marcas
- `GET /api/banners` - Banners activos
- `GET /api/pc-builder` - Productos por slot con compatibilidad
- `GET /api/related-products` - Productos relacionados
- `GET /api/search` - Busqueda de productos
- `GET /api/dolar` - Cotizacion del dolar
- `POST /api/orders` - Crear pedido
- `POST /api/shipping` - Cotizacion de envio
- `POST /api/validate-build` - Validar build PC (ELIMINADO en sesion 33)
- `GET /api/image/[id]` - Sirve imagenes desde product_images
- `POST /api/pc-assistant` - Chatbot PC Builder
- `POST /api/notebook-assistant` - Chatbot Notebooks
- `POST /api/generate-description` - Generar descripcion IA

---

## Imagenes de Productos
- **product_images:** 1,059 imagenes (WebP en DB)
- **Formato:** WebP (max 800px, calidad 70-75) almacenadas en tabla `product_images`
- **Endpoint:** `/api/image/[id]` - Sirve imagenes desde product_images
- **Upload:** Compresion cliente (5MB max) + servidor (2MB max comprimido)
- **Cross-provider matching:** Sistema para copiar imagenes entre proveedores por brand+model
- **Scripts:** `scripts/enrich-images.mjs`, `scripts/batch-images.mjs`, `scripts/cross-provider-images.mjs`

---

## Base de Datos (Turso)
- **Host:** compucity-vorterixgames-gif.aws-us-east-1.turso.io
- **Tablas (17):** products (~8,508), categories (79), brands (115), suppliers (9), orders (12), order_items (56), customers (8), product_images (2,166), dollar_rates (1), store_config (26), supplier_category_mappings (86), admins (1), banners (0), coupons (0), password_reset_tokens (2), rate_limits (1), deleted_products (490) — **datos backup s56 2026-08-03**

### Limites y Uso de Plataformas (actualizado sesion 45)
| Plataforma | Recurso | Uso actual | Limite | Plan | % Uso | Estado |
|------------|---------|-----------|--------|------|-------|--------|
| **Turso** | Almacenamiento | 50 MB | 10 GB | Scaler | 0.5% | Holgado |
| **Turso** | Filas leidas/mes (proyeccion post-fixes s43+s44+s45) | ~30-100M/mes | 2.5B/mes | Scaler | 1-4% | Holgado |
| **Turso** | Filas leidas/dia (proyeccion con fixes s43+s44+s45) | ~1-3M/dia | 83M/dia (avg) | Scaler | 1-4% | Holgado |
| **Turso** | Filas escritas/mes | ~200K | 25M/mes | Scaler | 0.8% | Holgado |
| **Vercel** | Deploys/mes | ~45 | 100 | Hobby | 45% | OK |
| **Vercel** | Ancho de banda | ~500 MB | 100 GB | Hobby | <1% | Holgado |
| **Vercel** | Serverless ejecuciones | ~5K/dia | Ilimitado | Hobby | - | OK |
| **Vercel** | Fluid Active CPU (al 24/6 sesion 45) | ~4h+ usadas (ciclo junio) | 4h/mes | Hobby | >100% | Overage (sin tarjeta, sin cobro) |
| **Vercel** | Fluid Active CPU (proyeccion ciclo Julio con fixes s44+s45) | **~15-40 min/mes** | 4h/mes | Hobby | **6-17%** | Holgado |
| **Vercel** | Edge invocations (chatbots IA) | ~50-200/dia | 1M/mes | Hobby | <1% | Holgado |
| **Vercel** | Timeout serverless | 60s max | 60s | Hobby | - | Ver nota |

**Nota Vercel timeout:** El plan Hobby limita serverless a max 60s (`maxDuration`). El cron sync actual usa ~18s en produccion (verificado sesion 45). Sin riesgo de timeout.

**Nota Turso Scaler (sesion 43):** Se upgradeo del plan Free al Scaler ($5.99/mes, 2.5B rows reads) despues de agotar el limite de 500M rows reads/mes. Con los fixes de cache aplicados en sesiones 43+44+45, el consumo proyectado es ~30-100M/mes = 1-4% del plan Scaler. Sin riesgo de overages.

**Nota Vercel Fluid CPU (sesion 45):** Al cierre del ciclo junio (5 de julio), se proyecta haber consumido ~4-5h del limite de 4h. Como NO hay tarjeta cargada en Vercel, no hay cobro de overages. Vercel ofrecio desbloqueo de cortesia de 30 dias (no usado, reservado para emergencia). Con los 8 rounds de fixes + QA Fase 1 + Edge runtime para chatbots, el ciclo de julio deberia cerrar con ~15-40 min consumidos (6-17% del limite).

**Detalle de fixes Vercel Fluid CPU sesiones 44+45:**
- Round 1 (commit fbf5cb0): brand re-detection movida a GitHub Actions, /api/image sin put() roto, /api/brands sin fetch localhost, init-brands con auth, debug-blob/env eliminados
- Round 2 (commit 321983a): N+1 fixes en orders + checkout + pc-builder, cache getStoreConfigNumber, revalidate en /producto/[slug], Cache-Control en /api/search y /api/admin/products
- Round 3 (commit 0e68b9c): bugs PromoBanners + init-categories en 3 componentes, N+1 customer/orders, auth en /api/admin/enrich, /api/validate-build eliminado
- Round 4 (commit bcb64c7): s-maxage en /api/image para cache CDN compartido + rate limit 50 req/10s
- Round 5 (commit 34c0833): partir middleware (solo /admin/*) + bloquear Meta-ExternalAgent via redirects
- Round 6 (commit 22b2e95): revalidate=3600 en home y categorias
- Round 7 (commits d796742 + a5bcc89): fix workflows GH Actions (Node 22) + fix sync-brands (toTursoValue)
- Round 8 (commit cce5e5e): migrar 3 chatbots a Edge runtime (no consumen Fluid CPU)
- QA Fase 1 (commit 71186af): seguridad critica (generate-description auth, creds Air Intra a env vars, validar precios server-side en orders, rate limit login, transaccion en orders) + limpiar 132 console.log
- Hotfix 1 (commit 6e3b1d4): fix rowsAffected en orders POST (checkout roto por bug introducido en QA Fase 1)
- Hotfix 2 (commit 0496a3d): fix ORDER BY createdAt en order_items (/admin/pedidos vacio por bug del Round 2)
- Fix cron Invid (commit 0ccfa50): cron usaba campos equivocados para Invid (codigo_alfa vs ID, precio vs PRICE, stock_total vs STOCK_STATUS). Nunca actualizaba Invid automaticamente.

**Proyeccion post-fixes (ciclo julio 2026):**
| Componente | CPU/mes estimada | Notas |
|------------|------------------|-------|
| Cron sync Elit+Invid (sin brands) | 5-10 min | Bajo de 90-300s a ~18s por run (Invid fix incluido) |
| GitHub Actions sync brands | 0 min (no consume Vercel) | Corre en GH Actions gratis |
| GitHub Actions sync Air Intra | 0 min (no consume Vercel) | Corre en GH Actions gratis |
| Storefront (home, categorias, detalle) | 5-15 min | revalidate=3600 + cache CDN + cache en memoria |
| Admin (productos, pedidos) | 5-10 min | Cache-Control no-store + cache markup/dollar |
| Checkout (carrito vacio + pedidos reales) | 1-3 min | N+1 fix: 15 queries → 3 + validacion server-side |
| Busqueda | 1-2 min | Cache-Control 60s CDN |
| Chatbots IA (pc-assistant, notebook-assistant) | 0 min (Edge runtime) | No consumen Fluid CPU |
| Generate description (admin) | 0 min (Edge runtime) | No consume Fluid CPU |
| Otros (sitemaps, robots, etc) | 1-3 min | Cacheado |
| **Total estimado** | **~15-40 min/mes** | **6-17% del limite Hobby de 4h** |


**Fixes adicionales sesion 43 dia 2 (17/6) — despues de detectar 58M rows reads en un solo dia:**

Se detecto un pico de 58M rows reads en Turso el dia 17/6 (proyeccion mensual: 1.7B = 70% del plan Scaler). Investigacion revelo 4 causas adicionales no contempladas en los fixes del dia 16/6:

1. `/api/image/[id]` ejecutaba `CREATE TABLE IF NOT EXISTS product_images` en CADA request — la tabla ya existe desde la migracion inicial, pero el check defensivo consumia 1 query extra por imagen servida
2. `src/app/sitemap.ts` tenia un bug: usaba `WHERE active = 1` (la columna real es `isActive`), el catch silenciaba el error y los productos NUNCA aparecian en el sitemap — Googlebot crawleaba ciegamente todo el sitio
3. APIs publicas (`/api/products`, `/api/related-products`, `/api/categories`, `/api/brands`) sin cache headers → cada request = queries frescas a Turso
4. Sitemap sin `revalidate` → cada pedido = 2 SELECTs a Turso

**Fixes aplicados (commit 2ae068c):**
| Fix | Archivo | Cambio | Impacto estimado |
|-----|---------|--------|------------------|
| 1 | `src/app/api/image/[id]/route.ts` | Eliminado `ensureTable()` | -30K rows/dia |
| 2 | `src/app/sitemap.ts` | Agregado `revalidate=3600` + fix bug `active` → `isActive` | Productos ahora aparecen en sitemap (mejor SEO) |
| 3 | `src/app/api/products/route.ts` | `revalidate=300` + `Cache-Control: s-maxage=300, stale-while-revalidate=3600` | -90% queries producto |
| 4 | `src/app/api/related-products/route.ts` | `revalidate=300` + cache headers | -90% queries relacionados |
| 5 | `src/app/api/categories/route.ts` | `revalidate=3600` + cache headers | -99% queries categorias |
| 6 | `src/app/api/brands/route.ts` | `revalidate=3600` + cache headers | -99% queries marcas |

**Proyeccion despues de fixes dia 2:**
- Antes: ~58M rows reads/dia (medido 17/6 antes de fixes)
- Despues: ~5-15M rows reads/dia (estimado)
- Mensual: ~150-450M = 6-18% del plan Scaler

**Limitaciones introducidas (aceptables):**
- Admin cambia producto → hasta 5 min en aparecer en `/api/products` y `/api/related-products` (NO afecta a `/producto/[slug]` que sigue siendo dinamico)
- Categorias/marcas → hasta 1h en refrescar desde APIs publicas (NO afecta a la tienda que usa server components)
- Bots crawlean el sitemap → cache 1h (mejor para SEO, menos carga Turso)

**NO afectado (sigue 100% en vivo):**
- Pagina de detalle de producto `/producto/[slug]`
- Panel admin `/admin/*`
- Checkout, carrito, favoritos
- Auth de clientes
- Busqueda (no se toco `/api/search`)

### Leccion aprendida sesion 43: por que nos fuimos del limite Turso

El PROJECT_STATUS.md (sesiones 42 y anteriores) decia "~1M rows reads/mes, <0.1% del limite Free, Holgado". Esa cifra estaba **completamente mal**. El error de calculo vino de 4 supuestos incorrectos:

**Supuesto erroneo #1: contar filas DEVUELTAS en lugar de filas ESCANEADAS**
- Turso cobra por filas que ESCANEA durante la query, no por las que retorna
- Una query `SELECT * FROM products WHERE categoryId = ? ORDER BY ...` sin LIMIT ni indice escanea TODA la tabla (10,960 filas) aunque devuelva solo 50
- Calculo ingenuo: 200 visitas/dia x 50 productos = 10K rows/dia
- Realidad: 200 visitas/dia x 10,960 filas escaneadas = 2.2M rows/dia solo en categorias

**Supuesto erroneo #2: queries con LIMIT y/o indices**
- `getProductsByCategory()` no tenia LIMIT y la tabla products no tiene indices en (categoryId, isActive, stock)
- Cada visita a una categoria grande (cables 393, mouse 384, motherboards 309) = full scan de 10,960 filas
- `searchProducts()` usa LIKE con `%query%` al inicio = no puede usar indices = full scan
- `getCategoryMarkupMap()` se llama en cada request y lee TODAS las categorias (73 filas)

**Supuesto erroneo #3: visitas solo humanas**
- No contemplo bots SEO (Googlebot, Bingbot, AhrefsBot, etc.)
- Una sola visita de Googlebot puede hacer 500-1000 pageviews en una hora
- Con `force-dynamic` en home y categorias, cada pageview = queries frescas contra Turso
- Estimacion real: bots multiplican el trafico humano x5-10

**Supuesto erroneo #4: conteo solo de storefront**
- No contemplo el cron sync diario (cron sync Air Intra = ~25K rows reads/dia)
- No contempo cargas del panel admin (lista de 10K productos = 10K rows reads por view)
- No contempo sitemap.xml dinamico (genera queries por cada request)
- No contempo fetch del dolar cada 15 min (2 SELECTs cada vez)

**Calculo real (a posteriori, sesion 43):**
| Concepto | Rows reads/dia |
|----------|----------------|
| Categorias (200 visitas x 10K escaneadas) | 2.0M |
| Busquedas (50/dia x 10K escaneadas) | 0.5M |
| Home (100/dia x 5 queries x 73 categorias) | 0.04M |
| Detalle producto (200/dia x 5 queries) | 0.001M |
| Cron sync Air Intra (1/dia x 7930) | 0.008M |
| Bots SEO (500 pageviews x 8K promedio) | 4.0M |
| Admin (cargas de listado productos) | 0.5M |
| Sitemap.xml + revalidaciones | 0.2M |
| **Total estimado** | **~7-25M/dia** |
| **Total mensual (30 dias)** | **~210-750M/mes** |

El rango real (medido por Turso): ~517M en 21 dias = ~25M/dia promedio. Coincide con el limite superior de la estimacion.

**Fixes aplicados sesion 43 para resolver cada causa:**
| Fix | Causa que resuelve | Archivo |
|-----|-------------------|---------|
| LIMIT y paginacion client-side (50 productos/pagina) | Supuesto #2 (queries sin LIMIT) | `src/lib/queries.ts`, `src/components/ui-custom/CategoryProducts.tsx` |
| `revalidate=300` en home y categorias | Supuesto #3 (bots + force-dynamic) | `src/app/(tienda)/page.tsx`, `src/app/(tienda)/categoria/[slug]/page.tsx` |
| Cache en memoria `getCategoryMarkupMap` (TTL 5 min) | Supuesto #2 (queries repetidas) | `src/lib/queries.ts` |
| Cron Air Intra chunked (3 paginas/dia en lugar de 16) | Supuesto #4 (cron sync pesado) | `src/app/api/cron/sync/route.ts` |

**Pendiente para futura optimizacion (no urgente con Scaler):**
- Agregar indices en products: `CREATE INDEX idx_products_category_active_stock ON products(categoryId, isActive, stock)`
- Migrar busqueda a FTS5 (Full-Text Search) de Turso para evitar LIKE con %
- Cache en memoria para `fetchDollarRate` y `getStoreConfigNumber`
- Considerar `revalidate=900` (15 min) en lugar de 300 en paginas menos sensibles

**Regla de oro para futuras estimaciones de Turso:**
1. Contar filas ESCANEADAS, no devueltas (asumir full scan si no hay indice claro)
2. Incluir trafico de bots SEO (multiplicar trafico humano x5-10)
3. Incluir cargas del admin (especialmente listados grandes)
4. Incluir cron jobs, sitemap, revalidaciones
5. Verificar cada query con `EXPLAIN QUERY PLAN` antes de asumir que usa indice
6. Medir en produccion con Turso Usage dashboard, no estimar en teoria

### Leccion aprendida sesion 50: columna fantasma "currency" rompio search

**Bug:** El search (/api/search) siempre devolvía `products: []` para cualquier término. La home y categorías funcionaban normalmente.

**Causa raíz:** En la sesión 49, al optimizar las queries de `queries.ts` cambiando `SELECT *` por columnas específicas, se incluyó la columna `currency` en 4 queries (`getAllActiveProducts`, `getFeaturedProducts`, `getProductsByCategory`, `searchProducts`). **Esa columna NUNCA existió en la tabla `products` de Turso** (verificar con `PRAGMA table_info(products)`). El `SQL_INPUT_ERROR: no such column: currency` era atrapado por el `catch` de `searchProducts` que devolvía `[]` silenciosamente.

**Por qué la home funcionaba y el search no:** Las 3 primeras queries usan `unstable_cache` de Next.js que cachea resultados en el filesystem de Vercel. Probablemente el cache se generó en un deploy anterior (cuando la columna sí existía o cuando se usaba `SELECT *`). El search NO usaba cache → cada consulta iba fresca a Turso → SQL_INPUT_ERROR → `[]`.

**Fix aplicado (commit a561957):**
1. Removida `currency` de los 4 SELECTs en `queries.ts`
2. Optimizado `/api/search/route.ts`: query directa (sin pasar por `searchProducts()`) + `calculateProductPrices` solo para los 6 resultados necesarios
3. Resultado: search vacío → 6 resultados en 2.5s (antes 7.4s o timeout)

**Regla crítica para futuros cambios de SQL:**
- **NUNCA** agregar una columna a un SELECT sin verificar que existe en la DB real (`PRAGMA table_info(tabla)`)
- **NUNCA** usar `catch` que devuelva datos vacíos silenciosamente — siempre loguear el error
- **SIEMPRE** que se cambie `SELECT *` a columnas específicas, validar contra la DB real, no contra el schema de Prisma (pueden estar desincronizados)
- **SIEMPRE** probar queries nuevas contra Turso antes de deployar (local usa SQLite que puede tener columnas diferentes)

**Columnas reales de la tabla products (verificado s50):**
```
id, name, slug, description, price, comparePrice, costPrice, sku, stock,
isActive, isFeatured, images, specs, providerId, providerSku, categoryId,
createdAt, updatedAt, supplierCategory, duplicateOfId, markup, cashDiscount,
categorySource, ivaRate, salePrice, saleStart, saleEnd, stockByWarehouse,
brandId, internalTaxRate
```

**Nota:** La columna `currency` aparece en el schema de Prisma (`prisma/schema.prisma`) y en el modelo TypeScript `Product`, pero NO en la DB real. Esto es porque Prisma se usa solo para documentación — las migraciones se hacen manualmente con ALTER TABLE en `db.ts`. El schema de Prisma puede desactualizarse.

### Schema Products
```
id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
description TEXT, price REAL NOT NULL, comparePrice REAL, costPrice REAL,
markup INTEGER, cashDiscount INTEGER,
sku TEXT UNIQUE, stock INTEGER DEFAULT 0, stockByWarehouse TEXT,
isActive INTEGER DEFAULT 1, isFeatured INTEGER DEFAULT 0,
images TEXT DEFAULT '[]', specs TEXT DEFAULT '{}',
providerId TEXT, providerSku TEXT, categoryId TEXT, brandId TEXT,
supplierCategory TEXT, duplicateOfId TEXT, categorySource TEXT DEFAULT 'auto',
ivaRate REAL,          -- NULL = heredar de categoria, 10.5 o 21 = valor individual
internalTaxRate REAL,  -- NULL = sin impuesto interno (ej: 10.5% algunos monitores)
salePrice REAL, saleStart TEXT, saleEnd TEXT,
createdAt TEXT, updatedAt TEXT
```

### Schema Categories (campos de precio)
```
markup INTEGER,        -- NULL = usar global (15%), numero = markup de categoria
cashDiscount INTEGER,  -- NULL = usar global (0%), numero = dto efectivo de categoria
ivaRate REAL,          -- NULL = usar default (10.5%), 10.5 o 21 = IVA de categoria
```

### Schema Brands
```
id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
logoUrl TEXT, logoWidth INTEGER, logoHeight INTEGER,
isActive INTEGER DEFAULT 1, "order" INTEGER DEFAULT 0,
productCount INTEGER DEFAULT 0,
createdAt TEXT, updatedAt TEXT
```

### Store Config (21 claves)
| Clave | Valor | Descripcion |
|-------|-------|-------------|
| markup | 15 | Margen de ganancia global (%) |
| cash_discount | 0 | Descuento efectivo global (%) |
| dollar_source | nacion | Fuente de cotizacion |
| store_name | Compucity | Nombre de la tienda |
| store_slogan | Tu Mundo Digital | Eslogan |
| whatsapp_number | 5493548402056 | WhatsApp |
| store_email | compucitylafalda@gmail.com | Email |
| store_address | Av. Sarmiento 462 - La Falda, Cordoba | Direccion |
| ... | ... | (ver DB para lista completa) |

---

## Dominio Propio (ACTIVO sesion 40)
- **Dominio:** compucityonline.com.ar
- **Registrador:** DonWeb
- **Estado:** ACTIVO y funcionando
- **DNS configurado:**
  - A record `@` -> `216.198.79.1` (IP de Vercel)
  - CNAME `www` -> `478eb57c2d2a522e.vercel-dns-017.com.`
- **SSL:** Certificado automatico de Vercel (HTTPS funcionando)
- **Redireccion:** compucityonline.com.ar -> www.compucityonline.com.ar (308 redirect)
- **Fecha activacion:** 2026-06-12

---

## Sistema de Marcas (IMPLEMENTADO sesion 39)
- **Tabla DB:** `brands` (91 marcas, migracion #24)
- **Campo en products:** `brandId TEXT` FK a brands (migracion #25)
- **Asignacion:** 7,099/9,822 productos con brandId (restantes son genericos sin marca)
- **Auto-deteccion:** Cron sync y init-brands leen `specs['Marca']` de proveedores para detectar marcas nuevas
- **Prioridad:** regex patterns primero (mas preciso), luego marca del proveedor
- **Filtros:** CategoryProducts usa `product.brandId === brand.id` (relacion directa, no regex)
- **Logos:** Lista curada fija en BrandLogos.tsx (Intel, AMD, NVIDIA, ASUS, HP, Samsung, Kingston, Corsair)
- **Navbar:** Seccion "Marcas" ocultada a pedido del usuario
- **Slugs corregidos:** TP-Link->tplink, Cooler Master->coolermaster, D-Link->dlink, APC->schneiderelectric

---

## Seguridad: Script de verificacion de archivos criticos (sesion 37)
- **Script:** `scripts/check-critical-files.mjs` - Verifica que 20 archivos criticos existan antes de deployar
- **Comando:** `npm run check:critical`
- **Lista de archivos:** Rutas API (upload, products, banners, categories, auth, enrich, seed, stats, dollar, image, cron), componentes (ImageUploader, WhatsAppIcon), lib (db, admin-auth)

---

## Backups

### Backups locales (download/backups/)
| Fecha | Tipo | Tamano | Archivo |
|-------|------|--------|---------|
| 2026-06-13 | DB Turso completa (JSON) | 41 MB | compucity_turso_backup_2026-06-12T22-14-38-625Z.json |
| 2026-06-13 | Codigo fuente completo | 101 MB | compucity_src_backup_2026-06-13.tar.gz |
| 2026-06-13 | Codigo esencial (src+configs) | 1.2 MB | compucity_src_only_backup_2026-06-13.tar.gz |
| 2026-06-13 | DB local SQLite | 112 KB | compucity_local_db_backup_2026-06-13.db |
| 2026-06-16 | DB Turso completa (JSON) | 45 MB | compucity_turso_backup_s43_2026-06-16T21-13-37-462Z.json |
| 2026-06-17 | DB Turso completa (JSON) | 45 MB | compucity_turso_backup_s43-day2_2026-06-17T12-58-17-818Z.json |
| 2026-06-17 | DB Turso completa (JSON) | 45 MB | compucity_turso_backup_s43-day2-precache_2026-06-17T13-13-35-657Z.json |
| 2026-06-17 | DB Turso completa (JSON) | 45 MB | compucity_turso_backup_s43-day2-final_2026-06-17T13-25-50-858Z.json |
| 2026-06-17 | DB Turso completa (JSON) | 45 MB | compucity_turso_backup_s43-day2-admin-opt_2026-06-17T13-51-19-094Z.json |
| 2026-06-17 | DB Turso completa (JSON) | 45 MB | compucity_turso_backup_s43-day2-final_2026-06-17T16-33-58-040Z.json |
| 2026-06-18 | DB Turso (tablas chicas + count grandes) | 50 KB | compucity_turso_backup_s43-day3_2026-06-18T13-52-05.json |
| 2026-06-21 | DB Turso (tablas chicas + count productos) | 121 KB | compucity_backup_s44_2026-06-21T18-35-39.json |
| 2026-06-22 | DB Turso (tablas chicas + count productos) | 121 KB | compucity_backup_s44-d2_2026-06-22T13-39-24.json |
| 2026-06-30 | DB Turso completa (JSON) pre-deploy s47 | 54 MB | compucity_turso_backup_2026-06-30T13-35-24-079Z.json |
| 2026-06-30 | DB Turso completa (JSON) post-deploy s47 | 54 MB | compucity_turso_backup_2026-06-30T14-25-15-134Z.json (9744 filas, 7823 productos) |
| 2026-06-30 | Codigo fuente completo (tar.gz) | 3.3 MB | compucity_src_backup_2026-06-30.tar.gz (sin node_modules/.next/.git) |
| 2026-06-30 | DB Turso completa (JSON) post-migración GH Actions | 54 MB | compucity_turso_backup_2026-06-30T15-33-05-751Z.json (9750 filas, 7824 productos) |
| 2026-07-07 | DB Turso completa (JSON) pre-fix s51 | 58 MB | compucity_turso_backup_2026-07-06T23-08-35-689Z.json (10,035 filas, 7,944 productos, 16 tablas) |
| 2026-07-10 | DB Turso completa (JSON) post s51 d3 | 61 MB | compucity_turso_backup_2026-07-10T15-11-20-035Z.json (10,394 filas, 8,186 productos, 16 tablas) |
| 2026-08-03 | DB Turso completa (JSON) post s56 | 69 MB | compucity_turso_backup_s56_2026-08-03T21-57-24-430Z.json (11,560 filas, 8,508 productos, 17 tablas) |
| 2026-08-03 | Codigo fuente completo (tar.gz) post s56 | 3.3 MB | compucity_src_backup_s56_2026-08-03.tar.gz (sin node_modules/.next/.git) |

### Backups remotos (GoFile)
| Fecha | Tipo | Tamano | URL |
|-------|------|--------|-----|
| 2026-06-06 | DB completa (SQL) | 12 MB | https://gofile.io/d/Z32GBy |
| 2026-06-06 | Codigo fuente (tar.gz) | 931 KB | https://gofile.io/d/nAU3xx |

### Backup Git
- **GitHub:** https://github.com/vorterixgames-gif/compucity (repo completo)
- **Ultimo commit:** 9f5591b (fix: generate-description + fallback modelos Groq)
- **Tags:** v-seo-optimized (commit c5b7458)

### Script de backup automatico
- **Script:** `scripts/auto-backup.sh`
- **Uso:** `bash scripts/auto-backup.sh "descripcion del cambio"`
- **Incluye:** Codigo + git history + DB Turso

### Script de backup Turso
- **Script:** `scripts/backup-turso.mjs`
- **Uso:** `node scripts/backup-turso.mjs`
- **Incluye:** Dump completo de todas las tablas de Turso a JSON

---

## Tareas Pendientes

### Alta Prioridad
1. **Pasarela de pagos:** Integrar Mobbex o MercadoPago para pagos online
2. **Andreani shipping:** Credenciales incompletas (falta codigoCliente + contratoDomicilio)
3. **Correo Argentino:** Credenciales todas NULL en store_config, sin API funcional
4. ~~**Sync manual completa Air Intra:**~~ RESUELTO (sesion 43 dia 4) — GitHub Actions sync cada 12h procesa todas las paginas. No necesita sync manual.
5. **Monitorear Google Search Console:** Verificar en 1-2 semanas que Google empiece a indexar las URLs del sitemap (recien registrado en Search Console el 17/6/2026 con verificacion TXT en DonWeb DNS). Sitemap enviado manualmente.
6. **Categorizar 3,501 productos sin categoria:** 3,433 de Air Intra + 66 de Elit + 2 otros. Verificar `supplierCategory` de cada uno y agregar mapeos en /admin/proveedores para categorizar masivamente. Mientras tanto, el dueño puede usar el botón 'Exportar sin categoria' desde /admin/productos para revisarlos manualmente en Excel.

### Media Prioridad
7. **Imagenes para Air Intra:** ~1,563 productos sin imagen
8. **Descripcion IA:** Usar z-ai-web-dev-sdk para generar descripciones faltantes
9. **WhatsApp Business:** Migrar de Personal a Business App (misma app, mismo numero)
10. **Monitorear consumo Turso Scaler:** Verificar en 24-48h que la pendiente de uso se acható por los fixes de cache aplicados

### Baja Prioridad
11. **Optimizar imagenes:** Thumbnails del catalogo podrian usar tamano reducido
12. **Limpiar claves duplicadas en store_config:** slogan/whatsapp duplicados con store_slogan/whatsapp_number
13. **Marcas navbar:** Reactivar cuando se decida mostrar nuevamente
14. **FTS5 en busqueda:** Migrar searchProducts a Full-Text Search de Turso para evitar LIKE con % (opcional, con Scaler ya no es urgente)
15. **Cache auth admin/customer:** Cachear getCurrentAdmin() y customer APIs en memoria (opcional, pocos requests/dia)

### Pendientes del dueño (sesión 46 — 25/6/2026) — RESUELTOS sesion 47 (30/6/2026)
16. ~~**QR AFIP en el footer**~~ - RESUELTO (sesion 47). HTML pegado tal cual en Footer.tsx, solo se cambió `http://` por `https://` para evitar contenido mixto. Imagen del QR se sirve desde afip.gob.ar. Commit 3c61ec0.
17. ~~**Arma tu PC — No avanzar automáticamente en RAM y Discos**~~ - RESUELTO (sesion 47). Los slots de RAM y SSD/HDD ya no disparan onSelectComponent (auto-avance). El usuario debe clickear "Siguiente" manualmente. Los demás slots siguen con auto-avance. Commit 3c61ec0.
18. ~~**Arma tu PC — Filtro de Gabinetes con Fuente**~~ - YA EXISTÍA (sesion 47). El filtro dropdown (Todos/Con fuente/Sin fuente) ya estaba implementado en arma-tu-pc/page.tsx líneas 201-204. No requirió cambios.
19. ~~**Arma tu PC — Botón "Sumar al carrito"**~~ - RESUELTO (sesion 47). Agregado botón que suma todos los componentes seleccionados al carrito (precio de lista). Notificación toast con link al carrito, sin redirección. Commit 3c61ec0.
20. ~~**Eliminar sub-categorías de Monitores y Notebooks**~~ - RESUELTO (sesion 47). Script scripts/move-subcats-to-parent.mjs ejecutado contra Turso: 203 productos movidos a Monitores padre (4 subcats desactivadas), 286 a Notebooks padre (5 subcats desactivadas). Filtros ya existían (marca, tamaño, Hz, resolución para Monitores; marca, procesador, RAM, pantalla, GPU para Notebooks). Commit 3c61ec0.
21. ~~**Impuesto interno 10.5% en algunos monitores**~~ - RESUELTO (sesion 47). Migración #27: columna `internalTaxRate REAL` agregada a products (NULL = sin impuesto interno). Fórmula aditiva implementada en calculateProductPrices: `costPrice × (1 + IVA/100 + internalTaxRate/100) × (1 + markup/100) × dollarRate`. Selector en admin al lado del IVA con opciones "Sin impuesto interno" / "10.5%". API SELECT/INSERT/PUT actualizadas. Commits 3c61ec0 + 4c831e0 (fix TS tipo ProductForm).

**Hotfixes post-deploy (sesión 47):** 3 incidentes detectados y resueltos durante/depues del deploy:
- (a) **TypeScript error en admin/productos/page.tsx** — el commit 3c61ec0 usaba `internalTaxRate` en el form pero faltaba declararlo en la interfaz `ProductForm`. Build local OK (los TS errors de admin no rompen build por estar en client component). Fix: agregar `internalTaxRate: string` a la interfaz. Commit 4c831e0.
- (b) **Migración #27 no aplicada en producción** — la migración en `db.ts` solo corre en cold start de Vercel, y al parecer no se ejecutó. Síntoma: "en el admin no se ve ningún producto ni los filtros nada". Causa: SELECT p.internalTaxRate fallaba con `no such column`. Fix: ejecutar manualmente `ALTER TABLE products ADD COLUMN internalTaxRate REAL` contra Turso producción via scripts/migrate-add-internaltax.mjs. Commit f6cb28b (script persistido).
- (c) **/api/admin/upload borrado accidentalmente** — el merge del branch feat/pendientes-dueno-s47 incluyó un git rm que borró src/app/api/admin/upload/route.ts (177 líneas). Síntoma: "Error del servidor (404) al subir imagen desde el admin al cargar un producto". Fix: restaurado del commit 848c9f0 (previo al merge). Commit 1de2cd4.

**Fix adicional (sesión 47):** workflow `Sync Air Intra` de GitHub Actions tenía fallos transitorios. Causa: el endpoint /?q=login de Air Intra a veces devuelve HTTP 404 sin razón. El script original moría al primer fallo. Fix: agregado retry en el login (3 intentos, 30s entre cada uno). Maneja 4 modos de fallo: HTTP no-ok, respuesta sin JSON, JSON sin token, excepción. Validado con workflow_dispatch: success en 87.9s, 1 nuevo + 402 actualizados. Commit 79f8282.

### Tareas Completadas (sesiones anteriores)
- ~~Discos multiples en PC Builder~~ - RESUELTO (sesion 27)
- ~~Gabinetes con Fuente en PC Builder~~ - RESUELTO (sesion 27)
- ~~Auto-avance en PC Builder~~ - RESUELTO (sesion 27)
- ~~Separar PDF de WhatsApp~~ - RESUELTO (sesion 27)
- ~~Remover stock visible en tienda~~ - RESUELTO (sesion 27)
- ~~Filtros desplegables de marca~~ - RESUELTO (sesion 28)
- ~~Fix imagenes al editar producto~~ - RESUELTO (sesion 27)
- ~~SEO completo~~ - RESUELTO (sesion 41)
- ~~Dominio propio~~ - RESUELTO (sesion 40)
- ~~Sistema de marcas~~ - RESUELTO (sesion 39)
- ~~Productos destacados~~ - RESUELTO (sesion 35-36)
- ~~Descripciones IA~~ - RESUELTO (sesion 34, usando z-ai-web-dev-sdk)
- ~~Chatbot notebooks Citi~~ - RESUELTO (sesion 37)
- ~~Chatbot PC Builder Citi~~ - RESUELTO (sesion 33)
- ~~QR AFIP en footer~~ - RESUELTO (sesion 47)
- ~~Arma tu PC: no auto-avance en RAM y Discos~~ - RESUELTO (sesion 47)
- ~~Arma tu PC: botón Sumar al carrito + notificación~~ - RESUELTO (sesion 47)
- ~~Eliminar sub-categorías de Monitores y Notebooks~~ - RESUELTO (sesion 47)
- ~~Impuesto interno 10.5% en algunos monitores~~ - RESUELTO (sesion 47)
- ~~Workflow Air Intra: retry en login~~ - RESUELTO (sesion 47)

---

## SAFETY-RULES.md - Reglas de Seguridad para Cambios

### 1. SIEMPRE hacer backup antes de cambios mayores
```bash
bash scripts/auto-backup.sh "descripcion del cambio"
```

### 2. NUNCA reescribir un archivo completo
- **PROHIBIDO**: Reemplazar todo el contenido de un archivo existente
- **OBLIGATORIO**: Usar ediciones quirurgicas (solo cambiar lo necesario)

### 3. NUNCA tocar estos archivos sin autorizacion explicita
- `src/app/globals.css` - Paleta de colores verde
- `tailwind.config.ts` - Configuracion de colores de marca
- `src/components/ui-custom/HeroSection.tsx` - NO tocar el boton "Ver componentes"
- `src/components/ui-custom/ProductCard.tsx` - Estilos de cards aprobados

### 4. Verificar colores despues de cada cambio
```bash
bash scripts/pre-change-safeguard.sh
```

### 5. REGLA CRITICA SQL: Verificar columnas contra DB real (agregada sesion 50)
- **PROHIBIDO** agregar una columna a un `SELECT` sin verificar que existe en la DB real de Turso
- **OBLIGATORIO** ejecutar `PRAGMA table_info(tabla)` contra Turso antes de cambiar `SELECT *` por columnas específicas
- **PROHIBIDO** usar `catch` que devuelva datos vacíos silenciosamente — siempre `console.error` con el error completo
- **NOTA:** El schema de Prisma (`prisma/schema.prisma`) y los modelos TypeScript pueden estar desincronizados con la DB real. Las migraciones se hacen manualmente con ALTER TABLE en `db.ts`, Prisma es solo documentación
- **NOTA:** `ignoreBuildErrors: true` en `next.config.ts` oculta errores de TypeScript. Un tipo que referencia una columna inexistente NO genera error de build
- **VERIFICACIÓN:** Después de cualquier cambio de SQL, testear contra producción: `curl https://www.compucityonline.com.ar/api/search?q=test`

### 6. Proceso seguro para cambios
1. Hacer backup
2. Crear branch: `git checkout -b fix/nombre-del-cambio`
3. Hacer SOLO los cambios necesarios (ediciones puntuales)
4. Ejecutar safeguard: `bash scripts/pre-change-safeguard.sh`
5. Verificar build: `npx next build`
6. Commitear con mensaje descriptivo
7. Hacer push y verificar deploy

### 7. Paleta de colores aprobada (NO modificar)
| Clase                | Hex       | Uso                              |
|---------------------|-----------|----------------------------------|
| compucity-green-50  | #EFF5F2   | Fondos suaves                    |
| compucity-green-100 | #D7E7E0   | Bordes claros                    |
| compucity-green-200 | #B0D4C2   | Textos secundarios claros        |
| compucity-green-300 | #8CC0A8   | Acentos suaves                   |
| compucity-green-400 | #5FA882   | Bordes hover                     |
| compucity-green-500 | #3A8B68   | Color principal de marca         |
| compucity-green-600 | #2F7A5A   | Botones, textos destacados       |
| compucity-green-700 | #256549   | Precios, botones hover           |
| compucity-green-800 | #1B4D37   | Gradientes navbar, badges        |
| compucity-green-900 | #1A3E2E   | Fondos oscuros, seccion CTA      |
| compucity-green-950 | #0F2A1E   | Marquee, fondos muy oscuros      |
| compucity-green     | #3A8B68   | Color base                       |
| compucity-green-light | #75AD95 | Acentos claros                   |
| compucity-green-dark  | #2F6F55 | Hover botones                    |

---

## Historial de Cambios
- **2026-08-13 (s66): Alta manual del SKU 214348 (ASUS PRIME X870-P WIFI) que no se sincronizaba + descripción generada con la IA restaurada.** Sin commits de código (alta de datos vía API admin).

  **Contexto:** el dueño reportó que el SKU 214348 (MB ASUS AM5 PRIME X870-P WIFI DDR5 BOX ATX, EAN 90MB1IS0-MVAAY0, neto USD 250.18, stock 17: Ros 1 + Cba 1 + Lug 15) figura en el portal de Air Intra pero no en nuestro catálogo. Verificado vía admin API: no existe en la DB (ni activo ni inactivo). Causa raíz no confirmada al 100% (las credenciales de la API de Air Intra están en env vars de Vercel, no accesibles): candidatos (a) rubro fuera de `ALLOWED_RUBROS` (mismo caso que SKU 53287 de s56) o (b) presente en `deleted_products` por una eliminación vieja.

  **Resolución:** alta vía `POST /api/admin/products` con `providerId` "Air Intra" + `providerSku` 214348 (para que el sync lo adopte y le actualice precio/stock), categoryId motherboards, costPrice 250.18, stock 17, specs completos (socket AM5, chipset X870, DDR5 hasta 192GB/8000+ MT/s, PCIe 5.0 x16, 4× M.2, Wi-Fi 7 + BT 5.4, 2× USB4 40Gbps, ATX) y **descripción generada con la IA** (`POST /api/generate-description` — validación end-to-end de la feature restaurada en s65: "La placa base ASUS PRIME X870‑P WIFI está diseñada para usuarios que buscan un rendimiento de última generación..."). Precio de lista resultante ~$470.008. Slug: `motherboard-asus-prime-x870-p-wifi-am5-ddr5-atx`. ID: `c4a8ccc1-a865-403b-bf67-5b3929a1e4c0`.

  **Pendientes:**
  - Verificar en el próximo sync de Air Intra (cron 12h o botón manual) que el 214348 reciba actualizaciones de precio/stock. Si NO se actualiza: confirmar si es rubro (agregarlo a `ALLOWED_RUBROS` en `scripts/sync-air-intra-external.mjs`, patrón s56) o lista negra (sacarlo de `deleted_products`)
  - Correr auto-batch de descripciones IA (`{batch:true}`, 10 por llamada) para llenar el catálogo sin descripción
  - Revocar PAT de GitHub (pendiente histórico)

- **2026-08-13 (s65): Restaurado "Generar con IA" (descripciones de producto) + fix de modelos Groq que rompía toda la IA de la web.** Commits: `11d0921` (route restaurada), `41294e5` + `fd1f337` + `3150505` (fallback de modelos Groq + debug), `9f5591b` (maxTokens 350).

  **Contexto:** el dueño pidió probar generar descripciones con IA y aclaró "ya tenemos una IA en la web". Investigación: (a) la web tiene chatbots (pc-assistant / notebook-assistant) que usan `grokChat` (`src/lib/grok.ts`: z-ai-web-dev-sdk primario, Groq fallback; en producción usa Groq porque ZAI no está configurado); (b) la feature de descripciones con IA YA existía (tasks 4-5-6 del 2026-03-04, worklog en `agent-ctx/4-5-6-ai-description.md`) con botón "Generar con IA" en el admin de productos — pero el endpoint `/api/generate-description/route.ts` se HABÍA PERDIDO del repo (404; bug recurrente de archivos que desaparecen, mismo patrón que el upload route); (c) Groq retiró el modelo `llama-3.3-70b-versatile` (404 model_not_found) → TODA la IA de la web (chatbots + botón) estaba rota aunque el botón siguiera en el UI.

  **Cambios:** (1) `src/app/api/generate-description/route.ts` restaurado: auth de admin, flag `ai_enabled` de store_config, flujos single (`{productId}`), batch (`{productIds}`, hasta 10) y auto-batch (`{batch:true}` → hasta 10 activos sin descripción), prompt en español (2-4 frases, sin emojis/precios/markdown, sin inventar specs), guarda `description` + `updatedAt`, usa `grokChat`. (2) `src/lib/grok.ts`: lista `GROQ_MODELS` con fallback en orden (llama-4-scout → llama-3.1-8b-instant → gpt-oss-120b → llama-3.3-70b), contenido vacío o 404 pasa al siguiente modelo, y el error final incluye el detalle de cada intento. (3) maxTokens 350 para evitar corte a media frase.

  **Validación en producción:** POST /api/generate-description con la RTX 5050 INNO3D Twin X2 → ok:true y descripción completa guardada en DB ("...Ideal para armar una PC gamer de entrada o actualizar un equipo existente."). El botón "Generar con IA" del admin vuelve a funcionar y los chatbots de la web recuperan servicio con el mismo fallback de modelos.

  **Pendientes:** correr auto-batch (`{batch:true}`) repetidas veces para llenar el catálogo sin descripción (10 por llamada); revocar PAT de GitHub (histórico).

- **2026-08-13 (s64): Detección de productos fantasma extendida a Elit y Air Intra.** Commits: `83169f2` (Air), `14a8652` (fix sanity check Air), `740a957` (Elit).

  **Contexto:** en s63 el dueño preguntó si el problema de fantasmas (s60, Invid) aplicaba a todos los proveedores. Sí aplica a los 3 con sync automático (ningún sync desactivaba productos que el proveedor sacó del catálogo), pero el fix solo existía para Invid. Se aprobó extenderlo a Elit y Air Intra con el criterio acordado.

  **Elit (`sync-elit-external.mjs`):** como cada corrida ve el catálogo completo, "producto de Elit con stock>0 que no apareció en la API" = fantasma → `stock=0` en batches de 100. Sanity check: si la API devuelve menos de la mitad de los productos de la DB, se omite la detección (protección contra catálogos parciales por glitch). **Validado en vivo (run 31714425395): "⚠ 1 productos de Elit ya NO están en el catálogo → stock=0"** — coincide exactamente con el "Elit: 1" del cartel stale de s63.

  **Air Intra (`sync-air-intra-external.mjs`):** mismo patrón con el matiz acordado: solo son fantasmas los productos cuyo rubro ESTÁ en `ALLOWED_RUBROS` y desaparecieron de la API. Los de rubro excluido no se tocan (son excluidos por diseño desde s43, no fantasmas). Se agrega `seenSkus` (SKUs con rubro permitido vistos en la corrida) y `supplierCategory` al SELECT de existentes. Sanity check contra `allowedDb` (DB con rubro permitido), no contra toda la DB (fix `14a8652`: ~la mitad de la DB tiene rubros excluidos y el check original siempre fallaría).

  **Estado de validación:** Elit ✔ en vivo. Air: run de validación en curso/lento por latencia del proveedor (se confirma en el próximo cron). Invid: el job de esta tanda falló por caída del lado de Invid (`HTTP 525` SSL handshake de Cloudflare en auth, 3 intentos) — misma clase de incidente que el 08-08 (503 Module not enabled); el cron de 18:00 UTC reintenta solo.

  **Pendientes:** revocar PAT de GitHub (histórico); revisar los 13 de Air Intra del cartel stale (rubros excluidos — decidir si se agregan a ALLOWED_RUBROS).

- **2026-08-13 (s63): Columna `lastSeenAt` + el cartel stale muestra solo lo que el sync REALMENTE no ve.** Feature implementado en tanda paralela (migración #29 en `db.ts` + `ensureMigrations()` en `/api/admin/migrate` + 3 scripts externos + `stale-products` API con `COALESCE(lastSeenAt, updatedAt)`) + hotfixes de esta sesión: `070f0dd` y `0ce2f4c`.

  **Contexto:** el dueño reportó que el cartel de "productos sin actualizar hace 7+ días" mostraba ~1,426 productos aunque los cron corren siempre: la mayoría simplemente NO CAMBIÓ en el proveedor (updatedAt = último cambio, no última verificación). Se aprobó el fix propuesto en s62: trackear "última vez que el sync vio el producto en la API" aunque no haya cambios.

  **Cambios:** (1) `lastSeenAt TEXT` en products (migración #29, aplicada en producción vía `POST /api/admin/migrate`). (2) Los 3 scripts externos marcan `lastSeenAt` en cada producto verificado en la API aunque no cambie: Air Intra inline por producto, Elit e Invid en batches de 100 después del compare loop. (3) El endpoint stale y el banner usan `COALESCE(lastSeenAt, updatedAt)`.

  **Hotfixes (esta sesión):** (a) `070f0dd` — en sync-invid `seenIds` estaba declarado después de su primer uso → `ReferenceError: Cannot access 'seenIds' before initialization` (run 31707097102 falló). (b) `0ce2f4c` — el bloque que escribe lastSeenAt estaba ubicado ANTES del compare loop que llena `seenIds` → nunca escribía nada (job "success" sin efecto). Movido después de compare/updates. Validado run 31712650017: "✓ lastSeenAt marcado en 478 productos verificados", 8 updates, 0 errores.

  **Resultado en el banner (default = 5 principales con stock):** 1,426 → **456**. Desglose restante: Air Intra 13 (rubros fuera de ALLOWED_RUBROS o edge cases), Elit 1, Invid 280 (pendiente el resto de la rotación — el cron 18:00 UTC completa el catálogo), Eikon 134 + BACKUP 28 (sin sync automático: quedan como señal correcta), y en "Todos" (697) se suman cargas manuales sin proveedor.

  **Pendientes:** revisar los 13 de Air Intra después del cron de 18:00 UTC (agregar rubros a ALLOWED_RUBROS si son vendibles); revocar PAT de GitHub (pendiente histórico).

- **2026-08-13 (s62): Stale products del dashboard — nuevo criterio + filtro por proveedor.** **2 commits: 0e2f4b8 (API) + e5f5715 (dashboard).**

  **Contexto:** el dueño pidió que el cartel de "productos sin actualizar hace más de 7 días" deje de contar productos sin stock y cargas manuales, que solo incluya Air Intra, Elit, Invid, Eikon y BACKUP, y que agregue filtros por proveedor.

  **Cambios en `/api/admin/stale-products/route.ts`:** (1) `AND p.stock > 0` en las 2 queries (count + listado); (2) por defecto `s.name IN ('Air Intra', 'Elit', 'Invid Computers', 'Eikon', 'BACKUP')` (el count ahora también hace LEFT JOIN suppliers); (3) params nuevos: `?provider=all` muestra todo (incluye manuales y otros proveedores), `?provider=<nombre exacto>` filtra por proveedor (parameterizado, sin riesgo de inyección).

  **Cambios en `src/app/admin/page.tsx`:** select de proveedor en el diálogo (opciones: Principales = default, Todos, y cada uno de los 5) que recarga el listado al cambiar; nota en el banner explicando el criterio; el badge del diálogo y el aviso de truncado usan el count del filtro activo (`dialogCount`), mientras el banner sigue mostrando el criterio default.

  **Validación en producción:** default (principales con stock) = 1,426 = 714 Air Intra + 549 Invid + 134 Eikon + 28 BACKUP + 1 Elit (la suma cierra exacta); `all` = 1,667 (agrega Sin proveedor, Office Insumos, METODOS). Antes del cambio el cartel contaba ~1,667+ sin distinguir stock ni proveedor.

- **2026-08-13 (s61): Tags para discos SSD y HDD en el formulario de edición del admin.** **1 commit: 18149fe.**

  **Contexto:** el dueño estaba editando discos (cambio de categoría) y no veía la sección "Tags (Filtros)". Esa sección es context-aware: solo aparece si la categoría del producto tiene grupos definidos en `CATEGORY_TAG_GROUPS` (antes: 9 categorías — pc-armadas, notebooks, gamer-y-diseno, memorias-ram + 2 subcats, placas-de-video, motherboards, microprocesadores). Los discos no estaban.

  **Cambios en `src/lib/product-tags.ts`:**
  (1) Grupo `'discos-ssd'` en CATEGORY_TAG_GROUPS: Tipo (M.2/NVMe, SATA) + Capacidad (Hasta 256GB, 480-512GB, 960GB-1TB, 2TB, 4TB+). Los `value` coinciden con los filtros de tienda de `CategoryProducts.tsx` ('NVME', 'SATA', 'upto256', '480-512', '960-1tb', '2tb', '4tbplus') → los tags asignados alimentan los filtros existentes (match tag-first case-insensitive + fallback regex, s51 d2).
  (2) Grupo `'discos-hdd'`: Capacidad (1TB, 2TB, 4TB, 6-8TB, 10-12TB, 16TB+) con los mismos values que los filtros de tienda.
  (3) Cases nuevos en `nameMatchesTag` para el botón "Detectar automáticamente": nvme (NVMe/M.2/PCIe/Gen3-5), sata (SATA sin NVMe en el nombre), y capacidades por regex de rangos GB/TB ('2tb' compartido SSD+HDD — sin colisión porque autoDetectTags solo itera los grupos de la categoría en edición).

  **Sin cambios en la tienda:** los filtros de /categoria/discos-ssd y discos-hdd ya funcionaban por matchFn (regex); los tags agregan el match primario más preciso. No se tocó CategoryProducts.tsx ni admin/productos/page.tsx (la sección aparece sola porque getTagGroupsForCategory ahora devuelve grupos para discos).

  **Pendientes:**
  - Agregar tags a más categorías si el dueño lo necesita (mismo patrón: grupo en CATEGORY_TAG_GROUPS + cases en nameMatchesTag)
  - Revocar el PAT de GitHub (pendiente desde s57)

- **2026-08-12 (s60): Invid — detección de "productos fantasma" (sacados del catálogo) y pase a stock=0.** **2 commits: fc65b33 (feat) + f237ef2 (guard armed).**

  **Contexto:** el dueño reportó "los precios de Invid no se actualizan" con capturas: el admin mostraba 5 RTX 5050 de Invid y el portal de Invid solo 3. Diagnóstico: los 3 solapados SÍ están actualizados (costo en DB = precio del portal: 0417872 $466.38, 0418265 $468.18, 0418069 $483.08). Los 2 de más en nuestro admin (MSI Shadow 2x OC 0418098 $322.71 con updatedAt 06-27, Gigabyte Windforce OC 0418266 $329.85 con updatedAt 06-30) están CONGELADOS desde junio: Invid los habría sacado del catálogo y ningún sync los desactivaba — el sync solo toca lo que encuentra en la API. Muestreo de 550 productos Invid: 92 (17%) con stock>0 y updatedAt anterior a 08-01 (la mayoría son productos sin cambios, pero el patrón de fantasma existe). También hay productos Invid con providerSku NULL que nunca se re-validan contra la API.

  **Cambio en `scripts/sync-invid-external.mjs`:**
  (1) Tracking de SKUs vistos por ciclo de catálogo completo: claves nuevas en store_config `invid_cycle_skus` (JSON acumulador por corrida), `invid_cycle_start` (timestamp de inicio del ciclo) y `invid_cycle_armed` ('1' cuando el acumulado arrancó limpio desde offset 0).
  (2) Al alcanzar el fin del catálogo (`reachedEnd`) con el ciclo armado: productos Invid con providerSku no-null, stock>0, NO vistos en el ciclo y updatedAt < cycle_start → `stock = 0` (batches de 100 con fallback individual). No se toca isActive ni se borra el producto: si Invid lo vuelve a listar, el update path le repone stock solo (self-healing).
  (3) Productos con providerSku NULL no se tocan (no se pueden validar contra la API) — se loguea el conteo para revisión.
  (4) Guard `armed` (commit f237ef2): evita desactivar masivamente en el primer ciclo incompleto post-deploy (el acumulado recién empieza a juntarse desde la primera corrida que arranca en offset 0). Sin este guard, el primer `reachedEnd` habría comparado contra un acumulado vacío y puesto stock=0 a ~5000 productos.
  (5) Resumen del log ahora incluye `Fantasmas (Invid los sacó del catálogo) stock→0: N`.

  **Validación:** run 31650711888 (23:23 UTC, código fc65b33) → success sin errores: retomó offset 5000, 429 inmediato (cuota consumida por el run 23:18), líneas nuevas del resumen OK. El guard f237ef2 entra en vigencia con el cron de 00:00.

  **Timeline esperado:** corrida 06:00 UTC completa el catálogo sin armed (no desactiva nada) → corrida ~12:00 arranca ciclo armado → corrida ~18:00 completa el ciclo → primera detección de fantasmas ~08-13 18:00 UTC. Si 0418098/0418266 ya no están en la API, pasan a stock=0 solos.

  **Pendientes:**
  - Confirmar con el dueño si 0418098 (MSI Shadow) y 0418266 (Gigabyte Windforce) existen en el portal de Invid (¿página 2 de su búsqueda?) — si existen, quedan como están tras el ciclo; si no, se desactivan solos
  - Revisar productos Invid con providerSku NULL (el log los cuenta)
  - Revocar el PAT de GitHub (pendiente desde s57)

- **2026-08-12 (s59): El cron de GitHub Actions ahora CREA productos nuevos de Invid + Elit** (revierte decisión de s51 d3). **4 commits: 04f18f5 (feat Invid), e95110c (feat Elit), a427b5f + e1d9349 (fix syntax).** Validación: run manual 31626081086 → ambos jobs SUCCESS.

  **Contexto:** el dueño señaló que el cron solo actualizaba precios y no traía productos nuevos (decisión s51 d3: los syncs externos no creaban productos por riesgo de categorización incorrecta; había que hacer sync manual cada 2-3 semanas). El dueño aprobó revertirlo con categorización segura: categoría solo si hay mapeo configurado, nunca inventada.

  **Cambios en `scripts/sync-invid-external.mjs` y `scripts/sync-elit-external.mjs`:**
  (1) **Creación de productos nuevos** — el bloque `if (!dbData) continue` ahora crea el producto: mismo INSERT que el sync manual (18 columnas, `ivaRate` NULL explícito — lección s45), specs (Marca/Part Number en Invid; Marca/EAN/Garantía en Elit), imágenes (`IMAGE_URL` Invid / array `imagenes` Elit), descripción y comparePrice (`FINAL_PRICE`/`pvp_usd` × markup). Nombre desde `TITLE` (Invid) / `nombre` (Elit); categoría del proveedor desde RUBRO/CATEGORIA/GRUPO/FAMILY/CATEGORY (Invid) y `categoria > sub_categoria` (Elit), igual que el sync manual.
  (2) **Categorización segura** — carga `supplier_category_mappings` del proveedor al inicio; si la categoría del proveedor tiene mapeo → crea con esa categoría; si no → `categoryId NULL` (cola "Sin categoría" del admin). Invid tiene 85 mapeos; Elit tiene 0 (van todos a "sin categoría" hasta configurar mapeos).
  (3) **Lista negra efectiva (s52)** — los SKUs en `deleted_products` ahora se bloquean de verdad (antes solo se logueaban): en la corrida de validación bloqueó 3 de Elit y 2 de Invid.
  (4) **Slugs con protección de colisión** — `generateSlug()` (misma lógica que `src/lib/format-product.ts`) + sufijo `-2`, `-3` si el slug ya existe (se cargan los ~8,870 slugs existentes al inicio).
  (5) **Soporte de NULL en `tursoExecute`/`tursoBatch`** — antes todos los args se convertían con `String()` (un NULL quedaba como el texto 'null'); ahora se envía `{type: 'null'}`. Sin esto no se podía pasar ivaRate/categoryId/comparePrice NULL. Cambio retrocompatible (ninguna llamada existente pasaba null).
  (6) **INSERTs en batches de 50** con fallback individual si el batch falla (mismo patrón que los updates).

  **Resultados de la corrida de validación (run 31626081086, 18:07 UTC):** Elit → 1,702 fetched, 158 updates, **6 productos nuevos creados** (0 errores), 3 en lista negra bloqueados. Invid → retomó desde offset 5,000 (mecanismo s56 intacto), 933 fetched, 4 updates, **83 productos nuevos creados** (0 errores), 2 en lista negra, offset reseteado a 0 (fin del catálogo ≈ 5,933 productos). Conteos en admin post-sync: Invid 1,679 → 1,763 activos, Elit 1,909 → 1,916 activos.

  **Hotfix misma sesión:** el primer push (04f18f5 + e95110c) salió con un SyntaxError (paréntesis de más en el manejo de NULLs) → run 31625733294 falló → corregido en a427b5f + e1d9349 → run 31626081086 success.

  **Impacto:** los productos nuevos ahora llegan solos con el cron: Elit cubre su catálogo completo en cada corrida (6h); Invid rota el catálogo completo cada ~1 día (4 corridas × 50 páginas por el rate limit de 50 req/hora). El sync manual del admin queda como herramienta para casos puntuales. $0 Vercel (todo corre en GitHub Actions, minutos dentro del free tier).

  **Pendientes:**
  - Configurar mapeos de categoría para Elit en /admin/proveedores (hoy 0 mapeos → los productos nuevos de Elit caen en "Sin categoría")
  - Revocar el PAT de GitHub usado para los deploys (pendiente desde s57/s58)

- **2026-08-12 (ops): Diagnóstico de crons — mail de fallo de sync-invid (caída de Invid el 08-08).** El dueño recibió el mail automático de GitHub Actions por `sync-invid` fallido (run del 2026-08-08 18:22 UTC, job 1m07s). Diagnóstico vía API de GitHub + logs del job: 5 corridas fallidas consecutivas entre 07/08 18:39 y 08/08 18:22, todas con el mismo error: el endpoint de auth de Invid devolvía `HTTP 503 — Module not enabled` en los 3 intentos con retry de 30s. **Causa del lado de Invid** (módulo de su API caído/deshabilitado), no nuestro. El servicio se recuperó solo: todos los runs desde el 09/08 fueron success. Estado verificado el 08-12: los 3 workflows activos y en horario (sync-air-intra cada 12h, sync-elit-invid cada 6h, sync-brands diario), lastSyncAt de los 3 proveedores fresco, minutos de GH Actions holgados dentro del free tier. Sin cambios de código. Lecciones: (1) el mail de fallo es la alerta diseñada en s47 y funcionó correctamente; (2) `503 Module not enabled` de Invid = caída del proveedor, el retry + la próxima corrida lo resuelven solos.

- **2026-08-12 (s58):** Fix error 429 en el sync manual de Invid desde el admin. **1 commit: 58ac6f5.** **1 cambio:**

  (1) **Sync manual de Invid no manejaba el rate limit (bug)** — El dueño reportó "Error fetching products from Invid: 429" al tocar Sincronizar en `/admin/proveedores`. Causa raíz: la API de Invid tiene rate limit de **50 req/hora por usuario** y el catálogo tiene más de 5000 productos (100 productos/request → un ciclo completo necesita 50+ requests). El sync externo de GitHub Actions ya manejaba esto desde s56 (offset persistente en `store_config['invid_sync_offset']`), pero el sync manual del admin (`syncInvid()` en `src/app/api/admin/suppliers/sync/route.ts`) arrancaba SIEMPRE desde offset 0, no manejaba 429 (devolvía error crudo) y no guardaba progreso: cada intento desperdiciaba la cuota horaria re-procesando los primeros 5000 productos y moría en el offset 5000. Fix en `syncInvid()`: (a) arranca desde el offset guardado en `store_config` (progreso compartido con el cron de GitHub Actions), (b) ante HTTP 429 guarda el offset y devuelve éxito parcial con mensaje explicativo en vez de error, (c) guarda el offset tras cada página procesada (resistente al timeout de 60s de Vercel Hobby), (d) al llegar al final del catálogo resetea el offset a 0 para el próximo ciclo. Sin cambios de SELECT ni schema (regla #5): solo se usan las columnas key/value de `store_config` que ya existen (mismo UPSERT que usa el script externo).

  **Validación en producción (post-deploy):** POST `/api/admin/suppliers/sync` con el supplier Invid → HTTP 200 en 3.5s con mensaje "Rate limit de Invid alcanzado (50 pedidos/hora) en offset 5000... El progreso quedó guardado: la próxima sincronización continúa desde acá". Confirmado el escenario del bug: la cuota horaria estaba agotada (la había consumido el intento fallido anterior del dueño con el código viejo) y el nuevo código retomó desde el offset guardado (5000) y respondió correctamente en vez de fallar.

  **Nota de uso para el dueño:** el sync manual de Invid ahora funciona por tandas de hasta 5000 productos (lo que permite la cuota horaria). Si se toca Sincronizar justo después del cron (00/06/12/18 UTC) o de otro sync reciente, puede responder "rate limit, 0 procesados": es esperado, la cuota se va recargando con el correr de la hora. El offset es compartido con el cron de GitHub Actions; entre los dos cubren el catálogo completo en 1-2 días (igual que desde s56). Para traer productos NUEVOS de Invid sigue siendo necesario el sync manual (el cron solo actualiza existentes), pero ahora cada clic avanza el ciclo en vez de chocar contra el mismo error.

  **Pendientes:**
  - Revocar el PAT de GitHub usado para los deploys (el token de s57 sigue activo)

- **2026-08-12 (s57):** Fix búsqueda "1120" — dropdown mostraba 2 impresoras y al hacer Enter aparecía solo 1. **2 commits: c95b389, 4c2cdd9.** **2 cambios en esta tanda:**

  (1) **Dedup conservaba la variante MÁS CARA (bug)** — La búsqueda "1120" matcheaba 3 productos activos con stock: 2x "Impresora Epson Monocromatica M1120 Sist Cont de Tinta Wifi" (el MISMO producto de 2 proveedores: imagen propia $389.267 stock 4 | Invid $419.226 stock 10) + Botella Epson T534120-al Negro $52.874. `searchProducts()` agrupa por nombre normalizado en `deduplicateProducts()` y conserva solo uno — pero el sort usaba `costPrice` (USD), no el precio final ARS. Invid convierte ARS→USD en su sync, así que su costo USD resulta menor aunque el precio final sea mayor: se conservaba la variante de $419.226 y se ocultaba la de $389.267. El cliente perdía la oferta más barata. Fix: el comparador de `deduplicateProducts()` (`src/lib/queries.ts`) ahora usa el precio FINAL calculado por `calculateProductPrices()` (`price`), con fallback a `costPrice` cuando no existe. Cambio retrocompatible (campo `price` opcional en la generic, ningún otro caller se rompe).

  (2) **Dropdown inconsistente con la página de resultados** — `/api/search` (query directa s54) NO deduplicaba: el navbar mostraba las 2 impresoras + la botella, y al hacer Enter (`/categoria/todos?q=1120`) aparecía solo 1. Fix en `src/app/api/search/route.ts`: LIMIT SQL 6→12 (sobrefetch), aplicar el mismo `deduplicateProducts()` y recortar a 6 sugerencias. Dropdown y página de resultados ahora coinciden. Sin cambios en SELECT (regla #5 respetada: costPrice/stock ya estaban en SEARCH_SELECT), sin cambios de schema.

  **Validación en producción (post-deploy de Vercel):** `curl "https://www.compucityonline.com.ar/api/search?q=1120&v=2"` → debe devolver 2 productos (impresora M1120 $389K + botella). `/categoria/todos?q=1120` → "2 productos" con la impresora de $389K (antes mostraba la de $419K). El `&v=2` bypasea el cache CDN de 5 min del endpoint.

  **Pendientes:**
  - **Revocar el PAT de GitHub usado para este push** — el token fue pegado en texto plano en el chat, está comprometido. Revocar en GitHub → Settings → Developer settings → Personal access tokens y generar uno nuevo si hace falta
  - Regresiones de búsqueda: verificar que el dropdown coincida con la página de resultados para "notebook", "mouse", "redragon"

- **2026-08-11 (s56 continuación):** Fix sync Invid rate limit + SKU 0418605 + monitoreo productos stale. **3 commits: 32e13fb, 2d2535b, (docs pendiente)** + 1 fix DB directa. **4 cambios en esta tanda:**

  (1) **Fix SKU 0418605 (DB directa, sin deploy)** — VGA Gigabyte GeForce RTX 5070 EAGLE OC ICE SFF 12G White (SKU Invid 0418605) tenía precio desactualizado en DB: costPrice=USD 756.67 cuando el precio real en API Invid es USD 912.06. Diferencia de USD 155 (20% más barato en nuestra web). Causa raíz: el sync de Invid no llegaba a este producto por bug de rate limit (ver punto 2). Fix aplicado vía script one-shot `scripts/fix-sku-0418605.mjs`: UPDATE en products con costPrice=912.06, price=1185.678 (costo+30% markup), stock=3 (BAJO STOCK según API), ivaRate=10.5 (10.5% según API, antes era null). Datos confirmados vía endpoint directo `GET /api/v1/articulo.php?id=0418605` con token JWT de la cuenta `pmariavirgina`.

  (2) **Fix crítico sync Invid — rate limit + offset persistente** — **Commit `32e13fb`.** El sync de Invid (`scripts/sync-invid-external.mjs`) tenía 2 bugs graves que causaban que productos después del offset 5000 NUNCA se sincronizaran:
    - **Bug 1:** No manejaba HTTP 429 (rate limit). Invid tiene límite de 50 req/hora por usuario. 50 req × 100 productos/req = 5000 productos por ventana. Cuando el sync se quedaba sin cupo, hacía `break` y cortaba sin guardar progreso.
    - **Bug 2:** No guardaba el offset entre corridas. Cada cron arrancaba desde offset 0 otra vez. Los mismos productos del offset 0-5000 se sincronizaban 4 veces al día, los del offset 5000+ NUNCA se reachaban.
    - **Causa del bug reportado:** SKU 0418605 estaba después del offset 5000. Precio en DB: USD 756.67 (viejo, hacía meses que no se actualizaba). Precio real API: USD 912.06.
    - **Fix aplicado:**
      1. Guardar offset en `store_config` (clave `invid_sync_offset`) — cada corrida arranca desde el último offset guardado
      2. Manejar HTTP 429 leyendo headers `retry-after`, `x-ratelimit-remaining`, `x-ratelimit-reset` — guarda offset actual antes de salir
      3. Al llegar al final del catálogo, resetea offset a 0 para empezar de nuevo
      4. Log claro del estado final (completado / pausado por rate limit / error)
    - **Cobertura esperada:** 50 req/hora × 100 productos = 5000 productos/hora × 4 corridas/día = 20,000 productos/día. Catálogo Invid ~5000-10000 productos → sync completo en 1-2 días. Antes del fix: productos del offset 5000+ JAMÁS se sincronizaban.
    - **Verificación post-deploy:** workflow_dispatch run #170 → success. Offset guardado: 4800 (sync se cortó por rate limit y guardó progreso). 22 productos Invid actualizados en la última hora.

  (3) **Monitoreo de productos stale en panel admin** — **Commit `2d2535b`.** Sistema de detección temprana para productos que no se actualizan hace más de 7 días. Permite detectar problemas de sync ANTES de que lleguen al cliente (como el bug del SKU 0418605).
    - **NUEVO endpoint `GET /api/admin/stale-products`:** query productos con `updatedAt < datetime('now', '-7 days')`. Incluye TODOS los productos (con y sin proveedor). Devuelve count total + listado de hasta 500 productos (los más viejos primero). Auth requerida.
    - **Banner en dashboard `/admin`:** llama al endpoint al cargar. Si hay productos stale (count > 0), muestra banner amarillo arriba de todo con botón "Ver detalle". Si el fetch falla, no rompe el dashboard (catch con console.error).
    - **Dialog con tabla de productos stale:** columnas producto/SKU/proveedor/stock/estado/última actualización. Link en el nombre → `/admin/productos?search=...` para editar. Badge Activo/Inactivo. Stock en rojo si es 0. Aviso al pie si el listado está truncado (>500 productos).
    - **Verificación post-deploy:** 3,686 productos stale detectados en producción (43% del catálogo). Productos más viejos del 27 de mayo 2026 (más de 2 meses sin actualizar). El número va a bajar en los próximos 1-2 días a medida que el sync arreglado recorra todo el catálogo de Invid.
    - **Archivos:** `src/app/api/admin/stale-products/route.ts` (NUEVO, 83 líneas), `src/app/admin/page.tsx` (edición quirúrgica: imports + state + 2 funciones + banner + dialog).

  (4) **Documento técnico para soporte Invid** — El dueño fue contactado por Invid pidiendo captura del código de implementación de la API. Se armó documento Markdown en `/home/z/my-project/download/invid-api-codigo-para-soporte.md` con: (a) autenticación contra `/api/v1/auth.php`, (b) consulta paginada con `/api/v1/articulo.php?offset=N`, (c) procesamiento de cada producto (campos `ID`, `PRICE`, `STOCK_STATUS`), (d) listado de campos usados, (e) 3 preguntas puntuales para Invid: ¿login y paginación correctos? / ¿campo `PRICE` es el correcto para precio? / ¿`STOCK_STATUS` es la forma correcta de obtener stock o deberíamos usar el campo numérico `STOCK`? **Importante:** el documento NO menciona el bug del rate limit ni el SKU 0418605 — solo muestra el código tal cual y pide confirmación. Estrategia: si Invid dice que está bien, cerramos el tema; si dicen que usemos otro campo, lo ajustamos. **NO mandar el documento técnico completo anterior** (`invid-api-integration-tech-doc.md`) que tenía la sección "Diferencia entre API y portal web" — ese era comprometedor porque afirmaba que la API devolvía precios distintos (falso, la API devuelve el precio correcto, el problema era nuestro bug de sync).

  **Lecciones aprendidas esta sesión:**

  - **API Invid rate limit es 50 req/hora por usuario** (no por IP). Confirmado vía headers `x-ratelimit-limit: 50`, `x-ratelimit-remaining`, `x-ratelimit-reset`. Documentación Swagger: https://invidcomputers.com/api/swagger (OpenAPI spec en `/api/openapi.yaml`).
  - **Endpoint directo por ID existe y NO se usaba:** `GET /api/v1/articulo.php?id=XXXX` devuelve un producto puntual con 1 solo request. La documentación Swagger lo confirma: "Si se envia `id`, se ignora `offset` y se devuelve ese articulo puntional". Consumo 1 request en lugar de paginar todo el catálogo.
  - **JWT de Invid incluye campo `stock`:** `"stock":"Y"` = tiene permiso para ver campo `STOCK` numérico real. `"stock":"N"` = sin permiso, solo `STOCK_STATUS` texto. La cuenta `pmariavirgina` tiene `"stock":"N"`.
  - **Campos adicionales que NO usamos pero existen en la API:** `FINAL_PRICE` (precio final con IVA + impuestos internos), `IVA_PERCENT`, `IVA_VALUE`, `INTERNAL_TAX_PERCENT`, `INTERNAL_TAX_VALUE`, `STOCK` (numérico, requiere permiso), `CATEGORIES` (array con categoría padre).
  - **Credenciales Invid confirmadas:** usuario `pmariavirgina`, customer_id `27301194302`, contraseña `Pivetta_M` (subida a GitHub Secrets como `INVID_USER` e `INVID_PASS`). Login por portal web usa CUIT+contraseña distinta (no la misma cuenta que la API).
  - **Regla de oro para sync de proveedores con rate limit:** siempre guardar el offset/progreso entre corridas. Si el rate limit es de N req/hora y el catálogo es mayor a N×pageSize, sin offset persistente hay productos que NUNCA se sincronizan.

  **Pendientes:**
  - Esperar respuesta de Invid al documento técnico enviado — si sugieren usar otros campos, ajustar sync
  - Monitorear que el offset `invid_sync_offset` avance bien en los próximos días (debería llegar a 0 en 1-2 días cuando complete el catálogo)
  - El número de productos stale (3,686 hoy) debería bajar significativamente en 1-2 días
  - Revocar PAT de GitHub usado para los deploys (`ghp_...`)

- **2026-08-04 (s56):** Refresh carrito + filtros persistentes URL + filtros marca + SKU 53287. **5 commits: 8e622f1, 95a857b, cff8062, 044343c, aeac384.** **8 cambios en esta sesión:**

  (1) **Dirección visible en listado de clientes** — `/admin/clientes` ahora muestra la dirección del cliente (calle, ciudad, provincia, CP) debajo del email en cada tarjeta, sin necesidad de expandir. **Archivo:** `src/app/admin/clientes/page.tsx`. Commit `8e622f1`.

  (2) **Rubro 001-0340 en ALLOWED_RUBROS Air Intra** — El rubro `001-0340` (KITS TECLADO+MOUSE) tenía mapeo de categoría configurado pero faltaba en la lista de permitidos, por eso productos como SKU 53287 (TEC+MOUSE LOGITECH MK120) no se sincronizaban. Agregado a `ALLOWED_RUBROS` en `scripts/sync-air-intra-external.mjs`. Commit `8e622f1`.

  (3) **Filtro Gigabyte en notebooks** — Agregado `{ key: 'brand', label: 'Gigabyte', value: 'gigabyte', matchFn: ... }` en `CATEGORY_FILTERS['notebooks']`. Commit `8e622f1`.

  (4) **Fix regex Gigabyte** — La regex original `\bGIGABYTE\b|\bAORUS\b|\bAERO\b` matcheaba por error la **HP Pavilion Aero** (HP tiene línea "Pavilion Aero" de notebooks livianas). Sacado `\bAERO\b` (la línea Gigabyte Aero no existe en nuestra DB, verificado). Regex final: `\bGIGABYTE\b|\bAORUS\b`. **Archivo:** `src/components/ui-custom/CategoryProducts.tsx`. Commit `95a857b`.

  (5) **Tag Gigabyte en admin notebooks** — Agregado `{ value: 'gigabyte', label: 'Gigabyte' }` a las opciones de marca de `notebooks` y `gamer-y-diseno` en `CATEGORY_TAG_GROUPS`. El `nameMatchesTag` para `gigabyte` ya existía con regex correcta, pero la opción no estaba en la lista visible del admin. **Archivo:** `src/lib/product-tags.ts`. Commit `95a857b`.

  (6) **Refresh automático de precios del carrito** — Variante B + expiración de 1 hora. Items con <5 min en carrito: sin refresh (precio fresco). Items con 5min-1h: refresh silencioso al cargar `/carrito` o `/checkout`. Items con >1h: NO se refrescan + banner amarillo pidiendo al usuario que refresque a mano (evita generar requests para carritos abandonados). Nuevo hook `src/hooks/use-cart-price-refresh.ts` (Promise.allSettled + try/catch con console.error, no silent fail). `refreshPrices` en `cart.ts` solo actualiza price y addedAt, NO toca quantity/image/slug/name. `addedAt` opcional para no romper carritos viejos en localStorage. Reutiliza el endpoint `/api/products?id=X` que ya existe y ya está cacheado 5 min en CDN. **Archivos:** `src/store/cart.ts`, `src/hooks/use-cart-price-refresh.ts` (nuevo), `src/app/(tienda)/carrito/page.tsx`, `src/app/(tienda)/checkout/page.tsx`. Commit `cff8062`.

  (7) **Persistencia de filtros en URL** — Los filtros de categoría (marca, tipo, socket, DDR, precio, stock, orden, página) ahora se persisten en la URL como query params. Antes: al navegar a un producto y volver con botón atrás, los filtros se perdían. Ahora: los filtros se guardan en la URL y se reconstruyen automáticamente. URLs shareable: `/categoria/notebooks?marca=gigabyte&pantalla=16`. `useState` inicializa desde `useSearchParams`, `useEffect` sincroniza cambios → URL con `router.replace` (no push, para no llenar history). `q` (búsqueda) se preserva. **Archivo:** `src/components/ui-custom/CategoryProducts.tsx`. Commit `044343c`.

  (8) **Filtro Performance en PC Armadas** — Agregado `{ key: 'brand', label: 'Performance', value: 'performance', matchFn: (n) => /\bPERFORMANCE\b/i.test(n) }` en `CATEGORY_FILTERS['pc-armadas']` (storefront) + `{ value: 'performance', label: 'Performance' }` en `CATEGORY_TAG_GROUPS['pc-armadas']` (admin) + `case 'performance'` en `nameMatchesTag`. 18 PCs armadas con stock matchean el filtro hoy. **Archivos:** `src/components/ui-custom/CategoryProducts.tsx`, `src/lib/product-tags.ts`. Commit `aeac384`.

  **Adicional (DB directa, sin deploy):** SKU 53287 (TEC+MOUSE LOGITECH MK120 USB BLACK LATINO) insertado manualmente en Turso vía script one-shot. Producto estaba en Air Intra pero no se sincronizaba por filtro de rubro (ver punto 2). Datos: costo USD 11.13, stock 223 (air:100, lug:100, ros:23), categoryId `ac551783-8734-4858-a316-d0a54701e437` (mapeo 001-0340). Script: `scripts/insert-sku-53287.mjs`.

  **Backups completos post-sesión:**
  - DB Turso: `compucity_turso_backup_s56_2026-08-03T21-57-24-430Z.json` (69 MB, 11,560 filas, 17 tablas)
  - Código: `compucity_src_backup_s56_2026-08-03.tar.gz` (3.3 MB)

  **QA completo post-deploy:** todas las páginas y APIs responden 200 OK, sin errores JS visibles. Categorías con filtros URL funcionando, `/carrito` y `/checkout` cargan sin errores, SKU 53287 visible en tienda y search, `/api/admin/upload` no se borró en ningún deploy.

  **Reglas de seguridad respetadas:**
  - No se tocaron: DB schema, endpoints existentes, queries SQL, `globals.css`, `tailwind.config.ts`, `HeroSection.tsx`, `ProductCard.tsx`
  - `addedAt` opcional para no romper carritos viejos en localStorage
  - `Promise.allSettled` + `try/catch` con `console.error` (no silent fail — lección s50)
  - `/api/admin/upload/route.ts` restaurado manualmente en cada commit (bug recurrente del repo)
  - TypeScript check pasó sin errores en archivos modificados
  - `ranRef` previene doble ejecución en React StrictMode
  - `router.replace` con `scroll: false` para no llenar history ni saltar al top

  **Pendientes:**
  - Revocar PAT de GitHub usado para los deploys (`ghp_...` — token temporal ya revocado post-deploy)
  - Verificar manualmente (requiere login admin): que el formulario de productos muestre los checkboxes "Gigabyte" (notebooks) y "Performance" (pc-armadas), que la dirección se vea en `/admin/clientes`, que el botón "Editar cliente" en `/admin/pedidos` abra el dialog correcto

- **2026-07-21 (s55):** Performance de búsqueda + admin + Google Maps en contacto. **3 commits: 3f4cfc8, 6f08b2b, c942cd7.** (1) **Fix búsqueda lenta en /categoria/todos:** `searchProducts()` en `queries.ts` tenía `LEFT JOIN brands` + `OR b.name LIKE` que causaba nested loop scan (~8300×112 filas = timeout). Eliminado el JOIN y el OR, ORDER BY movido a memoria (SQLite puede hacer early termination con LIMIT cuando no hay ORDER BY). Sort en memoria después de dedup: productos con imagen primero, luego por fecha. (2) **Miniaturas en barra de búsqueda:** El endpoint `/api/search-index` no incluía imágenes. Agregado campo `i: firstImage` (primera imagen del producto extraída de `JSON.parse(calculated.images)`). En `Navbar.tsx`, mapeado `p.i` a `images: p.i ? [p.i] : []` para mostrar miniaturas en el dropdown de autocomplete. Tamaño del índice: ~150KB gzipped (sin imágenes base64, solo URLs). (3) **Admin lento — 3 causas raíz:** (a) `/api/admin/orders` cargaba TODOS los pedidos sin paginación → agregada paginación con LIMIT/OFFSET + count query en paralelo, filtros por status y búsqueda, order_items solo para los IDs de la página actual. (b) `/admin/proveedores` hacía doble fetch de suppliers (2 useEffects independientes) → segundo useEffect ahora usa `suppliers` del state + `cooldownChecked` ref. (c) `/admin/productos` fetch de dollarConfig redundante → `fetchDollarConfig` retorna early si ya está cargado. (4) **Índices DB:** Agregados 3 índices en `db.ts` migración: `idx_orders_createdAt` (orders.createdAt DESC), `idx_orders_status` (orders.status), `idx_order_items_orderId` (order_items.orderId). (5) **Google Maps en /contacto:** Agregado iframe embed de Google Maps con la dirección del local (Av. Sarmiento 462, La Falda, Córdoba). Layout 2 columnas: info contacto a la izquierda, mapa a la derecha. Mapa con `loading="lazy"` para performance. **Archivos modificados:** `src/lib/queries.ts`, `src/components/layout/Navbar.tsx`, `src/app/api/search-index/route.ts`, `src/app/api/admin/orders/route.ts`, `src/app/admin/pedidos/page.tsx`, `src/app/admin/proveedores/page.tsx`, `src/app/admin/productos/page.tsx`, `src/lib/db.ts`, `src/app/(tienda)/contacto/page.tsx`.

- **2026-07-16 (s53):** 138 productos de servidor pasados a lista negra. La tabla `deleted_products` NO existía en la DB de producción (la migración #28 de `db.ts` nunca se ejecutó contra Turso). Se creó manualmente con `CREATE TABLE IF NOT EXISTS deleted_products (id TEXT PRIMARY KEY, providerId TEXT NOT NULL, providerSku TEXT NOT NULL, productId TEXT, name TEXT, deletedAt TEXT NOT NULL)`. Luego se insertaron 138 registros y se eliminaron de `products`. Productos eliminados: Dell PowerEdge (R570, R660XS, R440, R450, T160, T550), HPE ProLiant (DL145, DL320, DL345, DL360, DL380, ML110, ML350), HPE Synergy (12000 Frame, Composer2, Link Module), HPE Alletra 6000, Dell PowerVault/PowerStore/ME storage, HPE 3PAR, Dell networking óptica, HPE MSL LTO tape, controladoras HPE MR, risers/heatsinks/fans para servidores, Lenovo/Intel server risers/backplanes. DB: 8452 → 8314 productos (-138). Ningún producto de consumo afectado (notebooks Dell, monitores, workstations, NAS verificados intactos). Los scripts de GitHub Actions ya tenían `loadDeletedBlacklist()` del fix de s52, así que los SKUs no serán recreados.

- **2026-07-16 (s52):** Fix lista negra en scripts externos de GitHub Actions. **Commit: pendiente.** La lista negra de productos eliminados (tabla `deleted_products`, implementada en s51 d4) solo funcionaba en el sync manual (`suppliers/sync/route.ts`). Los 3 scripts externos que corren en GitHub Actions NO consultaban la lista negra, por lo que podían volver a crear productos que el admin había eliminado. Fix aplicado:

  (1) **sync-air-intra-external.mjs** — Agregada función `loadDeletedBlacklist(supplierId)` que consulta `deleted_products` al inicio. Antes de cada INSERT de producto nuevo, verifica `deletedBlacklist.has(providerSku)` y lo saltea si está en la lista. Nuevo contador `blacklisted` en el resumen final. También se agregó `categoryId` al SELECT de productos existentes (ya se usaba en el UPDATE pero no se cargaba).

  (2) **sync-elit-external.mjs** — Agregada `loadDeletedBlacklist()`. Hoy Elit solo hace UPDATE de productos existentes (no crea nuevos), pero se agregó logging de auditoría: si un SKU de la API está en la lista negra y no existe en la DB, se loguea `⛔ SKU xxx en lista negra, no se crearía`. Prevención para si en el futuro Elit empieza a crear productos.

  (3) **sync-invid-external.mjs** — Idem Elit: `loadDeletedBlacklist()` + logging de auditoría. Mismo razonamiento preventivo.

  **Nota:** El script de Air Intra es el único que realmente necesita el bloqueo porque es el único que hace INSERT de productos nuevos. Elit e Invid solo actualizan existentes, pero la protección queda por si cambian en el futuro.

- **2026-07-14 (s51 dia 4):** Página Garantía y Devoluciones + textos legales en PDFs + lista negra de productos eliminados. **Commits: 740bb3c (garantía + PDFs) + 2ee22c5 (lista negra).** **7 cambios en esta tanda:**

  (1) **Página nueva /garantia-y-devoluciones** — Creada en `src/app/(tienda)/garantia-y-devoluciones/page.tsx`. Contenido completo de la política de garantía y devoluciones extraída del PDF del dueño y formateado en HTML con secciones claras: plazo para cambio (10 días), motivos válidos, cambio sin/con defectos, devolución (ley 24.240), política de garantía, 12 meses de garantía local (PCs ensambladas, hardware, conectividad, memorias/pendrives), ¿debo abonar el envío?, gestión pasados los 10 días, exclusiones, consideraciones (monitores LCD píxeles, gabinetes/kits, notebooks, tablets). 3 cards destacadas con números clave (10 días, 12 meses, 48h hábiles). CTA con botones Contacto y WhatsApp. Metadata SEO completa. Estilo consistente con el sitio.

  (2) **Link en el footer** — Agregado "Garantía y Devoluciones" en la sección "Información" del footer, junto a Arma tu PC, Contacto, Mis Pedidos. **Archivo:** `src/components/layout/Footer.tsx`.

  (3) **Aviso en el checkout** — Texto chiquito debajo del botón "Enviar pedido por WhatsApp": "Al confirmar tu compra aceptás nuestra Política de Garantía y Devoluciones" con link a la página nueva (abre en pestaña nueva). **Archivo:** `src/app/(tienda)/checkout/page.tsx`.

  (4) **Textos legales en el PDF de Arma tu PC** — Agregados 4 bloques después de la nota de 96hs: (a) nota sobre variación de marcas por stock (gris itálica, texto completo del dueño), (b) "POLITICA DE GARANTIA Y DEVOLUCIONES" con link clickeable a la página nueva (verde), (c) "ANTES DE ABONAR CONSULTA POR DISPONIBILIDAD DE STOCK" (rojo), (d) "PRECIOS VALIDOS HASTA EL DD/MM/AAAA INCLUSIVE" — fecha calculada automáticamente (presupuesto + 7 días). Control de espacio con addPage() si no entra. **Archivo:** `src/app/(tienda)/arma-tu-pc/page.tsx`.

  (5) **Textos legales en el PDF del carrito** — Mismos 4 bloques que el PDF de Arma tu PC, aplicados a `generateCartPDF`. **Archivo:** `src/lib/generate-cart-pdf.ts`.

  (6) **Lista negra de productos eliminados** — Bug: cuando el admin elimina un producto desde `/admin/productos`, el sync manual lo vuelve a crear porque busca por `providerSku` y al no encontrarlo lo trata como producto nuevo. El dueño reportó: "elimino productos de la bd pero cuando vuelve a consultar la api los agrega de nuevo". Solución: tabla `deleted_products` (migración #28 en `db.ts`). Antes del DELETE físico, si el producto tiene `providerId` + `providerSku`, se inserta registro en `deleted_products`. Las 5 funciones de sync manual cargan la lista negra al inicio (`loadDeletedBlacklist`) y chequean antes de cada INSERT (8 INSERTs protegidos = 100% cobertura). El sync externo (GitHub Actions) no se modifica (ya sabemos que no crea productos nuevos). **Archivos:** `src/lib/db.ts` (migración #28), `src/app/api/admin/products/route.ts` (DELETE modificado), `src/app/api/admin/suppliers/sync/route.ts` (helper + 5 funciones + 8 INSERTs).

  (7) **OG image con logo real + og-image-v2** — (aplicado en commits anteriores del día 3 pero documentado acá por continuidad). Imagen OG del home regenerada con Python/PIL: degradé verde (#1A3E2E → #3A8B68), logo real centrado ("COMPU" en blanco, "CITY" e ícono en verde claro, tagline en blanco). 1200x630px, 35KB. Páginas de producto cambiadas para usar `og-image-v2.jpg` (mismo logo) en vez de la imagen del producto. Renombrado a `og-image-v2.jpg` para forzar re-cacheo de WhatsApp (Facebook Debugger no funcionó). **Archivos:** `public/images/og-image-v2.jpg`, `src/app/layout.tsx`, `src/app/(tienda)/producto/[slug]/page.tsx`.

  **Pendientes detectados en esta sesión (no resueltos):**
  - No hay interfaz visual para ver/restaurar productos eliminados de la lista negra. Si el dueño se equivoca eliminando, se restaura a mano desde la DB.
  - WhatsApp cachea previews hasta 30 días. El truco de cambiar nombre del archivo a `og-image-v2.jpg` debería funcionar para links nuevos.

- **2026-07-10 (s51 dia 3):** Filtros de pulgadas en monitores + OG image con logo + sync manual Invid. **Commits: 63aea93 (og-image regenerado limpio con degradé) + 1046524 (og-image en productos) + a4ff5bb (og-image-v2 para forzar re-cacheo WhatsApp) + c3dbbd5 (filtros pulgadas monitores).** **5 cambios en esta tanda:**

  (1) **OG image del home regenerada con logo real** — Bug: la imagen OG anterior tenía texto "Compucity - Tu Mundo Digital" con tipografía genérica, sin el logo real. El dueño reportó: "no sale con nuestro logo" al compartir links por WhatsApp. Fix: regenerar `public/images/og-image.jpg` desde cero con Python/PIL: fondo degradé verde (#1A3E2E arriba → #3A8B68 abajo), logo real centrado (procesado: "COMPU" en blanco sobre fondo oscuro, "CITY" e ícono en verde claro aclarado, "TU MUNDO DIGITAL" en blanco). Sin ilustraciones tech. 1200x630 px, 35 KB. Validado con VLM. **Archivo:** `public/images/og-image.jpg`.

  (2) **OG image en páginas de producto** — Bug: cuando se compartía un link de producto por WhatsApp, la preview mostraba SOLO la imagen del producto, sin el logo de Compucity. El dueño reportó: "el tema que me muestra el productos sin el logo de compucity". Fix (Opción B): en `src/app/(tienda)/producto/[slug]/page.tsx`, `generateMetadata` ahora siempre usa `og-image.jpg` como `og:image`, sin importar si el producto tiene imagen propia. La imagen del producto sigue usándose en: galería de la página del producto, JSON-LD (structured data para Google), ProductCards del storefront. Solo cambia el meta tag `og:image` / `twitter:image` de las páginas de producto.

  (3) **og-image-v2.jpg para forzar re-cacheo de WhatsApp** — Bug: aunque la imagen `og-image.jpg` se actualizó correctamente (deploy confirmado), WhatsApp seguía mostrando la imagen vieja porque cachea las previews por hasta 30 días basándose en la URL. Facebook Debugger con "Scrape Again" no funcionó (reporte del dueño). Fix: cambiar el nombre del archivo de `og-image.jpg` → `og-image-v2.jpg`. Esto cambia la URL del meta tag `og:image`, lo que fuerza a WhatsApp y Facebook a hacer fetch fresco. **Archivos:** `public/images/og-image-v2.jpg` (nuevo, mismo contenido que og-image.jpg), `src/app/layout.tsx` (meta tag del home apunta a v2), `src/app/(tienda)/producto/[slug]/page.tsx` (meta tag de producto apunta a v2).

  (4) **Filtros de pulgadas en monitores arreglados** — Bug: el filtro de 22" en `/categoria/monitores` devolvía 0 productos aunque había 13 monitores de 22" visibles. Causa raíz: la regex `/\b22[\s\"\-\.]\d/` requería un DÍGITO después del separador, pero los nombres reales son "Monitor 22 HP", "Monitor 22 Dell", etc. (número + espacio + letra). Fix: regex reescrita desde cero usando lookbehind `(?<![0-9a-zA-Z])` para no matchear "E20" (parte de modelo), `NN(?:[.,]\d)?` para decimales como "24.5", y `(?:comillas|espacio no seguido de dígito)` para matchear "22\"", "22 Plano", "22 HP" pero no "2254G". Comillas incluye recta `"` y tipográficas `"` `" `' '`. Agregados filtros nuevos 20" (3 productos) y 25" (8 productos). 22" ahora incluye 21.5" (se vende como 22). 24" ahora incluye 23.5-23.9" (se vende como 24). Validación: cobertura 125/135 (92.6%), sin overlaps. **Archivo:** `src/components/ui-custom/CategoryProducts.tsx`.

  (5) **Diagnóstico parlante Genius SP-915BT de Invid** — Bug reportado: "el artículo Parlante Genius SP-915BT (código 0418205) del proveedor Invid tiene stock pero no lo trae la API". Diagnóstico: el producto NO existe en la DB. Causa raíz: el sync externo de Invid (`scripts/sync-invid-external.mjs` línea 262: `if (!dbData) continue`) NO crea productos nuevos, solo actualiza stock/precio de los existentes (mismo bug que Elit detectado en s51 d2). El producto sí existe bajo Air Intra con SKUs 214514-7 (4 variantes), todas con stock=0. El SKU 0418205 de Invid nunca se sincronizó. **Solución:** el dueño debe hacer sync manual desde `/admin/proveedores` cada 2-3 semanas para traer productos nuevos (el sync manual SÍ crea y categoriza productos). **No se modificó código** — decisión del dueño: no modificar el sync externo para crear productos nuevos automáticamente (riesgo de categorización incorrecta). Se le envió texto explicativo al dueño.

  **Pendientes detectados en esta sesión (no resueltos):**
  - Sync externo de Invid (igual que Elit) no crea productos nuevos. El dueño debe hacer sync manual cada 2-3 semanas.
  - 2 productos con "Monitor19" y "Monitor22" sin espacio entre palabra y número no matchean filtros de pulgadas (edge cases raros, 2 productos de 135).
  - AOC 31.5" no matchea filtro 32"+ (la regex requiere número entero 32-49). Se podría agregar 31.5" como excepción pero es solo 3 productos.
  - LG 26" y LG 28" no tienen filtro específico (4 productos). Se podría agregar pero no son comunes.
  - WhatsApp cachea previews hasta 30 días — Facebook Debugger no funcionó, se usó truco de cambiar nombre del archivo a og-image-v2.jpg.

- **2026-07-08 (s51 dia 2):** Filtros monitores/teclados-gamer/pendrives + editar items en pedidos + footer paulerostudio. **Commit: c446355.** **6 cambios en esta tanda:**

  (1) **PC Armadas — sacar filtro de tipo** — Removidos los 5 filtros de tipo (Gamer, Oficina, Diseño, Mini PC, AIO) a pedido del dueño. Solo quedan marca, procesador, RAM, GPU. **Archivo:** `src/components/ui-custom/CategoryProducts.tsx`.

  (2) **Monitores — arreglar filtros de marca** — Bug: el matching de tags en `applyFilters` era case-sensitive y NO caía al regex del nombre si el producto tenía tags. Por eso filtros como Philips, LG, Teros, etc. no encontraban ningún producto (los tags reales eran `philips`, `lg`, `teros` en minúscula, pero los `value` de los filtros eran `PHILIPS`, `LG`, `TEROS` en mayúscula). Fix en `applyFilters`: matching case-insensitive + tolerancia a sufijos `_mon`/`_gam`/`_pc`/`_nb`/`_tec`/`_mou`/`_aur`/`_cam`/`_ext`/`_ref` (tags como `hp_mon` vs value `HP`) + fallback a regex del nombre siempre. Normalizados values a minúsculas (philips, lg, teros, asus, aoc, gamemax, eview, cx, dell, gigabyte, hikvision, hp, arkham, cooler_master, raptor, viewsonic, lenovo). Agregado filtro `Arkham` que faltaba. **Archivo:** `src/components/ui-custom/CategoryProducts.tsx`.

  (3) **Teclados-gamer — agregar filtros nuevos** — Antes: `/categoria/teclados-gamer` NO tenía ningún filtro definido. El dueño reportó que no podía filtrar por Redragon. Marcas verificadas contra los 32 productos visibles con stock: Redragon (9), Razer (7), ASUS (5), HyperX (3), Logitech (2), Netmak (3), Xtrike (1), Havit (1), Multilaser (1). Validado: 32/32 productos matchean al menos un filtro, sin overlaps. **Archivo:** `src/components/ui-custom/CategoryProducts.tsx`.

  (4) **Pendrives — agregar filtro ADATA** — 10 pendrives ADATA sincronizados desde Elit (7 con stock visible: UV240 32GB Red/White, UV240 64GB Black/Red/White, UV250 16GB/32GB). Antes no había filtro ADATA en pendrives, solo Kingston/Hiksemi/Lexar/SanDisk. **Bug secundario detectado:** el sync externo de Elit (`scripts/sync-elit-external.mjs` línea 213) NO crea productos nuevos, solo actualiza stock/precio de los existentes. Por eso los pendrives ADATA no aparecían — el dueño tuvo que hacer sync manual desde `/admin/proveedores` para que se crearan. Pendiente para futura sesión: modificar el sync externo para que cree productos nuevos automáticamente. **Archivos:** `src/components/ui-custom/CategoryProducts.tsx` (filtro), DB Turso (productos cargados vía sync manual).

  (5) **Editar items en pedidos** — Antes: no se podían editar los productos de un pedido (nombre, cantidad, precio). Ahora: nuevo endpoint `PUT /api/admin/order-items` (actualiza name/price/quantity de un item del pedido) + nuevo endpoint `DELETE /api/admin/order-items?id=X`. `PUT /api/admin/orders` ampliado para aceptar `total` (sobreescribir manualmente). `/admin/pedidos`: botón "Editar" por cada item + Dialog con nombre/cantidad/precio + checkbox "Recalcular automáticamente" (suma de price×quantity de todos los items) + campo "Total manual" si se desactiva el checkbox. Total calculado en tiempo real mientras se edita el form. **Archivos:** `src/app/api/admin/order-items/route.ts` (nuevo), `src/app/api/admin/orders/route.ts` (PUT ampliado), `src/app/admin/pedidos/page.tsx` (botón + Dialog + handlers).

  (6) **Footer — Powered by paulerostudio.com** — Texto discreto al lado del copyright en el bottom bar del footer: `© 2026 Compucity. Todos los derechos reservados. · Powered by paulerostudio.com`. Link a `https://www.paulerostudio.com/` con `target=_blank` y `rel=noopener noreferrer`. Hover verde compucity. **Archivo:** `src/components/layout/Footer.tsx`.

  **Notas:** TypeScript 0 errores en archivos tocados. No se tocó la DB (los pendrives ADATA ya estaban cargados vía sync manual de Elit). **Token GitHub temporal (ghp_...) usado para el push. Debe ser revocado.**

  **Pendientes detectados en esta sesión (no resueltos):**
  - 13 categorías habilitadas con productos visibles que NO tienen filtros definidos: auriculares-gamers (80), mouse-gamer (70), accesorios (39), proyectores (35), kits-oficina (20), componentes-de-pc (14), hubs (10), conversores (9), conectividad-y-redes (7), adaptadores-bluetooth (4), laser (27), combos (1), pc-armadas (82 — pero esta ya tiene filtros marca/procesador/RAM/GPU).
  - Sync externo de Elit no crea productos nuevos (solo actualiza existentes). Cada tanto hay que hacer sync manual desde el admin para traer productos nuevos.
  - 2 teclados mal categorizados como cables (`Alargue Teclado Din5 D5m-5m 1.80 M` y `Cable P/teclado Atx Mini-din 6m/6m 1.8 Mts` en cat=teclados, deberían estar en cables-y-adaptadores).
  - Pendrives ADATA tienen `brandId=NULL` (la detección automática de marcas no los agarró). Funciona igual porque el filtro usa regex del nombre, pero quedaría más consistente asignarles el brandId.

- **2026-07-07 (s51):** Search Redragon/Samsung + SODIMM en notebooks + edición de clientes en admin + filtro GPU dedicada. **Commits: 58d6710 (3 fixes iniciales) + 16d0cff (editar cliente desde pedidos + fix GPU) + 8b083ba (snapshot del pedido).** **5 fixes en esta sesión:**

  (1) **Search Redragon/Samsung** — Bug: `searchProducts()` en queries.ts intentaba primero LIKE 'query%' (prefijo) y solo si no había resultados hacía LIKE '%query%' como fallback. Como SQLite/Turso es case-insensitive, 'redragon%' encontraba los 3 productos que empiezan con "REDRAGON" y al haber >0 resultados NUNCA ejecutaba el fallback. Resultado: 3 de 26 productos Redragon visibles, 2 de 27 Samsung. Fix: una sola query con LIKE '%query%' + JOIN con `brands` para buscar también por marca (productos cuyo `brandId` es Redragon aunque el `name` no lo diga explícitamente). Validado contra Turso: 3→20 resultados para "redragon", 2→20 para "samsung". **Archivos:** `src/lib/queries.ts` (searchProducts reescrita), `src/app/api/search/route.ts` (autocomplete del navbar con misma lógica).

  (2) **SODIMM en notebooks** — Antes: subcategoría `memoria-ram-notebook` era hija de `memorias-ram`. Las SODIMM solo aparecían bajo `/categoria/memorias-ram`. Ahora: UPDATE directo en DB Turso (`UPDATE categories SET parentId = 'cat1' WHERE slug = 'memoria-ram-notebook'`) — la subcategoría es hija de notebooks. Modificación en `_getProductsByCategoryRaw` en queries.ts: cuando `slug === 'notebooks'`, NO incluye subcats en el listado principal (las SODIMM aparecen como pill "Memoria RAM Notebook" debajo de notebooks, pero no se mezclan con las notebooks en el listado principal). Las demás categorías mantienen comportamiento anterior. **Archivos:** `src/lib/queries.ts` (query notebooks especial), DB Turso (UPDATE categories).

  (3) **Edición de clientes en admin** — Antes: el admin solo podía ver y eliminar clientes, no editarlos. Ahora: nuevo método PUT en `/api/admin/customers` con validaciones (nombre obligatorio, email obligatorio + formato + unicidad). Botón "Editar" en `/admin/clientes` (al expandir un cliente, entre "Restablecer contraseña" y "Eliminar"). Dialog con todos los campos: nombre, email, teléfono, DNI, dirección, ciudad, provincia (dropdown con 24 provincias argentinas), CP. **Archivos:** `src/app/api/admin/customers/route.ts` (PUT nuevo), `src/app/admin/clientes/page.tsx` (botón + Dialog).

  (4) **Editar cliente desde panel de pedidos** — Antes: para editar los datos de un cliente vinculado a un pedido, había que ir a `/admin/clientes`, buscarlo, editarlo, volver a pedidos. Ahora: botón "Editar cliente" directo en `/admin/pedidos` (visible solo si `order.customerId` existe, es decir, cliente logueado al comprar). Abre el mismo Dialog que en `/admin/clientes`. GET `/api/admin/customers?id=X` agregado para cargar datos completos del cliente (el pedido solo tiene el snapshot customerName/Email/Phone/Dni). Al guardar: PUT a `/api/admin/customers` (actualiza el cliente) + PUT a `/api/admin/orders` (actualiza el snapshot del pedido con los nuevos datos — Opción A: siempre actualizar, así al recargar la página el pedido muestra el nombre nuevo). **Archivos:** `src/app/api/admin/customers/route.ts` (GET con ?id=), `src/app/api/admin/orders/route.ts` (PUT ampliado para aceptar customerName, customerEmail, customerPhone, customerDni, shippingAddress, shippingCity, shippingProvince, shippingZip), `src/app/admin/pedidos/page.tsx` (botón + Dialog + handlers + customerId en interfaz Order).

  (5) **Filtro GPU dedicada (HP Victus RX 6550M)** — Bug: la notebook HP Victus con RX 6550M no aparecía en el filtro "GPU dedicada" de `/categoria/notebooks`. Causa 1 (crítica): `src/app/(tienda)/categoria/[slug]/page.tsx` no pasaba el campo `tags` al componente CategoryProducts en el `.map()` de productos. Por eso, aunque el producto tuviera `tags: ["dedicated_gpu"]` en la DB, el componente los recibía como undefined y caía al fallback de regex del nombre. Fix: agregado `tags: (p as any).tags ?? []` en el map. Causa 2: `detectNotebookGPUType` y `isPcArmadasGamer` usaban el regex `/\bRADEON\s*RX\s*\d{4}/` que requiere la palabra "RADEON" antes de "RX". Pero HP nombra la placa como "RX 6550M 4GB" sin "RADEON". Fix: cambiado a `/\b(?:RADEON\s+)?RX\s*\d{3,4}/` (RADEON opcional, 3-4 dígitos para soportar GPUs mobile como RX 760M, RX 6550M). **Archivos:** `src/app/(tienda)/categoria/[slug]/page.tsx` (pasar tags), `src/components/ui-custom/CategoryProducts.tsx` (regex RX).

  **Validación:** TypeScript 0 errores en archivos tocados. Backup DB pre-fix: compucity_turso_backup_2026-07-06T23-08-35-689Z.json (57.92 MB, 10,035 filas, 16 tablas, 7,944 productos). **Token GitHub temporal (ghp_...) usado para todos los pushes. Debe ser revocado.**

- **2026-07-02 (s50):** Fix search vacío + columna currency fantasma. **Commits: 49f296d (debug endpoints) + ebbe217 (fix: remover currency de queries) + 1d08952 (search simplificado) + a561957 (search con precios correctos).** **Bug:** /api/search siempre devolvía `products: []` para cualquier término. **Causa raíz:** en la sesión 49, al cambiar `SELECT *` por columnas específicas en `queries.ts`, se incluyó `currency` que NUNCA existió en la tabla products de Turso. El `SQL_INPUT_ERROR: no such column: currency` era atrapado por `catch` que devolvía `[]` silenciosamente. La home funcionaba porque `unstable_cache` cacheaba resultados; el search no tenía cache. **Diagnóstico:** se crearon endpoints temporales `/api/debug-db` y `/api/debug-search` para probar queries directamente contra Turso. Confirmado: `PRAGMA table_info(products)` no tiene columna `currency`. La query directa `SELECT id, name FROM products WHERE name LIKE '%notebook%'` devuelve resultados; la query con `currency` falla. **Fix:** (1) Removida `currency` de 4 SELECTs en queries.ts. (2) Optimizado `/api/search/route.ts`: query directa + `calculateProductPrices` solo para 6 resultados (antes usaba `searchProducts()` con pipeline completo para 20 productos). **Resultado:** search de vacío → 6 resultados en 2.5s. **Lecciones documentadas:** regla #5 en SAFETY-RULES (verificar columnas contra DB real antes de SELECT específico). **Nota sobre s49:** los 4 commits de performance de s49 (1afabef, 56e8f76, 991788f, cee605e) incluían la columna `currency` en las queries, lo que rompió el search silenciosamente. El upgrade a Next.js 16.2.10 y el force-dynamic de la home NO fueron la causa del problema.
- **2026-07-02 (s49):** Performance fixes + Next.js 16.2.10 upgrade. **Commits: cee605e (revert proxy→middleware) + 991788f (force-dynamic home) + 56e8f76 (search timeout) + 1afabef (4 fixes críticos).** ⚠️ **Estos commits introdujeron el bug de la columna `currency`** (ver s50). Cambios: (1) Revertido middleware→proxy migration. (2) Home y sitemap cambiados a `force-dynamic` para evitar timeout en build. (3) Search timeout de 8s. (4) Next.js 16.2.10 upgrade (fix Vercel modifyConfig bug). (5) `.env` removido del repo. (6) Queries optimizadas con columnas específicas **(incluían `currency` que no existe — ver s50)**.
- **2026-07-02 (s48):** Navbar fijo + GPU notebooks + marcas fabricantes. **Commit: c0520b2.** **3 fixes aplicados:** (1) **Navbar links fijos** — reemplazado `categories.slice(0, 4)` por lista de slugs preferidos `PREFERRED_NAV_CATEGORIES = ['monitores', 'pc-armadas', 'notebooks', 'componentes-de-pc']`. El navbar ahora siempre muestra: Monitores → PC Armadas → Notebooks → Componentes de PC → Arma tu PC → Contacto. La categoría "Imagen" (existente en la DB como padre con enabled=1) nunca más aparece en el navbar. Antes dependía del orden de la DB y de qué categorías existieran. (2) **Filtro GPU notebooks arreglado** — el filtro "Con GPU dedicada" usaba regex `/\bRTX\b|\bGTX\b|\bRADEON\b/i && /\bNB\b|\bNOTEBOOK\b/i` que requería que el nombre tuviera "NB" o "NOTEBOOK" en mayúsculas. Muchas notebooks usan "Nb" (minúscula) o no incluyen la palabra, así que solo 4 matcheaban. Fix: eliminado el requisito de "NB|NOTEBOOK" ya que todos los productos en la categoría notebooks son notebooks por definición. Ahora muestra todas las notebooks con GPU dedicada. (3) **Marcas de notebooks sin Intel/AMD** — el sistema de detección de marcas (`brand-patterns.ts`) es category-agnostic y first-match-wins. Una notebook "Lenovo IdeaPad Core i5" matcheaba Intel antes que Lenovo. Resultado: Intel y AMD aparecían como marcas en el filtro de notebooks. Fix: agregado `HARDCODED_BRAND_CATEGORIES = new Set(['notebooks', 'gamer-y-diseno', 'pc-armadas'])` en CategoryProducts.tsx. En esas categorías se usan los filtros hardcodeados de fabricantes (Lenovo, HP, Dell, ASUS, MSI, Acer, CX, Kelyx) en vez de los dinámicos por brandId. El resto de las categorías sigue con marcas dinámicas. **Archivos modificados:** `src/components/layout/Navbar.tsx` (PREFERRED_NAV_CATEGORIES), `src/components/ui-custom/CategoryProducts.tsx` (GPU filter + HARDCODED_BRAND_CATEGORIES). **Backup:** compucity-backup-20260701-192505 (código + git history, sin DB local).
- **2026-06-30 (s47 dia 2):** Migración sincronización Elit+Invid a GitHub Actions. **Commits: 6f2006e (feat: migración) + d0d9131 (docs: worklog).** Backup: compucity_turso_backup_2026-06-30T15-33-05-751Z.json (54MB, 9750 filas, 7824 productos). **Causa:** el dueño reportó "Elit muestra sin stock algunos productos y en realidad no hay stock de Córdoba pero sí de Buenos Aires". SKU ejemplo: MSIMONM274CFX24. **Diagnóstico:** (1) API Elit devuelve 3 campos de stock: `stock_total`, `stock_deposito_cliente`, `stock_deposito_cd`. Para el SKU reportado: stock_total=38, stock_deposito_cliente=0, stock_deposito_cd=38. La API NO oculta info. (2) El cron de Vercel `0 6 * * *` NO se estaba ejecutando. Tabla `rate_limits` vacía. 21 productos Elit con stock=0 desde hace días aunque API reportaba stock. lastSyncAt de hace 8h pero muchos productos sin actualizar desde 16/6 (14 días). **Sync manual one-shot:** 309 productos actualizados (21 pasaron 0 → con stock, 6 con stock → 0, 56 cambios de precio). **Solución permanente:** migración a GitHub Actions. Nuevos scripts: `scripts/sync-elit-external.mjs` (con retry HTTP 3 intentos/30s) y `scripts/sync-invid-external.mjs` (con retry auth 3 intentos/30s). Workflow `.github/workflows/sync-elit-invid.yml` cron cada 6h (00:00, 06:00, 12:00, 18:00 UTC = 21:00, 03:00, 09:00, 15:00 AR). 4 secrets nuevos en GitHub: ELIT_USER_ID, ELIT_TOKEN, INVID_USER, INVID_PASS. `src/app/api/cron/sync/route.ts` limpiado (solo queda `revalidateTag('products')` como fallback manual). `vercel.json` removido el cron job. **Validación local:** Elit 1600 productos/2 updates/14.6s, Invid 5760 productos/17 updates/42.3s. **Validación GitHub Actions:** workflow_dispatch run 28455692930 → success. Elit 1600 productos/6 updates/5.6s, Invid 5761 productos/0 updates/15.2s, Auth OK intento 1/3. **Estado final de workflows GitHub Actions:** sync-air-intra.yml (cada 12h, s43), sync-elit-invid.yml (cada 6h, s47), sync-brands.yml (1 vez/día, s44). Costo $0 (GitHub free tier). Beneficio: GitHub manda mail si workflow falla, Vercel Hobby fallaba silenciosamente. **Pendiente usuario:** borrar cron manualmente del panel de Vercel → Settings → Cron Jobs si aparece (debería desaparecer solo con el deploy).
- **2026-06-30 (s47):** Implementación de las 6 funcionalidades pendientes del dueño + 3 hotfixes post-deploy + fix workflow Air Intra. **Commits: 3c61ec0 (feat: 6 pendientes) + 4c831e0 (fix TS ProductForm.internalTaxRate) + 79f8282 (fix workflow Air Intra retry login) + f6cb28b (script migración manual #27) + 1de2cd4 (fix /api/admin/upload restaurado).** **6 funcionalidades implementadas (commit 3c61ec0):** (1) QR AFIP en footer — HTML del dueño pegado en Footer.tsx, cambiado `http://` → `https://` para evitar contenido mixto. (2) Arma tu PC — slots de RAM y SSD/HDD ya no auto-avanzan; usuario debe clickear "Siguiente". Demás slots siguen con auto-avance. (3) Arma tu PC — filtro de Gabinetes con/sin fuente YA EXISTÍA (líneas 201-204 de arma-tu-pc/page.tsx), no requirió cambios. (4) Arma tu PC — botón "Sumar al carrito" agrega todos los componentes seleccionados al carrito (precio de lista). Notificación toast con link al carrito, sin redirección. (5) Sub-categorías de Monitores y Notebooks eliminadas — script scripts/move-subcats-to-parent.mjs ejecutado: 203 productos movidos a Monitores padre (4 subcats desactivadas con enabled=0), 286 a Notebooks padre (5 subcats desactivadas). Total: 9 subcats desactivadas, 489 productos movidos. Filtros ya existían. (6) Impuesto interno 10.5% — migración #27: columna `internalTaxRate REAL` en products (nullable, NULL=sin impuesto). Fórmula aditiva: `costPrice × (1 + IVA/100 + internalTaxRate/100) × (1 + markup/100) × dollarRate`. Selector en admin al lado del IVA. API SELECT/INSERT/PUT actualizadas. **3 hotfixes post-deploy:** (a) TypeScript error — el commit 3c61ec0 usaba `internalTaxRate` en form pero faltaba declararlo en `ProductForm`. Fix 4c831e0. (b) Migración #27 no aplicada en producción — db.ts solo corre migraciones en cold start, no se ejecutó. Síntoma: admin productos vacío. Fix: ALTER TABLE manual via scripts/migrate-add-internaltax.mjs. Commit f6cb28b. (c) /api/admin/upload borrado accidentalmente en merge — el commit 3c61ec0 incluyó un git rm que borró el endpoint de subida de imágenes (177 líneas). Síntoma: 404 al subir imágenes. Restaurado del commit 848c9f0. Commit 1de2cd4. **Fix workflow Air Intra (commit 79f8282):** el workflow .github/workflows/sync-air-intra.yml reportó "All jobs have failed" por mail. Diagnóstico: el endpoint /?q=login de Air Intra devuelve HTTP 404 transitoriamente (sin razón aparente, se auto-recupera en horas). El script moría al primer fallo. Fix: agregado retry en login (3 intentos, 30s entre cada uno). Maneja HTTP error, sin JSON, sin token, excepción. Validado con workflow_dispatch: success en 87.9s, 1 nuevo + 402 actualizados. **Backups:** compucity_turso_backup_2026-06-30T13-35-24-079Z.json (54MB, pre-deploy) + compucity_turso_backup_2026-06-30T14-25-15-134Z.json (54MB, post-deploy, 9744 filas, 7823 productos) + compucity_src_backup_2026-06-30.tar.gz (3.3MB, código fuente completo sin node_modules/.next/.git). **Lecciones aprendidas:** (1) Para migraciones críticas, no confiar solo en db.ts — aplicar manualmente ANTES del deploy que las necesita. (2) El pre-merge check debería validar que archivos críticos no se borren — agregar check en pre-push hook como tarea futura. (3) El script de GitHub Actions debe tener retry en el login para sobrevivir transient errors de Air Intra.
- **2026-06-25 (s46):** Optimización arquitectónica + prefetch fix + 6 pendientes del dueño documentados. **Commits: 121cdd6 (optimización arquitectónica) + 915c3fd (hotfix ProductCard) + 82edba9 (hotfix layout 500) + ef6c8f7 (hotfix CategoryProducts 500) + 7ce9a9c (prefetch=false).** **Cambios aplicados:** (1) Customer store con Zustand (evita re-fetch de /api/customer/me en cada navegación). (2) Storage listener filtrado por key (solo reacciona a customer_token, no a carrito). (3) PromoBanners con sessionStorage fix (escribía cache que antes no escribía, TTL 1h). (4) AbortController en RelatedProducts. (5) formatARS centralizado en lib/format.ts (1 instancia de Intl.NumberFormat compartida en 8+ archivos). (6) Eliminado fetch de /api/brands en Navbar (estaba oculto). (7) Navbar y Footer usan sessionStorage cache para /api/categories (TTL 1h). (8) prefetch={false} en ProductCard.tsx — BUG CRÍTICO: next.config.ts tiene experimental.prefetch: false pero Next.js 16.2.x ya no reconoce esa key. Resultado: Next.js hacía prefetch automático de 50 <Link> visibles en cada página de categoría = 10.000 prefetches/día = 33-83 min/día de Fluid CPU. Fix: agregar prefetch={false} individualmente en cada <Link> de ProductCard. **Hotfixes:** (1) ReferenceError: n is not defined en ProductCard.tsx — sed eliminó const formatPrice pero dejó el body suelto. (2) ReferenceError: n is not defined en CategoryProducts.tsx — mismo problema. (3) Layout async causaba 500 en /categoria/* — revertido a no-async. **Pendientes del dueño documentados (NO aplicados aún, requieren 1 deploy conjunto):** (1) QR AFIP en footer. (2) Arma tu PC: no avanzar automáticamente en RAM y Discos + botón Siguiente. (3) Arma tu PC: filtro de Gabinetes con Fuente. (4) Arma tu PC: botón "Sumar al carrito". (5) Eliminar sub-categorías de Monitores y Notebooks + agregar filtros. (6) Impuesto interno 10.5% en algunos monitores (campo individual, fórmula aditiva: costPrice × (1 + IVA/100 + impuestoInterno/100) × (1 + markup/100) × dollarRate). **Tokens temporales GitHub (ghp_...) y Vercel (vcp_...) siguen activos — deben ser revocados.**
- **2026-06-24 (s45 dia 2):** Fix IVA herencia monitores + fix cron Invid. **Commits: 0ccfa50 (fix cron Invid) + 167f8f6 (fix IVA DEFAULT 10.5).** Backup: compucity_turso_backup_s45-d2_2026-06-24.json. **Fix IVA (commit 167f8f6):** Bug crítico descubierto al investigar reporte del dueño: "En la categoría monitores está configurado el IVA global con 21% pero hay productos que tienen el 10.5%". Causa raíz: la columna `ivaRate` fue creada con `DEFAULT 10.5` (db.ts línea 224: `ALTER TABLE products ADD COLUMN ivaRate REAL DEFAULT 10.5`). Los INSERTs del sync (Air Intra, Invid, Elit) NO incluían `ivaRate`, así que SQLite les asignaba automáticamente 10.5 (el DEFAULT) en vez de NULL. Como `product.ivaRate = 10.5` (no NULL), `calculateProductPrices` usaba 10.5% individual y NUNCA consultaba la categoría (que tiene 21%). La herencia de categoría SÍ funcionaba correctamente (verificado con script de simulación: subcategorías de Monitores resuelven a 21%), pero el producto le ganaba por prioridad. Resultado: 74 productos en Monitores con IVA 10.5% en vez de 21%. Fix de datos: UPDATE directo en DB para setear ivaRate=NULL en los 74 productos de Monitores con ivaRate=10.5. Fix de código: agregado `ivaRate, NULL` explícito en los 9 INSERTs de sync (sync-air-intra-external.mjs: 1 INSERT, suppliers/sync/route.ts: 8 INSERTs). NOTA: Notebooks NO fue afectado (verificado). El DEFAULT de la columna NO se cambió (SQLite no soporta ALTER COLUMN DEFAULT). **Fix cron Invid (commit 0ccfa50):** Bug crítico descubierto al investigar reporte del dueño: "Invid hizo una rebaja en un procesador pero no se vio en nuestro sitio". El cron usaba campos equivocados para Invid: buscaba `p.codigo_alfa`, `p.precio`, `p.stock_total` (lowercase) pero la API de Invid devuelve `p.ID`, `p.PRICE`, `p.STOCK_STATUS` (uppercase). Resultado: 0 de 100 productos matcheaban → cron NUNCA actualizaba Invid automáticamente. Los productos solo se actualizaban con sync manual desde /admin/proveedores. Fix: `p.ID || p.codigo_alfa`, `p.PRICE || p.precio`, `parseInvidStock(p.STOCK_STATUS)` con mapeo "STOCK OK"→10, "BAJO STOCK"→3, "SIN STOCK"→0. Verificado: cron manual actualizó 413 productos Invid en 18s. Elit NO fue tocado (su API sí usa codigo_alfa, precio, stock_total — verificado con API real).
- **2026-06-24 (s45 dia 1):** QA Fase 1 + hotfixes + chatbots a Edge runtime. Sesión intensiva con múltiples fixes críticos. **Commits: 71186af (QA Fase 1) + 6e3b1d4 (hotfix 1) + 0496a3d (hotfix 2) + cce5e5e (Edge chatbots) + 0ccfa50 (fix cron Invid).** Backup pre-fix: compucity_turso_backup_s45_2026-06-24.json. **QA Fase 1 (commit 71186af):** (1) /api/generate-description movido a /api/admin/ + auth explícito (era público, cualquiera podía escribir a DB y disparar costos IA). (2) Credenciales Air Intra movidas a env vars (estaban hardcodeadas en enrich/route.ts). (3) /api/orders POST: validar precios y customerId server-side (antes confiaba en el cliente, posible fraude con total=$0). Recalcular precio con calculateProductPrices, validar cupón server-side, customerId desde cookie. (4) Rate limit en /api/customer/login (5 intentos/10min, antes sin limit, brute force posible). (5) Wrap orders POST en batch con verificación de rowsAffected (race condition en stock resuelta, cleanup automático si detecta conflicto). (6) Limpiar 132 console.log de producción en 5 archivos (suppliers/sync: 99, cron/sync: 17, enrich: 8, pc-assistant: 4, notebook-assistant: 4). Creado src/lib/logger.ts (debug/info no-op en prod, warn/error siempre). **Hotfix 1 (commit 6e3b1d4):** fix rowsAffected en orders POST. Bug crítico introducido en QA Fase 1: leía (result)?.response?.result?.affected_row_count (estructura de API HTTP de Turso) en vez de (result)?.rowsAffected (estructura de @libsql/client). Resultado: rowsAffected siempre era 0 → código pensaba que había race condition → abortaba y borraba TODOS los pedidos. Síntoma: "Stock insuficiente" en checkout aunque el producto tuviera stock. **Hotfix 2 (commit 0496a3d):** fix ORDER BY createdAt en order_items. Bug introducido en Round 2 (N+1 fix): agregué ORDER BY createdAt DESC a query de order_items, pero esa tabla NO tiene columna createdAt. SQL_INPUT_ERROR → Promise.all rechazaba → endpoint 500 → /admin/pedidos mostraba "No hay pedidos aún". El dashboard funcionaba porque usa /api/admin/stats (query diferente). **Round 8 (commit cce5e5e):** migrar 3 chatbots a Edge runtime (/api/pc-assistant, /api/notebook-assistant, /api/admin/generate-description). Edge Functions no consumen Fluid Active CPU (cuota separada: 1M/mes gratis). Refactorizado grok.ts: import dinámico de z-ai-web-dev-sdk (el SDK importa fs/path/os al inicio, rompe Edge). Verificado con endpoint de prueba /api/test-edge: Groq API funciona en Edge (292ms response). **QA Report completo:** 87 issues encontrados (9 críticos, 21 altos, 38 medios, 19 bajos). Fase 1 completada (6 fixes de seguridad + console.log). Fase 2 pendiente (N+1 fixes, fallback USD×1200, isActive filter, paginación admin/orders). Fase 3 pendiente (next/image, helpers duplicados, tipos any, componentes gigantes). **Token GitHub temporal (ghp_...) usado para todos los pushes.** **Token Vercel temporal (vcp_...) usado para verificar env vars.** Ambos deben ser revocados.
- **2026-06-23 (s44 dia 5):** Rounds 5-8 de Fluid CPU optimization + fix GH Actions. **Round 5 (commit 34c0833):** partir middleware — antes se ejecutaba en TODAS las rutas (storefront + admin + APIs), ahora SOLO en /admin/* y /api/admin/*. Reducción estimada: ~90% de ejecuciones de middleware eliminadas. Redirect vercel.app → dominio propio movido a next.config.ts. Bloqueo de Meta-ExternalAgent via redirects (has condition con User-Agent exacto). **Round 6 (commit 22b2e95):** revalidate=300 → 3600 (5min → 1h) en home y categorías. -80% regeneraciones de home y categorías. **Round 7 (commits d796742 + a5bcc89):** fix workflows GH Actions. actions/checkout@v4 → v5, actions/setup-node@v4 → v5, node-version: '20' → '22' (Node 20 deprecado). Agregado permissions: contents: read explícito. Fix sync-brands-external.mjs: toTursoValue() para convertir JS values al formato tagged que espera la API HTTP de Turso ({type: "text", value: "..."} en vez de string crudo). Sin este fix, Turso devolvía HTTP 400 "JSON parse error: invalid type: integer". Verificado: workflow sync-brands corrió OK (104 brands updated, 130 products con brandId asignado, 13.8s). **Round 8 (commit cce5e5e):** migrar 3 chatbots a Edge runtime. Verificado con endpoint de prueba que z-ai-web-dev-sdk funciona en Edge (vía import dinámico). Groq API funciona en Edge (292ms). Refactorizado grok.ts: sacado import estático de z-ai-web-dev-sdk (importa fs/path/os al inicio, rompe Edge), cambiado a import dinámico dentro de getZai() async.
- **2026-06-22 (s44 dia 3-4):** Rounds 1-4 de Fluid CPU optimization. **Round 1 (commit fbf5cb0):** brand re-detection movida a GitHub Actions (scripts/sync-brands-external.mjs + .github/workflows/sync-brands.yml). /api/image sin put() roto de @vercel/blob. /api/brands sin fetch localhost. init-brands con auth. debug-blob/env eliminados. **Round 2 (commit 321983a):** N+1 fixes en orders + checkout + pc-builder. cache getStoreConfigNumber. revalidate en /producto/[slug]. Cache-Control en /api/search y /api/admin/products. **Round 3 (commit 0e68b9c):** bugs PromoBanners (setLoading→setLoaded) + init-categories en 3 componentes (Navbar, Footer, CategoryIcons). N+1 customer/orders. auth en /api/admin/enrich. /api/validate-build eliminado. **Round 4 (commit bcb64c7):** s-maxage=31536000 en /api/image para cache CDN compartido. Rate limit 200→50 req/10s en middleware. Backup: compucity_turso_backup_2026-06-22T14-47-52-989Z.json (45 MB, 9,430 filas).
- **2026-06-22 (s44 dia 2):** Prefetch global off + Vercel Blob debug + fuentes re-agregadas. Commits: be54e77 (prefetch off en next.config.ts), 51ccc12 (sacar chequeo BLOB_READ_WRITE_TOKEN), fa7586b (debug error Blob), 5edda12 (simplificar subida Blob), d3230ed (API REST directa para Blob), e173a54 (debug-blob endpoint), 9fdf1e1 (agregar rubro 001-0556 FUENTES). Resumen: (1) Prefetch global desactivado via experimental.prefetch=false en next.config.ts. Antes 1 visita = ~20 prefetches serverless (~10s CPU), ahora 0 prefetches (~2s CPU, -80%). (2) Vercel Blob: el SDK @vercel/blob no funciona porque Vercel Hobby no crea BLOB_READ_WRITE_TOKEN automaticamente. Se intento API REST directa pero tampoco funciona. Las imagenes siguen sirviendose desde Turso pero con cache CDN HIT (x-vercel-cache: HIT), por lo que el consumo de CPU por imagenes es minimo despues de la primera carga. (3) Fuentes de Air Intra re-agregadas: rubro 001-0556 (FUENTES DE ALIMENTACION) agregado a ALLOWED_RUBROS y RUBRO_TO_CATEGORY. 163 productos traidos via GitHub Actions sync y asignados a categoria Fuentes. Total productos en DB: 7,767 (era 7,594, +173 por fuentes y otros). Backup: compucity_backup_s44-d2_2026-06-22T13-39-24.json (121 KB, 8,079 filas ref).
- **2026-06-19 (s43 dia 4 FINAL):** GitHub Actions sync + filtro de rubros + borrado productos + botón admin + cron Vercel optimizado. Commits: 0a479c0 (script sync), 4e43058 (workflow), 075be3d (fix turboBatch), 90bc230 (filtro rubros), 28dd082 (docs), 53ce0b2 (desactivar Air Intra en cron Vercel), b4f7849 (botón admin dispara GitHub Actions), 5f9e1e8 (sacar link GitHub del mensaje). Resumen completo: (1) Script scripts/sync-air-intra-external.mjs que corre en GitHub Actions sincronizando Air Intra → Turso directamente, sin Vercel. Corre cada 12h (21:00 y 09:00 Argentina). 4 secrets configurados en GitHub: TURSO_URL, TURSO_TOKEN, AIR_INTRA_USER, AIR_INTRA_PASS. Verificado: 7409 productos procesados, 1257 actualizados, 0 errores, 267s. (2) Workflow .github/workflows/sync-air-intra.yml creado y activo. GitHub Actions habilitado en el repo (estaba desactivado). Token con scope 'workflow' necesario. (3) Filtro de rubros: ALLOWED_RUBROS con 90 rubros extraídos del portal de Air Intra via agent-browser. Productos cuyo rubro NO está en la lista se saltan. (4) 3,406 productos inactivos BORRADOS de la DB. DB pasó de 11,000 a 7,594 productos (-31%). (5) Cron de Vercel modificado: solo sincroniza Elit + Invid (Air Intra desactivado). Reduce consumo Vercel CPU. (6) Botón 'Sincronizar' de Air Intra en /admin/proveedores ahora dispara GitHub Actions via API (endpoint /api/admin/suppliers/trigger-github-sync). Requiere env var GH_ACTIONS_TOKEN en Vercel. 0 Vercel CPU para sync Air Intra. (7) Mensaje del botón: 'Sync de Air Intra disparada en GitHub Actions. Va a tardar ~5 minutos.' (sin link a GitHub). Costo: $0 GitHub Actions (gratis, 270 min de 2000), $0 Vercel (sync Air Intra no consume CPU), $5.99 Turso. (1) Creado script scripts/sync-air-intra-external.mjs que corre en GitHub Actions (no en Vercel) sincronizando Air Intra → Turso directamente. Sin limite de 60s, sin consumir Vercel Fluid CPU. Corre cada 12h (00:00 y 12:00 UTC = 21:00 y 09:00 Argentina). 4 secrets configurados: TURSO_URL, TURSO_TOKEN, AIR_INTRA_USER, AIR_INTRA_PASS. Verificado: Run #2 completo en 267s, 7409 productos, 1257 actualizados, 0 errores. (2) Workflow .github/workflows/sync-air-intra.yml creado y activo. GitHub Actions habilitado en el repo (estaba desactivado). Token con scope 'workflow' necesario (generado por user). (3) Filtro de rubros: ALLOWED_RUBROS con 90 rubros extraidos del portal de Air Intra via agent-browser. Productos cuyo rubro NO esta en la lista se saltan en el sync. Excluidos: CAREPACK HP (563), REPUESTOS (1038), SERVICIOS (140), SOFTWARE (142), y otros. (4) 3,406 productos inactivos BORRADOS de la DB (no desactivados, borrados definitivamente). DB paso de 11,000 a 7,594 productos (-31%). 3,396 de Air Intra + 6 de Elit + 4 de Invid. Productos borrados eran los que no estaban en la lista de rubros permitidos del dueño. Commits: 0a479c0 (script), 4e43058 (workflow), 075be3d (fix turboBatch), 90bc230 (filtro rubros). Backup: compucity_turso_backup_s43-day3 (parcial, tablas chicas). Costo: $0 GitHub Actions (gratis, 270 min usados de 2000), $0 Vercel (no consume CPU), $5.99 Turso.
- **2026-06-18 (s43 dia 3):** SEO JSON-LD fixes + calculadora de cuotas admin. 5 commits: (1) e6971d4 fix(seo): JSON-LD con image/brand/shippingDetails/returnPolicy. Fix problemas reportados por Google Search Console: image ahora es URL absoluta (.jpg) en vez de /api/image/[id] (Google rechazaba URLs dinamicas); brand ahora usa la marca REAL del producto (antes usaba categoryName); SKU saneado sin espacios ni caracteres especiales; agregado mpn (Manufacturer Part Number); agregado shippingDetails (envio a Argentina 2-7 dias); agregado hasMerchantReturnPolicy (30 dias devolucion gratis); agregado itemCondition NewCondition. No se agregaron aggregateRating ni review (requieren sistema de resenas, Google los marca como no critico). (2) f6351cb fix(seo): agregar brandName al llamar getProductSchema en page.tsx. (3) 5cf3180 feat(admin): agregar link a Calculadora de Cuotas en el menu del admin con icono Calculator. (4) 81194ea feat(admin): calculadora de cuotas con CFT + planes editables en /admin/calculadora-cuotas. 2 columnas: izquierda calculadora (input precio + tabla agrupada por medio de pago con cuota/total/CFT), derecha configuracion de planes (tabla editable, agregar/editar/borrar, guardar en store_config). 14 planes preconfigurados: Efectivo, Naranja X (3/6/9/12), Visa (3/6/12), Mastercard (3/6/12), MercadoPago (3/6/12). CFT aproximado con formula TNA = recargo × (12/cuotas). (5) ce9c4e9 feat(admin): agregar sección de planes de cuota en /admin/configuracion con link a calculadora. Backup DB: compucity_turso_backup_s43-day3_2026-06-18T13-52-05.json (50 KB, tablas chicas + count de products/product_images — sin cambios en DB desde backup del 17/6). Commits totales sesion 43: 30.
- **2026-06-17 (s43 dia 2 FINAL):** Indices en products + middleware anti-scraping + Google Search Console. Commits 49477a1 y 98b9175. Cambios: (1) Creados 5 indices en Turso via script directo: idx_products_category_active_stock (categoryId+isActive+stock), idx_products_slug (slug), idx_products_providerId (providerId), idx_products_isActive_stock (isActive+stock), idx_categories_parentId (parentId). Verificados con EXPLAIN QUERY PLAN que se estan usando correctamente en todas las queries. Migracion #26 agregada a db.ts para futuras DBs. Impacto: queries por categoria pasan de escanear 10,960 filas a solo las relevantes (ej: motherboards 309 filas). Proyeccion: -40-60% en rows reads de queries por categoria. (2) Middleware con 3 capas de proteccion anti-scraping en src/middleware.ts: Capa 1 lista negra bots scrapers conocidos (AhrefsBot, SemrushBot, MJ12bot, DotBot, Baiduspider, YandexBot, PetalBot, Bytespider, Amazonbot) + bots ENTRENAMIENTO IA (CCBot, ChatGPT-User, Google-Extended, Anthropic-AI, AppleBot-Extended, Meta-ExternalAgent, AI2Bot, Cohere-AI, Diffbot, ImagesiftBot). Capa 2 lista blanca bots legitimos: Googlebot, Bingbot, DuckDuckBot, AppleBot, FacebookBot, TwitterBot, LinkedInBot, TelegramBot, WhatsApp, SlackBot, DiscordBot + bots RECOMENDACION IA (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot). Capa 3 verificacion IP Googlebot (rangos 66.249.x.x, 64.233.x.x, etc.) y Bingbot (40.77.x.x, 157.55.x.x, etc.) + rate limiting 30 req/10s por IP con bloqueo 1h. Distincion clave: bots ENTRENAMIENTO bloqueados, bots RECOMENDACION permitidos (ChatGPT/Claude/Perplexity pueden recomendar el sitio). Excepciones: /admin/*, /api/admin/*, /api/cron/*, archivos estaticos. Matcher ahora cubre TODAS las rutas menos estaticos y cron. (3) Google Search Console: sitio registrado con verificacion TXT en DonWeb DNS (google-site-verification=XG8WX3Udd0G3KsU8wMC2Dig5wuL74hQkWVrVYnMW2UA). Sitemap.xml enviado manualmente. Indexacion esperada en 1-2 semanas. Diagnostico: detectado en logs de Vercel 28 requests GET a /producto/[slug] en 4 segundos con User-Agent de Chrome (probable bot disfrazado crawleando PCs armadas). Eso explicaba el consumo alto de Turso (~10M en medio dia). Backup DB: compucity_turso_backup_s43-day2-final_2026-06-17T16-33-58-040Z.json (45 MB, 12,465 filas).
- **2026-06-17 (s43 dia 2 PARTE 3):** Optimizacion queries del listado de productos del admin. Commit 65df32b. Problema: el endpoint /api/admin/products hacia queries innecesariamente pesadas en CADA request (carga de pagina, cambio de filtro, ordenamiento, paginacion): COUNT(*) con JOIN a categories + suppliers SIEMPRE (aunque no haya busqueda) = ~22K rows reads por request. 2 SELECTs a categories + 1 SELECT a suppliers en cada request. Calculo recursivo de subcategorias hacia SELECT * FROM categories cada vez. Cada vez que el admin abria el listado o cambiaba de pagina = ~22K rows reads. Fixes aplicados: (1) COUNT sin JOIN cuando no hay busqueda activa (flag needsJoinForCount). (2) Cache en memoria 5 min para 4 funciones: getCachedCategories, getCachedCategoryMarkupRows, getCachedSuppliers, getCachedCategoryFilterList. Helper __clearAdminProductsCache() exportado para invalidacion. (3) Calculo subcategorias usa getCachedCategories (cache 5 min). (4) Invalidacion de cache automatica en /api/admin/categories POST/PUT/DELETE via __clearAdminProductsCache + revalidateTag('products') + revalidateTag('categories'). (5) Invalidacion de cache en /api/admin/suppliers POST/PUT/DELETE via __clearAdminProductsCache. Impacto: ~22K rows reads/request → ~200-500 rows reads/request (97% reduccion). Proyeccion: si admin se usa 10 veces/dia = -220K rows reads/dia = -6.6M/mes. Experiencia admin sin cambios: listado carga mas rapido, filtros/ordenamiento/paginacion igual, busqueda igual, edicion categorias/suppliers aparece instantaneamente. Sin perdida de informacion ni imagenes. Backup DB: compucity_turso_backup_s43-day2-admin-opt_2026-06-17T13-51-19-094Z.json (45 MB, 12,465 filas).
- **2026-06-17 (s43 dia 2) PARTE 2:** revalidateTag on-demand en admin + cron. Commit 767a8cf. Implementada Opción 2 de cacheo on-demand para resolver el delay de 5 min cuando admin o cron cambian productos. Cambios: (1) src/lib/queries.ts — 4 funciones envueltas con unstable_cache + tags ('products', 'categories'): getAllActiveProducts, getFeaturedProducts, getProductsByCategory, getProductBySlug. searchProducts NO se envuelve (query paramétrica, cache inútil con LIKE). TTL fallback 300s. (2) src/app/api/admin/products/route.ts — revalidateTag('products', 'default') después de POST/PUT/DELETE. (3) src/app/api/admin/suppliers/sync/route.ts — revalidateTag al final del sync manual. (4) src/app/api/cron/sync/route.ts — revalidateTag al final del cron diario. Verificado en producción: admin hace cambio → F5 → cambio aparece instantáneamente. Limitación: búsqueda sigue con delay 5 min (no se tocó). Compatibilidad: unstable_cache es API inestable pero standard en Next.js 16. revalidateTag requiere 2do arg 'profile' en Next.js 16 (usamos 'default'). Backups: 3 backups DB generados (12:58, 13:13 pre-cache, 13:25 final).
- **2026-06-17 (s43 dia 2):** Cache headers APIs publicas + fix bug sitemap + eliminar ensureTable. Commit 2ae068c. Detectado 58M rows reads en Turso el 17/6 (proyeccion mensual 1.7B = 70% del plan Scaler). Investigacion revelo 4 causas adicionales: (1) /api/image/[id] ejecutaba CREATE TABLE IF NOT EXISTS en cada request (~30K rows/dia desperdiciado). (2) Sitemap con bug WHERE active=1 (no existe, es isActive) — productos NUNCA aparecian en sitemap, Googlebot crawleaba ciegamente. (3) APIs publicas (/api/products, /api/related-products, /api/categories, /api/brands) sin cache headers → cada request = queries frescas. (4) Sitemap sin revalidate → cada pedido = 2 SELECTs. Fixes: eliminar ensureTable, agregar revalidate=3600 en sitemap + fix bug isActive, revalidate=300 + Cache-Control en /api/products y /api/related-products, revalidate=3600 + cache headers en /api/categories y /api/brands. Proyeccion: ~5-15M rows reads/dia = 6-18% del plan Scaler. Limitaciones: admin cambios en producto tardan hasta 5 min en APIs publicas (NO en detalle que sigue dinamico). Backup DB: compucity_turso_backup_s43-day2_2026-06-17T12-58-17-818Z.json (45 MB, 12,465 filas). Cron verificado funcionando: 2331 productos Air Intra actualizados + 1089 Elit en las ultimas 24h, airintra_cron_next_page=12, dolar Bluelytics $1454 actualizado hace 1 min.
- **2026-06-16 (s43):** Cron Air Intra chunked + cache Turso + paginacion + upgrade Scaler. 4 commits: (1) a7490d2 fix(cron-sync): Air Intra chunked rotation + delay + 403 retry. PAGES_PER_RUN=3, rotacion circular con airintra_cron_next_page en store_config, delay 1.5s, retry 30s en 403, time budget 50s. (2) 1289eac perf(turso): reduce rows reads 90% con LIMIT + cache + revalidate. Cache en memoria para getCategoryMarkupMap (TTL 5 min), revalidate=300 en home y categorias. (3) ec74b49 feat(catalog): paginacion client-side 50 productos por pagina. Botones Anterior/Siguiente + numeros de pagina con ellipsis. Reset automatico a pagina 1 al cambiar filtros. (4) Fix directo SKU 212937 (DDR4 8GB Hiksemi): costPrice $76.09 -> $58.24 (oferta 5% off Air Intra), stock 239 -> 287. Diagnostico: CRON_SECRET no estaba en Vercel (configurado por user), Turso al 103% del free tier (517M de 500M) -> upgrade a Scaler $5.99/mes (2.5B rows reads). Backup DB: compucity_turso_backup_s43_2026-06-16T21-13-37-462Z.json (45 MB, 12,460 filas). Documentada "Leccion aprendida sesion 43" en PROJECT_STATUS.md explicando los 4 supuestos erroneos que llevaron a subestimar el consumo Turso y la regla de oro para futuras estimaciones.
- **2026-06-13 (s42):** Backup completo + documentacion exhaustiva. (1) Backup DB Turso: compucity_turso_backup_2026-06-12T22-14-38-625Z.json (41MB, 16 tablas, 10,053 productos, 91 marcas). (2) Backup codigo fuente completo: compucity_src_backup_2026-06-13.tar.gz (101MB). (3) Backup codigo esencial: compucity_src_only_backup_2026-06-13.tar.gz (1.2MB). (4) Backup DB local: compucity_local_db_backup_2026-06-13.db (112KB). (5) PROJECT_STATUS.md completamente reescrito y actualizado con toda la documentacion del proyecto (42 sesiones). (6) SAFETY-RULES.md integrado como seccion del PROJECT_STATUS. Commit: a3ca817
- **2026-06-12 (s41):** SEO + GEO completo. Root layout OG/Twitter, product/category metadata dinamico, JSON-LD, sitemap, robots, 404, canonical URLs, admin noindex. Git tag: v-seo-optimized. Commit: c5b7458
- **2026-06-12 (s40):** Dominio propio + datos contacto + logos marcas fix + upload route fix. Commits: 277f323, 2649100, cefdf73, 69ead02, afdd330, 212bf9e
- **2026-06-11 (s39):** Sistema marcas + auto-deteccion + navbar Marcas oculto. Commits: 279002a, aa36ec0, 739901a, 5c4bfd0
- **2026-06-10 (s36):** Carrusel destacados. Commit: c399aed
- **2026-06-10 (s35):** Productos destacados + filtro admin. Commit: c399aed
- **2026-06-10 (s34):** Descripciones IA + subcategorias admin. Commits: b503412, 356084b, 5c3e610
- **2026-06-10 (s33):** Citi IA + Build Analyzer eliminado. Commit: bdaacbb
- **2026-06-09 (s31):** Filtros avanzados RAM/GPU/Notebooks + limpieza monitores. Commits: 29b90bf, 2f14b97, b1418bc, 7535f61, 89e5c65
- **2026-06-07 (s29):** Filtros heredados + marcas monitores + sync diario. Commits: varios
- **2026-06-07 (s27):** 8 mejoras + filtros desplegables + limpieza categorias. Commits: bd8b2af, e387267, 8e22577, f4e65c7, 0bda50d, 2a0fe2b
- **2026-06-07 (s26):** Stock por deposito CBA. Commit: b4c90a8
- **2026-06-16 (s43):** Revertir logica stock CBA - se vuelve a sumar todos los depositos. Fix SKU 212937 (DDR4 8GB Hiksemi). Diagnosticados: (1) CRON_SECRET no configurado en Vercel -> cron diario no se ejecuta. (2) syncAirIntraStock (cron) hace break en rate limit y no retoma, dejando paginas 2-15 sin actualizar. (3) PROJECT_STATUS.md desactualizado respecto a logica de stock.
- **2026-06-06 (s24):** Air Intra Batched Sync + vercel.json fix. Commits: d3e5fe9, dfafd1e
- **2026-06-06 (s23):** Cache dolar + server-side pagination. Commits: 0a9d109, e74ceca
- **2026-06-06 (s22):** FIX categorias + "Ingresado manualmente". Commit: 0e2d6d9
- **2026-06-05 (s21):** FIX CRITICO Air Intra sync - productos faltantes. Commits: da050a3, 3ed8b21, 2cf33b5
- **2026-06-05 (s16):** Multiples fixes admin + PC Builder. Commits: 0969b04, afe7c31, 5a55884, f794b1d, 15fcb9a
- **2026-06-05 (s15):** Fix SODIMM + PDF download. Commits: f6a94e9, af6b8a6
- **2026-06-05 (s14):** Filtros PC Builder + categorias tienda. Commits: e020dd3, 9d1979d, 2a3a11f
- **2026-06-05 (s13):** Fix filtros PC Builder (Network + Perifericos). Commit: 18121fb
- **2026-06-05 (s12):** Admin responsive + 3 slots PC Builder nuevos. Commits: fe67bc8, 99a1c89, 4224786
- **2026-06-05 (s11):** Homepage variedad de precios. Commit: 2aa6093
- **2026-06-04 (s10):** Herencia categoria padre (GLOBAL). Commits: varios
- **2026-06-04 (s9):** Fix IVA por categoria. Commits: varios
- **2026-06-03 (s8):** Sistema 3 niveles de markup. Commits: varios
- **2026-06-03 (s7):** IVA diferenciado + promociones + protecciones deploy. Commits: varios
- **2026-06-02 (s6):** Investigacion Andreani + propuesta IVA. Commits: varios
- **2026-06-02 (s5):** Prioridad imagenes + recategorizacion. Commits: varios
- **2026-06-02 (s4):** Fix busqueda productos. Commits: varios
- **2026-06-02 (s3):** Fix permanente categorizacion PC Builder. Commits: varios
- **2026-06-02 (s2):** Markup individual por producto. Commits: varios
- **2026-06-02:** Limpieza categorias Arma tu PC. Commits: varios
- **2026-06-01:** Selector cantidades PC Builder. Commits: varios
- **2026-06-01:** PC Armadas + filtro global stock. Commits: varios
- **2026-06-01:** Arma tu PC mobile + compatibilidad. Commits: varios
- **2026-05-27:** Filtro Air Intra + login clientes + Hero carrusel. Commits: varios
- **2026-05-27:** Deploy inicial, logo, favicon, paleta, navbar, footer
