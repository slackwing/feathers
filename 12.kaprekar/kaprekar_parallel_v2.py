#!/usr/bin/env python3
"""
Kaprekar Parallel Processor - Version 0.1

Baseline: Pure modulo distribution with shared memoization
"""

VERSION = "0.1"

import sys
import csv
import time
import argparse
import os
import threading
from pathlib import Path
from multiprocessing import Pool, Manager, Lock, Value
from kaprekar_lib import (
    analyze_number, generate_digit_multisets, generate_digit_multisets_modulo,
    digits_to_num, count_digit_multisets
)


def process_multiset_chunk(args):
    """
    Worker that generates and processes its assigned chunk using modulo arithmetic.

    Args:
        args: tuple of (base, num_digits, chunk_id, total_chunks, shared_memo, progress_counter, progress_lock)

    Returns:
        tuple: (fixed_points_dict, cycle_count)
    """
    base, num_digits, chunk_id, total_chunks, shared_memo, progress_counter, progress_lock = args

    fixed_point_ids = {}
    next_fp_id = 1
    cycle_count = 0
    local_memo = {}

    # Pull shared memo
    if shared_memo is not None:
        try:
            local_memo.update(shared_memo)
        except:
            pass

    # Progress tracking with batched updates (update every 10000 multisets to minimize lock contention)
    local_progress = 0
    progress_batch_size = 10000

    # Process multisets assigned to this chunk (every Nth multiset)
    for digit_multiset, perm_count in generate_digit_multisets_modulo(num_digits, base, chunk_id, total_chunks):
        digits_list = list(digit_multiset)
        max_digits_sorted = sorted(digits_list, reverse=True)
        min_digits_sorted = sorted(digits_list)
        first_step_result = digits_to_num(max_digits_sorted, base) - digits_to_num(min_digits_sorted, base)

        result_type, final_value, path = analyze_number(first_step_result, num_digits, base, local_memo)

        if result_type == 'fixed_point':
            if final_value not in fixed_point_ids:
                fixed_point_ids[final_value] = next_fp_id
                next_fp_id += 1
        else:
            cycle_count += perm_count

        # Batched progress update
        local_progress += 1
        if local_progress >= progress_batch_size:
            if progress_counter is not None and progress_lock is not None:
                with progress_lock:
                    progress_counter.value += local_progress
            local_progress = 0

    # Final progress update for remaining
    if local_progress > 0 and progress_counter is not None and progress_lock is not None:
        with progress_lock:
            progress_counter.value += local_progress

    # Push discoveries to shared memo
    if shared_memo is not None:
        try:
            shared_memo.update(local_memo)
        except:
            pass

    return (fixed_point_ids, cycle_count)


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


def process_base_digit_pair_parallel(base, num_digits, cpu_cores, completed_multisets, total_multisets_global, global_start_time):
    """
    Process a single (base, num_digits) pair using parallel workers with modulo splitting.
    Creates exactly cpu_cores workers, each processing every Nth multiset.
    """
    manager = Manager()
    shared_memo = manager.dict()
    progress_counter = manager.Value('i', 0)
    progress_lock = manager.Lock()

    # Count total multisets for this task
    task_multisets = count_digit_multisets(num_digits, base)

    # Create cpu_cores tasks, each handling every Nth multiset
    tasks = []
    for chunk_id in range(cpu_cores):
        tasks.append((base, num_digits, chunk_id, cpu_cores, shared_memo, progress_counter, progress_lock))

    all_fixed_points = {}
    total_cycle_count = 0

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
                mins = elapsed // 60
                secs = elapsed % 60
                progress_str = format_large_number_pair(global_progress, total_multisets_global)
                print(f"\r{' ' * 120}\rProgress: {progress_str} multisets ({progress_pct:.1f}%) - {mins}m {secs}s", end='', flush=True)
                last_update = current_time

    monitor_thread = threading.Thread(target=monitor_progress, daemon=True)
    monitor_thread.start()

    with Pool(processes=cpu_cores) as pool:
        # Launch all workers and collect results
        for fixed_points_dict, cycle_count in pool.imap_unordered(process_multiset_chunk, tasks):
            # Merge fixed points
            for fp_value, fp_id in fixed_points_dict.items():
                if fp_value not in all_fixed_points:
                    all_fixed_points[fp_value] = fp_id
            total_cycle_count += cycle_count

    stop_monitoring.set()
    monitor_thread.join()

    # Count non-degenerate fixed points
    non_degenerate_fp_values = sorted([fp for fp in all_fixed_points.keys() if fp != 0])

    return (base, num_digits, total_cycle_count, non_degenerate_fp_values)


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

    return (base, num_digits, cycle_count, non_degenerate_fp_values)


def main():
    parser = argparse.ArgumentParser(description='Generate Kaprekar summary data with smart parallelization')
    parser.add_argument('--min-base', type=int, default=2, help='Minimum base (default: 2)')
    parser.add_argument('--max-base', type=int, required=True, help='Maximum base')
    parser.add_argument('--min-digits', type=int, default=2, help='Minimum digits (default: 2)')
    parser.add_argument('--max-digits', type=int, required=True, help='Maximum digits')
    parser.add_argument('--cpu-cores', type=int, default=1, help='Number of CPU cores to use')
    parser.add_argument('--data-dir', type=str, default='.', help='Output directory')
    parser.add_argument('--digit-threshold', type=int, default=14, help='Digit count threshold for parallelization (default: 14)')

    args = parser.parse_args()

    min_base = args.min_base
    max_base = args.max_base
    min_digits = args.min_digits
    max_digits = args.max_digits
    cpu_cores = args.cpu_cores
    digit_threshold = args.digit_threshold

    data_dir = Path(args.data_dir)
    csv_dir = data_dir / 'csv'
    csv_dir.mkdir(parents=True, exist_ok=True)

    summary_filename = csv_dir / f'kaprekar_summary_base{min_base}-{max_base}_digits{min_digits}-{max_digits}.csv'
    fp_filename = csv_dir / f'kaprekar_fp_base{min_base}-{max_base}_digits{min_digits}-{max_digits}.csv'

    # Separate tasks into simple (serial) and complex (parallel within task)
    simple_tasks = []
    complex_tasks = []

    for base in range(min_base, max_base + 1):
        for num_digits in range(min_digits, max_digits + 1):
            if num_digits <= digit_threshold:
                simple_tasks.append((base, num_digits))
            else:
                complex_tasks.append((base, num_digits))

    total_tasks = len(simple_tasks) + len(complex_tasks)

    # Calculate total multisets across all tasks
    total_multisets = sum(count_digit_multisets(num_digits, base) for base, num_digits in simple_tasks)
    total_multisets += sum(count_digit_multisets(num_digits, base) for base, num_digits in complex_tasks)

    print(f"Processing {total_tasks} base-digit pairs (base {min_base}-{max_base}, digits {min_digits}-{max_digits}) using {cpu_cores} cores")
    if total_multisets >= 1000000:
        # Show just the total for large numbers
        exponent = 0
        divisor = 1
        temp = total_multisets
        while temp >= 1000000 * (10 ** (exponent + 1)):
            exponent += 1
            divisor *= 10
        scaled = total_multisets // divisor
        print(f"Total multisets: ({scaled})x10^{exponent}")
    else:
        print(f"Total multisets: {total_multisets}")

    start_time = time.time()
    last_update_time = start_time

    results = {}
    for base in range(min_base, max_base + 1):
        results[base] = {}

    bases_complete = set()
    bases_written = set()
    completed_tasks = 0
    completed_multisets = 0

    summary_file = open(summary_filename, 'w', newline='')
    fp_file = open(fp_filename, 'w', newline='')

    summary_writer = csv.writer(summary_file)
    fp_writer = csv.writer(fp_file)

    summary_writer.writerow(['base', 'digits', 'num_cycles', 'fixed_points'])
    fp_writer.writerow(['base', 'digits', 'fixed_point_values'])

    try:
        # Process simple tasks with pool
        with Pool(processes=cpu_cores) as pool:
            for result in pool.imap_unordered(process_base_digit_pair_serial, simple_tasks):
                base, num_digits, cycle_count, fp_values = result
                results[base][num_digits] = (cycle_count, fp_values)
                completed_tasks += 1
                completed_multisets += count_digit_multisets(num_digits, base)

                current_time = time.time()
                if current_time - last_update_time >= 1.0:
                    elapsed = int(current_time - start_time)
                    elapsed_mins = elapsed // 60
                    elapsed_secs = elapsed % 60
                    progress_pct = (completed_multisets / total_multisets) * 100
                    progress_str = format_large_number_pair(completed_multisets, total_multisets)
                    print(f"\r{' ' * 120}\rProgress: {progress_str} multisets ({progress_pct:.1f}%) - {elapsed_mins}m {elapsed_secs}s", end='', flush=True)
                    last_update_time = current_time

        # Process complex tasks sequentially, but parallelize within each
        for base, num_digits in complex_tasks:
            result = process_base_digit_pair_parallel(base, num_digits, cpu_cores, completed_multisets, total_multisets, start_time)
            base, num_digits, cycle_count, fp_values = result
            results[base][num_digits] = (cycle_count, fp_values)
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
                    for d in range(min_digits, max_digits + 1):
                        cycle_count, fp_values = results[b][d]
                        num_fps = len(fp_values)
                        summary_writer.writerow([b, d, cycle_count, num_fps])
                        if fp_values:
                            fp_writer.writerow([b, d, ','.join(map(str, fp_values))])

                    summary_file.flush()
                    fp_file.flush()
                    bases_written.add(b)

    finally:
        summary_file.close()
        fp_file.close()

    elapsed_total = time.time() - start_time
    mins = int(elapsed_total // 60)
    secs = int(elapsed_total % 60)

    final_progress = format_large_number_pair(total_multisets, total_multisets)
    print(f"\r{' ' * 120}\rCompleted: {final_progress} multisets (100.0%) - {mins}m {secs}s")
    print(f"\nOutput: {summary_filename}")
    print(f"Output: {fp_filename}")


if __name__ == "__main__":
    main()
