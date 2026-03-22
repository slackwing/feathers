#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, '../manuscripts/test-repo/the-wildfire.md');
const outputFile = path.join(__dirname, 'test-scenarios.ndjson');

// Read source file
const source = fs.readFileSync(sourceFile, 'utf-8');

// Find sentence boundaries and return array of {start, end} positions in source
function findSentenceBoundaries(text) {
  const boundaries = [];
  let currentStart = 0;
  let insideQuotes = false;

  // Skip leading whitespace to find first sentence
  while (currentStart < text.length && /\s/.test(text[currentStart])) {
    currentStart++;
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Track quotes
    if (char === '"') {
      insideQuotes = !insideQuotes;
    }

    // Check for sentence terminator
    if (!insideQuotes && (char === '.' || char === '?' || char === '!')) {
      // Check if this is an ellipsis
      if (char === '.' && i + 2 < text.length && text[i+1] === '.' && text[i+2] === '.') {
        i += 2;
        continue;
      }

      // Look ahead for whitespace + uppercase/quote (new sentence)
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) {
        j++;
      }

      if (j < text.length && /[A-Z"\[]/.test(text[j])) {
        // Found sentence boundary
        boundaries.push({start: currentStart, end: i + 1});
        currentStart = j;
      }
    }
  }

  // Add final sentence if exists
  if (currentStart < text.length) {
    const remaining = text.substring(currentStart).trim();
    if (remaining) {
      boundaries.push({start: currentStart, end: text.length});
    }
  }

  return boundaries;
}

// Extract verbatim text from source
function extractVerbatim(text, start, end) {
  return text.substring(start, end);
}

// Find boundaries
const boundaries = findSentenceBoundaries(source);
console.log(`Found ${boundaries.length} sentence boundaries`);

// Extract scenarios
const scenarios = [];
const seenTargets = new Set();

for (let i = 1; i < boundaries.length - 1; i++) {
  // Extract the three sentences VERBATIM
  const beforeStart = boundaries[i - 1].start;
  const afterEnd = boundaries[i + 1].end;

  const contextVerbatim = extractVerbatim(source, beforeStart, afterEnd);
  const targetVerbatim = extractVerbatim(source, boundaries[i].start, boundaries[i].end);

  // Skip if target is very short or a chapter marker
  const targetTrimmed = targetVerbatim.trim();
  if (targetTrimmed.length < 5 || /^(Chapter|I{1,3}|IV|V)\.?$/.test(targetTrimmed)) {
    continue;
  }

  // Skip duplicates
  if (seenTargets.has(targetTrimmed)) continue;
  seenTargets.add(targetTrimmed);

  scenarios.push({
    text: contextVerbatim,
    expected: targetVerbatim
  });
}

console.log(`Extracted ${scenarios.length} unique scenarios`);

// Validate
let errors = 0;
scenarios.forEach((scenario, idx) => {
  // Verify target appears in context
  if (!scenario.text.includes(scenario.expected)) {
    console.error(`Error: Scenario ${idx + 1} target not in context`);
    errors++;
  }

  // Verify context and expected are verbatim (no modifications)
  const contextInSource = source.includes(scenario.text);
  const expectedInSource = source.includes(scenario.expected);

  if (!contextInSource) {
    console.warn(`Warning: Scenario ${idx + 1} context modified from source`);
  }
  if (!expectedInSource) {
    console.error(`Error: Scenario ${idx + 1} expected modified from source`);
    errors++;
  }
});

if (errors > 0) {
  console.error(`\nFound ${errors} errors. Aborting.`);
  process.exit(1);
}

// Write NDJSON
const ndjson = scenarios.map(s => JSON.stringify(s)).join('\n') + '\n';
fs.writeFileSync(outputFile, ndjson, 'utf-8');

console.log(`\n✓ Saved ${scenarios.length} scenarios to test-scenarios.ndjson`);
console.log(`✓ All text is verbatim from source (no modifications)`);
console.log(`✓ Each scenario contains exactly 3 sentences`);
