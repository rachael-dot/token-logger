#!/usr/bin/env python3
"""
Claude Code Session Analyzer

Reads a Claude Code session JSON file (JSONL format) and extracts:
- Total input tokens
- Total output tokens
- Total cache read tokens (cache_read_input_tokens)
- Total cache write tokens (cache_creation_input_tokens)
- Session duration

Usage:
    python analyze_session.py <path_to_session_file.jsonl>
"""

import json
import sys
from datetime import datetime
from typing import Dict, List, Optional


def parse_timestamp(timestamp_str: str) -> datetime:
    """Parse ISO 8601 timestamp string to datetime object."""
    # Handle both 'Z' and '+00:00' timezone formats
    timestamp_str = timestamp_str.replace('Z', '+00:00')
    return datetime.fromisoformat(timestamp_str)


def analyze_session(file_path: str) -> Dict:
    """
    Analyze a Claude Code session file and extract token usage and duration.

    Args:
        file_path: Path to the .jsonl session file

    Returns:
        Dictionary containing analysis results
    """
    total_input_tokens = 0
    total_output_tokens = 0
    total_cache_read_tokens = 0
    total_cache_write_tokens = 0

    first_timestamp: Optional[datetime] = None
    last_timestamp: Optional[datetime] = None

    line_count = 0
    entries_with_usage = 0

    try:
        with open(file_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue

                try:
                    entry = json.loads(line)
                    line_count += 1

                    # Extract timestamp
                    if 'timestamp' in entry:
                        timestamp = parse_timestamp(entry['timestamp'])
                        if first_timestamp is None:
                            first_timestamp = timestamp
                        last_timestamp = timestamp

                    # Extract usage data from message
                    if 'message' in entry and 'usage' in entry['message']:
                        usage = entry['message']['usage']
                        entries_with_usage += 1

                        # Add up token counts
                        total_input_tokens += usage.get('input_tokens', 0)
                        total_output_tokens += usage.get('output_tokens', 0)
                        total_cache_read_tokens += usage.get('cache_read_input_tokens', 0)
                        total_cache_write_tokens += usage.get('cache_creation_input_tokens', 0)

                except json.JSONDecodeError as e:
                    print(f"Warning: Skipping invalid JSON line: {e}", file=sys.stderr)
                    continue

        # Calculate duration
        duration_seconds = 0
        duration_formatted = "N/A"
        if first_timestamp and last_timestamp:
            duration = last_timestamp - first_timestamp
            duration_seconds = duration.total_seconds()

            # Format duration as HH:MM:SS
            hours = int(duration_seconds // 3600)
            minutes = int((duration_seconds % 3600) // 60)
            seconds = int(duration_seconds % 60)
            duration_formatted = f"{hours:02d}:{minutes:02d}:{seconds:02d}"

        return {
            'file_path': file_path,
            'total_lines': line_count,
            'entries_with_usage': entries_with_usage,
            'total_input_tokens': total_input_tokens,
            'total_output_tokens': total_output_tokens,
            'total_cache_read_tokens': total_cache_read_tokens,
            'total_cache_write_tokens': total_cache_write_tokens,
            'total_tokens': total_input_tokens + total_output_tokens,
            'duration_seconds': duration_seconds,
            'duration_formatted': duration_formatted,
            'first_timestamp': first_timestamp.isoformat() if first_timestamp else None,
            'last_timestamp': last_timestamp.isoformat() if last_timestamp else None,
        }

    except FileNotFoundError:
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error reading file: {e}", file=sys.stderr)
        sys.exit(1)


def print_results(results: Dict):
    """Print analysis results in a formatted way."""
    print("\n" + "="*60)
    print("Claude Code Session Analysis")
    print("="*60)
    print(f"\nFile: {results['file_path']}")
    print(f"Total lines: {results['total_lines']}")
    print(f"Entries with usage data: {results['entries_with_usage']}")

    print("\n" + "-"*60)
    print("Token Usage:")
    print("-"*60)
    print(f"  Input tokens:       {results['total_input_tokens']:>15,}")
    print(f"  Output tokens:      {results['total_output_tokens']:>15,}")
    print(f"  Cache read tokens:  {results['total_cache_read_tokens']:>15,}")
    print(f"  Cache write tokens: {results['total_cache_write_tokens']:>15,}")
    print(f"  {'':21}{'-' * 17}")
    print(f"  Total tokens:       {results['total_tokens']:>15,}")

    print("\n" + "-"*60)
    print("Session Duration:")
    print("-"*60)
    print(f"  Duration: {results['duration_formatted']} ({results['duration_seconds']:.1f} seconds)")

    if results['first_timestamp']:
        print(f"\n  First activity: {results['first_timestamp']}")
    if results['last_timestamp']:
        print(f"  Last activity:  {results['last_timestamp']}")

    print("\n" + "="*60 + "\n")


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Analyze Claude Code session files and extract token usage and duration",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Analyze a session file with formatted output
  python analyze_session.py transcript.jsonl

  # Output as JSON for programmatic use
  python analyze_session.py transcript.jsonl --json

  # Analyze multiple files
  python analyze_session.py session1.jsonl session2.jsonl

  # Find and analyze all session files
  find ~/.claude -name "*.jsonl" | xargs python analyze_session.py
        """
    )
    parser.add_argument('files', nargs='+', help='Path(s) to session file(s) (.jsonl)')
    parser.add_argument('--json', action='store_true', help='Output results as JSON')

    args = parser.parse_args()

    all_results = []
    for file_path in args.files:
        results = analyze_session(file_path)
        all_results.append(results)

        if not args.json:
            print_results(results)

    if args.json:
        print(json.dumps(all_results, indent=2))


if __name__ == "__main__":
    main()
