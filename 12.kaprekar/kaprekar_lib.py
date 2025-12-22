#!/usr/bin/env python3
"""
Common utility functions for Kaprekar analysis.
"""


def split_digits(num, expected_digits, base):
    """
    Given an integer, checks that it has the expected number of digits OR less,
    and splits the digits into an array (in the given base). Pads with leading zeros if needed.

    Args:
        num: The integer to split
        expected_digits: The expected number of digits
        base: The base to use for digit extraction

    Returns:
        List of individual digits as integers, or None if validation fails
    """
    digits = []
    temp = num

    # Extract digits in the given base
    if temp == 0:
        digits = [0]
    else:
        while temp > 0:
            digits.insert(0, temp % base)
            temp //= base

    if len(digits) > expected_digits:
        return None

    # Pad with leading zeros if needed
    while len(digits) < expected_digits:
        digits.insert(0, 0)

    return digits


def digits_to_num(digits, base):
    """
    Convert a list of digits in a given base to an integer.

    Args:
        digits: List of digit values
        base: The base to use

    Returns:
        Integer value
    """
    result = 0
    for digit in digits:
        result = result * base + digit
    return result


def kaprekar_step(num, num_digits, base):
    """
    Perform one step of the Kaprekar routine.

    Args:
        num: The current number
        num_digits: The number of digits to use
        base: The base to use

    Returns:
        The result of one Kaprekar step (max - min)
    """
    # Split digits
    digits = split_digits(num, num_digits, base)

    # Create max number (descending sort)
    max_digits_sorted = sorted(digits, reverse=True)
    max_num_val = digits_to_num(max_digits_sorted, base)

    # Create min number (ascending sort)
    min_digits_sorted = sorted(digits)
    min_num_val = digits_to_num(min_digits_sorted, base)

    # Calculate difference
    return max_num_val - min_num_val


def analyze_number(start_num, num_digits, base, memo=None):
    """
    Analyze a single number through the Kaprekar routine.

    Args:
        start_num: The starting number
        num_digits: The number of digits to use
        base: The base to use
        memo: Optional dict for memoization {number: (result_type, final_value)}
            For cycles: final_value is the lowest number in the cycle (canonical ID)

    Returns:
        tuple: (result_type, final_value, path)
            result_type: 'fixed_point' or 'cycle'
            final_value: the fixed point value, or the canonical cycle ID (minimum in cycle)
            path: list of values in the iteration path
    """
    current = start_num
    seen = set()
    path = []

    while True:
        # Check memo if available
        if memo is not None and current in memo:
            cached_type, cached_value = memo[current]

            # For cycles: use the minimum of cached ID and current path
            if cached_type == 'cycle' and path:
                cycle_id = min(cached_value, min(path))
                # Update memo for all numbers in current path with the better (lower) ID
                for num in path:
                    memo[num] = ('cycle', cycle_id)
                return (cached_type, cycle_id, path)
            else:
                return (cached_type, cached_value, path)

        diff = kaprekar_step(current, num_digits, base)

        # Check if we've reached a fixed point
        if diff == current:
            result = ('fixed_point', current, path)
            # Memoize all numbers in the path
            if memo is not None:
                for num in path:
                    memo[num] = ('fixed_point', current)
                memo[start_num] = ('fixed_point', current)
            return result

        # Check if we've seen this number (cycle detection)
        if diff in seen:
            # Cycle detected: use minimum number in the entire cycle as canonical ID
            # The cycle consists of all numbers from where we detected it back to the start
            cycle_start_idx = path.index(diff)
            cycle_numbers = path[cycle_start_idx:] + [diff]
            cycle_id = min(cycle_numbers)

            result = ('cycle', cycle_id, path)
            # Memoize all numbers in the path with the canonical cycle ID
            if memo is not None:
                for num in path:
                    memo[num] = ('cycle', cycle_id)
                memo[start_num] = ('cycle', cycle_id)
            return result

        seen.add(current)
        path.append(current)

        # Move to next iteration
        current = diff


def count_digit_multisets(num_digits, base):
    """
    Count the number of unique digit multisets (without generating them).
    This is C(n+k-1, k) where n=base, k=num_digits.

    Args:
        num_digits: Number of digits
        base: The base to use (digits range from 0 to base-1)

    Returns:
        int: The count of unique multisets
    """
    from math import comb
    return comb(base + num_digits - 1, num_digits)


def generate_digit_multisets(num_digits, base):
    """
    Generate all unique digit multisets for a given number of digits and base.

    Args:
        num_digits: Number of digits
        base: The base to use (digits range from 0 to base-1)

    Yields:
        tuple: (digit_tuple, count) where digit_tuple is sorted digits and count is how many numbers have those digits
    """
    from itertools import combinations_with_replacement
    from math import factorial

    # Generate all unique combinations (multisets)
    for combo in combinations_with_replacement(range(base), num_digits):
        # Count how many permutations this multiset has
        # This uses the multinomial coefficient formula
        digit_counts = {}
        for digit in combo:
            digit_counts[digit] = digit_counts.get(digit, 0) + 1

        # Calculate multinomial coefficient: n! / (n1! * n2! * ... * nk!)
        count = factorial(num_digits)
        for freq in digit_counts.values():
            count //= factorial(freq)

        yield (combo, count)


def generate_digit_multisets_modulo(num_digits, base, chunk_id, total_chunks):
    """
    Generate every Nth multiset for parallelization using modulo arithmetic.
    Worker chunk_id processes multisets where (index % total_chunks) == chunk_id.

    This ensures perfect load balancing: each worker processes ~(total/chunks) multisets.

    Args:
        num_digits: Number of digits
        base: The base to use
        chunk_id: Which chunk this worker handles (0 to total_chunks-1)
        total_chunks: Total number of parallel workers

    Yields:
        tuple: (digit_tuple, count) where digit_tuple is sorted digits
    """
    from itertools import combinations_with_replacement
    from math import factorial

    idx = 0
    for combo in combinations_with_replacement(range(base), num_digits):
        # Only yield multisets assigned to this chunk
        if idx % total_chunks == chunk_id:
            digit_counts = {}
            for digit in combo:
                digit_counts[digit] = digit_counts.get(digit, 0) + 1

            count = factorial(num_digits)
            for freq in digit_counts.values():
                count //= factorial(freq)

            yield (combo, count)

        idx += 1


def generate_digit_multisets_range(num_digits, base, start_idx, end_idx):
    """
    Generate multisets in a contiguous range [start_idx, end_idx) for chunk-based parallelization.
    This allows creating many small chunks that can be distributed round-robin to workers,
    reducing load imbalance compared to modulo distribution.

    Args:
        num_digits: Number of digits
        base: The base to use (digits range from 0 to base-1)
        start_idx: Starting index (inclusive)
        end_idx: Ending index (exclusive)

    Yields:
        tuple: (digit_tuple, count) where digit_tuple is sorted digits
    """
    from itertools import combinations_with_replacement, islice
    from math import factorial

    # Use islice to efficiently skip to start_idx and stop at end_idx
    for combo in islice(combinations_with_replacement(range(base), num_digits), start_idx, end_idx):
        digit_counts = {}
        for digit in combo:
            digit_counts[digit] = digit_counts.get(digit, 0) + 1

        count = factorial(num_digits)
        for freq in digit_counts.values():
            count //= factorial(freq)

        yield (combo, count)


def num_to_base_string(num, base, num_digits):
    """
    Convert a number to its string representation in a given base.
    Uses 0-9 and A-Z for bases up to 36.

    Args:
        num: The number to convert
        base: The base to use
        num_digits: The number of digits (for padding)

    Returns:
        String representation in the given base
    """
    if num == 0:
        return '0' * num_digits

    digits = []
    temp = num
    while temp > 0:
        digit = temp % base
        if digit < 10:
            digits.insert(0, str(digit))
        else:
            digits.insert(0, chr(ord('A') + digit - 10))
        temp //= base

    # Pad with leading zeros
    while len(digits) < num_digits:
        digits.insert(0, '0')

    return ''.join(digits)
