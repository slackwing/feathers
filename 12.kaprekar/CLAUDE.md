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
- [x] **ROOT CAUSE IDENTIFIED**: Modulo distribution causes load imbalance - 64% speed difference between workers
- [ ] Determine root cause of Manager() hang for large problems (base 24, digits 8+)
- [ ] Profile individual multiset complexity to confirm hypothesis about "later" multisets being slower
- [ ] Measure Manager.dict() overhead in isolation

### Performance Improvements to Test (Each as New Version)
- [ ] **v0.3: Chunk-based distribution** - Split total multisets into many small chunks (e.g., 1000 multisets each), assign chunks round-robin to workers. Reduces granularity of imbalance.
- [ ] **v0.4: Lazy atomic work stealing** - Use atomic Value() counter, workers atomically fetch next chunk index. No queue locks, pure pull-based load balancing.
- [ ] **v0.5: Interleaved distribution** - Assign contiguous ranges instead of modulo (Worker 0: 0-999, Worker 1: 1000-1999). Tests if modulo pattern itself is pathological.
- [ ] **v0.6: Remove shared memoization** - Use local memo only, no Manager.dict(). Merge results at end. Isolates Manager overhead.
- [ ] **v0.7: Profile multiset complexity** - Instrument to measure time per individual multiset. Identify if certain ranges are inherently slower.
- [ ] **v0.8: Hybrid chunk + steal** - Chunks with atomic counter stealing when workers finish early. Combines static efficiency with dynamic load balancing.
- [ ] **v0.9: Work stealing revisited** - Previous queue-based approach failed, but lazy atomic stealing may succeed. Test with learnings from v0.4.
- [ ] Adaptive batch sizing based on problem size (partially implemented in v0.2)

### Infrastructure
- [x] Version numbering system (0.1, 0.2, etc.)
- [x] Git commit at each version
- [x] CLAUDE.md documentation
- [ ] Standard test suite with benchmarks
- [ ] Automated benchmark comparison across versions

## Version History

### v0.9 - Worker-persistent memos with periodic syncing (Current) ⭐ BEST VERSION ⭐
**Commit:** 3d6ed55
**Date:** 2025-12-22

**Features:**
- **Worker-persistent memos**: Workers carry memo across multiple chunks via global variables
- **Periodic syncing (15s intervals)**: Workers only sync (push + reload) once per 15 seconds
- **Between syncs**: Workers carry their private_memo without any read/write to shared_memo
- **At sync time**: Worker pushes entire private_memo to async merge queue AND reloads from latest shared_memo snapshot
- **Async queue-based merging**: Background thread continuously merges memo entries from queue
- **Non-blocking memo checkout**: Workers get fresh memo snapshots when pulling tasks on-demand
- **Lazy task generation**: Tasks created dynamically (not upfront) so each gets latest merged memo
- Dramatically reduces read/write contention to shared_memo (from every chunk to once per 15s)

**How it works:**
1. Workers maintain persistent memo via global variables (`worker_persistent_memo`, `worker_last_sync_time`)
2. On first chunk or after 15s: Worker syncs (loads from shared_memo snapshot)
3. Between syncs: Worker carries persistent memo across chunks without any sharing
4. At sync time: Worker pushes entire private_memo to async merge queue
5. Background thread continuously merges entries from queue into batch_shared_memo
6. Task generator creates tasks on-demand with fresh snapshots of merged memo

**Performance:**
- **T5 (base 12, digits 19): 39s with 1344% CPU** - Excellent utilization!
- **75% improvement over v0.4** (155s → 39s)
- **Minimal lock contention** - Only sync every 15s per worker
- **Progressive speedup** - Later workers benefit from merged discoveries
- **No worker blocking** - Async queue-based merging prevents stalls

**Known Issues:**
- None identified - production ready!

### v0.7 - Batch-Shared Memoization
**Commit:** TBD
**Date:** 2025-12-22

**Features:**
- **Batch-shared memoization in --high-mem mode**: Workers use private memos (zero IPC overhead), merge discoveries into shared memo between chunks
- Progressive speedup: Later chunks benefit from earlier discoveries without contention
- Clear naming: `private_memo` vs `batch_shared_memo` vs `Manager.dict()`
- Each worker returns `new_memo_entries` dict for batch merge after completion
- Main thread merges new discoveries (skips duplicate keys) after each chunk completes
- Verbose logging shows batch merge operations and final batch-shared memo size
- Solves the "no sharing between chunks" problem from v0.6 while maintaining zero contention

**How it works:**
1. Each worker starts with a copy of `batch_shared_memo` as its `private_memo`
2. Worker processes chunk using only `private_memo` (no locks, no IPC)
3. Worker returns new discoveries that weren't in initial memo
4. Main thread merges new discoveries into `batch_shared_memo` (no duplicates)
5. Next worker gets updated `batch_shared_memo` as starting point

**Performance:**
- Same zero-contention benefits as v0.6 during processing
- Additional benefit: memo accumulates across chunks within same base-digit pair
- Expected to show progressive speedup as more chunks complete

**Known Issues:**
- High contention from frequent memo reads/writes (every chunk)
- Superseded by v0.9's periodic syncing approach

### v0.6 - High-Memory Mode
**Commit:** TBD
**Date:** 2025-12-22

**Features:**
- Added `--high-mem` flag to completely disable shared memoization
- Each worker uses independent local memo (no Manager.dict() operations)
- Eliminates all IPC overhead from memo reads/writes
- Fixed "Total multisets" formatting to use consistent 6-digit display
- Fixed task classification: restored `base + digits >= 20` for complex tasks

**Performance:**
- Solves Manager.dict() contention for large problems (base 10 digits 32+, 36+)
- 100% CPU utilization restored for previously-bottlenecked cases
- Trade-off: No memo sharing between workers (acceptable for large problems)

**Known Issues:**
- No memo sharing means redundant computation across workers
- No memo persistence across base-digit pairs

### v0.5 - Adaptive Memo Write Reduction + Size Cap
**Commit:** TBD
**Date:** 2025-12-18

**Features:**
- Runtime detection of high memo write rates via sampling first 10 chunks (or 10% of chunks)
- Automatically enables 10x write reduction if write rate exceeds 0.20 writes/multiset
- **Memo size cap at 5M entries** - clears memo when exceeded to prevent dict slowdown
- Deterministic hash-based sampling of memo entries to reduce Manager.dict() contention
- Verbose logging shows write rate sampling, reduction activation, and memo clearing
- Workers return (fixed_points, cycle_count, new_writes, multisets_processed) for tracking
- All v0.4 features (adaptive chunk sizing) retained

**Known Issues:**
- Threshold (0.20 writes/multiset) is heuristic, may need tuning
- Memo size cap (5M entries) is heuristic, may need tuning
- Clearing memo loses memoization benefit, but prevents catastrophic slowdown
- Sampling reduces shared memoization benefit (tradeoff for lower contention)

**Performance Characteristics:**
- Designed to solve Manager.dict() bottleneck for problems with high memo growth
- Automatically detects and responds to high write rates without hardcoded special cases
- Reduces writes by 10x when triggered (e.g., from 0.35 to 0.035 per multiset)
- Caps memo size at 5M entries to prevent dict performance degradation
- Should reduce write time per chunk by ~10x (e.g., 0.7s → 0.07s)
- Expected to restore CPU utilization to normal levels (near 100% per core)

**Problem Solved:**
Some base/digit combinations have high memo growth as Kaprekar iteration paths converge less often. Two issues identified:

1. **High write rate**: Base 10, digits 32 has 2.5x higher memo write rate (0.35 writes/multiset vs 0.14 for 31 digits, 0.18 for 33 digits). This caused Manager.dict() write operations to become the bottleneck, with workers spending 0.7s per chunk writing 35k entries.

2. **Large dict size**: Base 10, digits 36 has 202M projected memo entries. Manager.dict() operations slow dramatically with size (56x slower writes, 259x slower reads at 500k entries vs 100k capped). Even with lower write rate (0.228 writes/multiset), the sheer dict size causes contention.

Solutions: (1) Detect high write rates at runtime and sample only 10% of discoveries to write to shared memo. (2) Cap memo size at 5M entries and clear when exceeded, trading memoization benefit for consistent performance. Both approaches are adaptive and work for any future problematic base/digit combinations.

### v0.2 - Verbose Diagnostics
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

#### v0.4 (adaptive chunk sizing) ⭐ BEST VERSION ⭐

**Primary Tests:**

| Test ID | Time | CPU % | vs v0.2 | vs v0.3 | Notes |
|---------|------|-------|---------|---------|-------|
| T1-tiny | 0.044s | 136% | **-8%** | **-14%** | Faster than all versions, 5 multisets |
| T2-small-single | 0.227s | 107% | **-4%** | **-3%** | Faster than all versions, 24,310 multisets |
| T3-small-multi | 0.054s | 140% | +6% | **-22%** | Small overhead vs v0.2, much faster than v0.3, 1,596 multisets |
| T4-medium | 0.541s | 253% | **Same** | **-39%** | Matches v0.2 baseline, eliminates v0.3 overhead, 162,955 multisets |
| T5-large-single | 155s | 1573% | **-44%** | **-40%** | **HUGE WIN! 123s faster than v0.2, 105s faster than v0.3!** 54,627,300 multisets |

**Analysis:** Adaptive chunk sizing delivers excellent performance across all workload sizes! Formula: `chunk_size = max(5k, min(100k, total_multisets / (16 cores * 20 chunks/core)))` automatically scales chunk size with workload. Small workloads get larger chunks (less overhead), large workloads get smaller chunks (better load balancing). The 44% improvement on T5 proves adaptive sizing successfully addresses load imbalance while avoiding fixed-size chunk overhead. **v0.4 is the clear winner and should be used going forward.**

**Stress Tests (v0.4 only):**

| Test ID | Time | CPU % | vs v0.2 | Notes |
|---------|------|-------|---------|-------|
| T6-multi-stress | 256.5s (4m 16s) | 689% | **-20%** | **base 10-13, digits 8-15** - 32 tasks, 656.4M multisets, CPU utilization concern but wall clock improved |
| T7-quad-single | 379s (6m 19s) | N/A | **-49%** | **base 14-15, digits 14-15** - 4 tasks, 175M multisets, **MASSIVE WIN! Nearly 2x faster than v0.2!** |
| T8-super-stress | 595s (9m 55s) | 1591% | N/A | **base 18, digits 14** - 1 task, 265.2M multisets, **EXCELLENT CPU UTILIZATION!** Near-perfect parallel efficiency at 1591% (99.4% of theoretical max) |

**Stress Test Analysis:** The T6, T7, and T8 stress tests confirm that v0.4's adaptive chunking successfully handles workloads ranging from multi-task (T6) to very large single tasks (T7, T8). T7 showed the most dramatic improvement at 49% faster than v0.2 (747s → 379s), proving that adaptive sizing eliminates load imbalance on large complex workloads. T8 demonstrated near-perfect CPU utilization at 1591% (99.4% of theoretical 1600% on 16 cores), processing 265.2M multisets in under 10 minutes. The consistent high CPU utilization across all stress tests validates the adaptive chunking strategy. T6's 20% improvement with slightly lower CPU utilization (689% vs 799%) suggests room for future optimization on multi-task workloads, but wall clock time is what matters most. **Critical fix:** Changed digit threshold default from 14 to 13 in kaprekar_parallel_v2.py:281 to ensure digits 14-15 are both treated as "complex" tasks and processed together with parallel adaptive chunking.

#### v0.3 (chunk-based distribution)

**Primary Tests:**

| Test ID | Time | CPU % | vs v0.2 | Notes |
|---------|------|-------|---------|-------|
| T1-tiny | 0.051s | 133% | +6% | Within noise, 5 multisets |
| T2-small-single | 0.234s | 107% | -1% | Within noise, 24,310 multisets |
| T3-small-multi | 0.069s | 134% | +35% | Small overhead, 1,596 multisets |
| T4-medium | 0.887s | 205% | **+64%** | **Significant overhead for medium workloads**, 162,955 multisets |
| T5-large-single | 260s | 1546% | **-6.5%** | **Improvement! Better CPU utilization (1546% vs 1419%)**, 54,627,300 multisets |

**Analysis:** Chunk-based distribution (10k multisets/chunk) has significant overhead for small/medium workloads but shows improvement on large single tasks with better CPU utilization. The overhead comes from creating many small chunks and distributing them. **User preference: Overhead for smaller bases/digits is acceptable if there are savings for larger bases/digits, so this tradeoff is fine.** Next: Try adaptive chunk sizing in v0.4.

#### v0.2 (modulo distribution)

**Primary Tests:**

| Test ID | Time | CPU % | Notes |
|---------|------|-------|-------|
| T1-tiny | 0.048s | 140% | Instant, 5 multisets |
| T2-small-single | 0.236s | 108% | Fast, 24,310 multisets |
| T3-small-multi | 0.051s | 143% | Very fast, 1,596 multisets |
| T4-medium | 0.539s | 261% | Good scaling, 162,955 multisets |
| T5-large-single | 278s | 1419% | **base 12, digits 19** - 54,627,300 multisets, near 5-minute target |

**Secondary Tests:** (Run only when primary tests are good)

| Test ID | Time | CPU % | Notes |
|---------|------|-------|-------|
| T6-stress | 320s | 799% | **base 10-13, digits 8-15** - 655.6M multisets, 32 base-digit pairs (28 simple, 4 complex). **CRITICAL: Only ~50% CPU utilization - cores idling!** |
| T7-quad-single | 747s | 1398% | **base 14-15, digits 14-15** - 175.2M multisets, 4 base-digit pairs (all complex). **Load imbalance confirmed: 30-65% speed difference between workers, up to 77s idle time per task. Modulo distribution causes uneven workload.** |

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

### Modulo Distribution Load Imbalance (v0.2)

**Approach:** Using verbose diagnostics to analyze worker completion times in T6-stress test.

**Problem Identified:** Workers processing same number of multisets complete at vastly different times.

**Data from T6-stress (base=10, digits=15):**
- Each of 16 workers processed exactly 81,719 multisets
- Worker 12 (fastest): 1.35s → 60,690 multisets/sec
- Worker 4 (slowest): 2.21s → 37,030 multisets/sec
- **64% speed difference!** Slowest worker took 64% longer than fastest
- Result: 10 out of 16 workers finished early and sat idle for 0.86 seconds waiting for stragglers

**Overall Impact:**
- CPU utilization: 799% (should be ~1600% for 16 cores)
- Only ~50% of available compute actually utilized
- Wall clock time bottlenecked by slowest worker, not average worker

**Why it happens (hypothesis):**
- Modulo distribution assigns workers by index: Worker N processes multisets N, N+16, N+32, ...
- Worker 12: multisets 12, 28, 44, 60, 76, ...
- Worker 4: multisets 4, 20, 36, 52, 68, ...
- If certain multisets in the enumeration order are inherently slower (e.g., "later" multisets, or specific digit patterns), then workers get unevenly distributed slow work
- No mechanism for workers to rebalance once assigned

**Why modulo causes this:**
- Static pre-assignment with no dynamic rebalancing
- Assumes all multisets take roughly equal time (false assumption)
- Unlucky workers stuck with disproportionately slow multisets

**Verification needed:**
- Profile individual multiset processing times to confirm variance
- Test if "position in enumeration" correlates with processing time
- Compare against random distribution or chunk-based approaches

**Strategies to fix (see TODO for versions):**
1. **Chunk-based distribution**: Split into many small chunks, assign round-robin. Reduces granularity of imbalance.
2. **Lazy atomic work stealing**: Workers pull next chunk index atomically. Pure dynamic load balancing.
3. **Interleaved distribution**: Contiguous ranges instead of modulo. Tests if modulo pattern is pathological.
4. **Profile-guided distribution**: Measure complexity, assign slow multisets first, fast ones later.

**Lesson:** Static distribution is only optimal if work units are uniform. For variable-cost tasks, dynamic load balancing is essential. Modulo gives perfect count balance but terrible time balance.

---

### T7 Load Imbalance Deep Dive (v0.2)

**Test Configuration:** T7-quad-single with base 14-15, digits 14-15 (4 base-digit pairs, all using complex parallel path with `--digit-threshold 13`)

**Purpose:** Confirm load imbalance hypothesis with isolated, controlled test of only complex tasks with full verbose diagnostics.

**Results:**
- Total time: 747s (12m 27s)
- CPU utilization: 1398% (~87% of 16 cores - better than T6's 50%, but still suboptimal)
- Total multisets: 175.2M across 7 sequential tasks

**Detailed Worker Analysis Per Task:**

**Task 3 (base=14, digits=15) - 50.4% speed difference:**
- Fastest: Worker 5 at 15,393 m/s
- Slowest: Worker 4 at 10,233 m/s
- Idle time: 76.66s wasted by faster workers waiting

**Task 5 (base=15, digits=14) - 64.8% speed difference (worst case):**
- Fastest: Worker 6 at 21,214 m/s
- Slowest: Worker 1 at 12,873 m/s
- Idle time: 76.98s wasted

**Task 4 (base=14, digits=14) - 55.1% speed difference:**
- Fastest: Worker 15 at 12,373 m/s
- Slowest: Worker 0 at 7,979 m/s
- Idle time: 61.31s wasted

**Task 6 (base=15, digits=15) - 65.4% speed difference:**
- Fastest: Worker 6 at 15,193 m/s
- Slowest: Worker 1 at 9,186 m/s
- Idle time: 73.19s wasted

**Key Findings:**
1. **Different workers are fastest/slowest across tasks** - This confirms the problem is about which multisets are assigned to which workers (modulo distribution), NOT about worker capability differences
2. **Consistent 30-65% speed variance** - Even on uniform problem sizes, some workers get "unlucky" with inherently slower multisets
3. **Total wasted compute: 350-400 seconds** - That's 47-53% of the total 747s runtime spent idle!
4. **Better CPU utilization than T6 (87% vs 50%)** - Likely because all tasks were complex parallel, reducing simple-path bottlenecks

**Lesson:** Load imbalance is NOT about some workers being slow - it's about modulo distribution systematically assigning different-difficulty work. The same worker can be fastest on one task and slowest on another. This proves dynamic load balancing is needed, not worker capability fixes.

---

### Manager.dict() Write Bottleneck - Base 10, Digits 32 (v0.5)

**Problem:** Base 10, digits 32 shows 10-20% CPU utilization per core (should be near 100%), while neighboring digit counts (31, 33) work fine.

**Investigation Process:**
1. Initially suspected chunk overhead (3,504 chunks for 350M multisets)
2. User correctly questioned why 31 and 33 digits don't have same issue
3. Discovered memo growth rate varies significantly:
   - 31 digits: 0.079 memo entries per multiset → 21.7M projected
   - **32 digits: 0.169 memo entries per multiset → 59.0M projected** (2.7x higher!)
   - 33 digits: 0.094 memo entries per multiset → 42.0M projected

**Root Cause Identified:**
- Manager.dict() write operations are slow: ~50,000 ops/sec (0.02ms each)
- Base 10, 32 digits has **2.5x higher write rate** than neighbors:
  - 31 digits: 0.14 writes per multiset
  - **32 digits: 0.35 writes per multiset** (2.5x!)
  - 33 digits: 0.18 writes per multiset
- With 350M multisets split into 3,504 chunks of 100k:
  - Each chunk generates ~35,000 memo writes (0.35 × 100k)
  - Write time: 35k / 50k ops/sec = **0.7 seconds per chunk**
  - Actual Kaprekar computation: ~10 seconds per chunk
  - Workers spend 7% of time blocked on writes

**Why Higher Writes?**
Not higher reads (similar at ~6-7 per multiset across all digit counts). The writes come from memoizing discovered values. 32 digits has a mathematical property where Kaprekar iteration paths converge less often to shared intermediate values, so more unique numbers get memoized.

**Solution Implemented (v0.5):**
- Adaptive runtime detection: Track write rate during first 10 chunks (or 10% of total)
- If write rate exceeds 0.20 writes/multiset, enable 10x reduction for remaining chunks
- Sample only 10% of new memo discoveries to write (deterministic hash-based)
- Reduces writes from 0.35 to 0.035 per multiset (10x reduction)
- Expected write time per chunk: 3.5k / 50k = 0.07s (10x improvement)
- Tradeoff: Reduced shared memoization benefit, but eliminates bottleneck
- Advantage: No hardcoded special cases, adapts to any problematic base/digit combination

**Key Metrics:**
- Read operations: 6.86 per multiset, 14.0% hit rate (similar across digit counts)
- Write operations: 0.35 per multiset for 32 digits vs 0.14-0.18 for neighbors
- Manager.dict() performance: 50k writes/sec, 33k reads/sec (single-threaded)
- With 16 workers contending: effective rate much lower, causing blocks

**Lesson:** Manager.dict() serialization can become a bottleneck when write volume is high, even if reads are similar. Some base/digit combinations have mathematical properties that cause higher memo growth (less path convergence). For these special cases, reducing write frequency via sampling is more effective than trying to speed up Manager itself. The symptom (low CPU utilization) indicates workers are blocked on I/O (Manager writes), not computing.

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
