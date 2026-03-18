#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

for port in 3000 3001 3002 3003 3004 3005; do
  pids="$(lsof -ti tcp:$port || true)"
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null || true
  fi
done

dist_pids="$(lsof -t "$ROOT_DIR/.next" 2>/dev/null || true)"
if [ -n "$dist_pids" ]; then
  kill $dist_pids 2>/dev/null || true
fi

rm -rf .next

npx next build
exec npx next start "$@"
