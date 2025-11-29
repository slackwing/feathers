#!/usr/bin/env python3
"""Manual test script without tree-sitter dependency.

This tests the calculation logic directly.
"""

from sxiva.calculator import CalculationState, BlockPoints, PointCalculator


def test_calculation_logic():
    """Test the point calculation logic."""
    calc = PointCalculator()

    print("=" * 70)
    print("SXIVA Point Calculation Tests")
    print("=" * 70)

    # Test 1: Basic calculation from INSTRUCTIONS.md line 53
    # 13:48 - [wr] brainstorm [3] - [err] take out recycling [3] - [err] text taylor [3] --- 14:02 (-2
    print("\nTest 1: First block, 14 minutes duration")
    print("  13:48 -> 14:02 (14 minutes)")
    print("  Expected end: 13:48 + 12min = 14:00")
    print("  Base: 14:00 - 14:02 = -2")
    state = CalculationState()
    points = calc.calculate_block_points("13:48", "14:02", ['wr', 'err', 'err'], state)
    print(f"  Result: base={points.base}, focus={points.focus}, acc={points.accumulation}")
    print(f"  Total: {points.total}, Notation: {points.expected}")
    assert points.base == -2, f"Expected -2, got {points.base}"
    assert points.focus == 0  # No focus set yet
    assert points.accumulation == 1  # First block starts at +1a
    assert points.total == -1  # -2 + 0 + 1 = -1
    print("  ✓ Pass\n")

    # Test 2: With focus categories (from line 66)
    # {focus: [wr], [err]}
    # 13:48 - [wr] brainstorm [3] - [err] take out recycling [3] - [err] text taylor [3] --- 14:02 (-2,+2f
    print("Test 2: Same block but with focus on [wr] and [err]")
    state = CalculationState()
    state.focus_categories = {'wr', 'err'}
    points = calc.calculate_block_points("13:48", "14:02", ['wr', 'err', 'err'], state)
    unique_focus = len(set(['wr', 'err', 'err']) & {'wr', 'err'})
    print(f"  Categories: wr, err, err")
    print(f"  Unique focus cats: {unique_focus} (wr, err)")
    print(f"  Focus points: +{unique_focus}f")
    print(f"  Result: base={points.base}, focus={points.focus}, acc={points.accumulation}")
    print(f"  Total: {points.total}, Notation: {points.expected}")
    assert points.base == -2
    assert points.focus == 2  # +1f for wr, +1f for err (unique)
    assert points.accumulation == 1
    assert points.total == 1  # -2 + 2 + 1 = 1
    print("  ✓ Pass\n")

    # Test 3: Second block (from line 67)
    # 14:00 - [err] look up flights ~--- 14:13 (+1,+1f,+2a=5)
    print("Test 3: Second block with accumulation increment")
    state = CalculationState()
    state.focus_categories = {'wr', 'err'}
    state.previous_end_time = "14:02"
    state.accumulation = 2  # After first block: was 1, then +1 = 2
    points = calc.calculate_block_points("14:00", "14:13", ['err'], state)
    print(f"  Previous end: 14:02")
    print(f"  Expected end: 14:02 + 12min = 14:14")
    print(f"  Base: 14:14 - 14:13 = +1")
    print(f"  Result: base={points.base}, focus={points.focus}, acc={points.accumulation}")
    print(f"  Total: {points.total}, Notation: {points.expected}")
    assert points.base == 1
    assert points.focus == 1  # +1f for err
    assert points.accumulation == 2  # Accumulation from previous block
    assert points.total == 4  # 1 + 1 + 2 = 4
    print("  ✓ Pass\n")

    # Test 4: Accumulation update - with focus
    print("Test 4: Accumulation increments when focus present")
    state = CalculationState()
    state.focus_categories = {'wr'}
    state.accumulation = 5
    calc.update_accumulation(state, has_focus=True, is_x_block=False)
    print(f"  Before: accumulation = 5")
    print(f"  After (with focus): accumulation = {state.accumulation}")
    assert state.accumulation == 6  # 5 + 1 = 6
    print("  ✓ Pass\n")

    # Test 5: Accumulation update - without focus
    print("Test 5: Accumulation resets when no focus")
    state = CalculationState()
    state.accumulation = 5
    calc.update_accumulation(state, has_focus=False, is_x_block=False)
    print(f"  Before: accumulation = 5")
    print(f"  After (no focus): accumulation = {state.accumulation}")
    assert state.accumulation == 1  # Reset to +1a
    print("  ✓ Pass\n")

    # Test 6: Accumulation wraps at 10
    print("Test 6: Accumulation wraps from 10 to 1")
    state = CalculationState()
    state.focus_categories = {'wr'}
    state.accumulation = 10
    calc.update_accumulation(state, has_focus=True, is_x_block=False)
    print(f"  Before: accumulation = 10")
    print(f"  After (with focus): accumulation = {state.accumulation}")
    assert state.accumulation == 1  # Wraps to 1
    print("  ✓ Pass\n")

    # Test 7: x-block resets accumulation
    print("Test 7: x-block resets accumulation")
    state = CalculationState()
    state.accumulation = 7
    calc.update_accumulation(state, has_focus=True, is_x_block=True)
    print(f"  Before: accumulation = 7")
    print(f"  After (x-block): accumulation = {state.accumulation}")
    assert state.accumulation == 1  # Reset to +1a
    print("  ✓ Pass\n")

    # Test 8: Time duration calculation
    print("Test 8: Time duration calculation")
    duration = calc.calculate_duration("09:00", "10:30")
    print(f"  09:00 to 10:30 = {duration} minutes")
    assert duration == 90
    print("  ✓ Pass\n")

    # Test 9: Points notation parsing
    print("Test 9: Points notation parsing")
    total = calc.parse_points_notation("(-2,+2f,+1a=1)")
    print(f"  '(-2,+2f,+1a=1)' -> {total}")
    assert total == 1
    total = calc.parse_points_notation("(0)")
    print(f"  '(0)' -> {total}")
    assert total == 0
    total = calc.parse_points_notation("(-5)")
    print(f"  '(-5)' -> {total}")
    assert total == -5
    total = calc.parse_points_notation("(+1,+1f,+2a=4)")
    print(f"  '(+1,+1f,+2a=4)' -> {total}")
    assert total == 4
    print("  ✓ Pass\n")

    print("=" * 70)
    print("All tests passed! ✓")
    print("=" * 70)


if __name__ == '__main__':
    test_calculation_logic()
