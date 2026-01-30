#!/bin/bash

# Token Usage Logger Hook for Claude Code
# This hook runs after each Claude response (Stop event) and extracts token usage

# Configuration
LOGS_BASE_DIR="./logs"

# Pricing per 1M tokens (Sonnet 4.5)
INPUT_PRICE_PER_M="3.00"
OUTPUT_PRICE_PER_M="15.00"
CACHE_WRITE_PRICE_PER_M="3.75"
CACHE_READ_PRICE_PER_M="0.30"

# Generate timestamped folder
RUN_FOLDER="claude-$(date +"%Y-%m-%d-%H%M%S")"
LOGS_DIR="$LOGS_BASE_DIR/$RUN_FOLDER"
mkdir -p "$LOGS_DIR"

# Read hook input from stdin
HOOK_INPUT=$(cat)

# Extract data from hook input
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // "unknown"')
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // ""')

# Function to extract token usage from transcript and calculate costs
extract_summary() {
    local transcript="$1"

    if [ ! -f "$transcript" ]; then
        return
    fi

    # Copy transcript to run.log
    cp "$transcript" "$LOGS_DIR/run.log" 2>/dev/null || true

    # Get the most recent API response with usage data using jq for proper JSON parsing
    # The transcript contains JSONL entries; find the last one with usage data
    # Use jq to filter valid JSON lines only, avoiding lines with control characters
    local usage_line=$(tail -100 "$transcript" | while IFS= read -r line; do echo "$line" | jq -c 'select(.message.usage)' 2>/dev/null; done | tail -1)

    if [ -n "$usage_line" ]; then
        # Use jq to properly extract token counts - usage is nested inside .message
        local input_tokens=$(echo "$usage_line" | jq -r '.message.usage.input_tokens // 0' 2>/dev/null)
        local output_tokens=$(echo "$usage_line" | jq -r '.message.usage.output_tokens // 0' 2>/dev/null)
        local cache_read=$(echo "$usage_line" | jq -r '.message.usage.cache_read_input_tokens // 0' 2>/dev/null)
        local cache_creation=$(echo "$usage_line" | jq -r '.message.usage.cache_creation_input_tokens // 0' 2>/dev/null)
        local model=$(echo "$usage_line" | jq -r '.message.model // ""' 2>/dev/null)

        # Calculate duration by finding the time between request and response
        # Look for the last user message and assistant response timestamps
        local duration_ms=0

        # Extract timestamps for the last request and response, using jq to avoid parsing errors
        local request_line=$(tail -100 "$transcript" | while IFS= read -r line; do echo "$line" | jq -c 'select(.type == "user")' 2>/dev/null; done | tail -1)
        local response_timestamp=$(echo "$usage_line" | jq -r '.timestamp // ""' 2>/dev/null)
        local request_timestamp=$(echo "$request_line" | jq -r '.timestamp // ""' 2>/dev/null)

        if [ -n "$request_timestamp" ] && [ -n "$response_timestamp" ]; then
            # Convert ISO timestamps to epoch milliseconds with full precision
            # Use Python for accurate timestamp parsing that preserves milliseconds
            local request_ms=$(python3 -c "
from datetime import datetime
try:
    ts = '$request_timestamp'.replace('Z', '+00:00')
    dt = datetime.fromisoformat(ts)
    print(int(dt.timestamp() * 1000))
except:
    print(0)
" 2>/dev/null || echo "0")

            local response_ms=$(python3 -c "
from datetime import datetime
try:
    ts = '$response_timestamp'.replace('Z', '+00:00')
    dt = datetime.fromisoformat(ts)
    print(int(dt.timestamp() * 1000))
except:
    print(0)
" 2>/dev/null || echo "0")

            if [ "$request_ms" -gt 0 ] && [ "$response_ms" -gt 0 ]; then
                duration_ms=$(( response_ms - request_ms ))
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

        # Calculate costs
        if [ "$total_tokens" -gt 0 ]; then
            # Calculate minimum costs for 1000 tokens
            local min_input_cost=$(echo "scale=4; (1000 / 1000000) * $INPUT_PRICE_PER_M" | bc 2>/dev/null || echo "0")
            local min_output_cost=$(echo "scale=4; (1000 / 1000000) * $OUTPUT_PRICE_PER_M" | bc 2>/dev/null || echo "0")
            local min_cache_read_cost=$(echo "scale=4; (1000 / 1000000) * $CACHE_READ_PRICE_PER_M" | bc 2>/dev/null || echo "0")
            local min_cache_write_cost=$(echo "scale=4; (1000 / 1000000) * $CACHE_WRITE_PRICE_PER_M" | bc 2>/dev/null || echo "0")

            # Calculate actual costs
            local input_cost=$(echo "scale=4; ($input_tokens / 1000000) * $INPUT_PRICE_PER_M" | bc 2>/dev/null || echo "0")
            local output_cost=$(echo "scale=4; ($output_tokens / 1000000) * $OUTPUT_PRICE_PER_M" | bc 2>/dev/null || echo "0")
            local cache_read_cost=$(echo "scale=4; ($cache_read / 1000000) * $CACHE_READ_PRICE_PER_M" | bc 2>/dev/null || echo "0")
            local cache_write_cost=$(echo "scale=4; ($cache_creation / 1000000) * $CACHE_WRITE_PRICE_PER_M" | bc 2>/dev/null || echo "0")

            # Use minimum cost if actual cost is less than 1000 token cost
            input_cost=$(echo "if ($input_cost < $min_input_cost) $min_input_cost else $input_cost" | bc 2>/dev/null || echo "$min_input_cost")
            output_cost=$(echo "if ($output_cost < $min_output_cost) $min_output_cost else $output_cost" | bc 2>/dev/null || echo "$min_output_cost")
            cache_read_cost=$(echo "if ($cache_read_cost < $min_cache_read_cost) $min_cache_read_cost else $cache_read_cost" | bc 2>/dev/null || echo "$min_cache_read_cost")
            cache_write_cost=$(echo "if ($cache_write_cost < $min_cache_write_cost) $min_cache_write_cost else $cache_write_cost" | bc 2>/dev/null || echo "$min_cache_write_cost")

            # Ensure values are not empty
            input_cost="${input_cost:-0}"
            output_cost="${output_cost:-0}"
            cache_read_cost="${cache_read_cost:-0}"
            cache_write_cost="${cache_write_cost:-0}"

            # Calculate total cost
            local total_cost=$(echo "scale=4; $input_cost + $output_cost + $cache_read_cost + $cache_write_cost" | bc 2>/dev/null || echo "0")
            total_cost="${total_cost:-0}"

            # Format costs with leading zero if needed
            input_cost=$(printf "%.4f" "$input_cost" 2>/dev/null || echo "0.0000")
            output_cost=$(printf "%.4f" "$output_cost" 2>/dev/null || echo "0.0000")
            cache_read_cost=$(printf "%.4f" "$cache_read_cost" 2>/dev/null || echo "0.0000")
            cache_write_cost=$(printf "%.4f" "$cache_write_cost" 2>/dev/null || echo "0.0000")
            total_cost=$(printf "%.4f" "$total_cost" 2>/dev/null || echo "0.0000")

            # Convert duration to seconds for display
            local duration_sec=$(echo "scale=2; $duration_ms / 1000" | bc 2>/dev/null || echo "0.00")
            local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

            # Define log file path
            LOG_FILE="$LOGS_DIR/gather.log"

            # Create log entry
            local log_entry=$(cat << EOF
================================================================================
Session ID: $SESSION_ID
Timestamp:  $timestamp
Model:      $model
Duration:   ${duration_sec}s

Token Usage:
  Input Tokens:       ${input_tokens} (\$${input_cost})
  Output Tokens:      ${output_tokens} (\$${output_cost})
  Cache Read Tokens:  ${cache_read} (\$${cache_read_cost})
  Cache Write Tokens: ${cache_creation} (\$${cache_write_cost})

Total Cost: \$${total_cost}

EOF
)

            # Output summary to stderr so it appears in the terminal
            echo "$log_entry" >&2

            # Append to log file
            echo "$log_entry" >> "$LOG_FILE"
        fi
    fi
}

# Extract and send tokens
if [ -n "$TRANSCRIPT_PATH" ]; then
    extract_summary "$TRANSCRIPT_PATH"
fi
