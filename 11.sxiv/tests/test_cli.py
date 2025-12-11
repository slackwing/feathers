#!/usr/bin/env python3
"""Test CLI functionality for sxiva command."""

import os
import sys
import tempfile
import subprocess
from pathlib import Path

# Add project root to path
repo_root = Path(__file__).parent.parent
sys.path.insert(0, str(repo_root))


def test_list_and_open():
    """Test --list and --open functionality."""

    # Create temporary directory for test files
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)

        # Create test files with YYYYMMDD pattern
        test_files = [
            "20251211F.sxiva",
            "20251210R.sxiva",
            "20251209W.sxiva",
            "20251208T.sxiva",
            "20251207M.sxiva",
            "20251206U.sxiva",
            "20251205S.sxiva",
            "20251204F.sxiva",
            "20251203R.sxiva",
            "20251202W.sxiva",
            "20251201T.sxiva",
            "20251130M.sxiva",  # Should be beyond the limit of 10
            "not-a-date.sxiva",  # Should be ignored
        ]

        for filename in test_files:
            (tmppath / filename).touch()

        # Set SXIVA_DATA environment variable
        env = os.environ.copy()
        env['SXIVA_DATA'] = str(tmppath)

        # Test --list
        print("=" * 70)
        print("TEST: --list functionality")
        print("=" * 70)
        result = subprocess.run(
            [sys.executable, "-m", "tools.sxiva.cli", "--list"],
            cwd=str(repo_root),
            env=env,
            capture_output=True,
            text=True
        )

        print("Output:")
        print(result.stdout)

        if result.returncode != 0:
            print(f"Error: {result.stderr}")
            return False

        # Verify output format
        lines = result.stdout.strip().split('\n')

        # Should list exactly 10 files (not 12, since we have a limit)
        expected_count = 10
        if len(lines) != expected_count:
            print(f"✗ FAIL: Expected {expected_count} files, got {len(lines)}")
            return False

        # Verify numbering (1. 2. 3. etc.)
        for i, line in enumerate(lines, 1):
            if not line.startswith(f"{i}."):
                print(f"✗ FAIL: Line {i} doesn't start with '{i}.'")
                print(f"  Got: {line}")
                return False

        # Verify reverse chronological order (newest first)
        expected_first = "1. 20251211F.sxiva"
        expected_last = "10. 20251202W.sxiva"

        if lines[0] != expected_first:
            print(f"✗ FAIL: First line should be '{expected_first}'")
            print(f"  Got: {lines[0]}")
            return False

        if lines[9] != expected_last:
            print(f"✗ FAIL: Last line should be '{expected_last}'")
            print(f"  Got: {lines[9]}")
            return False

        # Verify that "not-a-date.sxiva" is not in the list
        for line in lines:
            if "not-a-date.sxiva" in line:
                print("✗ FAIL: 'not-a-date.sxiva' should not be in the list")
                return False

        # Verify that 20251130M.sxiva is not in the list (beyond limit)
        for line in lines:
            if "20251130M.sxiva" in line:
                print("✗ FAIL: '20251130M.sxiva' should not be in the list (beyond limit of 10)")
                return False

        print("✓ PASS: --list shows correct files in correct order\n")

        # Test --open (without actually opening editor)
        print("=" * 70)
        print("TEST: --open functionality (validation only)")
        print("=" * 70)

        # Test invalid index (0)
        result = subprocess.run(
            [sys.executable, "-m", "tools.sxiva.cli", "--open", "0"],
            cwd=str(repo_root),
            env=env,
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            print("✗ FAIL: --open 0 should fail with invalid index")
            return False

        if "Invalid index" not in result.stderr:
            print("✗ FAIL: --open 0 should show 'Invalid index' error")
            print(f"  Got: {result.stderr}")
            return False

        print("✓ PASS: --open 0 correctly rejected")

        # Test invalid index (11, beyond available files)
        result = subprocess.run(
            [sys.executable, "-m", "tools.sxiva.cli", "--open", "11"],
            cwd=str(repo_root),
            env=env,
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            print("✗ FAIL: --open 11 should fail with invalid index")
            return False

        if "Invalid index" not in result.stderr:
            print("✗ FAIL: --open 11 should show 'Invalid index' error")
            print(f"  Got: {result.stderr}")
            return False

        print("✓ PASS: --open 11 correctly rejected")

        # Test valid index with EDITOR=echo (so it just prints the file path)
        env['EDITOR'] = 'echo'
        result = subprocess.run(
            [sys.executable, "-m", "tools.sxiva.cli", "--open", "1"],
            cwd=str(repo_root),
            env=env,
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            print(f"✗ FAIL: --open 1 should succeed")
            print(f"  Error: {result.stderr}")
            return False

        # Should show "Opening: " message and the file path from echo
        expected_file = str(tmppath / "20251211F.sxiva")
        if expected_file not in result.stdout:
            print(f"✗ FAIL: --open 1 should open 20251211F.sxiva")
            print(f"  Expected: {expected_file}")
            print(f"  Got: {result.stdout}")
            return False

        print("✓ PASS: --open 1 opens correct file")

        # Test opening 5th file
        result = subprocess.run(
            [sys.executable, "-m", "tools.sxiva.cli", "--open", "5"],
            cwd=str(repo_root),
            env=env,
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            print(f"✗ FAIL: --open 5 should succeed")
            print(f"  Error: {result.stderr}")
            return False

        expected_file = str(tmppath / "20251207M.sxiva")
        if expected_file not in result.stdout:
            print(f"✗ FAIL: --open 5 should open 20251207M.sxiva")
            print(f"  Expected: {expected_file}")
            print(f"  Got: {result.stdout}")
            return False

        print("✓ PASS: --open 5 opens correct file\n")

        return True


def test_empty_directory():
    """Test --list with empty directory."""

    with tempfile.TemporaryDirectory() as tmpdir:
        env = os.environ.copy()
        env['SXIVA_DATA'] = str(tmpdir)

        print("=" * 70)
        print("TEST: --list with empty directory")
        print("=" * 70)

        result = subprocess.run(
            [sys.executable, "-m", "tools.sxiva.cli", "--list"],
            cwd=str(repo_root),
            env=env,
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            print(f"✗ FAIL: --list should succeed even with empty directory")
            print(f"  Error: {result.stderr}")
            return False

        if "No YYYYMMDD sxiva files found" not in result.stdout:
            print("✗ FAIL: Should show 'No YYYYMMDD sxiva files found' message")
            print(f"  Got: {result.stdout}")
            return False

        print("✓ PASS: --list handles empty directory correctly\n")

        # Test --open with empty directory
        print("=" * 70)
        print("TEST: --open with empty directory")
        print("=" * 70)

        result = subprocess.run(
            [sys.executable, "-m", "tools.sxiva.cli", "--open", "1"],
            cwd=str(repo_root),
            env=env,
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            print("✗ FAIL: --open should fail with empty directory")
            return False

        if "No YYYYMMDD sxiva files found" not in result.stderr:
            print("✗ FAIL: Should show 'No YYYYMMDD sxiva files found' error")
            print(f"  Got: {result.stderr}")
            return False

        print("✓ PASS: --open handles empty directory correctly\n")

        return True


def main():
    """Run all tests."""
    print("\n" + "=" * 70)
    print("SXIVA CLI TESTS - Testing --list and --open")
    print("=" * 70 + "\n")

    all_passed = True

    # Test 1: List and open functionality
    if not test_list_and_open():
        all_passed = False

    # Test 2: Empty directory
    if not test_empty_directory():
        all_passed = False

    # Summary
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)

    if all_passed:
        print("\n✓ ALL CLI TESTS PASS!")
        return 0
    else:
        print("\n✗ SOME CLI TESTS FAILED")
        return 1


if __name__ == '__main__':
    sys.exit(main())
