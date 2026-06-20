#!/bin/bash
# Mercury — start all services
# Usage: ./start.sh [--no-ml] [--no-frontend] [--import-tm]

set -e

REPO=$(cd "$(dirname "$0")" && pwd)
ML_REPO="$REPO/../mercury-ml"
FRONTEND_REPO="$REPO/../mercury-frontend"

START_ML=true
START_FRONTEND=true
IMPORT_TM=false

for arg in "$@"; do
  case $arg in
    --no-ml)       START_ML=false ;;
    --no-frontend) START_FRONTEND=false ;;
    --import-tm)   IMPORT_TM=true ;;
  esac
done

cd "$REPO"
# set -a exports every variable defined after this line to child processes
set -a
source .env 2>/dev/null || true
set +a

echo "▶ Stopping stale Mercury processes..."
pkill -f "node apps/api/dist/index.js|node apps/worker/dist/index.js|uvicorn app.main|mercury-frontend" 2>/dev/null || true

echo ""
echo "╔══════════════════════════════════╗"
echo "║      Mercury — Starting up       ║"
echo "╚══════════════════════════════════╝"
echo ""

# ── 1. Datastores ──────────────────────────────────────────────────────────────
echo "▶ Starting MongoDB + Redis..."
# Ensure Docker Desktop is running on macOS
if ! docker info > /dev/null 2>&1; then
  echo "  Docker not running — starting Docker Desktop..."
  open -a Docker
  until docker info > /dev/null 2>&1; do sleep 2; done
  echo "  Docker ready"
fi
docker compose up -d mongo redis
until docker compose ps | grep "mongo" | grep -q "healthy\|running"; do sleep 1; done

# ── 2. Build backend (if dist is stale) ───────────────────────────────────────
echo "▶ Building backend..."
npm run build --workspace=packages/core > /dev/null
npm run build --workspace=apps/api     > /dev/null
npm run build --workspace=apps/worker  > /dev/null

# ── 3. Import TM (optional, skipped by default — takes ~25s) ─────────────────
if [ "$IMPORT_TM" = true ]; then
  TMX=$(ls ~/Desktop/*.tmx 2>/dev/null | head -1)
  if [ -n "$TMX" ]; then
    echo "▶ Importing TMX into MongoDB TM: $(basename $TMX)..."
    node packages/core/dist/scripts/importTmx.js "$TMX" en fr
  else
    echo "⚠  No TMX file found on Desktop — skipping TM import"
  fi
fi

# ── 4. API ─────────────────────────────────────────────────────────────────────
echo "▶ Starting Mercury API on :3000..."
node apps/api/dist/index.js > /tmp/mercury-api.log 2>&1 &
API_PID=$!

# ── 5. Worker ──────────────────────────────────────────────────────────────────
echo "▶ Starting Mercury Worker..."
node apps/worker/dist/index.js > /tmp/mercury-worker.log 2>&1 &
WORKER_PID=$!

# ── 6. ML service ─────────────────────────────────────────────────────────────
if [ "$START_ML" = true ] && [ -d "$ML_REPO" ]; then
  echo "▶ Starting Mercury ML service on :8000..."
  case "${ML_MODEL:-auto}" in
    ct2)
      ML_MODEL_PATH="${MODEL_PATH:-$ML_REPO/headout-ct2}"
      ;;
    full)
      ML_MODEL_PATH="${MODEL_PATH:-$ML_REPO/headout-translator}"
      ;;
    auto)
      if [ -n "${MODEL_PATH:-}" ]; then
        ML_MODEL_PATH="$MODEL_PATH"
      elif [ -d "$ML_REPO/headout-ct2" ]; then
        ML_MODEL_PATH="$ML_REPO/headout-ct2"
      elif [ -d "$ML_REPO/headout-translator" ]; then
        ML_MODEL_PATH="$ML_REPO/headout-translator"
      else
        ML_MODEL_PATH=""
      fi
      ;;
    *)
      echo "⚠  Unknown ML_MODEL='${ML_MODEL}'. Use auto, ct2, or full."
      exit 1
      ;;
  esac
  cd "$ML_REPO"
  MODEL_PATH="$ML_MODEL_PATH" \
  GEMINI_API_KEY="${GEMINI_API_KEY:-}" \
  GEMINI_MODEL="${GEMINI_MODEL:-gemini-2.5-flash}" \
  MIN_TRANSLATION_CONFIDENCE="${MIN_TRANSLATION_CONFIDENCE:-0.7}" \
  .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 \
    --timeout-keep-alive 300 > /tmp/mercury-ml.log 2>&1 &
  ML_PID=$!
  cd "$REPO"
  echo "  Model: $ML_MODEL_PATH"
fi

# ── 7. Frontend ────────────────────────────────────────────────────────────────
if [ "$START_FRONTEND" = true ] && [ -d "$FRONTEND_REPO" ]; then
  echo "▶ Starting Mercury Frontend on :5173..."
  cd "$FRONTEND_REPO"
  VITE_API_URL=http://localhost:3000 npm run dev > /tmp/mercury-frontend.log 2>&1 &
  FRONTEND_PID=$!
  cd "$REPO"
fi

# ── Wait for API ───────────────────────────────────────────────────────────────
echo ""
echo "Waiting for API to be ready..."
for i in $(seq 1 15); do
  sleep 2
  if curl -s http://localhost:3000/health | grep -q '"ok"'; then
    break
  fi
done

# ── Status ─────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║           Mercury is running                 ║"
echo "╠══════════════════════════════════════════════╣"

API_STATUS=$(curl -s http://localhost:3000/health 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'])" 2>/dev/null || echo "starting...")
echo "║  API      http://localhost:3000   $API_STATUS"

ML_STATUS=$(curl -s http://localhost:8000/health 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['model'])" 2>/dev/null || echo "starting...")
[ "$START_ML" = true ] && echo "║  ML       http://localhost:8000   model: $ML_STATUS"

[ "$START_FRONTEND" = true ] && echo "║  UI       http://localhost:5173"
echo "╠══════════════════════════════════════════════╣"
echo "║  Logs:  /tmp/mercury-{api,worker,ml}.log     ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Streaming logs (Ctrl+C to stop all services)"
echo "──────────────────────────────────────────────"

# ── Keep alive + stream logs ───────────────────────────────────────────────────
trap 'echo ""; echo "Stopping all services..."; pkill -f "apps/api/dist\|apps/worker/dist\|uvicorn app.main\|mercury-frontend" 2>/dev/null; docker compose stop; exit 0' INT TERM

# Color codes
C_API='\033[0;36m'    # cyan
C_WORKER='\033[0;32m' # green
C_ML='\033[0;33m'     # amber
C_FE='\033[0;35m'     # purple
C_RESET='\033[0m'

stream() {
  local label="$1" color="$2" file="$3"
  [ -f "$file" ] || touch "$file"
  tail -n 0 -f "$file" 2>/dev/null | while IFS= read -r line; do
    printf "${color}[%-7s]${C_RESET} %s\n" "$label" "$line"
  done &
}

# Start callback receiver on :9999 so test webhooks don't fail
if [ -f "$REPO/scripts/callback-receiver.mjs" ]; then
  node "$REPO/scripts/callback-receiver.mjs" 9999 > /tmp/mercury-callbacks.log 2>&1 &
  stream "WEBHOOK" "$C_RESET" /tmp/mercury-callbacks.log
fi

stream "API"    "$C_API"    /tmp/mercury-api.log
stream "WORKER" "$C_WORKER" /tmp/mercury-worker.log
[ "$START_ML" = true ]       && stream "ML"     "$C_ML"  /tmp/mercury-ml.log
[ "$START_FRONTEND" = true ] && stream "UI"     "$C_FE"  /tmp/mercury-frontend.log

wait
