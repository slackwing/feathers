#!/usr/bin/env python3

import sys
import pandas as pd
import matplotlib.pyplot as plt


def split_digits_base(num, base):
    """Helper function to count digits in a given base."""
    if num == 0:
        return 1
    count = 0
    while num > 0:
        count += 1
        num //= base
    return count


def main():
    # Read the CSV data
    print("Reading CSV data...", end='', flush=True)
    df_all = pd.read_csv('kaprekar_data.csv')
    print(" done")

    # Determine available max base and max digits
    print("Analyzing available data...", end='', flush=True)
    max_base_available = df_all['base'].max()

    # Calculate max digits for each base
    max_digits_available = 0
    for base in df_all['base'].unique():
        base_data = df_all[df_all['base'] == base]
        max_num_in_base = base_data['number'].max()
        digits_count = split_digits_base(max_num_in_base, int(base))
        max_digits_available = max(max_digits_available, digits_count)
    print(" done")

    print(f"CSV contains data up to base {max_base_available} and up to {max_digits_available} digits")

    # Prompt user for filter values
    filter_max_base = int(input(f"Enter max base to visualize (2-{max_base_available}): "))
    filter_max_digits = int(input(f"Enter max digits to visualize (2-{max_digits_available}): "))

    # Filter by base
    print("Filtering data...", end='', flush=True)
    df = df_all[df_all['base'] <= filter_max_base].copy()

    # Filter by number of digits (need to calculate per base)
    total_rows = len(df)
    mask = []
    for i, (idx, row) in enumerate(df.iterrows()):
        if i % 10000 == 0 and i > 0:
            progress_pct = (i / total_rows) * 100
            print(f"\rFiltering data... {progress_pct:.1f}%", end='', flush=True)
        num_digits = split_digits_base(row['number'], int(row['base']))
        mask.append(num_digits <= filter_max_digits)
    df = df[mask]
    print("\rFiltering data... done       ")

    # Filter out cycles (-1) and degenerate case (0)
    print("Removing cycles and degenerate cases...", end='', flush=True)
    df = df[(df['z_value'] != -1) & (df['z_value'] != 0)]
    print(" done")

    # Separate data by z_value for different colors
    print("Separating data by fixed point ID...", end='', flush=True)
    df_id1 = df[df['z_value'] == 1]
    df_id2 = df[df['z_value'] == 2]
    df_id3 = df[df['z_value'] == 3]
    df_other = df[df['z_value'] > 3]
    print(" done")

    # Create the plot
    print("Creating plot...", end='', flush=True)
    plt.figure(figsize=(12, 8))

    # Plot each group with its color using y_value for lanes
    if not df_id1.empty:
        plt.scatter(df_id1['number'], df_id1['y_value'], c='red', label='Fixed Point ID 1', s=10, alpha=0.6)
    if not df_id2.empty:
        plt.scatter(df_id2['number'], df_id2['y_value'], c='blue', label='Fixed Point ID 2', s=10, alpha=0.6)
    if not df_id3.empty:
        plt.scatter(df_id3['number'], df_id3['y_value'], c='green', label='Fixed Point ID 3', s=10, alpha=0.6)
    if not df_other.empty:
        plt.scatter(df_other['number'], df_other['y_value'], c='black', label='Fixed Point ID 4+', s=10, alpha=0.6)
    print(" done")

    plt.xlabel('Number (decimal)')
    plt.ylabel('Base (with digit lanes)')
    plt.title('Kaprekar Fixed Points by Base, Digits, and Number')
    plt.legend()
    plt.grid(True, alpha=0.3)

    # Save the plot
    print("Saving plot...", end='', flush=True)
    plt.savefig('kaprekar_graph.png', dpi=150, bbox_inches='tight')
    print(" done")
    print("Graph saved as kaprekar_graph.png")

    print("Displaying plot...")
    plt.show()


if __name__ == "__main__":
    main()
