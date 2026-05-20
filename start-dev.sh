#!/bin/bash
cd "/Users/jusringladson/Desktop/projects/lynkk b2b/workflow-engine"
npx tsx src/server.ts &
SERVER_PID=$!
cd "/Users/jusringladson/Desktop/projects/lynkk b2b"
npm run dev &
FRONTEND_PID=$!

wait