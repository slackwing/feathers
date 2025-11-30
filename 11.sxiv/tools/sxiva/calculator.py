"""Point calculation engine for SXIVA files."""

import re
from dataclasses import dataclass
from typing import List, Optional, Set, Tuple
from datetime import datetime
from pathlib import Path


@dataclass
class CalculationState:
    """State maintained while walking through the file sequentially."""
    accumulation: int = 1  # 1-10 counter (starts at +1a)
    focus_categories: Set[str] = None  # Active focus categories
    running_total: int = 0  # Running sum of all points
    previous_end_time: Optional[str] = None  # Last block's end time (HH:MM)
    previous_start_time: Optional[str] = None  # Last block's start time (HH:MM)
    is_first_block: bool = True  # Track if this is the first block
    previous_had_focus: bool = False  # Track if previous block had focus (for indentation)
    time_offset: int = 0  # Minutes offset from expected timing (preserved across breaks)
    in_freeform: bool = False  # Track if we're in the freeform section

    def __post_init__(self):
        if self.focus_categories is None:
            self.focus_categories = set()


@dataclass
class BlockPoints:
    """Calculated points for a block."""
    base: int  # Base points (minutes ahead/behind expected end time)
    focus: int  # Focus bonus
    accumulation: int  # Accumulation bonus
    total: int  # Sum of base + focus + accumulation
    expected: str  # Expected points notation (e.g., "-2,+2f,+1a=1")


class PointCalculator:
    """Calculates points for SXIVA time blocks."""

    # Valid time boundaries (in minutes within the hour)
    STANDARD_BOUNDARIES = [0, 12, 24, 36, 48]
    START_BOUNDARIES = [8, 20, 32, 44, 56]

    def __init__(self):
        self._parser = None

    @property
    def parser(self):
        """Lazy-load the parser only when needed."""
        if self._parser is None:
            from .parser import SxivaParser
            self._parser = SxivaParser()
        return self._parser

    def parse_time(self, time_str: str) -> int:
        """Parse HH:MM time string to minutes since midnight.

        Args:
            time_str: Time in HH:MM format

        Returns:
            int: Minutes since midnight
        """
        hours, minutes = map(int, time_str.split(':'))
        return hours * 60 + minutes

    def validate_time_format(self, time_str: str) -> bool:
        """Validate that time is in proper HH:MM format.

        Args:
            time_str: Time string to validate

        Returns:
            bool: True if valid format (HH:MM with 2-digit minutes)
        """
        # Must be HH:MM or H:MM format, where MM is exactly 2 digits
        return bool(re.match(r'^\d{1,2}:\d{2}$', time_str))

    def validate_start_time_boundary(self, time_str: str) -> tuple[bool, str]:
        """Validate that start time is on a valid SXIVA boundary.

        Valid start times:
        - Standard blocks: :00, :12, :24, :36, :48
        - Start blocks: :08, :20, :32, :44, :56 (4 minutes before standard)

        Args:
            time_str: Time string in HH:MM format

        Returns:
            tuple: (is_valid, error_message)
        """
        hours, minutes = map(int, time_str.split(':'))
        minute = minutes % 60

        if minute in self.STANDARD_BOUNDARIES or minute in self.START_BOUNDARIES:
            return (True, "")
        else:
            return (False, f"start time {time_str} is not on a valid boundary (:00/:12/:24/:36/:48 for standard blocks, :08/:20/:32/:44/:56 for start blocks)")

    def is_start_boundary(self, time_str: str) -> bool:
        """Check if time is on a start block boundary (:08, :20, :32, :44, :56).

        Args:
            time_str: Time string in HH:MM format

        Returns:
            bool: True if on start boundary
        """
        hours, minutes = map(int, time_str.split(':'))
        minute = minutes % 60
        return minute in self.START_BOUNDARIES

    def get_next_standard_boundary(self, time_str: str) -> str:
        """Get the next standard boundary after a start block.

        Start boundaries (:08, :20, :32, :44, :56) map to next standard boundaries:
        - :08 → :24
        - :20 → :36
        - :32 → :48
        - :44 → :00 (next hour)
        - :56 → :12 (next hour)

        Args:
            time_str: Time string in HH:MM format

        Returns:
            str: Next standard boundary time
        """
        hours, minutes = map(int, time_str.split(':'))
        minute = minutes % 60

        if minute == 8:
            return f"{hours:02d}:24"
        elif minute == 20:
            return f"{hours:02d}:36"
        elif minute == 32:
            return f"{hours:02d}:48"
        elif minute == 44:
            return f"{(hours + 1) % 24:02d}:00"
        elif minute == 56:
            return f"{(hours + 1) % 24:02d}:12"
        else:
            # Not a start boundary, shouldn't happen
            return time_str

    def convert_blick_notation_to_minutes(self, notation: int) -> int:
        """Convert blick notation to actual work minutes.

        [10] and [13] are special: they represent shortened final blicks.
        - [10] = 9 minutes (3 blicks with final shortened by 1 min)
        - [13] = 12 minutes (4 blicks with final shortened by 1 min)
        - [3] = 3 minutes, [6] = 6 minutes (standard)

        Args:
            notation: The number from [notation] marker

        Returns:
            int: Actual work minutes
        """
        if notation == 10:
            return 9
        elif notation == 13:
            return 12
        else:
            return notation

    def calculate_duration(self, start: str, end: str) -> int:
        """Calculate duration in minutes between two times.

        Args:
            start: Start time HH:MM
            end: End time HH:MM

        Returns:
            int: Duration in minutes
        """
        start_mins = self.parse_time(start)
        end_mins = self.parse_time(end)

        # Handle day wraparound
        if end_mins < start_mins:
            end_mins += 24 * 60

        return end_mins - start_mins

    def count_blicks(self, blick_list_node, source_bytes) -> int:
        """Count total number of 3-minute blicks in a blick_list.

        A "blick" is a 3-minute chunk, so:
        - [3] = 1 blick
        - [6] = 2 blicks
        - [10] (representing 9 min) = 3 blicks
        - [13] (representing 12 min) = 4 blicks

        Args:
            blick_list_node: Tree-sitter blick_list node
            source_bytes: Source code as bytes

        Returns:
            int: Total number of 3-minute blicks
        """
        from .parser import node_text

        total_minutes = 0
        for child in blick_list_node.children:
            if child.type == 'blick':
                # Check if this blick has explicit minutes
                has_minutes = any(c.type == 'minutes' for c in child.children)
                has_tilde = any(c.type == '~' for c in child.children)

                if has_minutes:
                    # Find and parse the minutes node
                    for blick_child in child.children:
                        if blick_child.type == 'minutes':
                            minutes_text = node_text(blick_child, source_bytes)
                            # Parse [3], [6], [10], [13]
                            minutes_notation = int(minutes_text.strip('[]'))
                            # Convert notation to actual minutes ([10]->9, [13]->12)
                            total_minutes += self.convert_blick_notation_to_minutes(minutes_notation)
                            break
                elif has_tilde:
                    # Tilde-only case (implicit [10] = 9 minutes)
                    total_minutes += 9

        # Total blicks = total minutes / 3
        return total_minutes // 3

    def find_all_times(self, node):
        """Recursively find all time nodes within a block.

        Args:
            node: Tree-sitter time_block or continuation_block node

        Returns:
            list: All time nodes found
        """
        times = []
        if node.type == 'time':
            times.append(node)
        for child in node.children:
            times.extend(self.find_all_times(child))
        return times

    def find_points_node(self, node):
        """Recursively find the points node within a block.

        Args:
            node: Tree-sitter time_block or continuation_block node

        Returns:
            points node if found, None otherwise
        """
        if node.type == 'points':
            return node
        for child in node.children:
            result = self.find_points_node(child)
            if result:
                return result
        return None

    def detect_x_block(self, node, source_bytes) -> bool:
        """Check if a time_block or continuation_block has 'x' marker.

        Args:
            node: Tree-sitter time_block or continuation_block node
            source_bytes: Source code as bytes

        Returns:
            bool: True if has 'x' shortening marker
        """
        from .parser import node_text

        for child in node.children:
            if child.type == 'x':
                return True
        return False

    def minutes_to_blick_count(self, minutes_str: str) -> int:
        """Convert minute notation to number of blicks.

        Args:
            minutes_str: String like '[3]', '[6]', '[10]', '[13]'

        Returns:
            Number of blicks (each blick = 3 minutes)
        """
        # Remove brackets and convert to int
        mins = int(minutes_str.strip('[]'))

        # Map: [3]=1, [6]=2, [10]=3, [13]=4
        if mins == 3:
            return 1
        elif mins == 6:
            return 2
        elif mins == 10:
            return 3
        elif mins == 13:
            return 4
        else:
            # Fallback: approximate
            return max(1, mins // 3)

    def extract_categories(self, blick_list_node, source_bytes) -> List[str]:
        """Extract category names from a blick list.

        Args:
            blick_list_node: Tree-sitter blick_list node
            source_bytes: Source code as bytes

        Returns:
            List[str]: Category names (without brackets), one per blick
            For example, [wr] work [10] returns ['wr', 'wr', 'wr'] (3 blicks)
        """
        from .parser import node_text

        categories = []

        for child in blick_list_node.children:
            if child.type == 'blick':
                cat_name = None
                num_blicks = 3  # Default when only tilde (no explicit minutes): tilde alone = [10] = 3 blicks
                has_explicit_minutes = False

                for blick_child in child.children:
                    if blick_child.type == 'category':
                        cat_text = node_text(blick_child, source_bytes)
                        # Remove brackets: [wr] -> wr
                        cat_name = cat_text.strip('[]')
                    elif blick_child.type == 'minutes':
                        # Explicit minutes override tilde default
                        # e.g., ~[6] uses [6] (2 blicks), tilde is decorative
                        minutes_text = node_text(blick_child, source_bytes)
                        num_blicks = self.minutes_to_blick_count(minutes_text)
                        has_explicit_minutes = True

                # Note: Grammar requires either tilde or explicit minutes
                # If only tilde (~), num_blicks stays at default (3)
                # If explicit minutes (~[6] or [6]), num_blicks is set from minutes

                # Add category once per blick
                if cat_name:
                    categories.extend([cat_name] * num_blicks)

        return categories

    def is_continuation_start(self, node, source_bytes) -> bool:
        """Check if a block starts a continuation (ends with +).

        Args:
            node: Tree-sitter time_block or continuation_block node
            source_bytes: Source code as bytes

        Returns:
            bool: True if block ends with continuation marker
        """
        from .parser import node_text

        # Look for terminator that's a continuation (+)
        for child in node.children:
            if child.type == 'terminator':
                term_text = node_text(child, source_bytes).strip()
                if term_text.endswith('+'):
                    return True
        return False

    def collect_continuation_chain(self, nodes, start_idx, source_bytes) -> List[int]:
        """Collect indices of all blocks in a continuation chain.

        Args:
            nodes: List of all root-level nodes
            start_idx: Index of the first block in potential chain
            source_bytes: Source code as bytes

        Returns:
            List[int]: Indices of all blocks in the chain (including start_idx)
        """
        chain = [start_idx]
        idx = start_idx + 1

        while idx < len(nodes):
            node = nodes[idx]
            if node.type == 'continuation_block':
                chain.append(idx)
                # Check if this continues further
                if not self.is_continuation_start(node, source_bytes):
                    # This is the last block in the chain
                    break
                idx += 1
            else:
                # Non-continuation block, chain is broken
                break

        return chain

    def calculate_continuation_chain_points(
        self,
        chain_nodes: List,
        state: CalculationState,
        source_bytes: bytes
    ) -> Tuple[BlockPoints, str]:
        """Calculate points for an entire continuation chain.

        Args:
            chain_nodes: List of nodes in the continuation chain
            state: Current calculation state
            source_bytes: Source code as bytes

        Returns:
            Tuple of (BlockPoints, final_end_time_str): Calculated points and final end time
        """
        from .parser import node_text

        # Collect data from all blocks in the chain
        all_categories = []
        is_x_chain = False
        prev_imagined_end = None  # Track imagined end as we process the chain
        final_end_time = None
        final_work_minutes = None
        first_start_time = None

        # Track which node has an error (if any)
        error_node_index = None
        for i, node in enumerate(chain_nodes):
            # Check for ERROR children indicating parse failure
            has_error_child = any(child.type == 'ERROR' for child in node.children)
            if has_error_child:
                error_node_index = i
                break

        if error_node_index is not None:
            # Return tuple: (error_message, None, error_node_index)
            # The error_node_index tells caller which node in chain has the error
            # Determine what kind of error this is
            error_node = chain_nodes[error_node_index]
            error_text = node_text(error_node, source_bytes)

            import re
            # Check for invalid time pattern
            invalid_time_match = re.search(r'\d{1,2}:\d(?:\s|$)', error_text)
            if invalid_time_match:
                invalid_time = invalid_time_match.group().strip()
                error_msg = f"[ERROR] invalid time format '{invalid_time}' - use HH:MM with 2-digit minutes"
            # Check for missing work marker
            elif re.search(r'\[\w+\]\s+[^~\[]+(?:---|\+|$)', error_text):
                error_msg = "[ERROR] missing work duration marker - use ~ or explicit [minutes]"
            else:
                error_msg = "[ERROR] syntax error in continuation block"

            return (error_msg, None, error_node_index)

        for i, node in enumerate(chain_nodes):

            # Extract start time
            time_nodes = self.find_all_times(node)
            start_time = node_text(time_nodes[0], source_bytes) if len(time_nodes) > 0 else None
            end_time = node_text(time_nodes[1], source_bytes) if len(time_nodes) > 1 else None

            # Validate time formats
            if start_time and not self.validate_time_format(start_time):
                return (f"[ERROR] invalid time format: {start_time}", None)
            if end_time and not self.validate_time_format(end_time):
                return (f"[ERROR] invalid time format: {end_time}", None)

            # Validate start time boundary (only for first block in chain)
            if i == 0 and start_time:
                is_valid, boundary_error = self.validate_start_time_boundary(start_time)
                if not is_valid:
                    return (f"[ERROR] {boundary_error}", None)

            if i == 0:
                first_start_time = start_time

            # Check if this block is marked as x-block
            if self.detect_x_block(node, source_bytes):
                is_x_chain = True

            # Find blick_list
            blick_list_node = None
            for child in node.children:
                if child.type == 'blick_list':
                    blick_list_node = child
                    break

            if blick_list_node:
                # Collect categories from this block
                categories = self.extract_categories(blick_list_node, source_bytes)
                all_categories.extend(categories)

                # Calculate work duration for this block
                num_blicks = self.count_blicks(blick_list_node, source_bytes)
                work_minutes = num_blicks * 3

                # If this is not the final block (no end time), calculate imagined end
                if end_time is None:
                    # Imagined end = previous_end (or previous_imagined_end) + work + grace
                    # x-blocks: no grace (0 min)
                    # Standard blocks: +1 min grace
                    grace = 0 if is_x_chain else 1

                    # Start from previous block's end or imagined end
                    if prev_imagined_end:
                        # Use previous imagined end in the chain
                        base_mins = self.parse_time(prev_imagined_end)
                    elif state.previous_end_time:
                        # First block in chain, use previous block's actual end
                        base_mins = self.parse_time(state.previous_end_time)
                    else:
                        # Very first block in file
                        base_mins = self.parse_time(start_time)

                    imagined_mins = base_mins + work_minutes + grace
                    prev_imagined_end = f"{imagined_mins // 60:02d}:{imagined_mins % 60:02d}"
                else:
                    # This is the final block
                    final_end_time = end_time
                    final_work_minutes = work_minutes

        # If we don't have a final end time, we can't calculate points
        if final_end_time is None or final_work_minutes is None:
            # Return a placeholder - this continuation chain is incomplete
            return (BlockPoints(0, 0, 0, 0, "0"), None)

        # Calculate base points for the final block
        # Threshold for final block is standard 12 minutes
        threshold = 12

        end_mins = self.parse_time(final_end_time)

        if len(chain_nodes) > 1:
            # Multiple blocks in chain: use imagined end of previous block within chain
            prev_end_mins = self.parse_time(prev_imagined_end)
            expected_end = prev_end_mins + threshold
        elif state.previous_end_time:
            # Single block chain with previous block: use actual previous end time
            prev_end_mins = self.parse_time(state.previous_end_time)
            expected_end = prev_end_mins + threshold
        else:
            # First block in file or after break: apply offset
            start_mins = self.parse_time(first_start_time)
            expected_end = start_mins + threshold + state.time_offset

        base = expected_end - end_mins

        # Focus and accumulation points
        if is_x_chain:
            focus = 0
            accumulation = 0
            has_focus = False
        else:
            # Aggregate all unique categories from the chain
            unique_focus_cats = set(all_categories) & state.focus_categories
            focus = len(unique_focus_cats)
            has_focus = focus > 0
            accumulation = state.accumulation if has_focus else 0

        # Build points notation
        block_total = base + focus + accumulation
        running_total = state.running_total + block_total
        expected = self.build_points_notation(base, focus, accumulation, running_total)

        return (BlockPoints(
            base=base,
            focus=focus,
            accumulation=accumulation,
            total=block_total,
            expected=expected
        ), final_end_time)

    def calculate_block_points(
        self,
        start_time: str,
        end_time: str,
        categories: List[str],
        state: CalculationState,
        is_x_block: bool = False,
        block_type: str = "standard"  # "standard" (3-blick), "x2" (2-blick), "x1" (1-blick), "start4" (4-blick)
    ) -> BlockPoints:
        """Calculate points for a single block.

        A "blick" is a 3-minute chunk.

        Args:
            start_time: Block start time HH:MM
            end_time: Block end time HH:MM
            categories: List of category names
            state: Current calculation state
            is_x_block: Whether this is an x-block
            block_type: Type of block for threshold calculation

        Returns:
            BlockPoints: Calculated points breakdown
        """
        # Determine threshold based on block type (in minutes)
        # Blick count determines the expected duration
        if block_type == "start4":
            threshold = 16  # 4-blick start block (12 min + 4 min grace)
        elif block_type == "x1":
            threshold = 3   # 1-blick x-block (3 min)
        elif block_type == "x2":
            threshold = 6   # 2-blick x-block (6 min)
        else:  # "standard"
            threshold = 12  # Standard 3-blick block (9 min + 3 min grace)

        # Calculate base points: minutes difference from (previous_end + threshold) or (start + threshold + offset)
        # Base = expected_end - current_end
        end_mins = self.parse_time(end_time)

        if state.previous_end_time:
            # Normal case: calculate from previous block's actual end time
            prev_end_mins = self.parse_time(state.previous_end_time)
            expected_end = prev_end_mins + threshold
            base = expected_end - end_mins
        else:
            # First block or after break: calculate from (start + threshold + offset)
            # offset is preserved across breaks
            start_mins = self.parse_time(start_time)
            expected_end = start_mins + threshold + state.time_offset
            base = expected_end - end_mins

        # x-blocks NEVER get focus or accumulation points
        if is_x_block:
            focus = 0
            accumulation = 0
            has_focus = False
        else:
            # Focus points: +1f per unique focus category present
            unique_focus_cats = set(categories) & state.focus_categories
            focus = len(unique_focus_cats)
            has_focus = focus > 0

            # Accumulation points: only awarded if block has focus
            # If no focus, accumulation will be reset after this block
            accumulation = state.accumulation if has_focus else 0

        # Block total (this block only)
        block_total = base + focus + accumulation

        # Running total (cumulative across all blocks)
        running_total = state.running_total + block_total

        # Build expected notation with running total
        expected = self.build_points_notation(base, focus, accumulation, running_total)

        return BlockPoints(
            base=base,
            focus=focus,
            accumulation=accumulation,
            total=block_total,
            expected=expected
        )

    def build_points_notation(self, base: int, focus: int, accumulation: int, running_total: int) -> str:
        """Build the expected points notation string.

        Args:
            base: Base points
            focus: Focus points
            accumulation: Accumulation points
            running_total: Running total after this block

        Returns:
            str: Points notation like "-2,+2f,+1a=1" or "=5" or "0"
        """
        parts = []
        if base != 0:
            parts.append(str(base) if base < 0 else f"+{base}")
        if focus > 0:
            parts.append(f"+{focus}f")
        if accumulation > 0:
            parts.append(f"+{accumulation}a")

        if parts:
            return ','.join(parts) + f"={running_total}"
        else:
            return f"={running_total}" if running_total != 0 else "0"

    def parse_points_notation(self, points_text: str) -> Optional[int]:
        """Parse points notation to extract the total.

        Args:
            points_text: Points notation like "(-2,+2f,+1a=1)" or "(0)"

        Returns:
            Optional[int]: The total points, or None if invalid
        """
        # Remove outer parens
        points_text = points_text.strip().strip('()')

        # Simple case: just a number
        if re.match(r'^-?\d+$', points_text):
            return int(points_text)

        # Complex case: -2,+2f,+1a=1
        if '=' in points_text:
            try:
                total_str = points_text.split('=')[-1]
                return int(total_str)
            except (ValueError, IndexError):
                return None

        return None

    def update_accumulation(self, state: CalculationState, has_focus: bool, is_x_block: bool):
        """Update accumulation counter after a block.

        Args:
            state: Current calculation state
            has_focus: Whether block had any focus categories
            is_x_block: Whether this was an x-block
        """
        if is_x_block:
            # x-blocks reset accumulation to +1a
            state.accumulation = 1
        elif has_focus:
            # Block with focus: increment accumulation (max 10, then wrap to 1)
            if state.accumulation >= 10:
                state.accumulation = 1
            else:
                state.accumulation += 1
        else:
            # No focus: reset to +1a
            state.accumulation = 1

    def process_nodes(self, nodes, source_bytes):
        """Process nodes and calculate expected points.

        Args:
            nodes: List of root-level nodes
            source_bytes: Source code as bytes

        Returns:
            Tuple of (issues_list, state_dict, block_points_map, category_minutes)
            - issues_list: List of (line_num, byte_offset, expected, actual)
            - state_dict: Final calculation state
            - block_points_map: Dict of node -> (BlockPoints, final_end_time)
            - category_minutes: Dict of base_category -> total_minutes
        """
        from .parser import node_text

        state = CalculationState()
        issues = []
        block_points_map = {}  # node -> (BlockPoints, end_time)
        category_minutes = {}  # Track minutes per category (base category only)

        i = 0
        # Walk through all blocks sequentially
        while i < len(nodes):
            node = nodes[i]

            # Stop processing if we hit the end marker (===)
            if node.type == 'end_marker':
                break

            # Check for ERROR nodes (syntax errors)
            if node.type == 'ERROR':
                line_num = node.start_point[0] + 1
                error_text = node_text(node, source_bytes)

                # Check if next line is blank (suppress errors on incomplete last line)
                source_lines = source_bytes.decode('utf-8').split('\n')
                if line_num < len(source_lines):
                    next_line = source_lines[line_num].strip()  # line_num is 1-indexed, array is 0-indexed
                    if not next_line:
                        # Next line is blank - suppress this error (incomplete line being edited)
                        i += 1
                        continue

                # Check if this ERROR is actually metadata line(s): [category] [text] - HH:MM
                # Subject is optional (for summary lines)
                # ERROR nodes can span multiple lines, so check if ALL lines are metadata
                error_lines = error_text.strip().split('\n')
                all_metadata = all(
                    re.match(r'^\s*\[[^\]]+\]\s+(.+\s+)?-\s+\d{1,2}:\d{2}\s*$', line.strip())
                    for line in error_lines if line.strip()
                )
                if all_metadata:
                    # This ERROR contains only metadata lines - skip it, no error
                    i += 1
                    continue

                # Check if this ERROR is actually a date header
                if line_num == 1 and self.extract_date_header(error_text):
                    # This is a date header - skip it, no error
                    i += 1
                    continue

                # Try to identify specific error patterns for better messages
                # Look for invalid time pattern (digit(s):single-digit at end)
                invalid_time_match = re.search(r'\d{1,2}:\d(?:\s|$)', error_text)
                if invalid_time_match:
                    invalid_time = invalid_time_match.group().strip()
                    error_msg = f"[ERROR] invalid time format '{invalid_time}' - use HH:MM with 2-digit minutes"
                # Check for dash between blicks (ERROR node ends with dash, contains blick_list)
                elif error_text.rstrip().endswith('-') and any(child.type == 'blick_list' for child in node.children):
                    error_msg = f"[ERROR] syntax error: {error_text.strip()} (use ',' to separate blicks)"
                # Check for missing work marker (category + subject without ~ or [minutes])
                elif re.search(r'\[\w+\]\s+[^~\[]+(?:---|\+|$)', error_text):
                    error_msg = f"[ERROR] syntax error: {error_text.strip()} (missing ~ or [minutes])"
                else:
                    # Show the actual invalid syntax
                    error_msg = f"[ERROR] syntax error: {error_text.strip()}"
                issues.append((line_num, node.start_byte, error_msg, ""))
                block_points_map[id(node)] = (error_msg, None)
                i += 1
                continue

            if node.type == 'focus_declaration':
                # Update focus categories - collect category nodes directly
                categories = []
                for child in node.children:
                    if child.type == 'category':
                        cat_text = node_text(child, source_bytes)
                        cat_name = cat_text.strip('[]')
                        categories.append(cat_name)
                state.focus_categories = set(categories)
                i += 1

            elif node.type == 'freeform_declaration':
                # Mark that we're in freeform section - process metadata lines following it
                state.in_freeform = True
                i += 1

            elif node.type in ['time_block', 'continuation_block']:
                # Check if this starts a continuation chain
                if self.is_continuation_start(node, source_bytes):
                    # Collect the entire continuation chain
                    chain_indices = self.collect_continuation_chain(nodes, i, source_bytes)
                    chain_nodes = [nodes[idx] for idx in chain_indices]

                    # Process the entire chain
                    result = self.calculate_continuation_chain_points(
                        chain_nodes, state, source_bytes
                    )

                    # Check if result has 3 elements (error with node index) or 2 elements (normal)
                    if len(result) == 3:
                        # Error with specific node index
                        expected_points, final_end_time, error_node_index = result
                        error_node = chain_nodes[error_node_index]
                        line_num = error_node.start_point[0] + 1
                        issues.append((line_num, error_node.start_byte, expected_points, ""))
                        # Only store error for the specific node that has the error
                        block_points_map[id(error_node)] = (expected_points, None)
                        i = chain_indices[-1] + 1
                        continue
                    else:
                        expected_points, final_end_time = result

                    # Check if there was an error (expected_points will be an error string)
                    if isinstance(expected_points, str):
                        # Error occurred (old-style error without node index)
                        first_node = chain_nodes[0]
                        line_num = first_node.start_point[0] + 1
                        issues.append((line_num, first_node.start_byte, expected_points, ""))
                        for chain_node in chain_nodes:
                            block_points_map[id(chain_node)] = (expected_points, None)
                        i = chain_indices[-1] + 1
                        continue

                    # If the chain is incomplete (no final end time), skip it
                    if final_end_time is None:
                        # Skip this incomplete chain
                        i = chain_indices[-1] + 1
                        continue

                    # VALIDATION: Check each line in continuation chain has valid blick count
                    chain_error = False
                    for chain_node in chain_nodes:
                        is_x_block = self.detect_x_block(chain_node, source_bytes)

                        # Count ALL blick_lists in this node (recursively for ERROR nodes)
                        def find_all_blick_lists(node):
                            """Recursively find all blick_list nodes."""
                            found = []
                            if node.type == 'blick_list':
                                found.append(node)
                            for child in node.children:
                                found.extend(find_all_blick_lists(child))
                            return found

                        total_blicks = 0
                        blick_lists_found = find_all_blick_lists(chain_node)
                        for blick_list_node in blick_lists_found:
                            num_blicks = self.count_blicks(blick_list_node, source_bytes)
                            total_blicks += num_blicks

                        # Only validate if we found blick_lists
                        if blick_lists_found:
                            # Standard blocks/lines should have 3 blicks total
                            if not is_x_block and total_blicks != 3:
                                line_num = chain_node.start_point[0] + 1
                                error_msg = f"[ERROR] standard block must have 3 blicks (9 minutes), found {total_blicks} blicks"
                                issues.append((
                                    line_num,
                                    chain_node.start_byte,
                                    error_msg,
                                    ""
                                ))
                                block_points_map[id(chain_node)] = (error_msg, None)
                                chain_error = True
                                break
                        if chain_error:
                            break

                    if chain_error:
                        # Stop processing after error
                        i = chain_indices[-1] + 1
                        break

                    # Find points node in the final block
                    final_node = chain_nodes[-1]
                    points_node = self.find_points_node(final_node)

                    # Check if actual points match expected
                    expected_running_total = state.running_total + expected_points.total

                    if points_node:
                        actual_text = node_text(points_node, source_bytes)
                        actual_total = self.parse_points_notation(actual_text)

                        if actual_total != expected_running_total:
                            # Found a discrepancy
                            line_num = points_node.start_point[0] + 1
                            byte_offset = points_node.start_byte
                            issues.append((
                                line_num,
                                byte_offset,
                                f"({expected_points.expected})",
                                actual_text
                            ))

                    # Store in map for each block in chain
                    for chain_node in chain_nodes:
                        block_points_map[id(chain_node)] = (expected_points, final_end_time)

                    # Update state
                    state.running_total = expected_running_total

                    # Determine if chain has focus (for accumulation)
                    # We need to extract all categories again (already done in calculate_continuation_chain_points)
                    # For now, let's extract from final block to check focus
                    final_blick_list = None
                    for child in final_node.children:
                        if child.type == 'blick_list':
                            final_blick_list = child
                            break

                    # Actually, we need ALL categories from the chain
                    all_cats = []
                    is_x_chain = False
                    for chain_node in chain_nodes:
                        if self.detect_x_block(chain_node, source_bytes):
                            is_x_chain = True
                        for child in chain_node.children:
                            if child.type == 'blick_list':
                                all_cats.extend(self.extract_categories(child, source_bytes))

                    # Track category minutes for continuation chains (each blick = 4 minutes)
                    for cat in all_cats:
                        base_cat = self.get_base_category(cat)
                        if base_cat not in category_minutes:
                            category_minutes[base_cat] = 0
                        category_minutes[base_cat] += 4  # Each blick is 4 minutes

                    has_focus = len(set(all_cats) & state.focus_categories) > 0 if not is_x_chain else False
                    self.update_accumulation(state, has_focus, is_x_chain)

                    # Calculate and update time offset
                    # Offset = how many minutes past the standard 12-minute block boundary
                    # For continuation chains, use the first block's start time
                    end_mins = self.parse_time(final_end_time)
                    first_time_nodes = self.find_all_times(chain_nodes[0])
                    first_start = node_text(first_time_nodes[0], source_bytes)
                    start_mins = self.parse_time(first_start)

                    # Standard block boundary = first block start + 12 minutes
                    standard_boundary = start_mins + 12

                    # Offset = how far past (or before) the standard boundary we ended
                    state.time_offset = end_mins - standard_boundary
                    state.previous_end_time = final_end_time
                    state.previous_start_time = first_start
                    state.is_first_block = False

                    # Skip all blocks in the chain
                    i = chain_indices[-1] + 1
                    continue

                # Not a continuation chain, process as single block
                # Extract times (may be nested in terminator)
                time_nodes = self.find_all_times(node)
                start_time = node_text(time_nodes[0], source_bytes) if len(time_nodes) > 0 else None
                end_time = node_text(time_nodes[1], source_bytes) if len(time_nodes) > 1 else None

                # Validate time formats
                if start_time and not self.validate_time_format(start_time):
                    line_num = node.start_point[0] + 1
                    error_msg = f"[ERROR] invalid time format: {start_time}"
                    issues.append((line_num, node.start_byte, error_msg, ""))
                    block_points_map[id(node)] = (error_msg, end_time)
                    i += 1
                    continue
                if end_time and not self.validate_time_format(end_time):
                    line_num = node.start_point[0] + 1
                    error_msg = f"[ERROR] invalid time format: {end_time}"
                    issues.append((line_num, node.start_byte, error_msg, ""))
                    block_points_map[id(node)] = (error_msg, end_time)
                    i += 1
                    continue

                # Validate start time boundary
                if start_time:
                    is_valid, boundary_error = self.validate_start_time_boundary(start_time)
                    if not is_valid:
                        line_num = node.start_point[0] + 1
                        error_msg = f"[ERROR] {boundary_error}"
                        issues.append((line_num, node.start_byte, error_msg, ""))
                        block_points_map[id(node)] = (error_msg, end_time)
                        i += 1
                        continue

                # VALIDATION: After a start block, next block must be at next standard boundary
                if state.previous_start_time and self.is_start_boundary(state.previous_start_time):
                    expected_next = self.get_next_standard_boundary(state.previous_start_time)
                    if start_time != expected_next:
                        line_num = node.start_point[0] + 1
                        error_msg = f"[ERROR] after start block at {state.previous_start_time}, next block must start at {expected_next}, not {start_time}"
                        issues.append((line_num, node.start_byte, error_msg, ""))
                        block_points_map[id(node)] = (error_msg, end_time)
                        i += 1
                        continue

                # Check for ERROR nodes within this block (syntax errors)
                def find_error_nodes(n):
                    """Recursively find all ERROR nodes."""
                    found = []
                    if n.type == 'ERROR':
                        found.append(n)
                    for child in n.children:
                        found.extend(find_error_nodes(child))
                    return found

                error_nodes = find_error_nodes(node)
                if error_nodes:
                    # There's a syntax error in this block
                    line_num = node.start_point[0] + 1

                    # Check if next line is blank (suppress errors on incomplete last line)
                    source_lines = source_bytes.decode('utf-8').split('\n')
                    if line_num < len(source_lines):
                        next_line = source_lines[line_num].strip()  # line_num is 1-indexed, array is 0-indexed
                        if not next_line:
                            # Next line is blank - suppress this error (incomplete line being edited)
                            i += 1
                            continue

                    error_text = node_text(error_nodes[0], source_bytes).strip()
                    error_msg = f"[ERROR] syntax error: {error_text}"
                    issues.append((line_num, node.start_byte, error_msg, ""))
                    block_points_map[id(node)] = (error_msg, end_time)
                    i += 1
                    continue

                # Find ALL blick_list nodes (recursively, important for ERROR nodes with multiple lists)
                def find_all_blick_lists(n):
                    """Recursively find all blick_list nodes."""
                    found = []
                    if n.type == 'blick_list':
                        found.append(n)
                    for child in n.children:
                        found.extend(find_all_blick_lists(child))
                    return found

                blick_lists = find_all_blick_lists(node)
                blick_list_node = blick_lists[0] if blick_lists else None

                # Find points node (may be nested in terminator)
                points_node = self.find_points_node(node)

                # Calculate expected points
                if start_time and end_time and blick_list_node:
                    # For ERROR nodes with multiple blick_lists, collect categories from all
                    categories = []
                    for bl in blick_lists:
                        categories.extend(self.extract_categories(bl, source_bytes))

                    is_x_block = self.detect_x_block(node, source_bytes)

                    # Count blicks from ALL blick_lists (important for ERROR nodes)
                    num_blicks = sum(self.count_blicks(bl, source_bytes) for bl in blick_lists)

                    # Track category minutes (each blick = 4 minutes)
                    for cat in categories:
                        base_cat = self.get_base_category(cat)
                        if base_cat not in category_minutes:
                            category_minutes[base_cat] = 0
                        category_minutes[base_cat] += 4  # Each blick is 4 minutes

                    # Validate block duration against next block start time
                    start_mins = self.parse_time(start_time)
                    end_mins = self.parse_time(end_time)
                    actual_duration = end_mins - start_mins

                    # Calculate work minutes from blick list
                    work_minutes = 0
                    for child in blick_list_node.children:
                        if child.type == 'blick':
                            for subchild in child.children:
                                if subchild.type == 'minutes':
                                    mins_text = node_text(subchild, source_bytes).strip('[]')
                                    mins_notation = int(mins_text)
                                    # Convert notation to actual minutes ([10]->9, [13]->12)
                                    work_minutes += self.convert_blick_notation_to_minutes(mins_notation)

                    # VALIDATION: Check for time travel (current block ends before previous block ended)
                    if state.previous_end_time:
                        prev_end_mins = self.parse_time(state.previous_end_time)
                        if end_mins < prev_end_mins:
                            line_num = node.start_point[0] + 1
                            error_msg = f"[ERROR] block ends at {end_time} before previous block ended at {state.previous_end_time} (time travel not allowed)"
                            issues.append((
                                line_num,
                                node.start_byte,
                                error_msg,
                                ""
                            ))
                            block_points_map[id(node)] = (error_msg, end_time)
                            i += 1
                            continue

                    # VALIDATION: Check x-block marking
                    # Rule: prefix with 'x' when previous block ended ≥6 minutes after current start time
                    if state.previous_end_time:
                        prev_end_mins = self.parse_time(state.previous_end_time)
                        minutes_late = prev_end_mins - start_mins

                        if not is_x_block and minutes_late >= 6:
                            # This block should be an x-block but isn't marked
                            line_num = node.start_point[0] + 1
                            error_msg = f"[ERROR] previous block ended {minutes_late}min after this start, should be x-block"
                            issues.append((
                                line_num,
                                node.start_byte,
                                error_msg,
                                ""
                            ))
                            block_points_map[id(node)] = (error_msg, end_time)
                            # Stop processing - don't calculate subsequent lines after error
                            break
                        elif is_x_block and minutes_late < 6:
                            # This block is marked as x-block but shouldn't be
                            line_num = node.start_point[0] + 1
                            error_msg = f"[ERROR] previous block ended only {minutes_late}min after this start, should NOT be x-block"
                            issues.append((
                                line_num,
                                node.start_byte,
                                error_msg,
                                ""
                            ))
                            block_points_map[id(node)] = (error_msg, end_time)
                            # Stop processing - don't calculate subsequent lines after error
                            break
                        elif is_x_block and minutes_late >= 6:
                            # Validate x-block size based on how late previous block ended
                            # 6-11 minutes late: 2-blick x-block [6]
                            # ≥12 minutes late: 1-blick x-block [3]
                            expected_blicks = 1 if minutes_late >= 12 else 2
                            if num_blicks != expected_blicks:
                                line_num = node.start_point[0] + 1
                                expected_desc = "1-blick x-block [3]" if expected_blicks == 1 else "2-blick x-block [6]"
                                range_desc = "≥12min" if expected_blicks == 1 else "6-11min"
                                error_msg = f"[ERROR] previous block ended {minutes_late}min late ({range_desc}), must use {expected_desc}, found {num_blicks} blicks"
                                issues.append((
                                    line_num,
                                    node.start_byte,
                                    error_msg,
                                    ""
                                ))
                                block_points_map[id(node)] = (error_msg, end_time)
                                # Stop processing - don't calculate subsequent lines after error
                                break

                    # Determine block type
                    if num_blicks == 4:
                        block_type = "start4"
                    elif is_x_block and num_blicks == 1:
                        block_type = "x1"
                    elif is_x_block and num_blicks == 2:
                        block_type = "x2"
                    else:
                        block_type = "standard"

                    # VALIDATION: Check standard blocks have exactly 3 blicks
                    if block_type == "standard" and num_blicks != 3:
                        line_num = node.start_point[0] + 1
                        error_msg = f"[ERROR] standard block must have 3 blicks (9 minutes), found {num_blicks} blicks"
                        issues.append((
                            line_num,
                            node.start_byte,
                            error_msg,
                            ""
                        ))
                        block_points_map[id(node)] = (error_msg, end_time)
                        # Stop processing - don't calculate subsequent lines after error
                        break

                    expected_points = self.calculate_block_points(
                        start_time, end_time, categories, state, is_x_block, block_type
                    )

                    # Store in map
                    block_points_map[id(node)] = (expected_points, end_time)

                    # Calculate expected running total
                    expected_running_total = state.running_total + expected_points.total

                    # Check if actual points match expected
                    if points_node:
                        actual_text = node_text(points_node, source_bytes)
                        actual_total = self.parse_points_notation(actual_text)

                        if actual_total != expected_running_total:
                            # Found a discrepancy
                            line_num = points_node.start_point[0] + 1
                            byte_offset = points_node.start_byte
                            issues.append((
                                line_num,
                                byte_offset,
                                f"({expected_points.expected})",
                                actual_text
                            ))

                    # Update state
                    state.running_total = expected_running_total
                    has_focus = len(set(categories) & state.focus_categories) > 0
                    self.update_accumulation(state, has_focus, is_x_block)

                    # Calculate and update time offset for this block
                    # Offset = how many minutes past the standard 12-minute block boundary
                    # This is preserved across breaks
                    end_mins = self.parse_time(end_time)
                    start_mins = self.parse_time(start_time)

                    # Standard block boundary = start + 12 minutes
                    standard_boundary = start_mins + 12

                    # Offset = how far past (or before) the standard boundary we ended
                    state.time_offset = end_mins - standard_boundary
                    state.previous_end_time = end_time
                    state.previous_start_time = start_time
                    state.is_first_block = False

                i += 1

            elif node.type == 'rest_block':
                # Rest blocks [...] work like breaks but DON'T reset accumulation
                # Offset is preserved, previous_end_time is cleared so next block
                # uses start + threshold + offset calculation
                # This makes the timesheet work "as if there was no break at all"
                state.previous_end_time = None
                state.previous_start_time = None
                state.is_first_block = True
                # Note: accumulation is NOT reset for rest blocks
                i += 1

            elif node.type == 'break_marker':
                # Break markers ;;; reset accumulation but preserve time_offset
                # Otherwise work exactly like rest blocks
                # This makes the timesheet work "as if there was no break at all" except accumulation resets
                state.accumulation = 1
                state.previous_end_time = None
                state.previous_start_time = None
                state.is_first_block = True
                i += 1

            elif node.type in ['metadata_line', 'date_header']:
                # Skip metadata lines and date headers - no calculations needed
                i += 1

            else:
                # Unknown node type, skip
                i += 1

        return issues, state, block_points_map, category_minutes

    def calculate_file(self, file_path: str) -> List[Tuple[int, int, str, str]]:
        """Calculate points for entire file and find discrepancies.

        Args:
            file_path: Path to .sxiva file

        Returns:
            List of tuples: (line_num, byte_offset, expected, actual)
        """
        tree, source_code = self.parser.parse_file(file_path)
        source_bytes = source_code.encode('utf-8')

        root = tree.root_node
        nodes = list(root.children)

        issues, state, block_points_map, category_minutes = self.process_nodes(nodes, source_bytes)
        return issues

    def get_base_category(self, category: str) -> str:
        """Extract base category from complex category.

        Examples:
            [sp/a] -> sp
            [sp/b] -> sp
            [wr] -> wr
            [err] -> err

        Args:
            category: Category string (with or without brackets)

        Returns:
            str: Base category without brackets or slashes
        """
        # Remove brackets
        cat = category.strip('[]')
        # Split on slash and take first part
        base = cat.split('/')[0]
        return base

    def format_time_duration(self, total_minutes: int) -> str:
        """Format minutes as HH:MM.

        Args:
            total_minutes: Total minutes

        Returns:
            str: Formatted as HH:MM (e.g., "02:08" for 128 minutes)
        """
        hours = total_minutes // 60
        minutes = total_minutes % 60
        return f"{hours:02d}:{minutes:02d}"

    def parse_freeform_time(self, text: str) -> int:
        """Parse time ranges and explicit minutes from freeform text.

        Args:
            text: Freeform text containing time ranges (HH:MM-HH:MM) and/or explicit minutes (6m, 1h, 1h30m)

        Returns:
            Total minutes from all matched patterns
        """
        total_minutes = 0

        # Match time ranges: HH:MM-HH:MM
        time_range_pattern = r'(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})'
        for match in re.finditer(time_range_pattern, text):
            start_hour, start_min, end_hour, end_min = map(int, match.groups())
            start_total = start_hour * 60 + start_min
            end_total = end_hour * 60 + end_min
            duration = end_total - start_total
            if duration > 0:  # Only count positive durations
                total_minutes += duration

        # Match explicit minutes: (\d+h)?\d+m (e.g., 6m, 1h, 1h30m, 2h15m)
        explicit_pattern = r'(?:(\d+)h)?(\d+)m'
        for match in re.finditer(explicit_pattern, text):
            hours_str, minutes_str = match.groups()
            hours = int(hours_str) if hours_str else 0
            minutes = int(minutes_str) if minutes_str else 0
            total_minutes += hours * 60 + minutes

        return total_minutes

    def process_freeform_line(self, line: str) -> tuple:
        """Process a freeform metadata line and calculate total time.

        Args:
            line: Freeform line like "[wf] task, 18:56-19:47, 6m - 01:15"

        Returns:
            tuple: (category, total_minutes, updated_line)
        """
        # Extract category
        cat_match = re.match(r'\s*\[([^\]]+)\]', line)
        if not cat_match:
            return None, 0, line

        category = cat_match.group(1)

        # Remove existing total if present (everything after last " - HH:MM")
        line_without_total = re.sub(r'\s+-\s+\d{1,2}:\d{2}\s*$', '', line)

        # Calculate total from time ranges and explicit minutes
        total_minutes = self.parse_freeform_time(line_without_total)

        # Format and append total
        time_str = self.format_time_duration(total_minutes)
        updated_line = f"{line_without_total.rstrip()} - {time_str}"

        return category, total_minutes, updated_line

    def generate_summary_lines(self, category_minutes: dict) -> list:
        """Generate summary lines from category minutes.

        Args:
            category_minutes: Dict of base_category -> total_minutes

        Returns:
            List of summary lines (including blank line before {summary} header)
        """
        lines = ["", "{summary}"]  # Blank line before summary

        # Find the longest category name for alignment
        max_cat_len = max(len(cat) for cat in category_minutes.keys()) if category_minutes else 0

        # Sort categories alphabetically and format with aligned dashes
        for cat in sorted(category_minutes.keys()):
            minutes = category_minutes[cat]
            time_str = self.format_time_duration(minutes)
            # Add padding to align dashes: [cat] gets padded to match longest category
            padding = " " * (max_cat_len - len(cat))
            lines.append(f"    [{cat}]{padding} - {time_str}")

        return lines

    def strip_points_from_line(self, line: str) -> str:
        """Remove point calculations and error messages from a line.

        Args:
            line: Line that may contain points like (+3,+1f,+1a=5) or [ERROR] messages

        Returns:
            str: Line with points and errors stripped
        """
        # Remove point calculations: (anything with =number)
        line = re.sub(r'\s*\([^)]*=[^)]*\)', '', line)
        # Remove error messages
        line = re.sub(r'\s*\[ERROR\][^\n]*', '', line)
        return line.rstrip()

    def get_ordinal_suffix(self, day: int) -> str:
        """Get ordinal suffix for a day number (st, nd, rd, th).

        Args:
            day: Day number (1-31)

        Returns:
            str: Ordinal suffix
        """
        if 10 <= day % 100 <= 20:
            return 'th'
        else:
            suffix_map = {1: 'st', 2: 'nd', 3: 'rd'}
            return suffix_map.get(day % 10, 'th')

    def generate_date_header_from_filename(self, file_path: str) -> Optional[str]:
        """Generate date header from SXIVA filename.

        SXIVA files are named YYYYMMDDd.sxiva where d is day-of-week letter.
        Example: 20251129S.sxiva -> Saturday, November 29th, 2025

        Args:
            file_path: Path to .sxiva file

        Returns:
            Optional[str]: Date header string, or None if filename doesn't match pattern
        """
        filename = Path(file_path).stem  # Get filename without extension

        # Match YYYYMMDD pattern at start
        match = re.match(r'^(\d{8})', filename)
        if not match:
            return None

        date_str = match.group(1)
        try:
            date_obj = datetime.strptime(date_str, '%Y%m%d')
        except ValueError:
            return None

        # Format: DayOfWeek, Month Day(st/nd/rd/th), Year
        day_name = date_obj.strftime('%A')
        month_name = date_obj.strftime('%B')
        day = date_obj.day
        year = date_obj.year
        suffix = self.get_ordinal_suffix(day)

        return f"{day_name}, {month_name} {day}{suffix}, {year}"

    def extract_date_header(self, source_code: str) -> Optional[str]:
        """Extract date header from source code if present.

        Args:
            source_code: Source code content

        Returns:
            Optional[str]: Date header line (without newline), or None if not found
        """
        lines = source_code.split('\n')
        if not lines:
            return None

        first_line = lines[0].strip()

        # Check if first line matches date header pattern
        # DayOfWeek, Month Day(st/nd/rd/th), Year
        pattern = r'^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+' \
                  r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+' \
                  r'\d{1,2}(st|nd|rd|th),\s+\d{4}$'

        if re.match(pattern, first_line):
            return first_line

        return None

    def has_date_filename(self, file_path: str) -> bool:
        """Check if filename starts with YYYYMMDD pattern.

        Args:
            file_path: Path to .sxiva file

        Returns:
            bool: True if filename matches YYYYMMDD pattern
        """
        filename = Path(file_path).stem
        return bool(re.match(r'^\d{8}', filename))

    def fix_file(self, file_path: str, output_path: str = None, dry_run: bool = False) -> int:
        """Fix point calculations, whitespace, and format in a file.

        Args:
            file_path: Path to .sxiva file to read
            output_path: Path to write fixed file (file or directory). If None, write to file_path
            dry_run: If True, don't actually write changes

        Returns:
            int: Number of fixes applied
        """
        from pathlib import Path
        from .parser import node_text

        # Read and pre-process: strip old calculations and errors BEFORE parsing
        with open(file_path, 'r', encoding='utf-8') as f:
            source_code = f.read()

        # Check if filename is in YYYYMMDD format
        has_date_filename = self.has_date_filename(file_path)

        # Generate expected date header from filename (if possible)
        expected_date_header = self.generate_date_header_from_filename(file_path) if has_date_filename else None

        # Check if source has a date header
        existing_date_header = self.extract_date_header(source_code)

        # Prepare source for parsing
        date_header_to_add = None
        date_header_error = None

        if has_date_filename:
            # Filename is YYYYMMDD format - enforce correct date header
            if existing_date_header != expected_date_header:
                # Need to add/fix date header
                date_header_to_add = expected_date_header
                # If there's an existing (wrong) header, remove it
                if existing_date_header:
                    lines = source_code.split('\n')
                    # Remove first line
                    source_code = '\n'.join(lines[1:])
            else:
                # Date header is correct - preserve it
                date_header_to_add = expected_date_header
        else:
            # Filename is NOT YYYYMMDD format
            if existing_date_header:
                # Has a date header - preserve it
                date_header_to_add = existing_date_header
            else:
                # No date header present - add error
                date_header_error = "[ERROR] file not named with date format (YYYYMMDDd.sxiva)"

        # Strip all old point calculations and error messages from the input
        cleaned_lines = []
        for line in source_code.split('\n'):
            cleaned_lines.append(self.strip_points_from_line(line))
        cleaned_source = '\n'.join(cleaned_lines)

        # Now parse the clean source
        tree = self.parser.parse(cleaned_source)
        source_bytes = cleaned_source.encode('utf-8')

        root = tree.root_node
        nodes = list(root.children)

        # First, calculate all expected points using shared logic
        issues, final_state, block_points_map, category_minutes = self.process_nodes(nodes, source_bytes)

        # Track if we've encountered an error (to stop adding calculations after)
        encountered_error = False
        error_line_num = float('inf')

        # Find the first error line from block_points_map
        for node_id, (points_or_error, _) in block_points_map.items():
            if isinstance(points_or_error, str) and points_or_error.startswith("[ERROR]"):
                # Find which line this node is on
                for node in nodes:
                    if id(node) == node_id:
                        error_line_num = min(error_line_num, node.start_point[0])
                        encountered_error = True
                        break

        # Now process line-by-line to apply fixes and formatting
        lines = cleaned_source.split('\n')
        fixed_lines = []

        # Map node start line to node for quick lookup
        node_map = {}

        def map_nodes(node):
            """Recursively map all nodes by line number."""
            if node.start_point[0] not in node_map:
                node_map[node.start_point[0]] = []
            node_map[node.start_point[0]].append(node)
            for child in node.children:
                map_nodes(child)

        map_nodes(root)

        # Track state for formatting (indentation, focus tracking)
        state = CalculationState()

        # Track state while processing
        num_fixes = 0
        after_break = True  # Track if we're right after a break or start
        in_continuation_chain = False  # Track if we're processing a continuation chain
        continuation_indent = ""  # Track indentation for continuation chain
        previous_block_accumulation = 0  # Track previous block's accumulation for rollover detection
        in_freeform_section = False  # Track if we're inside a {freeform} section
        in_summary_section = False  # Track if we're inside a {summary} section
        summary_generated = False  # Track if we've already generated the summary

        for line_idx, line in enumerate(lines):
            # Skip empty lines and comments
            stripped = line.strip()
            if not stripped or stripped.startswith('#'):
                continue

            # Get nodes starting on this line
            nodes_on_line = node_map.get(line_idx, [])

            # Stop processing if we hit the end marker (===)
            if any(n.type == 'end_marker' for n in nodes_on_line):
                # Generate summary before the end marker if not already generated
                if not summary_generated and category_minutes:
                    summary_lines = self.generate_summary_lines(category_minutes)
                    fixed_lines.extend(summary_lines)
                    summary_generated = True
                    num_fixes += 1
                # Preserve everything from === onwards as-is
                fixed_lines.extend(lines[line_idx:])
                break

            # Find the primary node type for this line
            node = None
            for n in nodes_on_line:
                if n.type in ['focus_declaration', 'freeform_declaration', 'summary_declaration', 'time_block', 'continuation_block', 'rest_block', 'break_marker', 'metadata_line', 'date_header', 'ERROR']:
                    node = n
                    break

            if not node:
                # Check if we're in freeform section - process as freeform line
                if in_freeform_section and not in_summary_section and stripped:
                    category, minutes, updated_line = self.process_freeform_line(line)
                    if category:
                        # Add to category totals
                        base_cat = self.get_base_category(category)
                        if base_cat not in category_minutes:
                            category_minutes[base_cat] = 0
                        category_minutes[base_cat] += minutes
                        fixed_lines.append(updated_line)
                        num_fixes += 1
                        continue
                    # If no category, fall through to default handling

                # Check if we're in a summary section (metadata lines without node)
                if in_summary_section:
                    # Skip old summary lines
                    continue

                # If we're past an error line, strip any old calculations from this line
                if line_idx >= error_line_num:
                    fixed_lines.append(self.strip_points_from_line(line))
                else:
                    fixed_lines.append(line)
                continue

            # Process based on node type
            if node.type == 'freeform_declaration':
                # Start of freeform section
                in_freeform_section = True
                fixed_lines.append("")  # Blank line before freeform
                fixed_lines.append("{freeform}")
                continue

            elif node.type == 'summary_declaration':
                # End freeform section, start summary section
                in_freeform_section = False
                # Start of summary section - generate and insert summary
                if not summary_generated:
                    summary_lines = self.generate_summary_lines(category_minutes)
                    fixed_lines.extend(summary_lines)
                    summary_generated = True
                    num_fixes += 1
                in_summary_section = True
                continue

            elif node.type == 'date_header':
                # Date header node was parsed correctly
                # Skip it if we're going to add a date header (avoid duplication)
                if not date_header_to_add:
                    fixed_lines.append(line.strip())
                continue

            elif node.type == 'metadata_line':
                # Check if this is a summary line (no subject, just [cat] - HH:MM)
                # Summary lines match: ^\s*\[category\]\s+-\s+\d{1,2}:\d{2}
                is_summary_line = re.match(r'^\s*\[[^\]]+\]\s+-\s+\d{1,2}:\d{2}\s*$', line)

                # Handle freeform metadata lines (already calculated, just need to add to totals)
                if in_freeform_section and not in_summary_section and not is_summary_line:
                    category, minutes, updated_line = self.process_freeform_line(line)
                    if category:
                        # Add to category totals
                        base_cat = self.get_base_category(category)
                        if base_cat not in category_minutes:
                            category_minutes[base_cat] = 0
                        category_minutes[base_cat] += minutes
                        fixed_lines.append(updated_line)
                        num_fixes += 1
                        continue

                if in_summary_section and is_summary_line:
                    # Skip old summary metadata lines
                    continue
                elif in_summary_section and not is_summary_line:
                    # End of summary section
                    in_summary_section = False

                # Preserve non-summary metadata lines with indentation
                if not is_summary_line:
                    content = line.lstrip()
                    fixed_lines.append(f"    {content}")

            elif node.type == 'focus_declaration':
                # Update focus categories
                categories = []
                for child in node.children:
                    if child.type == 'category':
                        cat_text = node_text(child, source_bytes)
                        cat_name = cat_text.strip('[]')
                        categories.append(cat_name)
                state.focus_categories = set(categories)

                # Indent focus declaration if we're in an accumulation streak
                # (next block will be indented)
                focus_indent = ""
                if state.previous_had_focus and not state.is_first_block:
                    focus_indent = "    "

                focus_content = line.lstrip()
                fixed_lines.append(focus_indent + focus_content)

            elif node.type == 'ERROR':
                # Handle ERROR nodes
                node_id = id(node)
                clean_line = self.strip_points_from_line(line)

                # Check if this looks like a date header (already validated)
                if line_idx == 0 and self.extract_date_header(clean_line):
                    # This is the date header - preserve it (will be replaced if needed)
                    # Don't add it to fixed_lines here, it will be handled by date_header_to_add logic
                    continue

                # Check if this is a summary line (old data to skip)
                is_summary_line = re.match(r'^\s*\[[^\]]+\]\s+-\s+\d{1,2}:\d{2}\s*$', clean_line)
                if in_summary_section and is_summary_line:
                    # Skip old summary lines
                    continue
                elif in_summary_section and not is_summary_line and clean_line.strip():
                    # End of summary section (non-empty, non-summary line)
                    in_summary_section = False

                # Check if this looks like a metadata line: [category] text - HH:MM
                if re.match(r'^\s*\[[^\]]+\]\s+.+\s+-\s+\d{1,2}:\d{2}\s*$', clean_line):
                    # This is a metadata line - preserve with indentation
                    content = clean_line.lstrip()
                    fixed_lines.append(f"    {content}")  # Indent metadata lines
                    continue

                # Regular error handling
                if node_id in block_points_map:
                    error_msg, _ = block_points_map[node_id]
                    if isinstance(error_msg, str) and error_msg.startswith("[ERROR]"):
                        fixed_line = clean_line + f" {error_msg}"
                        fixed_lines.append(fixed_line)
                        num_fixes += 1
                        continue
                # If no error message in map, keep cleaned line
                fixed_lines.append(clean_line)

            elif node.type in ['time_block', 'continuation_block']:
                # Look up expected points from the pre-calculated map
                node_id = id(node)

                # If we're at or past an error line, strip old calculations and don't add new ones
                if line_idx >= error_line_num:
                    clean_line = self.strip_points_from_line(line)
                    if node_id in block_points_map:
                        expected_points, _ = block_points_map[node_id]
                        if isinstance(expected_points, str) and expected_points.startswith("[ERROR]"):
                            # Add error message
                            fixed_lines.append(clean_line + f" {expected_points}")
                            num_fixes += 1
                        else:
                            # Just strip old calculations, don't add new ones after error
                            fixed_lines.append(clean_line)
                    else:
                        fixed_lines.append(clean_line)
                    continue

                if node_id not in block_points_map:
                    # No points calculated for this node (maybe incomplete), skip it
                    fixed_lines.append(line)
                    continue

                expected_points, end_time = block_points_map[node_id]

                # Check if this is an error message instead of points
                if isinstance(expected_points, str) and expected_points.startswith("[ERROR]"):
                    # This is an error - strip old content and write error at the end
                    clean_line = self.strip_points_from_line(line)
                    fixed_line = clean_line + f" {expected_points}"
                    fixed_lines.append(fixed_line)
                    num_fixes += 1
                    continue

                # Skip blocks without end times (continuation blocks without final end)
                if end_time is None:
                    fixed_lines.append(line)
                    continue

                # Extract info we need for formatting
                blick_list_node = None
                for child in node.children:
                    if child.type == 'blick_list':
                        blick_list_node = child
                        break

                categories = self.extract_categories(blick_list_node, source_bytes) if blick_list_node else []
                is_x_block = self.detect_x_block(node, source_bytes)

                # Find points node
                points_node = self.find_points_node(node)

                # Check if this is a continuation block without end time
                time_nodes = self.find_all_times(node)
                has_end_time = len(time_nodes) > 1

                # Fix points calculation if needed
                fixed_line = line
                if has_end_time:
                    # Only add/fix points for blocks with end times
                    if points_node:
                        # Points exist - check if correct
                        actual_text = node_text(points_node, source_bytes)
                        actual_total = self.parse_points_notation(actual_text)

                        # Compare running totals
                        expected_running_total = state.running_total + expected_points.total

                        if actual_total != expected_running_total:
                            # Replace incorrect points notation
                            old_points = actual_text
                            new_points = f"({expected_points.expected})"
                            fixed_line = fixed_line.replace(old_points, new_points)
                            num_fixes += 1
                    else:
                        # No points - add them at the end of the line
                        fixed_line = line.rstrip() + f" ({expected_points.expected})"
                        num_fixes += 1
                else:
                    # Continuation block without end time - don't add points
                    fixed_line = line

                # Apply whitespace linting
                # Indentation rules:
                # - x-blocks: NEVER indented
                # - No indent if: first block, or first +1a after reset (previous block had no focus)
                # - Indent (4 spaces) if: accumulation > 1, or accumulation rolled over from +10a
                # - Continuation blocks: inherit indentation from first block in chain

                # Check if this is a continuation block (type = 'continuation_block')
                is_continuation = node.type == 'continuation_block'

                if is_continuation and in_continuation_chain:
                    # Continuation block: use the same indent as the chain
                    desired_indent = continuation_indent
                    has_focus_now = len(set(categories) & state.focus_categories) > 0 if not is_x_block else False
                else:
                    # Determine if this should be indented based on accumulation value from calculated points
                    should_indent = False
                    has_focus_now = False  # Default for x-blocks

                    if not is_x_block:
                        # Not an x-block, apply normal indentation rules
                        has_focus_now = len(set(categories) & state.focus_categories) > 0

                        # Check the accumulation value that will be shown in this block's points
                        # Indent if accumulation > 1 (i.e., accumulation ≥ 2)
                        # This includes rollover +1a from +10a (which shows as +1a but is still in streak)
                        if expected_points.accumulation >= 2:
                            should_indent = True
                        elif expected_points.accumulation == 1 and previous_block_accumulation == 10:
                            # Special case: rollover from +10a to +1a - still indented
                            should_indent = True
                        else:
                            should_indent = False
                    # else: x-block, should_indent remains False, has_focus_now = False

                    desired_indent = "    " if should_indent else ""

                    # If this is the start of a continuation chain, save the indent
                    if not has_end_time:
                        in_continuation_chain = True
                        continuation_indent = desired_indent

                # If this block has an end time, we're no longer in a continuation chain
                if has_end_time:
                    in_continuation_chain = False

                # Strip existing leading whitespace and apply correct indent
                content = fixed_line.lstrip()
                fixed_line = desired_indent + content

                fixed_lines.append(fixed_line)

                # Update state
                # Only update running total for blocks with end times (final blocks in chains)
                if has_end_time:
                    state.running_total += expected_points.total
                    # Save accumulation before update for rollover detection
                    previous_block_accumulation = expected_points.accumulation
                    self.update_accumulation(state, has_focus_now, is_x_block)
                    state.previous_end_time = end_time
                    state.is_first_block = False

                # Always update previous_had_focus so continuation blocks maintain indent
                state.previous_had_focus = has_focus_now

            elif node.type == 'rest_block':
                # Rest blocks [...] work like breaks but DON'T reset accumulation
                # Offset is preserved, previous_end_time is cleared
                # Indentation is preserved to match previous accumulation level
                rest_indent = ""
                if state.previous_had_focus and state.accumulation > 0:
                    rest_indent = "    "

                rest_content = line.lstrip()
                fixed_lines.append(rest_indent + rest_content)

                state.previous_end_time = None
                state.is_first_block = True
                # Note: accumulation and previous_had_focus are NOT reset for rest blocks

            elif node.type == 'break_marker':
                # Break markers ;;; reset accumulation but preserve time_offset
                # Otherwise work exactly like rest blocks
                state.accumulation = 1
                state.previous_end_time = None
                state.is_first_block = True
                state.previous_had_focus = False  # Reset focus tracking
                after_break = True
                fixed_lines.append(line)

        # Generate summary at EOF if not already generated
        if not summary_generated and category_minutes:
            summary_lines = self.generate_summary_lines(category_minutes)
            fixed_lines.extend(summary_lines)
            summary_generated = True
            num_fixes += 1

        # Join fixed lines
        result = '\n'.join(fixed_lines)

        # Add date header at the beginning if needed
        if date_header_to_add:
            result = date_header_to_add + '\n' + result
            num_fixes += 1
        elif date_header_error:
            # Add error message for missing date filename
            result = date_header_error + '\n' + result
            num_fixes += 1

        # Determine output file path
        if not dry_run:
            if output_path is None:
                output_path = file_path

            # Handle directory output
            output_path_obj = Path(output_path)
            if output_path_obj.is_dir():
                input_filename = Path(file_path).name
                output_path_obj = output_path_obj / input_filename

            with open(output_path_obj, 'w', encoding='utf-8') as f:
                f.write(result)

        return num_fixes
