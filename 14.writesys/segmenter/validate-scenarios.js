const fs = require('fs');

const lines = fs.readFileSync('test-scenarios.ndjson', 'utf8').split('\n').filter(l => l.trim());

let errors = [];
let totalScenarios = lines.length;
let irregularSentenceCounts = 0;

lines.forEach((line, idx) => {
  const scenario = JSON.parse(line);
  const text = scenario.text;
  const expected = scenario.expected;

  // Count sentences by splitting on period followed by space or newline, or question/exclamation marks
  const sentenceEndings = text.match(/[.!?](?=\s|\n|$)/g);
  const sentenceCount = sentenceEndings ? sentenceEndings.length : 0;

  // Check if expected is in text
  if (!text.includes(expected)) {
    errors.push(`Line ${idx + 1}: Expected sentence not found in text`);
  }

  // Count scenarios with != 3 sentences
  if (sentenceCount !== 3) {
    irregularSentenceCounts++;
  }
});

console.log(`Total scenarios: ${totalScenarios}`);
console.log(`Scenarios with exactly 3 sentence endings: ${totalScenarios - irregularSentenceCounts}`);
console.log(`Scenarios with irregular sentence counts: ${irregularSentenceCounts}`);
console.log(`Validation errors (expected not in text): ${errors.length}`);

if (errors.length > 0) {
  console.log('\nFirst 10 errors:');
  errors.slice(0, 10).forEach(e => console.log(e));
}
