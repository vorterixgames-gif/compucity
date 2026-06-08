#!/bin/bash
# ============================================================
# Compucity - Pre-push Protection Hook
# Evita pushear si el commit local está atrás del remoto
# ============================================================

REMOTE_BRANCH="origin/main"
LOCAL_BRANCH="main"

# Obtener el hash del último commit local y remoto
LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse "$REMOTE_BRANCH" 2>/dev/null)

# Si no existe el remote branch, permitir el push (primera vez)
if [ -z "$REMOTE_HASH" ]; then
  echo "✅ No existe remote branch aún, permitiendo push..."
  exit 0
fi

# Verificar si el local está detrás del remoto
LOCAL_BEHIND=$(git rev-list --count HEAD.."$REMOTE_BRANCH" 2>/dev/null)

if [ "$LOCAL_BEHIND" -gt 0 ] 2>/dev/null; then
  echo ""
  echo "🚫 ═══════════════════════════════════════════════════════"
  echo "🚫  PROTECCIÓN: Tu rama local está ATRÁS del remoto"
  echo "🚫 ═══════════════════════════════════════════════════════"
  echo ""
  echo "   Commits que faltan en tu local: $LOCAL_BEHIND"
  echo "   Tu commit:      $LOCAL_HASH"
  echo "   Remote commit:  $REMOTE_HASH"
  echo ""
  echo "   Esto SOBREESCRIBIRÍA cambios que ya están en producción."
  echo "   Para solucionarlo, primero hacé pull:"
  echo ""
  echo "     git pull --rebase origin main"
  echo ""
  echo "   Y luego reintenta el push."
  echo ""
  echo "🚫 ═══════════════════════════════════════════════════════"
  echo ""
  exit 1
fi

# Verificar si hay commits no relacionados (diverged)
LOCAL_AHEAD=$(git rev-list --count "$REMOTE_BRANCH"..HEAD 2>/dev/null)
MERGE_BASE=$(git merge-base HEAD "$REMOTE_BRANCH" 2>/dev/null)

if [ "$MERGE_BASE" != "$REMOTE_HASH" ] && [ "$LOCAL_AHEAD" -gt 0 ]; then
  echo ""
  echo "⚠️  ═══════════════════════════════════════════════════════"
  echo "⚠️  ADVERTENCIA: Tu rama ha divergido del remoto"
  echo "⚠️  ═══════════════════════════════════════════════════════"
  echo ""
  echo "   Los commits locales no están basados en el último commit remoto."
  echo "   Esto podría sobreescribir cambios existentes."
  echo ""
  echo "   Commit base común: $MERGE_BASE"
  echo ""
  echo "   Para solucionarlo:"
  echo "     git pull --rebase origin main"
  echo ""
  echo "⚠️  ═══════════════════════════════════════════════════════"
  echo ""
  exit 1
fi

echo "✅ Pre-push check: tu local está actualizado con el remoto. Push permitido."
exit 0
