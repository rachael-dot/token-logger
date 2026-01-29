# Copilot Gather - Token Usage Logger

A lightweight wrapper script for GitHub Copilot CLI that logs token usage to your local filesystem without requiring a backend server.

## What It Does

`copilot-gather` is a wrapper script that:
- Intercepts GitHub Copilot CLI commands
- Captures token usage statistics from the output
- Logs usage data to a local log file
- Passes through all commands transparently to the actual copilot CLI

## Available Versions

- **`copilot-gather`** - Bash script for macOS/Linux
- **`copilot-gather.ps1`** - PowerShell script for Windows (recommended)
- **`copilot-gather.bat`** - Batch script for Windows (basic logging)

## Features

- **Zero Dependencies**: No server required
- **Cross-Platform**: Works on macOS, Linux, and Windows
- **Transparent**: Works exactly like the normal copilot CLI
- **Lightweight**: Minimal overhead, logs to simple text file
- **Automatic Parsing**: Extracts token counts from copilot output
- **Cost Calculation**: Tracks input, output, and cache write token costs
- **Session Tracking**: Each run gets a unique session ID with timestamped folders
- **Duration Tracking**: Records how long each command takes
- **Premium Request Tracking**: Counts premium requests used

## Setup Instructions

### macOS/Linux Setup

### 1. Configure the Script

Edit the `copilot-gather` script to set your paths:

```bash
# Set where you want logs stored (relative or absolute path)
LOGS_DIR="./logs"

# Set path to your actual copilot CLI binary
COPILOT_BIN="/opt/homebrew/bin/copilot"  # macOS Homebrew default
# or COPILOT_BIN="/usr/local/bin/copilot"  # Linux default
```

To find your copilot binary location:
```bash
which copilot
```

### 2. Make It Executable

```bash
chmod +x copilot-gather
```

### 3. Use It

You have two options:

#### Option A: Call It Directly

```bash
./copilot-gather -p "create a function that reverses a string"
```

#### Option B: Create an Alias (Recommended)

Add to your `~/.bashrc`, `~/.zshrc`, or `~/.bash_profile`:

```bash
alias copilot="/path/to/token-logger/scripts/copilot-gather"
```

Then reload your shell:
```bash
source ~/.zshrc  # or ~/.bashrc
```

Now just use `copilot` normally:
```bash
copilot -p "create a function that reverses a string"
```

### Windows Setup

#### Option 1: PowerShell (Recommended)

The PowerShell version provides full token parsing capabilities.

**1. Configure the Script**

Edit `copilot-gather.ps1` to set your paths:

```powershell
$LOGS_DIR = ".\logs"
$COPILOT_BIN = "copilot.exe"  # Or full path like "C:\Program Files\GitHub Copilot CLI\copilot.exe"
```

To find your copilot binary location:
```powershell
Get-Command copilot | Select-Object -ExpandProperty Source
```

**2. Set Execution Policy (First Time Only)**

PowerShell may block scripts by default. Run as Administrator:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**3. Use It**

Call directly:
```powershell
.\copilot-gather.ps1 -p "create a function that reverses a string"
```

Or create an alias in your PowerShell profile:
```powershell
# Edit profile
notepad $PROFILE

# Add this line (use full path):
Set-Alias copilot "C:\path\to\token-logger\scripts\copilot-gather.ps1"

# Reload profile
. $PROFILE
```

**4. Create a Function Alias (Better for Arguments)**

For better argument handling, use a function instead of an alias:
```powershell
# Add to your $PROFILE
function copilot {
    & "C:\path\to\token-logger\scripts\copilot-gather.ps1" @args
}
```

#### Option 2: Batch File

The batch version provides basic logging but limited token parsing.

**1. Configure the Script**

Edit `copilot-gather.bat`:

```batch
set "LOGS_DIR=.\logs"
set "COPILOT_BIN=copilot.exe"
```

**2. Use It**

Call directly:
```batch
copilot-gather.bat -p "create a function that reverses a string"
```

Or rename to `copilot.bat` and place in a directory that's earlier in your PATH than the real copilot.exe.

**3. Adding to PATH (Alternative)**

1. Copy `copilot-gather.bat` to a directory in your PATH
2. Rename it to `copilot-wrapper.bat` or similar
3. Call it with `copilot-wrapper` instead of `copilot`

#### Windows Command Examples

```powershell
# PowerShell
.\copilot-gather.ps1 -p "write a hello world program"

# Command Prompt
copilot-gather.bat -p "write a hello world program"
```

## Log Output Format

Logs are stored in timestamped folders within `./logs/` (or your configured `LOGS_BASE_DIR`). Each session creates:
- A folder named `YYYY-MM-DD-HHMMSS`
- `run.log` - Full copilot command output
- `copilot-gather.log` - Detailed token usage and cost breakdown

### Example Log Entry

```
================================================================================
Session ID: copilot_1738099213
Timestamp:  2026-01-28T20:00:13Z
Model:      claude-sonnet-4.5
Duration:   4.07 minutes

Premium Requests: 1

Token Usage:
  Input Tokens:          25600 ($0.0768)
  Output Tokens:         6500 ($0.0975)
  Cache Write Tokens:    253100 ($0.9491)
  Total Tokens:          32100
  Total Input Tokens:    278700

Total Cost: $1.1234

Command: -p create a function that reverses a string

```

### Log Field Descriptions

| Field | Description |
|-------|-------------|
| **Session ID** | Unique session ID (`copilot_<unix_timestamp>`) |
| **Timestamp** | ISO 8601 format UTC timestamp |
| **Model** | AI model used (e.g., `claude-sonnet-4.5`) |
| **Duration** | Command execution time in minutes |
| **Premium Requests** | Number of premium requests consumed |
| **Input Tokens** | New input tokens sent to the model (excludes cache writes) with cost |
| **Output Tokens** | Output tokens generated by the model with cost |
| **Cache Write Tokens** | Tokens written to prompt cache with cost (charged at cache write rate) |
| **Total Tokens** | Sum of Input + Output tokens (excludes cache writes) |
| **Total Input Tokens** | Raw total input tokens from copilot (includes cache writes) |
| **Total Cost** | Combined cost of all token types in USD |
| **Command** | First 100 chars of the command you ran |

## How Token Parsing Works

The script looks for GitHub Copilot's usage statistics in the output:

```
Breakdown by AI model:
  claude-sonnet-4.5  278.7k in, 6.5k out, 253.1k cached
```

It then:
1. Extracts the model name
2. Parses token counts (handles "k" and "m" notation like "278.7k" or "1.2m")
3. Converts to actual numbers (278.7k → 278700)
4. Separates the input tokens into two categories:
   - **Input Tokens**: New tokens sent to the model (Total Input - Cache Writes)
   - **Cache Write Tokens**: Tokens written to the prompt cache
5. Calculates costs based on current pricing (per 1M tokens):
   - **Sonnet 4.5**: $3.00 input, $15.00 output, $3.75 cache write
   - **Opus 4.5**: $5.00 input, $25.00 output, $10.00 cache write
   - **Haiku 4.5**: $1.00 input, $5.00 output, $2.00 cache write
6. Logs everything with detailed cost breakdown

**Important**: Copilot's "in" count includes cache write tokens. The script automatically separates these for accurate cost tracking:
- **Total Input Tokens**: Raw count from copilot (includes cache writes)
- **Input Tokens**: Actual new input tokens (Total Input - Cache Writes)
- **Cache Write Tokens**: Charged at a different rate than regular input

**Note for macOS users**: The script uses BSD-compatible sed patterns (`[[:space:]]+`) to ensure proper token extraction on macOS.

## Pricing Configuration

The script includes three pricing functions that determine costs per 1M tokens:

### Input Token Pricing (`get_input_price`)
- **Claude Sonnet 4.5**: $3.00 per 1M tokens
- **Claude Opus 4.5**: $5.00 per 1M tokens
- **Claude Haiku 4.5**: $1.00 per 1M tokens

### Output Token Pricing (`get_output_price`)
- **Claude Sonnet 4.5**: $15.00 per 1M tokens
- **Claude Opus 4.5**: $25.00 per 1M tokens
- **Claude Haiku 4.5**: $5.00 per 1M tokens

### Cache Write Pricing (`get_cache_write_price`)
- **Claude Sonnet 4.5**: $3.75 per 1M tokens
- **Claude Opus 4.5**: $10.00 per 1M tokens
- **Claude Haiku 4.5**: $2.00 per 1M tokens

These functions can be updated in the script if pricing changes. They are located at the top of the script files (`copilot-gather` for bash, `copilot-gather.ps1` for PowerShell).

## Viewing Your Usage

Each run creates a timestamped folder (e.g., `logs/2026-01-28-200013/`) containing:
- `copilot-gather.log` - Token usage and cost details
- `run.log` - Full command output

### macOS/Linux

```bash
# View all session logs in the most recent run
ls -lt logs/ | head -5
cat logs/2026-01-28-200013/copilot-gather.log

# View all logs across all sessions
find logs -name "copilot-gather.log" -exec cat {} \;

# Search for specific sessions
grep -r "copilot_1769449138" logs/

# Count total sessions
find logs -name "copilot-gather.log" | wc -l

# Calculate total cost across all sessions
find logs -name "copilot-gather.log" -exec grep "Total Cost:" {} \; | grep -oE '\$[0-9.]+' | sed 's/\$//' | awk '{sum+=$1} END {print "Total: $" sum}'

# See usage by model
find logs -name "copilot-gather.log" -exec grep "Model:" {} \; | sort | uniq -c
```

### Windows PowerShell

```powershell
# View most recent run folders
Get-ChildItem logs | Sort-Object LastWriteTime -Descending | Select-Object -First 5

# View specific log
Get-Content logs\2026-01-28-200013\copilot-gather.log

# View all logs across all sessions
Get-ChildItem logs -Recurse -Filter "copilot-gather.log" | Get-Content

# Search for specific sessions
Get-ChildItem logs -Recurse -Filter "copilot-gather.log" | Select-String "copilot_1769449138"

# Count total sessions
(Get-ChildItem logs -Recurse -Filter "copilot-gather.log").Count

# Calculate total cost across all sessions
$costs = Get-ChildItem logs -Recurse -Filter "copilot-gather.log" | Select-String "Total Cost: \$" | ForEach-Object { [double]($_ -replace '.*\$([0-9.]+).*','$1') }
"Total: `$" + ($costs | Measure-Object -Sum).Sum

# See usage by model
Get-ChildItem logs -Recurse -Filter "copilot-gather.log" | Select-String "Model:" | ForEach-Object { ($_ -replace '.*Model:\s+','').Trim() } | Group-Object | Select-Object Count, Name
```

### Windows Command Prompt

```batch
REM View most recent folders
dir logs /O-D

REM View specific log
type logs\2026-01-28-200013\copilot-gather.log

REM Search for specific sessions
findstr /S "copilot_1769449138" logs\*.log

REM Count total sessions
dir logs\*\copilot-gather.log /S /B | find /c /v ""
```

## Integration with Token Logger Web UI

If you're using the full Token Logger application with the web interface, you can import these logs using the `copilot-with-logging` script instead, which sends data to the server API for visualization.

For local-only logging (no server), `copilot-gather` is the perfect lightweight solution.

## Troubleshooting

### No logs are being created

**macOS/Linux:**
1. Check that the logs directory exists and is writable:
   ```bash
   ls -la logs/
   ```

2. Verify your copilot binary path is correct:
   ```bash
   which copilot
   ```

3. Make sure the script is executable:
   ```bash
   chmod +x copilot-gather
   ```

**Windows (PowerShell):**
1. Check that the logs directory exists:
   ```powershell
   Test-Path logs
   ```

2. Verify your copilot binary path:
   ```powershell
   Get-Command copilot
   ```

3. Check execution policy:
   ```powershell
   Get-ExecutionPolicy
   # Should be RemoteSigned or Unrestricted
   ```

**Windows (Batch):**
1. Check logs directory exists:
   ```batch
   dir logs
   ```

2. Verify copilot is in PATH:
   ```batch
   where copilot
   ```

### Logs show 0 tokens

This happens when:
- The copilot command didn't use AI (e.g., `--help`)
- The output format changed (GitHub may update it)
- The command failed or was interrupted
- On macOS: sed compatibility issue (should be fixed in latest version)

Check the actual copilot output to see if usage stats are shown.

**Note for Batch users:** The batch version has limited token parsing. Use the PowerShell version for accurate token counts.

**macOS/Linux users:** If you're seeing 0 tokens but copilot is showing usage stats, ensure you have the latest version of the script with BSD-compatible sed patterns (`[[:space:]]+` instead of `\s+`).

### Script not found (macOS/Linux)

If using an alias, make sure:
1. You used an absolute path in the alias
2. You reloaded your shell configuration
3. The script has execute permissions

### PowerShell Execution Policy Error

If you see:
```
File cannot be loaded because running scripts is disabled on this system
```

Run as Administrator:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### PowerShell Function Alias Not Working

Make sure your profile is loaded:
```powershell
# Check if profile exists
Test-Path $PROFILE

# Create if it doesn't exist
if (!(Test-Path $PROFILE)) { New-Item -Path $PROFILE -ItemType File -Force }

# Edit profile
notepad $PROFILE

# After editing, reload
. $PROFILE
```

### Windows: Copilot not found

If you get "copilot.exe is not recognized":
1. Check if copilot is installed: `where copilot`
2. Find the installation path and use full path in the script
3. Common locations:
   - `C:\Program Files\GitHub Copilot CLI\copilot.exe`
   - `C:\Users\<username>\AppData\Local\Programs\copilot\copilot.exe`

## Privacy Note

All logs are stored locally on your machine. No data is sent to any server unless you explicitly use the server-integrated version (`copilot-with-logging`).

## License

Part of the Token Logger project.
