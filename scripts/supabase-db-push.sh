#!/usr/bin/env zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

load_env_file() {
  local env_file="$1"
  if [ ! -f "$env_file" ]; then
    return
  fi

  while IFS= read -r raw_line || [ -n "$raw_line" ]; do
    local line="${raw_line#"${raw_line%%[![:space:]]*}"}"
    if [ -z "$line" ] || [[ "$line" == \#* ]]; then
      continue
    fi

    if [[ "$line" != *=* ]]; then
      continue
    fi

    local key="${line%%=*}"
    local value="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"

    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi

    export "$key=$value"
  done < "$env_file"
}

load_env_file "$ROOT_DIR/.env"
load_env_file "$ROOT_DIR/.env.local"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI no esta instalada."
  echo "Instalala desde https://supabase.com/docs/guides/cli"
  exit 1
fi

if [ ! -d "$ROOT_DIR/supabase/migrations" ]; then
  echo "No existe el directorio supabase/migrations."
  exit 1
fi

if [ -n "${SUPABASE_DB_URL:-}" ]; then
  echo "Aplicando migraciones con SUPABASE_DB_URL..."
  exec supabase db push --db-url "$SUPABASE_DB_URL"
fi

if [ -n "${SUPABASE_HOST:-}" ] && [ -n "${SUPABASE_PORT:-}" ] && [ -n "${SUPABASE_USER:-}" ] && [ -n "${SUPABASE_DATABASE:-}" ] && [ -n "${SUPABASE_PASSWORD:-}" ]; then
  DB_URL="postgresql://${SUPABASE_USER}:${SUPABASE_PASSWORD}@${SUPABASE_HOST}:${SUPABASE_PORT}/${SUPABASE_DATABASE}"
  echo "Aplicando migraciones con conexion Postgres directa..."
  exec supabase db push --db-url "$DB_URL"
fi

if [ -f "$ROOT_DIR/supabase/config.toml" ]; then
  echo "Aplicando migraciones con proyecto Supabase linkeado..."
  exec supabase db push
fi

cat <<'EOF'
No pude resolver una conexion para Supabase.

Opciones soportadas:
1. Exportar SUPABASE_DB_URL
2. Exportar SUPABASE_HOST, SUPABASE_PORT, SUPABASE_USER, SUPABASE_DATABASE y SUPABASE_PASSWORD
3. Linkear el proyecto con `supabase link` para usar supabase/config.toml

Despues corre:
  npm run db:push
EOF
exit 1
