#!/usr/bin/env python3

import sys
import argparse
import re
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import math


def parse_filename(filename):
    """
    Parse a filename like 'kaprekar_summary_base2-10_digits2-8.csv'
    Returns: (file_type, min_base, max_base, min_digits, max_digits) or None
    """
    pattern = r'kaprekar_(summary|fp|cycles)_base(\d+)-(\d+)_digits(\d+)-(\d+)\.csv'
    match = re.match(pattern, filename)
    if match:
        file_type = match.group(1)
        min_base = int(match.group(2))
        max_base = int(match.group(3))
        min_digits = int(match.group(4))
        max_digits = int(match.group(5))
        return (file_type, min_base, max_base, min_digits, max_digits)
    return None


def discover_csv_files(csv_dir):
    """
    Discover all kaprekar CSV files in the directory.
    Returns: dict with 'summary', 'fp', and 'cycles' keys, each containing list of (filepath, metadata) tuples
    """
    files = {'summary': [], 'fp': [], 'cycles': []}

    for filepath in csv_dir.glob('kaprekar_*.csv'):
        parsed = parse_filename(filepath.name)
        if parsed:
            file_type, min_base, max_base, min_digits, max_digits = parsed
            files[file_type].append((filepath, min_base, max_base, min_digits, max_digits))

    return files


def load_and_merge_csvs(files, file_type):
    """
    Load and merge multiple CSV files of the same type.
    Returns: merged DataFrame and list of warnings about overlaps

    For 'cycles' files: uses the LOWER unique_cycle_ids count when collisions occur
    """
    if not files:
        return None, []

    warnings = []
    all_data = {}  # key: (base, digits), value: row_data

    for filepath, min_base, max_base, min_digits, max_digits in files:
        print(f"Reading {filepath.name}...", end='', flush=True)
        try:
            df = pd.read_csv(filepath)
            print(f" ({len(df)} rows)")
        except pd.errors.EmptyDataError:
            print(" (empty, skipping)")
            continue

        for _, row in df.iterrows():
            base = int(row['base'])
            digits = int(row['digits'])
            key = (base, digits)

            if key in all_data:
                # Check for consistency
                existing_row = all_data[key]
                if file_type == 'summary':
                    if (existing_row['num_cycles'] != row['num_cycles'] or
                        existing_row['fixed_points'] != row['fixed_points']):
                        warnings.append(
                            f"Inconsistent data for base={base}, digits={digits}: "
                            f"cycles={existing_row['num_cycles']} vs {row['num_cycles']}, "
                            f"fps={existing_row['fixed_points']} vs {row['fixed_points']}"
                        )
                elif file_type == 'fp':
                    if existing_row['fixed_point_values'] != row['fixed_point_values']:
                        warnings.append(
                            f"Inconsistent fixed points for base={base}, digits={digits}: "
                            f"{existing_row['fixed_point_values']} vs {row['fixed_point_values']}"
                        )
                elif file_type == 'cycles':
                    # For cycles: use the LOWER unique_cycle_ids count
                    existing_count = int(existing_row['unique_cycle_ids'])
                    new_count = int(row['unique_cycle_ids'])
                    if new_count < existing_count:
                        all_data[key] = row.to_dict()
                    continue  # Don't overwrite unless new is lower

            # Store (last occurrence wins for overlaps, except cycles which uses min)
            if key not in all_data or file_type != 'cycles':
                all_data[key] = row.to_dict()

    # Convert back to DataFrame
    if all_data:
        merged_df = pd.DataFrame(list(all_data.values()))
        return merged_df, warnings
    else:
        return None, warnings


def main():
    parser = argparse.ArgumentParser(description='Plot Kaprekar data from multiple CSV files')
    parser.add_argument('--data-dir', type=str, default='.', help='Data directory (default: current directory)')
    parser.add_argument('--no-display', action='store_true', help='Do not display the plot window')

    args = parser.parse_args()
    data_dir = Path(args.data_dir)
    csv_dir = data_dir / 'csv'
    png_dir = data_dir / 'png'

    # Check if csv directory exists
    if not csv_dir.exists():
        print(f"Error: CSV directory not found: {csv_dir}")
        sys.exit(1)

    # Ensure png directory exists
    png_dir.mkdir(parents=True, exist_ok=True)

    print("Discovering CSV files...")
    files = discover_csv_files(csv_dir)

    if not files['summary']:
        print(f"Error: No summary CSV files found in {csv_dir}")
        sys.exit(1)

    print(f"Found {len(files['summary'])} summary file(s), {len(files['fp'])} fixed point file(s), and {len(files['cycles'])} cycles file(s)")

    # Load and merge CSVs
    print("\nMerging summary data...")
    df_summary, summary_warnings = load_and_merge_csvs(files['summary'], 'summary')

    print("Merging fixed point data...")
    df_fp, fp_warnings = load_and_merge_csvs(files['fp'], 'fp')

    print("Merging cycles data...")
    df_cycles, cycles_warnings = load_and_merge_csvs(files['cycles'], 'cycles')

    # Print warnings
    all_warnings = summary_warnings + fp_warnings + cycles_warnings
    if all_warnings:
        print("\nWARNINGS:")
        for warning in all_warnings:
            print(f"  - {warning}")

    if df_summary is None:
        print("Error: No data loaded")
        sys.exit(1)

    # Calculate statistics for filename
    min_base = int(df_summary['base'].min())
    max_base = int(df_summary['base'].max())
    min_digits = int(df_summary['digits'].min())
    max_digits = int(df_summary['digits'].max())
    num_combos = len(df_summary)

    print(f"\nCombined data: base {min_base}-{max_base}, digits {min_digits}-{max_digits}, {num_combos} combinations")

    # Generate output filename
    output_filename = png_dir / f'kaprekar_base{min_base}-{max_base}_digits{min_digits}-{max_digits}_{num_combos}.png'

    # Create the plot (adapted from kaprekar_summary2.py)
    print("\nCreating plot...", end='', flush=True)
    fig, ax = plt.subplots(figsize=(20, 16))

    marker_size = 300

    # Get aspect ratio to calculate proper 45-degree angles
    ax.set_aspect('equal', adjustable='box')

    # Plot each base+digit combination
    for idx, row in df_summary.iterrows():
        x = row['digits'] * 3  # 3x spacing
        y = row['base'] * 2  # Double the y-axis scale
        cycles = int(row['num_cycles'])
        fps = int(row['fixed_points'])

        # Check if we have unique cycle ID data for this base-digit pair
        base_val = int(row['base'])
        digits_val = int(row['digits'])
        unique_cycle_count = None
        if df_cycles is not None:
            cycles_row = df_cycles[(df_cycles['base'] == base_val) & (df_cycles['digits'] == digits_val)]
            if not cycles_row.empty:
                unique_cycle_count = int(cycles_row['unique_cycle_ids'].iloc[0])

        # Determine if there's only 1 fixed point and no cycles (special green case)
        is_special = (fps == 1 and cycles == 0)
        edge_color = 'black'
        radius = 0.15

        # Draw circles based on cycles
        if is_special:
            # Special case: green filled circle (no border)
            ax.scatter(x, y, s=marker_size, c='green', edgecolors='none', linewidths=0, zorder=3)
        elif cycles > 0:
            # Has cycles: draw solid circle
            ax.scatter(x, y, s=marker_size, c='white', edgecolors=edge_color, linewidths=2, zorder=3)

            # If no fixed points, show cycle count above circle in scientific notation
            # Use unique_cycle_count if available, otherwise use cycles count
            if fps == 0:
                display_count = unique_cycle_count if unique_cycle_count is not None else cycles
                # Format as scientific notation with 1 digit precision
                if display_count < 10:
                    cycle_text = str(display_count)
                else:
                    exponent = int(math.floor(math.log10(display_count)))
                    mantissa = display_count / (10 ** exponent)
                    cycle_text = f"${mantissa:.1f} \\times 10^{{{exponent}}}$"

                ax.text(x, y + radius * 4, cycle_text, fontsize=7, ha='center', va='center', zorder=7, weight='bold', color='gray')
        # else: no cycles and not special -> draw nothing (just the lines for fixed points)

        # Overlay lines for fixed points - overlay them like a counter

        if fps >= 5:
            # Solid black circle for 5+
            ax.scatter(x, y, s=marker_size, c='black', edgecolors=edge_color, linewidths=2, zorder=6)
        else:
            # Draw lines based on count (overlay them)
            if fps >= 1:
                # Horizontal line
                ax.plot([x - radius, x + radius], [y, y], 'k-', linewidth=2, zorder=5)
            if fps >= 2:
                # Vertical line
                ax.plot([x, x], [y - radius, y + radius], 'k-', linewidth=2, zorder=5)
            if fps >= 3:
                # Diagonal line at 45 degrees (bottom-left to top-right)
                ax.plot([x - radius, x + radius], [y - radius, y + radius], 'k-', linewidth=2, zorder=5)
            if fps >= 4:
                # Diagonal line at 45 degrees (top-left to bottom-right)
                ax.plot([x - radius, x + radius], [y + radius, y - radius], 'k-', linewidth=2, zorder=5)

        # Add fixed point number annotations (up to 4)
        if df_fp is not None:
            fp_row = df_fp[(df_fp['base'] == base_val) & (df_fp['digits'] == digits_val)]

            if not fp_row.empty and fps > 0 and fps <= 4:
                # Parse the fixed point values
                fp_values_str = fp_row['fixed_point_values'].iloc[0]
                # Handle both string and numeric types
                if isinstance(fp_values_str, str):
                    fp_nums = [int(v) for v in fp_values_str.split(',')]
                else:
                    # Single numeric value, not a string with commas
                    fp_nums = [int(fp_values_str)]

                positions = [
                    (x + radius * 2.1, y + radius * 1.05, 'left', 'bottom'),   # Upper right (1st FP)
                    (x + radius * 2.1, y - radius * 1.05, 'left', 'top'),      # Lower right (2nd FP)
                    (x - radius * 2.1, y + radius * 1.05, 'right', 'bottom'),  # Upper left (3rd FP)
                    (x - radius * 2.1, y - radius * 1.05, 'right', 'top'),     # Lower left (4th FP)
                ]

                # For 8+ digits, only show first 2 FPs (right side), otherwise show up to 4
                max_fps_to_show = 2 if digits_val >= 8 else 4

                for i, fp_num in enumerate(fp_nums[:max_fps_to_show]):
                    px, py, ha, va = positions[i]
                    text_color = 'green' if (is_special and i == 0) else 'black'

                    # Display the decimal number
                    text = str(int(fp_num))
                    ax.text(px, py, text,
                            fontsize=7, ha=ha, va=va, zorder=7, weight='bold', color=text_color)

                    # For green ones (single FP, no cycles), add base representation above if base <= 16
                    if is_special and i == 0 and base_val <= 16:
                        # Convert to base representation
                        from kaprekar_lib import num_to_base_string
                        base_repr = num_to_base_string(fp_num, base_val, digits_val)
                        # Position it above the decimal number in blue
                        py_above = py + 0.28 if va == 'bottom' else py - 0.28
                        ax.text(px, py_above, base_repr,
                                fontsize=7, ha=ha, va=va, zorder=7, weight='bold', color='blue')

    print(" done")

    # Create legend
    legend_elements = [
        mpatches.Patch(facecolor='white', edgecolor='black', label='Circle: has cycles'),
        mpatches.Patch(facecolor='none', edgecolor='black', label='Gray number: unique cycle IDs (if available)'),
        mpatches.Patch(facecolor='none', edgecolor='black', label='Horizontal line: 1 fixed point'),
        mpatches.Patch(facecolor='none', edgecolor='black', label='Vertical line: 2 fixed points'),
        mpatches.Patch(facecolor='none', edgecolor='black', label='Diagonal /: 3 fixed points'),
        mpatches.Patch(facecolor='none', edgecolor='black', label='Diagonal \\: 4 fixed points'),
        mpatches.Patch(facecolor='black', edgecolor='black', label='Solid black: 5+ fixed points'),
        mpatches.Patch(facecolor='green', edgecolor='black', label='Green: 1 FP, no cycles'),
    ]

    ax.set_xlabel('Number of Digits', fontsize=12)
    ax.set_ylabel('Base', fontsize=12)
    ax.set_title(f'Kaprekar Summary: Fixed Points and Cycles by Base and Digit Count ({num_combos} combinations)', fontsize=14)
    ax.legend(handles=legend_elements, bbox_to_anchor=(1.05, 1), loc='upper left', fontsize=9)
    ax.grid(True, alpha=0.3)

    # Set integer ticks (accounting for 3x and 2x spacing)
    # Use actual data range for ticks
    digit_values = sorted(df_summary['digits'].unique())
    base_values = sorted(df_summary['base'].unique())

    ax.set_xticks([d * 3 for d in digit_values])
    ax.set_xticklabels(digit_values)
    ax.set_yticks([b * 2 for b in base_values])
    ax.set_yticklabels(base_values)

    # Save the plot
    print(f"Saving plot to {output_filename}...", end='', flush=True)
    plt.tight_layout()
    plt.savefig(output_filename, dpi=150, bbox_inches='tight')
    print(" done")
    print(f"Plot saved as {output_filename}")

    if not args.no_display:
        print("Displaying plot (close the window when done)...")
        plt.show()


if __name__ == "__main__":
    main()
