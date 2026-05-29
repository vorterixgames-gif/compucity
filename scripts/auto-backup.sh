#!/bin/bash
# ================================================
# Compucity - Auto-Backup Script
# ================================================
# Crea un backup completo antes de cualquier cambio mayor.
# Incluye: código + git history + base de datos Turso
#
# USO: bash scripts/auto-backup.sh "descripcion del cambio"
# ================================================

set -e

DESCRIPTION="${1:-manual-backup}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/home/z/my-project/backups/compucity-backup-${TIMESTAMP}"

echo "📦 Compucity Auto-Backup"
echo "   Descripción: $DESCRIPTION"
echo "   Directorio: $BACKUP_DIR"
echo ""

mkdir -p "$BACKUP_DIR"

# 1. Backup de código (sin node_modules/.next)
echo "1️⃣  Backup de código..."
tar czf "$BACKUP_DIR/codigo.tar.gz" --exclude='node_modules' --exclude='.next' .
echo "   ✅ Código respaldado"

# 2. Backup de git history
echo "2️⃣  Backup de git history..."
tar czf "$BACKUP_DIR/codigo-con-git.tar.gz" --exclude='node_modules' --exclude='.next' .
echo "   ✅ Git history respaldado"

# 3. Backup de la base de datos Turso
echo "3️⃣  Backup de base de datos Turso..."
node -e "
const { createClient } = require('@libsql/client');
const fs = require('fs');

async function backup() {
  const client = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });

  const tables = ['products', 'categories', 'customers', 'orders', 'order_items', 'admins', 'dollar_rates', 'store_config', 'supplier_category_mappings', 'suppliers'];
  const backup = {};

  for (const table of tables) {
    try {
      const result = await client.execute('SELECT * FROM ' + table);
      backup[table] = result.rows;
      console.log('   ' + table + ': ' + result.rows.length + ' rows');
    } catch (e) {
      console.log('   ' + table + ': skipped');
    }
  }

  fs.writeFileSync('$BACKUP_DIR/turso-db.json', JSON.stringify(backup, null, 2));
  console.log('   ✅ DB respaldada');
}

backup().catch(e => console.error('   ❌ Error:', e.message));
"

# 4. Guardar metadata del backup
cat > "$BACKUP_DIR/backup-info.txt" << EOF
Compucity Backup
================
Fecha: $(date)
Descripción: $DESCRIPTION
Commit: $(git rev-parse HEAD)
Commit msg: $(git log -1 --pretty=%B | head -1)
Branch: $(git branch --show-current)
Archivos:
- codigo.tar.gz (código sin git)
- codigo-con-git.tar.gz (código con git history)
- turso-db.json (base de datos Turso)
EOF

echo ""
echo "============================================="
echo "✅ BACKUP COMPLETADO"
echo "   Ubicación: $BACKUP_DIR"
du -sh "$BACKUP_DIR"/*
echo "============================================="
