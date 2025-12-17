# Kaprekar Parallel Processing - Development Log

## TODO List

### High Priority
- [x] Add --verbose flag with comprehensive diagnostics (COMPLETED in v0.2)
  - [x] Lock contention monitoring
  - [x] Timing/profiling per phase
  - [x] Worker activity logs
  - [ ] Work stealing details (if re-implemented)
  - [ ] Progress update frequency stats (partially done - can see individual updates)

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

### v0.2 - Verbose Diagnostics (Current)
**Commit:** 766fb2b
**Date:** 2025-12-17

**Features:**
- Added `--verbose` flag with comprehensive diagnostics
- Worker lifecycle logging (start, completion, timing)
- Shared memo operations tracking (load/push with sizes and times)
- Lock contention monitoring (wait times for progress updates)
- Phase timing and throughput (multisets/second)
- Pool creation and worker result collection diagnostics
- Task processing distinction (simple vs complex)
- File writing operation timing

**Known Issues:**
- Same core issues as v0.1 (idle cores, Manager hang)
- Verbose logging adds minimal overhead but helps debugging

**Performance Characteristics:**
- Identical to v0.1 when --verbose not used
- With --verbose: adds <5% overhead but reveals bottlenecks

### v0.1 - Baseline
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

**IMPORTANT PERFORMANCE PHILOSOPHY:**
- **Performance hits at smaller test cases (T1-T4) are gladly accepted if there are real gains in larger cases (T5+)**
- **T5-large-single is the most important test - optimize for this case above all others**
- Small case overhead is acceptable if it enables better scaling for large problems

### Primary Test Cases (Run on every version)

| Test ID | Description | Command | Expected Time | Purpose |
|---------|-------------|---------|---------------|---------|
| T1-tiny | Single small case | `--min-base 5 --max-base 5 --min-digits 4 --max-digits 4` | < 1s | Quick sanity check |
| T2-small-single | Single moderate case | `--min-base 10 --max-base 10 --min-digits 8 --max-digits 8` | < 5s | Single digit/base |
| T3-small-multi | Multiple small cases | `--min-base 5 --max-base 7 --min-digits 6 --max-digits 6` | < 10s | Multi digit/base |
| T4-medium | Medium workload | `--min-base 8 --max-base 12 --min-digits 8 --max-digits 8` | < 60s | Realistic workload |
| T5-large-single | **MOST IMPORTANT** Large single case | `--min-base 12 --max-base 12 --min-digits TBD --max-digits TBD` | < 300s | **Primary optimization target** |

**T5 Note:** Start with digits 24, then bisection search downward to find what completes in < 5 minutes

### Secondary Test Cases (Run only when T1-T5 pass and perform well)

| Test ID | Description | Command | Expected Time | Purpose |
|---------|-------------|---------|---------------|---------|
| T6-stress | Multi-base/digit range | `--min-base TBD --max-base TBD --min-digits TBD --max-digits TBD` | < 600s | Range stress test |
| T7-quad-single | Very large single case | `--min-base TBD --max-base TBD --min-digits TBD --max-digits TBD` | < 600s | Extreme scale test |

**T6 Note:** Start with base 10-16, digits 8-16. Decrease max base and max digits together by 1 until < 10 minutes
**T7 Note:** Start with base 16-17, digits 16-17. Decrease all numbers by 1 until < 10 minutes

**Secondary tests are expensive - only run after primary tests show good results**

### Benchmark Results

#### v0.1

**Primary Tests:**

| Test ID | Time | CPU % | Notes |
|---------|------|-------|-------|
| T1-tiny | 0.1s | ~400% | Instant |
| T2-small-single | TBD | TBD | Not yet benchmarked |
| T3-small-multi | TBD | TBD | Not yet benchmarked |
| T4-medium | TBD | TBD | Not yet benchmarked |
| T5-large-single | TBD | TBD | Not yet benchmarked - need to find working digit count |

**Secondary Tests:** (Run only when primary tests are good)

| Test ID | Time | CPU % | Notes |
|---------|------|-------|-------|
| T6-stress | N/A | N/A | Not run - primary tests incomplete |
| T7-quad-single | N/A | N/A | Not run - primary tests incomplete |

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

## Learnings

*This section documents key insights from different parallelization strategies we've tried, to guide future optimization efforts. Include what worked, what didn't, why, and recommendations for future approaches.*

### Work Stealing (Queue-based)

**Approach:** Pure work-stealing with all multisets in a shared queue that workers pull from.

**Result:** **SLOWER** - 2m 53s vs 2m 37s baseline (16s slower, ~10% regression)

**Why it failed:**
- Queue lock contention became bottleneck
- No benefit from queue overhead since work is naturally balanced by count
- Synchronization overhead outweighed any load balancing benefit

**Lesson:** For problems where multisets are countable and relatively uniform in complexity, static distribution is better than dynamic queue-based approaches.

---

### Hybrid Work Stealing (Modulo + Overflow Queue)

**Approach:** Workers process assigned multisets via modulo, then steal from overflow queue when done.

**Result:** **SLOWER** - 2m 57s vs 2m 37s baseline (20s slower, ~13% regression)

**Why it failed:**
- Critical bug: overflow_producer thread iterated ALL 7.8M multisets before workers could start
- Even without bug, queue generation overhead likely too high
- Added complexity without addressing root cause

**Lesson:** Generating overflow work upfront is a blocking anti-pattern. If work-stealing is needed, it must be lazy/on-demand.

---

### Random Chunk Assignment

**Approach:** Assign chunks of 8 contiguous multisets randomly to workers (instead of modulo).

**Result:** **NOT FULLY TESTED** - Suspected slower due to random seed coordination overhead

**Why likely problematic:**
- Doesn't address the actual problem (some multisets inherently slower)
- Random distribution adds overhead without theoretical benefit
- No evidence that modulo distribution itself causes imbalance

**Lesson:** Don't randomize just to randomize. Need data showing modulo causes pathological patterns first.

---

### Adaptive Progress Batching

**Approach:** Scale progress update batch size based on problem size (1000 → 100 → 10 → 1).

**Result:** Improved progress display responsiveness, but **may increase lock contention** for large problems

**Why partially successful:**
- Smaller batches = more frequent updates = better UX
- But more lock acquisitions = potential bottleneck at scale

**Lesson:** Progress display UX vs lock contention is a real tradeoff. Use --verbose to measure actual lock wait times before optimizing.

---

### Verbose Diagnostics (v0.2)

**Approach:** Add comprehensive --verbose flag with timing, lock contention, throughput metrics.

**Result:** **SUCCESS** - Minimal overhead (<5%), reveals bottlenecks clearly

**Why it works:**
- Timestamps and level-based indentation make output readable
- Lock wait times directly show contention issues
- Phase throughput (multisets/sec) highlights slow sections
- Essential for data-driven optimization

**Lesson:** Always add comprehensive diagnostics FIRST before trying optimizations. Measure, don't guess.

---

### Key Insights for Future Work

1. **The real problem is likely NOT load distribution**
   - Modulo gives perfect static balance
   - Core idling suggests workers finishing at different times due to multiset complexity variance
   - OR Manager/memo overhead increasing over time

2. **Manager.dict() is suspect**
   - Hangs on initialization for large problems (base 24, digits 8)
   - Shared state = serialization overhead and lock contention
   - May need to test without memoization to isolate impact

3. **Profile multiset complexity**
   - Need data on whether later multisets are actually slower
   - Use --verbose to track per-worker throughput over time
   - May need to instrument individual multiset processing times

4. **Promising directions to explore:**
   - Remove or reduce shared memoization (use local memo only, merge at end)
   - Profile to find if specific multiset patterns are slow
   - Investigate Manager initialization for large problems
   - Consider C extension for hot path if Python overhead is real

5. **Anti-patterns to avoid:**
   - Queue-based work stealing (proven slower)
   - Generating all work upfront before parallelizing
   - Optimizing progress display at expense of lock contention without measurement
   - Random distribution without evidence of pathological patterns

## How to Use This Document

1. **Before making changes**: Read current version notes and Learnings section
2. **While developing**: Update TODO list and add notes to relevant sections
3. **Before committing**:
   - Increment version number in code
   - Run standard test suite
   - Record benchmark results
   - Add version history entry
   - **Add learning entry if approach was tested (success or failure)**
   - Commit with message format: `vX.Y: Brief description`
4. **When debugging**: Add observations to Performance Investigation Notes and Learnings
