#!/usr/bin/env python3
"""
Analyze each test scenario and add precise technical descriptions
focusing on sentence boundary detection challenges.
Remove duplicates that don't add unique test coverage.
"""

import json

# Read all scenarios
with open('test-scenarios.ndjson', 'r', encoding='utf-8') as f:
    scenarios = [json.loads(line) for line in f]

print(f"Analyzing {len(scenarios)} scenarios...\n")

# Analyze each scenario for unique parsing challenges
improved = []
seen_patterns = set()

for i, scenario in enumerate(scenarios, 1):
    text = scenario['text']
    expected = scenario['expected']

    # Build list of technical features
    features = []

    # Check for leading/trailing whitespace issues
    if expected.startswith(' ') or expected.startswith('\n'):
        features.append(f"ISSUE: expected starts with whitespace")
    if text.startswith(' ') or text.startswith('\n'):
        features.append(f"ISSUE: text starts with whitespace")

    # Analyze expected sentence structure
    exp_clean = expected.strip()

    # Paragraph breaks
    if '\n\n' in text:
        features.append('paragraph-break')
    if '  \n' in text:
        features.append('double-space-newline')

    # Markdown
    if '###' in text:
        features.append('heading-in-context')

    # Check expected sentence boundaries
    if exp_clean.startswith('*') and '*' in exp_clean[1:]:
        features.append('italics-at-start-boundary')
    if exp_clean.endswith('*') and '*' in exp_clean[:-1]:
        features.append('italics-at-end-boundary')
    if '*' in exp_clean and not (exp_clean.startswith('*') or exp_clean.endswith('*')):
        features.append('italics-mid-sentence')

    # Em dashes
    em_count = exp_clean.count('—')
    if em_count >= 4:
        features.append(f'many-em-dashes-{em_count}')
    elif em_count >= 2:
        features.append(f'multiple-em-dashes-{em_count}')
    elif em_count == 1:
        if exp_clean.startswith('—'):
            features.append('em-dash-at-start-boundary')
        elif exp_clean.endswith('—'):
            features.append('em-dash-at-end-boundary')
        else:
            features.append('em-dash-mid-sentence')

    # Dialogue
    if '"' in exp_clean:
        if exp_clean.startswith('"'):
            features.append('dialogue-at-start-boundary')
        if exp_clean.endswith('"') or exp_clean.endswith('."') or exp_clean.endswith('!"') or exp_clean.endswith('?"'):
            features.append('dialogue-at-end-boundary')
        if '"' in exp_clean and not (exp_clean.startswith('"') or exp_clean.endswith('"')):
            features.append('dialogue-mid-sentence')

    # Check for dialogue attribution patterns
    if '" ' in exp_clean and (' said' in exp_clean or ' asked' in exp_clean or 'I do remember' in exp_clean):
        features.append('dialogue-attribution')

    # Punctuation patterns
    if '...' in exp_clean:
        if exp_clean.startswith('...'):
            features.append('ellipsis-at-start')
        elif exp_clean.endswith('...'):
            features.append('ellipsis-at-end')
        else:
            features.append('ellipsis-mid-sentence')

    # Colons
    if ':' in exp_clean:
        features.append('colon-mid-sentence')

    # Questions
    if exp_clean.endswith('?'):
        features.append('ends-with-question')
    if '?' in exp_clean and not exp_clean.endswith('?'):
        features.append('question-mid-sentence')

    # Parentheticals
    if '(' in exp_clean and ')' in exp_clean:
        if '?' in exp_clean[exp_clean.find('('):exp_clean.find(')')+1]:
            features.append('parenthetical-question')
        else:
            features.append('parenthetical')

    # Sentence length
    word_count = len([w for w in exp_clean.split() if w])
    if word_count <= 3:
        features.append('very-short-sentence')
    elif word_count <= 7:
        features.append('short-sentence')
    elif word_count >= 40:
        features.append('very-long-sentence')

    # Special constructions
    if 'had had' in exp_clean.lower():
        features.append('had-had-construction')
    if exp_clean.endswith(', ha.'):
        features.append('informal-ha-ending')

    # Incomplete sentences (fragments)
    if exp_clean.endswith('!') and len(exp_clean) < 10:
        features.append('exclamation-fragment')
    if not any(exp_clean.endswith(p) for p in ['.', '?', '!']):
        features.append('ISSUE: no sentence terminator')

    print(f"#{i}: {', '.join(features) if features else 'BASIC'}")
    print(f"   Expected: {exp_clean[:80]}...")
    print()

    scenario['features'] = features
    improved.append(scenario)

print(f"\nProcessed {len(improved)} scenarios")
print("Review the output above to identify duplicates and issues")
