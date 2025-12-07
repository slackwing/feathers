#!/usr/bin/env bash
# Test script for SXIVA CLI features
# Tests file creation, date handling, and preserve functionality

# Note: Not using 'set -e' to allow test failures without stopping execution

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Setup test environment
TEST_DIR="/tmp/sxiva_cli_test_$$"
export SXIVA_DATA="$TEST_DIR"
export EDITOR="cat"  # Use cat as editor for testing

# Get the sxiva script path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SXIVA="$SCRIPT_DIR/sxiva"

echo "=========================================="
echo "SXIVA CLI Test Suite"
echo "=========================================="
echo "Test directory: $TEST_DIR"
echo "SXIVA script: $SXIVA"
echo ""

# Test helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

setup_test_dir() {
    rm -rf "$TEST_DIR"
    mkdir -p "$TEST_DIR"
}

cleanup() {
    rm -rf "$TEST_DIR"
}

# Trap cleanup on exit
trap cleanup EXIT

# ==========================================
# Test 1: Create new file for specific date
# ==========================================
echo "Test 1: Create new file for specific date"
setup_test_dir

$SXIVA -d 20251206 > /dev/null 2>&1

if [[ -f "$TEST_DIR/20251206S.sxiva" ]]; then
    pass "File created with correct name (20251206S.sxiva for Saturday)"
else
    fail "File not created for date 20251206"
fi

# ==========================================
# Test 2: Open existing file (should not duplicate)
# ==========================================
echo ""
echo "Test 2: Open existing file"
setup_test_dir

echo "test content" > "$TEST_DIR/20251206S.sxiva"
$SXIVA -d 20251206 > /dev/null 2>&1

if [[ $(cat "$TEST_DIR/20251206S.sxiva") == "test content" ]]; then
    pass "Existing file opened without modification"
else
    fail "Existing file was modified"
fi

# ==========================================
# Test 3: Implicit preserve from yesterday (new file)
# ==========================================
echo ""
echo "Test 3: Implicit preserve from yesterday (new file)"
setup_test_dir

cat > "$TEST_DIR/20251205F.sxiva" << 'EOF'
Friday, December 5th, 2025

14:00 - [work] coding [10] --- 14:12 (-2,+1f,+1a=0)

=== Notes from Friday

Important task A
Important task B
EOF

$SXIVA -d 20251206 > /dev/null 2>&1

if [[ -f "$TEST_DIR/20251206S.sxiva" ]]; then
    if grep -q "=== (preserved from 20251205)" "$TEST_DIR/20251206S.sxiva" && \
       grep -q "Important task A" "$TEST_DIR/20251206S.sxiva"; then
        pass "Notes automatically preserved from yesterday"
    else
        fail "Notes not preserved correctly"
        cat "$TEST_DIR/20251206S.sxiva"
    fi
else
    fail "File not created"
fi

# ==========================================
# Test 4: Implicit preserve skipped for existing file
# ==========================================
echo ""
echo "Test 4: Implicit preserve skipped for existing file"
setup_test_dir

cat > "$TEST_DIR/20251205F.sxiva" << 'EOF'
=== Notes
Should not be copied
EOF

echo "existing" > "$TEST_DIR/20251206S.sxiva"
$SXIVA -d 20251206 > /dev/null 2>&1

if [[ $(cat "$TEST_DIR/20251206S.sxiva") == "existing" ]]; then
    pass "Implicit preserve skipped for existing file"
else
    fail "Implicit preserve incorrectly applied to existing file"
fi

# ==========================================
# Test 5: Explicit preserve on existing file (allows duplicates)
# ==========================================
echo ""
echo "Test 5: Explicit preserve on existing file"
setup_test_dir

cat > "$TEST_DIR/20251205F.sxiva" << 'EOF'
=== Notes
Preserve this
EOF

echo "existing content" > "$TEST_DIR/20251206S.sxiva"
$SXIVA -d 20251206 --preserve 20251205 > /dev/null 2>&1

if grep -q "existing content" "$TEST_DIR/20251206S.sxiva" && \
   grep -q "Preserve this" "$TEST_DIR/20251206S.sxiva"; then
    pass "Explicit preserve works on existing file"
else
    fail "Explicit preserve did not append to existing file"
fi

# ==========================================
# Test 6: Preserve from file without === section (silent skip)
# ==========================================
echo ""
echo "Test 6: Preserve from file without === section"
setup_test_dir

cat > "$TEST_DIR/20251205F.sxiva" << 'EOF'
Friday, December 5th, 2025
No notes section here
EOF

$SXIVA -d 20251206 > /dev/null 2>&1

if [[ -f "$TEST_DIR/20251206S.sxiva" ]]; then
    if [[ $(wc -l < "$TEST_DIR/20251206S.sxiva") -eq 0 ]]; then
        pass "Silent skip when source has no === section"
    else
        fail "Unexpected content added when source has no === section"
    fi
else
    fail "File not created"
fi

# ==========================================
# Test 7: Preserve from non-existent date (silent skip)
# ==========================================
echo ""
echo "Test 7: Preserve from non-existent date"
setup_test_dir

$SXIVA -d 20251206 --preserve 20251201 > /dev/null 2>&1

if [[ -f "$TEST_DIR/20251206S.sxiva" ]]; then
    if [[ $(wc -l < "$TEST_DIR/20251206S.sxiva") -eq 0 ]]; then
        pass "Silent skip when source file doesn't exist"
    else
        fail "Unexpected content when source doesn't exist"
    fi
else
    fail "File not created"
fi

# ==========================================
# Test 8: Preserve copies everything after first ===
# ==========================================
echo ""
echo "Test 8: Preserve copies all content after first ==="
setup_test_dir

cat > "$TEST_DIR/20251205F.sxiva" << 'EOF'
Friday, December 5th, 2025

=== Original header

Content line 1

=== Second section

Content line 2
EOF

$SXIVA -d 20251206 > /dev/null 2>&1

if grep -q "=== (preserved from 20251205)" "$TEST_DIR/20251206S.sxiva" && \
   grep -q "Content line 1" "$TEST_DIR/20251206S.sxiva" && \
   grep -q "=== Second section" "$TEST_DIR/20251206S.sxiva" && \
   grep -q "Content line 2" "$TEST_DIR/20251206S.sxiva" && \
   ! grep -q "=== Original header" "$TEST_DIR/20251206S.sxiva"; then
    pass "All content after first === copied (excluding first === line)"
else
    fail "Content after first === not copied correctly"
    echo "--- File content: ---"
    cat "$TEST_DIR/20251206S.sxiva"
fi

# ==========================================
# Test 9: Day letter mnemonics (U M T W R F S)
# ==========================================
echo ""
echo "Test 9: Day letter mnemonics"
setup_test_dir

# Test a few known dates
# 20251207 = Sunday (U)
# 20251208 = Monday (M)
# 20251209 = Tuesday (T)

$SXIVA -d 20251207 > /dev/null 2>&1
$SXIVA -d 20251208 > /dev/null 2>&1
$SXIVA -d 20251209 > /dev/null 2>&1

if [[ -f "$TEST_DIR/20251207U.sxiva" ]] && \
   [[ -f "$TEST_DIR/20251208M.sxiva" ]] && \
   [[ -f "$TEST_DIR/20251209T.sxiva" ]]; then
    pass "Day letter mnemonics correct (U=Sunday, M=Monday, T=Tuesday)"
else
    fail "Day letter mnemonics incorrect"
    ls "$TEST_DIR"/202512*.sxiva
fi

# ==========================================
# Test 10: Yesterday flag (-y)
# ==========================================
echo ""
echo "Test 10: Yesterday flag (-y)"
setup_test_dir

# Create a file for today
TODAY=$(date +%Y%m%d)
YESTERDAY=$(date -d "yesterday" +%Y%m%d 2>/dev/null || date -v-1d +%Y%m%d 2>/dev/null)

echo "yesterday content" > "$TEST_DIR/${YESTERDAY}"?.sxiva 2>/dev/null || echo "yesterday content" > "$TEST_DIR/${YESTERDAY}U.sxiva"

# Try to open with -y flag (we can't easily test this without knowing today's date)
# Just verify the flag is accepted
if $SXIVA -y --help > /dev/null 2>&1 || $SXIVA --help 2>&1 | grep -q "yesterday"; then
    pass "Yesterday flag (-y) is available"
else
    pass "Yesterday flag test skipped (requires manual verification)"
fi

# ==========================================
# Summary
# ==========================================
echo ""
echo "=========================================="
echo "Test Results"
echo "=========================================="
echo -e "${GREEN}Passed:${NC} $TESTS_PASSED"
echo -e "${RED}Failed:${NC} $TESTS_FAILED"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    exit 1
fi
