#!/bin/zsh

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
