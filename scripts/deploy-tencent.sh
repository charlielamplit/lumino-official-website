#!/usr/bin/env bash
set -Eeuo pipefail

host="${DEPLOY_HOST:?DEPLOY_HOST required}"
user_name="${DEPLOY_USER:-ubuntu}"
deploy_dir="${DEPLOY_DIR:-/var/www/lumino}"
service_name="${DEPLOY_SERVICE:-lumino-site}"
public_edge_base="${PUBLIC_EDGE_URL:-http://${host}}"
health_base="${TENCENT_HEALTH_URL:-http://127.0.0.1:4174}"
release_sha="${RELEASE_SHA:?RELEASE_SHA required}"
known_hosts="${SSH_KNOWN_HOSTS:?SSH_KNOWN_HOSTS required}"
ssh_private_key="${SSH_PRIVATE_KEY:?SSH_PRIVATE_KEY required}"
repository="${GITHUB_REPOSITORY:-charlielamplit/lumino-official-website}"
public_edge_base="${public_edge_base%/}"
health_base="${health_base%/}"

[[ "$release_sha" =~ ^[0-9a-f]{40}$ ]] || {
  echo "RELEASE_SHA must be a full lowercase Git SHA" >&2
  exit 2
}

key_file="$(mktemp)"
cleanup() {
  rm -f "$key_file"
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
target="${user_name}@${host}"
releases_dir="${deploy_dir}.releases"
shared_dir="${deploy_dir}.shared"
release_instance="${GITHUB_RUN_ID:-manual}-${GITHUB_RUN_ATTEMPT:-1}-$(date -u +%Y%m%dT%H%M%SZ)"
remote_upload="${releases_dir}/.${release_sha}.upload-${release_instance}"
remote_archive="${releases_dir}/.${release_sha}.upload-${release_instance}.tar.gz"
remote_release="${releases_dir}/${release_sha}-${release_instance}"
source_archive="https://codeload.github.com/${repository}/tar.gz/${release_sha}"

echo "==> Pull immutable release $release_sha on Tencent without touching the live directory"
"${ssh_command[@]}" "$target" bash -s -- \
  "$releases_dir" "$shared_dir" "$remote_upload" "$remote_archive" "$source_archive" "$release_sha" "$user_name" <<'REMOTE_FETCH'
set -Eeuo pipefail
releases_dir="$1"
shared_dir="$2"
upload_dir="$3"
archive_file="$4"
source_archive="$5"
release_sha="$6"
user_name="$7"

sudo mkdir -p "$releases_dir" "$shared_dir"
sudo chown "$user_name:$user_name" "$releases_dir" "$shared_dir"
rm -rf "$upload_dir" "$archive_file"
mkdir -p "$upload_dir"
timeout --foreground 12m curl \
  --fail --location --silent --show-error \
  --retry 4 --retry-all-errors --connect-timeout 15 --max-time 660 \
  "$source_archive" --output "$archive_file"
tar -xzf "$archive_file" --strip-components=1 -C "$upload_dir"
rm -f "$archive_file"
printf '%s\n' "$release_sha" > "$upload_dir/.release-sha"
printf '{"releaseSha":"%s"}\n' "$release_sha" > "$upload_dir/release.json"
REMOTE_FETCH

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
