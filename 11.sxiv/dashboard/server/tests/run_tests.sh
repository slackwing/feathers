#!/bin/bash
#
# Run API tests against both local and remote endpoints
#
# Usage:
#   ./dashboard/server/tests/run_tests.sh

set -e

cd "$(dirname "$0")/../../.."

echo "========================================="
echo "Testing LOCAL API (http://localhost:5000)"
echo "========================================="
python3 -m pytest dashboard/server/tests/test_api.py -v --tb=short

echo ""
echo "========================================="
echo "Testing REMOTE API (https://andrewcheong.com/status/api)"
echo "========================================="
TEST_API_URL=https://andrewcheong.com/status/api python3 -m pytest dashboard/server/tests/test_api.py -v --tb=short

echo ""
echo "========================================="
echo "✅ All tests passed!"
echo "========================================="
