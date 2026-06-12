#!/usr/bin/env bash
# ===== One-shot DB migration: dev (Emergent) → prod (Hostinger VPS) =====
# Run this LOCALLY on your laptop after you have:
#   1. Exported the dump from Emergent (we provide the export command below)
#   2. SCP'd the dump to your VPS at /opt/drawlead/deploy/backup
#   3. Started the docker stack on the VPS (docker compose up -d)

set -euo pipefail

VPS_USER="${VPS_USER:-root}"
VPS_HOST="${VPS_HOST:?Set VPS_HOST env var, e.g. 1.2.3.4}"
LOCAL_DUMP_DIR="${LOCAL_DUMP_DIR:-./mongo_dump}"
REMOTE_DEPLOY_DIR="${REMOTE_DEPLOY_DIR:-/opt/drawlead/deploy}"
DB_NAME="${DB_NAME:-drawlead_db}"

echo "==> 1. Verifying local dump exists at $LOCAL_DUMP_DIR/$DB_NAME"
if [ ! -d "$LOCAL_DUMP_DIR/$DB_NAME" ]; then
    echo "ERROR: no dump found. Run this first on a machine that can reach the Emergent DB:"
    echo "       mongodump --uri=\"<emergent-mongo-url>\" --db=$DB_NAME --out=$LOCAL_DUMP_DIR"
    exit 1
fi

echo "==> 2. SCP dump to VPS"
ssh "$VPS_USER@$VPS_HOST" "mkdir -p $REMOTE_DEPLOY_DIR/backup"
scp -r "$LOCAL_DUMP_DIR/$DB_NAME" "$VPS_USER@$VPS_HOST:$REMOTE_DEPLOY_DIR/backup/"

echo "==> 3. Running mongorestore inside the mongo container"
ssh "$VPS_USER@$VPS_HOST" bash -s <<'EOF'
set -e
cd /opt/drawlead/deploy
docker compose --env-file .env exec -T mongo bash -lc "
  mongorestore \
    --uri='mongodb://\$MONGO_INITDB_ROOT_USERNAME:\$MONGO_INITDB_ROOT_PASSWORD@localhost:27017/?authSource=admin' \
    --db='\$MONGO_INITDB_DATABASE' \
    --drop \
    /backup/\$MONGO_INITDB_DATABASE
"
echo "==> Restore complete. Tail the backend logs to confirm:"
docker compose --env-file .env logs --tail=30 backend
EOF

echo "==> Done. Your data is now live on the VPS."
