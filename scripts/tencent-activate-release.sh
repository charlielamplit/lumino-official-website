#!/usr/bin/env bash
set -Eeuo pipefail

action="${1:?action required}"
deploy_dir="${2:?deploy directory required}"
release_dir="${3:?release directory required}"
shared_dir="${4:?shared directory required}"
service_name="${5:?service name required}"
previous_file="${shared_dir}/previous-release"

restart_service() {
  sudo systemctl restart "$service_name"
  systemctl is-active --quiet "$service_name"
}

link_target() {
  local target="$1"
  local temporary="${deploy_dir}.next.$$"
  sudo rm -f "$temporary"
  sudo ln -s "$target" "$temporary"
  sudo mv -Tf "$temporary" "$deploy_dir"
}

prepare_shared_runtime() {
  mkdir -p "$shared_dir/data"
  if [[ -d "$deploy_dir" && ! -L "$deploy_dir" ]]; then
    if [[ ! -e "$shared_dir/.env" && -f "$deploy_dir/.env" ]]; then
      cp -p "$deploy_dir/.env" "$shared_dir/.env"
    fi
    if [[ -d "$deploy_dir/data" && ! -L "$deploy_dir/data" ]]; then
      cp -a "$deploy_dir/data/." "$shared_dir/data/"
    fi
  fi

  rm -rf "$release_dir/data"
  ln -s "$shared_dir/data" "$release_dir/data"
  if [[ -f "$shared_dir/.env" ]]; then
    rm -f "$release_dir/.env"
    ln -s "$shared_dir/.env" "$release_dir/.env"
  fi
}

case "$action" in
  activate)
    [[ -d "$release_dir" ]] || { echo "Release does not exist: $release_dir" >&2; exit 1; }
    mkdir -p "$shared_dir"
    prepare_shared_runtime

    if [[ -L "$deploy_dir" ]]; then
      previous_target="$(readlink -f "$deploy_dir")"
      sudo rm -f "$deploy_dir"
    elif [[ -d "$deploy_dir" ]]; then
      previous_target="${deploy_dir}.releases/legacy-$(date -u +%Y%m%dT%H%M%SZ)"
      sudo mv "$deploy_dir" "$previous_target"
      if [[ -f "$previous_target/.env" && ! -L "$previous_target/.env" ]]; then
        sudo mv "$previous_target/.env" "$previous_target/.env.pre-shared"
        sudo ln -s "$shared_dir/.env" "$previous_target/.env"
      fi
      if [[ -d "$previous_target/data" && ! -L "$previous_target/data" ]]; then
        sudo mv "$previous_target/data" "$previous_target/data.pre-shared"
        sudo ln -s "$shared_dir/data" "$previous_target/data"
      fi
    else
      previous_target=""
      sudo rm -f "$deploy_dir"
    fi

    printf '%s\n' "$previous_target" > "$previous_file"
    link_target "$release_dir"
    if ! restart_service; then
      sudo rm -f "$deploy_dir"
      if [[ -n "$previous_target" && -d "$previous_target" ]]; then
        link_target "$previous_target"
        restart_service || true
      fi
      echo "Service restart failed; previous release restored" >&2
      exit 1
    fi
    ;;
  rollback)
    [[ -f "$previous_file" ]] || { echo "No previous release recorded" >&2; exit 1; }
    previous_target="$(head -n 1 "$previous_file")"
    [[ -n "$previous_target" && -d "$previous_target" ]] || {
      echo "Previous release is unavailable: $previous_target" >&2
      exit 1
    }
    sudo rm -f "$deploy_dir"
    link_target "$previous_target"
    restart_service
    ;;
  *)
    echo "Unknown action: $action" >&2
    exit 2
    ;;
esac
