#!/usr/bin/env python3
"""
Kaprekar Parallel Processor - Version 0.9

Features:
- Adaptive chunk sizing for optimal load balancing
- Adaptive memo write reduction based on runtime metrics
- --high-mem: Async queue-based memo merging (eliminates worker blocking on merge)
- Cycle ID system: Uses lowest number in cycle as canonical ID for accurate cycle counting
"""

VERSION = "0.9"

import sys
import csv
import time
import argparse
import os
import threading
import queue
from pathlib import Path
from multiprocessing import Pool, Manager, Lock, Value

# Global verbose flag
VERBOSE = False

def vlog(message, level=1):
    """Verbose logging - only prints if VERBOSE is enabled"""
    if VERBOSE:
        timestamp = time.strftime("%H:%M:%S")
        indent = "  " * (level - 1)
        print(f"[{timestamp}] {indent}{message}", file=sys.stderr, flush=True)
from kaprekar_lib import (
    analyze_number, generate_digit_multisets, generate_digit_multisets_modulo, generate_digit_multisets_range,
    digits_to_num, count_digit_multisets
)

# Worker-persistent state (survives across chunks within same worker process)
worker_shared_memo_snapshot = {}  # Read-only: known entries from last sync
worker_private_memo = {}  # Write-only: new discoveries since last sync
worker_id = None  # Assigned once per worker process (0-15 for 16 workers)

# Token-passing sync coordination (set by parent process)
_sync_token_holder = None  # Manager.Value('i', 0) - which worker ID holds the token
_num_workers = None  # Total number of workers
_worker_id_counter = None  # Manager.Value('i', 0) - atomic counter for assigning sequential worker IDs
_shared_memo_version = None  # Manager.Value('i', 0) - version counter that increments on each merge (reserved for future use)
_batch_shared_memo = None  # (Deprecated) Reference to parent's batch_shared_memo dict - now using shared_memo_manager (Manager.dict())
_memo_lock = None  # (Deprecated) Lock for accessing batch_shared_memo - Manager.dict() has its own locking


def process_multiset_chunk(args):
    """
    Worker that generates and processes its assigned chunk using modulo arithmetic.

    Args:
        args: tuple of (base, num_digits, chunk_id, total_chunks, shared_memo, progress_counter, progress_lock, write_reduction_factor)

    Returns:
        tuple: (fixed_points_dict, cycle_count, new_writes, multisets_processed, new_memo_entries)
            new_memo_entries: dict of new discoveries to merge into shared memo (only in high-mem mode)
    """
    base, num_digits, start_idx, end_idx, shared_memo_manager, sync_token_holder, sync_token_lock, progress_counter, progress_lock, write_reduction_factor = args

    global worker_shared_memo_snapshot, worker_private_memo, worker_id, _sync_token_holder, _num_workers, _worker_id_counter

    # Assign worker ID on first call (persistent across chunks)
    if worker_id is None:
        import os
        # Atomically get next worker ID from counter (ensures sequential 0, 1, 2, 3, ...)
        if _worker_id_counter is not None:
            with sync_token_lock:  # Reuse token lock for atomicity
                worker_id = _worker_id_counter.value
                _worker_id_counter.value += 1
        else:
            # Fallback: use PID modulo (shouldn't happen in high-mem mode)
            worker_id = os.getpid() % _num_workers
        _sync_token_holder = sync_token_holder  # Cache reference
        vlog(f"Worker PID {os.getpid()} assigned worker_id={worker_id}", level=2)

    worker_start = time.time()
    vlog(f"Worker {worker_id} starting: base={base}, digits={num_digits}, range=[{start_idx}, {end_idx})", level=2)

    fixed_point_ids = {}
    next_fp_id = 1
    cycle_count = 0

    # High-mem mode: shared_memo_manager is a Manager.dict() that workers can read from when they have the token
    # Normal mode: shared_memo_manager is Manager.dict() with live sharing
    is_high_mem = shared_memo_manager is not None and sync_token_holder is not None

    # Token-passing sync: check if this worker holds the token
    has_token = False
    if is_high_mem:
        with sync_token_lock:
            current_holder = sync_token_holder.value
            if current_holder == worker_id:
                has_token = True

    # Split read/write memo initialization based on token ownership
    if has_token:
        # TOKEN SYNC: Load latest from Manager.dict() as read-only snapshot, reset private memo
        try:
            # Copy from Manager.dict() to local dict (one-time IPC cost)
            worker_shared_memo_snapshot = dict(shared_memo_manager)
            initial_shared_size = len(worker_shared_memo_snapshot)
            vlog(f"Worker {worker_id} [{start_idx},{end_idx}): TOKEN SYNC - Loaded {initial_shared_size} shared entries from Manager.dict() (read-only)", level=3)
        except Exception as e:
            worker_shared_memo_snapshot = {}
            vlog(f"Worker {worker_id} [{start_idx},{end_idx}): TOKEN SYNC - Failed to load shared memo: {e}, starting fresh", level=3)

        # Reset private memo to empty (only NEW discoveries go here)
        worker_private_memo = {}
        vlog(f"Worker {worker_id} [{start_idx},{end_idx}): TOKEN SYNC - Reset private memo (write-only for new discoveries)", level=3)
    else:
        # No token: keep using existing snapshots
        vlog(f"Worker {worker_id} [{start_idx},{end_idx}): Using existing memos: {len(worker_shared_memo_snapshot)} shared (read-only), {len(worker_private_memo)} private (no token)", level=3)

    # Initialize memo for normal mode (non-high-mem)
    private_memo = {}
    initial_memo_size = 0

    # Also load shared memo in normal mode (Manager.dict() with live IPC)
    if not is_high_mem and shared_memo_manager is not None:
        try:
            private_memo.update(shared_memo_manager)
            initial_memo_size = len(shared_memo_manager)
            vlog(f"Worker [{start_idx},{end_idx}): Loaded {initial_memo_size} entries from Manager.dict()", level=3)
        except Exception as e:
            vlog(f"Worker [{start_idx},{end_idx}): Failed to load Manager.dict(): {e}", level=3)

    # Create split read/write memo wrapper for high-mem mode
    if is_high_mem:
        # Wrapper dict that implements split read/write pattern
        class SplitMemo:
            """Wrapper that checks read-only snapshot first, then writes to private memo."""
            def __contains__(self, key):
                return key in worker_shared_memo_snapshot or key in worker_private_memo

            def __getitem__(self, key):
                if key in worker_shared_memo_snapshot:
                    return worker_shared_memo_snapshot[key]
                return worker_private_memo[key]

            def get(self, key, default=None):
                if key in worker_shared_memo_snapshot:
                    return worker_shared_memo_snapshot[key]
                return worker_private_memo.get(key, default)

            def __setitem__(self, key, value):
                # Always write to private memo (new discoveries only)
                worker_private_memo[key] = value

            def update(self, other):
                worker_private_memo.update(other)

        memo_for_analysis = SplitMemo()
    else:
        # Normal mode: use private_memo directly
        memo_for_analysis = private_memo

    # Progress tracking with batched updates (update every 10000 multisets to minimize lock contention)
    local_progress = 0
    progress_batch_size = 10000

    multisets_processed = 0
    phase_start = time.time()

    # Process multisets in the assigned range
    for digit_multiset, perm_count in generate_digit_multisets_range(num_digits, base, start_idx, end_idx):
        digits_list = list(digit_multiset)
        max_digits_sorted = sorted(digits_list, reverse=True)
        min_digits_sorted = sorted(digits_list)
        first_step_result = digits_to_num(max_digits_sorted, base) - digits_to_num(min_digits_sorted, base)

        result_type, final_value, path = analyze_number(first_step_result, num_digits, base, memo_for_analysis)

        if result_type == 'fixed_point':
            if final_value not in fixed_point_ids:
                fixed_point_ids[final_value] = next_fp_id
                next_fp_id += 1
        else:
            cycle_count += perm_count

        # Batched progress update
        local_progress += 1
        multisets_processed += 1
        if local_progress >= progress_batch_size:
            if progress_counter is not None and progress_lock is not None:
                lock_start = time.time()
                with progress_lock:
                    progress_counter.value += local_progress
                lock_time = time.time() - lock_start
                vlog(f"Worker [{start_idx},{end_idx}): Progress update ({local_progress} multisets), lock wait: {lock_time:.4f}s", level=4)
            local_progress = 0

    phase_time = time.time() - phase_start
    vlog(f"Worker [{start_idx},{end_idx}): Phase 1 complete - {multisets_processed} multisets in {phase_time:.2f}s ({multisets_processed/phase_time:.1f}/s)", level=3)

    # Final progress update for remaining
    if local_progress > 0 and progress_counter is not None and progress_lock is not None:
        with progress_lock:
            progress_counter.value += local_progress

    # NOTE: In high-mem mode, worker_shared_memo_snapshot and worker_private_memo are GLOBAL
    # and persist across chunks. No need to save/restore them here.

    # Calculate new discoveries for normal mode
    if not is_high_mem:
        new_discoveries = len(private_memo) - initial_memo_size

    # Handle memo writes differently based on mode and sync timing
    memo_push_start = time.time()
    new_writes = 0
    new_memo_entries = {}  # For high-mem mode: return new discoveries to be merged

    if shared_memo_manager is not None:
        if is_high_mem:
            # High-mem mode with token-passing sync
            if has_token:
                # Has token: return ONLY worker_private_memo (new discoveries), then pass token
                new_memo_entries = worker_private_memo.copy()
                new_writes = len(new_memo_entries)

                # Pass token to next worker (round-robin)
                with sync_token_lock:
                    next_holder = (worker_id + 1) % _num_workers
                    sync_token_holder.value = next_holder
                    vlog(f"Worker {worker_id} [{start_idx},{end_idx}): TOKEN SYNC - Returning {new_writes} NEW memo entries (not {len(worker_shared_memo_snapshot)} shared), passing token to worker {next_holder}", level=3)
            else:
                # No token: don't return memo, worker keeps it in worker_private_memo
                new_writes = 0
                vlog(f"Worker {worker_id} [{start_idx},{end_idx}): No sync - keeping {len(worker_private_memo)} private memo entries (no token)", level=3)
        else:
            # Normal mode: Push to Manager.dict() with optional sampling
            try:
                # Get current write reduction factor (may be Value object or int)
                if hasattr(write_reduction_factor, 'value'):
                    reduction = write_reduction_factor.value
                else:
                    reduction = write_reduction_factor

                if reduction > 1:
                    # Only write a sample of new discoveries to reduce Manager.dict() contention
                    initial_keys = set(shared_memo.keys()) if initial_memo_size > 0 else set()
                    new_keys = [k for k in private_memo.keys() if k not in initial_keys]

                    # Sample every Nth new entry (deterministic sampling based on hash)
                    sampled_keys = [k for k in new_keys if hash(k) % reduction == 0]

                    # Update with initial entries + sampled new entries
                    memo_to_push = {k: private_memo[k] for k in initial_keys if k in private_memo}
                    memo_to_push.update({k: private_memo[k] for k in sampled_keys})

                    shared_memo.update(memo_to_push)
                    new_writes = len(sampled_keys)
                    memo_push_time = time.time() - memo_push_start
                    vlog(f"Worker [{start_idx},{end_idx}): Pushed {len(sampled_keys)}/{new_discoveries} new entries (1/{reduction} sampling) to shared memo in {memo_push_time:.3f}s", level=3)
                else:
                    # Normal path: write all discoveries
                    shared_memo.update(private_memo)
                    new_writes = new_discoveries
                    memo_push_time = time.time() - memo_push_start
                    vlog(f"Worker [{start_idx},{end_idx}): Pushed {new_discoveries} new entries to shared memo in {memo_push_time:.3f}s", level=3)
            except Exception as e:
                vlog(f"Worker [{start_idx},{end_idx}): Failed to push to shared memo: {e}", level=3)

    worker_time = time.time() - worker_start
    vlog(f"Worker [{start_idx},{end_idx}) complete: {multisets_processed} multisets, {len(fixed_point_ids)} FPs, {worker_time:.2f}s total", level=2)

    return (fixed_point_ids, cycle_count, new_writes, multisets_processed, new_memo_entries)


def format_large_number_pair(numerator, denominator):
    """Format two large numbers with the same scientific notation exponent.
    Keep scaled numbers under 1,000,000 (6 digits)."""
    if denominator < 1000000:
        return f"{numerator}/{denominator}"

    # Find the exponent to keep denominator < 1,000,000
    exponent = 0
    temp_den = denominator
    while temp_den >= 1000000:
        exponent += 1
        temp_den //= 10

    # Scale both numbers by 10^exponent
    divisor = 10 ** exponent
    num_scaled = numerator // divisor
    den_scaled = denominator // divisor

    return f"({num_scaled}/{den_scaled})x10^{exponent}"


def format_large_number_single(number):
    """Format a single large number with scientific notation.
    Keep scaled number under 1,000,000 (6 digits)."""
    if number < 1000000:
        return str(number)

    # Find the exponent to keep number < 1,000,000
    exponent = 0
    temp = number
    while temp >= 1000000:
        exponent += 1
        temp //= 10

    # Scale the number
    divisor = 10 ** exponent
    scaled = number // divisor

    return f"{scaled}x10^{exponent}"


def format_fraction_with_common_scale(numerator, denominator):
    """Format two numbers as a fraction with common scale: (num/denom)x10^n
    Both numbers are scaled to the same exponent, with plain integers inside parens.

    Examples:
        (320517, 1307504) -> "(32051/130750)x10^1"
        (1307504, 1307504) -> "(130750/130750)x10^1"
        (54627300, 54627300) -> "(54627/54627)x10^3"
        (12345, 67890) -> "(12345/67890)"
    """
    # If denominator is small, don't use scientific notation
    if denominator < 1000000:
        return f"({numerator}/{denominator})"

    # Find exponent to keep denominator < 1,000,000 (6 digits max)
    exponent = 0
    temp = denominator
    while temp >= 1000000:
        exponent += 1
        temp //= 10

    # Scale both numbers with the same exponent
    divisor = 10 ** exponent
    scaled_num = numerator // divisor
    scaled_denom = denominator // divisor

    return f"({scaled_num}/{scaled_denom})x10^{exponent}"


def format_time_eta(elapsed_secs, progress_pct):
    """Format elapsed time and ETA.
    Args:
        elapsed_secs: Elapsed time in seconds
        progress_pct: Progress percentage (0-100)
    Returns:
        String like "2m 30s - ETA 5m 12s" or "2m 30s" if no ETA available
    """
    mins = elapsed_secs // 60
    secs = elapsed_secs % 60
    time_str = f"{mins}m {secs}s"

    # Calculate ETA if we have meaningful progress
    if progress_pct > 0.1:  # At least 0.1% progress
        total_estimated_secs = int(elapsed_secs / (progress_pct / 100.0))
        remaining_secs = total_estimated_secs - elapsed_secs
        if remaining_secs > 0:
            eta_mins = remaining_secs // 60
            eta_secs = remaining_secs % 60
            time_str += f" - ETA {eta_mins}m {eta_secs}s"

    return time_str


def process_base_digit_pair_parallel(base, num_digits, cpu_cores, completed_multisets, total_multisets_global, global_start_time, high_mem_mode=False):
    """
    Process a single (base, num_digits) pair using parallel workers with modulo splitting.
    Creates exactly cpu_cores workers, each processing every Nth multiset.

    Args:
        high_mem_mode: If True, disable shared memoization for maximum performance
    """
    task_start = time.time()
    vlog(f"Task starting: base={base}, digits={num_digits}, cores={cpu_cores}", level=1)

    if high_mem_mode:
        vlog(f"  High-memory mode: Batch-shared memoization (merged between chunks)", level=1)

    manager_start = time.time()
    manager = Manager()
    # Both modes now use Manager.dict() for shared memo
    # High-mem mode: workers only read when they have the token (infrequent IPC)
    # Normal mode: workers read/write directly (frequent IPC)
    shared_memo_manager = manager.dict()
    progress_counter = manager.Value('i', 0)
    progress_lock = manager.Lock()
    write_reduction_factor = manager.Value('i', 1)  # Start with no reduction

    # Token-passing sync coordination: worker 0 starts with the token
    sync_token_holder = manager.Value('i', 0) if high_mem_mode else None  # Worker ID that holds token
    sync_token_lock = manager.Lock() if high_mem_mode else None
    worker_id_counter = manager.Value('i', 0) if high_mem_mode else None  # Atomic counter for sequential worker ID assignment

    # Set global _num_workers and _worker_id_counter so workers can get sequential IDs
    global _num_workers, _worker_id_counter
    _num_workers = cpu_cores
    _worker_id_counter = worker_id_counter

    manager_time = time.time() - manager_start
    vlog(f"  Manager initialized in {manager_time:.3f}s", level=2)

    # Count total multisets for this task
    task_multisets = count_digit_multisets(num_digits, base)
    vlog(f"  Total multisets: {task_multisets:,}", level=2)

    # Adaptive chunk sizing: scale with workload size for optimal performance
    # Formula: chunk_size = max(min_chunk, min(max_chunk, task_multisets / (cpu_cores * chunks_per_core)))
    # - Small workloads: larger chunks (less overhead)
    # - Large workloads: smaller chunks (better load balancing)
    min_chunk_size = 5000      # Minimum chunk size (avoid tiny chunks)
    max_chunk_size = 100000    # Maximum chunk size (ensure enough chunks for load balancing)
    chunks_per_core = 20       # Target number of chunks per worker for fine-grained distribution

    # Calculate adaptive chunk size
    target_total_chunks = cpu_cores * chunks_per_core
    adaptive_chunk_size = max(1, task_multisets // target_total_chunks)
    chunk_size = max(min_chunk_size, min(max_chunk_size, adaptive_chunk_size))

    num_chunks = max(1, (task_multisets + chunk_size - 1) // chunk_size)  # Round up
    vlog(f"  Creating {num_chunks} chunks of ~{chunk_size:,} multisets each (adaptive sizing)", level=2)

    all_fixed_points = {}
    total_cycle_count = 0

    # In high-mem mode: create async memo merge queue and thread
    # Merges write directly to shared_memo_manager (Manager.dict())
    memo_merge_queue = None
    memo_merge_thread = None
    stop_merge_thread = None

    if high_mem_mode:
        memo_merge_queue = queue.Queue()
        stop_merge_thread = threading.Event()

        def async_memo_merger():
            """Background thread that continuously merges memo entries from the queue."""
            vlog(f"  Async memo merger thread started", level=2)
            merge_count = 0
            total_new_keys = 0
            total_cycle_updates = 0

            while not stop_merge_thread.is_set() or not memo_merge_queue.empty():
                try:
                    # Non-blocking get with timeout so we can check stop flag
                    new_memo_entries = memo_merge_queue.get(timeout=0.1)
                    merge_count += 1

                    if new_memo_entries:
                        merge_start = time.time()
                        cycle_id_updates = 0
                        new_keys = 0

                        # Write directly to Manager.dict() (IPC overhead, but shared across workers)
                        before_size = len(shared_memo_manager)

                        for k, (p_type, p_value) in new_memo_entries.items():
                            if k not in shared_memo_manager:
                                shared_memo_manager[k] = (p_type, p_value)
                                new_keys += 1
                            else:
                                # Collision: for cycles, take the minimum ID
                                s_type, s_value = shared_memo_manager[k]
                                if p_type == 'cycle' and s_type == 'cycle' and p_value < s_value:
                                    shared_memo_manager[k] = ('cycle', p_value)
                                    cycle_id_updates += 1

                        after_size = len(shared_memo_manager)

                        merge_time = time.time() - merge_start
                        total_new_keys += new_keys
                        total_cycle_updates += cycle_id_updates

                        if cycle_id_updates > 0:
                            vlog(f"  Async merge #{merge_count}: {new_keys} new, {cycle_id_updates} cycle updates ({before_size} → {after_size}) in {merge_time:.3f}s", level=4)
                        else:
                            vlog(f"  Async merge #{merge_count}: {new_keys} new entries ({before_size} → {after_size}) in {merge_time:.3f}s", level=4)

                    memo_merge_queue.task_done()

                except queue.Empty:
                    continue

            vlog(f"  Async memo merger complete: {merge_count} merges, {total_new_keys} total new keys, {total_cycle_updates} cycle ID updates", level=2)

        memo_merge_thread = threading.Thread(target=async_memo_merger, daemon=True)
        memo_merge_thread.start()

    # Create task generator (lazy evaluation)
    # Pass Manager.dict() reference directly - workers copy from it when they have the token
    # Manager.dict() is a proxy object that reflects live state (not pickled snapshots)
    def task_generator():
        """Generate tasks on-demand. Pass Manager.dict() reference directly (not snapshotted)."""
        for i in range(num_chunks):
            start_idx = i * chunk_size
            end_idx = min((i + 1) * chunk_size, task_multisets)

            # Pass Manager.dict() reference directly (both modes)
            # Workers will copy from it when they have the token
            yield (base, num_digits, start_idx, end_idx, shared_memo_manager, sync_token_holder, sync_token_lock, progress_counter, progress_lock, write_reduction_factor)

    # Convert to list to get total count for logging
    vlog(f"  Task generator created for {num_chunks} chunks", level=2)

    # Progress monitoring thread that updates global progress
    stop_monitoring = threading.Event()

    def monitor_progress():
        last_update = time.time()
        while not stop_monitoring.is_set():
            time.sleep(0.5)
            current_time = time.time()
            if current_time - last_update >= 1.0:
                task_progress = progress_counter.value
                global_progress = completed_multisets + task_progress
                progress_pct = (global_progress / total_multisets_global) * 100 if total_multisets_global > 0 else 0
                elapsed = int(current_time - global_start_time)

                # Format: "(102731/103945)x10^4 (98.8%) [base 12, digits 17] - 2m 30s - ETA 5m 12s"
                fraction_str = format_fraction_with_common_scale(global_progress, total_multisets_global)
                time_str = format_time_eta(elapsed, progress_pct)
                print(f"\r{' ' * 120}\r{fraction_str} ({progress_pct:.1f}%) [base {base}, digits {num_digits}] - {time_str}", end='', flush=True)
                last_update = current_time

    monitor_thread = threading.Thread(target=monitor_progress, daemon=True)
    monitor_thread.start()

    pool_start = time.time()
    vlog(f"  Creating Pool with {cpu_cores} workers...", level=2)

    with Pool(processes=cpu_cores) as pool:
        pool_time = time.time() - pool_start
        vlog(f"  Pool created in {pool_time:.3f}s", level=2)

        # Launch workers with lazy task generation
        vlog(f"  Launching workers with lazy task generator for {num_chunks} chunks...", level=2)
        workers_complete = 0
        total_writes_sampled = 0
        total_multisets_sampled = 0
        sample_chunks = min(10, max(1, num_chunks // 10))  # Sample first 10 chunks or 10% of chunks
        write_rate_threshold = 0.20  # If writes/multiset exceeds this, enable reduction

        for fixed_points_dict, cycle_count, new_writes, multisets_processed, new_memo_entries in pool.imap_unordered(process_multiset_chunk, task_generator()):
            workers_complete += 1
            vlog(f"  Worker result collected ({workers_complete}/{num_chunks})", level=3)

            # Merge fixed points
            for fp_value, fp_id in fixed_points_dict.items():
                if fp_value not in all_fixed_points:
                    all_fixed_points[fp_value] = fp_id
            total_cycle_count += cycle_count

            # High-mem mode: Push new memo entries to async merge queue (non-blocking)
            if high_mem_mode and new_memo_entries:
                memo_merge_queue.put(new_memo_entries)
                vlog(f"  Pushed {len(new_memo_entries)} memo entries to async merge queue", level=3)

            # Track write rate during sampling period (for normal mode)
            if not high_mem_mode and workers_complete <= sample_chunks and write_reduction_factor.value == 1:
                total_writes_sampled += new_writes
                total_multisets_sampled += multisets_processed

                # Check if we've hit the sample threshold
                if workers_complete == sample_chunks:
                    write_rate = total_writes_sampled / total_multisets_sampled if total_multisets_sampled > 0 else 0
                    vlog(f"  Sampled write rate: {write_rate:.3f} writes/multiset (after {sample_chunks} chunks)", level=2)

                    if write_rate > write_rate_threshold:
                        write_reduction_factor.value = 10
                        vlog(f"  HIGH WRITE RATE DETECTED ({write_rate:.3f} > {write_rate_threshold}): Enabling 1/10 memo write sampling for remaining chunks", level=1)
                    else:
                        vlog(f"  Write rate acceptable ({write_rate:.3f} <= {write_rate_threshold}): Continuing with full memo writes", level=2)

    stop_monitoring.set()
    monitor_thread.join()

    # High-mem mode: Wait for async merge queue to finish, then stop merge thread
    if high_mem_mode and memo_merge_thread is not None:
        vlog(f"  Waiting for async merge queue to finish ({memo_merge_queue.qsize()} items remaining)...", level=2)
        memo_merge_queue.join()  # Wait for all items to be processed
        stop_merge_thread.set()
        memo_merge_thread.join()
        vlog(f"  Async merge thread stopped", level=2)

    # Count non-degenerate fixed points
    non_degenerate_fp_values = sorted([fp for fp in all_fixed_points.keys() if fp != 0])

    # Extract unique cycle IDs from shared_memo_manager (high-mem mode only)
    unique_cycle_ids = set()
    if high_mem_mode and shared_memo_manager:
        # Manager.dict() has its own internal locking, no external lock needed
        for result_type, value in shared_memo_manager.values():
            if result_type == 'cycle':
                unique_cycle_ids.add(value)
        vlog(f"  Final shared memo size: {len(shared_memo_manager):,} entries, {len(unique_cycle_ids)} unique cycle IDs", level=1)

    return (base, num_digits, total_cycle_count, non_degenerate_fp_values, len(unique_cycle_ids))


def process_base_digit_pair_serial(args):
    """Serial version for simple tasks."""
    base, num_digits = args

    fixed_point_ids = {}
    next_fp_id = 1
    cycle_count = 0
    memo = {}

    for digit_multiset, perm_count in generate_digit_multisets(num_digits, base):
        digits_list = list(digit_multiset)
        max_digits_sorted = sorted(digits_list, reverse=True)
        min_digits_sorted = sorted(digits_list)
        first_step_result = digits_to_num(max_digits_sorted, base) - digits_to_num(min_digits_sorted, base)

        result_type, final_value, path = analyze_number(first_step_result, num_digits, base, memo)

        if result_type == 'fixed_point':
            if final_value not in fixed_point_ids:
                fixed_point_ids[final_value] = next_fp_id
                next_fp_id += 1
        else:
            cycle_count += perm_count

    non_degenerate_fp_values = sorted([fp for fp in fixed_point_ids.keys() if fp != 0])

    # Extract unique cycle IDs from memo
    unique_cycle_ids = set()
    for result_type, value in memo.values():
        if result_type == 'cycle':
            unique_cycle_ids.add(value)

    return (base, num_digits, cycle_count, non_degenerate_fp_values, len(unique_cycle_ids))


def main():
    global VERBOSE

    parser = argparse.ArgumentParser(description='Generate Kaprekar summary data with smart parallelization')
    parser.add_argument('--min-base', type=int, default=2, help='Minimum base (default: 2)')
    parser.add_argument('--max-base', type=int, required=True, help='Maximum base')
    parser.add_argument('--min-digits', type=int, default=2, help='Minimum digits (default: 2)')
    parser.add_argument('--max-digits', type=int, required=True, help='Maximum digits')
    parser.add_argument('--cpu-cores', type=int, default=1, help='Number of CPU cores to use')
    parser.add_argument('--data-dir', type=str, default='.', help='Output directory')
    parser.add_argument('--digit-threshold', type=int, default=13, help='Digit count threshold for parallelization (default: 13)')
    parser.add_argument('--verbose', action='store_true', help='Enable detailed diagnostic logging')
    parser.add_argument('--high-mem', action='store_true', help='Disable shared memoization for maximum performance (uses more memory)')

    args = parser.parse_args()

    VERBOSE = args.verbose

    min_base = args.min_base
    max_base = args.max_base
    min_digits = args.min_digits
    max_digits = args.max_digits
    cpu_cores = args.cpu_cores
    digit_threshold = args.digit_threshold
    high_mem_mode = args.high_mem

    data_dir = Path(args.data_dir)
    csv_dir = data_dir / 'csv'
    csv_dir.mkdir(parents=True, exist_ok=True)

    summary_filename = csv_dir / f'kaprekar_summary_base{min_base}-{max_base}_digits{min_digits}-{max_digits}.csv'
    fp_filename = csv_dir / f'kaprekar_fp_base{min_base}-{max_base}_digits{min_digits}-{max_digits}.csv'
    cycles_filename = csv_dir / f'kaprekar_cycles_base{min_base}-{max_base}_digits{min_digits}-{max_digits}.csv'

    # Separate tasks into simple (serial) and complex (parallel within task)
    simple_tasks = []
    complex_tasks = []

    for base in range(min_base, max_base + 1):
        for num_digits in range(min_digits, max_digits + 1):
            # Complex if digits + base >= 20 (large problem needs intra-task parallelization)
            if num_digits + base >= 20:
                complex_tasks.append((base, num_digits))
            else:
                simple_tasks.append((base, num_digits))

    total_tasks = len(simple_tasks) + len(complex_tasks)

    # Calculate total multisets across all tasks
    total_multisets = sum(count_digit_multisets(num_digits, base) for base, num_digits in simple_tasks)
    total_multisets += sum(count_digit_multisets(num_digits, base) for base, num_digits in complex_tasks)

    print(f"Processing {total_tasks} base-digit pairs (base {min_base}-{max_base}, digits {min_digits}-{max_digits}) using {cpu_cores} cores")
    # Use format_large_number_single for cleaner display
    print(f"Total multisets: {format_large_number_single(total_multisets)}")

    start_time = time.time()
    last_update_time = start_time

    results = {}
    for base in range(min_base, max_base + 1):
        results[base] = {}

    bases_complete = set()
    bases_written = set()
    completed_tasks = 0
    completed_multisets = 0
    current_base = 0  # Track the most recent base-digit pair that started
    current_digits = 0

    summary_file = open(summary_filename, 'w', newline='')
    fp_file = open(fp_filename, 'w', newline='')
    cycles_file = open(cycles_filename, 'w', newline='')

    summary_writer = csv.writer(summary_file)
    fp_writer = csv.writer(fp_file)
    cycles_writer = csv.writer(cycles_file)

    summary_writer.writerow(['base', 'digits', 'num_cycles', 'fixed_points'])
    fp_writer.writerow(['base', 'digits', 'fixed_point_values'])
    cycles_writer.writerow(['base', 'digits', 'unique_cycle_ids'])

    vlog(f"Starting task processing: {len(simple_tasks)} simple, {len(complex_tasks)} complex", level=1)

    try:
        # Process simple tasks with pool
        if simple_tasks:
            vlog(f"Processing {len(simple_tasks)} simple tasks (digits <= {digit_threshold}) with Pool...", level=1)
            simple_start = time.time()

        with Pool(processes=cpu_cores) as pool:
            for result in pool.imap_unordered(process_base_digit_pair_serial, simple_tasks):
                base, num_digits, cycle_count, fp_values, unique_cycles = result
                results[base][num_digits] = (cycle_count, fp_values, unique_cycles)
                completed_tasks += 1
                completed_multisets += count_digit_multisets(num_digits, base)
                current_base = base  # Update most recent completed base-digit
                current_digits = num_digits
                vlog(f"  Completed simple task: base={base}, digits={num_digits}", level=2)

                current_time = time.time()
                if current_time - last_update_time >= 1.0:
                    elapsed = int(current_time - start_time)
                    progress_pct = (completed_multisets / total_multisets) * 100

                    # Format: "123x10^6 total (45.2%) [base 12, digits 17] - 2m 30s - ETA 5m 12s"
                    total_str = format_large_number_single(total_multisets)
                    time_str = format_time_eta(elapsed, progress_pct)
                    print(f"\r{' ' * 120}\r{total_str} total ({progress_pct:.1f}%) [base {current_base}, digits {current_digits}] - {time_str}", end='', flush=True)
                    last_update_time = current_time

        if simple_tasks:
            simple_time = time.time() - simple_start
            vlog(f"Simple tasks complete in {simple_time:.2f}s", level=1)

            # Check for complete bases after simple tasks
            for base in range(min_base, max_base + 1):
                if base in results and len(results[base]) == (max_digits - min_digits + 1):
                    bases_complete.add(base)

            # Write complete bases (same logic as in complex tasks)
            for b in sorted(bases_complete):
                if b in bases_written:
                    continue

                can_write = True
                for lower_base in range(min_base, b):
                    if lower_base not in bases_written:
                        can_write = False
                        break

                if can_write:
                    write_start = time.time()
                    rows_written = 0
                    for d in range(min_digits, max_digits + 1):
                        cycle_count, fp_values, unique_cycles = results[b][d]
                        num_fps = len(fp_values)
                        summary_writer.writerow([b, d, cycle_count, num_fps])
                        if fp_values:
                            fp_writer.writerow([b, d, ','.join(map(str, fp_values))])
                        # Write unique cycle count to third file
                        cycles_writer.writerow([b, d, unique_cycles])
                        rows_written += 1

                    summary_file.flush()
                    fp_file.flush()
                    cycles_file.flush()
                    write_time = time.time() - write_start
                    vlog(f"  Wrote base {b} ({rows_written} rows) in {write_time:.3f}s", level=2)
                    bases_written.add(b)

        # Process complex tasks sequentially, but parallelize within each
        if complex_tasks:
            vlog(f"Processing {len(complex_tasks)} complex tasks (digits > {digit_threshold}) with intra-task parallelization...", level=1)

        for base, num_digits in complex_tasks:
            result = process_base_digit_pair_parallel(base, num_digits, cpu_cores, completed_multisets, total_multisets, start_time, high_mem_mode)
            base, num_digits, cycle_count, fp_values, unique_cycles = result
            results[base][num_digits] = (cycle_count, fp_values, unique_cycles)
            completed_tasks += 1
            completed_multisets += count_digit_multisets(num_digits, base)

            # Check if base is complete
            if len(results[base]) == (max_digits - min_digits + 1):
                bases_complete.add(base)

            # Write complete bases
            for b in sorted(bases_complete):
                if b in bases_written:
                    continue

                can_write = True
                for lower_base in range(min_base, b):
                    if lower_base not in bases_written:
                        can_write = False
                        break

                if can_write:
                    write_start = time.time()
                    rows_written = 0
                    for d in range(min_digits, max_digits + 1):
                        cycle_count, fp_values, unique_cycles = results[b][d]
                        num_fps = len(fp_values)
                        summary_writer.writerow([b, d, cycle_count, num_fps])
                        if fp_values:
                            fp_writer.writerow([b, d, ','.join(map(str, fp_values))])
                        # Write unique cycle count to third file
                        cycles_writer.writerow([b, d, unique_cycles])
                        rows_written += 1

                    summary_file.flush()
                    fp_file.flush()
                    cycles_file.flush()
                    write_time = time.time() - write_start
                    vlog(f"  Wrote base {b} ({rows_written} rows) in {write_time:.3f}s", level=2)
                    bases_written.add(b)

    finally:
        summary_file.close()
        fp_file.close()
        cycles_file.close()

    elapsed_total = time.time() - start_time
    mins = int(elapsed_total // 60)
    secs = int(elapsed_total % 60)

    final_fraction = format_fraction_with_common_scale(total_multisets, total_multisets)
    print(f"\r{' ' * 120}\rCompleted: {final_fraction} (100.0%) - {mins}m {secs}s")
    print(f"\nOutput: {summary_filename}")
    print(f"Output: {fp_filename}")
    print(f"Output: {cycles_filename}")


if __name__ == "__main__":
    main()
