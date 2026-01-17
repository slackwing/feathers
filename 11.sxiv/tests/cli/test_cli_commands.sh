#!/bin/bash
# Test script for CLI commands (log-now, log-end, repeat-entry)
#
# This script:
# 1. Copies source files to expected/
# 2. Runs the appropriate CLI command on each
# 3. Displays the results
#
# Note: These tests use real timestamps, so expected output will vary.
# The purpose is to verify commands run without errors and produce valid output.

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SOURCE_DIR="$SCRIPT_DIR/source"
EXPECTED_DIR="$SCRIPT_DIR/expected"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Testing CLI Commands ==="
echo

# Clean and recreate expected directory
rm -rf "$EXPECTED_DIR"
mkdir -p "$EXPECTED_DIR"

# Test log-now command
echo "Testing log-now..."
for file in "$SOURCE_DIR"/log-now-*.sxiva; do
    basename=$(basename "$file")
    echo -n "  $basename ... "
    cp "$file" "$EXPECTED_DIR/$basename"
    python3 -m tools.sxiva.cli log-now "$EXPECTED_DIR/$basename" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}✗${NC}"
    fi
done
echo

# Test log-end command
echo "Testing log-end..."
for file in "$SOURCE_DIR"/log-end-*.sxiva; do
    basename=$(basename "$file")
    echo -n "  $basename ... "
    cp "$file" "$EXPECTED_DIR/$basename"
    python3 -m tools.sxiva.cli log-end "$EXPECTED_DIR/$basename" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}✗${NC}"
    fi
done
echo

# Test repeat-entry command
echo "Testing repeat-entry..."
for file in "$SOURCE_DIR"/repeat-entry-*.sxiva; do
    basename=$(basename "$file")
    echo -n "  $basename ... "
    cp "$file" "$EXPECTED_DIR/$basename"
    python3 -m tools.sxiva.cli repeat-entry "$EXPECTED_DIR/$basename" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}✗${NC}"
    fi
done
echo

echo "=== Done ==="
echo
echo "Results are in: $EXPECTED_DIR"
echo "You can inspect them with: ls -la $EXPECTED_DIR"
echo "Or diff against source: diff -r $SOURCE_DIR $EXPECTED_DIR"
