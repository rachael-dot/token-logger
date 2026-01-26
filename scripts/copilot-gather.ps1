# PowerShell wrapper script for copilot CLI that logs token usage to local filesystem only
# Usage: .\copilot-gather.ps1 [copilot options]
# Or create an alias: Set-Alias copilot "C:\path\to\copilot-gather.ps1"

# Configuration
$LOGS_DIR = ".\logs"
$COPILOT_BIN = "copilot.exe"  # Assumes copilot is in PATH, or set full path like "C:\Program Files\GitHub Copilot CLI\copilot.exe"

# Create logs directory if it doesn't exist
if (-not (Test-Path $LOGS_DIR)) {
    New-Item -ItemType Directory -Path $LOGS_DIR | Out-Null
}

# Generate session info
$SESSION_ID = "copilot_$([int][double]::Parse((Get-Date -UFormat %s)))"
$TIMESTAMP = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

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
    $cache_read_tokens = 0
    $cache_creation_tokens = 0

    if ($OUTPUT -match '([\d.]+k?)\s+(in|input)') {
        $input_tokens = $matches[1]
    }

    if ($OUTPUT -match '([\d.]+k?)\s+(out|output)') {
        $output_tokens = $matches[1]
    }

    if ($OUTPUT -match '([\d.]+k?)\s+(cached|cache read)') {
        $cache_read_tokens = $matches[1]
    }

    if ($OUTPUT -match '([\d.]+k?)\s+cache creation') {
        $cache_creation_tokens = $matches[1]
    }

    # Function to convert k notation to actual numbers
    function Convert-KNotation {
        param([string]$value)

        if ([string]::IsNullOrEmpty($value)) {
            return 0
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
    $cache_read_tokens = Convert-KNotation $cache_read_tokens
    $cache_creation_tokens = Convert-KNotation $cache_creation_tokens

    $TOTAL_TOKENS = $input_tokens + $output_tokens

    # Log token usage if we found any
    if ($TOTAL_TOKENS -gt 0) {
        $LOG_FILE = Join-Path $LOGS_DIR "copilot-gather.log"

        # Get the command that was run (sanitize for logging)
        $COMMAND_ARGS = $args -join " "
        $COMMAND_PREVIEW = if ($COMMAND_ARGS.Length -gt 100) {
            $COMMAND_ARGS.Substring(0, 100)
        } else {
            $COMMAND_ARGS
        }

        $LOG_ENTRY = "[${TIMESTAMP}] SESSION: $SESSION_ID | Model: $model | In: $input_tokens | Out: $output_tokens | Cache: $cache_read_tokens | Total: $TOTAL_TOKENS | Duration: ${DURATION}s | Command: $COMMAND_PREVIEW"

        Add-Content -Path $LOG_FILE -Value $LOG_ENTRY
    }
}

# Exit with the same code as copilot
exit $EXIT_CODE
