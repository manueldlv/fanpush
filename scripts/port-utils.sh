#!/bin/zsh

port_owner_pid() {
  local port="$1"
  local pids
  pids="$(lsof -ti "tcp:$port" 2>/dev/null || true)"
  printf '%s\n' "${pids%%$'\n'*}"
}

pid_cwd() {
  local pid="$1"
  local lines
  local line
  lines="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null || true)"

  for line in ${(f)lines}; do
    if [[ "$line" == n* ]]; then
      printf '%s\n' "${line#n}"
      return 0
    fi
  done
}

stop_repo_server_on_port() {
  local root_dir="$1"
  local port="$2"
  local pid
  pid="$(port_owner_pid "$port")"

  if [ -z "$pid" ]; then
    return 0
  fi

  local cwd
  cwd="$(pid_cwd "$pid")"

  if [ "$cwd" = "$root_dir" ]; then
    printf 'Puerto %s ocupado por un servidor previo del repo. Cerrando PID %s.\n' "$port" "$pid"
    kill "$pid" 2>/dev/null || true
    sleep 1
  fi
}

extract_port_args() {
  local default_port="$1"
  shift

  REQUESTED_PORT="$default_port"
  SANITIZED_ARGS=()
  local expecting_port=0

  for arg in "$@"; do
    if [ "$expecting_port" = 1 ]; then
      REQUESTED_PORT="$arg"
      expecting_port=0
      continue
    fi

    case "$arg" in
      -p|--port)
        expecting_port=1
        ;;
      --port=*)
        REQUESTED_PORT="${arg#*=}"
        ;;
      *)
        SANITIZED_ARGS+=("$arg")
        ;;
    esac
  done

  if [ "$expecting_port" = 1 ]; then
    echo "Falta un valor para el puerto." >&2
    return 1
  fi
}

find_available_port() {
  local candidate="$1"

  if ! [[ "$candidate" =~ ^[0-9]+$ ]]; then
    echo "Puerto invalido: $candidate" >&2
    return 1
  fi

  while lsof -ti "tcp:$candidate" >/dev/null 2>&1; do
    candidate=$((candidate + 1))
  done

  echo "$candidate"
}
