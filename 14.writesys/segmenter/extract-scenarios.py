#!/usr/bin/env python3
"""
Extract test scenarios from the manuscript.
This script extracts EXACTLY verbatim text from the source.
"""

import json

# Read the source manuscript
with open('../manuscripts/the-wildfire.md', 'r') as f:
    source = f.read()

# Define scenarios by manually extracting from source
# Each scenario is a 3-sentence triplet where we test extracting the middle sentence

scenarios = []

# Manually extract scenarios - copying EXACTLY from source
# I'll use string slicing with exact character positions to ensure verbatim extraction

# Function to help find text in source
def find_triplet_by_start(start_text, sentence_count=3):
    """Find a passage starting with start_text and extract sentence_count sentences"""
    idx = source.find(start_text)
    if idx == -1:
        print(f"WARNING: Could not find: {start_text[:50]}")
        return None

    # From this position, find the next sentence_count sentence endings
    # Sentence ends with . ! or ? followed by space/newline and uppercase, or end of text
    pos = idx
    sentences = []
    current_sentence = ""

    while len(sentences) < sentence_count and pos < len(source):
        char = source[pos]
        current_sentence += char

        # Check for sentence boundary
        if char in '.!?':
            # Look ahead to see if this is really a sentence end
            if pos + 1 >= len(source):  # End of document
                sentences.append(current_sentence)
                break
            elif pos + 1 < len(source) and source[pos + 1] in ' \n\t':
                # Check if followed by uppercase or newline
                peek_pos = pos + 1
                while peek_pos < len(source) and source[peek_pos] in ' \n\t':
                    peek_pos += 1

                if peek_pos < len(source) and (source[peek_pos].isupper() or source[peek_pos] in '"\'*['):
                    sentences.append(current_sentence)
                    current_sentence = ""
                    if len(sentences) < sentence_count:
                        pos += 1
                        continue

        pos += 1

    if current_sentence:
        sentences.append(current_sentence)

    return sentences

# Now manually define scenarios with exact text
# I'll build these by extracting directly from source file

# Scenario triplets - manually extracted
triplet_defs = [
    ("And those sample-sized bottles of champagne", "Long sentence with multiple em dashes"),
    ("We felt lucky, didn't we?", "Long descriptive sentence"),
    ("What if the fire were to reach us?", "Short simple sentence"),
    ("We shrugged and laughed.", "Dialogue with curly quotes"),
    ("*So it was*—the epidemic", "Italics with em dash"),
    ("Drinking champagne with our shoes", "Long gerund phrase"),
    ("But you know, when we sat down", "Em dash with parenthetical"),
    ("But now I look back and think", "Em dash with repetition"),
    ("Because I remember, not long after, a cloud", "Long sentence with participial phrases"),
    ("Families in their cars who we fancied", "Parenthetical question"),
    ("We took shyer sips of champagne.", "Short simple sentence"),
    ("But as happens so often", "Em dashes with parenthetical question"),
    ("Ah well, who in their 30s", "Em dash with repeated word"),
    ("And something we can all relate", "Short sentence"),
    ("Sometimes though, we can't relate.", "Colon before question"),
    ("I've wondered a lot these days:", "Question"),
    ("What fault is it of theirs", "Sentence with quoted word"),
    ("I smile writing this,", "Italicized phrase"),
    ("We spoke it so sincerely,", "Long sentence with ellipsis"),
    ("But no, I ask seriously,", "Em dash with gerund"),
    ("I'm sitting here and, I can't seem", "Em dash with when clause"),
    ("I guess I'm more used to telling", "Simple sentence"),
    ("For me at least, I feel like memories", "Transition sentence"),
    ("So let me just start with the one", "Long dependent clause"),
    ("I don't know if you'd remember but,", "Short sentence with clause"),
    ("So we said we'd hang out", "Long compound sentence"),
    ("Those were the days when you'd text", "Long sentence with participial"),
    ("The caller ID read", "One-word dialogue"),
    ("I probably gave you a look as I picked up.", "Short sentence between dialogue"),
    # Additional scenarios
    ("I remember realizing who it was", "Participial phrases"),
    ("I waited a second.", "Very short sentence"),
    ("I mean, maybe.", "Short uncertain sentence"),
    ("Maybe that's how it went.", "Reflective sentence"),
    ("To some degree I have to make this up", "Em dash with because"),
    ("On the other hand, there are inconsequential", "Multiple em dashes with newline"),
    ("I remember saying through my teeth,", "Dialogue in teeth"),
    ("I was gripped by a foreboding,", "Em dash at end"),
    ("When I reached the bedroom", "Em dashes with question and newline"),
    ("It's been so long man, what's up?", "Multiple questions"),
    ("Pretending I didn't suspect anything.", "Dialogue attribution"),
    ("There was a pause.", "Short narrative"),
    ("I thought: Was he drunk?", "Colon before question"),
    ("It was around eleven on the East Coast", "Em dash conditional"),
    ("A sharp inhale.", "Very short action"),
    ("I remember suddenly wanting absolute silence.", "Short declarative"),
    ("Some cartoon character on Adult Swim", "Descriptive sentence"),
    ("But... can you bear with me?", "Ellipsis question"),
    ("It's hard to tell this story at all,", "Italics emphasis"),
    ("The thing is, around the time of that wildfire", "Long complex sentence"),
    ("But, remember when we were driving", "Long question with em dash"),
    ("And we pulled over?", "Short question"),
    ("Kinda like then, I'm finding out that", "Multiple em dashes with italics"),
    ("So bear with me?", "Short question"),
    ("I asked Dave to give me a minute", "Long narrative"),
    ("I remember pointing to the garage", "Em dash result clause"),
    ("I wondered if something happened", "Simple sentence"),
    ("I thought Jaime—you remember Jaime", "Em dashes parenthetical"),
    ("Each passing second suggested", "Narrative sentence"),
    ("Surely it couldn't be *that* hard", "Question with italics"),
    ("Unless he was still in shock", "Em dash embedded question"),
    ("But no, troubled as he was,", "Em dash with simile"),
    ("I thought.", "Very short"),
    ("So, nothing's happened?", "Short internal question"),
    ("A short pause, then he continued,", "Dialogue attribution"),
    ("Way back then.", "Very short sentence"),
    ("And it kinda stuck with me", "Em dash sentence"),
    ("Or—it came up suddenly,", "Em dash at start"),
    ("Did I say something so prophetic,", "Question with em dash"),
    ("Because—right—the year I got", "Em dashes with interjection"),
    ("I'd purposely park the car", "Long purpose clause"),
    ("I'd wait to turn on the headlights", "Simple with until"),
    ("And sometimes I'd swing by Jaime's", "Compound sentence"),
    ("But anyway, nothing we said back then", "Transition"),
    ("We were just young and testing", "Compound"),
    ("But I'd be lying if I said", "Double negative"),
    ("And we were talking about what people", "Simple dialogue"),
    ("People were actually really worried", "Simple declarative"),
    ("But we never brought it up,", "Ellipsis with you know"),
    ("It was a weird feeling, imagining", "Em dash explanation"),
    ("It felt a little unbelievable", "Em dash explanation"),
    ("When my attention returned to Dave,", "Long with simile"),
    ("Well, maybe it does help explain.", "Short dialogue"),
    ("Sorry, let me get to the point.", "Dialogue ending"),
    ("One last pause (I think).", "Parenthetical thought"),
    ("Was I silent out of respect?", "Short question"),
    ("Or was I paralyzed?", "Short question"),
    ("I don't want to explain why,", "Dialogue starts"),
    ("I don't want to have to explain.", "Short simple"),
    ("I feel tired.", "Very short"),
    ("And I'm ready.", "Very short"),
    ("Or, I thought I was but,", "Compound with commas"),
    ("But you know, not like someone", "Gerund phrase"),
    ("What a shitty mood to go out in, ha.", "Short with ha"),
    ("And—people, you know, can't really hear you.", "Em dash parenthetical"),
    ("But I remembered you, and I was sure", "Compound"),
    ("So... I called.", "Ellipsis"),
    ("It just sorta overtook me,", "Appositive"),
    ("I also realize... how fucked up", "Ellipsis dialogue"),
    ("I had had some time to prepare", "Had had construction"),
]

print(f"Processing {len(triplet_defs)} triplet definitions...")

for start_text, description in triplet_defs:
    sentences = find_triplet_by_start(start_text, 3)
    if sentences and len(sentences) >= 3:
        # Take first 3 sentences
        text = ''.join(sentences[:3])
        expected = sentences[1]  # Middle sentence

        # Verify they exist in source
        if text not in source:
            print(f"ERROR: Text not found verbatim for: {start_text[:50]}")
            continue
        if expected not in source:
            print(f"ERROR: Expected not found verbatim for: {start_text[:50]}")
            continue
        if expected not in text:
            print(f"ERROR: Expected not in text for: {start_text[:50]}")
            continue

        scenarios.append({
            "text": text,
            "expected": expected,
            "description": description
        })
        print(f"✓ Added scenario: {start_text[:40]}...")
    else:
        print(f"✗ Could not extract 3 sentences from: {start_text[:50]}")

# Write scenarios to file
with open('test-scenarios.ndjson', 'w') as f:
    for scenario in scenarios:
        f.write(json.dumps(scenario) + '\n')

print(f"\nWrote {len(scenarios)} scenarios to test-scenarios.ndjson")
