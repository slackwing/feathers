#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, '../manuscripts/the-wildfire.md');
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

// Categorize sentence pattern
function categorizePattern(sentence) {
  const patterns = [];

  if (sentence.includes('"')) patterns.push('dialogue');
  if (sentence.endsWith('?')) patterns.push('question');
  if (sentence.includes('—')) patterns.push('em-dash');
  if (sentence.includes('*') && sentence.match(/\*[^*]+\*/)) patterns.push('italics');
  if (sentence.includes('...')) patterns.push('ellipsis');
  if (sentence.includes('(') && sentence.includes(')')) patterns.push('parenthetical');
  if (sentence.includes(':')) patterns.push('colon');
  if (sentence.match(/^###?\s/)) patterns.push('heading');
  if (sentence.includes('\n')) patterns.push('paragraph-break');

  return patterns.join(',') || 'standard';
}

// Find boundaries
const boundaries = findSentenceBoundaries(source);
console.log(`Found ${boundaries.length} sentence boundaries`);

// Extract unique edge case scenarios
const scenarios = [];
const seenPatterns = new Set();

for (let i = 1; i < boundaries.length - 1; i++) {
  const beforeBoundary = boundaries[i - 1];
  const targetBoundary = boundaries[i];
  const afterBoundary = boundaries[i + 1];

  // Extract EXACTLY 3 sentences verbatim (before, target, after)
  const contextStart = beforeBoundary.start;
  const contextEnd = afterBoundary.end;
  const contextVerbatim = extractVerbatim(source, contextStart, contextEnd);

  // Extract the middle sentence (target)
  const targetVerbatim = extractVerbatim(source, targetBoundary.start, targetBoundary.end);

  // Skip if target is very short or a heading marker
  const targetTrimmed = targetVerbatim.trim();
  if (targetTrimmed.length < 5 || /^###?\s/.test(targetTrimmed)) {
    continue;
  }

  // Categorize pattern
  const pattern = categorizePattern(targetTrimmed);

  // Only keep unique patterns or interesting variations
  const patternKey = pattern + ':' + (targetTrimmed.length > 100 ? 'long' : targetTrimmed.length < 20 ? 'short' : 'medium');

  // Skip duplicate patterns unless it's a unique variation
  if (seenPatterns.has(patternKey)) {
    // Allow some duplicates for complex patterns
    if (!pattern.includes(',') || seenPatterns.size < 50) {
      continue;
    }
  }

  seenPatterns.add(patternKey);

  scenarios.push({
    text: contextVerbatim,
    expected: targetVerbatim
  });
}

console.log(`Extracted ${scenarios.length} unique edge case scenarios`);

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

console.log(`\n✓ Saved ${scenarios.length} unique edge case scenarios to test-scenarios.ndjson`);
console.log(`✓ All text is verbatim from source (no modifications)`);
console.log(`✓ Each context contains exactly 3 contiguous sentences`);
console.log(`✓ Each expected is the MIDDLE sentence`);
