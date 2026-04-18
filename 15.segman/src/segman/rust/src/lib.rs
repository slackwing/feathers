// Sentence segmenter for manuscript text
// Rust port of the Go implementation

use std::sync::OnceLock;

static VERSION: OnceLock<String> = OnceLock::new();

/// Returns the current SEGMAN version from VERSION.json
pub fn version() -> &'static str {
    VERSION.get_or_init(|| {
        let version_json = include_str!("../../../../VERSION.json");
        let v: serde_json::Value = serde_json::from_str(version_json)
            .unwrap_or_else(|_| serde_json::json!({"version": "unknown"}));
        v["version"].as_str().unwrap_or("unknown").to_string()
    })
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct NestedRegion {
    start: usize,
    end: usize,
    typ: char, // '(', '[', '"', '*'
}

#[derive(Debug, Clone)]
struct BoundaryMark {
    pos: usize,
    #[allow(dead_code)]
    reason: &'static str, // for debugging
}

/// Checks if the word before a period is a common abbreviation
fn is_common_abbreviation(word: &str) -> bool {
    let lower = word.to_lowercase();

    // Common abbreviations
    let abbreviations = [
        "mr", "mrs", "ms", "dr", "prof", "sr", "jr",
        "st", "ave", "blvd", "rd", "ln", "ct",
        "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
        "mon", "tue", "wed", "thu", "fri", "sat", "sun",
        "etc", "vs", "vol", "no", "pp", "ed", "eds",
        "co", "corp", "inc", "ltd",
    ];

    if abbreviations.contains(&lower.as_str()) {
        return true;
    }

    // Note: Single letters (initials) are NOT automatically abbreviations here.
    // They're handled by the "followed by lowercase" heuristic in RULE 5.

    // Check for a.m. and p.m. patterns (already has a period before)
    if lower == "m" {
        return true; // handles "a.m." and "p.m."
    }

    // Check for common Latin abbreviations
    if lower == "e" || lower == "i" {
        return true; // handles "e.g.", "i.e."
    }

    false
}

/// Segments text into sentences using a 3-phase architecture:
/// Phase 1: Mark all nested structures (quotes, parens, brackets, italics)
/// Phase 2: Mark sentence boundaries (respecting nested regions)
/// Phase 3: Split at boundaries and return sentences
pub fn segment(text: &str) -> Vec<String> {
    let text = text.trim();
    if text.is_empty() {
        return vec![];
    }

    let chars: Vec<char> = text.chars().collect();

    // PHASE 1: Mark all nested structures
    let regions = mark_nested_regions(&chars);

    // PHASE 2: Mark sentence boundaries
    let boundaries = mark_boundaries(&chars, &regions);

    // PHASE 3: Split at boundaries
    split_at_boundaries(&chars, &boundaries)
}

/// Finds all nested structures in the text (1 level only)
fn mark_nested_regions(chars: &[char]) -> Vec<NestedRegion> {
    let mut regions = Vec::new();

    // Find all types of nested structures
    regions.extend(find_quotes(chars));
    regions.extend(find_parentheses(chars));
    regions.extend(find_brackets(chars));
    regions.extend(find_italics(chars));

    regions
}

/// Finds all quoted text (both straight and curly quotes)
fn find_quotes(chars: &[char]) -> Vec<NestedRegion> {
    let mut regions = Vec::new();
    let mut start: Option<usize> = None;

    for (i, &ch) in chars.iter().enumerate() {
        match ch {
            // Left curly quote - always opens
            '\u{201C}' => {
                if start.is_none() {
                    start = Some(i);
                }
            }
            // Right curly quote - always closes
            '\u{201D}' => {
                if let Some(s) = start {
                    regions.push(NestedRegion { start: s, end: i, typ: '"' });
                    start = None;
                }
            }
            // Straight quote - toggle
            '"' => {
                if let Some(s) = start {
                    regions.push(NestedRegion { start: s, end: i, typ: '"' });
                    start = None;
                } else {
                    start = Some(i);
                }
            }
            _ => {}
        }
    }

    // Handle unclosed quote at end
    if let Some(s) = start {
        regions.push(NestedRegion { start: s, end: chars.len() - 1, typ: '"' });
    }

    regions
}

/// Finds all parenthetical text
fn find_parentheses(chars: &[char]) -> Vec<NestedRegion> {
    let mut regions = Vec::new();
    let mut start: Option<usize> = None;

    for (i, &ch) in chars.iter().enumerate() {
        if ch == '(' && start.is_none() {
            start = Some(i);
        } else if ch == ')' && start.is_some() {
            if let Some(s) = start {
                regions.push(NestedRegion { start: s, end: i, typ: '(' });
                start = None;
            }
        }
    }

    regions
}

/// Finds all editorial brackets
fn find_brackets(chars: &[char]) -> Vec<NestedRegion> {
    let mut regions = Vec::new();
    let mut start: Option<usize> = None;

    for (i, &ch) in chars.iter().enumerate() {
        if ch == '[' && start.is_none() {
            start = Some(i);
        } else if ch == ']' && start.is_some() {
            if let Some(s) = start {
                regions.push(NestedRegion { start: s, end: i, typ: '[' });
                start = None;
            }
        }
    }

    regions
}

/// Finds all italicized text (marked with asterisks)
fn find_italics(chars: &[char]) -> Vec<NestedRegion> {
    let mut regions = Vec::new();
    let mut start: Option<usize> = None;

    for (i, &ch) in chars.iter().enumerate() {
        if ch == '*' {
            if let Some(s) = start {
                regions.push(NestedRegion { start: s, end: i, typ: '*' });
                start = None;
            } else {
                start = Some(i);
            }
        }
    }

    regions
}

/// Identifies all positions where sentences should split
#[allow(clippy::cognitive_complexity)]
fn mark_boundaries(chars: &[char], regions: &[NestedRegion]) -> Vec<BoundaryMark> {
    let mut boundaries = Vec::new();

    // Helper: check if position is inside a nested region
    let inside_nested = |pos: usize| -> bool {
        regions.iter().any(|r| pos >= r.start && pos <= r.end)
    };

    // Helper: check if position is inside a quote, paren, or italic region (not brackets)
    let inside_quote_or_other = |pos: usize| -> bool {
        regions.iter().any(|r| r.typ != '[' && pos >= r.start && pos <= r.end)
    };

    // RULE 1: Editorial brackets create boundaries (unless the boundary would be inside quotes/parens/italics)
    for region in regions {
        if region.typ == '[' {
            // Boundary before bracket (only if not inside quotes/parens/italics)
            if region.start > 0 && !inside_quote_or_other(region.start) {
                boundaries.push(BoundaryMark { pos: region.start, reason: "before bracket" });
            }
            // Boundary after bracket (only if not inside quotes/parens/italics)
            if region.end < chars.len() - 1 && !inside_quote_or_other(region.end + 1) {
                boundaries.push(BoundaryMark { pos: region.end + 1, reason: "after bracket" });
            }
        }
    }

    // RULE 2: Standalone parentheticals with sentence-ending punctuation
    for region in regions {
        if region.typ == '(' {
            // Check if preceded by sentence-ending punctuation (skip whitespace)
            let mut has_preceding_punct = false;
            if region.start > 0 {
                for i in (0..region.start).rev() {
                    if chars[i] == ' ' || chars[i] == '\t' || chars[i] == '\n' {
                        continue;
                    }
                    if chars[i] == '.' || chars[i] == '!' || chars[i] == '?' {
                        has_preceding_punct = true;
                    }
                    break;
                }
            }

            // Check if contains sentence-ending punctuation
            let mut has_internal_punct = false;
            for i in region.start + 1..region.end {
                if chars[i] == '.' || chars[i] == '!' || chars[i] == '?' {
                    has_internal_punct = true;
                    break;
                }
            }

            // If both conditions met, it's a standalone parenthetical
            if has_preceding_punct && has_internal_punct {
                boundaries.push(BoundaryMark { pos: region.start, reason: "standalone paren" });
                if region.end < chars.len() - 1 {
                    boundaries.push(BoundaryMark { pos: region.end + 1, reason: "after standalone paren" });
                }
            }
        }
    }

    // RULE 3: Standalone dialogue (newline + tab + quote)
    for region in regions {
        if region.typ == '"' {
            // Check if quote starts after \n\t or \n
            if region.start >= 2 && chars[region.start - 2] == '\n' && chars[region.start - 1] == '\t' {
                // Always create boundary before standalone dialogue
                boundaries.push(BoundaryMark { pos: region.start - 2, reason: "before standalone dialogue" });

                // Check if there's lowercase word after quote (attribution after)
                if region.end + 1 < chars.len() {
                    let mut j = region.end + 1;
                    while j < chars.len() && (chars[j] == ' ' || chars[j] == '\t') {
                        j += 1;
                    }

                    // Check for attribution (lowercase word, "I <lowercase>", or period on same line)
                    let mut has_attribution = false;
                    if j < chars.len() {
                        if chars[j].is_lowercase() {
                            has_attribution = true;
                        } else if chars[j] == 'I' {
                            // Check for "I <lowercase>" pattern (e.g., "I said")
                            let mut k = j + 1;
                            while k < chars.len() && (chars[k] == ' ' || chars[k] == '\t') {
                                k += 1;
                            }
                            if k < chars.len() && chars[k].is_lowercase() {
                                has_attribution = true;
                            }
                        } else if chars[j].is_uppercase() {
                            // Check if there's a period on the same line (before newline)
                            let mut k = j;
                            while k < chars.len() && chars[k] != '\n' && chars[k] != '"' && chars[k] != '\u{201C}' {
                                if chars[k] == '.' {
                                    has_attribution = true;
                                    break;
                                }
                                k += 1;
                            }
                        }
                    }

                    if has_attribution {
                        // Find end of sentence (period after attribution)
                        while j < chars.len() && chars[j] != '.' && chars[j] != '\n' && chars[j] != '"' && chars[j] != '\u{201C}' {
                            j += 1;
                        }
                        if j < chars.len() && chars[j] == '.' {
                            boundaries.push(BoundaryMark { pos: j + 1, reason: "after dialogue+attribution" });
                        }
                    } else if region.end < chars.len() - 1 {
                        boundaries.push(BoundaryMark { pos: region.end + 1, reason: "after standalone dialogue" });
                    }
                }
            } else if region.start >= 1 && chars[region.start - 1] == '\n' {
                boundaries.push(BoundaryMark { pos: region.start - 1, reason: "before standalone dialogue" });

                // Check for attribution after
                if region.end + 1 < chars.len() {
                    let mut j = region.end + 1;
                    while j < chars.len() && (chars[j] == ' ' || chars[j] == '\t') {
                        j += 1;
                    }

                    // Check for attribution (lowercase word, "I <lowercase>", or period on same line)
                    let mut has_attribution = false;
                    if j < chars.len() {
                        if chars[j].is_lowercase() {
                            has_attribution = true;
                        } else if chars[j] == 'I' {
                            // Check for "I <lowercase>" pattern (e.g., "I said")
                            let mut k = j + 1;
                            while k < chars.len() && (chars[k] == ' ' || chars[k] == '\t') {
                                k += 1;
                            }
                            if k < chars.len() && chars[k].is_lowercase() {
                                has_attribution = true;
                            }
                        } else if chars[j].is_uppercase() {
                            // Check if there's a period on the same line (before newline)
                            let mut k = j;
                            while k < chars.len() && chars[k] != '\n' && chars[k] != '"' && chars[k] != '\u{201C}' {
                                if chars[k] == '.' {
                                    has_attribution = true;
                                    break;
                                }
                                k += 1;
                            }
                        }
                    }

                    if has_attribution {
                        // Find end of sentence (period after attribution)
                        while j < chars.len() && chars[j] != '.' && chars[j] != '\n' && chars[j] != '"' && chars[j] != '\u{201C}' {
                            j += 1;
                        }
                        if j < chars.len() && chars[j] == '.' {
                            boundaries.push(BoundaryMark { pos: j + 1, reason: "after dialogue+attribution" });
                        }
                    } else if region.end < chars.len() - 1 {
                        boundaries.push(BoundaryMark { pos: region.end + 1, reason: "after standalone dialogue" });
                    }
                }
            }
        }
    }

    // RULE 4: Quote and italics endings, quote-to-quote transitions
    for (i, region) in regions.iter().enumerate() {
        if region.typ == '"' || region.typ == '*' {
            // Check if region ends with sentence-ending punctuation
            if region.end > region.start {
                let char_before_closing = chars[region.end - 1];
                if char_before_closing == '.' || char_before_closing == '!' || char_before_closing == '?' {
                    // Region ends with punctuation - check what follows
                    if region.end + 1 < chars.len() {
                        // Skip whitespace after region
                        let mut j = region.end + 1;
                        while j < chars.len() && (chars[j] == ' ' || chars[j] == '\t') {
                            j += 1;
                        }

                        // Check if followed by lowercase letter (indicates attribution continuation)
                        let mut has_attribution = false;
                        if region.typ == '"' && j < chars.len() && chars[j].is_lowercase() {
                            has_attribution = true;
                        }

                        // Special handling for "I": check if quote appears after sentence boundary
                        if region.typ == '"' && j < chars.len() && chars[j] == 'I' {
                            // Check if quote started after a period (sentence boundary)
                            let mut quote_after_period = false;
                            if region.start >= 2 {
                                let mut k = region.start - 1;
                                while k > 0 && (chars[k] == ' ' || chars[k] == '\t' || chars[k] == '"' || chars[k] == '\u{201C}') {
                                    k -= 1;
                                }
                                if chars[k] == '.' {
                                    quote_after_period = true;
                                }
                            }

                            // If NOT after period, check for "I <lowercase>" attribution pattern
                            if !quote_after_period {
                                let mut k = j + 1;
                                while k < chars.len() && (chars[k] == ' ' || chars[k] == '\t') {
                                    k += 1;
                                }
                                if k < chars.len() && chars[k].is_lowercase() {
                                    has_attribution = true;
                                }
                            }
                        }

                        // If followed by capital letter or newline (and no attribution), create boundary
                        if !has_attribution && j < chars.len() && (chars[j].is_uppercase() || chars[j] == '\n') {
                            let reason = if region.typ == '"' {
                                "after quote with punct"
                            } else {
                                "after italics with punct"
                            };
                            boundaries.push(BoundaryMark { pos: region.end + 1, reason });
                        }
                    }
                }
            }

            // Check for quote-to-quote transitions
            if region.typ == '"' && i < regions.len() - 1 && regions[i + 1].typ == '"' {
                // Check if there's only whitespace/newlines between quotes
                let only_whitespace = (region.end + 1..regions[i + 1].start)
                    .all(|j| chars[j] == ' ' || chars[j] == '\n' || chars[j] == '\t');

                if only_whitespace {
                    boundaries.push(BoundaryMark { pos: region.end + 1, reason: "quote-to-quote" });
                }
            }
        }
    }

    // RULE 5: Standard sentence-ending punctuation (. ! ?)
    for i in 0..chars.len() {
        let ch = chars[i];

        // Skip if inside nested region
        if inside_nested(i) {
            continue;
        }

        // Check for sentence-ending punctuation
        if ch == '.' || ch == '!' || ch == '?' {
            // Look ahead to see if this is a real boundary
            if i + 1 < chars.len() {
                let next = chars[i + 1];

                // Space or newline after punctuation
                if next == ' ' || next == '\n' {
                    // For periods only: check for abbreviations
                    if ch == '.' {
                        // Extract word before period
                        let mut k = i;
                        while k > 0 && (chars[k - 1].is_alphanumeric()) {
                            k -= 1;
                        }
                        let word_start = k;
                        if word_start <= i {
                            let word: String = chars[word_start..i].iter().collect();
                            if is_common_abbreviation(&word) {
                                continue; // Skip this period, it's an abbreviation
                            }

                            // Check for initial pattern: single letter followed by another initial
                            if word.len() == 1 && word.chars().next().unwrap().is_alphabetic() {
                                if i + 3 < chars.len() && chars[i + 1] == ' ' && chars[i + 2].is_alphabetic() && chars[i + 3] == '.' {
                                    continue; // This is an initial followed by another initial
                                }
                            }
                        }

                        // Check if followed by lowercase word (general heuristic for abbreviations)
                        let mut j = i + 1;
                        while j < chars.len() && (chars[j] == ' ' || chars[j] == '\t' || chars[j] == '\n' ||
                            chars[j] == '*' || chars[j] == '"' || chars[j] == '\u{201C}' || chars[j] == '[') {
                            j += 1;
                        }
                        if j < chars.len() && chars[j].is_lowercase() {
                            continue; // Followed by lowercase, likely abbreviation
                        }
                    }

                    // Check if followed by capital letter (skip asterisks, quotes, brackets)
                    let mut j = i + 1;
                    while j < chars.len() && (chars[j] == ' ' || chars[j] == '\t' || chars[j] == '\n' ||
                        chars[j] == '*' || chars[j] == '"' || chars[j] == '\u{201C}' || chars[j] == '[') {
                        j += 1;
                    }

                    if j < chars.len() && chars[j].is_uppercase() {
                        boundaries.push(BoundaryMark { pos: i + 1, reason: "standard punct" });
                    }
                }
            } else {
                // End of text
                boundaries.push(BoundaryMark { pos: i + 1, reason: "end of text" });
            }
        }
    }

    // RULE 6: Ellipsis followed by capital letter
    for i in 0..chars.len().saturating_sub(3) {
        if inside_nested(i) {
            continue;
        }

        // Check for "... " or "..." at end
        if chars[i] == '.' && i + 1 < chars.len() && chars[i + 1] == '.' && i + 2 < chars.len() && chars[i + 2] == '.' {
            let next_char_pos = if i + 3 < chars.len() && chars[i + 3] == ' ' {
                Some(i + 4)
            } else if i + 3 >= chars.len() {
                // Ellipsis at end of text
                boundaries.push(BoundaryMark { pos: i + 3, reason: "ellipsis at end" });
                continue;
            } else {
                None
            };

            if let Some(mut next_char_pos) = next_char_pos {
                // Skip asterisks, quotes, brackets
                while next_char_pos < chars.len() && (chars[next_char_pos] == ' ' || chars[next_char_pos] == '*' ||
                    chars[next_char_pos] == '"' || chars[next_char_pos] == '\u{201C}') {
                    next_char_pos += 1;
                }

                // Check if followed by capital letter
                if next_char_pos < chars.len() && chars[next_char_pos].is_uppercase() {
                    boundaries.push(BoundaryMark { pos: i + 4, reason: "ellipsis+capital" });
                }
            }
        }
    }

    // RULE 7: Paragraph breaks (double newlines or newline+tab)
    for i in 0..chars.len() - 1 {
        if chars[i] == '\n' && chars[i + 1] == '\n' {
            boundaries.push(BoundaryMark { pos: i + 1, reason: "paragraph break" });
        } else if chars[i] == '\n' && chars[i + 1] == '\t' {
            // Check if this is not the start of standalone dialogue (tab+quote)
            let is_dialogue = i + 2 < chars.len() && (chars[i + 2] == '"' || chars[i + 2] == '\u{201C}');
            if !is_dialogue {
                boundaries.push(BoundaryMark { pos: i + 1, reason: "paragraph break" });
            }
        }
    }

    // RULE 8: Markdown headers (lines starting with #)
    for i in 0..chars.len() {
        if chars[i] == '#' {
            // Check if this # is at the start of a line (after newline or at position 0)
            let at_line_start = i == 0 || chars[i - 1] == '\n';

            if at_line_start {
                // Create boundary before the header (unless at start of text)
                if i > 0 {
                    boundaries.push(BoundaryMark { pos: i, reason: "before markdown header" });
                }

                // Find the end of the header line
                let mut j = i;
                while j < chars.len() && chars[j] != '\n' {
                    j += 1;
                }

                // Create boundary after the header (at the newline)
                if j < chars.len() {
                    boundaries.push(BoundaryMark { pos: j, reason: "after markdown header" });
                }
            }
        }
    }

    boundaries
}

/// Splits the text at marked boundaries
fn split_at_boundaries(chars: &[char], boundaries: &[BoundaryMark]) -> Vec<String> {
    if boundaries.is_empty() {
        let text: String = chars.iter().collect();
        return vec![text.trim().to_string()];
    }

    // Sort boundaries by position
    let mut sorted_boundaries = boundaries.to_vec();
    sorted_boundaries.sort_by_key(|b| b.pos);

    // Remove duplicates
    let mut unique_boundaries: Vec<BoundaryMark> = Vec::new();
    for boundary in sorted_boundaries {
        if unique_boundaries.is_empty() || boundary.pos != unique_boundaries.last().unwrap().pos {
            unique_boundaries.push(boundary);
        }
    }

    // Helper to normalize whitespace in a sentence
    let normalize_whitespace = |s: String| -> String {
        // Replace newlines and tabs with spaces
        let s = s.replace('\n', " ").replace('\t', " ");
        // Collapse multiple spaces into one
        let mut result = s;
        while result.contains("  ") {
            result = result.replace("  ", " ");
        }
        result.trim().to_string()
    };

    // Split at boundaries
    let mut sentences = Vec::new();
    let mut start = 0;

    for boundary in unique_boundaries {
        if boundary.pos > start && boundary.pos <= chars.len() {
            let sentence: String = chars[start..boundary.pos].iter().collect();
            let sentence = normalize_whitespace(sentence);
            if !sentence.is_empty() {
                sentences.push(sentence);
            }
            start = boundary.pos;
        }
    }

    // Add remaining text
    if start < chars.len() {
        let sentence: String = chars[start..].iter().collect();
        let sentence = normalize_whitespace(sentence);
        if !sentence.is_empty() {
            sentences.push(sentence);
        }
    }

    sentences
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_segmentation() {
        let text = "This is a test. This is another sentence.";
        let segments = segment(text);
        assert_eq!(segments.len(), 2);
        assert_eq!(segments[0], "This is a test.");
        assert_eq!(segments[1], "This is another sentence.");
    }

    #[test]
    fn test_empty_text() {
        let segments = segment("");
        assert_eq!(segments.len(), 0);
    }
}
