#!/usr/bin/env python3

import sys
import csv
import time
from kaprekar_lib import split_digits, digits_to_num, analyze_number


def main():
    max_base = int(input("Enter max base: "))
    max_digits = int(input("Enter max digits: "))

    # Validate inputs
    if max_base < 2:
        print("Error: Base must be at least 2")
        sys.exit(1)

    if max_digits < 2:
        print("Error: Max digits must be at least 2")
        sys.exit(1)

    # Calculate total numbers to process
    total_numbers = 0
    for base in range(2, max_base + 1):
        for num_digits in range(2, max_digits + 1):
            total_numbers += base ** num_digits

    numbers_processed = 0
    start_time = time.time()
    last_update_time = start_time

    # Open CSV file for writing
    with open('kaprekar_data.csv', 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['base', 'digits', 'number', 'y_value', 'z_value'])

        # Iterate through all bases and digit counts
        for base in range(2, max_base + 1):
            for num_digits in range(2, max_digits + 1):
                # Track fixed points for this base+digits combination
                fixed_point_ids = {}  # Maps fixed point value to its ID
                next_fp_id = 1
                memo = {}  # Memoization for efficiency

                max_num = base ** num_digits

                # Calculate y-value for this base+digits combination
                y_value = base - 0.1 * num_digits + 0.2

                # Iterate through all numbers
                for start_num in range(max_num):
                    numbers_processed += 1

                    # Update progress periodically (check every 10000 numbers, print if >0.1 sec elapsed)
                    if numbers_processed % 10000 == 0:
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

                    # Analyze this number
                    result_type, final_value, path = analyze_number(start_num, num_digits, base, memo)

                    if result_type == 'fixed_point':
                        # Fixed point reached
                        if final_value not in fixed_point_ids:
                            fixed_point_ids[final_value] = next_fp_id
                            next_fp_id += 1

                        z_value = fixed_point_ids[final_value]
                        writer.writerow([base, num_digits, start_num, y_value, z_value])
                    else:  # cycle
                        z_value = -1
                        writer.writerow([base, num_digits, start_num, y_value, z_value])

    elapsed_total = time.time() - start_time
    mins = int(elapsed_total // 60)
    secs = int(elapsed_total % 60)

    print(f"\n\nCSV data written to kaprekar_data.csv")
    print(f"Total elapsed time: {mins}m {secs}s")


if __name__ == "__main__":
    main()
