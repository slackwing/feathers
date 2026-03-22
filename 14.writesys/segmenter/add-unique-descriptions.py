#!/usr/bin/env python3
"""
Meticulously analyze each test scenario and add precise technical descriptions.
Remove duplicates that don't provide unique test coverage.
"""

import json

# Read all scenarios
with open('test-scenarios.ndjson', 'r', encoding='utf-8') as f:
    scenarios = [json.loads(line) for line in f]

print(f"Analyzing {len(scenarios)} scenarios...\n")

# Define unique test scenarios with precise descriptions
# Each description should explain the SENTENCE BOUNDARY DETECTION challenge

unique_scenarios = []

# Manually curate based on parsing challenges
# I'll go through systematically and identify unique patterns

def analyze_scenario(text, expected):
    """Analyze a scenario and return a technical description of its parsing challenge."""
    exp = expected.strip()

    # This is where I'll write very specific descriptions for each unique pattern
    # For now, return a placeholder
    return "TO_BE_DESCRIBED"

# Process all scenarios and categorize by unique parsing challenges
for i, scenario in enumerate(scenarios, 1):
    unique_scenarios.append({
        "text": scenario["text"],
        "expected": scenario["expected"],
        "description": analyze_scenario(scenario["text"], scenario["expected"]),
        "original_index": i
    })

# For now, write all scenarios with placeholder descriptions
# I'll manually review and fill in precise descriptions
with open('test-scenarios-analyzed.ndjson', 'w') as f:
    for scenario in unique_scenarios:
        f.write(json.dumps({
            "text": scenario["text"],
            "expected": scenario["expected"],
            "description": scenario["description"]
        }) + '\n')

print(f"Wrote {len(unique_scenarios)} scenarios for manual review")
print("\nNext step: Manually review each scenario and write precise technical descriptions")
print("Focus on: em dash placement, dialogue boundaries, italics, ellipsis, colons,")
print("paragraph breaks, questions in parentheticals, etc.")
