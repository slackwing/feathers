#!/usr/bin/env python3
"""Manually fix each problematic scenario"""

import json

# Read source
with open('../manuscripts/the-wildfire.md', 'r') as f:
    source = f.read()

# Read scenarios
with open('test-scenarios.ndjson', 'r') as f:
    scenarios = [json.loads(line) for line in f]

# Manual fixes based on user feedback
# I'll go through each one and fix it

fixed_scenarios = []

for i, s in enumerate(scenarios, 1):
    if i == 12:
        # #12: Heading is its own sentence
        fixed_scenarios.append({
            "text": "But no, I ask seriously, because... well, I'm writing to you now because I wanted to tell you how, on that day of the wildfire on 101, I *couldn't* tell you how, 2,638 miles away an Uber driver in Manhattan was boarding his flight to come kill me.\n\n### II\n\nI'm sitting here and, I can't seem to get started—starting at the beginning where I should, way back in Kostya's basement.",
            "expected": "### II",
            "description": "Heading is its own sentence after paragraph break"
        })
    elif i == 13:
        # Remove the heading from this one, use next 3 sentences
        fixed_scenarios.append({
            "text": "### II\n\nI'm sitting here and, I can't seem to get started—starting at the beginning where I should, way back in Kostya's basement. I guess I'm more used to telling a story when I feel like it—when one comes to me to be let out.",
            "expected": "I'm sitting here and, I can't seem to get started—starting at the beginning where I should, way back in Kostya's basement.",
            "description": "Em dash with when-clause elaboration"
        })
    elif i == 14:
        # #14: Remove leading linebreak
        fixed_scenarios.append({
            "text": "For me at least, I feel like memories choose their own time to come alive.  \nSo let me just start with the one that's knocking now.  \nI don't know if you'd remember but, there was a day you agreed to swap shifts with Lindsey and work the afternoon instead of your usual evening.",
            "expected": "So let me just start with the one that's knocking now.",
            "description": "Very short sentence (9 words) with transitional function"
        })
    elif i == 15:
        # #15: Remove leading linebreak
        fixed_scenarios.append({
            "text": "So let me just start with the one that's knocking now.  \nI don't know if you'd remember but, there was a day you agreed to swap shifts with Lindsey and work the afternoon instead of your usual evening. So we said we'd hang out when you got home.",
            "expected": "I don't know if you'd remember but, there was a day you agreed to swap shifts with Lindsey and work the afternoon instead of your usual evening.",
            "description": "Long dependent clause with embedded subordinate clause"
        })
    elif i == 17:
        # #17: Fix - sentence should end at "living room." - need to find the complete sentence
        # From source: "Oh, you'd definitely remember, because: It was the day you burst through the front door and flung your purse across the room, shouting, "Yay! Home!"—except the purse opened mid-air and everything spilled out all over the living room."
        fixed_scenarios.append({
            "text": "Those were the days when you'd text me just as you were getting out of work, and I'd order Carmella's and have the food laid out in a circle around your spot on the couch. Oh, you'd definitely remember, because: It was the day you burst through the front door and flung your purse across the room, shouting, \"Yay! Home!\"—except the purse opened mid-air and everything spilled out all over the living room. I remember looking at the debris field and then looking at you with my mouth still hanging open.",
            "expected": "Oh, you'd definitely remember, because: It was the day you burst through the front door and flung your purse across the room, shouting, \"Yay! Home!\"—except the purse opened mid-air and everything spilled out all over the living room.",
            "description": "Colon before narrative with dialogue mid-sentence and em dash continuation"
        })
    elif i == 18:
        # #18: Has 4 sentences - paragraph breaks create boundaries. Pick a different window.
        # "Hello?" is its own sentence after paragraph break
        fixed_scenarios.append({
            "text": "I remember realizing who it was and being surprised his number survived all these years, changing phones, even carriers. I probably gave you a look as I picked up.  \n\"Hello?\"",
            "expected": "I probably gave you a look as I picked up.",
            "description": "Participial phrases (gerunds) in series"
        })
    elif i == 19:
        # #19: Has 4 sentences. "Hey, A—." is its own sentence. Remove line breaks from expected.
        fixed_scenarios.append({
            "text": "I probably gave you a look as I picked up.  \n\"Hello?\"  \nI waited a second.",
            "expected": "\"Hello?\"",
            "description": "Very short dialogue sentence after paragraph break"
        })
    elif i == 21:
        # #21: Sentence ends at "yelled," then "Ow! F—!" is its own sentence
        fixed_scenarios.append({
            "text": "To some degree I have to make this up—because I remember feeling feelings and thinking thoughts but not always the exact words I was hearing or saying. On the other hand, there are inconsequential moments I remember in unreasonable detail, like how hard it was to push myself up with one hand—the other hand holding the phone—out of that plush, deep-seated couch of yours—while gesturing to you that I was going to the bedroom—you nodding \"of course\"—and taking a step when a jolt ran up my leg and I yelled,  \n\"Ow!",
            "expected": "On the other hand, there are inconsequential moments I remember in unreasonable detail, like how hard it was to push myself up with one hand—the other hand holding the phone—out of that plush, deep-seated couch of yours—while gesturing to you that I was going to the bedroom—you nodding \"of course\"—and taking a step when a jolt ran up my leg and I yelled,",
            "description": "Five em dashes in single sentence ending with comma before dialogue"
        })
    else:
        # Keep as-is
        fixed_scenarios.append(s)

# Write fixed scenarios
with open('test-scenarios.ndjson', 'w') as f:
    for s in fixed_scenarios:
        f.write(json.dumps(s) + '\n')

print(f"Fixed {len(fixed_scenarios)} scenarios")
print("Fixed: #12, #13, #14, #15, #17, #18, #19, #21")
