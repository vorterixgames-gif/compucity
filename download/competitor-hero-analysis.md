# Competitor Hero Section Analysis - Argentine Tech Stores
## Comprehensive report for hero section redesign

---

## 1. FULLH4RD (fullh4rd.com.ar)

### Hero Layout Structure
- **Full-width auto-playing carousel** (custom JS, not Swiper/Owl)
- 7 rotating banner slides, each linking to a category/product page
- Desktop: `1920×504` style banners (based on viewport structure)
- No sidebar or split layout — pure full-width banner carousel
- Smooth `translateX` transitions with `400ms` duration

### Visual Elements
- **7 Banner slides** — all are full-width promotional banner images:
  1. Kingston products → `/kingston`
  2. Razer gamer chairs → `/tag/silla%20gamer_razer`
  3. MSI MAG Pano case → specific product page
  4. RTX video cards → `/tag/placa%20de%20video_rtx/mayor`
  5. Kingston (repeat) → `/kingston`
  6. Logitech G325 headset → specific product page
  7. AMD products → `/amd`
- All images served as `<picture>` with `<source>` elements (responsive)
- No text overlay on banners — all text is baked into the banner images
- No visible CTA buttons separate from the banner graphics

### Text/Copy
- All alt text is generic: "Banner principal" — no descriptive alt text
- Headlines and copy are embedded in the banner images themselves (not HTML text)
- No overlay text, no HTML-rendered headlines over the carousel

### Promotional Elements (Below Hero)
- **"Promociones bancarias"** section immediately below hero:
  - Galicia Bank: 3 cuotas sin interés (Wed/Fri)
  - BBVA: 3 cuotas sin interés (Fri/Sat)
  - Galicia: 25% reintegro Thursdays + 12 cuotas tasa preferencial
- Brand logos: Galicia, BBVA (with SVG icons)
- **Top nav bar** includes: "Armá tu PC" prominent link, brand logos (HyperX, GeForce, AMD, Astro, Logitech, Intel, Kingston, NVIDIA, ASUS, MSI)

### Design Approach
- Clean, modern Tailwind CSS design (`tw:` prefix classes)
- Dark header with brand logo bar
- Gray background sections below hero (`tw:bg-[#efefef]`)
- Full product card sections follow: "Full Ofertas", "Destacados", "Las mejores marcas"
- Professional, content-dense layout
- **Key differentiator**: Pure image-based banners, no HTML text overlays

---

## 2. COMPRAGAMER (compragamer.com)

### Hero Layout Structure
- **Full-width auto-playing carousel** (Angular SPA, custom implementation)
- 5 rotating banner slides with responsive images
- Uses `<picture>` elements with 4 responsive breakpoints (1200px, 992px, 768px, 576px)
- Carousel has dot navigation (clickable indicators)

### Visual Elements
- **5 Banner slides** (from browser snapshot):
  1. **"Notebooks - Nuevo CG"** — Notebooks promo
  2. **"MODO 6 cuotas"** — Payment promo (MODO app, 6 interest-free installments with ICBC, Supervielle, YPF, Banco Comafi)
  3. **"Monitores - Nuevo CG"** — Monitors promo
  4. **"Arma tu PC - Nuevo CG"** — PC builder promo
  5. **"Bundle NVIDIA 007 First Light"** — NVIDIA bundle promo
- Each slide is a clickable link to a category/builder page
- Banners are full-color promotional graphics (not product photos on plain backgrounds)
- Red and white color scheme dominant (MODO slide specifically)

### Text/Copy
- Alt text on images is descriptive: "Notebooks - Nuevo CG", "MODO 6 cuotas", "Arma tu PC - Nuevo CG"
- All text is embedded in banner images (not HTML overlay)
- Promotional copy visible in screenshots:
  - "HASTA 6 CUOTAS sin interés" (MODO promo)
  - Bank logos: ICBC, Supervielle, YPF, Banco Comafi

### Secondary Hero Area
- **4 article cards** below the carousel (likely secondary promos)
- Each card appears to be a smaller promotional banner

### Below Hero Sections
- **"Conocé nuestros productos destacados"** — Category tabs (Periféricos, Monitores, Notebooks, Procesadores, Conectividad, Gabinetes, Sillas Gamers) with product cards
- **"Armá tu PC"** section with "Ver más" CTA
- **"HyperX vuelve. El juego cambia."** — Brand spotlight with product cards
- **"Descubrí las mejores marcas"** — Brand carousel

### Design Approach
- Angular SPA — very modern, fast, single-page application
- Clean, minimal design with lots of white space
- Red accent color (#cc0000 style) on white backgrounds
- Category tabs for product discovery right below hero
- **Key differentiator**: Payment/financing promos prominently in the hero carousel itself (not separate section)

---

## 3. VENEX (venex.com.ar)

### Hero Layout Structure
- **Full-width Blueimp carousel** (1920×504 desktop banners)
- Auto-playing with navigation arrows (‹ ›)
- 7 banner slides using CSS background images (`background: url(...) center center / contain no-repeat`)
- Responsive: separate mobile slider with same content
- Purple gradient background behind carousel

### Visual Elements
- **7 Banner slides** (from browser data + HTML analysis):
  1. **Venex general brand banner** (`banner-web-vx-abril-1920x504.png`)
  2. **MSI brand promo** (`msi-banner-mayo-home.png`) — Features MSI hardware + red dragon mascot, headline "Elevá tu experiencia gamer"
  3. **Kingston promo** (`banner-mayo-kingston-home.png`)
  4. **Bundle 007 promo** (`bundle-007-1920x504.jpg`)
  5. **HyperX/campaign promo** (`banner-campa_a-hs-home.jpg`)
  6. **Raptor promo** (`banner-raptor-mayo-home.png`)
  7. **AMD promo** (`banner-amd-mayo-home.png`)
- Slides use CSS `background-image` (not `<img>` tags) — harder to scrape but smooth rendering
- MSI slide includes cartoon dragon mascot + hardware product showcase

### Text/Copy
- MSI slide headline: **"Elevá tu experiencia gamer"**
- All other text is baked into banner images
- Below carousel: category headings in HTML:
  - "¡Las mejores marcas están en venex!"
  - "Elegí tu notebook ideal para trabajar o jugar"
  - "Aprovechá y renová tu Pc completa"
  - "Potencía tu PC con el mejor almacenamiento"

### Promotional Elements
- **Top nav bar** (dark gray):
  - Green icons: "Seguí tu compra", "Retirá tu compra", "Centro de Ayuda", "Informa tu pago!"
- **Below carousel**: Two promo links:
  - "PAGÁ EN HASTA 12 CUOTAS con las principales tarjetas de crédito"
  - "RECIBÍ TU PRODUCTO en más de 100 puntos en todo el país"
- 6 cuotas sin interés for online purchases with in-store pickup

### Design Approach
- Traditional server-rendered HTML (not SPA)
- Purple/blue gradient brand colors
- Blueimp gallery for carousel (older jQuery-style library)
- Dense product grid sections below hero
- Category icons row (PC, Notebook, Micro, Auris, Kingston, GPU)
- **Key differentiator**: Purple brand identity, mascot-driven banners (MSI dragon), payment/shipping promos as separate links below carousel

---

## 4. GAMING CITY (gamingcity.com.ar)

### Hero Layout Structure
- **Slick carousel** (2 slides) — simpler than competitors
- Full-width banner with dot navigation
- Vibrant electric blue gradient backgrounds with light effects
- Product showcase style (not just flat banners)

### Visual Elements
- **2 Banner slides**:
  1. **"ARMÁ TU PC — Subí de Nivel"** — Split layout:
     - LEFT: Bold headline "ARMÁ TU PC SUBI DE NIVEL" + dark blue CTA button "COMENZAR A ARMAR"
     - RIGHT: Dynamic collage of gaming hardware (AMD CPU box, motherboard, RGB PC case, GPU, RAM) with glowing blue light trails
     - Overlay badges: Orange "Retro gratis en 15 puntos del país" + "Aprovechá hasta 24 cuotas con tarjeta de crédito"
  2. **Monitors promo** — Monitor showcase banner

### Text/Copy
- **Primary headline**: "ARMÁ TU PC SUBI DE NIVEL"
- **CTA button**: "COMENZAR A ARMAR" (dark blue, prominent)
- **Overlay promos**: "Retro gratis en 15 puntos del país", "Aprovechá hasta 24 cuotas con tarjeta de crédito"
- Tagline: "ENCUENTRA LAS MEJORES MARCAS EN GAMING CITY"

### Info Bar (Below Hero)
- **4-column white info bar** with icons:
  1. "ENVÍOS EN EL DIA" — "CABA y GBA"
  2. "HASTA 24 CUOTAS" — "Con todas las tarjetas"
  3. "COMPRA SEGURA" — "A través de MercadoPago"
  4. "RETIRO GRATUITO" — "En nuestras 15 sucursales"

### Below Hero Sections
- **"Los Más Elegidos!"** — Brand logo carousel (Kingston, Logitech, AMD, Intel, NVIDIA, Thermaltake, MSI, Hiksemi, CoolerMaster, Corsair, Gigabyte, ASUS)
- **"Explorá nuestras categorías"** — Category image cards (Procesadores, Placas de video, Gabinetes, Memorias, Notebooks, Monitores, Discos)
- **Ofertas section** — Product carousel with countdown timers ("Pedilo hoy y recibilo mañana!")
- **Novedades section** — New arrivals carousel

### Design Approach
- **Most visually dynamic hero** — Blue gradients, light effects, product collage
- Gaming-first aesthetic with RGB/neon styling
- HTML text overlays on hero (not just baked-in images) — better for SEO and accessibility
- Info bar with trust/shipping/payment signals immediately below hero
- **Key differentiator**: HTML text + CTA button ON the hero banner, product showcase layout, overlay promo badges

---

## 5. MEXX (mexx.com.ar)

### Hero Layout Structure
- **Slick carousel** — 10 rotating banner slides
- Full-width banners with left/right navigation arrows
- Dark, industrial aesthetic (diamond-plate texture backgrounds)
- Product-focused imagery

### Visual Elements
- **10 Banner slides**:
  1. General brand banner
  2. **"Armá tu PC"** — PC builder promo → `/arma_tu_pc/`
  3. **"Millón de PC's vendidas"** — Social proof → gamers category
  4. **"Pagos"** — Payment methods promo
  5. **"Turbo envíos"** — Shipping promo
  6. **Empresas** — B2B/corporate → `/venta-empresas/`
  7. **Bundle Monitor** — Specific monitor product
  8. **NVIDIA** — Brand spotlight → `/nvidia/`
  9. **AM5 Gigabyte** — Product search → AM5 search
  10. **Logitech PRO X Superlight 2 SE** — Product launch → `/logitech/`

### Text/Copy
- **"ARMÁ TU PC"** headline with red CTA button **"COMENZÁ ACA"**
- **"TURBO ENVIOS"** badge in bottom-left
- "Millón de PC's vendidas" — social proof messaging
- Promotional banners cover: PC builder, payments, shipping, brands, specific products

### Below Hero: Action Cards
- **4 action/service cards** (white cards with icons):
  1. "QUIERO PREGUNTAR" — Customer inquiry
  2. "QUIERO QUE ME LLAMEN" — Callback request
  3. "QUIERO SOPORTE TÉCNICO" — Tech support
  4. "MEXX EMPRESAS" — Corporate sales

### Below Hero Sections
- **"# KILLERS"** — Countdown deal section with progress bars
- **"#BOMBAS DEL DÍA"** — Daily deals with progress bars
- **"#MEGAOFERTAS"** — Mega offers with progress bars
- **Brand logos row** (Gigabyte, HyperX, Kingston, MSI, Redragon, Thermaltake, Viewsonic, Wacom)
- PC Armadas section (hidden banner section with PC Hogar/Oficina/Gamers/Pro cards)
- Payment methods bar (Mercado Pago, debit, credit, cash)

### Design Approach
- **Most aggressive promotional design** — Dark industrial theme, diamond-plate textures
- Red and black color scheme (gaming aggressive)
- 3 cuotas sin interés (VISA/Master bank-issued) — in a calculadora de cuotas popup
- Partner Platinum badge in header (ASUS/AMD partner)
- Gamification: deal sections with progress bars and countdowns
- Service-oriented: action cards for customer support/calls
- **Key differentiator**: Industrial/gaming aesthetic, most slides (10), countdown deal sections, service action cards, Partner Platinum branding

---

## 6. OVERCLOCKERS (overclockers.com.ar)

### Status: DOMAIN DEFUNCT
- The domain `overclockers.com.ar` does not resolve (DNS failure)
- Neither `www.overclockers.com.ar` nor `overclockers.com.ar` respond
- Web search for the Argentine Overclockers store returns no results
- The store appears to be **permanently closed or rebranded**
- **Note**: Overclockers.com (US) and Overclockers.co.uk are different companies

---

## COMPARATIVE SUMMARY TABLE

| Feature | FullH4rd | CompraGamer | Venex | Gaming City | Mexx |
|---------|----------|-------------|-------|-------------|------|
| **Carousel Library** | Custom (Tailwind) | Custom (Angular) | Blueimp | Slick | Slick |
| **# of Slides** | 7 | 5 | 7 | 2 | 10 |
| **Hero Width** | Full-width | Full-width | Full-width (1920×504) | Full-width | Full-width |
| **Hero Layout** | Image-only carousel | Image carousel | Image carousel (CSS bg) | Product showcase + text | Image carousel |
| **HTML Text on Hero** | ❌ No | ❌ No | ❌ No | ✅ Yes (headline + CTA) | ✅ Yes (headline + CTA) |
| **CTA Button on Hero** | ❌ No | ❌ No | ❌ No | ✅ Yes ("COMENZAR A ARMAR") | ✅ Yes ("COMENZÁ ACA") |
| **Promo Badges on Hero** | ❌ No | ✅ Yes (MODO) | ❌ No | ✅ Yes (shipping + cuotas) | ✅ Yes (TURBO ENVIOS) |
| **Info Bar Below Hero** | ❌ No (bank promos section) | ❌ No | ✅ Yes (2 links) | ✅ Yes (4 icons) | ❌ No (action cards) |
| **"Armá tu PC" in Hero** | In nav only | ✅ Yes (slide) | ❌ No | ✅ Yes (primary slide) | ✅ Yes (slide + CTA) |
| **Payment Promo** | Bank promos section | MODO in hero | 12 cuotas below hero | 24 cuotas overlay | Payments slide + calc |
| **Responsive Banners** | `<picture>` | `<picture>` (4 breakpoints) | Separate mobile slider | Unknown | Unknown |
| **Color Scheme** | Dark header, gray bg | Red/white | Purple/blue gradient | Electric blue/neon | Black/red industrial |
| **SPA/Framework** | Server + Tailwind | Angular SPA | Traditional jQuery | Traditional + Slick | Traditional + Slick |

---

## KEY INSIGHTS FOR HERO REDESIGN

### What Works (Common Patterns)
1. **Full-width carousel is the universal standard** — All 5 sites use it
2. **7±2 slides is the sweet spot** — FullH4rd (7), CompraGamer (5), Venex (7), Mexx (10)
3. **"Armá tu PC" is THE key CTA** — Featured prominently in 4/5 hero sections
4. **Payment/financing promos are critical** — Every site highlights cuotas/payment options
5. **Brand partnerships drive banners** — MSI, Kingston, NVIDIA, AMD, Logitech all get dedicated slides

### What's Missing (Opportunities)
1. **HTML text overlays are rare** — Only Gaming City and Mexx have real text/CTAs on hero banners. Most use image-only slides, which is bad for SEO, accessibility, and mobile responsiveness
2. **No video heroes** — No competitor uses video backgrounds or animations
3. **No split layouts** — All use full-width carousels; no hero+sidebar grid layouts
4. **Info bars are inconsistent** — Only Gaming City has a proper 4-icon benefit bar; others scatter this info
5. **Mobile optimization varies** — CompraGamer leads with 4 responsive breakpoints; others just have a separate mobile slider

### Recommended Hero Design Approach
Based on competitor analysis, a best-in-class hero should:
1. **Full-width carousel with 5-7 slides** — Auto-play with pause on hover
2. **HTML text overlays** — Don't bake text into images; use positioned HTML for headlines + CTAs
3. **Prominent "Armá tu PC" CTA** — This is the #1 conversion feature
4. **Payment/shipping badges** — Overlay or inline badges for cuotas, envío gratis
5. **Product showcase style** — Like Gaming City's dynamic layout (not flat image banners)
6. **4-icon benefit bar below hero** — Envíos, Cuotas, Compra segura, Retiro
7. **Responsive `<picture>` elements** — 4 breakpoints like CompraGamer
8. **Brand partner slides** — MSI, NVIDIA, Kingston etc. for credibility
9. **Dark mode aesthetic with neon accents** — Gaming aesthetic aligns with target audience
