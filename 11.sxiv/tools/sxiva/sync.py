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
API_BASE_URL = os.getenv('SXIVA_API_URL', 'https://andrewcheong.com/status/api')
API_TOKEN = os.getenv('SXIVA_API_TOKEN', '70e76d8aa02a319a510b8c239e1e7cbe86dbc3c35fec7bf270564757af0c6a90')
DATA_DIR = Path.home() / 'src/minutes/data'


class SxivaSyncClient:
    """Client for syncing .sxiva files to the dashboard API"""

    def __init__(self, api_url: str = API_BASE_URL, api_token: str = API_TOKEN):
        self.api_url = api_url.rstrip('/')
        self.api_token = api_token
        self.extractor = SxivaDataExtractor()

    def get_last_sync_date(self) -> Optional[str]:
        """
        Get the last synced date from the server.

        Returns: Date string like "2025-01-16" or None if request fails
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
                return data.get('last_sync_date')
            else:
                print(f"Warning: Failed to get last sync date: {response.status_code}", file=sys.stderr)
                return None

        except Exception as e:
            print(f"Warning: Failed to contact sync server: {e}", file=sys.stderr)
            return None

    def sync_file(self, file_path: Path) -> bool:
        """
        Sync a single .sxiva file to the server.

        Returns: True if successful, False otherwise
        """
        if not requests:
            return False

        # Extract data from file
        data = self.extractor.extract_from_file(file_path)
        if not data:
            print(f"Warning: Failed to extract data from {file_path}", file=sys.stderr)
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
                return True
            else:
                print(f"Warning: Failed to sync {file_path.name}: {response.status_code} {response.text}", file=sys.stderr)
                return False

        except Exception as e:
            print(f"Warning: Failed to sync {file_path.name}: {e}", file=sys.stderr)
            return False

    def sync_all(self, data_dir: Path, last_sync_date: Optional[str] = None) -> dict:
        """
        Sync all .sxiva files >= last_sync_date.

        Args:
            data_dir: Directory containing .sxiva files
            last_sync_date: Only sync files >= this date (YYYY-MM-DD). If None, sync all.

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

        # Parse last sync date if provided
        cutoff_date = None
        if last_sync_date:
            try:
                cutoff_date = datetime.strptime(last_sync_date, '%Y-%m-%d').date()
            except ValueError:
                print(f"Warning: Invalid last_sync_date format: {last_sync_date}", file=sys.stderr)

        synced = 0
        failed = 0
        skipped = 0

        for file_path in files:
            # Extract date from filename
            file_date_str = self.extractor._extract_date_from_filename(file_path.name)
            if not file_date_str:
                skipped += 1
                continue

            # Check if we should sync this file
            if cutoff_date:
                try:
                    file_date = datetime.strptime(file_date_str, '%Y-%m-%d').date()
                    if file_date < cutoff_date:
                        skipped += 1
                        continue
                except ValueError:
                    skipped += 1
                    continue

            # Sync the file
            if self.sync_file(file_path):
                synced += 1
            else:
                failed += 1

        return {'synced': synced, 'failed': failed, 'skipped': skipped}


def sync_now(data_dir: Optional[Path] = None, quiet: bool = False) -> bool:
    """
    Sync all .sxiva files to the dashboard.

    This is called by the sxiva command before opening the editor.

    Args:
        data_dir: Directory containing .sxiva files (default: ~/src/minutes/data)
        quiet: If True, suppress all output

    Returns:
        True if sync completed (even if some files failed)
    """
    if data_dir is None:
        data_dir = DATA_DIR

    if not requests:
        if not quiet:
            print("Sync skipped: requests library not installed", file=sys.stderr)
        return True

    try:
        client = SxivaSyncClient()

        # Get last sync date from server
        last_sync_date = client.get_last_sync_date()

        if not quiet and last_sync_date:
            print(f"Last sync: {last_sync_date}", file=sys.stderr)

        # Sync all files
        result = client.sync_all(data_dir, last_sync_date)

        if not quiet:
            if result['synced'] > 0:
                print(f"Synced {result['synced']} file(s) to dashboard", file=sys.stderr)
            if result['failed'] > 0:
                print(f"Warning: Failed to sync {result['failed']} file(s)", file=sys.stderr)

        return True

    except Exception as e:
        if not quiet:
            print(f"Warning: Sync failed: {e}", file=sys.stderr)
        return True  # Don't block sxiva command on sync failure


if __name__ == '__main__':
    # Test the sync client
    import argparse

    parser = argparse.ArgumentParser(description='Sync .sxiva files to dashboard')
    parser.add_argument('--data-dir', type=Path, help='Data directory (default: ~/src/minutes/data)')
    parser.add_argument('--quiet', action='store_true', help='Suppress output')
    args = parser.parse_args()

    success = sync_now(args.data_dir, args.quiet)
    sys.exit(0 if success else 1)
