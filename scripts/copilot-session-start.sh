#!/bin/bash
# GitHub Copilot CLI - Session Start Hook

INPUT=$(cat)
LOG_DIR="./logs"
LOG_FILE="$LOG_DIR/copilot-sessions.log"

mkdir -p "$LOG_DIR"

TIMESTAMP=$(echo "$INPUT" | jq -r '.timestamp // empty')
SOURCE=$(echo "$INPUT" | jq -r '.source // "unknown"')
CWD=$(echo "$INPUT" | jq -r '.cwd // "unknown"')
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId // "unknown"')

if [ -z "$TIMESTAMP" ]; then
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")] SESSION_START | SessionID: $SESSION_ID | Source: $SOURCE | CWD: $CWD" >> "$LOG_FILE"
