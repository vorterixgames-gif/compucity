# Compucity - Project Status

**Ultima actualizacion:** 2026-06-24 (sesion 45 dia 2 - fix IVA herencia monitores + fix cron Invid + QA Fase 1 + hotfixes + chatbots a Edge runtime)

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
- **Commit estable:** 167f8f6 (fix(critical): ivaRate=NULL en INSERTs de sync — productos heredaban DEFAULT 10.5)
- **Commit actual:** 167f8f6
- **Git tag ultimo:** v-seo-optimized (commit c5b7458)
- **Credenciales admin:** admin@compucity.com / compucity2026
- **Sesiones totales:** 45
- **Plan Turso:** Scaler ($5.99/mes, 2.5B rows reads) - upgradeado sesion 43

## Stack Tecnologico
- **Framework:** Next.js 16.1 + TypeScript 6
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
| elit | Elit | ~844 | Full | Stock total unico |
| invid | Invid Computers | ~1,191 | Full | Stock total unico |
| (otros) | - | - | - | Proveedores con 0 productos |

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
- **Tablas (16):** products (~7,700), categories (73), brands (112), suppliers (6), orders (2), order_items (3), customers (3), product_images (1,548), dollar_rates (1), store_config (24), supplier_category_mappings (86), admins (1), banners (0), coupons (0), password_reset_tokens (2), rate_limits (1)

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

### Backups remotos (GoFile)
| Fecha | Tipo | Tamano | URL |
|-------|------|--------|-----|
| 2026-06-06 | DB completa (SQL) | 12 MB | https://gofile.io/d/Z32GBy |
| 2026-06-06 | Codigo fuente (tar.gz) | 931 KB | https://gofile.io/d/nAU3xx |

### Backup Git
- **GitHub:** https://github.com/vorterixgames-gif/compucity (repo completo)
- **Ultimo commit:** ce9c4e9 (feat: agregar sección de planes de cuota en configuración)
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

### 5. Proceso seguro para cambios
1. Hacer backup
2. Crear branch: `git checkout -b fix/nombre-del-cambio`
3. Hacer SOLO los cambios necesarios (ediciones puntuales)
4. Ejecutar safeguard: `bash scripts/pre-change-safeguard.sh`
5. Verificar build: `npx next build`
6. Commitear con mensaje descriptivo
7. Hacer push y verificar deploy

### 6. Paleta de colores aprobada (NO modificar)
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
