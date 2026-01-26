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
- **Session Tracking**: Each run gets a unique session ID
- **Duration Tracking**: Records how long each command takes

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

Logs are stored in `./logs/copilot-gather.log` (or your configured `LOGS_DIR`).

### Example Log Entries

```
[2026-01-26T17:38:58Z] SESSION: copilot_1769449138 | Model: claude-sonnet-4.5 | In: 77200 | Out: 2800 | Cache: 49500 | Total: 80000 | Duration: 59s | Command: -p create a .md file that explains how to set up this script on a local machine
[2026-01-26T17:48:11Z] SESSION: copilot_1769449691 | Model: claude-sonnet-4.5 | In: 16600 | Out: 108 | Cache: 11200 | Total: 16708 | Duration: 8s | Command: -p hello
[2026-01-26T19:02:33Z] SESSION: copilot_1769454153 | Model: claude-sonnet-4.5 | In: 16600 | Out: 104 | Cache: 10700 | Total: 16704 | Duration: 7s | Command: -p hello
```

### Log Field Descriptions

| Field | Description |
|-------|-------------|
| **Timestamp** | ISO 8601 format UTC timestamp |
| **SESSION** | Unique session ID (`copilot_<unix_timestamp>`) |
| **Model** | AI model used (e.g., `claude-sonnet-4.5`) |
| **In** | Input tokens sent to the model |
| **Out** | Output tokens generated by the model |
| **Cache** | Cached tokens (prompt caching, reduces cost) |
| **Total** | Total tokens (Input + Output) |
| **Duration** | Command execution time in seconds |
| **Command** | First 100 chars of the command you ran |

## How Token Parsing Works

The script looks for GitHub Copilot's usage statistics in the output:

```
Breakdown by AI model:
  claude-sonnet-4.5  35.2k in, 310 out, 22.4k cached
```

It then:
1. Extracts the model name
2. Parses token counts (handles "k" notation like "35.2k")
3. Converts to actual numbers (35.2k → 35200)
4. Logs everything to the file

## Viewing Your Usage

### macOS/Linux

```bash
# View all logs
cat logs/copilot-gather.log

# View recent logs
tail -20 logs/copilot-gather.log

# Search for specific sessions
grep "copilot_1769449138" logs/copilot-gather.log

# Count total sessions
wc -l logs/copilot-gather.log

# See usage by model
grep -o 'Model: [^|]*' logs/copilot-gather.log | sort | uniq -c
```

### Windows PowerShell

```powershell
# View all logs
Get-Content logs\copilot-gather.log

# View recent logs (last 20 lines)
Get-Content logs\copilot-gather.log -Tail 20

# Search for specific sessions
Select-String "copilot_1769449138" logs\copilot-gather.log

# Count total sessions
(Get-Content logs\copilot-gather.log).Count

# See usage by model
Select-String "Model: [^|]*" logs\copilot-gather.log | ForEach-Object { $_.Matches.Value } | Group-Object | Select-Object Count, Name
```

### Windows Command Prompt

```batch
REM View all logs
type logs\copilot-gather.log

REM Search for specific sessions
findstr "copilot_1769449138" logs\copilot-gather.log

REM Count total sessions
find /c /v "" logs\copilot-gather.log
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

Check the actual copilot output to see if usage stats are shown.

**Note for Batch users:** The batch version has limited token parsing. Use the PowerShell version for accurate token counts.

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
