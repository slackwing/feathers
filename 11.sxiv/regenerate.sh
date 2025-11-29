#!/bin/bash
# Regenerate all calculated examples from source .sxiva files

set -e

echo "======================================================================"
echo "Regenerating calculated/ examples"
echo "======================================================================"
echo ""

# Count files
total=0
success=0
errors=0

for file in examples/*.sxiva; do
    # Skip if no files found
    [ -e "$file" ] || continue

    # Get just the filename
    filename=$(basename "$file")

    # Skip the calculated directory and any special files
    if [[ "$filename" == "INVALID-"* ]] || [[ "$filename" == "unpointed.sxiva" ]]; then
        echo "⊘ Skipping $filename (special file)"
        continue
    fi

    total=$((total + 1))

    # Run calculator
    if python3 -m tools.sxiva.cli calculate "$file" -o "examples/calculated/$filename" 2>&1; then
        success=$((success + 1))
        echo "✓ Generated $filename"
    else
        errors=$((errors + 1))
        echo "✗ Failed $filename"
    fi
done

echo ""
echo "======================================================================"
echo "Summary"
echo "======================================================================"
echo "Total processed: $total"
echo "Successful: $success"
echo "Errors: $errors"

if [ $errors -gt 0 ]; then
    exit 1
fi
