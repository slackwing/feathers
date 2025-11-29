#!/usr/bin/env bash
# Run SXIVA test suite

set -e

cd "$(dirname "$0")"

echo "Running SXIVA tests..."
echo ""

python3 tests/test_examples.py

echo ""
echo "Done!"
