# Token Logger Setup Guide

Complete guide to setting up the Copilot CLI token logging scripts on your local machine.

## Prerequisites

- **GitHub Copilot CLI** installed and configured
  - Install: `npm install -g @githubnext/github-copilot-cli`
  - Or verify it's installed: `which copilot`
- **Bash or Zsh** shell
- **curl** (for API integration - usually pre-installed on macOS/Linux)

## Installation Steps

### 1. Clone or Download the Repository

```bash
# Clone the repository
git clone <repository-url> token-logger
cd token-logger
```

Or if you already have the files, navigate to the project directory:

```bash
cd /path/to/token-logger
```

### 2. Make Scripts Executable

```bash
chmod +x scripts/*.sh
chmod +x scripts/copilot-with-logging
chmod +x scripts/copilot-gather
```

### 3. Create Logs Directory

The logs directory should already exist, but if not:

```bash
mkdir -p scripts/logs
```

### 4. Set Up the Copilot Alias

**Option A: Automated Setup (Recommended)**

Run the interactive setup script:

```bash
./scripts/setup-copilot-logging-alias.sh
```

This will:
- Detect your shell (bash/zsh)
- Ask permission to add an alias to your shell config
- Handle existing copilot aliases
- Provide activation instructions

**Option B: Manual Setup**

Add this line to your shell configuration file:

For Zsh (`~/.zshrc`):
```bash
echo 'alias copilot="/full/path/to/token-logger/scripts/copilot-with-logging"' >> ~/.zshrc
```

For Bash (`~/.bashrc` or `~/.bash_profile`):
```bash
echo 'alias copilot="/full/path/to/token-logger/scripts/copilot-with-logging"' >> ~/.bashrc
```

Replace `/full/path/to/token-logger` with the actual path.

### 5. Activate the Alias

Reload your shell configuration:

```bash
# For Zsh
source ~/.zshrc

# For Bash
source ~/.bashrc  # or ~/.bash_profile
```

Or simply open a new terminal window.

### 6. Verify Installation

Test that the alias is working:

```bash
# Check the alias
alias | grep copilot

# Test with a simple command
copilot -p "/usage"
```

You should see copilot output normally, and token usage will be logged.

### 7. Optional: Set Up the API Server

If you want to send token data to a database/API:

1. Ensure the API server is configured (check project root for server setup)
2. Start the server:
   ```bash
   npm run dev
   ```
3. The default API URL is `http://localhost:3001`

To use a different API URL, set the environment variable:

```bash
export TOKEN_LOGGER_API_URL="http://your-server:port"
```

Add this to your shell config to make it permanent.

## Usage

Once set up, simply use copilot as normal:

```bash
# Any copilot command will now automatically log token usage
copilot -p "how do I list files"
copilot -i "help me debug this code"
copilot --help
```

### Manual Token Capture

For more detailed output, use the capture script directly:

```bash
./scripts/capture-copilot-tokens.sh "your prompt here"
```

This displays a formatted token usage summary.

## Configuration

### Environment Variables

- `TOKEN_LOGGER_API_URL` - API endpoint (default: `http://localhost:3001`)
- Set in your shell config for persistence:
  ```bash
  echo 'export TOKEN_LOGGER_API_URL="http://localhost:3001"' >> ~/.zshrc
  ```

### Log Files

Logs are stored in `scripts/logs/`:
- `copilot-wrapper.log` - Main token usage log
- `copilot_*_tokens.log` - Detailed session logs

To view recent logs:
```bash
tail -f scripts/logs/copilot-wrapper.log
```

## Verification Checklist

- [ ] GitHub Copilot CLI installed (`which copilot`)
- [ ] Scripts are executable (`ls -l scripts/copilot-with-logging`)
- [ ] Logs directory exists (`ls scripts/logs`)
- [ ] Alias configured (`alias | grep copilot`)
- [ ] Alias activated (`source ~/.zshrc` or new terminal)
- [ ] Test command runs (`copilot -p "/usage"`)
- [ ] Logs are being written (`cat scripts/logs/copilot-wrapper.log`)

## Troubleshooting

### Alias Not Found

**Problem:** `copilot: command not found` or alias doesn't work

**Solutions:**
1. Check the alias exists: `alias | grep copilot`
2. Verify the path in the alias is correct
3. Reload your shell: `source ~/.zshrc`
4. Open a new terminal window
5. Check which shell you're using: `echo $SHELL`

### Permission Denied

**Problem:** `Permission denied` when running scripts

**Solution:**
```bash
chmod +x scripts/*.sh
chmod +x scripts/copilot-with-logging
```

### No Token Data Logged

**Problem:** Scripts run but no tokens are captured

**Reasons:**
- Token usage only appears for certain commands (especially those with `-p` flag)
- Copilot may not show usage stats for simple commands
- Check if copilot itself shows tokens: `copilot -p "/usage"`

**Solution:**
Test with a command that definitely shows tokens:
```bash
copilot -p "write a hello world script"
```

### API Connection Fails

**Problem:** API errors in logs

**This is normal if:**
- The API server isn't running
- You haven't set up the server component

**Solution:**
- Data will still be logged to files even without the API
- Start the API server if needed: `npm run dev`
- Or ignore API errors if you only need file logging

### Existing Copilot Alias Conflicts

**Problem:** You already have a copilot alias

**Solution:**
1. Run `alias | grep copilot` to see current alias
2. Edit your shell config to remove/replace old alias
3. Run setup script again: `./scripts/setup-copilot-logging-alias.sh`

## Uninstallation

To remove the token logging:

1. Edit your shell config (`~/.zshrc` or `~/.bashrc`)
2. Remove the copilot alias line
3. Reload: `source ~/.zshrc`

To completely remove:
```bash
rm -rf /path/to/token-logger
```

## Additional Scripts

### Session Management

- `copilot-session-start.sh` - Start a new logging session
- `copilot-session-end.sh` - End current session
- `copilot-gather` - Gather copilot data

### Advanced Usage

- `copilot-log-prompt.sh` - Log prompts separately
- `copilot-prompt-submit-with-tokens.sh` - Submit prompts with token tracking
- `read_output.sh` - Read and parse copilot output

See `COPILOT_LOGGING_README.md` for detailed documentation on each script.

## Getting Help

- Check `COPILOT_LOGGING_README.md` for detailed script documentation
- Test copilot directly: `copilot --help`
- View logs: `cat scripts/logs/copilot-wrapper.log`

## Next Steps

Once installed:

1. Use copilot normally - tokens will be logged automatically
2. Monitor logs: `tail -f scripts/logs/copilot-wrapper.log`
3. Review token usage patterns in your logs
4. Set up the API server if you want database integration

Happy token tracking! 🚀
