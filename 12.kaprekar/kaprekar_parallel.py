#!/usr/bin/env python3

import sys
import csv
import time
import argparse
import os
from pathlib import Path
from multiprocessing import Pool, Manager
from kaprekar_lib import (
    analyze_number, generate_digit_multisets,
    digits_to_num
)


def process_base_digit_pair(args):
    """
    Worker function to process a single (base, digits) combination.
    Returns a tuple: (base, num_digits, cycle_count, fixed_point_values_sorted)
    """
    base, num_digits = args

    # Track fixed points and cycles for this combination
    fixed_point_ids = {}  # Maps fixed point value to its ID
    next_fp_id = 1
    cycle_count = 0
    memo = {}  # Memoization for efficiency

    # Use digit equivalence classes for optimization
    # Iterate through unique digit multisets instead of all numbers
    for digit_multiset, perm_count in generate_digit_multisets(num_digits, base):
        # The first Kaprekar step is the same for all permutations of these digits
        # So we only need to analyze once, then multiply the count
        digits_list = list(digit_multiset)
        # Compute first Kaprekar step
        max_digits_sorted = sorted(digits_list, reverse=True)
        min_digits_sorted = sorted(digits_list)
        first_step_result = digits_to_num(max_digits_sorted, base) - digits_to_num(min_digits_sorted, base)

        # Now analyze from this point
        result_type, final_value, path = analyze_number(first_step_result, num_digits, base, memo)

        if result_type == 'fixed_point':
            # Fixed point reached
            if final_value not in fixed_point_ids:
                fixed_point_ids[final_value] = next_fp_id
                next_fp_id += 1
            # Note: we're not tracking counts per FP anymore for simplicity
        else:  # cycle
            cycle_count += perm_count

    # Count non-degenerate fixed points (exclude 0)
    non_degenerate_fp_values = sorted([fp for fp in fixed_point_ids.keys() if fp != 0])

    return (base, num_digits, cycle_count, non_degenerate_fp_values)


def main():
    parser = argparse.ArgumentParser(description='Generate Kaprekar summary data in parallel')
    parser.add_argument('--min-base', type=int, default=2, help='Minimum base (default: 2)')
    parser.add_argument('--max-base', type=int, required=True, help='Maximum base')
    parser.add_argument('--min-digits', type=int, default=2, help='Minimum digits (default: 2)')
    parser.add_argument('--max-digits', type=int, required=True, help='Maximum digits')
    parser.add_argument('--cpu-cores', type=int, default=1, help='Number of CPU cores to use (default: 1)')
    parser.add_argument('--data-dir', type=str, default='.', help='Output directory (default: current directory)')

    args = parser.parse_args()

    min_base = args.min_base
    max_base = args.max_base
    min_digits = args.min_digits
    max_digits = args.max_digits
    cpu_cores = args.cpu_cores
    data_dir = Path(args.data_dir)

    # Validate inputs
    if min_base < 2:
        print("Error: Min base must be at least 2")
        sys.exit(1)

    if max_base < min_base:
        print("Error: Max base must be >= min base")
        sys.exit(1)

    if min_digits < 2:
        print("Error: Min digits must be at least 2")
        sys.exit(1)

    if max_digits < min_digits:
        print("Error: Max digits must be >= min digits")
        sys.exit(1)

    if cpu_cores < 1:
        print("Error: CPU cores must be at least 1")
        sys.exit(1)

    # Create output directories
    csv_dir = data_dir / 'csv'
    png_dir = data_dir / 'png'
    csv_dir.mkdir(parents=True, exist_ok=True)
    png_dir.mkdir(parents=True, exist_ok=True)

    # Generate output filenames
    summary_filename = csv_dir / f'kaprekar_summary_base{min_base}-{max_base}_digits{min_digits}-{max_digits}.csv'
    fp_filename = csv_dir / f'kaprekar_fp_base{min_base}-{max_base}_digits{min_digits}-{max_digits}.csv'

    # Generate all (base, digits) pairs to process
    tasks = []
    for base in range(min_base, max_base + 1):
        for num_digits in range(min_digits, max_digits + 1):
            tasks.append((base, num_digits))

    total_tasks = len(tasks)

    print(f"Processing {total_tasks} base-digit pairs using {cpu_cores} CPU core(s)")
    print(f"Output: {summary_filename}")
    print(f"Output: {fp_filename}")

    start_time = time.time()
    last_update_time = start_time

    # Dictionary to store results: {base: {digits: (cycle_count, fp_values)}}
    results = {}
    for base in range(min_base, max_base + 1):
        results[base] = {}

    # Track which bases are complete and which have been written
    bases_complete = set()
    bases_written = set()

    completed_tasks = 0

    # Open CSV files for writing (will write incrementally)
    summary_file = open(summary_filename, 'w', newline='')
    fp_file = open(fp_filename, 'w', newline='')

    summary_writer = csv.writer(summary_file)
    fp_writer = csv.writer(fp_file)

    # Write headers
    summary_writer.writerow(['base', 'digits', 'num_cycles', 'fixed_points'])
    fp_writer.writerow(['base', 'digits', 'fixed_point_values'])

    try:
        # Create a pool of workers
        with Pool(processes=cpu_cores) as pool:
            # Submit all tasks asynchronously
            for result in pool.imap_unordered(process_base_digit_pair, tasks):
                base, num_digits, cycle_count, fp_values = result

                # Store the result
                results[base][num_digits] = (cycle_count, fp_values)

                completed_tasks += 1

                # Update progress (limit updates to once per second)
                current_time = time.time()
                if current_time - last_update_time >= 1.0:
                    elapsed = int(current_time - start_time)
                    elapsed_mins = elapsed // 60
                    elapsed_secs = elapsed % 60
                    progress_pct = (completed_tasks / total_tasks) * 100
                    print(f"\rProcessing base-digit pairs: {completed_tasks}/{total_tasks} ({progress_pct:.1f}%) - Elapsed: {elapsed_mins}m {elapsed_secs}s", end='', flush=True)
                    last_update_time = current_time

                # Check if this base is now complete
                if len(results[base]) == (max_digits - min_digits + 1):
                    bases_complete.add(base)

                # Write any bases that are complete and writable (all lower bases written)
                for b in sorted(bases_complete):
                    if b in bases_written:
                        continue

                    # Check if all lower bases have been written
                    can_write = True
                    for lower_base in range(min_base, b):
                        if lower_base not in bases_written:
                            can_write = False
                            break

                    if can_write:
                        # Write all rows for this base
                        for d in range(min_digits, max_digits + 1):
                            cycle_count, fp_values = results[b][d]
                            num_fps = len(fp_values)

                            # Write summary row
                            summary_writer.writerow([b, d, cycle_count, num_fps])

                            # Write fixed point values if any
                            if fp_values:
                                fp_writer.writerow([b, d, ','.join(map(str, fp_values))])

                        # Flush to disk
                        summary_file.flush()
                        fp_file.flush()

                        bases_written.add(b)

    finally:
        summary_file.close()
        fp_file.close()

    elapsed_total = time.time() - start_time
    mins = int(elapsed_total // 60)
    secs = int(elapsed_total % 60)

    print(f"\n\nSummary data written to {summary_filename}")
    print(f"Fixed point values written to {fp_filename}")
    print(f"Total elapsed time: {mins}m {secs}s")


if __name__ == "__main__":
    main()
