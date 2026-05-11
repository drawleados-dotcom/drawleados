#!/usr/bin/env bash
#
# Drawlead OS - One-shot Hostinger VPS Deployment Script
# Usage:  sudo bash deploy.sh
# Target: Ubuntu 22.04 LTS (also works on 20.04, 24.04)
#
# What this does:
#   1. Updates the system
#   2. Installs Node.js 20, Python 3.11, Nginx, Git, PM2
#   3. Installs MongoDB 7.0 + creates admin user
#   4. Clones the repo from GitHub
#   5. Sets up backend (FastAPI) and frontend (React build)
#   6. Configures Nginx reverse proxy + Let's Encrypt SSL
#   7. Sets up firewall (UFW) and PM2 auto-start
#
# Re-runnable: yes (idempotent for most steps)

set -euo pipefail

# ============================================================================
# CONFIGURATION — Edit these only if needed
# ============================================================================
DOMAIN="seyalos.com"
GITHUB_REPO="https://github.com/drawleados-dotcom/drawleados.git"
APP_DIR="/var/www/drawlead"

# MongoDB
MONGO_USER="drawlead-admin"
MONGO_PASS='%osdr@le@.'
MONGO_PASS_ENCODED='%25osdr%40le%40.'   # URL-encoded for use in connection string
MONGO_DB="drawlead_db"

# These keys come from your existing Emergent .env — keep them in sync
EMERGENT_LLM_KEY="sk-emergent-4EeCa20C4B6287b5aF"
RESEND_API_KEY="re_6puQgDKe_A8UsPEhqD77MqZnmSuNXZGjM"
SENDER_EMAIL="noreply@seyalos.com"
ADMIN_EMAIL="admin@seyalos.com"
GOOGLE_CALENDAR_CLIENT_ID="742630088923-g68bkp0nupf3e09akg7igl79r3fmm37q.apps.googleusercontent.com"
GOOGLE_CALENDAR_CLIENT_SECRET="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"

# ============================================================================
# PRETTY OUTPUT
# ============================================================================
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()   { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail()  { echo -e "${RED}[FAIL]${NC} $*" >&2; exit 1; }

# ============================================================================
# PRECHECKS
# ============================================================================
[ "$EUID" -eq 0 ] || fail "Run as root:  sudo bash deploy.sh"
log "Starting Drawlead OS deployment to $DOMAIN"

# ============================================================================
# 1. SYSTEM UPDATE & BASE PACKAGES
# ============================================================================
log "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y curl wget git ufw build-essential ca-certificates gnupg lsb-release software-properties-common nginx

# ============================================================================
# 2. NODE.JS 20 + YARN + PM2
# ============================================================================
log "Installing Node.js 20, Yarn, PM2..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g yarn pm2 || true

# ============================================================================
# 3. PYTHON 3.11
# ============================================================================
log "Installing Python 3.11..."
add-apt-repository ppa:deadsnakes/ppa -y || true
apt-get update -y
apt-get install -y python3.11 python3.11-venv python3.11-dev python3-pip

# ============================================================================
# 4. MONGODB 7.0
# ============================================================================
log "Installing MongoDB 7.0..."
if ! command -v mongod >/dev/null 2>&1; then
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
    | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
  UBUNTU_CODENAME=$(lsb_release -cs)
  echo "deb [signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] https://repo.mongodb.org/apt/ubuntu ${UBUNTU_CODENAME}/mongodb-org/7.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-7.0.list
  apt-get update -y
  apt-get install -y mongodb-org
fi
systemctl enable mongod
systemctl restart mongod
sleep 5

log "Creating MongoDB admin user (idempotent)..."
mongosh --quiet --eval "
db = db.getSiblingDB('admin');
if (!db.getUser('${MONGO_USER}')) {
  db.createUser({
    user: '${MONGO_USER}',
    pwd: '${MONGO_PASS}',
    roles: [{ role: 'root', db: 'admin' }]
  });
  print('User created');
} else {
  print('User exists');
}
"

log "Enabling MongoDB auth..."
if ! grep -q "authorization: enabled" /etc/mongod.conf; then
  sed -i '/^#security:/a security:\n  authorization: enabled' /etc/mongod.conf
  # Fallback if pattern not found
  if ! grep -q "authorization: enabled" /etc/mongod.conf; then
    echo -e "\nsecurity:\n  authorization: enabled" >> /etc/mongod.conf
  fi
fi

# Bind only to localhost for safety
sed -i 's/^  bindIp:.*/  bindIp: 127.0.0.1/' /etc/mongod.conf

systemctl restart mongod
sleep 3

# ============================================================================
# 5. CLONE REPO
# ============================================================================
log "Cloning repo from GitHub..."
mkdir -p "$(dirname "$APP_DIR")"
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin
  git reset --hard origin/main || git reset --hard origin/master
else
  git clone "$GITHUB_REPO" "$APP_DIR"
fi
cd "$APP_DIR"

# ============================================================================
# 6. BACKEND SETUP
# ============================================================================
log "Setting up backend (FastAPI)..."
cd "$APP_DIR/backend"

# Write backend .env
cat > .env <<EOF
MONGO_URL=mongodb://${MONGO_USER}:${MONGO_PASS_ENCODED}@127.0.0.1:27017/?authSource=admin
DB_NAME=${MONGO_DB}
CORS_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}
RESEND_API_KEY=${RESEND_API_KEY}
SENDER_EMAIL=${SENDER_EMAIL}
ADMIN_EMAIL=${ADMIN_EMAIL}
EMERGENT_LLM_KEY=${EMERGENT_LLM_KEY}
GOOGLE_CALENDAR_CLIENT_ID=${GOOGLE_CALENDAR_CLIENT_ID}
GOOGLE_CALENDAR_CLIENT_SECRET=${GOOGLE_CALENDAR_CLIENT_SECRET}
EOF
chmod 600 .env

# Python virtualenv
python3.11 -m venv venv
# shellcheck disable=SC1091
source venv/bin/activate
pip install --upgrade pip wheel
pip install -r requirements.txt
deactivate

# ============================================================================
# 7. FRONTEND SETUP
# ============================================================================
log "Building frontend (React)..."
cd "$APP_DIR/frontend"

cat > .env <<EOF
REACT_APP_BACKEND_URL=https://${DOMAIN}
EOF

yarn install --frozen-lockfile || yarn install
yarn build

# ============================================================================
# 8. PM2 — BACKEND PROCESS
# ============================================================================
log "Starting backend via PM2..."
cd "$APP_DIR/backend"
pm2 delete drawlead-backend >/dev/null 2>&1 || true
pm2 start "venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2" \
  --name drawlead-backend \
  --cwd "$APP_DIR/backend"
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

# ============================================================================
# 9. NGINX REVERSE PROXY
# ============================================================================
log "Configuring Nginx..."
cat > /etc/nginx/sites-available/drawlead <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    client_max_body_size 50M;

    # Frontend (React production build)
    location / {
        root ${APP_DIR}/frontend/build;
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    }

    # Static assets - long cache
    location /static/ {
        root ${APP_DIR}/frontend/build;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300;
        proxy_send_timeout 300;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/drawlead /etc/nginx/sites-enabled/drawlead
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ============================================================================
# 10. FIREWALL
# ============================================================================
log "Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable

# ============================================================================
# 11. SSL VIA LET'S ENCRYPT
# ============================================================================
log "Installing Certbot for SSL..."
apt-get install -y certbot python3-certbot-nginx

log "Requesting SSL certificate..."
log "(Make sure your DNS A-record for ${DOMAIN} points to this VPS IP)"
certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" --non-interactive --agree-tos -m "${ADMIN_EMAIL}" --redirect || \
  warn "SSL setup skipped/failed. Run manually:  sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"

# ============================================================================
# 12. DONE
# ============================================================================
echo
log "============================================"
log "✅  Deployment complete!"
log "🌐  Open https://${DOMAIN}"
log "🔐  MongoDB user: ${MONGO_USER}"
log "📦  Backend logs: pm2 logs drawlead-backend"
log "🔄  Restart backend: pm2 restart drawlead-backend"
log "🔄  Rebuild frontend: cd ${APP_DIR}/frontend && yarn build"
log "============================================"
log "👉  Next: run  sudo bash migrate_db.sh  to import existing data"
echo
