#!/bin/bash
# Run all WriteSys tests

set -e  # Exit on first error

echo "========================================"
echo "WriteSys Complete Test Suite"
echo "========================================"
echo ""

# Check if API is running
if ! curl -s http://localhost:5003/health > /dev/null 2>&1; then
  echo "❌ ERROR: API server not running on port 5003"
  echo "   Start it with: API_PORT=5003 ./bin/writesys-api"
  exit 1
fi

# 1. Unit Tests
echo "1. Running Go unit tests..."
echo "----------------------------"
go test ./... || { echo "❌ Unit tests failed"; exit 1; }
echo "✓ Unit tests passed"
echo ""

# 2. End-to-End Tests
echo "2. Running end-to-end workflow test..."
echo "---------------------------------------"
./test-e2e.sh || { echo "❌ E2E tests failed"; exit 1; }
echo ""

# 3. Visual UI Tests
echo "3. Running Playwright UI tests..."
echo "----------------------------------"
node browser-testing/test-complete.js || { echo "❌ UI tests failed"; exit 1; }
echo ""

# Summary
echo "========================================"
echo "✅ ALL TESTS PASSED!"
echo "========================================"
echo ""
echo "Test artifacts:"
echo "  - browser-testing/test-complete.png  (UI screenshot)"
echo "  - coverage.out                       (Go coverage)"
echo ""
