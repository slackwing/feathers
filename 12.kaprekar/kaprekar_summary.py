#!/usr/bin/env python3

import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.collections import LineCollection


def main():
    # Read the CSV data
    print("Reading CSV data...", end='', flush=True)
    df = pd.read_csv('kaprekar_data.csv')
    print(" done")

    # Analyze data
    print("Analyzing data...", end='', flush=True)
    max_base = df['base'].max()
    max_digits = df['digits'].max()

    # Calculate statistics for each base+digit combination
    stats = []
    for base in range(2, max_base + 1):
        for num_digits in range(2, max_digits + 1):
            subset = df[(df['base'] == base) & (df['digits'] == num_digits)]

            if subset.empty:
                continue

            # Count cycles (z_value == -1)
            num_cycles = len(subset[subset['z_value'] == -1])

            # Count fixed points (excluding degenerate 0, which is z_value == 1)
            fp_subset = subset[(subset['z_value'] > 0) & (subset['z_value'] != 1)]
            fixed_points = fp_subset['z_value'].nunique()

            # Find all fixed point values (up to 4)
            fp_numbers = []
            if fixed_points > 0 and fixed_points <= 4:
                # Get the actual fixed point values
                from kaprekar_graph import split_digits, digits_to_num

                # For each fixed point ID (starting from 2, since 1 is degenerate 0)
                for fp_id in range(2, min(fixed_points + 2, 6)):  # IDs 2, 3, 4, 5
                    fp_candidates = fp_subset[fp_subset['z_value'] == fp_id]['number'].unique()

                    # Find the actual fixed point
                    for candidate in fp_candidates:
                        digit_array = split_digits(candidate, num_digits, base)
                        if digit_array is not None:
                            max_digits_sorted = sorted(digit_array, reverse=True)
                            min_digits_sorted = sorted(digit_array)
                            max_val = digits_to_num(max_digits_sorted, base)
                            min_val = digits_to_num(min_digits_sorted, base)
                            diff = max_val - min_val
                            if diff == candidate:
                                fp_numbers.append(candidate)
                                break

            stats.append({
                'base': base,
                'digits': num_digits,
                'cycles': num_cycles,
                'fixed_points': fixed_points,
                'fp_numbers': fp_numbers
            })

    stats_df = pd.DataFrame(stats)
    print(" done")

    # Create the plot
    print("Creating summary plot...", end='', flush=True)
    fig, ax = plt.subplots(figsize=(14, 10))

    marker_size = 300

    # Get aspect ratio to calculate proper 45-degree angles
    # We need to account for the data coordinate system
    ax.set_aspect('equal', adjustable='box')

    # Plot each base+digit combination
    for idx, row in stats_df.iterrows():
        x = row['digits'] * 2  # Double the x-spacing
        y = row['base']
        cycles = row['cycles']
        fps = row['fixed_points']

        # Determine if there's only 1 fixed point and no cycles (special green case)
        is_special = (fps == 1 and cycles == 0)
        edge_color = 'black'

        # Draw circles based on cycles
        if is_special:
            # Special case: green filled circle (no border)
            ax.scatter(x, y, s=marker_size, c='green', edgecolors='none', linewidths=0, zorder=3)
        elif cycles > 0:
            # Has cycles: draw circle(s)
            if cycles == 1:
                # Single circle
                ax.scatter(x, y, s=marker_size, c='white', edgecolors=edge_color, linewidths=2, zorder=3)
            else:
                # Double-border circle (2+ cycles)
                ax.scatter(x, y, s=marker_size, c='white', edgecolors=edge_color, linewidths=2, zorder=3)
                ax.scatter(x, y, s=marker_size*0.7, c='none', edgecolors=edge_color, linewidths=2, zorder=4)
        # else: no cycles and not special -> draw nothing (just the lines for fixed points)

        # Overlay lines for fixed points - overlay them like a counter
        # Calculate radius - since aspect is equal, use same value for all
        radius = 0.15

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

        # Add fixed point number annotations
        fp_nums = row['fp_numbers'] if isinstance(row['fp_numbers'], list) else []
        positions = [
            (x + radius * 1.4, y + radius * 0.7, 'left', 'bottom'),   # Upper right (1st FP)
            (x + radius * 1.4, y - radius * 0.7, 'left', 'top'),      # Lower right (2nd FP)
            (x - radius * 1.4, y + radius * 0.7, 'right', 'bottom'),  # Upper left (3rd FP)
            (x - radius * 1.4, y - radius * 0.7, 'right', 'top'),     # Lower left (4th FP)
        ]

        for i, fp_num in enumerate(fp_nums[:4]):  # Only show up to 4
            px, py, ha, va = positions[i]
            text_color = 'green' if (is_special and i == 0) else 'black'

            # Format the text
            text = str(int(fp_num))

            # For green ones (single FP, no cycles), add base representation if base <= 16
            if is_special and i == 0 and row['base'] <= 16:
                # Convert to base representation
                num = int(fp_num)
                base = int(row['base'])
                digits = int(row['digits'])

                # Convert number to base representation
                if num == 0:
                    base_repr = '0' * digits
                else:
                    base_digits = []
                    temp = num
                    while temp > 0:
                        digit = temp % base
                        if digit < 10:
                            base_digits.insert(0, str(digit))
                        else:
                            base_digits.insert(0, chr(ord('A') + digit - 10))
                        temp //= base

                    # Pad with leading zeros
                    while len(base_digits) < digits:
                        base_digits.insert(0, '0')

                    base_repr = ''.join(base_digits)

                text = f"{text} ({base_repr})"

            ax.text(px, py, text,
                    fontsize=7, ha=ha, va=va, zorder=7, weight='bold', color=text_color)

    print(" done")

    # Create legend
    legend_elements = [
        mpatches.Patch(facecolor='white', edgecolor='black', label='Single-border: 1 cycle'),
        mpatches.Patch(facecolor='white', edgecolor='black', label='Double-border: 2+ cycles'),
        mpatches.Patch(facecolor='none', edgecolor='black', label='Horizontal line: 1 fixed point'),
        mpatches.Patch(facecolor='none', edgecolor='black', label='Vertical line: 2 fixed points'),
        mpatches.Patch(facecolor='none', edgecolor='black', label='Diagonal /: 3 fixed points'),
        mpatches.Patch(facecolor='none', edgecolor='black', label='Diagonal \\: 4 fixed points'),
        mpatches.Patch(facecolor='black', edgecolor='black', label='Solid black: 5+ fixed points'),
        mpatches.Patch(facecolor='green', edgecolor='black', label='Green: 1 FP, no cycles'),
    ]

    ax.set_xlabel('Number of Digits', fontsize=12)
    ax.set_ylabel('Base', fontsize=12)
    ax.set_title('Kaprekar Summary: Fixed Points and Cycles by Base and Digit Count', fontsize=14)
    ax.legend(handles=legend_elements, bbox_to_anchor=(1.05, 1), loc='upper left', fontsize=9)
    ax.grid(True, alpha=0.3)

    # Set integer ticks (accounting for doubled spacing)
    ax.set_xticks([d * 2 for d in range(2, max_digits + 1)])
    ax.set_xticklabels(range(2, max_digits + 1))
    ax.set_yticks(range(2, max_base + 1))

    # Save the plot
    print("Saving plot...", end='', flush=True)
    plt.tight_layout()
    plt.savefig('kaprekar_summary.png', dpi=150, bbox_inches='tight')
    print(" done")
    print("Summary graph saved as kaprekar_summary.png")

    print("Displaying plot (close the window when done)...")
    plt.show()


if __name__ == "__main__":
    main()
