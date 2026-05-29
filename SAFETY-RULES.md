# Compucity - Reglas de Seguridad para Cambios

## ⚠️ REGLAS OBLIGATORIAS antes de cualquier cambio

### 1. SIEMPRE hacer backup antes de cambios mayores
```bash
bash scripts/auto-backup.sh "descripción del cambio"
```

### 2. NUNCA reescribir un archivo completo
- **PROHIBIDO**: Reemplazar todo el contenido de un archivo existente
- **OBLIGATORIO**: Usar ediciones quirúrgicas (solo cambiar lo necesario)
- Si un archivo tiene muchas líneas (ej: arma-tu-pc/page.tsx con 700+ líneas),
  editar solo las secciones específicas que necesitan cambio

### 3. NUNCA tocar estos archivos sin autorización explícita
- `src/app/globals.css` - Paleta de colores verde (compucity-green-50 al green-950)
- `tailwind.config.ts` - Configuración de colores de marca
- `src/components/ui-custom/HeroSection.tsx` - NO tocar el botón "Ver componentes"
- `src/components/ui-custom/ProductCard.tsx` - Estilos de cards aprobados

### 4. Verificar colores después de cada cambio
```bash
bash scripts/pre-change-safeguard.sh
```

### 5. Proceso seguro para cambios
1. Hacer backup
2. Crear branch para el cambio: `git checkout -b fix/nombre-del-cambio`
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
| compucity-green-900 | #1A3E2E   | Fondos oscuros, sección CTA      |
| compucity-green-950 | #0F2A1E   | Marquee, fondos muy oscuros      |
| compucity-green     | #3A8B68   | Color base                       |
| compucity-green-light | #75AD95 | Acentos claros                   |
| compucity-green-dark  | #2F6F55 | Hover botones                    |

### 7. Backups disponibles
- `/home/z/my-project/backups/compucity-backup-20260529-safe/` - Backup seguro post-paleta verde
- `/home/z/my-project/backups/compucity-backup-20260529-133354` - Backup anterior
