#!/bin/sh
# DayFlow PRIVATE Linux staging lifecycle. No root or system service changes.
set -eu
umask 077

if [ "$(id -un)" != "dayflow-dev" ]; then
  echo "ERROR: this script may only run as dayflow-dev"
  exit 2
fi

base="$HOME/dayflow-staging"
run="$base/run"
logs="$base/logs"
current="$base/current"
pid_file="$run/dayflow-stage.pid"
log_file="$logs/dayflow-staging.log"
pg_data="$base/shared/artifacts/dayflow-local-preview/postgres-data"
ui_port=5183
pg_port=55435

require_stage() {
  [ -L "$current" ] && [ -d "$current" ] || {
    echo "ERROR: private staged release is missing"
    exit 3
  }
  resolved="$(readlink -f "$current")"
  case "$resolved" in
    "$base"/releases/*) ;;
    *) echo "ERROR: current release path outside staging"; exit 4 ;;
  esac
  [ -d "$run" ] && [ -d "$logs" ] || exit 5
}

active_process() {
  [ -f "$pid_file" ] || return 1
  pid="$(cat "$pid_file")"
  case "$pid" in
    ''|*[!0-9]*) return 1 ;;
  esac
  kill -0 "$pid" 2>/dev/null || return 1
  [ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)" = "$(readlink -f "$current")" ] || return 1
  ps -p "$pid" -o args= | grep -F "node scripts/start-local-preview.mjs" >/dev/null
}

listening() {
  port="$1"
  ss -ltnH | awk '{print $4}' | grep -E "[:.]$port$" || true
}

ports_bound_only_loopback() {
  for port in "$ui_port" "$pg_port"; do
    found="$(listening "$port")"
    [ -n "$found" ] || return 1
    if printf '%s\n' "$found" | grep -v '^127\.0\.0\.1:' >/dev/null; then
      return 1
    fi
  done
}

ports_free() {
  [ -z "$(listening "$ui_port")" ] && [ -z "$(listening "$pg_port")" ]
}

healthy() {
  curl -fsS --max-time 3 "http://127.0.0.1:$ui_port/api/health" >/dev/null 2>&1 || return 1
  anon="$(curl -sS --max-time 3 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$ui_port/api/auth/me" || true)"
  [ "$anon" = "401" ] && ports_bound_only_loopback
}

status() {
  require_stage
  if active_process && healthy; then
    echo "DAYFLOW_PRIVATE_STAGE_RUNNING=PASS"
    echo "LOCAL_LINUX_URL=http://127.0.0.1:$ui_port"
    echo "ANONYMOUS_SESSION_DENIED=PASS"
    echo "STAGING_LISTENERS_LOOPBACK_ONLY=PASS"
    exit 0
  fi
  echo "DAYFLOW_PRIVATE_STAGE_NOT_HEALTHY"
  exit 1
}

start() {
  require_stage
  if active_process; then
    status
    exit 0
  fi
  # Stale PID files are not silently replaced; diagnosis may matter.
  [ ! -e "$pid_file" ] || {
    echo "ERROR: a stale/foreign PID file exists; inspect and archive manually"
    exit 6
  }
  [ ! -e "$log_file" ] || {
    echo "ERROR: previous log exists; inspect and archive manually"
    exit 7
  }
  ports_free || {
    echo "ERROR: staging port is in use; no process was touched"
    exit 8
  }
  [ ! -f "$pg_data/postmaster.pid" ] || {
    echo "ERROR: existing PostgreSQL postmaster lock found; no process was touched"
    exit 9
  }
  [ ! -e "$run/.dayflow-start-lock" ] || {
    echo "ERROR: startup lock exists; investigate before retry"
    exit 10
  }
  mkdir -m 700 "$run/.dayflow-start-lock"
  trap 'rmdir "$run/.dayflow-start-lock" 2>/dev/null || true' EXIT HUP INT TERM
  cd "$current"
  nohup env -u DATABASE_URL NODE_ENV=development \
    DAYFLOW_PREVIEW_UI_PORT="$ui_port" \
    DAYFLOW_PREVIEW_PG_PORT="$pg_port" \
    DAYFLOW_DEMO_NO_OPEN=1 node scripts/start-local-preview.mjs \
    > "$log_file" 2>&1 < /dev/null &
  pid="$!"
  printf '%s\n' "$pid" > "$pid_file"

  tries=0
  while [ "$tries" -lt 45 ]; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "ERROR: staging exited; read the private log"
      exit 11
    fi
    if healthy; then
      echo "DAYFLOW_PRIVATE_STAGE_STARTED=PASS"
      echo "DAYFLOW_PRIVATE_STAGE_HEALTH=PASS"
      exit 0
    fi
    sleep 1
    tries=$((tries + 1))
  done
  echo "ERROR: staging did not become healthy; preserve logs for investigation"
  exit 12
}

stop() {
  require_stage
  active_process || {
    echo "ERROR: PID is absent or does not belong to this DayFlow release"
    exit 13
  }
  pid="$(cat "$pid_file")"
  kill -TERM "$pid"
  tries=0
  while [ "$tries" -lt 40 ]; do
    if ! kill -0 "$pid" 2>/dev/null && ports_free && [ ! -e "$pg_data/postmaster.pid" ]; then
      break
    fi
    sleep 1
    tries=$((tries + 1))
  done
  if kill -0 "$pid" 2>/dev/null || ! ports_free || [ -e "$pg_data/postmaster.pid" ]; then
    echo "ERROR: graceful stop unconfirmed; no forced kill performed"
    exit 14
  fi
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  [ ! -e "$run/dayflow-stage.stopped-$stamp.pid" ] || exit 15
  [ ! -e "$logs/dayflow-staging.stopped-$stamp.log" ] || exit 16
  mv "$pid_file" "$run/dayflow-stage.stopped-$stamp.pid"
  if [ -f "$log_file" ]; then
    mv "$log_file" "$logs/dayflow-staging.stopped-$stamp.log"
  fi
  echo "DAYFLOW_PRIVATE_STAGE_GRACEFUL_STOP=PASS"
  echo "DAYFLOW_PRIVATE_STAGE_PORTS_RELEASED=PASS"
}

case "${1:-status}" in
  status) status ;;
  start) start ;;
  stop) stop ;;
  *) echo "Usage: sh dayflow-staging-ops.sh {status|start|stop}"; exit 64 ;;
esac
