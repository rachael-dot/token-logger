#!/bin/bash

# capture-copilot-tokens.sh - Run a copilot command and capture token usage
# Usage: ./capture-copilot-tokens.sh "your prompt here"
#        ./capture-copilot-tokens.sh --usage    # Just get usage stats

set -uo pipefail

# Configuration
API_URL="${TOKEN_LOGGER_API_URL:-http://localhost:3001}"
LOGS_DIR="./logs"
mkdir -p "$LOGS_DIR"

# Get the prompt or command
PROMPT="${1:-/usage}"

echo "Running copilot with: $PROMPT"
echo "----------------------------------------"

# Run copilot and capture output
OUTPUT=$(copilot -i "$PROMPT" 2>&1)

# Display the output
echo "$OUTPUT"
echo "----------------------------------------"

# Parse token information from output
# Example format:
# Breakdown by AI model:
#  claude-sonnet-4.5       33.3k in, 467 out, 4.1k cached

model=$(echo "$OUTPUT" | grep -o 'claude-[a-z0-9.-]*' | head -1)

# Try both formats: "33.3k in" and "86.2k input"
input_tokens=$(echo "$OUTPUT" | grep -oE '[0-9.]+k? (in|input)' | sed -E 's/ (in|input)//' | head -1)
output_tokens=$(echo "$OUTPUT" | grep -oE '[0-9.]+k? (out|output)' | sed -E 's/ (out|output)//' | head -1)
cache_read_tokens=$(echo "$OUTPUT" | grep -oE '[0-9.]+k? (cached|cache read)' | sed -E 's/ (cached|cache read)//' | head -1)
cache_creation_tokens=$(echo "$OUTPUT" | grep -oE '[0-9.]+k? cache creation' | sed 's/ cache creation//' | head -1)

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

# Calculate total
total_tokens=$((input_tokens + output_tokens))

# Display parsed token information
if [ "$input_tokens" != "0" ] || [ "$output_tokens" != "0" ]; then
    echo ""
    echo "═══════════════════════════════════════════════════"
    echo "           TOKEN USAGE SUMMARY"
    echo "═══════════════════════════════════════════════════"
    [ -n "$model" ] && echo "Model:           $model"
    echo "Input Tokens:    $input_tokens"
    echo "Output Tokens:   $output_tokens"
    [ "$cache_read_tokens" != "0" ] && echo "Cache Read:      $cache_read_tokens"
    [ "$cache_creation_tokens" != "0" ] && echo "Cache Creation:  $cache_creation_tokens"
    echo "Total Tokens:    $total_tokens"
    echo "═══════════════════════════════════════════════════"

    # Try to get session ID from copilot-sessions.log
    SESSIONS_LOG="$LOGS_DIR/copilot-sessions.log"
    session_id="manual_$(date +%s)"
    if [ -f "$SESSIONS_LOG" ]; then
        last_session=$(grep "SESSION_START" "$SESSIONS_LOG" | tail -1 | grep -o 'SessionID: [^ ]*' | sed 's/SessionID: //')
        [ -n "$last_session" ] && session_id="$last_session"
    fi

    # Save to log file
    timestamp=$(date +%Y%m%d_%H%M%S)
    iso_timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    log_file="${LOGS_DIR}/${session_id}_${timestamp}_tokens.log"

    {
        echo "═══════════════════════════════════════════════════"
        echo "           TOKEN USAGE INFORMATION"
        echo "═══════════════════════════════════════════════════"
        echo "Session ID:      $session_id"
        echo "Timestamp:       $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
        echo "Prompt:          $PROMPT"
        echo ""
        [ -n "$model" ] && echo "Model:           $model"
        echo "Input Tokens:    $input_tokens"
        echo "Output Tokens:   $output_tokens"
        [ "$cache_read_tokens" != "0" ] && echo "Cache Read:      $cache_read_tokens"
        [ "$cache_creation_tokens" != "0" ] && echo "Cache Creation:  $cache_creation_tokens"
        echo "Total Tokens:    $total_tokens"
        echo "═══════════════════════════════════════════════════"
    } > "$log_file"

    echo ""
    echo "Saved to: $log_file"

    # Send to API if available
    if curl -s --connect-timeout 2 -X POST "${API_URL}/api/copilot/tokens" \
        -H "Content-Type: application/json" \
        -d "{
            \"session_id\": \"${session_id}\",
            \"input_tokens\": ${input_tokens},
            \"output_tokens\": ${output_tokens},
            \"cache_read_tokens\": ${cache_read_tokens},
            \"cache_creation_tokens\": ${cache_creation_tokens},
            \"model\": \"${model}\",
            \"user\": \"${USER}\",
            \"timestamp\": \"${iso_timestamp}\"
        }" > /dev/null 2>&1; then
        echo "Sent to API: ${API_URL}"
    fi
else
    echo ""
    echo "No token usage information found in output."
fi
