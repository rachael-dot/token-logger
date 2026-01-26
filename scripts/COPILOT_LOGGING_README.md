# Copilot CLI Token Logging

Scripts to capture and log token usage from GitHub Copilot CLI commands.

## Scripts

### 1. `copilot-with-logging` (Wrapper Script)

A wrapper that automatically captures token usage whenever you run copilot commands.

**Usage:**
```bash
# Direct usage
./scripts/copilot-with-logging -p "your prompt here"
./scripts/copilot-with-logging -i "your prompt"
./scripts/copilot-with-logging --help

# Or set up an alias (recommended)
alias copilot="$(pwd)/scripts/copilot-with-logging"
```

**What it does:**
- Runs the actual copilot CLI command
- Displays all output normally
- Parses token usage from the output
- Logs to `logs/copilot-wrapper.log`
- Sends data to API at `http://localhost:3001/api/copilot/tokens`
- Returns the same exit code as copilot

**Example output in logs:**
```
[2026-01-26T17:21:57Z] SESSION: copilot_1769448117 | Model: claude-sonnet-4.5 | In: 16300 | Out: 421 | Cache: 0 | Total: 16721 | Command: -p /usage
```

### 2. `setup-copilot-logging-alias.sh` (Setup Script)

Interactive script to create a shell alias for automatic logging.

**Usage:**
```bash
./scripts/setup-copilot-logging-alias.sh
```

This will:
1. Detect your shell (bash/zsh)
2. Prompt to add an alias to your shell config
3. Automatically replace existing copilot aliases if needed
4. Provide instructions to activate the alias

After running, every time you type `copilot`, it will automatically log token usage.

### 3. `capture-copilot-tokens.sh` (Manual Token Capture)

Runs copilot commands and displays a formatted summary of token usage.

**Usage:**
```bash
# Get current usage stats
./scripts/capture-copilot-tokens.sh "/usage"

# Run with a prompt and capture tokens
./scripts/capture-copilot-tokens.sh "how do I list files"
```

**Features:**
- Displays full copilot output
- Shows formatted token summary
- Saves detailed logs to `logs/`
- Sends data to API

**Example output:**
```
═══════════════════════════════════════════════════
           TOKEN USAGE SUMMARY
═══════════════════════════════════════════════════
Model:           claude-sonnet-4.5
Input Tokens:    35200
Output Tokens:   310
Cache Read:      22400
Total Tokens:    35510
═══════════════════════════════════════════════════
```

## Setup

### Option A: Alias (Recommended)

Run the setup script to automatically configure your shell:

```bash
./scripts/setup-copilot-logging-alias.sh
```

Then reload your shell or run:
```bash
source ~/.zshrc  # or ~/.bashrc for bash
```

Now `copilot` will automatically log token usage.

### Option B: Manual Alias

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
alias copilot="/path/to/token-logger/scripts/copilot-with-logging"
```

### Option C: Direct Usage

Call the wrapper directly without an alias:

```bash
./scripts/copilot-with-logging [copilot options]
```

## Configuration

Set the API URL via environment variable:

```bash
export TOKEN_LOGGER_API_URL="http://localhost:3001"
```

Or modify the default in the scripts.

## Log Files

- `logs/copilot-wrapper.log` - Token usage from wrapper script
- `logs/copilot_*_tokens.log` - Detailed logs from capture script

## API Integration

Token data is sent to: `POST /api/copilot/tokens`

Payload:
```json
{
  "session_id": "copilot_1769448117",
  "input_tokens": 16300,
  "output_tokens": 421,
  "cache_read_tokens": 0,
  "cache_creation_tokens": 0,
  "model": "claude-sonnet-4.5",
  "user": "username",
  "timestamp": "2026-01-26T17:21:57Z"
}
```

## Troubleshooting

**Alias not working:**
- Make sure you sourced your shell config: `source ~/.zshrc`
- Check if the alias exists: `alias | grep copilot`
- Verify the wrapper path is correct

**No token data captured:**
- Token data is only captured when usage stats are in the output
- Try running: `copilot -p "/usage"` to see if tokens are displayed

**API connection fails:**
- This is normal if the server isn't running
- Data will still be logged to files
- Start the server with: `npm run dev`
