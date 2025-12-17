# Kaprekar Parallel Processing - Development Log

## TODO List

### High Priority
- [ ] Add --verbose flag with comprehensive diagnostics
  - [ ] Work stealing details (if re-implemented)
  - [ ] Lock contention monitoring
  - [ ] Timing/profiling per phase
  - [ ] Worker activity logs
  - [ ] Progress update frequency stats

### Core Issues to Debug
- [ ] Investigate why cores become idle as process runs (especially for large base/digits)
- [ ] Determine root cause of Manager() hang for large problems (base 24, digits 8+)
- [ ] Test if modulo distribution causes load imbalance
- [ ] Profile where time is actually spent in large computations

### Performance Improvements to Test
- [ ] Adaptive batch sizing based on problem size (partially implemented)
- [ ] Random chunk assignment vs modulo distribution
- [ ] Work stealing (currently disabled due to bugs)
- [ ] Reduce shared memoization overhead
- [ ] Optimize progress update frequency

### Infrastructure
- [x] Version numbering system (0.1, 0.2, etc.)
- [x] Git commit at each version
- [x] CLAUDE.md documentation
- [ ] Standard test suite with benchmarks
- [ ] Automated benchmark comparison across versions

## Version History

### v0.1 - Baseline (Current)
**Commit:** 823abfd
**Date:** 2025-12-17

**Features:**
- Pure modulo distribution (each worker processes every Nth multiset)
- Shared memoization via Manager.dict()
- Progress tracking with batched updates (10k batch size)
- Progress monitoring thread updates display every second

**Known Issues:**
- Cores become idle as process runs for large problems
- Manager() appears to hang during initialization for very large problems (base 24+, digits 8+)
- No load balancing mechanism
- Progress display can freeze for long periods when processing slow multisets

**Performance Characteristics:**
- Works well for small to medium problems
- CPU utilization drops over time
- Simple, low overhead for small tasks

## Standard Test Suite

All tests use 16 cores and `--data-dir test-data`

### Test Cases

| Test ID | Description | Command | Expected Time | Purpose |
|---------|-------------|---------|---------------|---------|
| T1-tiny | Single small case | `--min-base 5 --max-base 5 --min-digits 4 --max-digits 4` | < 1s | Quick sanity check |
| T2-small-single | Single moderate case | `--min-base 10 --max-base 10 --min-digits 6 --max-digits 6` | < 5s | Single digit/base |
| T3-small-multi | Multiple small cases | `--min-base 5 --max-base 7 --min-digits 4 --max-digits 5` | < 10s | Multi digit/base |
| T4-medium | Medium workload | `--min-base 8 --max-base 10 --min-digits 6 --max-digits 8` | < 60s | Realistic workload |
| T5-large-single | Large single case | `--min-base 12 --max-base 12 --min-digits 6 --max-digits 6` | < 120s | Stress test single |
| T6-stress | Stress test | `--min-base 10 --max-base 10 --min-digits 2 --max-digits 12` | < 300s | Full range, single base |

### Benchmark Results

#### v0.1

| Test ID | Time | CPU % | Notes |
|---------|------|-------|-------|
| T1-tiny | 0.1s | ~400% | Instant |
| T2-small-single | TBD | TBD | Not yet benchmarked |
| T3-small-multi | TBD | TBD | Not yet benchmarked |
| T4-medium | TBD | TBD | Not yet benchmarked |
| T5-large-single | TBD | TBD | Not yet benchmarked |
| T6-stress | TBD | TBD | Not yet benchmarked |

## Design Notes

### Modulo Distribution
Workers use modulo arithmetic to evenly distribute work:
- Worker 0 processes multisets 0, 16, 32, ...
- Worker 1 processes multisets 1, 17, 33, ...
- etc.

**Pros:**
- Simple, low overhead
- Perfect static load balancing (each worker gets ~equal multisets)

**Cons:**
- No dynamic load balancing if some multisets take longer
- Can lead to idle cores if later multisets are slower

### Shared Memoization
Uses Manager.dict() to share discovered fixed points across workers.

**Pros:**
- Reduces redundant computation
- Workers benefit from each other's discoveries

**Cons:**
- Lock contention on dict updates
- Manager serialization overhead
- May cause initialization hangs for large problems

### Progress Tracking
Batched updates (10k multisets) to minimize lock contention.

**Issues:**
- Can appear frozen for long periods when processing slow multisets
- No adaptive batching based on multiset complexity

## Performance Investigation Notes

### Symptoms Observed
1. CPU cores drop from 16 to 4-6 during execution
2. Manager() hangs during initialization for base 24, digits 8
3. Progress can freeze for extended periods

### Hypotheses
1. **Modulo imbalance**: Later multisets may be more complex
2. **Manager overhead**: Serialization/initialization bottleneck
3. **Lock contention**: Shared memo and progress counter locking
4. **Work stealing bug**: Previous implementation blocked on overflow queue generation

### Experiments to Run
1. Profile time per multiset to identify complexity patterns
2. Test without shared memoization to isolate Manager overhead
3. Implement chunk-based randomized distribution
4. Add detailed per-worker timing logs with --verbose

## How to Use This Document

1. **Before making changes**: Read current version notes
2. **While developing**: Update TODO list and add notes to relevant sections
3. **Before committing**:
   - Increment version number in code
   - Run standard test suite
   - Record benchmark results
   - Add version history entry
   - Commit with message format: `vX.Y: Brief description`
4. **When debugging**: Add observations to Performance Investigation Notes
