#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'test-scenarios.ndjson');
const outputFile = path.join(__dirname, 'test-scenarios-review.md');

// Read and parse NDJSON
const lines = fs.readFileSync(inputFile, 'utf-8').trim().split('\n');
const scenarios = lines.map(line => JSON.parse(line));

// No longer needed - using description from scenario

// Escape special characters for markdown table
function escapeForTable(text) {
  return text
    .replace(/\|/g, '\\|')       // Escape pipes
    .replace(/\n/g, ' ¶ ');      // Replace newlines with paragraph symbol for visibility
}

// Generate table
let markdown = '# Test Scenarios Review\n\n';
markdown += `Total scenarios: ${scenarios.length}\n\n`;
markdown += '| # | Description | Full Context | Expected Sentence |\n';
markdown += '|---|-------------|--------------|-------------------|\n';

scenarios.forEach((scenario, index) => {
  const num = index + 1;
  const description = escapeForTable(scenario.description || 'No description');
  const context = escapeForTable(scenario.text);
  const expected = escapeForTable(scenario.expected);

  markdown += `| ${num} | ${description} | ${context} | ${expected} |\n`;
});

// Write output
fs.writeFileSync(outputFile, markdown, 'utf-8');

console.log(`✓ Generated review table with ${scenarios.length} scenarios`);
console.log(`✓ Output: ${outputFile}`);
