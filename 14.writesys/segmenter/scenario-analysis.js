const fs = require('fs');

const lines = fs.readFileSync('test-scenarios.ndjson', 'utf8').split('\n').filter(l => l.trim());

const stats = {
  total: lines.length,
  withDialogue: 0,
  withQuestions: 0,
  withEmDashes: 0,
  withItalics: 0,
  withEllipses: 0,
  withParens: 0,
  withColons: 0,
  withNewlines: 0,
  shortSentences: 0,  // < 50 chars
  longSentences: 0,   // > 200 chars
};

lines.forEach((line) => {
  const scenario = JSON.parse(line);
  const expected = scenario.expected;

  if (expected.includes('"')) stats.withDialogue++;
  if (expected.includes('?')) stats.withQuestions++;
  if (expected.includes('—')) stats.withEmDashes++;
  if (expected.includes('*')) stats.withItalics++;
  if (expected.includes('...')) stats.withEllipses++;
  if (expected.includes('(')) stats.withParens++;
  if (expected.includes(':')) stats.withColons++;
  if (expected.includes('\n')) stats.withNewlines++;

  if (expected.length < 50) stats.shortSentences++;
  if (expected.length > 200) stats.longSentences++;
});

console.log('Test Scenario Diversity Report');
console.log('==============================');
console.log(`Total scenarios: ${stats.total}`);
console.log('');
console.log('Punctuation & Formatting:');
console.log(`  Dialogue (quotes):        ${stats.withDialogue}`);
console.log(`  Questions (?):            ${stats.withQuestions}`);
console.log(`  Em dashes (—):            ${stats.withEmDashes}`);
console.log(`  Italics (*):              ${stats.withItalics}`);
console.log(`  Ellipses (...):           ${stats.withEllipses}`);
console.log(`  Parentheticals:           ${stats.withParens}`);
console.log(`  Colons (:):               ${stats.withColons}`);
console.log(`  Paragraph boundaries (\\n): ${stats.withNewlines}`);
console.log('');
console.log('Sentence Length:');
console.log(`  Short (< 50 chars):       ${stats.shortSentences}`);
console.log(`  Long (> 200 chars):       ${stats.longSentences}`);
