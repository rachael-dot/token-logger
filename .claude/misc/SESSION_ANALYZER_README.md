# Claude Code Session Analyzer

A Python script to analyze Claude Code session files (`.jsonl` format) and extract token usage statistics and session duration.

## Features

- **Total Input Tokens**: Sum of all input tokens across all API calls
- **Total Output Tokens**: Sum of all output tokens (Claude's responses)
- **Cache Read Tokens**: Sum of all cache read tokens (cached prompt reuse)
- **Cache Write Tokens**: Sum of all cache creation tokens (prompt caching)
- **Session Duration**: Time from first activity to last activity
- **JSON Output**: Optional JSON format for programmatic use
- **Multiple Files**: Analyze multiple session files at once

## Installation

No installation required! Just Python 3.6+ with standard library modules.

## Usage

### Basic Usage

```bash
python analyze_session.py <path_to_session_file.jsonl>
```

### Examples

#### Analyze a single session file
```bash
python analyze_session.py ~/.claude/projects/my-project/session-id/transcript.jsonl
```

#### Output as JSON for programmatic use
```bash
python analyze_session.py transcript.jsonl --json
```

#### Analyze multiple files
```bash
python analyze_session.py session1.jsonl session2.jsonl session3.jsonl
```

#### Find and analyze all session files in a directory
```bash
find ~/.claude/projects/my-project -name "*.jsonl" -type f | xargs python analyze_session.py
```

#### Analyze all subagent files for a specific session
```bash
python analyze_session.py ~/.claude/projects/my-project/session-id/subagents/*.jsonl
```

## Output Format

### Human-Readable Output (Default)

```
============================================================
Claude Code Session Analysis
============================================================

File: transcript.jsonl
Total lines: 150
Entries with usage data: 45

------------------------------------------------------------
Token Usage:
------------------------------------------------------------
  Input tokens:              25,341
  Output tokens:              8,923
  Cache read tokens:        145,892
  Cache write tokens:        12,450
                       -----------------
  Total tokens:              34,264

------------------------------------------------------------
Session Duration:
------------------------------------------------------------
  Duration: 01:23:45 (5025.0 seconds)

  First activity: 2026-01-20T10:15:30.123000+00:00
  Last activity:  2026-01-20T11:39:15.456000+00:00

============================================================
```

### JSON Output

```json
[
  {
    "file_path": "transcript.jsonl",
    "total_lines": 150,
    "entries_with_usage": 45,
    "total_input_tokens": 25341,
    "total_output_tokens": 8923,
    "total_cache_read_tokens": 145892,
    "total_cache_write_tokens": 12450,
    "total_tokens": 34264,
    "duration_seconds": 5025.0,
    "duration_formatted": "01:23:45",
    "first_timestamp": "2026-01-20T10:15:30.123000+00:00",
    "last_timestamp": "2026-01-20T11:39:15.456000+00:00"
  }
]
```

## Session File Format

Claude Code session files are in JSONL (JSON Lines) format, where each line is a valid JSON object. The script looks for entries with the following structure:

```json
{
  "timestamp": "2026-01-20T10:15:30.123Z",
  "message": {
    "usage": {
      "input_tokens": 100,
      "output_tokens": 50,
      "cache_read_input_tokens": 500,
      "cache_creation_input_tokens": 200
    }
  }
}
```

## Integration with Token Logger

This script complements the Token Logger application by allowing you to:

1. **Analyze sessions before they're logged**: Get token stats from raw session files
2. **Verify token counts**: Compare raw session data with what's stored in the database
3. **Batch analysis**: Process multiple session files at once
4. **Custom reporting**: Use JSON output to create custom reports or dashboards

## Tips

- **Finding session files**: Claude Code stores session transcripts in `~/.claude/projects/`
- **Large files**: The script efficiently processes large session files line by line
- **Invalid JSON**: Lines with invalid JSON are skipped with a warning
- **Subagents**: Subagent sessions are stored in `subagents/` subdirectories

## Error Handling

- Invalid JSON lines are skipped with a warning
- File not found errors exit with status code 1
- Duration calculation handles missing timestamps gracefully

## Requirements

- Python 3.6 or higher
- No external dependencies (uses only standard library)

## License

Part of the Token Logger project for Claude Code.
