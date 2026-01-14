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

    # Get the most recent API response with usage data using jq for proper JSON parsing
    # The transcript contains JSONL entries; find the last one with usage data
    local usage_line=$(tail -100 "$transcript" | grep '"usage"' | tail -1)

    if [ -n "$usage_line" ]; then
        # Use jq to properly extract token counts - usage is nested inside .message
        local input_tokens=$(echo "$usage_line" | jq -r '.message.usage.input_tokens // 0' 2>/dev/null)
        local output_tokens=$(echo "$usage_line" | jq -r '.message.usage.output_tokens // 0' 2>/dev/null)
        local cache_read=$(echo "$usage_line" | jq -r '.message.usage.cache_read_input_tokens // 0' 2>/dev/null)
        local cache_creation=$(echo "$usage_line" | jq -r '.message.usage.cache_creation_input_tokens // 0' 2>/dev/null)
        local model=$(echo "$usage_line" | jq -r '.message.model // ""' 2>/dev/null)

        # Calculate duration by finding the time between request and response
        # Look for the last API request (type: "api_request") and response timestamps
        local duration_ms=0

        # Extract timestamps for the last request and response
        local request_line=$(tail -100 "$transcript" | grep '"type":"api_request"' | tail -1)
        local response_timestamp=$(echo "$usage_line" | jq -r '.timestamp // ""' 2>/dev/null)
        local request_timestamp=$(echo "$request_line" | jq -r '.timestamp // ""' 2>/dev/null)

        if [ -n "$request_timestamp" ] && [ -n "$response_timestamp" ]; then
            # Convert ISO timestamps to epoch milliseconds and calculate difference
            local request_ms=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${request_timestamp%.*}" "+%s" 2>/dev/null || echo "0")
            local response_ms=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${response_timestamp%.*}" "+%s" 2>/dev/null || echo "0")

            if [ "$request_ms" -gt 0 ] && [ "$response_ms" -gt 0 ]; then
                duration_ms=$(( (response_ms - request_ms) * 1000 ))
                # Ensure duration is positive
                [ "$duration_ms" -lt 0 ] && duration_ms=0
            fi
        fi

        # Default to 0 if jq failed or returned null
        input_tokens=${input_tokens:-0}
        output_tokens=${output_tokens:-0}
        cache_read=${cache_read:-0}
        cache_creation=${cache_creation:-0}

        # Ensure they're numbers
        [[ "$input_tokens" =~ ^[0-9]+$ ]] || input_tokens=0
        [[ "$output_tokens" =~ ^[0-9]+$ ]] || output_tokens=0
        [[ "$cache_read" =~ ^[0-9]+$ ]] || cache_read=0
        [[ "$cache_creation" =~ ^[0-9]+$ ]] || cache_creation=0

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
                    \"model\": \"${model}\",
                    \"user\": \"${USER}\",
                    \"timestamp\": \"${timestamp}\",
                    \"duration_ms\": ${duration_ms}
                }" > /dev/null 2>&1 || true
        fi
    fi
}

# Extract and send tokens
if [ -n "$TRANSCRIPT_PATH" ]; then
    extract_and_send_tokens "$TRANSCRIPT_PATH"
fi
