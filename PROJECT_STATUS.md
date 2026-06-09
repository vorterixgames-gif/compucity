# Compucity - Project Status

**Ultima actualizacion:** 2026-06-10 (sesion 37)

---

## Tienda Proyecto
- **Nombre:** Compucity - Tu Mundo Digital
- **Tipo:** E-commerce de informatica (sin pasarela de pagos, pedidos por WhatsApp)
- **Ubicacion:** La Falda, Valle de Punilla, Cordoba, Argentina
- **WhatsApp:** 3517656918
- **Estado:** EN PRODUCCION (Vercel auto-deploy desde GitHub main)
- **URL produccion:** https://my-project-eight-liard-96.vercel.app/
- **URL admin:** https://my-project-eight-liard-96.vercel.app/admin
- **Commit estable:** 2aa6093 (imagenes, arma-tu-pc orden, productos faltantes, nota 96hs)
- **Commit actual:** 4b844ed (safety: add critical files checker script + restore upload route)
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
- **Air Intra:** Todos los productos con precio > 0 se activan (igual que Invid/Elit). Si `allowedCategories` esta configurado (no null), se aplica como filtro adicional
- **Elit:** MANTIENE TODOS sus productos (notebooks, impresion, toners, UPS, etc.)
- **Invid Computers:** MANTIENE TODOS sus productos (notebooks, routers, switches, etc.)

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

### MEJORA sesion 26: Stock por deposito - Solo Cordoba cuenta
- **Problema:** Air Intra tiene 5 depositos (Buenos Aires, Lugo, Rosario, Cordoba, Mendoza). El sync sumaba el stock de TODOS los depositos, entonces un producto con 5 en BA y 0 en Cordoba mostraba "En stock" cuando no habia disponibilidad local
- **Solucion:** El campo `stock` ahora usa solo el stock del deposito de Cordoba (`cba`). Si no hay stock en Cordoba, el producto aparece como "Sin stock" en toda la tienda
- **Depositos de Air Intra:** `air` (Buenos Aires), `lug` (Lugo), `ros` (Rosario), `cba` (Cordoba), `mza` (Mendoza)
- **Nuevo campo DB:** `stockByWarehouse TEXT` - JSON con stock por deposito, ej: `{"air":5,"lug":0,"ros":2,"cba":0,"mza":0}`
- **Migracion:** #22 - `ALTER TABLE products ADD COLUMN stockByWarehouse TEXT`
- **Archivos modificados:** `src/lib/db.ts` (migracion #22), `src/app/api/admin/suppliers/sync/route.ts` (6 ubicaciones de totalStock cambiadas)
- **Elit:** Sin cambios - solo devuelve `stock_total`, no tiene desglose por deposito
- **Invid:** Sin cambios - no tiene datos de depositos
- **Frontend:** Sin cambios - el Filtro Global de Stock ya oculta productos con `stock <= 0`
- **Importante:** HAY QUE RE-SINCRONIZAR Air Intra para que el stock se actualice con la nueva logica. Hasta que se haga la sync, los productos existentes mantienen el stock total anterior

### Estado actual de productos (2026-06-10 sesion 37)
| Metrica | Cantidad |
|---------|----------|
| Total productos en DB | 10,102 |
| Activos | 9,843 |
| Inactivos | 259 |
| Con imagen | 4,572 |
| Sin imagen | 5,530 |
| Con categoria | 7,157 |
| Sin categoria | 2,945 |
| Con descripcion | 2,454 |
| product_images (tabla) | 859 |
| Categorias | 71 |
| Proveedores | 4 |
| Clientes | 2 |
| Admins | 1 |

**Backup:** download/backups/compucity_turso_backup_2026-06-09T21-13-36-177Z.json (31.3MB, 10 tablas)

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

## Sistema de Precios (Global + Categoría + Individual + IVA)

### Configuracion Global
- **Markup (margen de ganancia):** 15% (store_config: markup = 15)
- **Descuento efectivo:** 0% (store_config: cash_discount = 0)
- **IVA por defecto:** 10.5% (campo ivaRate en products, default 10.5)
- **Fuente dolar:** Banco Nacion (dolar_api) o Dólar Blue (configurable)
- **Cache dolar:** 15 minutos (Next.js revalidate + memoria admin). Antes era 1h/30min, reducido sesion 23 para info más actualizada
- **API externa:** DolarApi.com (dolarapi.com/v1/dolares/oficial o /blue)
- **Flujo cache:** Memoria (15 min) → DB → Next.js fetch cache (15 min) → API externa → Fallback 1415
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

### IVA Diferenciado (IMPLEMENTADO sesion 7, actualizado sesiones 9-10)
- **Campo products:** `ivaRate REAL` (nullable, NULL = heredar de categoria o default 10.5%)
- **Campo categories:** `ivaRate REAL` (nullable, NULL = usar default 10.5%)
- **Prioridad:** Producto individual → Categoría (con herencia padre) → Default (10.5%)
- **Herencia de categoría padre (GLOBAL, sesion 10):** Las subcategorías heredan ivaRate/markup/cashDiscount de su categoría padre si no tienen valor propio. Funciona en TODAS las categorías, no solo una específica
- **Distribucion actual:** 4,428 productos con ivaRate=NULL (heredan de categoria), 14 productos con IVA 21% individual
- **Categorias con IVA propio:** Notebooks=21%, Monitores=21%
- **Interfaz admin productos:** Selector IVA con opcion "Heredar de categoria → X%" (muestra valor heredado) + "10,5%" + "21%". Texto de ayuda: "Usando IVA X% de la categoría [nombre]"
- **Interfaz admin categorias:** Selector IVA con opcion "Default (10,5%)" + "10,5%" + "21%"
- **Columna IVA en tabla admin:** Muestra IVA efectivo con colores (violeta=categoría, morado=individual, gris=default)
- **Fix sesion 9:** Se corrigio que todos los productos tenian ivaRate=10.5 forzado (nunca heredaban de categoria). Ahora ivaRate=NULL en productos significa heredar de categoria
- **Fix sesion 10:** Herencia de categoría padre implementada - `getCategoryPricing()` recorre la cadena de padres (subcategoría → padre → abuelo...) para encontrar ivaRate/markup/cashDiscount. Aplica en frontend admin, backend queries (`getCategoryMarkupMap`), y API admin productos

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
Donde markup, cashDiscount e ivaRate siguen prioridad: Producto individual → Categoría (heredando de padre si no tiene) → Global/Default.

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
| peripherals | Periféricos | perifericos | No | 3 |

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
- **SODIMM (RAM notebook):** Excluidas del PC Builder (SODIMM en blacklist del slot RAM). No aparecen en la seleccion de componentes. Si alguna se colara, se marca como incompatible siempre (sin depender de motherboard seleccionada)

### Deteccion de Socket (FIX sesion 16)
- **Bug:** Intel Core Ultra 5 225F con "LGA1851" (sin espacio) en el nombre era detectado como Socket LGA 1700, bloqueando todas las mothers LGA 1851 compatibles
- **Causa raiz:** El regex `/\bS?1851\b/` no matcheaba "LGA1851" porque `\b` no detecta boundary entre "A" y "1" (ambos son word chars). Al fallar, el fallback asignaba "1700" por defecto a todos los Intel
- **Fix 1 - Regex:** Cambiado a `/(?:S|LGA\s*)?1851/` que matchea S1851, LGA 1851, LGA1851 y 1851 standalone. Mismo fix para 1700
- **Fix 2 - Intel Core Ultra:** Agregada deteccion por modelo: si el nombre contiene "CORE ULTRA", siempre se asigna socket 1851 (Arrow Lake). Se ejecuta antes del fallback a 1700
- **Archivos modificados:** `src/lib/compatibility.ts` (extractProcessorCompatibility + extractMotherboardCompatibility), `src/app/(tienda)/arma-tu-pc/page.tsx` (SLOT_FILTERS regex)
- **Aplica en:** Procesadores y motherboards, tanto en backend (compatibilidad) como frontend (filtros manuales)

### Proteccion de Slugs de Categorias (FIX sesion 16)
- **Bug:** Cambiar el nombre de una categoria usada en Arma tu PC (ej: "Memoria RAM" -> "Memoria RAM PC") rompia el PC Builder porque el slug se regeneraba automaticamente y las queries `SELECT id FROM categories WHERE slug = ?` fallaban
- **Fix:** API PUT `/api/categories` ya no auto-regenera el slug al cambiar el nombre. El slug solo se actualiza si se envia explicitamente en el body
- **Admin categorias:** Campo slug ahora editable manualmente con advertencia amarilla "No cambiar si se usa en Arma tu PC"
- **API POST (crear):** Sigue generando slug automaticamente del nombre (comportamiento normal)

### Ocultar Datos Internos de Productos (IMPLEMENTADO sesion 16)
- **Bug:** Las vistas publicas mostraban datos internos del proveedor como "Moneda DOL", "EAN", "GARANTIA" en las descripciones
- **Fix:** Se filtraron estos campos de las vistas de cliente (detalle de producto, tarjetas de catalogo). Solo se muestra la descripcion y el precio
- **Archivos:** API publica de productos, componente de detalle de producto

### PDF Download (IMPLEMENTADO sesion 15, MEJORA sesion 20, SEPARADO sesion 27)
- **Libreria:** jsPDF (client-side, no necesita server)
- **Cuando:** Boton separado "Descargar PDF" en Arma tu PC (ya NO se descarga automaticamente al tocar WhatsApp)
- **Contenido del PDF:**
  - Header con logo real de Compucity (imagen PNG, 55x22mm) a la izquierda
  - Fecha, hora y URL a la derecha del header
  - Separador verde debajo del header
  - Lista de componentes con slot, nombre, precio unitario y total
  - Precio de lista y precio en efectivo (destacado en verde)
  - Nota de 96 horas hábiles
  - Footer con datos de contacto y paginacion
- **Nombre del archivo:** `Compucity-PC-a-Medida.pdf`
- **MEJORA sesion 20:** Header del PDF reemplazado de texto (COMPU+CITY) a logo real de Compucity usando base64 encoding. Layout: logo izquierda + fecha/url derecha + separador verde
- **MEJORA sesion 27:** PDF y WhatsApp separados en botones distintos - "Descargar PDF" (oscuro) y "Consultar por WhatsApp" (verde). Desktop: botones separados en sidebar y paso final. Mobile: botones separados en barra sticky
- **Archivos:** `src/lib/compucity-logo-base64.ts` (logo en base64), `public/images/logo-compucity-pdf.png` (copia PNG)

### Sistema de Filtros Manuales (IMPLEMENTADO sesion 14, MEJORA sesion 28)
- **Filtros por categoria:** Cada slot tiene filtros relevantes que el usuario puede activar/desactivar
- **Logica:** AND entre grupos de filtros, OR dentro del mismo grupo
- **Auto-reset:** Los filtros se limpian automaticamente al cambiar de slot
- **UI:** Desplegables `<select>` dropdown (MEJORA sesion 28 - antes eran chips clickeables)
- **Funcion helper:** `extractCapacityGB()` - Parsea capacidad de almacenamiento desde nombres de productos (1TB, 256GB, 1.92TB, etc.)

| Slot | Filtros Disponibles |
|------|-------------------|
| Processor | Marca: AMD, Intel |
| Motherboard | Socket: AM4, AM5, LGA 1700, LGA 1851 · Memoria: DDR4, DDR5 |
| RAM | Memoria: DDR3, DDR4, DDR5 · **Capacidad: 4GB, 8GB, 16GB, 32GB, 64GB+** |
| GPU | Marca: NVIDIA, AMD, Intel Arc · **VRAM: 4GB, 6GB, 8GB, 10GB, 12GB, 16GB, 24GB** · **Serie: RTX 3050/3060/4060/4060Ti/4070/4070S/4070TiS/4080S/5060/5060Ti/5070/5070Ti/5080, RX 6600/6700/7600/7700/7800/7900, Arc A750/A770** |
| SSD | Marca: Kingston, WD, Hiksemi, ADATA/XPG, Lexar, Crucial, Memox, Samsung, MSI · Tipo: M.2/NVMe, SATA · Capacidad: Hasta 256GB, 480-512GB, 960GB-1TB, 2TB, 4TB+ |
| HDD | Marca: Seagate, WD, Toshiba · Capacidad: 1TB, 2TB, 4TB, 6-8TB, 10-12TB, 16TB+ |
| PSU | Potencia: Hasta 500W, 550-650W, 700-750W, 800-850W, 1000W+ |
| Cooling | Tipo: AIO/Liquida, Aire |
| Case | Tipo: Con Fuente, Sin Fuente |
| Monitor | Tamaño: 19", 22", 24", 27", 32"+ · Resolucion: Full HD, QHD, 4K/UHD · Frecuencia: 100Hz, 144Hz, 165Hz, 180Hz |
| Network | Tipo: PCIe, USB, WiFi 6/6E |
| Perifericos | Tipo: Mouse, Teclado, Auricular, Webcam, Microfono, Volante, Parlante, Joystick |

### Selector de Cantidades (MEJORA sesion 27 - discos multiples)
- RAM: 1 a 4 unidades (un solo producto)
- SSD: 1 a 4 unidades, **permite modelos diferentes** (ej: 1x SSD 500GB + 1x SSD 1TB)
- HDD: 1 a 2 unidades, **permite modelos diferentes**
- Los precios se multiplican automaticamente por la cantidad de cada disco
- WhatsApp muestra "2x Kingston 16GB DDR4 - $50.000 c/u = $100.000"
- **Comportamiento:** Seleccionar un SSD/HDD ya elegido incrementa la cantidad; seleccionar uno nuevo lo agrega como entrada separada con su propia cantidad +/- y boton eliminar

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
- **Homepage:** 3 secciones con variedad de precios (1 barato, 2 medios, 1 caro por seccion). Orden: Notebooks, Monitores, PCs (renombrado de "PC Armadas"). Funcion pickDiversePrices() en page.tsx
- **Keywords de deteccion:** PC LENOVO, PC KELYX, SIST., BAREBONE
- **Correcciones sesion 5:** 7 "PC Gamer Raptor" (eran gabinete+fuente, no PCs completas) movidas de gamer-pc a gabinetes. 4 Gabinete Raptor movidas de joysticks a gabinetes. 3 Switches TP-Link movidas de oficina-pc a switches
- **Correcciones sesion 22:** 23 switches "Desktop" movidos de PC Armadas a Switches. 1 antena TP-Link → Placas de Red. 1 escritorio → Escritorios. 2 adaptadores USB-C HDMI → Cables. 2 adaptadores TP-Link USB → Cables. 1 tensiómetro → Smart Home. Mapeo proveedor 001-0430 → Switches creado
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

### Filtros por Categoria en Tienda (IMPLEMENTADO sesion 14, ACTUALIZADO sesiones 27-28)
- **Componente:** `src/components/ui-custom/CategoryProducts.tsx`
- **Tipo:** Filtros desplegables `<select>` por grupo (marca, tipo, capacidad, tamaño, resolucion, frecuencia, Hz)
- **Config:** `CATEGORY_FILTERS` - define grupos de filtros y opciones por slug de categoria
- **Logica:** Single-select por grupo (elegir una opcion limpia la anterior). AND entre grupos, OR dentro del mismo grupo
- **Funcion helper:** `extractCapacityGB()` - Parsea capacidad de almacenamiento desde nombres de productos (1TB, 256GB, 1.92TB, etc.)
- **Nuevo grupo de filtro:** `capacity` (Capacidad) - disponible en discos-ssd, discos-hdd, discos-externos
- **Categorias con filtros (dropdown):**

| Slug | Filtros disponibles |
|------|-------------------|
| discos-ssd | Marca: 20 marcas (Kingston, WD, Hiksemi, ADATA/XPG, Lexar, Crucial, Memox, Samsung, MSI, Patriot, Seagate, Corsair, Kioxia, Silicon Power, Leven, PNY, SOLIDIGM, **SanDisk**, **Team Group**, **Biwin**) · Tipo: M.2/NVMe, SATA · **Capacidad: Hasta 256GB, 480-512GB, 960GB-1TB, 2TB, 4TB+** |
| discos-hdd | Marca: Seagate, WD, Toshiba · **Capacidad: 1TB, 2TB, 4TB, 6-8TB, 10-12TB, 16TB+** |
| discos-externos | Marca: ADATA, WD, Seagate, Kingston, Hiksemi, Crucial, Toshiba · **Capacidad: Hasta 512GB, 1TB, 2TB, 4TB+** |
| fuentes | Marca: Corsair, Seasonic, EVGA, Cooler Master, ASUS, Gigabyte, Gamemax, XPG · Potencia: Hasta 500W, 550-650W, 700-750W, 800-850W, 1000W+ |
| gabinetes | Marca: Corsair, Cooler Master, ThermalTake, Aerocool, DeepCool, Gamemax, ASUS, NZXT, Sentey, Naceb, Kelyx |
| refrigeracion | Marca: Corsair, Noctua, Cooler Master, DeepCool, Arctic, be quiet!, Gamemax, ASUS, XPG, Thermaltake, Kelyx · Tipo: AIO/Liquida, Aire |
| monitores | Marca: 15 marcas (Asus, LG, Dell, Gigabyte, AOC, Philips, Samsung, MSI, HP, Lenovo, Hikvision, Gamemax, Acer, BenQ, ViewSonic, CX) · Tamaño: 19", 22", 24", 27", 32"+ · Resolucion: Full HD, QHD, 4K/UHD · Frecuencia: 100Hz, 144Hz, 165Hz, 180Hz · **Herencia de subcategoria** |
| placas-de-red | Marca: TP-Link, Intel, ASUS, Cudy · Tipo: PCIe, USB, WiFi 6/6E |
| memorias-ram | Marca: 9 marcas · Memoria: DDR3, DDR4, DDR5 · **Capacidad: 4GB, 8GB, 16GB, 32GB, 64GB+** |
| microprocesadores | Marca: AMD, Intel |
| motherboards | Socket: AM4, AM5, LGA 1700, LGA 1851 · Memoria: DDR4, DDR5 |
| placas-de-video | Marca: Gigabyte, MSI, ASUS, NVIDIA, AMD, PNY, Intel Arc, **PowerColor**, **Sapphire**, **INNO3D** · **VRAM: 4GB, 6GB, 8GB, 10GB, 12GB, 16GB, 24GB** · **Serie: RTX 3050, RTX 3060, RTX 4060, RTX 4060 Ti, RTX 4070, RTX 4070 Super, RTX 4070 Ti Super, RTX 4080 Super, RTX 5060, RTX 5060 Ti, RTX 5070, RTX 5070 Ti, RTX 5080, RX 6600, RX 6700, RX 7600, RX 7700, RX 7800, RX 7900, Intel Arc A750/A770** |
| notebooks | Marca: 8 marcas (Lenovo, ASUS, HP, Dell, Acer, Gigabyte, MSI, Bangho) · **Procesador: Intel Core i3, Intel Core i5, Intel Core i7, Intel Core i9, Ryzen 3, Ryzen 5, Ryzen 7, Ryzen 9** · **RAM: 4GB, 8GB, 12GB, 16GB, 32GB, 64GB** · **Pantalla: 11-12\", 13-14\", 15-16\", 17\"+** · **Placa de Video: Sin GPU dedicada, RTX 3050/4050/4060/4070, RX 6600/7600** · **Herencia de subcategoria** |
| oficina | Marca: 5 marcas · **Procesador: Intel Core i3, Intel Core i5, Intel Core i7, Ryzen 3, Ryzen 5, Ryzen 7** · **RAM: 4GB, 8GB, 12GB, 16GB** · **Pantalla: 13-14\", 15-16\", 17\"+** · **Tipo: Notebook, Otro** |
| gamer-y-diseno | Marca: 7 marcas · **Procesador: Intel Core i5, Intel Core i7, Intel Core i9, Ryzen 5, Ryzen 7, Ryzen 9** · **RAM: 8GB, 16GB, 32GB, 64GB** · **Pantalla: 13-14\", 15-16\", 17\"+** · **Placa de Video: Sin GPU dedicada, RTX 3050/4050/4060/4070, RX 6600/7600** |

### MEJORA sesion 28: Filtros de capacidad + marcas faltantes + dropdowns PC Builder
- **Capacidad en SSD:** Hasta 256GB, 480-512GB, 960GB-1TB, 2TB, 4TB+ (funcion `extractCapacityGB` parsea 1TB, 256GB, 960GB, 1.92TB, etc.)
- **Capacidad en HDD:** 1TB, 2TB, 4TB, 6-8TB, 10-12TB, 16TB+
- **Capacidad en Externos:** Hasta 512GB, 1TB, 2TB, 4TB+
- **Marcas nuevas en SSD:** SanDisk, Team Group, Biwin
- **Regex mejorados:** Kingston (+A400/KC3000/KC600/DC600/NV3), ADATA/XPG (+GAMMIX/LEGEND/SPECTRIX/SU650/SU630), Lexar (+NM610/NM790/NQ100/NQ780), Crucial (+BX500/P310/E100), MSI (+SPATIUM), Patriot (+P300/P210), WD/HDD (+RED/PURPLE)
- **PC Builder:** Filtros convertidos de chips a desplegables `<select>`. SSD con marca+tipo+capacidad. HDD con marca+capacidad. Agregado `capacity` a keyLabels
- **Archivos:** `src/components/ui-custom/CategoryProducts.tsx`, `src/app/(tienda)/arma-tu-pc/page.tsx`

### MEJORA sesion 30: Filtros de marca para TODAS las categorias y subcategorias
- **Antes:** Solo 25 categorias tenian filtros definidos en `CATEGORY_FILTERS`. Muchas categorias con productos activos (cables, oficina, UPS, micro-sd, joysticks, etc.) no tenian filtros de marca
- **Despues:** TODAS las categorias con productos activos ahora tienen filtros de marca. Se agregaron 24 nuevas categorias a `CATEGORY_FILTERS`
- **Categorias nuevas con filtros:**
  - cables-y-adaptadores (9 marcas + tipo: Cable/Adaptador/Conversor/Hub)
  - oficina (5 marcas)
  - ups (5 marcas + VA: Hasta 1000VA/1000-2000VA/2000-3000VA/3000VA+)
  - memoria-ram-notebook (7 marcas + DDR3/DDR4/DDR5)
  - fundas-mochilas (4 marcas + tipo: Funda/Mochila)
  - micro-sd (5 marcas + capacidad: 32GB/64GB/128GB/256GB/512GB+)
  - hogar-inteligente (4 marcas + tipo: Camara/Alarma/Cerradura/Robot)
  - joysticks (8 marcas: Redragon, Genius, Cooler Master, Raptor, Logitech, Microsoft, Sony, Noganet)
  - cargadores (6 marcas + tipo: Notebook/Celular/Fuente)
  - sillas-gamer (5 marcas)
  - soportes-y-brazos (5 marcas + tipo: Monitor/TV/Notebook)
  - mousepads (4 marcas)
  - kits-gamer (4 marcas)
  - microfonos (7 marcas)
  - tablets (4 marcas)
  - escaneres (4 marcas + tipo: Escritorio/Portatil)
  - nas (3 marcas + tipo: 2 Bahias/4 Bahias)
  - pc-armadas (4 marcas)
  - smarts-tv (3 marcas + tamaño + resolucion)
  - bases (3 marcas)
  - escritorios (1 marca)
  - pastas-termicas (4 marcas)
  - sistema-continuo (4 marcas + tipo: Multifuncion/Impresora sola)
  - gabinete-con-fuente (6 marcas)
  - mini-pc (5 marcas)
  - oficina-pc (4 marcas + tipo: PC/AIO)
  - gamer-y-diseno (7 marcas)
- **Mejora perifericos:** Se agrego filtro de marca (7 marcas) a la categoria perifericos que antes solo tenia tipo
- **Herencia subcategorias:** Las subcategorias sin filtros propios siguen heredando del padre via `filterSlug` (ej: gamer-mon hereda de monitores)
- **Archivo modificado:** `src/components/ui-custom/CategoryProducts.tsx`

### MEJORA sesion 31: Filtros avanzados RAM/GPU/Notebooks + limpieza monitores
- **RAM capacidad:** Filtros de capacidad (4GB, 8GB, 16GB, 32GB, 64GB+) en memorias-ram y memoria-ram-notebook. Usa `extractCapacityGB()` con regex para GB en nombres de productos. Disponible en tienda y PC Builder
- **GPU VRAM + Serie:** Filtros de VRAM (4GB-24GB) y Serie (RTX 3050-5080, RX 6600-7900, Arc A750/A770) en placas-de-video. VRAM matchFn valida keywords GPU (RTX/GTX/RADEON) para no confundir con RAM de notebooks. Marcas nuevas: PowerColor, Sapphire, INNO3D
- **Notebooks filtros completos:** Procesador granular (i3/i5/i7/i9/Ryzen 3/5/7/9), RAM, pantalla, GPU en notebooks, oficina y gamer-y-diseno. Procesador usa matchFn por modelo para filtrar correctamente
- **FIX monitores:** 77 productos mal categorizados eliminados (TVs, notebooks, all-in-ones, proyectores, cables, soportes, camaras, etc.). Se agregaron 35+ reglas de exclusion en validate-categories y CATEGORY_CORRECTIONS del sync para prevenir que la sync de proveedores vuelva a contaminar la categoria
- **FILTER_GROUP_LABELS:** Nuevos labels: vram='VRAM', series='Serie', processor='Procesador', ram='RAM', screen='Pantalla', gpu='Placa de Video'
- **Archivos:** `src/components/ui-custom/CategoryProducts.tsx`, `src/app/(tienda)/arma-tu-pc/page.tsx`

### FIX sesion 29: Filtros heredados en subcategorias + marcas incorrectas en monitores + sync diario automatico
- **Bug filtros subcategoria:** Al seleccionar una subcategoria (Gamer, Diseño, Oficina) en monitores, los filtros de marca/tamaño/resolucion/frecuencia desaparecian. La causa era que `CATEGORY_FILTERS` se indexaba por `categorySlug` (ej: `gamer-mon`), pero solo existian definiciones para el slug padre (`monitores`).
- **Fix:** Se agrego `filterSlug` con logica de fallback: si el slug actual no tiene filtros definidos, usa el slug del `parentCategory`. Aplica a TODAS las categorias con subcategorias.
- **Bug marcas monitores:** Los filtros de Epson y Genius aparecian en monitores pero sus productos en esa categoria eran un soporte de proyector y una base para notebook, respectivamente (no monitores). KOORUI no tenia stock.
- **Fix:** Se eliminaron Epson, Genius y KOORUI de los filtros de monitores. Se agrego CX (marca real de monitores con 3 productos).
- **Bug React "Only plain objects":** Los objetos de la DB (con campos extra como image, parentId, etc.) se pasaban directamente como props a Client Components.
- **Fix:** Se limpiaron los objetos parentCategory y subcategories antes de pasarlos como props.
- **Bug productos Redragon sin stock:** El proveedor Elit no se sincronizaba desde el 1/6, entonces 26 productos Redragon con stock en la API mostraban stock=0 en el sitio.
- **Fix:** Se ejecuto sync manual de Elit (844 productos actualizados) y se actualizo el stock de los 28 productos Redragon.
- **MEJORA sync diario automatico:** Se creo endpoint `GET /api/cron/sync?secret=CRON_SECRET` que sincroniza stock/precios de Elit e Invid automaticamente. Configurado via Vercel Cron Jobs para ejecutarse todos los dias a las 6AM UTC (3AM Argentina). Variable de entorno `CRON_SECRET` requerida en Vercel.
- **Archivos modificados:** `src/components/ui-custom/CategoryProducts.tsx` (filterSlug fallback), `src/app/(tienda)/categoria/[slug]/page.tsx` (clean DB objects), `src/app/api/cron/sync/route.ts` (nuevo), `src/app/api/admin/suppliers/sync/route.ts` (export syncElit/syncInvid), `vercel.json` (cron config), `.env` (CRON_SECRET)

---

## Productos Destacados (IMPLEMENTADO sesion 35, MEJORA sesion 36)

### Funcionalidad completa
- **Campo DB:** `products.isFeatured INTEGER` (0 o 1, por defecto 0)
- **Query:** `getFeaturedProducts()` - Trae productos con `isFeatured = 1 AND isActive = 1 AND stock > 0`, max 8, ordenados por imagen primero y luego por fecha
- **Badge visual:** Badge verde "DESTACADO" en el ProductCard (solo si no esta en oferta)

### Seccion en la Home de la Tienda (MEJORA sesion 36 - Carrusel)
- **Ubicacion:** Despues de BrandLogos ("Trabajamos con las mejores marcas"), antes de CategoryIcons ("Explorá por Categoría")
- **Componente:** `src/components/ui-custom/FeaturedProductsCarousel.tsx` - Carrusel interactivo con Embla Carousel
- **Motor:** Embla Carousel con Autoplay (4s, se detiene al interactuar)
- **Navegacion:** Botones previo/siguiente + indicadores de puntos (dots) debajo
- **Responsive:** 2 cards en mobile, 3 en tablet, 4 en desktop
- **Loop infinito** para navegacion continua
- **Condicion:** Solo se muestra si hay productos destacados (`featured.length > 0`)
- **Estilo:** Fondo gradiente verde claro, badge "DESTACADO" en cada tarjeta
- **Antes (s35):** Grid estatico 2/3/4 columnas, ubicado despues de CategoryIcons

### Badge "DESTACADO" en ProductCard
- Se muestra en TODAS las vistas de la tienda (home, categorias, favoritos, relacionados)
- Prop `isFeatured` pasada a `<ProductCard>` en todos los componentes
- Logica: Se muestra solo si `isFeatured=true` Y no hay oferta activa (oferta tiene prioridad)

### Filtro en Admin Productos
- **Filtro "Destacado":** Dropdown con opciones Todos / Destacados / No destacados
- **Columna "Dest.":** En la tabla desktop muestra ★ (verde) para destacados, — para no destacados
- **Badge movil:** "★ Destacado" en la vista de tarjetas en mobile
- **API backend:** Parametro `featuredStatus` (featured/notFeatured) en `GET /api/admin/products`
- **Switch en formulario:** "Producto destacado" ya existia en el formulario de edicion

### Dashboard
- Muestra "X destacados" en las estadisticas del admin dashboard

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

## Admin Productos - Filtros y Ordenamiento (IMPLEMENTADO sesion 7, actualizado sesion 16)
- **Filtros por columna:** Busqueda por nombre, filtro por proveedor, filtro por categoria, filtro por estado (activo/inactivo), filtro por IVA (10.5%/21%), filtro por stock (con/sin)
- **Filtro "Sin categoria":** Opcion en el dropdown de categorias para encontrar productos sin categoria asignada (valor `"none"`)
- **Filtro por proveedor:** Columna y dropdown de proveedor en la tabla de productos
- **Filtro "Ingresado manualmente":** Opcion en el dropdown de proveedor para filtrar productos sin proveedor (creados manualmente, valor `"none"`)
- **Ordenamiento:** Click en encabezados de columna para ordenar asc/desc (nombre, costo USD, precio lista, stock, IVA, marca)
- **Indicadores visuales:** Flechas de ordenamiento, badges de filtro activo, contador de resultados
- **Limpiar filtros:** Boton para resetear todos los filtros y ordenamiento

### Seleccion Multiple y Eliminacion Masiva (IMPLEMENTADO sesion 16)
- **Checkboxes:** Cada fila tiene un checkbox para seleccionar productos. Checkbox "seleccionar todos" en el encabezado
- **Barra de acciones masivas:** Aparece cuando hay productos seleccionados, muestra la cantidad y boton "Eliminar"
- **Dialogo de confirmacion:** Muestra la cantidad de productos a eliminar antes de ejecutar
- **Eliminacion paralela:** Los DELETE se ejecutan en paralelo (Promise.all) para mejor rendimiento
- **Mobile:** Checkboxes tambien en las tarjetas de la vista movil

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
- `/admin/configuracion` - Config global (dolar, markup, Andreani)
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
- **Total con imagen:** ~4,000+ (en tabla products)
- **product_images:** 419 imagenes (WebP en DB)
- **Air Intra:** ~1,563 sin imagen (el API syp no devuelve imagenes)
- **Elit:** ~2 sin imagen (ya tienen WebP del API)
- **Invid:** 0 sin imagen (ya tienen imagenes del API)
- **Formato:** WebP (max 800px, calidad 75) almacenadas en tabla `product_images`
- **Endpoint:** `/api/image/[id]` - Sirve imagenes desde product_images
- **Cross-provider matching:** Sistema para copiar imagenes entre proveedores por brand+model
- **Scripts:** `scripts/enrich-images.mjs`, `scripts/batch-images.mjs`, `scripts/cross-provider-images.mjs`

---

## Base de Datos (Turso)
- **Host:** compucity-vorterixgames-gif.aws-us-east-1.turso.io
- **Tablas (14):** products (10,310), categories (65), suppliers (3), orders (0), order_items (0), customers (1), product_images (419), dollar_rates (1), store_config (20), supplier_category_mappings (86), admins (1), banners (0), coupons (0), password_reset_tokens (2)
- **Último backup:** backups/compucity-backup-2026-06-05.sql (24 MB)

### Limites y Uso de Plataformas (sesion 25)
| Plataforma | Recurso | Uso actual | Limite | % Uso | Estado |
|------------|---------|-----------|--------|-------|--------|
| **Turso** | Almacenamiento | 22 MB | 9 GB | 0.24% | Holgado |
| **Turso** | Filas leidas/mes | ~1M | 1B/mes | <0.1% | Holgado |
| **Turso** | Filas escritas/mes | ~100K | 25M/mes | <0.5% | Holgado |
| **Vercel** | Deploys/mes | ~20 | 100 | 20% | OK |
| **Vercel** | Ancho de banda | ~500 MB | 100 GB | <1% | Holgado |
| **Vercel** | Serverless ejecuciones | ~5K/dia | Ilimitado | - | OK |
| **Vercel** | Timeout serverless | 10s (default) / 60s (max Hobby) | 300s (Pro) | - | Ver nota |

**Nota Vercel timeout:** El plan Hobby limita las serverless functions a max 60s (`maxDuration` en vercel.json). El sync de Air Intra puede tardar 30-60+ segundos en modo full, por lo que se implemento batched sync (session 19) que divide en lotes de ~10-15s. Si se necesita mas de 60s por lote, se debe migrar a Vercel Pro ($20/mes, max 300s). Actualmente el batched sync funciona bien dentro del limite.

### Backups Remotos (GoFile)
| Fecha | Tipo | Tamano | URL |
|-------|------|--------|-----|
| 2026-06-06 | DB completa (SQL) | 12 MB | https://gofile.io/d/Z32GBy |
| 2026-06-06 | Codigo fuente (tar.gz) | 931 KB | https://gofile.io/d/nAU3xx |

**Nota:** Los backups locales se guardan en `/home/z/my-project/download/backups/`. Los archivos SQL son muy grandes para GitHub (24 MB), por eso se suben a GoFile como alternativa de descarga.

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
| 2026-06-10 (s37) | `compucity_turso_backup_2026-06-09T21-13-36-177Z.json` | 31.3MB | DB completa (10 tablas, 10,102 productos) + chatbot notebooks + fix upload route |
| 2026-06-09 (s31) | `compucity-src-backup-20260609-s31.tar.gz` | ~1.2MB | Filtros avanzados RAM/GPU/Notebooks + limpieza monitores + exclusiones sync |
| 2026-06-06 (s22) | `compucity-src-backup-20260606-s22.tar.gz` | ~1.1MB | Filtro proveedor manual + fix categorias (switches/routers en PC Armadas) + 30 productos recategorizados |
| 2026-06-05 (s20) | `compucity-src-backup-20260605-s20.tar.gz` | ~1.1MB | Logo real en PDF del PC Builder + base64 encoding |
| 2026-06-05 (s19) | `compucity-src-backup-20260605-s19.tar.gz` | ~14MB | Sync robusto Air Intra - verificacion doble + post-sync check |
| 2026-06-05 (s18) | `compucity-src-backup-20260605-s18.tar.gz` | ~7.6MB | Air Intra sync error handling + rate limit detection |
| 2026-06-05 (s17) | `compucity-src-backup-20260605-s17.tar.gz` | ~860KB | Air Intra isActive fix + batch sync + diagnostic script |
| 2026-06-05 (s16) | `compucity-src-backup-20260605-s16.tar.gz` | 858KB | Codigo src con socket detection fix, bulk delete, slug editable, specs ocultos |
| 2026-06-05 (s15b) | `compucity-src-backup-20260605-s15b.tar.gz` | 967KB | Codigo src con PDF download en Arma tu PC |
| 2026-06-05 (s15) | `compucity-src-backup-20260605-s15.tar.gz` | 852KB | Codigo src con fix SODIMM excluido del PC Builder |
| 2026-06-05 (s14c) | `compucity-src-backup-20260605-s14c.tar.gz` | 237KB | Codigo src con fix filtros Componentes de PC (sin filtros genericos en parent) |
| 2026-06-05 (s14b) | `compucity-src-backup-20260605-s14b.tar.gz` | 258KB | Codigo src con filtros en categorias tienda |
| 2026-06-05 (s14) | `compucity-src-backup-20260605-s14.tar.gz` | 255KB | Codigo src con filtros manuales en PC Builder |
| 2026-06-05 (s12) | `compucity-src-backup-20260605-s12.tar.gz` | 842KB | Codigo src + config con admin productos responsive |
| 2026-06-05 (s11) | `compucity-code-backup-20260605.tar.gz` | 1.6GB | Codigo completo con homepage variedad de precios (eliminado por espacio) |
| 2026-06-04 (s10) | `compucity-db-backup-2026-06-03T20-16-00-610Z.json` | 10.2MB | DB completa (14 tablas, 4,428 productos, logo nuevo sin fondo) |
| 2026-06-04 (s10) | `compucity-code-backup-20260603-201606.tar.gz` | 844KB | Código con nuevo logo (68px, hover scale-110, fondo blanco footer) |
| 2026-06-04 (s9) | `compucity-db-backup-2026-06-03T16-45-38-744Z.json` | 8.9MB | DB completa (14 tablas, 4,459 productos, IVA por categoría, ivaRate=NULL en productos) |
| 2026-06-04 (s9) | `compucity-code-backup-20260603-164530.tar.gz` | 832KB | Código con IVA por categoría + orden por precio ascendente |
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
1. **Re-sincronizar Air Intra:** El stock por deposito (solo Cordoba) se implemento en sesion 26 pero los productos existentes mantienen el stock total anterior. HAY QUE RE-SINCRONIZAR para que el stock se actualice con la nueva logica
2. **Verificar categorizacion en TODAS las categorias:** Se corrigieron 66+ productos en sesion 27, pero puede haber mas productos mal categorizados que no se detectaron. El usuario reporto productos incorrectos en Notebooks y Monitores. Revisar cada categoria sistematicamente
3. **Credenciales Andreani:** El dueño debe proporcionar codigoCliente + contratoDomicilio
4. **Cargar imagenes faltantes:** ~5,532 productos sin imagen (mayormente Air Intra). Busqueda IA falló en produccion. Pendiente alternativa viable
5. **Crear banners y cupones:** Las tablas estan vacias, el dueño puede empezar a crear promociones desde `/admin/promociones`

### Citi - Asistente IA de Compucity (IMPLEMENTADO sesion 32, ACTUALIZADO sesion 33)
**Estado:** EN PRODUCCION

#### Asistente IA - Chat Flotante "Citi"
- **Nombre:** Citi (de Compu**CITY**)
- **Boton flotante:** "Arma tu setup" (verde Compucity, posicionado abajo a la derecha)
- **Componente:** `src/components/pc-assistant-chat.tsx`
- **API:** `POST /api/pc-assistant` → Groq (LLM) + DB de productos → 3 configs de PC
- **Flujo:** Pregunta uso (gaming/trabajo/diseño) + presupuesto → genera 3 opciones (Economica, Recomendada, Premium) → usuario carga una al builder
- **Estetica:** Colores Compucity green (no purple/indigo), Sparkles icon
- **Compatibilidad automatica:** Socket (CPU->Mother), DDR (Mother->RAM), Wattaje (GPU->PSU)
- **Budget profiles:** gaming (32% GPU), oficina (0% GPU), edicion (20% GPU), general (18% GPU)
- **Prompt conservador:** Solo marca cuellos de botella EXTREMOS (Celeron + RTX 4070+, 4GB RAM gaming)
- **Feature flag:** `ai_enabled` en store_config para habilitar/deshabilitar

#### Build Analyzer (ELIMINADO sesion 33)
- **Razon:** Redundante con el filtrado automatico de compatibilidad + el asistente Citi genera configs balanceadas
- **Eliminado:** API `/api/validate-build` (609 lineas), boton "Analizar con IA", panel de resultados, upgrade cards
- **Problema previo (FIX sesion 32):** Loop infinito donde IA recomendaba upgrade → usuario lo seleccionaba → IA volvia a detectar bottleneck → recomendaba otro upgrade. Solucionado con prompt conservador + estado frontend que preservaba analisis al aplicar upgrades

#### Descripciones Automaticas de Productos (IMPLEMENTADO sesion 34)
- **Boton batch:** "Descripciones IA" en barra superior de admin productos
- **Boton individual:** Icono "IA" por producto en la tabla
- **API:** `POST /api/generate-description` → z-ai-web-dev-sdk (primary) / Groq (fallback)
- **Resultado:** 2,454 descripciones generadas (de ~10,100 productos totales)
- **Prompt:** Genera descripcion en español, SEO-friendly, a partir del titulo + specs tecnicas del producto
- **SDK:** z-ai-web-dev-sdk configurado via env vars (ZAI_BASE_URL, ZAI_API_KEY, etc.), no usa config file
- **Groq fallback:** Si ZAI falla, intenta con Groq API (GROQ_API_KEY en .env.local)
- **Nota:** Groq API key original expiro, reemplazado por z-ai-web-dev-sdk como primario

#### Busqueda de Fotos IA (REMOVIDO sesion 34)
- **Razon:** Ninguna estrategia funciono de forma confiable en Vercel
- **Estrategias intentadas:**
  1. `page_reader` (z-ai-web-dev-sdk) → errores 502 constantes
  2. `fetch()` directo a e-commerce → 403 bloqueado por Cloudflare
  3. Google Images via web_search → sin URLs de imagen en resultados
  4. Microlink.io → funciona en test local pero timeout en Vercel (12s por call)
  5. AI image generation → no funciono en produccion (posible timeout SDK)
- **Botones removidos:** "Fotos IA" (batch) + "Foto" (individual por producto)
- **API route conservada:** `/api/admin/suppliers/enrich-images` para uso futuro

#### Costos
| Concepto | Costo mensual |
|----------|--------------|
| Vercel | $0 (ya lo usan) |
| Turso | $0 (consultas extra insignificantes) |
| LLM (z-ai-web-dev-sdk) | $0 (incluido) |
| **Total** | **$0** |

### Media Prioridad
6. **Recuperacion de contrasena por email:** El endpoint `/api/customer/forgot-password` existe pero necesita configuracion de servicio de email (Resend)
7. **Verificar compatibilidad en Arma tu PC:** Testing exhaustivo del sistema de compatibilidad
8. **Configurar markup/descuento individual:** Empezar a usar el feature nuevo en productos que lo necesiten
9. **Correo Argentino:** Credenciales todas NULL en store_config, sin API de envio funcional

### Baja Prioridad
10. **Optimizar imagenes:** Los thumbnails del catalogo podrian usar tamano reducido
11. **SEO:** Meta tags, sitemap dinamico, structured data
12. **Limpiar claves duplicadas en store_config:** slogan/whatsapp estan duplicados con store_slogan/whatsapp_number

### Tareas Completadas (sesion 27)
- ~~**Discos multiples en PC Builder:**~~ RESUELTO - SSD/HDD permiten modelos diferentes con cantidad individual
- ~~**Gabinetes con Fuente en PC Builder:**~~ RESUELTO - Slot gabinete incluye subcategoria gabinetes-con-fuente
- ~~**Auto-avance en PC Builder:**~~ RESUELTO - Seleccionar un componente avanza al siguiente slot (excepto SSD/HDD)
- ~~**Separar PDF de WhatsApp:**~~ RESUELTO - Botones independientes para cada accion
- ~~**Remover stock visible en tienda:**~~ RESUELTO - Solo overlay "Sin stock" permanece
- ~~**Filtros desplegables de marca:**~~ RESUELTO - <select> dropdowns en 7 categorias
- ~~**Fix imagenes al editar producto:**~~ RESUELTO - Null guards en parsing de images

---

## Sesion 37: Chatbot de Notebooks + Fix Upload Route + Seguridad

### Chatbot de Notebooks "Citi" (IMPLEMENTADO)
- **Componente:** `src/components/notebook-assistant-chat.tsx` - Chat flotante con asistente IA que recomienda 3 notebooks segun uso y presupuesto
- **API:** `POST /api/notebook-assistant` - Busca notebooks en DB, genera 3 opciones (Economica, Recomendada, Premium)
- **Banner:** `src/components/ui-custom/NotebookChatBanner.tsx` - Banner verde en pagina de categorias de notebooks con CTA "Chatear ahora"
- **Categorias:** Aparece en notebooks, gamer-y-diseno, oficina (definido en NOTEBOOK_CATEGORIES)
- **Colores:** Compucity green (no blue/indigo como estaba originalmente)
- **Integracion:** Seleccionar una notebook recomendada la agrega al carrito

### FIX: Ruta /api/admin/upload borrada accidentalmente
- **Bug:** El commit `5dbc2b4` ("docs: update PROJECT_STATUS.md") borro accidentalmente `src/app/api/admin/upload/route.ts`, rompiendo la subida de imagenes en el admin por ~2 dias
- **Error:** `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` - El fetch esperaba JSON pero Next.js devolvia HTML 404
- **Impacto:** No se perdieron imagenes existentes (las que ya estaban en product_images siguen intactas). Solo fallaron los intentos de subida nueva
- **Fix:** Se restauro la ruta desde git history (`git show 1f07bf6:src/app/api/admin/upload/route.ts`) con autenticacion de admin y limpieza de referencias al eliminar
- **Commit:** 8515626

### Seguridad: Script de verificacion de archivos criticos
- **Script:** `scripts/check-critical-files.mjs` - Verifica que 20 archivos criticos existan antes de deployar
- **Comando:** `npm run check:critical` para ejecutar la verificacion
- **Lista de archivos:** Rutas API (upload, products, banners, categories, auth, enrich, seed, stats, dollar, image, cron), componentes (ImageUploader, WhatsAppIcon), lib (db, admin-auth)
- **Commit:** 4b844ed

### Mejoras UX en arma-tu-pc
- **Sidebar desktop:** Botones "Consultar por WhatsApp" y "Descargar PDF" apilados verticalmente (antes lado a lado, se salian del margen en sidebar w-80)
- **Jerarquia:** WhatsApp es boton principal (verde, mas grande), PDF es secundario (gris claro)
- **WhatsApp button:** z-40, se mueve arriba cuando detecta barra sticky via MutationObserver
- **Chatbot panels:** z-[60] (por encima de sticky bars z-50 y WhatsApp z-40)
- **Mobile:** Botones compactos, posicionados para no solaparse con WhatsApp y barra sticky

### Pagina /elige-tu-notebook eliminada
- El chatbot ahora vive directamente en la pagina de categoria de notebooks (no en pagina separada)
- Slide 2 del hero actualizado: CTA va a `/categoria/notebooks` en vez de `/elige-tu-notebook`
- CTA secundario va a `/categoria/gamer-y-diseno`

---

## Historial de Cambios
- **2026-06-10 (s36):** Carrusel de Productos Destacados + reubicacion en homepage + backup DB. (1) Seccion "Productos Destacados" convertida de grid estatico a carrusel interactivo con Embla Carousel + Autoplay (4s). Componente nuevo: `FeaturedProductsCarousel.tsx`. (2) Reubicacion: movida de despues de CategoryIcons a entre BrandLogos y CategoryIcons. (3) Carrusel: loop infinito, botones prev/next, dots indicadores, responsive 2/3/4 cards. (4) Backup DB: download/backups/compucity_turso_backup_2026-06-09T19-04-13-436Z.json (31MB, 15 tablas). Commit: c399aed
- **2026-06-10 (s35):** Productos Destacados activado en tienda + filtro/columna en admin + backup DB. (1) Seccion "Productos Destacados" en la home de la tienda: se muestra despues de CategoryIcons, grid 2/3/4 columnas, solo si hay destacados. Badge verde "DESTACADO" en cada ProductCard. (2) Prop isFeatured pasada a TODOS los ProductCard de la tienda (home, categorias, favoritos, relacionados). (3) Filtro "Destacado" en admin productos: dropdown Todos/Destacados/No destacados, columna "Dest." con ★ en tabla desktop, badge movil. API backend soporta parametro featuredStatus. (4) Backup completo de DB Turso: download/backups/compucity_turso_backup_2026-06-09T18-34-51.json (34MB, 15 tablas, 10,100 productos).
- **2026-06-10 (s34):** Descripciones IA funcionando + subcategorias en filtro admin + fotos IA removidas. (1) FIX Descripciones IA: Reemplazado Groq (API key expirada) por z-ai-web-dev-sdk como proveedor primario. ZAI usa env vars (ZAI_BASE_URL, ZAI_API_KEY, etc.) en vez de config file. Groq queda como fallback. Resultado: 2,454 descripciones generadas exitosamente. (2) Intento de busqueda de fotos IA: Se probaron 5 estrategias (page_reader, fetch directo, Google Images, Microlink.io, AI generation) pero ninguna funciono de forma confiable en Vercel. Botones "Fotos IA" y "Foto" removidos del admin. API route conservada para futuro. (3) Filtro subcategorias: El dropdown de categoria en admin productos ahora muestra subcategorias indentadas con └ debajo de cada categoria padre. Permite filtrar por subcategoria especifica. Dropdown mas ancho (w-56). (4) Limpieza: import Camera, estados enrichImages/handleEnrichSingleImage removidos. Commits: b503412, 356084b, 5c3e610
- **2026-06-10 (s33):** Citi IA: asistente renombrado + boton Arma tu setup + Build Analyzer eliminado. (1) Boton flotante: renombrado de "Asistente IA" a "Arma tu setup". (2) Nombre del asistente: renombrado a "Citi" (de Compucity). Se presenta como "¡Hola! Soy Citi de Compucity". Header del chat muestra "Citi". (3) Prompts backend: system prompt y descripciones de builds ahora dicen "Sos Citi" en vez de "Sos un asistente". (4) Build Analyzer eliminado: API /api/validate-build (609 lineas), boton "Analizar con IA", panel de resultados, upgrade cards. Solo queda Citi como asistente IA. (5) Fix previo sesion 32: loop infinito de recomendaciones IA solucionado con prompt conservador + estado frontend. (6) Estetica: todos los colores purple/indigo reemplazados por Compucity green. Commit: bdaacbb
- **2026-06-09 (s31):** Filtros avanzados para RAM, GPU y Notebooks + limpieza monitores + exclusiones sync. (1) RAM: Filtros de capacidad (4GB/8GB/16GB/32GB/64GB+) en memorias-ram y memoria-ram-notebook (tienda + PC Builder). (2) GPU/Placas de Video: Filtros de VRAM (4GB-24GB) y Serie (RTX 3050-5080, RX 6600-7900, Arc A750/A770) en placas-de-video y PC Builder GPU slot. Marcas nuevas: PowerColor, Sapphire, INNO3D. VRAM matchFn valida que el producto sea GPU (keywords RTX/GTX/RADEON) para no confundir con RAM de notebooks. (3) Notebooks: Filtros completos de procesador (i3/i5/i7/i9/Ryzen 3/5/7/9), RAM, pantalla y GPU en notebooks, oficina y gamer-y-diseno. Procesador usa matchFn granular por modelo. (4) FIX MONITORES: 77 productos mal categorizados eliminados (TVs, notebooks, all-in-ones, proyectores, cables, soportes, etc.). 35+ nuevas reglas de exclusion en validate-categories + sync CATEGORY_CORRECTIONS para prevenir recurrencia. La sync de proveedores ya no volvera a contaminar la categoria monitores. Commits: 29b90bf, 2f14b97, b1418bc, 7535f61, 89e5c65
- **2026-06-07 (s27):** 8 mejoras + filtros desplegables + limpieza masiva categorias. (1) PC Builder: SSD/HDD permiten multiples modelos diferentes (cada disco con su propio +/- y eliminar). (2) PC Builder: Gabinete incluye subcategoria "Gabinetes con Fuente" (additionalCategorySlugs). (3) PC Builder: Auto-avance al siguiente slot despues de seleccionar (excepto SSD/HDD que permiten agregar mas). (4) PC Builder: PDF y WhatsApp separados en botones distintos. (5) ProductCard: Removido indicador de stock visible al publico (solo queda overlay "Sin stock" cuando stock<=0). (6) Filtros: Monitores agrega 19", 22", 100Hz, 144Hz, 165Hz, 180Hz. (7) Filtros desplegables: Marcas convertidas de pills a <select> dropdowns en discos SSD, HDD, fuentes, gabinetes, refrigeracion, monitores y placas de red. (8) Fix bug: Editar producto de proveedor causaba que la imagen desapareciera (parsing de images con null guards). (9) LIMPIEZA MASIVA CATEGORIAS: 66 productos mal categorizados corregidos (cables/fans en Monitores, chargers/baterias en Notebooks, PCs completas en Discos SSD, etc.). 40+ nuevas reglas de correccion automatica en sync y validate-categories para prevenir futuras miscategorizaciones. Commits: bd8b2af, e387267, 8e22577, f4e65c7, 0bda50d, 2a0fe2b
- **2026-06-07 (s26):** Stock por deposito Cordoba (cba) - sin stock local = sin stock en tienda. (1) Nuevo campo DB: `stockByWarehouse TEXT` en products (migracion #22). Guarda JSON con stock por deposito de Air Intra: `{"air":5,"lug":0,"ros":2,"cba":0,"mza":0}`. (2) Sync Air Intra: `stock` ahora usa `cba.disponible` en vez de sumar todos los depositos. Si no hay stock en Cordoba, el producto aparece como "Sin stock". 6 ubicaciones de totalStock modificadas en route.ts. (3) Elit e Invid sin cambios (no tienen datos por deposito). (4) IMPORTANTE: Hay que re-sincronizar Air Intra para actualizar el stock con la nueva logica. Commit: b4c90a8
- **2026-06-07 (s25):** Actualizacion PROJECT_STATUS.md con analisis de limites Vercel/Turso, backups remotos GoFile, y documentacion completa de sesion 25. Sin cambios de codigo. Commit: 561c898
- **2026-06-06 (s24):** Air Intra Batched Sync implementado + vercel.json maxDuration corregido. (1) Batched sync: divide sincronizacion en lotes de 4 paginas (~2,000 productos, ~10-15s por lote). Frontend orquesta lotes automaticamente con barra de progreso. Backend: syncAirIntraBatch() + syncAirIntraFinalize(). (2) vercel.json: maxDuration corregido de 300 a 60 (Hobby plan limita a 60s). Commits: d3e5fe9, dfafd1e
- **2026-06-06 (s23):** Cache del dólar reducido + server-side pagination admin + backup. (1) FIX cache dolar: Next.js revalidate reducido de 1h (3600s) a 15 min (900s) en `src/lib/dollar.ts`. Cache en memoria admin reducido de 30 min a 15 min en `src/app/api/admin/products/route.ts`. API externa (DolarApi.com) ahora se consulta max cada 15 min en vez de 1h. Flujo cache: Memoria (15 min) → DB → Next.js fetch cache (15 min) → API externa → Fallback 1415. (2) Server-side pagination en admin productos (commit 0a9d109): payload reducido de ~10MB a ~50KB, filtros/ordenamiento/paginacion ejecutados en SQL server-side, cache dolar en memoria para admin. (3) Backup DB: `backups/compucity-backup-2026-06-05.sql` (24 MB, 10,310 productos, todas las 14 tablas). Commits: 0a9d109, e74ceca
- **2026-06-06 (s22):** Filtro "Ingresado manualmente" en proveedor + FIX masivo de categorias. (1) Admin productos: opcion "Ingresado manualmente" en dropdown de Proveedor para filtrar productos sin proveedor (providerId vacio/nulo). (2) FIX categoria DESKTOP: keyword "DESKTOP" era demasiado generico en CATEGORY_KEYWORD_MAP, causando que switches "Desktop Switch" (ej: Switch 5P Tp-link Tl-sg1005d Gigabit Desktop) se categorizaran como PC Armadas. (3) Reordenamiento: SWITCH y ROUTER movidos al Grupo 1 (antes de PC Armadas) para que se detecten primero. (4) "DESKTOP" reemplazado por "DESKTOP PC" (mas especifico). (5) Nuevas correcciones automaticas: SWITCH→switches, ROUTER→routers-wifi, TP-LINK→placas-de-red, ESCRITORIO→escritorios, ANTENA→placas-de-red, USB-C HDMI→cables, ADAPTADOR TP-LINK USB→cables, TENSIOMETRO→smart-home, HIKVISION→switches. (6) DB: 30 productos recategorizados (23 switches + 1 antena + 1 escritorio + 2 USB-C HDMI + 2 adaptadores TP-Link + 1 tensiómetro). (7) Mapeo proveedor 001-0430 → switches creado para Air Intra. Commit: 0e2d6d9
- **2026-06-05 (s21):** FIX CRITICO Air Intra sync - Productos faltantes resuelto. (1) BUG PRINCIPAL: La paginación se detenía prematuramente cuando el JSON corrupto causaba que una página devolviera <500 productos, haciendo que el sync creyera que era la última página. El endpoint `syp` solo tenía ~4,500 productos y faltaban categorías. (2) Cambio de endpoint `syp` → `articulos`: Ahora usa el endpoint `articulos` que tiene 7,499 productos (vs 4,500 de syp) e incluye datos de categoría (rubro, grupo), garantía, tipo y estado. (3) Fix paginación: Ya no se detiene por `products.length < pageSize`. Ahora usa MAX_PAGES (30) + detección de página vacía. (4) Retry logic: Hasta 2 reintentos por página fallida. (5) Batch DB operations: Pre-load de productos existentes en memoria, INSERT/UPDATE en paralelo (concurrencia 20). (6) Script standalone: `sync-air-intra-direct.mjs` para sync directo a Turso sin pasar por API route. (7) Resultado: Air Intra pasó de 1,702 a 7,511 productos (7,324 activos). Commits: da050a3, 3ed8b21, 2cf33b5
- **2026-06-05 (s16):** Multiples fixes y features de admin + PC Builder. (1) Bug #3: Filtro "Sin categoria" en admin productos - opcion para encontrar productos sin categoryId asignado (valor `"none"`). (2) Feature: Seleccion multiple y eliminacion masiva de productos - checkboxes en cada fila, select all, barra de acciones, dialogo de confirmacion, DELETE paralelo. (3) Bug #4: Cambiar nombre de categoria rompia PC Builder - el slug se regeneraba automaticamente, rompiendo las referencias hardcodeadas. Fix: API PUT ya no auto-regenera slug, campo slug editable en admin categorias con advertencia "No cambiar si se usa en Arma tu PC". (4) Feature: Ocultar datos internos de productos (Moneda DOL, EAN, Garantia) de las vistas publicas - solo se muestra descripcion y precio al cliente. (5) Bug #5: Socket detection - Intel Core Ultra 5 225F detectado como LGA 1700 en vez de LGA 1851. Causa: regex `/\bS?1851\b/` no matcheaba "LGA1851" (sin espacio). Fix: regex cambiado a `/(?:S|LGA\s*)?1851/`, + deteccion por modelo (CORE ULTRA = LGA 1851 siempre). Commits: 0969b04, afe7c31, 5a55884, f794b1d, 15fcb9a. Backup src (858KB)
- **2026-06-05 (s15):** Fix SODIMM + PDF download en Arma tu PC. SODIMM movido de BUILDER_INCLUDE_PATTERNS a BUILDER_EXCLUDE_PATTERNS del slot RAM (ya no aparecen en el PC Builder). PDF download: al hacer clic en cualquier boton de WhatsApp del Arma tu PC, se genera y descarga un PDF profesional (jsPDF client-side) con branding Compucity (header verde, COMPU+CITY, tagline), fecha, lista de componentes con precios, total de lista y efectivo, nota 96hs, footer con contacto. Los 3 botones (desktop ultimo paso, sidebar, mobile sticky) ahora descargan PDF + abren WhatsApp. Icono Download agregado. Commits: f6a94e9, af6b8a6
- **2026-06-05 (s14):** Filtros en PC Builder + Categorías tienda + fix. PC Builder: chips clickeables para filtrar productos (Processor: AMD/Intel, Motherboard: Socket+DDR, RAM: DDR3/4/5, GPU: NVIDIA/AMD/Intel Arc, SSD: NVMe/SATA, PSU: 500W+/650W+/750W+/850W+, Cooling: AIO/Aire, Monitor: Tamaño+Resolución, Network: PCIe/USB/WiFi6, Periféricos: Mouse/Teclado/Auricular/etc.). Categorías tienda: mismos filtros en CategoryProducts para 11 categorías. FIX: eliminados filtros genéricos de "Componentes de PC" (Procesador/Motherboard/RAM/GPU/SSD/Fuente) que eran redundantes con las subcategorías - los filtros ahora solo aparecen al seleccionar una subcategoría específica (ej: DDR3/4/5 en Memorias RAM, AMD/Intel en Microprocesadores). Network blacklist: +AP GIGABIT, WALL MOUNT, CEILLING, MINIHUB, OUTDOOR, INDOOR, ISP. Commits: e020dd3, 9d1979d, 2a3a11f
- **2026-06-05 (s13):** Fix filtros PC Builder para Placas de Red y Periféricos. Network: agregados P.REDW/PREDW/ARCHER T/P.RED para incluir placas reales, removidos TP-LINK/WIFI/WIRELESS/PCI-E amplios que matcheaban cámaras IP y sistemas Mesh. Exclusiones nuevas: CAMARA, DECO, MESH, TAPO C, CPE, RANGE EXTENDER, A SD, A HDMI, A DISPLAYPORT, CONTROLLER, CLOUD, JBL. Fix 'AP ' que matcheaba 'ADAP' falsamente (removido). Fix 'HUB' → 'HUB ' para no excluir 'Minihub' en adaptadores Ethernet. Removido RJ45 del exclude (aparece en adaptadores Ethernet legítimos). Periféricos: agregados WEB CAM, VOLANTE, WHEEL a include. Removidos 'CABLE' y 'ADAPTADOR' amplios del exclude (catcheaban "Mouse c/Cable", "Teclado con Cable", "Auricular gaming cableado"). Reemplazados con patterns específicos: CABLE KELYX, CABLE HDMI, CABLE DISPLAY, ADAPTADOR HDMI, ADAPTADOR VGA, etc. Renombrado "Periférico" → "Periféricos". Resultado: Network pasa de 16 (con cámaras/mesh) a 19 productos correctos (solo placas/adaptadores reales). Periféricos pasa de 393 a 418 productos (ahora incluye mouse/teclados cableados, webcams, volantes). Commit: 18121fb
- **2026-06-05 (s12):** Admin productos responsive + Arma tu PC 3 slots nuevos. Admin: vista de tarjetas en movil (block lg:hidden) con info apilada y tabla solo en desktop (hidden lg:block). Fix archivo truncado por disco lleno. Arma tu PC: 3 slots nuevos (Monitor max 2, Placa de Red/WiFi max 1, Periferico max 3), todos opcionales. Iconos: Monitor, Wifi, Mouse. Whitelist/blacklist patterns para cada slot nuevo. GPU cambio icono a Gamepad2, Fuente a Plug. Commits: fe67bc8, 99a1c89, 4224786. Backup src (842KB)
- **2026-06-05 (s11):** Homepage variedad de precios - 3 secciones (Notebooks, Monitores, PCs) con 4 productos cada una y variedad de precios (1 barato, 2 medios, 1 caro). Orden cambiado a Notebooks primero, Monitores segundo, PCs tercero. "PC Armadas" renombrado a "PCs". Funcion pickDiversePrices() en page.tsx pide 20 productos y selecciona 4 con variedad. IMPORTANTE: commit estable 2aa6093 (si se rompe algo, hacer `git reset --hard 2aa6093`). No tocar queries.ts ni layouts - solo page.tsx
- **2026-06-04 (s10):** Herencia de categoría padre implementada (GLOBAL) - Las subcategorías heredan ivaRate/markup/cashDiscount de su categoría padre si no tienen valor propio. `getCategoryPricing()` recorre la cadena de padres (subcategoría → padre → abuelo...). Aplica en frontend admin (selector IVA, preview, tabla), backend queries (`getCategoryMarkupMap`), y API admin productos. Admin productos: selector IVA muestra "Heredar de categoría → X%" con valor heredado, texto de ayuda "Usando IVA X% de la categoría [nombre]", columna IVA con colores. Fix: `interface Category` ahora incluye `ivaRate`. Categoría Monitores configurada con IVA 21%. Backups completos (código 838KB + DB 10.2MB)
- **2026-06-04 (s9):** Fix IVA por categoría - La columna ivaRate no existía en tabla categories (migración #21 nunca se ejecutó en Turso). Se agregó manualmente. Se corrigió que todos los productos tenían ivaRate=10.5 forzado (4,445 productos actualizados a NULL para que hereden de categoría). Admin productos: selector IVA ahora tiene opción "Heredar de categoría" en vez de forzar 10.5%. API productos: ivaRate vacío ahora guarda NULL en vez de 10.5. Fórmula preview muestra IVA heredado correctamente. Categoría Notebooks configurada con IVA 21%. Orden por defecto cambiado a precio ascendente (más baratos primero) en categorías, búsqueda y todos los productos. Backups completos (código 832KB + DB 8.9MB)
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
