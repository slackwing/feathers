#!/usr/bin/env python3

import sys


def split_digits(num, expected_digits):
    """
    Given an integer, checks that it has the expected number of digits OR less,
    and splits the digits into an array. Pads with leading zeros if needed.

    Args:
        num: The integer to split
        expected_digits: The expected number of digits

    Returns:
        List of individual digits as integers, or None if validation fails
    """
    digits = [int(d) for d in str(num)]

    if len(digits) > expected_digits:
        return None

    # Pad with leading zeros if needed
    while len(digits) < expected_digits:
        digits.insert(0, 0)

    return digits


def main():
    num_digits = int(input("Enter number of digits: "))

    # Calculate range
    max_num = 10 ** num_digits

    # Track results
    cycles = {}  # key = lowest number in cycle, value = list of starting numbers
    fixed_points = {}  # key = final number, value = list of starting numbers

    # Iterate through all numbers with that number of digits
    for start_num in range(max_num):
        # Print progress (overwrite same line)
        print(f"\rProcessing: {start_num}/{max_num-1}", end='', flush=True)

        current = start_num
        seen = set()

        # Fixed point iteration
        path = []  # Track the path to identify cycle
        while True:
            # Split digits and sort
            digits = split_digits(current, num_digits)

            # Create max number (descending sort)
            max_digits = sorted(digits, reverse=True)
            max_num_val = int(''.join(map(str, max_digits)))

            # Create min number (ascending sort)
            min_digits = sorted(digits)
            min_num_val = int(''.join(map(str, min_digits)))

            # Calculate difference
            diff = max_num_val - min_num_val

            # Check if we've reached a fixed point
            if diff == current:
                # Fixed point reached
                if current not in fixed_points:
                    fixed_points[current] = []
                fixed_points[current].append(start_num)
                break

            # Check if we've seen this number (cycle detection)
            if diff in seen:
                # This is a cycle - find the cycle members
                cycle_start_idx = path.index(diff)
                cycle_members = path[cycle_start_idx:]
                cycle_id = min(cycle_members)  # Use lowest number as cycle ID

                if cycle_id not in cycles:
                    cycles[cycle_id] = []
                cycles[cycle_id].append(start_num)
                break

            seen.add(current)
            path.append(current)

            # Move to next iteration
            current = diff

    # Output summary
    print(f"\n\nSummary for {num_digits}-digit numbers:")
    print(f"\nFixed points found: {len(fixed_points)}")
    for fp, starts in sorted(fixed_points.items()):
        print(f"  Fixed point {fp}: {len(starts)} starting numbers lead here")

    print(f"\nCycles found: {len(cycles)}")
    for cycle_id, starts in sorted(cycles.items()):
        print(f"  Cycle (min: {cycle_id}): {len(starts)} starting numbers lead here")


if __name__ == "__main__":
    main()
