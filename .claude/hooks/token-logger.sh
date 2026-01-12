#!/bin/bash

# Token Usage Logger Hook for Claude Code
# This hook runs after each Claude response (Stop event) and sends token usage to the API

# Configuration
API_URL="${TOKEN_LOGGER_API_URL:-http://localhost:3001}"

# Read hook input from stdin
HOOK_INPUT=$(cat)

# Extract data from hook input
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // "unknown"')
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // ""')

# Function to extract token usage from transcript and POST to API
extract_and_send_tokens() {
    local transcript="$1"

    if [ ! -f "$transcript" ]; then
        return
    fi

    # Get the most recent API response with usage data
    # The transcript contains JSONL entries; we look for usage information
    local usage_data=$(tail -100 "$transcript" | grep -o '"usage":{[^}]*}' | tail -1)

    if [ -n "$usage_data" ]; then
        # Extract individual token counts
        local input_tokens=$(echo "$usage_data" | grep -o '"input_tokens":[0-9]*' | grep -o '[0-9]*' | tail -1)
        local output_tokens=$(echo "$usage_data" | grep -o '"output_tokens":[0-9]*' | grep -o '[0-9]*' | tail -1)
        local cache_read=$(echo "$usage_data" | grep -o '"cache_read_input_tokens":[0-9]*' | grep -o '[0-9]*' | tail -1)
        local cache_creation=$(echo "$usage_data" | grep -o '"cache_creation_input_tokens":[0-9]*' | grep -o '[0-9]*' | tail -1)

        # Default to 0 if not found
        input_tokens=${input_tokens:-0}
        output_tokens=${output_tokens:-0}
        cache_read=${cache_read:-0}
        cache_creation=${cache_creation:-0}

        local total_tokens=$((input_tokens + output_tokens))

        # Only send if we have actual token data
        if [ "$total_tokens" -gt 0 ]; then
            local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

            # POST to the API (ignore errors if server is not running)
            curl -s --connect-timeout 2 -X POST "${API_URL}/api/tokens" \
                -H "Content-Type: application/json" \
                -d "{
                    \"session_id\": \"${SESSION_ID}\",
                    \"input_tokens\": ${input_tokens},
                    \"output_tokens\": ${output_tokens},
                    \"cache_read_tokens\": ${cache_read},
                    \"cache_creation_tokens\": ${cache_creation},
                    \"timestamp\": \"${timestamp}\"
                }" > /dev/null 2>&1 || true
        fi
    fi
}

# Extract and send tokens
if [ -n "$TRANSCRIPT_PATH" ]; then
    extract_and_send_tokens "$TRANSCRIPT_PATH"
fi
