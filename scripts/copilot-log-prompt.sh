#!/bin/bash
# GitHub Copilot CLI - User Prompt Submitted Hook

INPUT=$(cat)
LOG_DIR="./logs"
LOG_FILE="$LOG_DIR/copilot-prompts.log"
API_URL="${TOKEN_LOGGER_API_URL:-http://localhost:3001}"

mkdir -p "$LOG_DIR"

TIMESTAMP=$(echo "$INPUT" | jq -r '.timestamp // empty')
PROMPT=$(echo "$INPUT" | jq -r '.prompt // "empty"')
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId // "unknown"')
INPUT_TOKENS=$(echo "$INPUT" | jq -r '.tokenUsage.inputTokens // .inputTokens // 0')
OUTPUT_TOKENS=$(echo "$INPUT" | jq -r '.tokenUsage.outputTokens // .outputTokens // 0')

if [ -z "$TIMESTAMP" ]; then
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
fi

# Ensure tokens are numbers
[[ "$INPUT_TOKENS" =~ ^[0-9]+$ ]] || INPUT_TOKENS=0
[[ "$OUTPUT_TOKENS" =~ ^[0-9]+$ ]] || OUTPUT_TOKENS=0

TOTAL_TOKENS=$((INPUT_TOKENS + OUTPUT_TOKENS))

# POST to the API (ignore errors if server is not running)
if [ "$TOTAL_TOKENS" -gt 0 ]; then
    curl -s --connect-timeout 2 -X POST "${API_URL}/api/copilot/tokens" \
        -H "Content-Type: application/json" \
        -d "{
            \"session_id\": \"${SESSION_ID}\",
            \"input_tokens\": ${INPUT_TOKENS},
            \"output_tokens\": ${OUTPUT_TOKENS},
            \"cache_read_tokens\": 0,
            \"cache_creation_tokens\": 0,
            \"model\": \"copilot\",
            \"user\": \"${USER}\",
            \"timestamp\": \"${TIMESTAMP}\"
        }" > /dev/null 2>&1 || true
fi

# Also log to file for debugging
PROMPT_PREVIEW=$(echo "$PROMPT" | head -c 200)
if [ ${#PROMPT} -gt 200 ]; then
    PROMPT_PREVIEW="${PROMPT_PREVIEW}..."
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")] PROMPT | SessionID: $SESSION_ID | Tokens: $INPUT_TOKENS/$OUTPUT_TOKENS (Total: $TOTAL_TOKENS) | Prompt: $PROMPT_PREVIEW" >> "$LOG_FILE"
