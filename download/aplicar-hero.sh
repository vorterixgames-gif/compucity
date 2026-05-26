#!/bin/bash
# Script para aplicar el rediseño del Hero de Compucity
# Ejecutar desde la raíz del proyecto compucity

set -e

echo "🎨 Aplicando rediseño del Hero de Compucity..."
echo ""

# 1. Copiar HeroSection.tsx
echo "📝 Copiando HeroSection.tsx..."
cp HeroSection.tsx src/components/ui-custom/HeroSection.tsx

# 2. Copiar imágenes de slides
echo "🖼️  Copiando imágenes de slides..."
cp hero-slide-pc-builder.png public/images/hero-slide-pc-builder.png
cp hero-slide-notebooks.png public/images/hero-slide-notebooks.png
cp hero-slide-components.png public/images/hero-slide-components.png
cp hero-slide-perifericos.png public/images/hero-slide-perifericos.png

# 3. Verificar
echo ""
echo "✅ Verificando archivos..."
[ -f "src/components/ui-custom/HeroSection.tsx" ] && echo "  ✓ HeroSection.tsx" || echo "  ✗ HeroSection.tsx FALLO"
[ -f "public/images/hero-slide-pc-builder.png" ] && echo "  ✓ hero-slide-pc-builder.png" || echo "  ✗ hero-slide-pc-builder.png FALLO"
[ -f "public/images/hero-slide-notebooks.png" ] && echo "  ✓ hero-slide-notebooks.png" || echo "  ✗ hero-slide-notebooks.png FALLO"
[ -f "public/images/hero-slide-components.png" ] && echo "  ✓ hero-slide-components.png" || echo "  ✗ hero-slide-components.png FALLO"
[ -f "public/images/hero-slide-perifericos.png" ] && echo "  ✓ hero-slide-perifericos.png" || echo "  ✗ hero-slide-perifericos.png FALLO"

echo ""
echo "🚀 Rediseño aplicado. Hacé git add, commit y push:"
echo "   git add src/components/ui-custom/HeroSection.tsx public/images/hero-slide-*.png"
echo "   git commit -m 'feat: Rediseño del Hero con carrusel full-width'"
echo "   git push origin main"
echo ""
echo "Las dependencias NO cambian - todo usa framer-motion y lucide-react que ya están en el proyecto."
