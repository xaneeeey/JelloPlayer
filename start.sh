#!/bin/bash

cleanup() {
    echo "Shutting down..."
    kill "$FRONTEND_PID" "$BACKEND_PID" 2>/dev/null
    wait "$FRONTEND_PID" "$BACKEND_PID" 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "Starting backend..."
python3 "app/server.py" &
BACKEND_PID=$!

echo "Starting frontend..."
npm run dev &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID | Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop both servers."

wait "$FRONTEND_PID" "$BACKEND_PID"
