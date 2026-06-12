# Drawlead OS — Production Deployment Guide

This guide walks you through deploying the app to a Hostinger VPS with full CI/CD.
Every push to `main` on GitHub will auto-deploy to your VPS within ~3 minutes.

**You will need:**
- ✅ A Hostinger VPS (Ubuntu 22.04 LTS recommended — KVM 1 or higher)
- ✅ Root SSH access to the VPS
- ✅ Your domain `os.drawlead.com` pointed to the VPS IP (A-record)
- ✅ A GitHub repository with your code
- ✅ ~30 minutes the first time

> ⚠️ **Security note:** Never paste SSH passwords or private keys into chat. Use SSH keys from your local machine and store them in GitHub Secrets only.

---

## Architecture

```
                  ┌─────────────────────────────────────┐
                  │       Hostinger VPS (1 server)      │
                  │                                     │
   users ────┐    │   ┌─────────┐    ┌──────────┐      │
             │    │   │ nginx   │───▶│ FastAPI  │      │
   :443 ───▶ │────│──▶│ (React) │    │ :8001    │──┐   │
             │    │   │ :80/443 │    └──────────┘  │   │
             │    │   └─────────┘                  ▼   │
             │    │                          ┌──────────┐
             │    │                          │ MongoDB  │
             │    │                          │ :27017   │
             │    │                          └──────────┘
             │    │     (everything in docker-compose) │
             │    └─────────────────────────────────────┘
```

---

## Step 0 — Push the deploy files to GitHub

These files already exist in your repo (`/deploy/` + `.github/workflows/deploy.yml`).
Just make sure they're committed:

```bash
git status
git add deploy/ .github/
git commit -m "chore: add Docker + CI/CD deployment files"
git push origin main
```

---

## Step 1 — Set up the Hostinger VPS (one-time)

SSH into your VPS:

```bash
ssh root@YOUR_VPS_IP
```

Install Docker + Compose + Git:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Compose plugin (usually included)
apt install -y docker-compose-plugin git

# Verify
docker --version          # should be 24+
docker compose version    # should be v2+

# Open firewall ports
ufw allow 22/tcp           # SSH
ufw allow 80/tcp           # HTTP
ufw allow 443/tcp          # HTTPS
ufw --force enable
```

---

## Step 2 — Generate SSH key for GitHub Actions

**On your VPS**, create a deploy key:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Print the PRIVATE key — you'll paste this into GitHub Secrets in Step 4
cat ~/.ssh/github_deploy
```

Copy the entire output (including `-----BEGIN OPENSSH PRIVATE KEY-----` lines). You'll add it to GitHub in Step 4.

---

## Step 3 — Clone the repo onto the VPS

```bash
mkdir -p /opt
cd /opt
git clone https://github.com/YOUR_USER/YOUR_REPO.git drawlead
cd drawlead/deploy

# Create the production .env from the template
cp .env.example .env
nano .env
```

Edit `.env` and fill in:

| Variable | What to set |
|---|---|
| `MONGO_INITDB_ROOT_USERNAME` | e.g. `drawlead_admin` |
| `MONGO_INITDB_ROOT_PASSWORD` | a long random password — use `openssl rand -base64 32` |
| `DB_NAME` | `drawlead_db` (keep this unless you have a reason to change) |
| `SESSION_SECRET` | another `openssl rand -base64 32` |
| `EMERGENT_LLM_KEY` | copy from your current Emergent deployment |
| `RESEND_API_KEY` | copy if you use Resend for emails |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | copy if you use Google Sheets OAuth |
| `REACT_APP_BACKEND_URL` | `https://os.drawlead.com` |
| `ALLOWED_ORIGINS` | `https://os.drawlead.com` |

Save (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

## Step 4 — Add GitHub Secrets

Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.

Add these 4 secrets:

| Name | Value |
|---|---|
| `VPS_HOST` | Your VPS IP, e.g. `192.0.2.10` |
| `VPS_USER` | `root` (or whatever user you SSH as) |
| `VPS_PORT` | `22` (omit if standard) |
| `VPS_SSH_KEY` | **The PRIVATE key from Step 2** — paste the entire content including BEGIN/END lines |

---

## Step 5 — First boot

Back on the VPS:

```bash
cd /opt/drawlead/deploy
docker compose --env-file .env up -d --build
```

This builds 3 containers (mongo, backend, frontend) and starts them in the background.
First build takes ~5 minutes. Subsequent builds use the layer cache and take ~1 minute.

Check everything is up:

```bash
docker compose --env-file .env ps
# Expect all three containers to show "Up"

docker compose --env-file .env logs -f backend
# Should show: "Ensured 17 MongoDB indexes" and "Application startup complete"
```

Visit `http://YOUR_VPS_IP/` in your browser — you should see the Drawlead login page.

---

## Step 6 — Migrate data from your current Emergent deployment

> Skip this step if you're starting fresh and don't need the dev data on production.

### 6a. Export from Emergent

You need the Mongo connection string for your Emergent deployment. Email **support@emergent.sh** with your job ID and ask for it ("Need MONGO_URL for self-hosting migration"). They'll send you a temporary one.

Once you have it, on your **local laptop**:

```bash
# Install mongodump if you don't have it
brew install mongodb/brew/mongodb-database-tools   # macOS
# or: sudo apt install mongodb-database-tools      # Ubuntu

# Export
mongodump --uri="<EMERGENT_MONGO_URL>" --db=drawlead_db --out=./mongo_dump
```

You should see a `./mongo_dump/drawlead_db/` folder with `.bson` files.

### 6b. Restore to the VPS

Still on your local laptop, from the repo root:

```bash
export VPS_HOST=YOUR_VPS_IP
export VPS_USER=root
bash deploy/migrate.sh
```

This SCP's the dump to the VPS, then runs `mongorestore` inside the mongo container.

### 6c. Restart backend to re-index

```bash
ssh root@YOUR_VPS_IP "cd /opt/drawlead/deploy && docker compose --env-file .env restart backend"
```

Login at `http://YOUR_VPS_IP/` — your data should be there.

---

## Step 7 — Add HTTPS (Let's Encrypt SSL)

While the app runs fine on port 80, you want HTTPS for production. Easiest path:

```bash
ssh root@YOUR_VPS_IP
apt install -y certbot

# Stop the frontend container so certbot can use port 80 standalone
cd /opt/drawlead/deploy
docker compose --env-file .env stop frontend

# Get the cert
certbot certonly --standalone -d os.drawlead.com --email you@example.com --agree-tos --no-eff-email

# Cert will be at:
# /etc/letsencrypt/live/os.drawlead.com/fullchain.pem
# /etc/letsencrypt/live/os.drawlead.com/privkey.pem
```

Now mount the certs into the frontend container and enable 443 in nginx.

Edit `/opt/drawlead/deploy/docker-compose.yml` and under `frontend:`:

```yaml
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

Edit `/opt/drawlead/deploy/nginx.conf` and replace the existing server block with:

```nginx
server {
    listen 80;
    server_name os.drawlead.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name os.drawlead.com;

    ssl_certificate     /etc/letsencrypt/live/os.drawlead.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/os.drawlead.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 25M;
    gzip on;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://backend:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_buffering off;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Rebuild + restart:

```bash
docker compose --env-file .env up -d --build
```

Auto-renewal:

```bash
crontab -e
# Add this line:
0 3 * * * certbot renew --quiet && docker compose -f /opt/drawlead/deploy/docker-compose.yml --env-file /opt/drawlead/deploy/.env restart frontend
```

Visit `https://os.drawlead.com` — you should see a green padlock.

---

## Step 8 — Verify auto-deploy

Make any small change locally, then:

```bash
git add .
git commit -m "test: auto-deploy"
git push origin main
```

Open your GitHub repo → **Actions** tab. You should see a "Deploy to Hostinger VPS" run in progress. After ~2 minutes it goes green, and your VPS now has the new code.

---

## Daily Operations Cheatsheet

```bash
# SSH into VPS
ssh root@YOUR_VPS_IP

# Check status
cd /opt/drawlead/deploy
docker compose --env-file .env ps

# Tail logs
docker compose --env-file .env logs -f backend
docker compose --env-file .env logs -f frontend

# Manually rebuild (rare — CI/CD usually handles this)
docker compose --env-file .env up -d --build

# Restart one service
docker compose --env-file .env restart backend

# Backup MongoDB
docker compose --env-file .env exec -T mongo \
  mongodump --uri="mongodb://$MONGO_INITDB_ROOT_USERNAME:$MONGO_INITDB_ROOT_PASSWORD@localhost:27017/?authSource=admin" \
  --db=$DB_NAME --out=/backup/$(date +%F)
# The dump appears at /opt/drawlead/deploy/backup/YYYY-MM-DD/

# Free up disk space
docker system prune -af --volumes
```

---

## Troubleshooting

### Frontend returns 502 Bad Gateway
The backend container isn't running. Check `docker compose --env-file .env logs backend` for the error.

### Backend can't reach MongoDB
Wrong credentials in `.env`. The `MONGO_URL` inside the backend container should resolve to
`mongodb://${USERNAME}:${PASSWORD}@mongo:27017/${DB_NAME}?authSource=admin`. Make sure `MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD` are consistent.

### CI/CD job fails with "Permission denied (publickey)"
The `VPS_SSH_KEY` secret in GitHub doesn't match `authorized_keys` on the VPS.
Re-do Step 2 and Step 4.

### "Out of memory" during frontend build
The KVM 1 plan only has 1 GB RAM. Either upgrade to KVM 2, or build the frontend in CI and copy just the built bundle:

```yaml
# In .github/workflows/deploy.yml — alternative job that builds in CI:
# (advanced — only do this if your VPS keeps OOM'ing on builds)
```

If you hit this, ping me and I'll switch the workflow to "build locally, copy artifacts."

---

## Rollback

If a deploy goes bad:

```bash
ssh root@YOUR_VPS_IP
cd /opt/drawlead
git log --oneline   # find the last good commit
git reset --hard <commit-sha>
cd deploy
docker compose --env-file .env up -d --build
```

---

## Cost estimate

- Hostinger KVM 2 (2 vCPU, 8 GB RAM, 100 GB SSD): ~₹599/mo
- That's enough for ~50 concurrent users + MongoDB + nginx + FastAPI all in one box.
- For higher loads, move MongoDB to MongoDB Atlas (M0 free tier is fine for < 500 users).

---

## Files in this deploy folder

| File | Purpose |
|---|---|
| `backend.Dockerfile` | Builds the FastAPI container |
| `frontend.Dockerfile` | Builds React → serves with nginx |
| `nginx.conf` | nginx config (SPA + /api reverse-proxy) |
| `docker-compose.yml` | Wires up mongo + backend + frontend |
| `.env.example` | Template for production secrets |
| `migrate.sh` | One-shot DB migration helper |
| `../.github/workflows/deploy.yml` | GitHub Action that runs on every push |

---

**That's it.** Once Step 1–5 are done, every `git push origin main` auto-deploys to your VPS within ~2 minutes. No more manual deploys.
