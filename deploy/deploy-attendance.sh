#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Ships the current code to the live system at https://attedance.shulepoa.co.ke
# (cPanel account bdnxkzmx, CloudLinux Node.js app run by Passenger) — the same
# way School-ERP's tools/deploy-portal.sh ships portal.shulepoa.co.ke.
#
#   deploy/deploy-attendance.sh        build, upload, migrate, restart
#
# What it sends: deploy/server.js, the built website (Next standalone → web/)
# and backend/ code. The server's .env, venv/, logs/ are never touched; the
# previous backend/ and web/ are kept under tmp/ (last 3). pip install runs
# only when requirements.txt changed. Database migrations run every time
# (alembic upgrade heads is a no-op when up to date).
#
# The SSH key's passphrase comes from SHULEPOA_SSH_PASS or ~/.ssh/shulepoa.pass
# via the ERP repo's tools/ssh-askpass.sh. Run from Git Bash.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

HOST="bdnxkzmx@144.217.75.112"
KEY="${SSH_KEY:-C:/Users/Softclans/Downloads/id_rsa}"
DOMAIN="attedance.shulepoa.co.ke"
APP="$DOMAIN"                        # app root under the cPanel home folder
PY="/opt/alt/python312/bin/python3"
ASKPASS="${ASKPASS:-C:/Users/Softclans/Desktop/School-ERP-system-Available-for-demo-/tools/ssh-askpass.sh}"

ROOT="$(git rev-parse --show-toplevel)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [[ -n "${SHULEPOA_SSH_PASS:-}" || -f "$HOME/.ssh/shulepoa.pass" ]]; then
  export SSH_ASKPASS="$ASKPASS" SSH_ASKPASS_REQUIRE=force DISPLAY="${DISPLAY:-:0}"
fi

echo "▸ Building the website"
(cd "$ROOT/frontend" && NEXT_PUBLIC_API_URL="https://$DOMAIN" NEXT_PUBLIC_WS_URL="wss://$DOMAIN" npx next build)
SA="$ROOT/frontend/.next/standalone"
# Next puts server.js under the folder it traced from; find it.
WEB="$(dirname "$(find "$SA" -name server.js -not -path '*/node_modules/*' | head -1)")"
mkdir -p "$WORK/pkg/web"
cp -a "$WEB/." "$WORK/pkg/web/"
[[ "$WEB" != "$SA" && -d "$SA/node_modules" ]] && cp -a "$SA/node_modules/." "$WORK/pkg/web/node_modules/"
mkdir -p "$WORK/pkg/web/.next"
cp -a "$ROOT/frontend/.next/static" "$WORK/pkg/web/.next/static"
cp -a "$ROOT/frontend/public" "$WORK/pkg/web/public"
if grep -rlq "localhost:8000" "$WORK/pkg/web/.next/static"; then
  echo "✗ The build still points at localhost:8000 — stopping." >&2; exit 1
fi

echo "▸ Packing the backend"
(cd "$ROOT/backend" && tar -cf - --exclude=.venv --exclude=venv --exclude=__pycache__ --exclude='.env' \
  --exclude='*.log' --exclude=tests --exclude='test_*.py' --exclude='verify_*.py' \
  alembic alembic.ini api_gateway attendance_service device_service notification_service school_service shared static requirements.txt) \
  | (mkdir -p "$WORK/pkg/backend" && tar -xf - -C "$WORK/pkg/backend")
# Development tools are not needed on the server.
sed '/^# Development/,$d' "$ROOT/backend/requirements.txt" > "$WORK/pkg/backend/requirements.txt"
cp "$ROOT/deploy/server.js" "$WORK/pkg/server.js"
printf '{\n  "name": "shulepoa-attendance",\n  "private": true,\n  "main": "server.js",\n  "scripts": { "start": "node server.js" }\n}\n' > "$WORK/pkg/package.json"
tar -czf "$WORK/release.tgz" -C "$WORK/pkg" .
echo "  $(du -h "$WORK/release.tgz" | cut -f1)"

echo "▸ Uploading"
ssh -i "$KEY" "$HOST" "mkdir -p ~/$APP/tmp"
scp -q -i "$KEY" "$WORK/release.tgz" "$HOST:$APP/tmp/release.tgz"

echo "▸ Installing on the server"
ssh -i "$KEY" "$HOST" bash -s <<EOF
set -euo pipefail
cd ~/$APP
[[ -f .env ]] || { echo "✗ ~/$APP/.env is missing — create it from deploy/env.example first" >&2; exit 1; }
stamp=\$(date +%Y%m%d-%H%M%S)
old_req=\$(md5sum backend/requirements.txt 2>/dev/null | cut -d' ' -f1 || true)
mkdir -p tmp/release tmp/backup-\$stamp logs
# First deploy: register the Node.js app (writes the Passenger .htaccess into
# the subdomain's document root). Done before unpacking so the release's
# server.js replaces any starter file the selector creates.
if ! cloudlinux-selector get --json --interpreter nodejs | grep -q '"$APP": {'; then
  echo "  registering the Node.js app"
  cloudlinux-selector create --json --interpreter nodejs --version 20 --app-root $APP \
    --domain $DOMAIN --app-uri / --app-mode production --startup-file server.js >/dev/null
fi
tar -xzf tmp/release.tgz -C tmp/release
cp -a backend web server.js tmp/backup-\$stamp/ 2>/dev/null || true
rm -rf backend web
cp -a tmp/release/. .
rm -rf tmp/release tmp/release.tgz
ls -dt tmp/backup-* | tail -n +4 | xargs -r rm -rf      # keep the last 3 backups
[[ -x venv/bin/python ]] || { echo "  creating venv"; $PY -m venv venv; venv/bin/pip install -q --upgrade pip; old_req=; }
if [[ "\$old_req" != "\$(md5sum backend/requirements.txt | cut -d' ' -f1)" ]]; then
  echo "  requirements changed — pip install"; venv/bin/pip install -q -r backend/requirements.txt
fi
echo "  migrating the database"
(cd backend && DATABASE_URL="\$(grep '^DATABASE_URL=' ../.env | cut -d= -f2-)" ../venv/bin/python -m alembic upgrade heads 2>&1 | tail -3)
cloudlinux-selector restart --json --interpreter nodejs --app-root $APP >/dev/null
echo "  restarted"
EOF

echo "▸ Checking https://$DOMAIN/health"
for i in $(seq 1 12); do
  if curl -fsS -m 30 "https://$DOMAIN/health" >/dev/null 2>&1; then echo "✓ Live"; exit 0; fi
  sleep 10
done
echo "✗ Not answering yet — read ~/$APP/logs/*.log on the server" >&2; exit 1
