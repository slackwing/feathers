#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { segment } = require('./segman.js');

function runTests() {
    // Read scenarios.jsonl from tests directory
    const scenariosPath = path.join(__dirname, '..', '..', '..', 'tests', 'scenarios.jsonl');
    const content = fs.readFileSync(scenariosPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() !== '');

    let scenarioCount = 0;
    let passCount = 0;
    const failures = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let scenario;

        try {
            scenario = JSON.parse(line);
        } catch (err) {
            console.error(`Line ${i + 1}: failed to parse JSON: ${err.message}`);
            continue;
        }

        scenarioCount++;

        // Run segmenter on context
        const sentences = segment(scenario.context);

        // Debug scenario 003
        if (scenario.id === '003') {
            console.log(`Context bytes: ${JSON.stringify(scenario.context)}`);
            console.log(`Expected bytes: ${JSON.stringify(scenario.expected)}`);
            sentences.forEach((s, idx) => {
                console.log(`Sentence[${idx}]: ${JSON.stringify(s)}`);
            });
        }

        // Check if expected sentence is in the output
        const found = sentences.some(sentence => sentence === scenario.expected);

        if (!found) {
            failures.push({
                id: scenario.id,
                context: scenario.context,
                expected: scenario.expected,
                got: sentences
            });
            console.log(`    segmenter_test.js:${i + 1}: Scenario ${scenario.id} FAILED`);
        } else {
            passCount++;
            console.log(`    segmenter_test.js:${i + 1}: Scenario ${scenario.id} PASSED`);
        }
    }

    console.log(`    segmenter_test.js:${lines.length + 1}: `);
    console.log(`        === Summary ===`);
    console.log(`        Total: ${scenarioCount}  Passed: ${passCount}  Failed: ${scenarioCount - passCount}`);

    // Print failures
    if (failures.length > 0) {
        console.log('\n=== FAILURES ===');
        failures.forEach(f => {
            console.log(`\nScenario ${f.id}:`);
            console.log(`  Context: ${JSON.stringify(f.context)}`);
            console.log(`  Expected: ${JSON.stringify(f.expected)}`);
            console.log(`  Got: ${JSON.stringify(f.got)}`);
        });
    }

    if (passCount === scenarioCount) {
        console.log('--- PASS: TestScenarios (0.00s)');
        console.log('PASS');
        console.log('ok  \tgithub.com/slackwing/senseg\t0.002s');
        process.exit(0);
    } else {
        console.log('--- FAIL: TestScenarios (0.00s)');
        console.log('FAIL');
        process.exit(1);
    }
}

// Run tests if executed directly
if (require.main === module) {
    console.log('=== RUN   TestScenarios');
    runTests();
}

module.exports = { runTests };
