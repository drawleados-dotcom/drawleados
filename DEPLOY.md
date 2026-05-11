# 🚀 Drawlead OS — Hostinger VPS Deployment Guide

This guide takes a fresh Hostinger Ubuntu 22.04 VPS to a fully running production
deployment of Drawlead OS at **https://os.drawlead.com**, complete with MongoDB,
SSL, and a GitHub Actions CI/CD pipeline.

---

## ✅ Prerequisites

1. A Hostinger VPS running **Ubuntu 22.04 LTS**
2. Root SSH access (you have password access; we'll set up SSH key auth shortly)
3. DNS A-record `os.drawlead.com  →  187.127.165.130`
   - Do this in your domain provider's DNS panel BEFORE you run `deploy.sh`
   - Wait ~5 min for propagation
4. The code pushed to GitHub at <https://github.com/drawleados-dotcom/drawleados>
5. The data dump committed to the repo at `db_backup/drawlead_db/` (already prepared)

---

## 📦 What's in this repo for deployment

| File | Purpose |
|------|---------|
| `deploy.sh` | One-shot installer: system, MongoDB, Node, Python, Nginx, SSL, PM2 |
| `migrate_db.sh` | Restores `db_backup/drawlead_db/` into the new MongoDB |
| `db_backup/drawlead_db/` | Full mongodump of current Emergent database |
| `.github/workflows/deploy.yml` | CI/CD pipeline — auto-deploys on push to `main` |

---

## 🟢 Step 1 — Initial server setup

SSH into your VPS from your local machine:
```bash
ssh root@187.127.165.130
```

Once inside, clone the repo and run the deploy script:
```bash
cd /root
git clone https://github.com/drawleados-dotcom/drawleados.git temp-drawlead
sudo bash temp-drawlead/deploy.sh
```

This will (~10 min):
- Install all dependencies
- Install MongoDB 7.0 and create user `drawlead-admin`
- Clone your repo to `/var/www/drawlead`
- Build frontend, set up FastAPI backend with PM2
- Configure Nginx
- Issue Let's Encrypt SSL certificate

When done, you'll see:
```
✅  Deployment complete!
🌐  Open https://os.drawlead.com
```

> ⚠️ If the SSL step fails, your DNS hasn't propagated yet. Wait 10 min and run:
> ```bash
> sudo certbot --nginx -d os.drawlead.com
> ```

---

## 🟢 Step 2 — Migrate existing data

```bash
cd /var/www/drawlead
sudo bash migrate_db.sh
```

This restores every collection (users, designations, projects, leads, tasks, etc.)
from the dump into your new VPS MongoDB. Output will show each collection's count.

Then restart the backend:
```bash
pm2 restart drawlead-backend
```

Open https://os.drawlead.com — log in with your existing credentials:
- `vinoth@drawlead.com` / `admin123`

---

## 🟢 Step 3 — Set up GitHub Actions CI/CD

### A. Generate an SSH deploy key on the VPS

```bash
ssh root@187.127.165.130
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Display the PRIVATE key — copy this entire output
cat ~/.ssh/github_deploy
```

### B. Add GitHub Secrets

Go to <https://github.com/drawleados-dotcom/drawleados/settings/secrets/actions>
and add these 4 secrets:

| Secret name | Value |
|-------------|-------|
| `VPS_HOST` | `187.127.165.130` |
| `VPS_USER` | `root` |
| `VPS_PORT` | `22` |
| `VPS_SSH_KEY` | The entire content of `~/.ssh/github_deploy` (the private key) |

### C. Test the pipeline

Push any change to `main`:
```bash
git commit --allow-empty -m "trigger deploy"
git push origin main
```

Visit the **Actions** tab in your GitHub repo to watch the deploy run.
It will:
1. Build the frontend on GitHub's runner (sanity check)
2. SSH into your VPS
3. Pull latest code, rebuild frontend, restart backend
4. Run a health check on https://os.drawlead.com/api

---

## 🔧 Common ops commands

| Task | Command |
|------|---------|
| View backend logs | `pm2 logs drawlead-backend` |
| Restart backend | `pm2 restart drawlead-backend` |
| Rebuild frontend manually | `cd /var/www/drawlead/frontend && yarn build` |
| Reload Nginx | `sudo systemctl reload nginx` |
| MongoDB shell | `mongosh -u drawlead-admin -p '%osdr@le@.' --authenticationDatabase admin` |
| Tail Nginx errors | `tail -f /var/log/nginx/error.log` |
| Renew SSL (auto) | Certbot runs via systemd timer; manual: `sudo certbot renew` |

---

## 🔐 Security checklist (do these after first successful deploy)

1. **Change root password** — `passwd`
2. **Create a non-root deploy user**:
   ```bash
   adduser deploy
   usermod -aG sudo deploy
   ```
   Then update `VPS_USER` GitHub secret to `deploy` and copy SSH key over.
3. **Disable root SSH login** — edit `/etc/ssh/sshd_config`:
   - `PermitRootLogin no`
   - `PasswordAuthentication no` (only after confirming key-based login works!)
   - `sudo systemctl restart ssh`
4. **Rotate MongoDB password** if `%osdr@le@.` was ever exposed in chat
5. **Set up backup cron** for MongoDB:
   ```bash
   echo "0 3 * * * root mongodump --uri='mongodb://drawlead-admin:%25osdr%40le%40.@127.0.0.1:27017/?authSource=admin' --db=drawlead_db --out=/var/backups/mongo/\$(date +\%F)" >> /etc/crontab
   ```

---

## 🆘 Troubleshooting

**Frontend shows blank page**
- Check `tail /var/log/nginx/error.log`
- Confirm `frontend/build/index.html` exists: `ls /var/www/drawlead/frontend/build/`
- Rebuild: `cd /var/www/drawlead/frontend && yarn build`

**Backend 502 Bad Gateway**
- `pm2 status` — is `drawlead-backend` online?
- `pm2 logs drawlead-backend --lines 100` — look for stack trace
- Check `.env`: `cat /var/www/drawlead/backend/.env`

**MongoDB auth errors**
- Confirm password is URL-encoded in `MONGO_URL`: `%` → `%25`, `@` → `%40`
- Test connection: `mongosh "mongodb://drawlead-admin:%25osdr%40le%40.@127.0.0.1:27017/?authSource=admin"`

**GitHub Actions fails at "Deploy on VPS"**
- Verify the 4 secrets are set correctly
- SSH into VPS and check `cat ~/.ssh/authorized_keys` includes the public key
- Test from your local: `ssh -i ~/.ssh/github_deploy root@187.127.165.130`

---

Built with ☕ for Drawlead OS — May 2026
