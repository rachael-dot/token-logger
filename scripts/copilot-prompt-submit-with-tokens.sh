#!/bin/bash

# GitHub Copilot CLI - Prompt Submit Hook with Token Capture
# This hook runs when a user submits a prompt and captures token usage

# Configuration
API_URL="${TOKEN_LOGGER_API_URL:-http://localhost:3001}"
LOGS_DIR="./logs"
mkdir -p "$LOGS_DIR"

# Read hook input from stdin
INPUT=$(cat)

# Extract data from hook input
TIMESTAMP=$(echo "$INPUT" | jq -r '.timestamp // empty')
PROMPT=$(echo "$INPUT" | jq -r '.prompt // "empty"')
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId // "unknown"')

if [ -z "$TIMESTAMP" ]; then
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
fi

# Log the prompt submission
LOG_FILE="$LOGS_DIR/copilot-prompts.log"
PROMPT_PREVIEW=$(echo "$PROMPT" | head -c 200)
if [ ${#PROMPT} -gt 200 ]; then
    PROMPT_PREVIEW="${PROMPT_PREVIEW}..."
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")] PROMPT_SUBMIT | SessionID: $SESSION_ID | Prompt: $PROMPT_PREVIEW" >> "$LOG_FILE"

# Run /usage command to get token statistics
USAGE_OUTPUT=$(copilot -p "/usage" 2>&1)

# Parse token information from usage output
# Format: claude-sonnet-4.5  35.2k in, 310 out, 22.4k cached
model=$(echo "$USAGE_OUTPUT" | grep -o 'claude-[a-z0-9.-]*' | head -1)
input_tokens=$(echo "$USAGE_OUTPUT" | grep -oE '[0-9.]+k? (in|input)' | sed -E 's/ (in|input)//' | head -1)
output_tokens=$(echo "$USAGE_OUTPUT" | grep -oE '[0-9.]+k? (out|output)' | sed -E 's/ (out|output)//' | head -1)
cache_read_tokens=$(echo "$USAGE_OUTPUT" | grep -oE '[0-9.]+k? (cached|cache read)' | sed -E 's/ (cached|cache read)//' | head -1)
cache_creation_tokens=$(echo "$USAGE_OUTPUT" | grep -oE '[0-9.]+k? cache creation' | sed 's/ cache creation//' | head -1)

# Convert k notation to actual numbers (e.g., 86.2k -> 86200)
convert_k() {
    local val="$1"
    if [ -z "$val" ]; then
        echo "0"
        return
    fi
    if echo "$val" | grep -q 'k$'; then
        local num=$(echo "$val" | sed 's/k$//')
        echo "$num" | awk '{printf "%.0f", $1 * 1000}'
    else
        echo "$val"
    fi
}

input_tokens=$(convert_k "$input_tokens")
output_tokens=$(convert_k "$output_tokens")
cache_read_tokens=$(convert_k "$cache_read_tokens")
cache_creation_tokens=$(convert_k "$cache_creation_tokens")

# Ensure they're numbers
[[ "$input_tokens" =~ ^[0-9]+$ ]] || input_tokens=0
[[ "$output_tokens" =~ ^[0-9]+$ ]] || output_tokens=0
[[ "$cache_read_tokens" =~ ^[0-9]+$ ]] || cache_read_tokens=0
[[ "$cache_creation_tokens" =~ ^[0-9]+$ ]] || cache_creation_tokens=0

TOTAL_TOKENS=$((input_tokens + output_tokens))

# Log token usage
if [ "$TOTAL_TOKENS" -gt 0 ]; then
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")] TOKENS | SessionID: $SESSION_ID | Model: $model | In: $input_tokens | Out: $output_tokens | Cache: $cache_read_tokens | Total: $TOTAL_TOKENS" >> "$LOG_FILE"

    # POST to the API
    curl -s --connect-timeout 2 -X POST "${API_URL}/api/copilot/tokens" \
        -H "Content-Type: application/json" \
        -d "{
            \"session_id\": \"${SESSION_ID}\",
            \"input_tokens\": ${input_tokens},
            \"output_tokens\": ${output_tokens},
            \"cache_read_tokens\": ${cache_read_tokens},
            \"cache_creation_tokens\": ${cache_creation_tokens},
            \"model\": \"${model}\",
            \"user\": \"${USER}\",
            \"timestamp\": \"${TIMESTAMP}\"
        }" > /dev/null 2>&1 || true
fi
