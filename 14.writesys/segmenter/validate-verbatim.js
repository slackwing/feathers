#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, '../manuscripts/the-wildfire.md');
const scenariosFile = path.join(__dirname, 'test-scenarios.ndjson');

// Read source
const source = fs.readFileSync(sourceFile, 'utf-8');

// Read scenarios
const lines = fs.readFileSync(scenariosFile, 'utf-8').trim().split('\n');
const scenarios = lines.map(line => JSON.parse(line));

console.log(`Validating ${scenarios.length} scenarios against source manuscript...\n`);

let errors = 0;
let warnings = 0;

scenarios.forEach((scenario, idx) => {
  const num = idx + 1;

  // Check if context exists verbatim in source
  if (!source.includes(scenario.text)) {
    console.error(`❌ Scenario #${num}: Context NOT found verbatim in source`);
    console.error(`   Context preview: ${scenario.text.substring(0, 80)}...`);
    errors++;
  }

  // Check if expected exists verbatim in source
  if (!source.includes(scenario.expected)) {
    console.error(`❌ Scenario #${num}: Expected NOT found verbatim in source`);
    console.error(`   Expected: ${scenario.expected}`);
    errors++;
  }

  // Check if expected is contained within context
  if (!scenario.text.includes(scenario.expected)) {
    console.error(`❌ Scenario #${num}: Expected NOT found within context`);
    console.error(`   Expected: ${scenario.expected}`);
    errors++;
  }
});

console.log(`\n${'='.repeat(60)}`);
if (errors === 0) {
  console.log(`✓ All ${scenarios.length} scenarios are verbatim from source`);
  console.log(`✓ All expected sentences are within their contexts`);
} else {
  console.error(`\n❌ Found ${errors} errors`);
  console.error(`   ${errors} scenarios have text that was modified from source`);
  process.exit(1);
}
