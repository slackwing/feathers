// SEGMAN CLI - Segment text using Rust segmenter
//
// Reads from stdin or file argument and outputs sentences as JSON

use std::env;
use std::fs;
use std::io::{self, Read};
use std::process;

fn main() {
    let args: Vec<String> = env::args().collect();

    // Read from file if argument provided, otherwise stdin
    let input = if args.len() > 1 {
        match fs::read_to_string(&args[1]) {
            Ok(content) => content,
            Err(e) => {
                eprintln!("Error reading file: {}", e);
                process::exit(1);
            }
        }
    } else {
        let mut buffer = String::new();
        match io::stdin().read_to_string(&mut buffer) {
            Ok(_) => buffer,
            Err(e) => {
                eprintln!("Error reading stdin: {}", e);
                process::exit(1);
            }
        }
    };

    // Segment
    let sentences = senseg::segment(&input);

    // Output as JSON
    match serde_json::to_string_pretty(&sentences) {
        Ok(json) => println!("{}", json),
        Err(e) => {
            eprintln!("Error marshaling JSON: {}", e);
            process::exit(1);
        }
    }
}
