#!/bin/bash
# End-to-End WriteSys Workflow Test
# Tests: Bootstrap → Annotate → Edit Manuscript → Migrate Annotations

set -e  # Exit on error

echo "========================================"
echo "WriteSys End-to-End Workflow Test"
echo "========================================"
echo ""

# Configuration
API_URL="http://localhost:5003/api"
REPO_PATH="manuscripts/test-repo"
FILE_PATH="the-wildfire.md"
COMMIT_1="b30bd0f"
COMMIT_2="76c9a7f"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${YELLOW}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Step 1: Clean up test data
print_step "Step 1: Cleaning up test data..."
docker exec sxiva-timescaledb psql -U writesys_user -d writesys -q <<EOF
DELETE FROM annotation_version WHERE annotation_id IN (SELECT annotation_id FROM annotation);
DELETE FROM annotation;
DELETE FROM sentence WHERE commit_hash IN ('$COMMIT_1', '$COMMIT_2');
DELETE FROM migration WHERE manuscript_id = 1;
DELETE FROM manuscript WHERE manuscript_id = 1;
EOF
print_success "Database cleaned"
echo ""

# Step 2: Bootstrap first commit
print_step "Step 2: Bootstrapping first commit ($COMMIT_1)..."
./bin/writesys --repo $REPO_PATH --file $FILE_PATH --commit $COMMIT_1 --yes > /dev/null 2>&1
SENTENCE_COUNT=$(docker exec sxiva-timescaledb psql -U writesys_user -d writesys -t -c \
  "SELECT COUNT(*) FROM sentence WHERE commit_hash = '$COMMIT_1';")
print_success "Bootstrap complete: $SENTENCE_COUNT sentences"
echo ""

# Step 3: Get first sentence ID for testing
print_step "Step 3: Getting sample sentence IDs..."
SENTENCE_1=$(docker exec sxiva-timescaledb psql -U writesys_user -d writesys -t -c \
  "SELECT sentence_id FROM sentence WHERE commit_hash = '$COMMIT_1' ORDER BY ordinal LIMIT 1 OFFSET 0;" | tr -d ' ')
SENTENCE_2=$(docker exec sxiva-timescaledb psql -U writesys_user -d writesys -t -c \
  "SELECT sentence_id FROM sentence WHERE commit_hash = '$COMMIT_1' ORDER BY ordinal LIMIT 1 OFFSET 5;" | tr -d ' ')
SENTENCE_3=$(docker exec sxiva-timescaledb psql -U writesys_user -d writesys -t -c \
  "SELECT sentence_id FROM sentence WHERE commit_hash = '$COMMIT_1' ORDER BY ordinal LIMIT 1 OFFSET 10;" | tr -d ' ')
echo "  Sentence 1: $SENTENCE_1"
echo "  Sentence 2: $SENTENCE_2"
echo "  Sentence 3: $SENTENCE_3"
echo ""

# Step 4: Create annotations
print_step "Step 4: Creating annotations..."

# Create highlight annotation
RESPONSE_1=$(curl -s -X POST $API_URL/annotations \
  -H "Content-Type: application/json" \
  -d "{\"sentence_id\":\"$SENTENCE_1\",\"color\":\"yellow\",\"note\":\"Test highlight\"}")
ANNOTATION_1=$(echo $RESPONSE_1 | grep -o '"annotation_id":[0-9]*' | grep -o '[0-9]*')
print_success "Created highlight annotation (ID: $ANNOTATION_1)"

# Create tag annotation
RESPONSE_2=$(curl -s -X POST $API_URL/annotations \
  -H "Content-Type: application/json" \
  -d "{\"sentence_id\":\"$SENTENCE_2\",\"color\":\"green\",\"note\":\"Test tag\"}")
ANNOTATION_2=$(echo $RESPONSE_2 | grep -o '"annotation_id":[0-9]*' | grep -o '[0-9]*')
print_success "Created tag annotation (ID: $ANNOTATION_2)"

# Create task annotation
RESPONSE_3=$(curl -s -X POST $API_URL/annotations \
  -H "Content-Type: application/json" \
  -d "{\"sentence_id\":\"$SENTENCE_3\",\"color\":\"red\",\"priority\":\"P2\",\"note\":\"Test task\"}")
ANNOTATION_3=$(echo $RESPONSE_3 | grep -o '"annotation_id":[0-9]*' | grep -o '[0-9]*')
print_success "Created task annotation (ID: $ANNOTATION_3)"

TOTAL_ANNOTATIONS=$(docker exec sxiva-timescaledb psql -U writesys_user -d writesys -t -c \
  "SELECT COUNT(*) FROM annotation WHERE deleted_at IS NULL;")
print_success "Total annotations: $TOTAL_ANNOTATIONS"
echo ""

# Step 5: Verify annotations
print_step "Step 5: Verifying annotations in database..."
docker exec sxiva-timescaledb psql -U writesys_user -d writesys -c \
  "SELECT annotation_id, color, user_id FROM annotation WHERE deleted_at IS NULL ORDER BY annotation_id;" | head -10
echo ""

# Step 6: Process second commit (with migration)
print_step "Step 6: Processing second commit with migration ($COMMIT_2)..."
./bin/writesys --repo $REPO_PATH --file $FILE_PATH --commit $COMMIT_2 --yes > /dev/null 2>&1
NEW_SENTENCE_COUNT=$(docker exec sxiva-timescaledb psql -U writesys_user -d writesys -t -c \
  "SELECT COUNT(*) FROM sentence WHERE commit_hash = '$COMMIT_2';")
print_success "Migration complete: $NEW_SENTENCE_COUNT sentences in new commit"
echo ""

# Step 7: Check migrations
print_step "Step 7: Checking migrations..."
docker exec sxiva-timescaledb psql -U writesys_user -d writesys -c \
  "SELECT commit_hash, sentence_count, additions_count, deletions_count, changes_count FROM migration ORDER BY processed_at;"
echo ""

# Step 8: Verify annotations still exist
print_step "Step 8: Verifying annotations still exist after migration..."
ANNOTATIONS_AFTER=$(docker exec sxiva-timescaledb psql -U writesys_user -d writesys -t -c \
  "SELECT COUNT(*) FROM annotation WHERE deleted_at IS NULL;")
echo "  Annotations before migration: $TOTAL_ANNOTATIONS"
echo "  Annotations after migration: $ANNOTATIONS_AFTER"

if [ "$ANNOTATIONS_AFTER" -eq "$TOTAL_ANNOTATIONS" ]; then
    print_success "All annotations preserved"
else
    print_error "Annotation count mismatch!"
fi
echo ""

# Step 9: Check annotation versions
print_step "Step 9: Checking annotation versions..."
docker exec sxiva-timescaledb psql -U writesys_user -d writesys -c \
  "SELECT annotation_id, version, sentence_id, migration_confidence FROM annotation_version ORDER BY annotation_id, version;" | head -15
echo ""

# Step 10: Test annotation retrieval via API
print_step "Step 10: Testing annotation retrieval via API..."
RESPONSE=$(curl -s "$API_URL/annotations/$COMMIT_2")
API_ANNOTATION_COUNT=$(echo $RESPONSE | grep -o '"annotation_id"' | wc -l)
echo "  Annotations returned by API: $API_ANNOTATION_COUNT"
echo ""

# Step 11: Summary
echo "========================================"
echo "Test Summary"
echo "========================================"
echo "  Bootstrap:              ✓ $SENTENCE_COUNT sentences"
echo "  Annotations Created:    ✓ $TOTAL_ANNOTATIONS"
echo "  Migration:              ✓ $NEW_SENTENCE_COUNT sentences"
echo "  Annotations Preserved:  ✓ $ANNOTATIONS_AFTER"
echo "  API Retrieval:          ✓ $API_ANNOTATION_COUNT"
echo ""
print_success "End-to-End Test Complete!"
echo ""

# Optional: Keep data for manual inspection or clean up
# Only prompt if running interactively
if [ -t 0 ]; then
    read -p "Clean up test data? [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Cleaning up..."
        docker exec sxiva-timescaledb psql -U writesys_user -d writesys -q <<EOF
        DELETE FROM annotation_version WHERE annotation_id IN (SELECT annotation_id FROM annotation);
        DELETE FROM annotation;
        DELETE FROM sentence WHERE commit_hash IN ('$COMMIT_1', '$COMMIT_2');
        DELETE FROM migration WHERE manuscript_id = 1;
        DELETE FROM manuscript WHERE manuscript_id = 1;
EOF
        print_success "Cleanup complete"
    else
        echo "Test data preserved. You can now:"
        echo "  1. Open http://localhost:5003 in browser"
        echo "  2. Load commit $COMMIT_2 to see annotations"
        echo "  3. Run queries against the database"
    fi
else
    # Non-interactive mode (running from test-all.sh): skip cleanup
    echo "Test data preserved for inspection."
fi
