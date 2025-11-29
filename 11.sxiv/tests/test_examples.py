#!/usr/bin/env python3
"""Test that example files generate output matching calculated/ directory."""

import subprocess
import sys
from pathlib import Path
import difflib

repo_root = Path(__file__).parent.parent
examples_dir = repo_root / "examples"
calculated_dir = examples_dir / "calculated"
tools_dir = repo_root / "tools"
tmp_dir = Path("/tmp/sxiva_test_output")

# Create tmp directory
tmp_dir.mkdir(exist_ok=True)

# Get all .sxiva files from examples/
all_files = sorted(examples_dir.glob("*.sxiva"))

print("=" * 70)
print("TESTING EXAMPLES - Comparing against calculated/ as source of truth")
print("=" * 70)
print(f"\nTotal example files: {len(all_files)}")

# Generate output to /tmp and compare with calculated/
all_passed = True
passed_count = 0
failed_count = 0

for file_path in all_files:
    expected_file = calculated_dir / file_path.name

    # Skip if no expected calculated version exists
    if not expected_file.exists():
        print(f"⊘ SKIP  - {file_path.name} (no calculated version)")
        continue

    # Generate to /tmp
    tmp_output = tmp_dir / file_path.name
    result = subprocess.run(
        [sys.executable, "-m", "tools.sxiva.cli", "calculate", str(file_path), "--fix", "-o", str(tmp_output)],
        cwd=str(repo_root),
        capture_output=True,
        text=True
    )

    if result.returncode != 0 and "Fixed" not in result.stdout:
        print(f"✗ FAIL  - {file_path.name}")
        print(f"  Error running calculator: {result.stderr[:100]}")
        failed_count += 1
        all_passed = False
        continue

    # Compare output with expected
    with open(tmp_output, 'r') as f:
        actual = f.read()
    with open(expected_file, 'r') as f:
        expected = f.read()

    if actual == expected:
        print(f"✓ PASS  - {file_path.name}")
        passed_count += 1
    else:
        print(f"✗ FAIL  - {file_path.name}")
        print(f"  Output differs from calculated/{file_path.name}")
        # Show diff
        diff = list(difflib.unified_diff(
            expected.splitlines(keepends=True),
            actual.splitlines(keepends=True),
            fromfile=f"calculated/{file_path.name}",
            tofile=f"generated/{file_path.name}",
            lineterm=""
        ))
        for line in diff[:20]:  # Show first 20 lines of diff
            print(f"  {line.rstrip()}")
        if len(diff) > 20:
            print(f"  ... ({len(diff) - 20} more lines)")
        failed_count += 1
        all_passed = False

# Summary
print("\n" + "=" * 70)
print("SUMMARY")
print("=" * 70)

if all_passed:
    print(f"\n✓ ALL TESTS PASS!")
    print(f"  {passed_count}/{passed_count} files match calculated/ directory")
else:
    print(f"\n✗ SOME TESTS FAILED")
    print(f"  {passed_count} passed, {failed_count} failed")

sys.exit(0 if all_passed else 1)
