"""CLI for SXIVA tools."""

import sys
import os
import re
import click
from pathlib import Path
from datetime import datetime
import subprocess
from .calculator import PointCalculator


def _get_data_path():
    """Get and validate SXIVA_DATA path.

    Returns:
        Path: Validated SXIVA_DATA directory path

    Exits with error if SXIVA_DATA is not set or invalid.
    """
    sxiva_data = os.environ.get('SXIVA_DATA')
    if not sxiva_data:
        click.secho("Error: SXIVA_DATA environment variable not set", fg='red', err=True)
        click.echo("Please set SXIVA_DATA to your SXIVA data directory:")
        click.echo("  export SXIVA_DATA=/path/to/your/sxiva/files")
        sys.exit(1)

    data_path = Path(sxiva_data)
    if not data_path.exists():
        click.secho(f"Error: SXIVA_DATA directory does not exist: {sxiva_data}", fg='red', err=True)
        sys.exit(1)

    if not data_path.is_dir():
        click.secho(f"Error: SXIVA_DATA is not a directory: {sxiva_data}", fg='red', err=True)
        sys.exit(1)

    return data_path


def _get_yyyymmdd_files(data_path, limit=10):
    """Get YYYYMMDD sxiva files in reverse chronological order.

    Args:
        data_path: Path to SXIVA_DATA directory
        limit: Maximum number of files to return (default: 10)

    Returns:
        List of (date_str, file_path) tuples, sorted newest first
    """
    # Pattern to match YYYYMMDD at start of filename
    yyyymmdd_pattern = re.compile(r'^(\d{8})')

    files_with_dates = []
    for file_path in data_path.glob('*.sxiva'):
        match = yyyymmdd_pattern.match(file_path.name)
        if match:
            date_str = match.group(1)
            files_with_dates.append((date_str, file_path))

    # Sort by date string in reverse (newest first)
    files_with_dates.sort(key=lambda x: x[0], reverse=True)

    # Return up to limit files
    return files_with_dates[:limit]


def list_recent_files():
    """List the last 10 YYYYMMDD sxiva files in reverse chronological order."""
    data_path = _get_data_path()
    files = _get_yyyymmdd_files(data_path, limit=10)

    if not files:
        click.echo("No YYYYMMDD sxiva files found in $SXIVA_DATA")
        return

    for i, (date_str, file_path) in enumerate(files, 1):
        click.echo(f"{i}. {file_path.name}")


def open_nth_file(n):
    """Open the Nth file from the recent files list.

    Args:
        n: 1-based index of the file to open
    """
    data_path = _get_data_path()
    files = _get_yyyymmdd_files(data_path, limit=10)

    if not files:
        click.secho("Error: No YYYYMMDD sxiva files found in $SXIVA_DATA", fg='red', err=True)
        sys.exit(1)

    if n < 1 or n > len(files):
        click.secho(f"Error: Invalid index {n}. Must be between 1 and {len(files)}", fg='red', err=True)
        sys.exit(1)

    # Get the nth file (n-1 because list is 0-indexed)
    _, file_path = files[n - 1]

    click.echo(f"Opening: {file_path}")

    # Open with editor
    editor = os.environ.get('EDITOR', 'vi')
    try:
        subprocess.run([editor, str(file_path)], check=True)
    except subprocess.CalledProcessError:
        click.secho(f"Error: Failed to open editor: {editor}", fg='red', err=True)
        sys.exit(1)
    except FileNotFoundError:
        click.secho(f"Error: Editor not found: {editor}", fg='red', err=True)
        click.echo("Set the EDITOR environment variable to your preferred editor")
        sys.exit(1)


@click.group(invoke_without_command=True)
@click.version_option(version="0.1.0")
@click.option('-d', '--date', metavar='YYYYMMDD', help='Open file for specific date (format: YYYYMMDD)')
@click.option('-y', '--yesterday', is_flag=True, help='Open yesterday\'s file')
@click.option('-p', '--preserve', metavar='YYYYMMDD', help='Preserve notes section from specified date (default: yesterday)')
@click.option('-l', '--list', 'list_files', is_flag=True, help='List last 10 YYYYMMDD sxiva files in reverse chronological order')
@click.option('-o', '--open', 'open_nth', metavar='N', type=int, help='Open the Nth file from the list (1-based index)')
@click.pass_context
def cli(ctx, date, yesterday, preserve, list_files, open_nth):
    """SXIVA CLI tools for parsing and calculating points.

    When called without a subcommand, opens today's SXIVA file from $SXIVA_DATA.
    """
    # If a subcommand is invoked, don't run the default behavior
    if ctx.invoked_subcommand is not None:
        return

    # Handle --list flag
    if list_files:
        list_recent_files()
        return

    # Handle --open flag
    if open_nth is not None:
        open_nth_file(open_nth)
        return

    # Default behavior: open today's file (or specified date)
    open_today(date, yesterday, preserve)


def _sanitize_section_markers(file_path):
    """Ensure blank line before first === section marker.

    This handles user error where the blank line before === was accidentally removed.

    Args:
        file_path: Path to the file to sanitize
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        if not content.strip():
            # Empty file, nothing to do
            return

        lines = content.split('\n')
        modified = False

        # Find first === line and ensure blank line before it
        for i, line in enumerate(lines):
            if line.startswith('==='):
                # Found first === line
                if i > 0 and lines[i - 1].strip() != '':
                    # Previous line is not blank - insert blank line
                    lines.insert(i, '')
                    modified = True
                break

        # Write back if modified
        if modified:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
    except Exception:
        # Silent skip on any errors - don't break the workflow
        pass


def _preserve_notes_section(data_path, target_file, preserve_date_str, target_date):
    """Preserve notes section from a previous date's file.

    Args:
        data_path: Path to SXIVA_DATA directory
        target_file: Path to the file we're adding notes to
        preserve_date_str: Date string (YYYYMMDD) to preserve from
        target_date: datetime object of the target date (for display)
    """
    # Find source file matching the preserve date
    source_files = list(data_path.glob(f'{preserve_date_str}*'))

    if not source_files:
        # Silent skip - no file found
        return

    source_file = source_files[0]

    # Read source file and find content after first ===
    try:
        with open(source_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Find first === line
        lines = content.split('\n')
        first_marker_idx = None
        for i, line in enumerate(lines):
            if line.startswith('==='):
                first_marker_idx = i
                break

        if first_marker_idx is None:
            # No === section found - silent skip
            return

        # Extract everything after the first === line (skip the === line itself)
        preserved_content = '\n'.join(lines[first_marker_idx + 1:])

        # Only add if there's actual content to preserve
        if not preserved_content.strip():
            return

        # Append to target file
        with open(target_file, 'a', encoding='utf-8') as f:
            # Add separator with date marker
            f.write(f'\n=== (preserved from {preserve_date_str})\n')
            f.write(preserved_content)
            # Ensure file ends with newline if content doesn't
            if preserved_content and not preserved_content.endswith('\n'):
                f.write('\n')

    except Exception:
        # Silent skip on any errors (file read errors, encoding issues, etc.)
        pass


def open_today(date_str=None, yesterday=False, preserve=None):
    """Open or create today's SXIVA file.

    Args:
        date_str: Optional date string in YYYYMMDD format
        yesterday: If True, open yesterday's file
        preserve: Optional date string to preserve notes from (YYYYMMDD), or True for auto-yesterday
    """
    data_path = _get_data_path()

    # Determine which date to use
    if date_str:
        # Parse custom date
        try:
            target_date = datetime.strptime(date_str, '%Y%m%d')
        except ValueError:
            click.secho(f"Error: Invalid date format: {date_str}", fg='red', err=True)
            click.echo("Expected format: YYYYMMDD (e.g., 20251129)")
            sys.exit(1)
    elif yesterday:
        # Yesterday
        from datetime import timedelta
        target_date = datetime.now() - timedelta(days=1)
    else:
        # Today (default)
        target_date = datetime.now()

    formatted_date = target_date.strftime('%Y%m%d')

    # Day of week mnemonic: U M T W R F S (Sunday to Saturday)
    # weekday() returns 0=Monday, 6=Sunday
    # isoweekday() returns 1=Monday, 7=Sunday
    day_mnemonics = ['U', 'M', 'T', 'W', 'R', 'F', 'S']
    iso_day = target_date.isoweekday()  # 1=Mon, 7=Sun
    day_letter = day_mnemonics[iso_day % 7]  # Convert: 7->0 (Sun=U), 1->1 (Mon=M), etc.

    # Check for existing file starting with target date
    matching_files = list(data_path.glob(f'{formatted_date}*'))

    file_is_new = False
    if matching_files:
        # Use the first matching file
        file_path = matching_files[0]
        click.echo(f"Opening: {file_path}")
    else:
        # Create new file with format: YYYYMMDDd.sxiva
        file_path = data_path / f'{formatted_date}{day_letter}.sxiva'
        click.echo(f"Creating: {file_path}")
        # Create empty file
        file_path.touch()
        file_is_new = True

    # Handle preserve logic
    # Determine if we should preserve and from which date
    should_preserve = False
    preserve_from_date = None

    if preserve is not None:
        # Explicit --preserve flag was used
        should_preserve = True
        preserve_from_date = preserve
    elif file_is_new:
        # Implicit preserve: only for new files, default to yesterday
        should_preserve = True
        # Calculate yesterday for preserve
        from datetime import timedelta
        yesterday_date = target_date - timedelta(days=1)
        preserve_from_date = yesterday_date.strftime('%Y%m%d')

    if should_preserve:
        _preserve_notes_section(data_path, file_path, preserve_from_date, target_date)

    # Sanitize: ensure blank line before === markers (fixes user errors)
    if not file_is_new:
        _sanitize_section_markers(file_path)

    # Open with editor
    editor = os.environ.get('EDITOR', 'vi')
    try:
        subprocess.run([editor, str(file_path)], check=True)
    except subprocess.CalledProcessError:
        click.secho(f"Error: Failed to open editor: {editor}", fg='red', err=True)
        sys.exit(1)
    except FileNotFoundError:
        click.secho(f"Error: Editor not found: {editor}", fg='red', err=True)
        click.echo("Set the EDITOR environment variable to your preferred editor")
        sys.exit(1)


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
