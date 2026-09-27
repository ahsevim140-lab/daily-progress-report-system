#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -f dist/index.html ]]; then echo 'Offline build is missing. Run npm run build first.'; exit 1; fi
command -v node >/dev/null || { echo 'Node.js 20 or newer is required.'; exit 1; }
node offline-server.mjs &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
sleep 1
if command -v xdg-open >/dev/null; then xdg-open http://127.0.0.1:3000 >/dev/null 2>&1 || true; fi
wait "$server_pid"
