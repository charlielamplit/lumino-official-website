#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
host="${DEPLOY_HOST:?DEPLOY_HOST required}"
user_name="${DEPLOY_USER:-ubuntu}"
deploy_dir="${DEPLOY_DIR:-/var/www/lumino}"
service_name="${DEPLOY_SERVICE:-lumino-site}"
public_base="${PUBLIC_SITE_URL:?PUBLIC_SITE_URL required}"
release_sha="${RELEASE_SHA:?RELEASE_SHA required}"
known_hosts="${SSH_KNOWN_HOSTS:?SSH_KNOWN_HOSTS required}"
ssh_private_key="${SSH_PRIVATE_KEY:?SSH_PRIVATE_KEY required}"
public_base="${public_base%/}"

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

ssh_command=(ssh -i "$key_file" -o StrictHostKeyChecking=yes -o ServerAliveInterval=30)
rsync_ssh="ssh -i $key_file -o StrictHostKeyChecking=yes -o ServerAliveInterval=30"
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

echo "==> Upload release without touching the live directory"
"${ssh_command[@]}" "$target" \
  "sudo mkdir -p '$releases_dir' '$shared_dir' && sudo chown '$user_name:$user_name' '$releases_dir' '$shared_dir' && rm -rf '$remote_upload' && mkdir -p '$remote_upload'"
rsync -az -e "$rsync_ssh" "$stage/" "${target}:${remote_upload}/"

echo "==> Install production dependencies before activation"
"${ssh_command[@]}" "$target" bash -s -- "$remote_upload" <<'REMOTE_PREPARE'
set -Eeuo pipefail
upload_dir="$1"
if [[ -f "$upload_dir/package-lock.json" ]]; then
  cd "$upload_dir"
  npm ci --omit=dev --ignore-scripts
fi
REMOTE_PREPARE

echo "==> Finalize and activate release"
"${ssh_command[@]}" "$target" \
  "mv '$remote_upload' '$remote_release' && chmod +x '$remote_release/scripts/tencent-activate-release.sh'"
"${ssh_command[@]}" "$target" \
  "$remote_release/scripts/tencent-activate-release.sh activate '$deploy_dir' '$remote_release' '$shared_dir' '$service_name'"

smoke_failed=false
check_status() {
  local label="$1"
  local url="$2"
  local allowed="$3"
  local code
  code="$(curl -LsS -o /dev/null -w '%{http_code}' --connect-timeout 10 --max-time 30 "$url" || true)"
  if [[ ! "$code" =~ $allowed ]]; then
    echo "Smoke failed: $label returned $code ($url)" >&2
    smoke_failed=true
  else
    echo "Smoke passed: $label returned $code"
  fi
}

echo "==> Verify public routes"
check_status home "$public_base/" '^(200|301|302)$'
check_status site "$public_base/site" '^(200|301|302)$'
check_status calculator "$public_base/calculator/" '^(200|301|302)$'
check_status portal "$public_base/portal/" '^(200|301|302)$'
check_status advisor-ping "$public_base/api/advisor-ping" '^200$'
check_status staff-login "$public_base/api/staff-login" '^200$'
check_status leads-auth "$public_base/api/leads" '^401$'

release_response="$(curl -fLsS --connect-timeout 10 --max-time 30 "$public_base/api/release" || true)"
if [[ "$release_response" != *"\"releaseSha\":\"$release_sha\""* ]]; then
  echo "Smoke failed: release SHA mismatch: $release_response" >&2
  smoke_failed=true
else
  echo "Smoke passed: Tencent is serving $release_sha"
fi

if [[ "$smoke_failed" == true ]]; then
  echo "==> Smoke checks failed; rolling back"
  "${ssh_command[@]}" "$target" \
    "$remote_release/scripts/tencent-activate-release.sh rollback '$deploy_dir' '$remote_release' '$shared_dir' '$service_name'"
  exit 1
fi

echo "==> Tencent deployment complete: $release_sha"
