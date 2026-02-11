"""Unified time/duration parsing utilities for SXIVA.

This module provides a single, unified parser for all time and duration formats
used throughout SXIVA files, including:
- {freeform} section time expressions
- {attributes} section duration values (e.g., [meet])
- Any other duration parsing needs

Supported formats:
- 5m           -> 5 minutes
- 1h           -> 60 minutes
- 1h34m        -> 94 minutes
- 1:34         -> 94 minutes (same as 1h34m)
- 01:34        -> 94 minutes (same)
- 75m          -> 75 minutes
- 1.75h        -> 105 minutes (rounded to nearest minute)
- 0.5h         -> 30 minutes
- 0.25h        -> 15 minutes
"""

import re
from typing import Optional


def parse_duration(duration_str: str) -> Optional[int]:
    """Parse a duration string into total minutes.

    Supports all SXIVA duration formats:
    - Minutes only: 5m, 75m
    - Hours only: 1h, 2h
    - Hours and minutes: 1h34m, 2h15m
    - Colon format: 1:34, 01:34 (interpreted as H:MM or HH:MM)
    - Decimal hours: 1.75h, 0.5h, 0.25h (rounded to nearest minute)

    Args:
        duration_str: Duration string to parse

    Returns:
        Total minutes as integer, or None if format is invalid

    Examples:
        >>> parse_duration("5m")
        5
        >>> parse_duration("1h")
        60
        >>> parse_duration("1h34m")
        94
        >>> parse_duration("1:34")
        94
        >>> parse_duration("01:34")
        94
        >>> parse_duration("75m")
        75
        >>> parse_duration("1.75h")
        105
        >>> parse_duration("0.5h")
        30
        >>> parse_duration("0.25h")
        15
    """
    duration_str = duration_str.strip()

    # Format: H:MM or HH:MM (e.g., "1:34", "01:34")
    if ':' in duration_str:
        match = re.match(r'^(\d+):(\d{2})$', duration_str)
        if match:
            hours = int(match.group(1))
            minutes = int(match.group(2))
            return hours * 60 + minutes
        return None

    # Format: X.Yh (decimal hours, e.g., "1.75h", "0.5h", "0.25h")
    match = re.match(r'^(\d+(?:\.\d+)?)h$', duration_str)
    if match:
        hours = float(match.group(1))
        # Round to nearest minute
        return round(hours * 60)

    # Format: XhYm (e.g., "1h34m", "2h15m")
    match = re.match(r'^(\d+)h(\d+)m$', duration_str)
    if match:
        hours = int(match.group(1))
        minutes = int(match.group(2))
        return hours * 60 + minutes

    # Format: Xm (e.g., "5m", "75m")
    match = re.match(r'^(\d+)m$', duration_str)
    if match:
        minutes = int(match.group(1))
        return minutes

    return None


def parse_time_to_minutes_since_midnight(time_str: str) -> int:
    """Parse HH:MM time string to minutes since midnight.

    This is for absolute times (e.g., block start/end times), not durations.

    Args:
        time_str: Time in HH:MM or H:MM format

    Returns:
        Minutes since midnight

    Examples:
        >>> parse_time_to_minutes_since_midnight("14:30")
        870
        >>> parse_time_to_minutes_since_midnight("9:00")
        540
    """
    hours, minutes = map(int, time_str.split(':'))
    return hours * 60 + minutes


def format_duration(minutes: int) -> str:
    """Format minutes as HH:MM duration string.

    Args:
        minutes: Total minutes

    Returns:
        Formatted string as HH:MM

    Examples:
        >>> format_duration(94)
        '01:34'
        >>> format_duration(5)
        '00:05'
        >>> format_duration(125)
        '02:05'
    """
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours:02d}:{mins:02d}"
