#!/usr/bin/env python3
"""
Fix identified issues in test scenarios:
1. Paragraph breaks (double-space newline) create sentence boundaries
2. Headings are their own sentences
3. Expected sentences should not include leading linebreaks
4. Ensure exactly 3 sentences in each context
"""

import json
import re

# Read the source manuscript
with open('../manuscripts/the-wildfire.md', 'r', encoding='utf-8') as f:
    source = f.read()

# Read current scenarios
with open('test-scenarios.ndjson', 'r', encoding='utf-8') as f:
    scenarios = [json.loads(line) for line in f]

print(f"Analyzing {len(scenarios)} scenarios for issues...\n")

def count_sentences(text):
    """Count sentences based on the rules:
    - Period, !, ? followed by whitespace and uppercase = sentence boundary
    - Paragraph breaks (  \\n or \\n\\n) create boundaries
    - Headings (###) are their own sentences
    """
    sentences = []
    current_start = 0
    inside_quotes = False
    i = 0

    while i < len(text):
        char = text[i]

        # Track quotes
        if char == '"':
            inside_quotes = not inside_quotes

        # Check for paragraph break as sentence boundary
        if i < len(text) - 2:
            # Double-space newline or double newline
            if (text[i:i+3] == '  \n' or text[i:i+2] == '\n\n'):
                # End current sentence
                sentence = text[current_start:i].strip()
                if sentence and not sentence.startswith('#'):
                    sentences.append(sentence)

                # Skip whitespace
                while i < len(text) and text[i] in ' \n':
                    i += 1
                current_start = i
                continue

        # Check for heading
        if text[i:i+3] == '###' or (i == 0 and text[i] == '#'):
            # Find end of heading line
            end = text.find('\n', i)
            if end == -1:
                end = len(text)
            heading = text[i:end].strip()
            sentences.append(heading)
            i = end + 1
            current_start = i
            continue

        # Check for sentence terminator
        if not inside_quotes and char in '.!?':
            # Check for ellipsis
            if char == '.' and i + 2 < len(text) and text[i+1] == '.' and text[i+2] == '.':
                i += 2
                i += 1
                continue

            # Find next non-whitespace
            j = i + 1
            while j < len(text) and text[j] in ' \t':
                j += 1

            # Check if next char is uppercase or newline or quote
            if j < len(text) and (text[j].isupper() or text[j] == '\n' or text[j] == '"' or text[j] == '#'):
                sentence = text[current_start:i+1].strip()
                if sentence and not sentence.startswith('#'):
                    sentences.append(sentence)
                current_start = j
                i = j
                continue

        i += 1

    # Handle remaining text
    if current_start < len(text):
        sentence = text[current_start:].strip()
        if sentence and not sentence.startswith('#'):
            sentences.append(sentence)

    return sentences

# Check each scenario
issues = []
for idx, scenario in enumerate(scenarios, 1):
    text = scenario['text']
    expected = scenario['expected']

    # Count sentences in context
    sentences = count_sentences(text)

    # Check if expected starts with linebreak
    if expected.startswith('\n') or expected.startswith('  \n'):
        issues.append(f"#{idx}: Expected starts with linebreak")

    # Check sentence count
    if len(sentences) != 3:
        issues.append(f"#{idx}: Has {len(sentences)} sentences instead of 3")
        print(f"#{idx}: Found {len(sentences)} sentences:")
        for i, s in enumerate(sentences, 1):
            print(f"  {i}. {s[:80]}...")
        print()

if issues:
    print(f"\nFound {len(issues)} issues:")
    for issue in issues:
        print(f"  {issue}")
else:
    print("\nNo issues found!")

print(f"\nProblematic scenarios: {[12, 13, 14, 17, 18, 19, 21]}")
