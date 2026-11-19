#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

deploy_key="${LUMINO_DEPLOY_KEY:-$HOME/.ssh/lumino_tencent_deploy}"
known_hosts_file="${LUMINO_KNOWN_HOSTS:-$HOME/.ssh/known_hosts}"
vercel_base="${VERCEL_PRODUCTION_URL:-https://lumino-official-website.vercel.app}"

[[ -f "$deploy_key" ]] || { echo "Missing deploy key: $deploy_key" >&2; exit 2; }
[[ -f "$known_hosts_file" ]] || { echo "Missing known_hosts: $known_hosts_file" >&2; exit 2; }
: "${DEPLOY_HOST:?Set DEPLOY_HOST to the approved Tencent production host}"
: "${DEPLOY_USER:?Set DEPLOY_USER to the approved Tencent deploy user}"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Local checkout must be clean before a production release" >&2
  exit 2
fi

git fetch origin main
release_sha="$(git rev-parse HEAD)"
remote_main="$(git rev-parse origin/main)"
[[ "$release_sha" == "$remote_main" ]] || {
  echo "HEAD must equal origin/main ($remote_main), got $release_sha" >&2
  exit 2
}

vercel_response="$(curl -fsS --connect-timeout 10 --max-time 30 "${vercel_base%/}/api/release")"
[[ "$vercel_response" == *"\"releaseSha\":\"$release_sha\""* ]] || {
  echo "Vercel is not serving $release_sha: $vercel_response" >&2
  exit 1
}

export RELEASE_SHA="$release_sha"
export SSH_PRIVATE_KEY="$(< "$deploy_key")"
export SSH_KNOWN_HOSTS="$(< "$known_hosts_file")"
export GITHUB_RUN_ID="local-$(date -u +%Y%m%dT%H%M%SZ)"
export GITHUB_RUN_ATTEMPT=1

echo "Deploying verified main SHA $release_sha from the local release host"
"$root/scripts/deploy-tencent.sh"

vercel_response="$(curl -fsS --connect-timeout 10 --max-time 30 "${vercel_base%/}/api/release")"
[[ "$vercel_response" == *"\"releaseSha\":\"$release_sha\""* ]]
echo "Vercel and Tencent are both serving $release_sha"
