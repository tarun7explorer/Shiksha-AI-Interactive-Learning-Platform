#!/bin/bash
# entrypoint.sh
#
# Boots the ShikshaAI single-container stack:
#   1. Uvicorn serves the FastAPI backend internally on $BACKEND_PORT.
#   2. The Next.js standalone server serves the frontend (and proxies
#      /api/* to the backend via next.config.js rewrites) on $PORT —
#      the single port exposed to the outside world (Hugging Face
#      Spaces, Docker, etc).
#
# Both processes are supervised in the foreground of this script so a
# crash in either one brings the container down, letting the host's
# orchestrator (Spaces, Docker, Compose) restart it cleanly.

set -e

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${PORT:-7860}"

echo "[entrypoint] Starting ShikshaAI backend (Uvicorn) on port ${BACKEND_PORT}..."
cd /app/backend
python -m uvicorn main:app \
    --host 0.0.0.0 \
    --port "${BACKEND_PORT}" \
    --workers 1 \
    --proxy-headers &
BACKEND_PID=$!

# --- Wait for the backend to become reachable before starting the frontend ---
echo "[entrypoint] Waiting for backend health check..."
ATTEMPTS=0
MAX_ATTEMPTS=30
until curl -fsS "http://localhost:${BACKEND_PORT}/health" >/dev/null 2>&1; do
    ATTEMPTS=$((ATTEMPTS + 1))
    if [ "${ATTEMPTS}" -ge "${MAX_ATTEMPTS}" ]; then
        echo "[entrypoint] Backend failed to become healthy after ${MAX_ATTEMPTS} attempts." >&2
        kill "${BACKEND_PID}" 2>/dev/null || true
        exit 1
    fi
    sleep 1
done
echo "[entrypoint] Backend is healthy."

echo "[entrypoint] Starting ShikshaAI frontend (Next.js) on port ${FRONTEND_PORT}..."
cd /app/frontend
PORT="${FRONTEND_PORT}" HOSTNAME="0.0.0.0" node server.js &
FRONTEND_PID=$!

# --- Propagate termination signals to both child processes ---
shutdown() {
    echo "[entrypoint] Caught shutdown signal — stopping services..."
    kill "${FRONTEND_PID}" 2>/dev/null || true
    kill "${BACKEND_PID}" 2>/dev/null || true
    wait "${FRONTEND_PID}" 2>/dev/null || true
    wait "${BACKEND_PID}" 2>/dev/null || true
    echo "[entrypoint] Shutdown complete."
    exit 0
}
trap shutdown TERM INT

# --- If either process exits unexpectedly, bring the container down ---
wait -n "${BACKEND_PID}" "${FRONTEND_PID}" 2>/dev/null || wait
EXIT_CODE=$?
echo "[entrypoint] A service exited (code ${EXIT_CODE}) — shutting down container."
shutdown