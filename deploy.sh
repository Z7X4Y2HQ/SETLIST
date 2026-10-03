#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3001
LOG_FILE="$APP_DIR/setlist.log"

cd "$APP_DIR"

echo "Pulling latest changes..."
git pull --ff-only

echo "Installing dependencies..."
npm ci

echo "Building Setlist..."
npm run build

echo "Stopping the previous Setlist server on port $PORT..."
fuser -k "$PORT/tcp" 2>/dev/null || true
sleep 1

echo "Starting Setlist on port $PORT..."
nohup npm run preview -- --host 0.0.0.0 --port "$PORT" --strictPort > "$LOG_FILE" 2>&1 &

for attempt in {1..10}; do
  if curl --fail --silent --output /dev/null "http://127.0.0.1:$PORT/"; then
    echo "Setlist is running on port $PORT. Logs: $LOG_FILE"
    exit 0
  fi
  sleep 1
done

echo "Setlist did not respond on port $PORT. See logs: $LOG_FILE" >&2
cat "$LOG_FILE" >&2
exit 1
