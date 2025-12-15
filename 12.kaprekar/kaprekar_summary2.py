#!/usr/bin/env python3

import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import math


def main():
    # Read the CSV data
    print("Reading CSV data...", end='', flush=True)
    df = pd.read_csv('kaprekar_summary_data.csv')
    df_fp = pd.read_csv('kaprekar_fixed_points.csv')
    print(" done")

    # Get max values
    max_base = df['base'].max()
    max_digits = df['digits'].max()

    # Create the plot
    print("Creating summary plot...", end='', flush=True)
    fig, ax = plt.subplots(figsize=(20, 16))  # Increased from (14, 10)

    marker_size = 300

    # Get aspect ratio to calculate proper 45-degree angles
    ax.set_aspect('equal', adjustable='box')

    # Plot each base+digit combination
    for idx, row in df.iterrows():
        x = row['digits'] * 3  # 3x spacing
        y = row['base'] * 2  # Double the y-axis scale
        cycles = int(row['num_cycles'])
        fps = int(row['fixed_points'])

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
            if fps == 0:
                # Format as scientific notation with 1 digit precision
                if cycles < 10:
                    cycle_text = str(cycles)
                else:
                    exponent = int(math.floor(math.log10(cycles)))
                    mantissa = cycles / (10 ** exponent)
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
        base_val = int(row['base'])
        digits_val = int(row['digits'])
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
        mpatches.Patch(facecolor='none', edgecolor='black', label='Number in circle: cycle count (no FPs)'),
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

    # Set integer ticks (accounting for 3x and 2x spacing)
    ax.set_xticks([d * 3 for d in range(2, max_digits + 1)])
    ax.set_xticklabels(range(2, max_digits + 1))
    ax.set_yticks([b * 2 for b in range(2, max_base + 1)])
    ax.set_yticklabels(range(2, max_base + 1))

    # Save the plot
    print("Saving plot...", end='', flush=True)
    plt.tight_layout()
    plt.savefig('kaprekar_summary2.png', dpi=150, bbox_inches='tight')
    print(" done")
    print("Summary graph saved as kaprekar_summary2.png")

    print("Displaying plot (close the window when done)...")
    plt.show()


if __name__ == "__main__":
    main()
