use std::fs::File;
use std::io::{BufRead, BufReader};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
struct Scenario {
    id: String,
    context: String,
    expected: String,
}

#[test]
fn test_scenarios() {
    // Read scenarios.jsonl from parent directory
    let file = File::open("../scenarios.jsonl")
        .expect("Failed to open scenarios.jsonl");
    let reader = BufReader::new(file);

    let mut scenario_count = 0;
    let mut pass_count = 0;
    let mut failures = Vec::new();

    for (line_num, line_result) in reader.lines().enumerate() {
        let line = line_result.expect("Failed to read line");

        // Skip empty lines
        if line.trim().is_empty() {
            continue;
        }

        let scenario: Scenario = match serde_json::from_str(&line) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Line {}: failed to parse JSON: {}", line_num + 1, e);
                continue;
            }
        };

        scenario_count += 1;

        // Run segmenter on context
        let sentences = senseg::segment(&scenario.context);

        // Debug scenario 003
        if scenario.id == "003" {
            eprintln!("Context bytes: {:?}", scenario.context);
            eprintln!("Expected bytes: {:?}", scenario.expected);
            for (i, s) in sentences.iter().enumerate() {
                eprintln!("Sentence[{}]: {:?}", i, s);
            }
        }

        // Check if expected sentence is in the output
        let found = sentences.iter().any(|s| s == &scenario.expected);

        if !found {
            failures.push((
                scenario.id.clone(),
                scenario.context.clone(),
                scenario.expected.clone(),
                sentences.clone(),
            ));
            eprintln!("Scenario {} FAILED", scenario.id);
        } else {
            pass_count += 1;
            eprintln!("Scenario {} PASSED", scenario.id);
        }
    }

    eprintln!("\n=== Summary ===");
    eprintln!(
        "Total: {}  Passed: {}  Failed: {}",
        scenario_count,
        pass_count,
        scenario_count - pass_count
    );

    // Print failures
    if !failures.is_empty() {
        eprintln!("\n=== FAILURES ===");
        for (id, context, expected, got) in &failures {
            eprintln!("\nScenario {}:", id);
            eprintln!("  Context: {:?}", context);
            eprintln!("  Expected: {:?}", expected);
            eprintln!("  Got: {:?}", got);
        }
    }

    assert_eq!(
        pass_count, scenario_count,
        "Some scenarios failed: {}/{} passed",
        pass_count, scenario_count
    );
}
