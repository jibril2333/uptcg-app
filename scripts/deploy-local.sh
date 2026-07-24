#!/usr/bin/env bash

set -Eeuo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

: "${UPTCG_DATA_DIR:?UPTCG_DATA_DIR must be an absolute host directory}"
: "${UPTCG_IMAGE:=uptcg-app:prod}"
: "${UPTCG_PORT:=3002}"
: "${UPTCG_UID:=501}"
: "${UPTCG_GID:=20}"

if [[ "$UPTCG_DATA_DIR" != /* ]]; then
  echo "UPTCG_DATA_DIR must be absolute: $UPTCG_DATA_DIR" >&2
  exit 1
fi

export UPTCG_DATA_DIR UPTCG_IMAGE UPTCG_PORT UPTCG_UID UPTCG_GID
export PATH="/Applications/Docker.app/Contents/Resources/bin:/opt/homebrew/bin:$PATH"

if ! docker info >/dev/null 2>&1; then
  echo "Docker Desktop is not running on this Mac." >&2
  exit 1
fi

echo "Building $UPTCG_IMAGE on this Mac..."
docker compose build --pull uptcg

legacy_label="com.rayne.uptcg-local"
user_domain="gui/$(id -u)"

# The previous LaunchAgent served the same database on port 3002. Disable it
# immediately before the container swap so the database and port have one owner.
launchctl bootout "$user_domain/$legacy_label" >/dev/null 2>&1 || true
launchctl disable "$user_domain/$legacy_label" >/dev/null 2>&1 || true

mkdir -p "$UPTCG_DATA_DIR/backups"
database_path="$UPTCG_DATA_DIR/uptcg.sqlite"

if [[ -f "$database_path" ]] && command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$database_path" "PRAGMA wal_checkpoint(TRUNCATE);"
  backup_path="$UPTCG_DATA_DIR/backups/uptcg-before-${GITHUB_RUN_ID:-manual}.sqlite"
  sqlite3 "$database_path" ".backup '$backup_path'"
  echo "Database backup: $backup_path"
fi

echo "Recreating the UPTCG container on port $UPTCG_PORT..."
docker compose up -d --force-recreate --remove-orphans uptcg

for attempt in $(seq 1 60); do
  if curl --fail --silent --show-error \
    --max-time 3 "http://127.0.0.1:${UPTCG_PORT}/" >/dev/null; then
    echo "UPTCG is healthy at http://127.0.0.1:${UPTCG_PORT}/"
    docker compose ps
    docker image prune --force
    exit 0
  fi
  sleep 1
done

echo "UPTCG did not become healthy within 60 seconds." >&2
docker compose ps >&2
docker compose logs --tail=150 uptcg >&2
exit 1
