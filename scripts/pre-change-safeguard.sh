#!/bin/bash
# ================================================
# Compucity - Pre-Change Safeguard
# ================================================
# Este script se ejecuta ANTES de hacer cualquier cambio
# para verificar que los colores verdes no se pierdan.
#
# USO: bash scripts/pre-change-safeguard.sh
# ================================================

set -e

echo "🔍 Compucity Safeguard - Verificando integridad de colores..."
echo ""

ERRORS=0

# 1. Verificar que todos los tonos de green estén en globals.css
echo "1️⃣  Verificando paleta verde en globals.css..."
GREEN_SHADES=("50" "100" "200" "300" "400" "500" "600" "700" "800" "900" "950")
for shade in "${GREEN_SHADES[@]}"; do
  if grep -q "compucity-green-${shade}" src/app/globals.css; then
    echo "   ✅ green-${shade} presente"
  else
    echo "   ❌ green-${shade} FALTANTE en globals.css!"
    ERRORS=$((ERRORS + 1))
  fi
done

# Colores base
for color in "compucity-green:" "compucity-green-light:" "compucity-green-dark:"; do
  if grep -q "$color" src/app/globals.css; then
    echo "   ✅ ${color%:} presente"
  else
    echo "   ❌ ${color%:} FALTANTE en globals.css!"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""

# 2. Verificar que tailwind.config.ts tiene la paleta completa
echo "2️⃣  Verificando paleta en tailwind.config.ts..."
for shade in "${GREEN_SHADES[@]}"; do
  if grep -q "'green-${shade}'" tailwind.config.ts; then
    echo "   ✅ green-${shade} presente en tailwind config"
  else
    echo "   ❌ green-${shade} FALTANTE en tailwind.config.ts!"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""

# 3. Verificar que los componentes clave usan la paleta verde
echo "3️⃣  Verificando componentes clave..."
COMPONENTS=(
  "src/components/layout/Navbar.tsx"
  "src/components/ui-custom/HeroSection.tsx"
  "src/components/ui-custom/ProductCard.tsx"
  "src/components/layout/CategoryIcons.tsx"
  "src/components/layout/BrandLogos.tsx"
  "src/app/page.tsx"
  "src/app/arma-tu-pc/page.tsx"
)

for comp in "${COMPONENTS[@]}"; do
  GREEN_COUNT=$(grep -c "compucity-green" "$comp" 2>/dev/null || echo "0")
  if [ "$GREEN_COUNT" -gt 0 ]; then
    echo "   ✅ $comp ($GREEN_COUNT refs)"
  else
    echo "   ⚠️  $comp (0 refs - verificar!)"
  fi
done

echo ""

# 4. Verificar que el build compila
echo "4️⃣  Verificando build..."
if npx next build 2>&1 | grep -q "Compiled successfully"; then
  echo "   ✅ Build exitoso"
else
  echo "   ❌ Build FALLÓ!"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# 5. Verificar que los colores se generan en el CSS
echo "5️⃣  Verificando CSS generado..."
CSS_FILE=$(find .next -name "*.css" -exec grep -l "compucity-green" {} \; 2>/dev/null | head -1)
if [ -n "$CSS_FILE" ]; then
  echo "   ✅ Colores verdes encontrados en CSS compilado"
  for shade in "${GREEN_SHADES[@]}"; do
    if grep -q "compucity-green-${shade}" "$CSS_FILE"; then
      echo "   ✅ green-${shade} en CSS output"
    else
      echo "   ❌ green-${shade} NO generado en CSS!"
      ERRORS=$((ERRORS + 1))
    fi
  done
else
  echo "   ⚠️  No se encontró CSS compilado (ejecutar build primero)"
fi

echo ""
echo "============================================="
if [ $ERRORS -eq 0 ]; then
  echo "✅ SALVAGUARDIA PASADA - Todo está correcto"
else
  echo "❌ $ERRORS ERRORES ENCONTRADOS - NO hacer deploy!"
  echo "   Corregir antes de continuar"
fi
echo "============================================="

exit $ERRORS
