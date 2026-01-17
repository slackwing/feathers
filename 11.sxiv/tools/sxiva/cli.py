"""CLI for SXIVA tools."""

import sys
import os
import re
import click
from pathlib import Path
from datetime import datetime
import subprocess
from .calculator import PointCalculator
from .sync import sync_now


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


def recalculate_all_files_silent(data_path):
    """Recalculate all .sxiva files in data_path without prompting.

    Args:
        data_path: Path to directory containing .sxiva files
    """
    sxiva_files = sorted(data_path.glob('*.sxiva'))

    if not sxiva_files:
        return

    # Process all files silently
    from .calculator import PointCalculator
    calculator = PointCalculator()

    for file_path in sxiva_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Calculate and update the file
            updated_content = calculator.calculate(content, file_path=str(file_path))

            # Only write if content changed (preserves mtime)
            if updated_content != content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(updated_content)
        except Exception:
            # Silent skip on errors
            pass


def recalculate_all_files():
    """Recalculate all .sxiva files in the current directory."""
    # Find all .sxiva files in current directory
    # Use SXIVA_ORIGINAL_DIR if set by wrapper script, otherwise use PWD or cwd
    original_dir = os.environ.get('SXIVA_ORIGINAL_DIR') or os.environ.get('PWD')
    if original_dir:
        cwd = Path(original_dir)
    else:
        cwd = Path.cwd()
    sxiva_files = sorted(cwd.glob('*.sxiva'))

    if not sxiva_files:
        click.secho("No .sxiva files found in current directory", fg='yellow')
        return

    # Show files and ask for confirmation
    click.echo(f"Found {len(sxiva_files)} .sxiva file(s) in {cwd}:")
    for i, file_path in enumerate(sxiva_files, 1):
        click.echo(f"  {i}. {file_path.name}")

    click.echo()
    response = click.prompt("Are you sure you want to recalculate all of these files? (y/n)",
                           type=str, default='n')

    if response.lower() != 'y':
        click.echo("Cancelled.")
        return

    # Process all files
    from .calculator import PointCalculator
    calculator = PointCalculator()

    success_count = 0
    files_with_errors = []  # Track files that have [ERROR] messages
    files_changed = []  # Track files that had changes
    files_unchanged = []  # Track files with no changes

    click.echo()
    for file_path in sxiva_files:
        try:
            # Read original content before processing
            with open(file_path, 'r', encoding='utf-8') as f:
                original_content = f.read()

            # Process the file
            num_fixes = calculator.fix_file(str(file_path), output_path=None, dry_run=False)

            # Read content after processing
            with open(file_path, 'r', encoding='utf-8') as f:
                new_content = f.read()
                has_errors = '[ERROR]' in new_content

            # Determine if file actually changed
            file_changed = (original_content != new_content)

            if has_errors:
                # File has [ERROR] messages - show in red with X
                click.secho(f"✗ {file_path.name} (has errors)", fg='red')
                files_with_errors.append(file_path.name)
            elif file_changed:
                # File was changed - show in yellow
                click.secho(f"✓ {file_path.name} (regenerated with changes)", fg='yellow')
                files_changed.append(file_path.name)
            else:
                # No changes - show in green
                click.secho(f"✓ {file_path.name} (no changes)", fg='green')
                files_unchanged.append(file_path.name)
            success_count += 1
        except Exception as e:
            click.secho(f"✗ {file_path.name}: {e}", fg='red', err=True)
            files_with_errors.append(file_path.name)

    # Summary
    click.echo()
    click.echo("=" * 50)
    click.secho(f"Processed {success_count} file(s)", fg='cyan')
    click.echo()
    click.secho(f"  {len(files_unchanged)} unchanged", fg='green')
    click.secho(f"  {len(files_changed)} regenerated with changes", fg='yellow')

    if files_with_errors:
        click.secho(f"  {len(files_with_errors)} with errors", fg='red')
        click.echo()
        click.secho(f"Files with errors:", fg='red')
        for filename in files_with_errors:
            click.secho(f"  - {filename}", fg='red')
    else:
        click.secho(f"  0 with errors", fg='green')
    click.echo("=" * 50)


@click.group(invoke_without_command=True)
@click.version_option(version="0.1.0")
@click.option('-d', '--date', metavar='YYYYMMDD', help='Open file for specific date (format: YYYYMMDD)')
@click.option('-y', '--yesterday', is_flag=True, help='Open yesterday\'s file')
@click.option('-p', '--preserve', metavar='YYYYMMDD', help='Preserve notes section from specified date (default: yesterday)')
@click.option('-l', '--list', 'list_files', is_flag=True, help='List last 10 YYYYMMDD sxiva files in reverse chronological order')
@click.option('-o', '--open', 'open_nth', metavar='N', type=int, help='Open the Nth file from the list (1-based index)')
@click.option('-a', '--all', 'recalculate_all', is_flag=True, help='Recalculate all .sxiva files in current directory')
@click.pass_context
def cli(ctx, date, yesterday, preserve, list_files, open_nth, recalculate_all):
    """SXIVA CLI tools for parsing and calculating points.

    When called without a subcommand, opens today's SXIVA file from $SXIVA_DATA.
    """
    # If a subcommand is invoked, don't run the default behavior
    if ctx.invoked_subcommand is not None:
        return

    # Handle --all flag
    if recalculate_all:
        recalculate_all_files()
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

    # Recalculate all files silently (unless SXIVA_NO_RECALC is set)
    if not os.environ.get('SXIVA_NO_RECALC'):
        recalculate_all_files_silent(data_path)

    # Sync to dashboard (unless SXIVA_NO_SYNC is set)
    if not os.environ.get('SXIVA_NO_SYNC'):
        sync_now(data_path, quiet=True)

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


@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
def log_now(file_path):
    """Set the end time of the last timesheet entry to now.

    Finds the last time block or continuation block and updates its end time
    to the current time (rounded to the nearest minute). Useful for quickly
    logging work as you go.

    \b
    Example:
        sxiva log-now today.sxiva    # Set last entry end time to now
    """
    from datetime import datetime
    from .parser import SxivaParser, node_text

    try:
        # Read the file
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Parse with tree-sitter
        parser = SxivaParser()
        tree = parser.parse(content)
        source_bytes = content.encode('utf-8')

        # Find all time_block and continuation_block nodes
        time_blocks = []

        def find_time_blocks(node):
            if node.type in ['time_block', 'continuation_block']:
                time_blocks.append(node)
            for child in node.children:
                find_time_blocks(child)

        find_time_blocks(tree.root_node)

        if not time_blocks:
            click.secho("No timesheet entries found in file", fg='yellow')
            sys.exit(1)

        # Find the end time node within a block
        # Structure: time_block -> terminator -> end_term -> time
        # Or: continuation_block -> terminator -> end_term -> time
        def find_end_time(node):
            if node.type == 'time' and node.parent and node.parent.type == 'end_term':
                return node
            for child in node.children:
                result = find_end_time(child)
                if result:
                    return result
            return None

        # Find the last time block that has a valid end time
        last_block_with_end_time = None
        end_time_node = None

        for block in reversed(time_blocks):
            end_time = find_end_time(block)
            if end_time:
                # Check that the end time is not empty (e.g., line ending with just "---")
                end_time_text = node_text(end_time, source_bytes).strip()
                if end_time_text:
                    last_block_with_end_time = block
                    end_time_node = end_time
                    break

        if not end_time_node:
            click.secho("Could not find any timesheet entry with an end time", fg='yellow')
            sys.exit(1)

        # Get the old end time
        old_end_time = node_text(end_time_node, source_bytes)

        # Get current time rounded to nearest minute
        now = datetime.now()
        current_time = f"{now.hour:02d}:{now.minute:02d}"

        # Replace the end time in the content
        start_byte = end_time_node.start_byte
        end_byte = end_time_node.end_byte
        new_content = (
            content[:start_byte] +
            current_time +
            content[end_byte:]
        )

        # Write back to file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

        click.secho(f"✓ Updated last entry end time: {old_end_time} → {current_time}", fg='green')

        # Now run calculator to fix point calculations
        calculator = PointCalculator()
        calculator.fix_file(file_path, output_path=None, dry_run=False)
        click.secho(f"✓ Recalculated points", fg='green')

    except FileNotFoundError as e:
        click.secho(f"Error: {e}", fg='red', err=True)
        sys.exit(1)
    except Exception as e:
        click.secho(f"Error: {e}", fg='red', err=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
def log_end(file_path):
    """Clean up the last incomplete entry and set its end time to now.

    Finds the last timesheet entry that ends with --- or ~--- but has no end time.
    If there's extra text after the ---, removes it. Then sets the end time to current time.

    \b
    Example:
        sxiva log-end today.sxiva    # Clean up last incomplete entry and log current time
    """
    from .parser import SxivaParser, node_text
    from datetime import datetime

    try:
        # Read the file
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Parse with tree-sitter
        parser = SxivaParser()
        tree = parser.parse(content)
        source_bytes = content.encode('utf-8')

        # Find all lines that look like incomplete entries
        # We need to look for:
        # 1. Valid time_block/continuation_block nodes with empty end times
        # 2. Invalid lines that start with time - blick_list --- but have junk after ---

        # Collect candidate entries: (line_number, has_dash_end)
        candidates = []

        def find_candidates(node, parent=None, inside_block=False):
            # Case 1: Valid blocks with empty end times
            if node.type in ['time_block', 'continuation_block']:
                # Check if it has an empty end time
                def find_end_time(n):
                    if n.type == 'time' and n.parent and n.parent.type == 'end_term':
                        return n
                    for child in n.children:
                        result = find_end_time(child)
                        if result:
                            return result
                    return None

                end_time = find_end_time(node)
                if end_time:
                    end_time_text = node_text(end_time, source_bytes).strip()
                    if not end_time_text:
                        # This is an incomplete entry
                        line_num = node.start_point[0]
                        candidates.append(line_num)

                # Recurse into children but mark that we're inside a block
                for child in node.children:
                    find_candidates(child, node, inside_block=True)
                return

            # Case 2: Look for time nodes (or x_time nodes for x-blocks) that are NOT inside a time_block
            # but have a triple_dash or --- sibling (these are invalid/incomplete lines)
            if not inside_block and node.type in ['time', 'x_time'] and parent and parent.type != 'start_term':
                # Check if this time has a triple_dash or --- sibling
                if parent:
                    has_dash = False
                    for sibling in parent.children:
                        if sibling.type in ['triple_dash', '---']:
                            has_dash = True
                            break

                    if has_dash:
                        # This looks like a time entry with dashes
                        line_num = node.start_point[0]
                        candidates.append(line_num)

            for child in node.children:
                find_candidates(child, node, inside_block)

        find_candidates(tree.root_node)

        if not candidates:
            click.secho("No incomplete timesheet entries found", fg='yellow')
            sys.exit(1)

        # Get the last candidate (highest line number)
        last_line = max(candidates)

        lines = content.split('\n')
        block_line = lines[last_line]

        # Find where the --- or ~--- is
        # Look for either " ---" or " ~---"
        dash_pos = block_line.find(' ---')
        tilde_variant = False
        if dash_pos == -1:
            dash_pos = block_line.find(' ~---')
            if dash_pos == -1:
                click.secho("Could not find --- in incomplete entry", fg='red', err=True)
                sys.exit(1)
            dash_end = dash_pos + 5  # " ~---" is 5 chars
            tilde_variant = True
        else:
            dash_end = dash_pos + 4  # " ---" is 4 chars

        # Clean the line - keep everything up to and including the dashes, remove anything after
        cleaned_line = block_line[:dash_end]

        # Now add the current time as the end time
        current_time = datetime.now()
        time_str = current_time.strftime('%H:%M')

        # Add the time after the dashes
        updated_line = cleaned_line + ' ' + time_str

        # Replace the line
        lines[last_line] = updated_line
        new_content = '\n'.join(lines)

        # Write back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

        if cleaned_line != block_line:
            removed_text = block_line[dash_end:].strip()
            click.secho(f"✓ Cleaned entry and logged time {time_str} (removed: '{removed_text}')", fg='green')
        else:
            click.secho(f"✓ Logged time {time_str}", fg='green')

    except FileNotFoundError as e:
        click.secho(f"Error: {e}", fg='red', err=True)
        sys.exit(1)
    except Exception as e:
        click.secho(f"Error: {e}", fg='red', err=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
def repeat_entry(file_path):
    """Duplicate the last timesheet entry with +12 minutes to start time.

    Finds the last timesheet entry (incomplete or complete) and creates a new entry
    below it with the start time advanced by 12 minutes (wrapping at 24:00).
    Preserves the category, subject, minutes, and dash style, but leaves end time empty.

    \b
    Example:
        sxiva repeat-entry today.sxiva    # Duplicate last entry with +12 min start
    """
    from .parser import SxivaParser, node_text
    from datetime import datetime, timedelta

    try:
        # Read the file
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Parse with tree-sitter
        parser = SxivaParser()
        tree = parser.parse(content)
        source_bytes = content.encode('utf-8')

        # Find all time_block and continuation_block nodes
        time_blocks = []

        def find_time_blocks(node):
            if node.type in ['time_block', 'continuation_block']:
                time_blocks.append(node)
            for child in node.children:
                find_time_blocks(child)

        find_time_blocks(tree.root_node)

        # Also look for incomplete/invalid entries like we do in log-end
        candidates = []

        def find_candidates(node, parent=None, inside_block=False):
            if node.type in ['time_block', 'continuation_block']:
                candidates.append(node.start_point[0])
                for child in node.children:
                    find_candidates(child, node, inside_block=True)
                return

            if not inside_block and node.type in ['time', 'x_time'] and parent and parent.type != 'start_term':
                if parent:
                    has_dash = False
                    for sibling in parent.children:
                        if sibling.type in ['triple_dash', '---']:
                            has_dash = True
                            break
                    if has_dash:
                        candidates.append(node.start_point[0])

            for child in node.children:
                find_candidates(child, node, inside_block)

        find_candidates(tree.root_node)

        if not candidates:
            click.secho("No timesheet entries found in file", fg='yellow')
            sys.exit(1)

        # Get the last entry line
        last_line_num = max(candidates)
        lines = content.split('\n')
        last_line = lines[last_line_num].strip()  # Strip leading whitespace (indentation)

        # Parse the line to extract components
        # Format: HH:MM - [category] subject [minutes] --- (or ~---) [optional end time and notes]
        # Or: xHH:MM - [category] subject [3] or [6] --- (x-blocks)
        import re

        # Match start time (with optional x prefix) and everything up to the dashes
        time_match = re.match(r'^(x?\d{2}:\d{2})\s*-\s*(.+?)\s+(~?---)', last_line)
        if not time_match:
            click.secho(f"Could not parse last timesheet entry: {last_line}", fg='red', err=True)
            sys.exit(1)

        start_time_str = time_match.group(1)  # May include 'x' prefix
        entry_content = time_match.group(2)  # [category] subject [minutes]
        dash_style = time_match.group(3)  # "---" or "~---"

        # Check if this is an x-block
        is_x_block = start_time_str.startswith('x')
        time_only = start_time_str[1:] if is_x_block else start_time_str

        # Parse the start time and add 12 minutes
        start_time = datetime.strptime(time_only, '%H:%M')
        new_start_time = start_time + timedelta(minutes=12)

        # Handle wrapping at midnight
        if new_start_time.day > start_time.day:
            new_start_time = new_start_time.replace(hour=0, minute=0)

        new_start_time_str = new_start_time.strftime('%H:%M')

        # Add x prefix back if it was an x-block
        if is_x_block:
            new_start_time_str = 'x' + new_start_time_str

        # Build the new line
        new_line = f"{new_start_time_str} - {entry_content} {dash_style}"

        # Find where to insert the new line
        # Insert right after the last timesheet entry
        insert_position = last_line_num + 1

        # Insert the new line
        lines.insert(insert_position, new_line)
        new_content = '\n'.join(lines)

        # Write back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

        click.secho(f"✓ Created new entry at {new_start_time_str}", fg='green')

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
