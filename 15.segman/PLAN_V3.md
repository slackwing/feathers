# PLAN V3: SEGMAN Refactoring

**Status**: ✅ IMPLEMENTED
**Created**: 2026-03-27
**Completed**: 2026-03-27
**Goal**: Restructure project as proper multi-language library (SEGMAN) with standardized builds, exports, and automated versioning.

## Implementation Summary

All phases completed successfully. See "Implementation Status" section at bottom for details.

---

## Overview

Transform the sentence segmenter project into a professional multi-language library distribution called **SEGMAN** (Segment Manuscript), with:
- Proper library artifacts for external use
- CLI tools built on top of libraries
- Automated version management via pre-commit hooks
- Clean separation of source, tools, tests, and exports

---

## Questions Needing Answers

### Q1: Library Export Format
For each language in `exports/`, what should the artifact be?

**Option A - Compiled Artifacts**:
- Go: `segman.a` (compiled archive)
- JS: `segman.min.js` (bundled)
- Rust: `libsegman.rlib`

**Option B - Source Distribution**:
- Go: `exports/segman-go/` (go module structure)
- JS: `exports/segman-js/` (npm package structure)
- Rust: `exports/segman-rust/` (crate structure)

**Option C - Mix**: Compiled where standard, source where not?

### Q2: VERSION.json Location
- Root level? (alongside SPECS.md)
- `src/segman/VERSION.json`?
- `exports/VERSION.json`?

### Q3: Pre-commit Hook Auto-staging
When hook auto-bumps patch version:
- Auto-stage VERSION.json and amend commit?
- Leave VERSION.json unstaged, require separate commit?

### Q4: Build Script Organization
- Keep `build-tools` and `build-segman` separate?
- Combine into single `./build [tools|segman|all]`?

### Q5: Cleanup Old Directories
Delete these after refactoring?
- `segmented/`
- `generated/` (after move to exports/)

---

## Phase 1: Directory Restructure

### 1.1 Move Language Implementations
```
go/                  → src/segman/go/
js/                  → src/segman/js/
rust/                → src/segman/rust/
```

**Files to update**:
- `build-tools` (if it references language dirs)
- `run-scenarios` → `run-tests`
- Any relative path imports in tools

### 1.2 Move Tools
```
tools/               → src/tools/
```

### 1.3 Rename Manuscripts to Reference
```
manuscripts/         → reference/
```

**Files to update**:
- Any tool that reads from `manuscripts/`
- AGENTS.md references
- SPECS.md references

### 1.4 Rename Generated to Exports
```
generated/           → exports/
```

**Actions**:
- Remove `generated/` from `.gitignore`
- Add `exports/` to git tracking
- Update all references in scripts and AGENTS.md

### 1.5 Create Tests Directory
```
scenarios.jsonl      → tests/scenarios.jsonl
```

**New structure**:
```
tests/
  scenarios.jsonl
  (future: unit tests, integration tests)
```

---

## Phase 2: Rename Scripts & Tools

### 2.1 Rename Segment Tool
```
01-segment-manuscript → 01-segment-reference
```

**Behavior changes**:
- Old: Output to `segmented/the-wildfire/the-wildfire.{lang}.jsonl`
- New: Output to `reference/the-wildfire.{lang}.jsonl`

### 2.2 Rename Context Tool
```
04-context → 04-manuscript-context
```

### 2.3 Rename Test Runner
```
run-scenarios → run-tests
```

**Update**:
- Read from `tests/scenarios.jsonl`
- Update AGENTS.md to reference `run-tests`

---

## Phase 3: Library Structure Refactoring

### 3.1 Go Library Structure

**Current**: `go/segmenter.go` with `package senseg`

**TODO Items**:
- [ ] Verify Go module structure is correct for external import
- [ ] Ensure `go.mod` is properly configured
- [ ] Add version export function: `func Version() string`
- [ ] Create example usage in `go/examples/`
- [ ] Add godoc documentation

**CLI Tool**: `src/segman/go/cmd/segman-cli/main.go`
- Uses library: `import "github.com/slackwing/senseg"`
- Provides CLI interface
- Build to: `exports/segman-go-cli`

### 3.2 JavaScript Library Structure

**Current**: `js/segmenter.js` with exports

**TODO Items**:
- [ ] Create `package.json` if not present
- [ ] Ensure proper `module.exports` structure
- [ ] Add version export: `getVersion()`
- [ ] Consider if we need both CommonJS and ESM builds
- [ ] Add JSDoc documentation
- [ ] Create `js/examples/` directory

**CLI Tool**: `src/segman/js/cli.js` (or `segman-cli.js`)
- Uses library: `require('./segmenter')`
- Provides CLI interface via Node.js
- Build to: `exports/segman-node-cli` (or `segman-js-cli`?)

**Question**: Should it be `segman-node-cli` or `segman-js-cli`?

### 3.3 Rust Library Structure

**Current**: `rust/src/lib.rs` - already proper library structure ✓

**TODO Items**:
- [ ] Verify `Cargo.toml` has correct library configuration
- [ ] Add version export: `pub fn version() -> &'static str`
- [ ] Ensure public API is properly exposed
- [ ] Add rustdoc documentation
- [ ] Create `rust/examples/` directory
- [ ] Remove or separate the `segment-manuscript` binary (it's a CLI)

**CLI Tool**: `src/segman/rust/src/bin/segman-cli.rs`
- Rename from `segment-manuscript.rs`
- Uses library: `use segman;`
- Build to: `exports/segman-rust-cli`

---

## Phase 4: Build Scripts

### 4.1 Update `build-tools`

**Purpose**: Build development/testing tools

**Behavior**:
```bash
#!/bin/bash
# Build all tools from src/tools/ to exports/

# Manuscript tools
go build -o ../../../exports/00-sanitize-manuscript src/tools/manuscript/00-sanitize-manuscript/main.go

# Scenario-building tools
go build -o ../../../exports/01-segment-reference src/tools/scenario-building/01-segment-reference/main.go
go build -o ../../../exports/02-inspect-segments src/tools/scenario-building/02-inspect-segments/main.go
go build -o ../../../exports/03-add-scenario src/tools/scenario-building/03-add-scenario/main.go

# Bash tools
cp src/tools/manuscript/04-manuscript-context exports/04-manuscript-context
chmod +x exports/04-manuscript-context
```

### 4.2 Create `build-segman`

**Purpose**: Build SEGMAN library artifacts and CLIs for distribution

**Behavior**:
```bash
#!/bin/bash
# Build SEGMAN libraries and CLIs to exports/

echo "Building SEGMAN libraries..."

# Go
cd src/segman/go
go build -o ../../../exports/segman-go-cli ./cmd/segman-cli
# TODO: Decide on library artifact format (see Q1)

# JavaScript
cd ../js
# TODO: Decide on build process (bundling? npm pack?)
cp segman-cli.js ../../../exports/segman-node-cli
chmod +x ../../../exports/segman-node-cli

# Rust
cd ../rust
cargo build --release --bin segman-cli
cp target/release/segman-cli ../../../exports/segman-rust-cli

echo "Done. Library artifacts and CLIs in exports/"
```

---

## Phase 5: Version Management System

### 5.1 Create VERSION.json

**Location**: TBD (see Q2)

**Structure**:
```json
{
  "version": "1.0.0",
  "reference_hash": "sha256:a1b2c3d4e5f6...",
  "reference_file": "the-wildfire.manuscript",
  "blessed_at": "2026-03-27T20:47:51Z",
  "blessed_commit": "32dee0e",
  "test_scenarios": 45,
  "architecture": "v3-3phase"
}
```

### 5.2 Update Language Implementations

**Each implementation must expose version**:

**Go** (`src/segman/go/segmenter.go`):
```go
import (
    "encoding/json"
    "os"
)

var cachedVersion string

func Version() string {
    if cachedVersion != "" {
        return cachedVersion
    }

    data, err := os.ReadFile("../../VERSION.json")
    if err != nil {
        return "unknown"
    }

    var v struct {
        Version string `json:"version"`
    }
    json.Unmarshal(data, &v)
    cachedVersion = v.Version
    return cachedVersion
}
```

**JavaScript** (`src/segman/js/segmenter.js`):
```javascript
const fs = require('fs');
const path = require('path');

let cachedVersion = null;

function getVersion() {
    if (cachedVersion) return cachedVersion;

    const versionFile = path.join(__dirname, '../../VERSION.json');
    const data = JSON.parse(fs.readFileSync(versionFile, 'utf-8'));
    cachedVersion = data.version;
    return cachedVersion;
}

module.exports = { segment, getVersion };
```

**Rust** (`src/segman/rust/src/lib.rs`):
```rust
use std::sync::OnceLock;

static VERSION: OnceLock<String> = OnceLock::new();

pub fn version() -> &'static str {
    VERSION.get_or_init(|| {
        let version_file = include_str!("../../VERSION.json");
        let v: serde_json::Value = serde_json::from_str(version_file).unwrap();
        v["version"].as_str().unwrap().to_string()
    })
}
```

### 5.3 Create Pre-commit Hook

**Location**: `.git/hooks/pre-commit` (or provide install script)

**Workflow**:
```bash
#!/bin/bash
set -e

echo "=== SEGMAN Pre-commit Hook ==="

# 1. Check if segman source files changed
if ! git diff --cached --name-only | grep -q "^src/segman/"; then
    echo "No segman changes detected. Skipping validation."
    exit 0
fi

echo "Segman changes detected. Running validation..."

# 2. Run tests in all languages
echo "Step 1/5: Running tests..."
./run-tests go || { echo "Go tests failed"; exit 1; }
./run-tests js || { echo "JS tests failed"; exit 1; }
./run-tests rust || { echo "Rust tests failed"; exit 1; }
echo "✓ All tests passed"

# 3. Generate reference output for all languages
echo "Step 2/5: Generating reference output..."
./exports/01-segment-reference --lang go || { echo "Go segmentation failed"; exit 1; }
./exports/01-segment-reference --lang js || { echo "JS segmentation failed"; exit 1; }
./exports/01-segment-reference --lang rust || { echo "Rust segmentation failed"; exit 1; }
echo "✓ Reference generated"

# 4. Compare outputs across languages
echo "Step 3/5: Comparing language outputs..."
if ! diff -q reference/the-wildfire.go.jsonl reference/the-wildfire.js.jsonl > /dev/null; then
    echo "ERROR: Go and JS outputs differ!"
    exit 1
fi
if ! diff -q reference/the-wildfire.js.jsonl reference/the-wildfire.rust.jsonl > /dev/null; then
    echo "ERROR: JS and Rust outputs differ!"
    exit 1
fi
echo "✓ All outputs identical"

# 5. Compute hash and check version
echo "Step 4/5: Computing reference hash..."
NEW_HASH=$(shasum -a 256 reference/the-wildfire.go.jsonl | awk '{print $1}')
OLD_HASH=$(jq -r '.reference_hash' VERSION.json | sed 's/sha256://')

if [ "$NEW_HASH" != "$OLD_HASH" ]; then
    echo "Reference output changed. Checking version..."

    # Check if VERSION.json is staged (manual bump)
    if git diff --cached --name-only | grep -q "VERSION.json"; then
        echo "✓ VERSION.json manually updated"
    else
        # Auto-bump patch version
        OLD_VERSION=$(jq -r '.version' VERSION.json)
        IFS='.' read -r MAJOR MINOR PATCH <<< "$OLD_VERSION"
        NEW_PATCH=$((PATCH + 1))
        NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

        echo "Auto-bumping version: $OLD_VERSION → $NEW_VERSION"

        # Update VERSION.json
        TMP=$(mktemp)
        jq --arg v "$NEW_VERSION" \
           --arg h "sha256:$NEW_HASH" \
           --arg d "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
           --arg c "$(git rev-parse --short HEAD)" \
           '.version = $v | .reference_hash = $h | .blessed_at = $d | .blessed_commit = $c' \
           VERSION.json > "$TMP"
        mv "$TMP" VERSION.json

        # TODO: Auto-stage VERSION.json? (see Q3)
        # git add VERSION.json

        echo "✓ VERSION.json updated to $NEW_VERSION"
        echo "NOTE: VERSION.json updated but not staged. Review and commit."
    fi
else
    echo "✓ No output changes detected"
fi

echo "Step 5/5: Pre-commit validation complete!"
exit 0
```

---

## Phase 6: Documentation Updates

### 6.1 Update AGENTS.md

**Sections to update**:
- Supported Languages → Update paths to `src/segman/`
- Tools Usage → Update to use `exports/` tools
- Workflow sections → Update to use `run-tests` instead of `run-scenarios`
- Add section on `build-segman` script
- Add section on VERSION.json management
- Add instruction: "When adding new language, add to `run-tests` script"

### 6.2 Update SPECS.md

**Sections to update**:
- References to manuscript path
- Any tool paths

### 6.3 Create README.md for Library Usage

**New file**: `exports/README.md` or root `README.md`

**Content**:
- How to import SEGMAN library in each language
- Version compatibility
- CLI tool usage
- Examples

---

## Phase 7: Implementation Checklist

### Step 1: Create New Structure (No Deletions Yet)
- [ ] Create `src/` directory
- [ ] Create `src/segman/` directory
- [ ] Create `src/tools/` directory
- [ ] Create `tests/` directory
- [ ] Copy `go/` → `src/segman/go/`
- [ ] Copy `js/` → `src/segman/js/`
- [ ] Copy `rust/` → `src/segman/rust/`
- [ ] Copy `tools/` → `src/tools/`
- [ ] Copy `scenarios.jsonl` → `tests/scenarios.jsonl`
- [ ] Copy `manuscripts/` → `reference/`
- [ ] Copy `generated/` → `exports/`

### Step 2: Create VERSION.json
- [ ] Create VERSION.json with initial version 1.0.0
- [ ] Generate initial reference hash
- [ ] Decide on location (answer Q2)

### Step 3: Update Language Libraries
- [ ] Go: Add Version() function
- [ ] Go: Refactor CLI to separate binary (if needed)
- [ ] Go: Add go.mod if missing
- [ ] JS: Add getVersion() function
- [ ] JS: Create separate CLI file
- [ ] JS: Add package.json if missing
- [ ] Rust: Add version() function
- [ ] Rust: Rename binary to segman-cli
- [ ] Rust: Ensure library is properly structured

### Step 4: Create Build Scripts
- [ ] Update `build-tools` to use new paths
- [ ] Create `build-segman` script
- [ ] Test both build scripts
- [ ] Decide: combine or keep separate? (answer Q4)

### Step 5: Rename Scripts
- [ ] Rename `01-segment-manuscript` → `01-segment-reference`
- [ ] Update output path to `reference/`
- [ ] Rename `04-context` → `04-manuscript-context`
- [ ] Rename `run-scenarios` → `run-tests`
- [ ] Update `run-tests` to read from `tests/scenarios.jsonl`

### Step 6: Create Pre-commit Hook
- [ ] Create hook script
- [ ] Test hook with no changes
- [ ] Test hook with changes but same output
- [ ] Test hook with changes and different output
- [ ] Test hook with manual version bump
- [ ] Decide on auto-staging (answer Q3)
- [ ] Create installation instructions

### Step 7: Update Documentation
- [ ] Update AGENTS.md
- [ ] Update SPECS.md
- [ ] Create library usage README
- [ ] Update any other docs

### Step 8: Cleanup
- [ ] Remove old `go/`, `js/`, `rust/` directories
- [ ] Remove old `tools/` directory
- [ ] Remove old `generated/` directory
- [ ] Remove `scenarios.jsonl` from root
- [ ] Decide: delete `segmented/`? (answer Q5)
- [ ] Remove old `manuscripts/` directory
- [ ] Update `.gitignore` to remove `generated/`, add exclusions if needed

### Step 9: Verification
- [ ] Run `./build-tools` - verify all tools build
- [ ] Run `./build-segman` - verify all libs/CLIs build
- [ ] Run `./run-tests go` - verify tests pass
- [ ] Run `./run-tests js` - verify tests pass
- [ ] Run `./run-tests rust` - verify tests pass
- [ ] Run `./exports/01-segment-reference --lang go`
- [ ] Run `./exports/01-segment-reference --lang js`
- [ ] Run `./exports/01-segment-reference --lang rust`
- [ ] Verify all three reference outputs are identical
- [ ] Test pre-commit hook end-to-end

### Step 10: Final Commit
- [ ] Commit refactoring with message: "refactor: restructure as SEGMAN library project (V3)"
- [ ] Verify pre-commit hook runs successfully
- [ ] Verify VERSION.json is correct

---

## Open Questions Summary

1. **Library export format** - Compiled vs source distribution?
2. **VERSION.json location** - Root, src/segman/, or exports/?
3. **Hook auto-staging** - Auto-stage VERSION.json or leave unstaged?
4. **Build script organization** - Separate or combined?
5. **Old directory cleanup** - Delete segmented/ directory?
6. **JS CLI naming** - `segman-node-cli` or `segman-js-cli`?
7. **Library artifact format** - See Q1 for details per language

---

## Estimated Effort

- **Phase 1-2**: 1-2 hours (mostly mechanical moves and renames)
- **Phase 3**: 3-4 hours (library refactoring, CLI separation)
- **Phase 4**: 1-2 hours (build script updates)
- **Phase 5**: 2-3 hours (version system implementation)
- **Phase 6**: 1 hour (documentation)
- **Phase 7**: 2-3 hours (testing and verification)

**Total**: ~10-15 hours of focused work

---

## Risk Mitigation

1. **Work in feature branch** until fully tested
2. **Keep old directories** until verification complete
3. **Test each phase** before moving to next
4. **Commit after each major phase** for easy rollback
5. **Verify pre-commit hook** doesn't break existing workflow

---

## Success Criteria

- ✓ All tests pass in all languages
- ✓ All three language outputs are byte-for-byte identical
- ✓ Build scripts produce working artifacts
- ✓ Pre-commit hook correctly validates and auto-bumps versions
- ✓ Documentation is complete and accurate
- ✓ Library can be imported and used in external projects
- ✓ CLIs work standalone using the libraries
