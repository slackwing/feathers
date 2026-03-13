#!/usr/bin/env python3
"""
SXIVA Sync Client

Syncs .sxiva files to the dashboard API.
"""

import os
import sys
from pathlib import Path
from datetime import datetime
from typing import List, Optional

try:
    import requests
except ImportError:
    print("Warning: requests library not installed. Run: pip install requests", file=sys.stderr)
    requests = None

# Import parser extractor
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from tools.sxiva.parser_extractor import SxivaDataExtractor


# Configuration
API_BASE_URL = os.getenv('SXIVA_API_URL', 'https://andrewcheong.com/status')
API_TOKEN = os.getenv('SXIVA_API_TOKEN', '70e76d8aa02a319a510b8c239e1e7cbe86dbc3c35fec7bf270564757af0c6a90')
DATA_DIR = Path.home() / 'src/minutes/data'


class SxivaSyncClient:
    """Client for syncing .sxiva files to the dashboard API"""

    def __init__(self, api_url: str = API_BASE_URL, api_token: str = API_TOKEN):
        self.api_url = api_url.rstrip('/')
        self.api_token = api_token
        self.extractor = SxivaDataExtractor()

    def get_last_sync_timestamp(self) -> Optional[datetime]:
        """
        Get the last sync timestamp from the server.

        Returns: datetime object or None if request fails
        """
        if not requests:
            return None

        try:
            response = requests.get(
                f'{self.api_url}/api/status/last-sync',
                headers={'Authorization': f'Bearer {self.api_token}'},
                timeout=5
            )

            if response.status_code == 200:
                data = response.json()
                timestamp_str = data.get('last_sync_timestamp')
                if timestamp_str:
                    # Parse ISO format timestamp
                    return datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                return None
            else:
                print(f"Warning: Failed to get last sync timestamp: {response.status_code}", file=sys.stderr)
                return None

        except Exception as e:
            print(f"Warning: Failed to contact sync server: {e}", file=sys.stderr)
            return None

    def sync_file(self, file_path: Path, verbose: bool = False) -> bool:
        """
        Sync a single .sxiva file to the server.

        Args:
            file_path: Path to .sxiva file
            verbose: If True, print progress messages

        Returns: True if successful, False otherwise
        """
        if not requests:
            return False

        # Extract data from file
        data = self.extractor.extract_from_file(file_path)
        if not data:
            if verbose:
                print(f"  ✗ {file_path.name}: Failed to extract data", file=sys.stderr)
            return False

        try:
            response = requests.post(
                f'{self.api_url}/api/sync/daily',
                headers={
                    'Authorization': f'Bearer {self.api_token}',
                    'Content-Type': 'application/json'
                },
                json=data,
                timeout=10
            )

            if response.status_code == 200:
                if verbose:
                    print(f"  ✓ {data['date']}: Synced", file=sys.stderr)
                return True
            else:
                if verbose:
                    print(f"  ✗ {file_path.name}: {response.status_code}", file=sys.stderr)
                return False

        except Exception as e:
            if verbose:
                print(f"  ✗ {file_path.name}: {e}", file=sys.stderr)
            return False

    def sync_all(self, data_dir: Path, last_sync_timestamp: Optional[datetime] = None, verbose: bool = False) -> dict:
        """
        Sync all .sxiva files modified after last_sync_timestamp.

        Args:
            data_dir: Directory containing .sxiva files
            last_sync_timestamp: Only sync files modified after this timestamp. If None, sync all.
            verbose: If True, print detailed progress messages

        Returns:
            dict with 'synced', 'failed', 'skipped' counts
        """
        if not data_dir.exists():
            print(f"Warning: Data directory not found: {data_dir}", file=sys.stderr)
            return {'synced': 0, 'failed': 0, 'skipped': 0}

        # Get all .sxiva files
        files = sorted(data_dir.glob('*.sxiva'))
        if not files:
            return {'synced': 0, 'failed': 0, 'skipped': 0}

        # Collect files to sync
        files_to_sync = []
        synced = 0
        failed = 0
        skipped = 0

        for file_path in files:
            # Check if file has valid .sxiva filename
            file_date_str = self.extractor._extract_date_from_filename(file_path.name)
            if not file_date_str:
                skipped += 1
                continue

            # Check if we should sync this file based on modification time
            if last_sync_timestamp:
                try:
                    # Get file modification time as UTC timestamp
                    import time
                    file_mtime_utc = file_path.stat().st_mtime

                    # Convert last_sync_timestamp to UTC timestamp for comparison
                    last_sync_utc = last_sync_timestamp.timestamp()

                    # Only sync if file was modified after last sync
                    if file_mtime_utc <= last_sync_utc:
                        skipped += 1
                        continue
                except (OSError, ValueError):
                    skipped += 1
                    continue

            files_to_sync.append(file_path)

        # Print summary before syncing
        if verbose and files_to_sync:
            print(f"Syncing {len(files_to_sync)} file(s) to dashboard...", file=sys.stderr)

        # Sync the files
        for file_path in files_to_sync:
            if self.sync_file(file_path, verbose=verbose):
                synced += 1
            else:
                failed += 1

        return {'synced': synced, 'failed': failed, 'skipped': skipped}


def sync_now(data_dir: Optional[Path] = None, verbose: bool = True, api_url: Optional[str] = None) -> bool:
    """
    Sync all .sxiva files to the dashboard.

    This is called by the sxiva command before opening the editor.

    Args:
        data_dir: Directory containing .sxiva files (default: ~/src/minutes/data)
        verbose: If True, show detailed progress messages
        api_url: API base URL (default: from SXIVA_API_URL env var or https://andrewcheong.com/status/api)

    Returns:
        True if sync completed (even if some files failed)
    """
    if data_dir is None:
        data_dir = DATA_DIR

    if not requests:
        if verbose:
            print("Sync skipped: requests library not installed", file=sys.stderr)
        return True

    try:
        # Use provided API URL, or fall back to environment/default
        if api_url is None:
            api_url = os.getenv('SXIVA_API_URL', API_BASE_URL)

        client = SxivaSyncClient(api_url=api_url)

        # Get last sync timestamp from server
        last_sync_timestamp = client.get_last_sync_timestamp()

        if verbose:
            if last_sync_timestamp:
                print(f"Last sync: {last_sync_timestamp.strftime('%Y-%m-%d %H:%M:%S')}", file=sys.stderr)
            else:
                print("Last sync: No previous sync found", file=sys.stderr)

        # Sync all files modified after last sync
        result = client.sync_all(data_dir, last_sync_timestamp, verbose=verbose)

        if verbose:
            if result['synced'] > 0:
                print(f"✓ Synced {result['synced']} file(s) to dashboard", file=sys.stderr)
            elif result['skipped'] > 0:
                print("✓ All files up to date (nothing to sync)", file=sys.stderr)
            if result['failed'] > 0:
                print(f"✗ Warning: Failed to sync {result['failed']} file(s)", file=sys.stderr)

        return True

    except Exception as e:
        if verbose:
            print(f"Warning: Sync failed: {e}", file=sys.stderr)
        return True  # Don't block sxiva command on sync failure


if __name__ == '__main__':
    # Test the sync client
    import argparse

    parser = argparse.ArgumentParser(description='Sync .sxiva files to dashboard')
    parser.add_argument('--data-dir', type=Path, help='Data directory (default: ~/src/minutes/data)')
    parser.add_argument('--quiet', action='store_true', help='Suppress output')
    args = parser.parse_args()

    success = sync_now(args.data_dir, verbose=not args.quiet)
    sys.exit(0 if success else 1)
