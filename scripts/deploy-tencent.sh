#!/usr/bin/env bash
# Deploy a scoped Lumino slice to Tencent Lighthouse:
# - public site (??)
# - calculator
# - portal leads inbox (ops/sales)
# Does NOT ship docs/tests/roadmap/quote prototypes as the live surface.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${DEPLOY_HOST:?DEPLOY_HOST required}"
USER_NAME="${DEPLOY_USER:-ubuntu}"
REMOTE_DIR="${DEPLOY_DIR:-/var/www/lumino}"
SERVICE_NAME="${DEPLOY_SERVICE:-lumino-site}"
PUBLIC_BASE="${PUBLIC_SITE_URL:-http://${HOST}}"
SSH_OPTS="-o StrictHostKeyChecking=yes -o ServerAliveInterval=30"

if [[ -n "${SSH_PRIVATE_KEY:-}" ]]; then
  KEY_FILE="$(mktemp)"
  printf '%s\n' "$SSH_PRIVATE_KEY" > "$KEY_FILE"
  chmod 600 "$KEY_FILE"
  SSH_CMD=(ssh -i "$KEY_FILE" $SSH_OPTS)
  RSYNC_SSH="ssh -i $KEY_FILE $SSH_OPTS"
  cleanup() { rm -f "$KEY_FILE"; rm -rf "${STAGE:-}"; }
else
  SSH_CMD=(ssh $SSH_OPTS)
  RSYNC_SSH="ssh $SSH_OPTS"
  cleanup() { rm -rf "${STAGE:-}"; }
fi
trap cleanup EXIT

TARGET="${USER_NAME}@${HOST}"
STAGE="$(mktemp -d)"

echo "==> Build scoped deploy bundle"
mkdir -p \
  "$STAGE/apps/site" \
  "$STAGE/apps/portal" \
  "$STAGE/api" \
  "$STAGE/packages/shared" \
  "$STAGE/packages/advisor" \
  "$STAGE/packages/agent" \
  "$STAGE/scripts" \
  "$STAGE/data"

# Runtime surfaces
rsync -a "$ROOT/apps/site/" "$STAGE/apps/site/"
rsync -a "$ROOT/apps/portal/" "$STAGE/apps/portal/"
rsync -a "$ROOT/api/" "$STAGE/api/"
rsync -a "$ROOT/packages/shared/" "$STAGE/packages/shared/"
# Homepage advisor imports packages/advisor via api/_lib.
rsync -a \
  --exclude 'tests/' \
  --exclude 'evals/' \
  --exclude 'README.md' \
  "$ROOT/packages/advisor/" "$STAGE/packages/advisor/"
# Portal shell still loads agent domain scripts; keep runtime deps only.
rsync -a \
  --exclude 'tests/' \
  --exclude 'prompts/' \
  --exclude 'evals/' \
  --exclude 'README.md' \
  "$ROOT/packages/agent/" "$STAGE/packages/agent/"

# Server entry + short-path rewrites
cp "$ROOT/scripts/local-site-server.mjs" "$STAGE/scripts/local-site-server.mjs"
cp "$ROOT/vercel.json" "$STAGE/vercel.json"
cp "$ROOT/index.html" "$STAGE/index.html"

# Root redirects / icons used by marketing pages
shopt -s nullglob
for f in "$ROOT"/favicon.svg "$ROOT"/favicon.png "$ROOT"/favicon.ico "$ROOT"/apple-touch-icon.png \
         "$ROOT"/Lumino\ ??.dc.html "$ROOT"/Lumino\ ??.dc.html "$ROOT"/Lumino\ ??.dc.html \
         "$ROOT"/Lumino\ ??.dc.html; do
  [[ -e "$f" ]] && cp "$f" "$STAGE/"
done
shopt -u nullglob

# Keep an empty data dir marker; never overwrite remote leads.json
if [[ -f "$ROOT/data/.gitkeep" ]]; then
  cp "$ROOT/data/.gitkeep" "$STAGE/data/.gitkeep"
else
  : > "$STAGE/data/.gitkeep"
fi

echo "==> Bundle size"
du -sh "$STAGE" "$STAGE/apps/site" "$STAGE/apps/portal" "$STAGE/api" "$STAGE/packages" | sed 's|^|  |'

echo "==> Ensure remote directory exists: ${REMOTE_DIR}"
"${SSH_CMD[@]}" "$TARGET" "sudo mkdir -p '${REMOTE_DIR}' && sudo chown '${USER_NAME}:${USER_NAME}' '${REMOTE_DIR}'"

echo "==> Rsync scoped bundle (preserve .env and leads data)"
rsync -az --delete \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'data/leads.json' \
  -e "$RSYNC_SSH" \
  "$STAGE/" "${TARGET}:${REMOTE_DIR}/"

echo "==> Restart service ${SERVICE_NAME}"
"${SSH_CMD[@]}" "$TARGET" "sudo systemctl restart '${SERVICE_NAME}' && sleep 1 && systemctl is-active '${SERVICE_NAME}'"

echo "==> Smoke checks (site / calculator / leads auth / advisor)"
curl -fsS --connect-timeout 10 "${PUBLIC_BASE}/" >/dev/null
curl -fsS --connect-timeout 10 "${PUBLIC_BASE}/site" >/dev/null
curl -fsS -o /dev/null -w "%{http_code}" --connect-timeout 10 "${PUBLIC_BASE}/calculator/" | grep -Eq '200|301|302'
curl -fsS --connect-timeout 10 "${PUBLIC_BASE}/portal/" >/dev/null
curl -fsS --connect-timeout 10 "${PUBLIC_BASE}/api/advisor-ping" | grep -q '"ok":true'
curl -fsS --connect-timeout 10 "${PUBLIC_BASE}/api/staff-login" | grep -q '"ok":true'
# leads must require auth
code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 10 "${PUBLIC_BASE}/api/leads" || true)"
[[ "$code" == "401" ]]

echo "==> Deploy OK (scoped) ? ${PUBLIC_BASE}"
echo "    Live surfaces: /  /site  /calculator/  /portal/ (leads via ops/sales login)"
