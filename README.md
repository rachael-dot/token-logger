# Token Logger

A comprehensive token usage tracker and cost analyzer for Claude Code and GitHub Copilot CLI with API backend and React dashboard.

## Features

- **Multi-Platform Support**: Track token usage for both Claude Code and GitHub Copilot CLI
- **Detailed Cost Tracking**: Calculate actual costs based on current pricing
- **Premium Request Monitoring**: Track premium API requests (Copilot)
- **Session Management**: Organize sessions with tags and notes
- **Interactive Dashboard**: Real-time visualization of token usage and costs
- **Time-based Filtering**: View stats by day, week, month, or custom date range
- **Export Capabilities**: Session data with detailed breakdowns

## Installation

### Prerequisites

- Node.js 14+ and npm
- GitHub Copilot CLI (for Copilot tracking)
- Claude Code (for Claude tracking)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd token-logger
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Create client environment file** (Required)
   
   Create a file at `client/.env` with the following content:
   ```env
   DANGEROUSLY_DISABLE_HOST_CHECK=true
   WDS_SOCKET_HOST=localhost
   ```
   
   This configuration is required for the webpack dev server to start properly.

4. **Start the development environment**
   ```bash
   npm run dev
   ```
   
   This will start:
   - API server on http://localhost:3001
   - React dashboard on http://localhost:3000

## Usage

### GitHub Copilot CLI

Use the `copilot-with-logging` wrapper script to automatically log token usage:

```bash
./scripts/copilot-with-logging "your prompt here"
```

Or create an alias for seamless integration:

```bash
alias copilot="/path/to/token-logger/scripts/copilot-with-logging"
```

The script will:
- Execute your Copilot command
- Parse token usage and costs
- Log to timestamped folders in `logs/`
- Send data to the API for dashboard display

**Features:**
- Tracks input, output, and cache write tokens
- Calculates actual costs based on model pricing
- Monitors premium request usage
- Creates detailed logs with formatted output
- Saves raw command output to run.log

### Claude Code

Use the Claude hook for automatic tracking:

```bash
# Hook is configured in .claude/settings.json
# Token usage is automatically logged when using Claude Code
```

### Local Logging Only

For offline logging without API integration, use the gather scripts:

```bash
# Copilot
./scripts/copilot-gather "your prompt"

# Claude
./scripts/claude-gather.sh "your prompt"
```

## Dashboard Features

### Overview Stats
- Total sessions and requests
- Total tokens (input/output/cache)
- Premium requests (Copilot)
- Estimated or actual costs

### Session Management
- View all sessions with filtering by platform
- Add tags for organization
- Add notes to sessions
- Sort by date, cost, tokens, or requests
- Delete individual sessions

### Session Details
- Token usage over time (chart)
- Detailed breakdown by request
- Duration tracking
- Actual costs when available

## API Endpoints

### POST /api/copilot/tokens
Log Copilot token usage

**Request body:**
```json
{
  "session_id": "string",
  "input_tokens": 1000,
  "output_tokens": 500,
  "cache_write_tokens": 200,
  "model": "claude-sonnet-4.5",
  "user": "username",
  "timestamp": "2026-01-30T17:40:00Z",
  "duration_ms": 5000,
  "premium_requests": 1,
  "input_cost": 0.0030,
  "output_cost": 0.0075,
  "cache_write_cost": 0.0008,
  "total_cost": 0.0113
}
```

### POST /api/claude/tokens
Log Claude token usage (similar structure)

### GET /api/sessions?platform=copilot
Get all sessions, optionally filtered by platform

### GET /api/sessions/:sessionId
Get detailed session information

### GET /api/stats?platform=copilot&startDate=...&endDate=...
Get aggregated statistics with optional filtering

## Pricing Information

Current pricing (per 1M tokens) as of January 2026:

### Claude Sonnet 4.5
- Input: $3.00
- Output: $15.00
- Cache Write: $3.75

### Claude Opus 4.5
- Input: $5.00
- Output: $25.00
- Cache Write: $10.00

### Claude Haiku 4.5
- Input: $1.00
- Output: $5.00
- Cache Write: $2.00

## Configuration

### Environment Variables

**Server:**
- `PORT` - API server port (default: 3001)

**Client:**
- `REACT_APP_API_URL` - API base URL (uses proxy by default)

**Scripts:**
- `TOKEN_LOGGER_API_URL` - API endpoint for logging (default: http://localhost:3001)

### Database

SQLite database is stored at `data/tokens.db` and includes:
- Sessions table (metadata, tags, notes)
- Entries table (individual token usage records)

## Development

```bash
# Run server only
npm run server

# Run client only
npm run client

# Run both with concurrently
npm run dev

# Build client for production
cd client && npm run build
```

## Troubleshooting

### Webpack Dev Server Error

If you see an error about `allowedHosts` when starting the client:

**Solution:** Ensure `client/.env` exists with the required configuration (see Setup step 3).

### Port Already in Use

If port 3001 is already in use:

```bash
# Kill the process
lsof -ti:3001 | xargs kill -9
```

### Database Issues

To reset the database:

```bash
rm data/tokens.db
# Restart the server to recreate tables
npm run server
```

## Project Structure

```
token-logger/
├── client/               # React dashboard
│   ├── src/
│   │   └── App.js       # Main application
│   ├── public/
│   └── .env             # Client config (create this!)
├── server/
│   └── index.js         # Express API server
├── scripts/
│   ├── copilot-with-logging    # Copilot wrapper with API
│   ├── copilot-gather          # Copilot wrapper (local only)
│   └── claude-gather.sh        # Claude wrapper (local only)
├── .claude/
│   └── hooks/
│       └── claude-with-logging.sh
├── data/
│   └── tokens.db        # SQLite database
└── logs/                # Log files by timestamp
```

## License

[Add your license here]

## Contributing

[Add contributing guidelines here]
