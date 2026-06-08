#!/bin/bash
# ============================================================
# Compucity - Deploy Seguro
# Verifica que el código local esté actualizado antes de pushear
# Uso: ./scripts/deploy.sh "mensaje del commit"
# ============================================================

set -e

BRANCH="main"
REMOTE="origin"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Compucity - Deploy Seguro${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""

# Paso 1: Verificar que estamos en main
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo -e "${RED}🚫 No estás en la rama ${BRANCH}. Estás en ${CURRENT_BRANCH}.${NC}"
  echo -e "${YELLOW}   Cambiá de rama con: git checkout ${BRANCH}${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Rama: ${CURRENT_BRANCH}${NC}"

# Paso 2: Fetch del remoto para comparar
echo ""
echo -e "${CYAN}⬇️  Obteniendo cambios del remoto...${NC}"
git fetch $REMOTE --quiet

# Paso 3: Verificar si estamos atrás
LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse "$REMOTE/$BRANCH" 2>/dev/null)
BEHIND=$(git rev-list --count HEAD.."$REMOTE/$BRANCH" 2>/dev/null || echo "0")
AHEAD=$(git rev-list --count "$REMOTE/$BRANCH"..HEAD 2>/dev/null || echo "0")

echo -e "   Local:  ${LOCAL_HASH:0:8}"
echo -e "   Remote: ${REMOTE_HASH:0:8}"
echo -e "   Atrás:  ${BEHIND} commits | Adelante: ${AHEAD} commits"

if [ "$BEHIND" -gt 0 ] 2>/dev/null; then
  echo ""
  echo -e "${RED}🚫 ═══════════════════════════════════════════════════════${NC}"
  echo -e "${RED}🚫  TU CÓDIGO LOCAL ESTÁ ATRÁS DEL REMOTO POR ${BEHIND} COMMITS${NC}"
  echo -e "${RED}🚫 ═══════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${YELLOW}   Si pusheás, vas a SOBREESCRIBIR cambios en producción.${NC}"
  echo ""
  echo -e "   Opciones:"
  echo -e "   1. Traer los cambios remotos primero:"
  echo -e "      ${CYAN}git pull --rebase origin main${NC}"
  echo -e ""
  echo -e "   2. Si estás SEGURO que querés forzar (PELIGROSO):"
  echo -e "      ${CYAN}git push --force origin main${NC}"
  echo -e ""
  exit 1
fi

# Paso 4: Verificar divergencia
MERGE_BASE=$(git merge-base HEAD "$REMOTE/$BRANCH" 2>/dev/null)
if [ "$MERGE_BASE" != "$REMOTE_HASH" ] && [ "$AHEAD" -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}⚠️  ADVERTENCIA: Tu rama ha divergido del remoto${NC}"
  echo -e "${YELLOW}   Los commits locales no están basados en el último remoto.${NC}"
  echo ""
  echo -e "   Solucioná con: ${CYAN}git pull --rebase origin main${NC}"
  echo ""
  exit 1
fi

echo -e "${GREEN}✅ Código local está actualizado con el remoto${NC}"

# Paso 5: Verificar cambios sin commitear
UNSTAGED=$(git diff --name-only)
STAGED=$(git diff --cached --name-only)
UNTRACKED=$(git ls-files --others --exclude-standard)

if [ -n "$UNSTAGED" ] || [ -n "$STAGED" ] || [ -n "$UNTRACKED" ]; then
  echo ""
  echo -e "${YELLOW}📋 Cambios pendientes detectados:${NC}"
  [ -n "$STAGED" ] && echo -e "   Staged: ${STAGED}" | tr '\n' ' ' && echo ""
  [ -n "$UNSTAGED" ] && echo -e "   Unstaged: ${UNSTAGED}" | tr '\n' ' ' && echo ""
  [ -n "$UNTRACKED" ] && echo -e "   Untracked: ${UNTRACKED}" | tr '\n' ' ' && echo ""
  
  if [ -n "$1" ]; then
    echo ""
    echo -e "${CYAN}📦 Commiteando cambios...${NC}"
    git add -A
    git commit -m "$1"
    echo -e "${GREEN}✅ Commit creado${NC}"
  else
    echo ""
    echo -e "${YELLOW}   No se proporcionó mensaje de commit.${NC}"
    echo -e "   Usá: ${CYAN}./scripts/deploy.sh \"feat: descripción del cambio\"${NC}"
    echo -e "   O commiteá manualmente primero."
    exit 1
  fi
fi

# Paso 6: Push
echo ""
echo -e "${CYAN}🚀 Pusheando a ${REMOTE}/${BRANCH}...${NC}"
git push $REMOTE $BRANCH

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Deploy exitoso - Vercel se actualizará automáticamente${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "   Verificá el deploy en:"
echo -e "   ${CYAN}https://my-project-eight-liard-96.vercel.app/${NC}"
echo ""
