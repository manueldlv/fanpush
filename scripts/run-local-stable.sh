#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/port-utils.sh"
extract_port_args "${PORT:-3000}" "$@"
stop_repo_server_on_port "$ROOT_DIR" "$REQUESTED_PORT"
resolved_port="$(find_available_port "$REQUESTED_PORT")"

if [ "$resolved_port" != "$REQUESTED_PORT" ]; then
  printf 'Puerto %s ocupado. Usando %s.\n' "$REQUESTED_PORT" "$resolved_port"
fi

dist_pids="$(lsof -t "$ROOT_DIR/.next" 2>/dev/null || true)"
if [ -n "$dist_pids" ]; then
  kill $dist_pids 2>/dev/null || true
fi

rm -rf .next

npx next build
exec npx next start "${SANITIZED_ARGS[@]}" -p "$resolved_port"
