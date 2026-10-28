#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SMOKE_DIR="$(mktemp -d /tmp/payment-ledger-smoke.XXXXXX)"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID"
    wait "$SERVER_PID" || true
  fi
  rm -rf "$SMOKE_DIR"
}
trap cleanup EXIT

cd "$PROJECT_DIR"
PAYMENT_LEDGER_DATA_DIR="$SMOKE_DIR" pnpm start >"$SMOKE_DIR/server.log" 2>&1 &
SERVER_PID=$!

for _ in {1..40}; do
  if curl --fail --silent --header 'Host: 127.0.0.1:4782' http://127.0.0.1:4782/api/health >"$SMOKE_DIR/health.json"; then
    break
  fi
  sleep 0.25
done

rg '"status":"ok"' "$SMOKE_DIR/health.json"
curl --fail --silent --header 'Host: 127.0.0.1:4782' http://127.0.0.1:4782/ | rg '<html lang="en">'
ss -ltnp 'sport = :4782' | rg '127\.0\.0\.1:4782'
if ss -ltnp 'sport = :4782' | rg -q '0\.0\.0\.0:4782|\[::\]:4782'; then
  echo 'Unsafe non-loopback listener detected' >&2
  exit 1
fi

RSS_KIB="$(ps -o rss= -p "$SERVER_PID" | tr -d ' ')"
echo "production smoke passed; server RSS=${RSS_KIB} KiB"
