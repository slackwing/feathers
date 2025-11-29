"""CLI for SXIVA tools."""

import sys
import click
from pathlib import Path
from .calculator import PointCalculator


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """SXIVA CLI tools for parsing and calculating points."""
    pass


@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--fix', is_flag=True, help='Fix incorrect point calculations in place')
@click.option('--output', '-o', type=click.Path(), help='Output file/directory (implies --fix)')
def calculate(file_path, fix, output):
    """Calculate points for a .sxiva file.

    Validates point calculations and optionally fixes them.

    \b
    Examples:
        sxiva calculate input.sxiva                    # Check for errors
        sxiva calculate input.sxiva --fix              # Fix errors in place
        sxiva calculate input.sxiva -o output.sxiva    # Fix to specific file
        sxiva calculate input.sxiva -o out_dir/        # Fix to directory
    """
    calculator = PointCalculator()

    try:
        if fix or output:
            # Fix mode: determine output path
            output_path = output if output else file_path
            num_fixes = calculator.fix_file(file_path, output_path=output_path, dry_run=False)

            if num_fixes > 0:
                target = output_path if output_path != file_path else file_path
                click.secho(f"✓ Fixed {num_fixes} point calculation(s) in {target}", fg='green')
            else:
                click.secho(f"✓ No fixes needed - all calculations correct", fg='green')

        else:
            # Check mode: report issues
            issues = calculator.calculate_file(file_path)

            if not issues:
                click.secho(f"✓ All point calculations are correct", fg='green')
            else:
                click.secho(f"Found {len(issues)} incorrect calculation(s):", fg='yellow')
                for line_num, _, expected, actual in issues:
                    click.echo(f"  Line {line_num}:")
                    click.echo(f"    Expected: {expected}")
                    click.echo(f"    Actual:   {actual}")
                click.echo()
                click.secho("Run with --fix to correct these automatically", fg='cyan')
                sys.exit(1)

    except FileNotFoundError as e:
        click.secho(f"Error: {e}", fg='red', err=True)
        sys.exit(1)
    except Exception as e:
        click.secho(f"Error: {e}", fg='red', err=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)


def main():
    """Entry point for the CLI."""
    cli()


if __name__ == '__main__':
    main()
