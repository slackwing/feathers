#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, '../manuscripts/the-wildfire.md');

// Read source
let content = fs.readFileSync(sourceFile, 'utf-8');

// Split into lines
let lines = content.split('\n');

// Process line by line
let fixed = [];
let inParagraph = false;
let paragraphLines = [];

function flushParagraph() {
  if (paragraphLines.length > 0) {
    // Join paragraph into sentences with proper spacing
    const para = paragraphLines.join(' ').trim();
    if (para) {
      fixed.push(para);
      fixed.push(''); // Double break after paragraph
    }
    paragraphLines = [];
    inParagraph = false;
  }
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

  // Skip if empty
  if (!line) {
    flushParagraph();
    continue;
  }

  // Check if it's a heading
  if (line === 'Chapter 1' || line === 'Chapter 2') {
    flushParagraph();
    fixed.push(`## ${line}`);
    fixed.push('');
    continue;
  }

  // Roman numerals as level 3 headings
  if (/^I{1,3}\.?$/.test(line) || /^IV\.?$/.test(line) || /^V\.?$/.test(line)) {
    flushParagraph();
    fixed.push(`### ${line.replace(/\.$/, '')}`);
    fixed.push('');
    continue;
  }

  // Regular content - accumulate into paragraph
  paragraphLines.push(line);
  inParagraph = true;
}

// Flush any remaining paragraph
flushParagraph();

// Add title at the beginning
let finalContent = '# The Wildfire\n\n' + fixed.join('\n');

// Remove any triple+ newlines (reduce to double)
finalContent = finalContent.replace(/\n{3,}/g, '\n\n');

// Write back
fs.writeFileSync(sourceFile, finalContent, 'utf-8');

console.log('✓ Fixed markdown formatting');
console.log('✓ Added title: # The Wildfire');
console.log('✓ Converted chapters to ## headings');
console.log('✓ Converted roman numerals to ### headings');
console.log('✓ Reformatted paragraphs with double breaks');
