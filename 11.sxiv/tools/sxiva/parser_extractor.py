#!/usr/bin/env python3
"""
SXIVA Data Extractor

Parses .sxiva files using tree-sitter and extracts data for syncing to the dashboard database.
"""

import re
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Any
from tree_sitter import Language, Parser

# Import the parser module
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from tools.sxiva.parser import SxivaParser
from tools.sxiva.time_parser import parse_duration


class SxivaDataExtractor:
    """Extract structured data from .sxiva files"""

    def __init__(self):
        """Initialize with tree-sitter parser"""
        self.parser = SxivaParser()

    def extract_from_file(self, file_path: Path) -> Optional[Dict[str, Any]]:
        """
        Extract all data from a .sxiva file for database sync.

        Returns dict with:
        - date: str (YYYY-MM-DD)
        - day_of_week: str (U/M/T/W/R/F/S)
        - category_minutes: dict (e.g., {"bkc": 40, "jnl": 32})
        - sleep_score: int | None
        - sleep_hours: float | None
        - dep_min: float | None
        - dep_max: float | None
        - dep_avg: float | None
        - dist: float | None
        - soc: int | None
        - out: int | None
        - exe: int | None
        - alc: float | None
        - xmx: int | None
        - wea: float | None
        - meet: int | None
        - abi: float | None
        - save: int | None
        """
        try:
            with open(file_path, 'r') as f:
                content = f.read()

            # Extract date from filename (e.g., 20250117.sxiva)
            date_str = self._extract_date_from_filename(file_path.name)
            if not date_str:
                return None

            # Parse day of week
            day_of_week = self._get_day_of_week(date_str)

            # Parse tree
            tree = self.parser.parse(content)

            # Extract data
            category_minutes = self._extract_summary(tree, content)
            attributes = self._extract_attributes(tree, content)

            return {
                'date': date_str,
                'day_of_week': day_of_week,
                'category_minutes': category_minutes,
                **attributes
            }

        except Exception as e:
            print(f"Error extracting from {file_path}: {e}", file=sys.stderr)
            return None

    def _extract_date_from_filename(self, filename: str) -> Optional[str]:
        """
        Extract date from filename.

        Examples:
        - 20250117F.sxiva → "2025-01-17"
        - 20241225W.sxiva → "2024-12-25"
        - 20250117.sxiva → "2025-01-17" (also handles without day letter)
        """
        match = re.match(r'(\d{4})(\d{2})(\d{2})[UMTWRFS]?\.sxiva', filename)
        if match:
            year, month, day = match.groups()
            return f"{year}-{month}-{day}"
        return None

    def _get_day_of_week(self, date_str: str) -> str:
        """
        Get day of week from date string.

        Returns: U/M/T/W/R/F/S
        """
        date = datetime.strptime(date_str, '%Y-%m-%d')
        days = ['M', 'T', 'W', 'R', 'F', 'S', 'U']  # Monday=0, Sunday=6
        return days[date.weekday()]

    def _extract_summary(self, tree, content: str) -> Dict[str, int]:
        """
        Extract {summary} section.

        Returns: {"bkc": 40, "jnl": 32, ...}
        """
        category_minutes = {}

        # Find summary section
        summary_node = self._find_node_by_type(tree.root_node, 'summary_section')
        if not summary_node:
            return category_minutes

        # Extract category lines
        for child in summary_node.children:
            if child.type == 'summary_line':
                text = content[child.start_byte:child.end_byte].strip()
                # Parse line like: [bkc] - 00:40
                match = re.match(r'\[([^\]]+)\]\s*-\s*(\d{2}):(\d{2})', text)
                if match:
                    category = match.group(1)
                    hours = int(match.group(2))
                    minutes = int(match.group(3))
                    total_minutes = hours * 60 + minutes

                    # Only include non-zero categories
                    if total_minutes > 0:
                        category_minutes[category] = total_minutes

        return category_minutes

    def _extract_attributes(self, tree, content: str) -> Dict[str, Any]:
        """
        Extract {attributes} section.

        Walks the tree-sitter `attributes_section` node and parses each
        `attributes_line` individually so values can never bleed across lines
        or into following sections (preserved notes, freeform, ===).

        Numeric attribute values must contain at least one digit; a lone "-"
        placeholder for an uncalculated attribute is treated as absent.
        """
        attributes = {
            'sleep_score': None,
            'sleep_hours': None,
            'dep_min': None,
            'dep_max': None,
            'dep_avg': None,
            'dist': None,
            'soc': None,
            'out': None,
            'exe': None,
            'alc': None,
            'xmx': None,
            'wea': None,
            'meet': None,
            'abi': None,
            'save': None
        }

        attr_node = self._find_node_by_type(tree.root_node, 'attributes_section')
        if not attr_node:
            return attributes

        NUM = r'-?\d[\d.]*'  # signed number with at least one digit
        int_attrs = {'soc', 'out', 'exe', 'xmx'}
        float_attrs = {'dist', 'alc', 'wea'}

        for line_node in attr_node.children:
            if line_node.type != 'attributes_line':
                continue

            line = content[line_node.start_byte:line_node.end_byte].strip()
            cat_match = re.match(r'\[([^\]]+)\]\s*(.*)', line)
            if not cat_match:
                continue

            name, rest = cat_match.group(1), cat_match.group(2)

            if name == 'sleep':
                m = re.match(rf'({NUM})\s+({NUM})', rest)
                if m:
                    attributes['sleep_score'] = int(m.group(1))
                    attributes['sleep_hours'] = float(m.group(2))

            elif name == 'dep':
                # [dep] v1 v2 ... = avg ✓
                eq_split = rest.split('=', 1)[0]
                dep_values = [float(x) for x in re.findall(NUM, eq_split)]
                if dep_values:
                    attributes['dep_min'] = min(dep_values)
                    attributes['dep_max'] = max(dep_values)
                    attributes['dep_avg'] = sum(dep_values) / len(dep_values)

            elif name in int_attrs:
                m = re.match(rf'({NUM})', rest)
                if m:
                    attributes[name] = int(float(m.group(1)))

            elif name in float_attrs:
                m = re.match(rf'({NUM})', rest)
                if m:
                    attributes[name] = float(m.group(1))

            elif name == 'meet':
                m = re.match(r'([^\s✓]+)', rest)
                if m:
                    minutes = self._parse_meeting_time(m.group(1))
                    if minutes is not None:
                        attributes['meet'] = minutes

            elif name == 'abi':
                m = re.match(rf'({NUM})', rest)
                if m:
                    attributes['abi'] = float(m.group(1))

            elif name == 'save':
                m = re.match(r'(-?\$\d+)', rest)
                if m:
                    value_str = m.group(1)
                    is_negative = value_str.startswith('-')
                    amount_str = value_str[2:] if is_negative else value_str[1:]
                    amount = int(amount_str)
                    attributes['save'] = -amount if is_negative else amount

        return attributes

    def _parse_meeting_time(self, time_str: str) -> Optional[int]:
        """Parse meeting time format into minutes.

        Supported formats:
        - 5m (minutes only)
        - 1h (hours only)
        - 1h34m (hours and minutes)
        - 1:34 (H:MM format)
        - 01:34 (HH:MM format)
        - 75m (minutes)
        - 1.75h (decimal hours, rounded to nearest minute)
        - 0.5h (decimal hours)
        - 0.25h (decimal hours)

        Args:
            time_str: Time string to parse

        Returns:
            int: Total minutes, or None if invalid format
        """
        return parse_duration(time_str)

    def _find_node_by_type(self, node, node_type: str):
        """Recursively find first node of given type"""
        if node.type == node_type:
            return node

        for child in node.children:
            result = self._find_node_by_type(child, node_type)
            if result:
                return result

        return None


if __name__ == '__main__':
    # Test the extractor
    import json

    extractor = SxivaDataExtractor()

    # Test on a file
    test_file = Path('examples/calculated/full-day.sxiva')
    if test_file.exists():
        data = extractor.extract_from_file(test_file)
        if data:
            print(json.dumps(data, indent=2))
        else:
            print("Failed to extract data")
    else:
        print(f"Test file not found: {test_file}")
