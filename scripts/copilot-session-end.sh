#!/bin/bash
# GitHub Copilot CLI - Session End Hook

INPUT=$(cat)
LOG_DIR="./logs"
LOG_FILE="$LOG_DIR/copilot-sessions.log"

mkdir -p "$LOG_DIR"

TIMESTAMP=$(echo "$INPUT" | jq -r '.timestamp // empty')
REASON=$(echo "$INPUT" | jq -r '.reason // "unknown"')
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId // "unknown"')

if [ -z "$TIMESTAMP" ]; then
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")] SESSION_END | SessionID: $SESSION_ID | Reason: $REASON" >> "$LOG_FILE"
