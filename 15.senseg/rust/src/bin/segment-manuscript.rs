use std::fs;
use std::path::{Path, PathBuf};
use std::process;

fn main() {
    // Find manuscript file
    let manuscript_dir = PathBuf::from("../manuscripts");

    let manuscript_path = match find_manuscript(&manuscript_dir) {
        Ok(path) => path,
        Err(e) => {
            eprintln!("Error: {}", e);
            process::exit(1);
        }
    };

    // Extract manuscript name (without .manuscript extension)
    let manuscript_name = manuscript_path
        .file_stem()
        .and_then(|s| s.to_str())
        .expect("Invalid manuscript filename");

    // Read manuscript
    let content = match fs::read_to_string(&manuscript_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Error reading manuscript: {}", e);
            process::exit(1);
        }
    };

    // Segment
    let sentences = senseg::segment(&content);

    // Create output directory: segmented/{manuscript-name}/
    let out_dir = PathBuf::from("../segmented").join(manuscript_name);
    if let Err(e) = fs::create_dir_all(&out_dir) {
        eprintln!("Error creating output directory: {}", e);
        process::exit(1);
    }

    // Write to segmented/{manuscript-name}/{manuscript-name}.rust.jsonl
    let out_path = out_dir.join(format!("{}.rust.jsonl", manuscript_name));

    let mut lines = Vec::new();
    for sentence in &sentences {
        match serde_json::to_string(sentence) {
            Ok(json) => lines.push(json),
            Err(e) => {
                eprintln!("Error serializing sentence: {}", e);
                process::exit(1);
            }
        }
    }

    let output = lines.join("\n") + "\n";

    if let Err(e) = fs::write(&out_path, output) {
        eprintln!("Error writing output file: {}", e);
        process::exit(1);
    }

    println!(
        "Segmented {} sentences from {} to {}",
        sentences.len(),
        manuscript_path.display(),
        out_path.display()
    );
}

fn find_manuscript(dir: &Path) -> Result<PathBuf, String> {
    let pattern = dir.join("*.manuscript");
    let pattern_str = pattern
        .to_str()
        .ok_or("Invalid path")?;

    let paths: Vec<PathBuf> = glob::glob(pattern_str)
        .map_err(|e| format!("Glob error: {}", e))?
        .filter_map(Result::ok)
        .collect();

    if paths.is_empty() {
        return Err("no manuscript file found in manuscripts/".to_string());
    }

    Ok(paths[0].clone())
}
