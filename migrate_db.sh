#!/usr/bin/env bash
#
# Drawlead OS - MongoDB Migration Script
# Restores the dump in /var/www/drawlead/db_backup/drawlead_db into the new MongoDB
# Usage:  sudo bash migrate_db.sh
#
# Requirements:
#   - deploy.sh has already been run (MongoDB installed + auth user created)
#   - The dump folder is present at $DUMP_PATH (committed to your repo)

set -euo pipefail

MONGO_USER="drawlead-admin"
MONGO_PASS='%osdr@le@.'
MONGO_DB="drawlead_db"
APP_DIR="/var/www/drawlead"
DUMP_PATH="${APP_DIR}/db_backup/drawlead_db"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*" >&2; exit 1; }

[ "$EUID" -eq 0 ] || fail "Run as root:  sudo bash migrate_db.sh"
[ -d "$DUMP_PATH" ] || fail "Dump folder not found at $DUMP_PATH — make sure db_backup/drawlead_db is in your repo"

log "Starting MongoDB migration..."
log "Source dump: $DUMP_PATH"
log "Target DB:   $MONGO_DB"

# Optional: drop existing DB to ensure clean import (safe because new VPS install)
log "Dropping existing $MONGO_DB (clean migration)..."
mongosh --quiet \
  --username "$MONGO_USER" \
  --password "$MONGO_PASS" \
  --authenticationDatabase admin \
  --eval "db.getSiblingDB('${MONGO_DB}').dropDatabase()"

log "Restoring data with mongorestore..."
mongorestore \
  --username "$MONGO_USER" \
  --password "$MONGO_PASS" \
  --authenticationDatabase admin \
  --db "$MONGO_DB" \
  "$DUMP_PATH"

log "Verifying collections..."
mongosh --quiet \
  --username "$MONGO_USER" \
  --password "$MONGO_PASS" \
  --authenticationDatabase admin \
  --eval "
    db = db.getSiblingDB('${MONGO_DB}');
    db.getCollectionNames().forEach(c => {
      print(c + ' : ' + db.getCollection(c).countDocuments());
    });
  "

log "============================================"
log "✅  Migration complete!"
log "🔄  Restart backend to pick up new data: pm2 restart drawlead-backend"
log "============================================"
