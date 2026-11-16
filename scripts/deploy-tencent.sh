#!/usr/bin/env bash
# Deploy Lumino site to Tencent Lighthouse.
# Intended for GitHub Actions; can also run locally with SSH agent / key.
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
  trap 'rm -f "$KEY_FILE"' EXIT
  printf '%s\n' "$SSH_PRIVATE_KEY" > "$KEY_FILE"
  chmod 600 "$KEY_FILE"
  SSH_CMD=(ssh -i "$KEY_FILE" $SSH_OPTS)
  RSYNC_SSH="ssh -i $KEY_FILE $SSH_OPTS"
else
  SSH_CMD=(ssh $SSH_OPTS)
  RSYNC_SSH="ssh $SSH_OPTS"
fi

TARGET="${USER_NAME}@${HOST}"

echo "==> Ensure remote directory exists: ${REMOTE_DIR}"
"${SSH_CMD[@]}" "$TARGET" "sudo mkdir -p '${REMOTE_DIR}' && sudo chown '${USER_NAME}:${USER_NAME}' '${REMOTE_DIR}'"

echo "==> Rsync code (preserve .env and leads data)"
rsync -az --delete \
  --exclude '.git/' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude '.DS_Store' \
  --exclude '.firecrawl/' \
  --exclude 'node_modules/' \
  --exclude 'outputs/' \
  --exclude 'screenshots/' \
  --exclude 'data/leads.json' \
  --exclude 'data/_build/' \
  -e "$RSYNC_SSH" \
  "$ROOT/" "${TARGET}:${REMOTE_DIR}/"

echo "==> Restart service ${SERVICE_NAME}"
"${SSH_CMD[@]}" "$TARGET" "sudo systemctl restart '${SERVICE_NAME}' && sleep 1 && systemctl is-active '${SERVICE_NAME}'"

echo "==> Smoke checks"
curl -fsS --connect-timeout 10 "${PUBLIC_BASE}/" >/dev/null
curl -fsS --connect-timeout 10 "${PUBLIC_BASE}/api/advisor-ping" | grep -q '"ok":true'
curl -fsS --connect-timeout 10 "${PUBLIC_BASE}/api/staff-login" | grep -q '"ok":true'
curl -fsS -o /dev/null -w "%{http_code}" --connect-timeout 10 "${PUBLIC_BASE}/calculator/" | grep -Eq '200|301|302'

echo "==> Deploy OK ? ${PUBLIC_BASE}"
