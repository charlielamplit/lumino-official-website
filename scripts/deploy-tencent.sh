#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
host="${DEPLOY_HOST:?DEPLOY_HOST required}"
user_name="${DEPLOY_USER:-ubuntu}"
deploy_dir="${DEPLOY_DIR:-/var/www/lumino}"
service_name="${DEPLOY_SERVICE:-lumino-site}"
public_edge_base="${PUBLIC_EDGE_URL:-http://${host}}"
health_base="${TENCENT_HEALTH_URL:-http://127.0.0.1:4174}"
release_sha="${RELEASE_SHA:?RELEASE_SHA required}"
known_hosts="${SSH_KNOWN_HOSTS:?SSH_KNOWN_HOSTS required}"
ssh_private_key="${SSH_PRIVATE_KEY:?SSH_PRIVATE_KEY required}"
public_edge_base="${public_edge_base%/}"
health_base="${health_base%/}"

[[ "$release_sha" =~ ^[0-9a-f]{40}$ ]] || {
  echo "RELEASE_SHA must be a full lowercase Git SHA" >&2
  exit 2
}

key_file="$(mktemp)"
stage="$(mktemp -d)"
cleanup() {
  rm -f "$key_file"
  rm -rf "$stage"
}
trap cleanup EXIT

printf '%s\n' "$ssh_private_key" > "$key_file"
chmod 600 "$key_file"
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
printf '%s\n' "$known_hosts" > "$HOME/.ssh/known_hosts"
chmod 600 "$HOME/.ssh/known_hosts"

ssh_command=(
  ssh -i "$key_file"
  -o BatchMode=yes
  -o ConnectTimeout=10
  -o ConnectionAttempts=2
  -o StrictHostKeyChecking=yes
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=3
)
rsync_ssh="ssh -i $key_file -o BatchMode=yes -o ConnectTimeout=10 -o ConnectionAttempts=2 -o StrictHostKeyChecking=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3"
target="${user_name}@${host}"
releases_dir="${deploy_dir}.releases"
shared_dir="${deploy_dir}.shared"
release_instance="${GITHUB_RUN_ID:-manual}-${GITHUB_RUN_ATTEMPT:-1}-$(date -u +%Y%m%dT%H%M%SZ)"
remote_upload="${releases_dir}/.${release_sha}.upload-${release_instance}"
remote_release="${releases_dir}/${release_sha}-${release_instance}"

copy_runtime_dir() {
  local source="$1"
  local destination="$2"
  [[ -d "$root/$source" ]] || return 0
  mkdir -p "$stage/$destination"
  rsync -a \
    --exclude 'tests/' \
    --exclude 'evals/' \
    --exclude 'prompts/' \
    --exclude 'README.md' \
    "$root/$source/" "$stage/$destination/"
}

echo "==> Build immutable release $release_sha"
copy_runtime_dir apps/site apps/site
copy_runtime_dir apps/portal apps/portal
copy_runtime_dir api api
copy_runtime_dir packages/shared packages/shared
copy_runtime_dir packages/advisor packages/advisor
copy_runtime_dir packages/agent packages/agent
copy_runtime_dir packages/platform packages/platform
copy_runtime_dir db/migrations db/migrations
copy_runtime_dir scripts/db scripts/db

mkdir -p "$stage/scripts"
cp "$root/scripts/local-site-server.mjs" "$stage/scripts/local-site-server.mjs"
cp "$root/scripts/tencent-activate-release.sh" "$stage/scripts/tencent-activate-release.sh"
cp "$root/vercel.json" "$stage/vercel.json"
cp "$root/index.html" "$stage/index.html"
for manifest in package.json package-lock.json; do
  [[ -f "$root/$manifest" ]] && cp "$root/$manifest" "$stage/$manifest"
done
find "$root" -maxdepth 1 -type f \
  \( -name 'favicon.*' -o -name 'apple-touch-icon.png' -o -name 'Lumino *.dc.html' \) \
  -exec cp {} "$stage/" \;

printf '%s\n' "$release_sha" > "$stage/.release-sha"
printf '{"releaseSha":"%s"}\n' "$release_sha" > "$stage/release.json"

echo "==> Seed a new release from the current Tencent release"
"${ssh_command[@]}" "$target" bash -s -- \
  "$deploy_dir" "$releases_dir" "$shared_dir" "$remote_upload" "$user_name" <<'REMOTE_SEED'
set -Eeuo pipefail
deploy_dir="$1"
releases_dir="$2"
shared_dir="$3"
upload_dir="$4"
user_name="$5"

sudo mkdir -p "$releases_dir" "$shared_dir"
sudo chown "$user_name:$user_name" "$releases_dir" "$shared_dir"
rm -rf "$upload_dir"
mkdir -p "$upload_dir"
base="$(readlink -f "$deploy_dir" 2>/dev/null || true)"
if [[ -n "$base" && -d "$base" ]]; then
  rsync -a \
    --link-dest="$base" \
    --exclude '/node_modules/' \
    --exclude '/data' \
    --exclude '/.env' \
    "$base/" "$upload_dir/"
fi
rm -rf "$upload_dir/node_modules" "$upload_dir/data" "$upload_dir/.env"
REMOTE_SEED

echo "==> Sync only release differences without touching the live directory"
timeout --foreground 8m rsync -az --delete --timeout=180 --stats \
  -e "$rsync_ssh" "$stage/" "${target}:${remote_upload}/"

echo "==> Install production dependencies before activation"
"${ssh_command[@]}" "$target" bash -s -- "$remote_upload" <<'REMOTE_PREPARE'
set -Eeuo pipefail
upload_dir="$1"
if [[ -f "$upload_dir/package-lock.json" ]]; then
  cd "$upload_dir"
  timeout --foreground 5m npm ci --omit=dev --ignore-scripts
fi
REMOTE_PREPARE

echo "==> Finalize and activate release"
"${ssh_command[@]}" "$target" \
  "mv '$remote_upload' '$remote_release' && chmod +x '$remote_release/scripts/tencent-activate-release.sh'"
"${ssh_command[@]}" "$target" \
  "$remote_release/scripts/tencent-activate-release.sh activate '$deploy_dir' '$remote_release' '$shared_dir' '$service_name'"

smoke_failed=false
check_edge_status() {
  local label="$1"
  local url="$2"
  local allowed="$3"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 10 --max-time 30 "$url" || true)"
  if [[ ! "$code" =~ $allowed ]]; then
    echo "Edge smoke failed: $label returned $code ($url)" >&2
    smoke_failed=true
  else
    echo "Edge smoke passed: $label returned $code"
  fi
}

echo "==> Verify Tencent edge and service-local routes"
check_edge_status nginx "$public_edge_base/" '^(200|301|302)$'
if ! "${ssh_command[@]}" "$target" bash -s -- "$health_base" "$release_sha" <<'REMOTE_SMOKE'
set -Eeuo pipefail
health_base="$1"
release_sha="$2"

check_status() {
  local label="$1"
  local path="$2"
  local allowed="$3"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 20 "$health_base$path" || true)"
  if [[ ! "$code" =~ $allowed ]]; then
    echo "Service smoke failed: $label returned $code ($path)" >&2
    return 1
  fi
  echo "Service smoke passed: $label returned $code"
}

check_status home / '^(200|301|302)$'
check_status site /site '^(200|301|302)$'
check_status calculator /calculator/ '^(200|301|302)$'
check_status portal /portal/ '^(200|301|302)$'
check_status advisor-ping /api/advisor-ping '^200$'
check_status staff-login /api/staff-login '^200$'
check_status leads-auth /api/leads '^401$'

release_response="$(curl -fsS --connect-timeout 5 --max-time 20 "$health_base/api/release")"
[[ "$release_response" == *"\"releaseSha\":\"$release_sha\""* ]] || {
  echo "Service smoke failed: release SHA mismatch: $release_response" >&2
  exit 1
}
echo "Service smoke passed: Tencent is serving $release_sha"
REMOTE_SMOKE
then
  smoke_failed=true
fi

if [[ "$smoke_failed" == true ]]; then
  echo "==> Smoke checks failed; rolling back"
  "${ssh_command[@]}" "$target" \
    "$remote_release/scripts/tencent-activate-release.sh rollback '$deploy_dir' '$remote_release' '$shared_dir' '$service_name'"
  exit 1
fi

echo "==> Tencent deployment complete: $release_sha"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "release_sha=$release_sha" >> "$GITHUB_OUTPUT"
fi
