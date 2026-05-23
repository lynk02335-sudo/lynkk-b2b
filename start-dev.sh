#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Starting backend (workflow-engine)..."
cd "$ROOT/backend/workflow-engine"
npx tsx src/server.ts &
SERVER_PID=$!

echo "Starting frontend (Vite)..."
cd "$ROOT/frontend"
npx vite &
FRONTEND_PID=$!

trap "kill $SERVER_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
