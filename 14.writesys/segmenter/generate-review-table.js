#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'test-scenarios.ndjson');
const outputFile = path.join(__dirname, 'test-scenarios-review.md');

// Read and parse NDJSON
const lines = fs.readFileSync(inputFile, 'utf-8').trim().split('\n');
const scenarios = lines.map(line => JSON.parse(line));

// Classify pattern
function classifyPattern(expected) {
  const patterns = [];

  if (expected.includes('"')) patterns.push('dialogue');
  if (expected.endsWith('?')) patterns.push('question');
  if (expected.includes('—')) patterns.push('em-dash');
  if (expected.includes('*') && expected.match(/\*[^*]+\*/)) patterns.push('italics');
  if (expected.includes('...')) patterns.push('ellipsis');
  if (expected.includes('(') && expected.includes(')')) patterns.push('parenthetical');
  if (expected.includes(':')) patterns.push('colon');
  if (expected.length < 50) patterns.push('short');
  if (expected.length > 200) patterns.push('long');

  return patterns.length > 0 ? patterns.join(', ') : 'standard';
}

// Escape pipes for markdown table
function escapePipes(text) {
  return text.replace(/\|/g, '\\|');
}

// Generate table
let markdown = '# Test Scenarios Review\n\n';
markdown += `Total scenarios: ${scenarios.length}\n\n`;
markdown += '| # | Pattern | Full Context | Expected Sentence |\n';
markdown += '|---|---------|--------------|-------------------|\n';

scenarios.forEach((scenario, index) => {
  const num = index + 1;
  const pattern = classifyPattern(scenario.expected);
  const context = escapePipes(scenario.text);
  const expected = escapePipes(scenario.expected);

  markdown += `| ${num} | ${pattern} | ${context} | ${expected} |\n`;
});

// Write output
fs.writeFileSync(outputFile, markdown, 'utf-8');

console.log(`✓ Generated review table with ${scenarios.length} scenarios`);
console.log(`✓ Output: ${outputFile}`);
