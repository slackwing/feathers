#!/usr/bin/env python3
"""Fix all test scenarios based on sentence boundary rules."""

import json

# Read the source manuscript
with open('/home/slackwing/src/worktree-writesys/14.writesys/manuscripts/the-wildfire.md', 'r') as f:
    manuscript = f.read()

# Define the fixed scenarios
scenarios = []

# Scenarios 1-11 are correct, keep them as-is
scenarios_to_keep = list(range(1, 12))

# Read existing scenarios
with open('/home/slackwing/src/worktree-writesys/14.writesys/segmenter/test-scenarios.ndjson', 'r') as f:
    existing = [json.loads(line) for line in f if line.strip()]

# Keep scenarios 1-11
for i in range(11):
    scenarios.append(existing[i])

# Fix #12: Heading as separate sentence
# Sentence 1: "We spoke it so sincerely, *upon a time*."
# Sentence 2: "### II"
# Sentence 3: "I'm sitting here and, I can't seem to get started—starting at the beginning where I should, way back in Kostya's basement."
scenarios.append({
    "text": "We spoke it so sincerely, *upon a time*.\n\n### II\n\nI'm sitting here and, I can't seem to get started—starting at the beginning where I should, way back in Kostya's basement.",
    "expected": "\n\n### II\n\n",
    "description": "Ellipsis mid-sentence does not indicate boundary plus heading markdown in surrounding context"
})

# Fix #13: Don't include leading linebreak
# Sentence 1: "I'm sitting here and, I can't seem to get started—starting at the beginning where I should, way back in Kostya's basement."
# Sentence 2: "I guess I'm more used to telling a story when I feel like it—when one comes to me to be let out."
# Sentence 3: "For me at least, I feel like memories choose their own time to come alive."
scenarios.append({
    "text": "I'm sitting here and, I can't seem to get started—starting at the beginning where I should, way back in Kostya's basement. I guess I'm more used to telling a story when I feel like it—when one comes to me to be let out. For me at least, I feel like memories choose their own time to come alive.",
    "expected": " I guess I'm more used to telling a story when I feel like it—when one comes to me to be let out.",
    "description": "Em dash with when-clause elaboration"
})

# Fix #14: Don't include leading linebreak
# Sentence 1: "For me at least, I feel like memories choose their own time to come alive."
# Sentence 2: "So let me just start with the one that's knocking now."
# Sentence 3: "I don't know if you'd remember but, there was a day you agreed to swap shifts with Lindsey and work the afternoon instead of your usual evening."
scenarios.append({
    "text": "For me at least, I feel like memories choose their own time to come alive.  \nSo let me just start with the one that's knocking now.  \nI don't know if you'd remember but, there was a day you agreed to swap shifts with Lindsey and work the afternoon instead of your usual evening.",
    "expected": " So let me just start with the one that's knocking now.",
    "description": "Very short sentence (9 words) with transitional function"
})

# Keep #15
scenarios.append(existing[14])

# Keep #16
scenarios.append(existing[15])

# Fix #17: Extend context to "living room." not "Yay!"
# Need to find where the sentence ACTUALLY ends
# Looking at manuscript line 14:
# "Oh, you'd definitely remember, because: It was the day you burst through the front door and flung your purse across the room, shouting, "Yay! Home!"—except the purse opened mid-air and everything spilled out all over the living room."
# This is ONE sentence! The dialogue doesn't create a boundary because it's part of a participial phrase
# Sentence 1: "Those were the days when you'd text me just as you were getting out of work, and I'd order Carmella's and have the food laid out in a circle around your spot on the couch."
# Sentence 2: "Oh, you'd definitely remember, because: It was the day you burst through the front door and flung your purse across the room, shouting, "Yay! Home!"—except the purse opened mid-air and everything spilled out all over the living room."
# Sentence 3: "I remember looking at the debris field and then looking at you with my mouth still hanging open."
scenarios.append({
    "text": "Those were the days when you'd text me just as you were getting out of work, and I'd order Carmella's and have the food laid out in a circle around your spot on the couch. Oh, you'd definitely remember, because: It was the day you burst through the front door and flung your purse across the room, shouting, \"Yay! Home!\"—except the purse opened mid-air and everything spilled out all over the living room. I remember looking at the debris field and then looking at you with my mouth still hanging open.",
    "expected": " Oh, you'd definitely remember, because: It was the day you burst through the front door and flung your purse across the room, shouting, \"Yay! Home!\"—except the purse opened mid-air and everything spilled out all over the living room.",
    "description": "Colon before narrative explanation with dialogue spanning boundary"
})

# Fix #18: Should have exactly 3 sentences
# Current has 4. Looking at manuscript:
# Line 14: "I remember realizing who it was and being surprised his number survived all these years, changing phones, even carriers. I probably gave you a look as I picked up."
# Line 15: "Hello?"
# Line 16: "I waited a second."
# So sentences are:
# 1. "I remember realizing who it was and being surprised his number survived all these years, changing phones, even carriers."
# 2. "I probably gave you a look as I picked up."
# 3. ""Hello?""
# 4. "I waited a second."
# We need a 3-sentence window. Let's use sentences 1, 2, 3:
scenarios.append({
    "text": "I remember realizing who it was and being surprised his number survived all these years, changing phones, even carriers. I probably gave you a look as I picked up.  \n\"Hello?\"",
    "expected": " I probably gave you a look as I picked up.",
    "description": "Participial phrases (gerunds) in series"
})

# Fix #19: Should have exactly 3 sentences, don't include linebreaks
# Current text has 4 lines/sentences
# Line 16: "I waited a second."
# Line 17: ""Hey, A—.""
# Line 18: "I mean, maybe."
# Line 18 cont: "Maybe that's how it went."
# Sentences are:
# 1. "I waited a second."
# 2. ""Hey, A—.""
# 3. "I mean, maybe."
# 4. "Maybe that's how it went."
# We want sentences 2, 3, 4 or 1, 2, 3. Let's use 2, 3, 4:
scenarios.append({
    "text": "\"Hey, A—.\"  \nI mean, maybe. Maybe that's how it went.",
    "expected": " I mean, maybe.",
    "description": "Very short sentence (3 words) between dialogue lines"
})

# Keep #20
scenarios.append(existing[19])

# Fix #21: Second sentence ends at "yelled," then "Ow! F—!" is its own sentence
# Looking at manuscript line 18-19:
# "On the other hand, there are inconsequential moments I remember in unreasonable detail, like how hard it was to push myself up with one hand—the other hand holding the phone—out of that plush, deep-seated couch of yours—while gesturing to you that I was going to the bedroom—you nodding "of course"—and taking a step when a jolt ran up my leg and I yelled,"
# ""Ow! F—!""
# "Whatever it was from your purse—but, that's why I remember it was that day."
#
# Sentence 1: The long sentence ending in "and I yelled,"
# Sentence 2: ""Ow! F—!""
# Sentence 3: "Whatever it was from your purse—but, that's why I remember it was that day."
scenarios.append({
    "text": "On the other hand, there are inconsequential moments I remember in unreasonable detail, like how hard it was to push myself up with one hand—the other hand holding the phone—out of that plush, deep-seated couch of yours—while gesturing to you that I was going to the bedroom—you nodding \"of course\"—and taking a step when a jolt ran up my leg and I yelled,  \n\"Ow! F—!\"  \nWhatever it was from your purse—but, that's why I remember it was that day.",
    "expected": " \"Ow! F—!\"",
    "description": "Five em dashes in single sentence with dialogue at boundary"
})

# Keep remaining scenarios (22-64, which are indices 21-63)
for i in range(21, len(existing)):
    scenarios.append(existing[i])

# Write fixed scenarios
with open('/home/slackwing/src/worktree-writesys/14.writesys/segmenter/test-scenarios.ndjson', 'w') as f:
    for scenario in scenarios:
        f.write(json.dumps(scenario) + '\n')

print(f"Fixed {len(scenarios)} scenarios")
print("Fixed scenarios: #12, #13, #14, #17, #18, #19, #21")
