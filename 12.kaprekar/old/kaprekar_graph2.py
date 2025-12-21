#!/usr/bin/env python3

import sys
import csv
import time
import argparse
from kaprekar_lib import (
    analyze_number, generate_digit_multisets,
    digits_to_num
)


def main():
    parser = argparse.ArgumentParser(description='Generate Kaprekar summary data')
    parser.add_argument('--min-base', type=int, default=2, help='Minimum base (default: 2)')
    parser.add_argument('--max-base', type=int, required=True, help='Maximum base')
    parser.add_argument('--min-digits', type=int, default=2, help='Minimum digits (default: 2)')
    parser.add_argument('--max-digits', type=int, required=True, help='Maximum digits')

    args = parser.parse_args()

    min_base = args.min_base
    max_base = args.max_base
    min_digits = args.min_digits
    max_digits = args.max_digits

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

    # Calculate total numbers to process
    total_numbers = 0
    for base in range(min_base, max_base + 1):
        for num_digits in range(min_digits, max_digits + 1):
            total_numbers += base ** num_digits

    numbers_processed = 0
    start_time = time.time()
    last_update_time = start_time

    # Open CSV files for writing
    with open('kaprekar_summary_data.csv', 'w', newline='') as csvfile, \
         open('kaprekar_fixed_points.csv', 'w', newline='') as fpfile:
        writer = csv.writer(csvfile)
        writer.writerow(['base', 'digits', 'num_cycles', 'fixed_points'])

        fp_writer = csv.writer(fpfile)
        fp_writer.writerow(['base', 'digits', 'fixed_point_values'])

        # Iterate through all bases and digit counts
        for base in range(min_base, max_base + 1):
            for num_digits in range(min_digits, max_digits + 1):
                # Track fixed points and cycles for this combination
                fixed_point_ids = {}  # Maps fixed point value to its ID
                fixed_point_counts = {}  # Maps fixed point value to count of numbers leading to it
                next_fp_id = 1
                cycle_count = 0
                memo = {}  # Memoization for efficiency

                # Use digit equivalence classes for optimization
                # Iterate through unique digit multisets instead of all numbers
                for digit_multiset, perm_count in generate_digit_multisets(num_digits, base):
                    numbers_processed += perm_count

                    # Update progress periodically (check every 10000 numbers, print if >0.1 sec elapsed)
                    if numbers_processed % 10000 < perm_count:  # Just crossed a 10000 boundary
                        current_time = time.time()
                        if current_time - last_update_time >= 0.1:  # At least 0.1 seconds since last update
                            elapsed = current_time - start_time
                            if numbers_processed > 10000:
                                avg_time_per_num = elapsed / numbers_processed
                                remaining_nums = total_numbers - numbers_processed
                                eta_seconds = avg_time_per_num * remaining_nums
                                eta_mins = int(eta_seconds // 60)
                                eta_secs = int(eta_seconds % 60)
                                progress_pct = (numbers_processed / total_numbers) * 100
                                print(f"\rProcessing: base {base}/{max_base}, digits {num_digits}/{max_digits} ({progress_pct:.1f}%) - ETA: {eta_mins}m {eta_secs}s", end='', flush=True)
                                last_update_time = current_time

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
                            fixed_point_counts[final_value] = 0
                            next_fp_id += 1
                        fixed_point_counts[final_value] += perm_count
                    else:  # cycle
                        cycle_count += perm_count

                # Count non-degenerate fixed points (exclude 0)
                non_degenerate_fp_values = [fp for fp in fixed_point_ids.keys() if fp != 0]
                non_degenerate_fps = len(non_degenerate_fp_values)

                # Write summary for this base+digits combination
                writer.writerow([base, num_digits, cycle_count, non_degenerate_fps])

                # Write fixed point values if any
                if non_degenerate_fp_values:
                    # Store as comma-separated list
                    fp_writer.writerow([base, num_digits, ','.join(map(str, sorted(non_degenerate_fp_values)))])

    elapsed_total = time.time() - start_time
    mins = int(elapsed_total // 60)
    secs = int(elapsed_total % 60)

    print(f"\n\nSummary data written to kaprekar_summary_data.csv")
    print(f"Fixed point values written to kaprekar_fixed_points.csv")
    print(f"Total elapsed time: {mins}m {secs}s")


if __name__ == "__main__":
    main()
