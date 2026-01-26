#!/bin/bash

# read_output.sh - Extract token information from copilot /usage command
# Usage: ./read_output.sh

# Configuration
API_URL="${TOKEN_LOGGER_API_URL:-http://localhost:3001}"

# Create logs directory if it doesn't exist
LOGS_DIR="./logs"
mkdir -p "$LOGS_DIR"

# Run the /usage command and capture output
INPUT=$(copilot -i "/usage" 2>&1)

# Parse text output from /usage command
# Example format:
# Total usage est:    1 Premium request
# Total duration (API): 22s
# Usage by model:
#   claude-sonnet-4.5  86.2k input, 888 output, 71.5k cache read

model=$(echo "$INPUT" | grep -o 'claude-[a-z0-9.-]*' | head -1)
input_tokens=$(echo "$INPUT" | grep -o '[0-9.]*k* input' | sed 's/ input//' | head -1)
output_tokens=$(echo "$INPUT" | grep -o '[0-9.]*k* output' | sed 's/ output//' | head -1)
cache_read_tokens=$(echo "$INPUT" | grep -o '[0-9.]*k* cache read' | sed 's/ cache read//' | head -1)

# Convert k notation to actual numbers (e.g., 86.2k -> 86200)
convert_k() {
    local val="$1"
    if echo "$val" | grep -q 'k$'; then
        local num=$(echo "$val" | sed 's/k$//')
        echo "$num" | awk '{printf "%.0f", $1 * 1000}'
    else
        echo "$val"
    fi
}

[ -n "$input_tokens" ] && input_tokens=$(convert_k "$input_tokens")
[ -n "$output_tokens" ] && output_tokens=$(convert_k "$output_tokens")
[ -n "$cache_read_tokens" ] && cache_read_tokens=$(convert_k "$cache_read_tokens")

cache_creation_tokens=""

# Try to get session ID from copilot-sessions.log, otherwise generate one
SESSIONS_LOG="$LOGS_DIR/copilot-sessions.log"
if [ -f "$SESSIONS_LOG" ]; then
    session_id=$(grep "SESSION_START" "$SESSIONS_LOG" | tail -1 | grep -o 'SessionID: [^ ]*' | sed 's/SessionID: //')
fi

# Fallback if no session ID found
if [ -z "$session_id" ] || [ "$session_id" = "unknown" ]; then
    session_id="copilot_$(date +%s)"
fi

# Generate timestamp
timestamp=$(date +%Y%m%d_%H%M%S)
iso_timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Create log file path
log_file="${LOGS_DIR}/${session_id}_${timestamp}.log"

# Function to write to log file
write_log() {
    echo "$1" >> "$log_file"
}

# Write extracted information to log file
if [ -n "$input_tokens" ] || [ -n "$output_tokens" ]; then
    write_log "═══════════════════════════════════════════════════"
    write_log "           TOKEN USAGE INFORMATION"
    write_log "═══════════════════════════════════════════════════"
    write_log "Session ID:           $session_id"
    write_log "Timestamp:            $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    write_log ""

    if [ -n "$model" ]; then
        write_log "Model:                $model"
    fi
    
    [ -n "$input_tokens" ] && write_log "Input Tokens:         $input_tokens"
    [ -n "$output_tokens" ] && write_log "Output Tokens:        $output_tokens"
    [ -n "$cache_read_tokens" ] && write_log "Cache Read:           $cache_read_tokens"
    [ -n "$cache_creation_tokens" ] && write_log "Cache Creation:       $cache_creation_tokens"

    if [ -n "$input_tokens" ] && [ -n "$output_tokens" ]; then
        total=$((input_tokens + output_tokens))
        write_log "Total Tokens:         $total"
    fi

    write_log "═══════════════════════════════════════════════════"

    echo "Token usage information saved to: $log_file"

    # Send token data to API
    if [ -n "$input_tokens" ] && [ -n "$output_tokens" ]; then
        curl -s --connect-timeout 2 -X POST "${API_URL}/api/copilot/tokens" \
            -H "Content-Type: application/json" \
            -d "{
                \"session_id\": \"${session_id}\",
                \"input_tokens\": ${input_tokens},
                \"output_tokens\": ${output_tokens},
                \"cache_read_tokens\": ${cache_read_tokens:-0},
                \"cache_creation_tokens\": ${cache_creation_tokens:-0},
                \"model\": \"${model}\",
                \"user\": \"${USER}\",
                \"timestamp\": \"${iso_timestamp}\",
                \"duration_ms\": 0
            }" > /dev/null 2>&1 && echo "Token data sent to API" || echo "Warning: Could not send data to API (server may be offline)"
    fi
else
    write_log "═══════════════════════════════════════════════════"
    write_log "           SESSION END - NO USAGE DATA"
    write_log "═══════════════════════════════════════════════════"
    write_log "Session ID:           $session_id"
    write_log "Timestamp:            $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    write_log ""
    write_log "No token information found in hook payload."
    write_log "Received data:"
    echo "$INPUT" | jq '.' 2>/dev/null >> "$log_file" || echo "$INPUT" >> "$log_file"
    write_log "═══════════════════════════════════════════════════"

    echo "Session end logged (no usage data) to: $log_file"
fi
