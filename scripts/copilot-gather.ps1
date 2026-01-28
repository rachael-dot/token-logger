# PowerShell wrapper script for copilot CLI that logs token usage to local filesystem only
# Usage: .\copilot-gather.ps1 [copilot options]
# Or create an alias: Set-Alias copilot "C:\path\to\copilot-gather.ps1"

# Configuration
$LOGS_BASE_DIR = ".\logs"
$COPILOT_BIN = "copilot.exe"  # Assumes copilot is in PATH, or set full path like "C:\Program Files\GitHub Copilot CLI\copilot.exe"

# Pricing per 1M tokens (updated January 2026)
function Get-InputPrice {
    param([string]$model)

    switch -Regex ($model) {
        "claude-sonnet-4.5|claude-sonnet-4-20250514" { return 3.00 }
        "claude-opus-4.5|claude-opus-4-20250514" { return 15.00 }
        "claude-haiku-4.0" { return 0.80 }
        default { return 0 }
    }
}

function Get-OutputPrice {
    param([string]$model)

    switch -Regex ($model) {
        "claude-sonnet-4.5|claude-sonnet-4-20250514" { return 15.00 }
        "claude-opus-4.5|claude-opus-4-20250514" { return 75.00 }
        "claude-haiku-4.0" { return 4.00 }
        default { return 0 }
    }
}

# Generate session info with timestamped folder
$TIMESTAMP = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$RUN_FOLDER = (Get-Date).ToString("yyyy-MM-dd-HHmmss")
$LOGS_DIR = Join-Path $LOGS_BASE_DIR $RUN_FOLDER
$SESSION_ID = "copilot_$([int][double]::Parse((Get-Date -UFormat %s)))"

# Create logs directory if it doesn't exist
if (-not (Test-Path $LOGS_DIR)) {
    New-Item -ItemType Directory -Path $LOGS_DIR -Force | Out-Null
}

# Run the actual copilot command and capture output
$START_TIME = Get-Date
try {
    # Use --allow-all-tools flag and pass all arguments
    $OUTPUT = & $COPILOT_BIN --allow-all-tools @args 2>&1 | Out-String
    $EXIT_CODE = $LASTEXITCODE
} catch {
    Write-Error "Failed to execute copilot: $_"
    exit 1
}
$END_TIME = Get-Date
$DURATION = [int]($END_TIME - $START_TIME).TotalSeconds

# Display the output
Write-Host $OUTPUT

# Save output to run.log
$OUTPUT | Out-File -FilePath (Join-Path $LOGS_DIR "run.log") -Encoding UTF8

# Parse token information from output if it contains usage stats
# Format: claude-sonnet-4.5  35.2k in, 310 out, 22.4k cached
if ($OUTPUT -match "Breakdown by AI model:") {
    # Extract model name
    $model = ""
    if ($OUTPUT -match "claude-[a-z0-9.-]+") {
        $model = $matches[0]
    }

    # Extract token counts
    $input_tokens = 0
    $output_tokens = 0
    $cache_write_tokens = 0

    if ($OUTPUT -match '([\d.,]+[km]?)\s+(in|input)') {
        $input_tokens = $matches[1] -replace ',',''
    }

    if ($OUTPUT -match '([\d.,]+[km]?)\s+(out|output)') {
        $output_tokens = $matches[1] -replace ',',''
    }

    # Copilot shows "cached" tokens which are cache writes
    if ($OUTPUT -match '([\d.,]+[km]?)\s+cached') {
        $cache_write_tokens = $matches[1] -replace ',',''
    }

    # Parse premium requests (format: "Total usage est:        3 Premium requests")
    $premium_used = 0
    if ($OUTPUT -match '(\d+)\s+Premium requests?') {
        $premium_used = [int]$matches[1]
    }

    # Function to convert k/m notation to actual numbers
    function Convert-KNotation {
        param([string]$value)

        if ([string]::IsNullOrEmpty($value)) {
            return 0
        }

        if ($value -match '^([\d.]+)m$') {
            $num = [double]$matches[1]
            return [int]($num * 1000000)
        }

        if ($value -match '^([\d.]+)k$') {
            $num = [double]$matches[1]
            return [int]($num * 1000)
        }

        try {
            return [int]$value
        } catch {
            return 0
        }
    }

    # Convert all tokens
    $input_tokens = Convert-KNotation $input_tokens
    $output_tokens = Convert-KNotation $output_tokens
    $cache_write_tokens = Convert-KNotation $cache_write_tokens

    $TOTAL_TOKENS = $input_tokens + $output_tokens

    # Calculate costs
    $input_cost_per_m = Get-InputPrice $model
    $output_cost_per_m = Get-OutputPrice $model

    # Cache pricing: cache writes are charged at standard input cost
    $cache_write_cost_per_m = $input_cost_per_m

    # Calculate individual costs
    $input_cost = ($input_tokens / 1000000) * $input_cost_per_m
    $output_cost = ($output_tokens / 1000000) * $output_cost_per_m
    $cache_write_cost = ($cache_write_tokens / 1000000) * $cache_write_cost_per_m

    # Calculate total cost
    $total_cost = $input_cost + $output_cost + $cache_write_cost

    # Format costs
    $input_cost_str = "{0:F4}" -f $input_cost
    $output_cost_str = "{0:F4}" -f $output_cost
    $cache_write_cost_str = "{0:F4}" -f $cache_write_cost
    $total_cost_str = "{0:F4}" -f $total_cost

    # Log token usage (always log if we detected the breakdown section)
    if ($true) {
        $LOG_FILE = Join-Path $LOGS_DIR "copilot-gather.log"

        # Get the command that was run (sanitize for logging)
        $COMMAND_ARGS = $args -join " "
        $COMMAND_PREVIEW = if ($COMMAND_ARGS.Length -gt 100) {
            $COMMAND_ARGS.Substring(0, 100)
        } else {
            $COMMAND_ARGS
        }

        # Convert duration to minutes
        $DURATION_MINUTES = "{0:F2}" -f ($DURATION / 60)

        # Write formatted log entry
        $LOG_ENTRY = @"
================================================================================
Session ID: $SESSION_ID
Timestamp:  $TIMESTAMP
Model:      $model
Duration:   $DURATION_MINUTES minutes

Premium Requests: $premium_used

Token Usage:
  Input Tokens:          $input_tokens (`$$input_cost_str)
  Output Tokens:         $output_tokens (`$$output_cost_str)
  Cache Write Tokens:    $cache_write_tokens (`$$cache_write_cost_str)
  Total Tokens:          $TOTAL_TOKENS

Total Cost: `$$total_cost_str

Command: $COMMAND_PREVIEW

"@

        Add-Content -Path $LOG_FILE -Value $LOG_ENTRY
    }
}

# Exit with the same code as copilot
exit $EXIT_CODE
