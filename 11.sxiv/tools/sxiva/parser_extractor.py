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

        Returns dict with all attribute fields (sleep_score, dep_min, etc.)

        Uses regex directly on content since tree-sitter sometimes splits lines.
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
            'wea': None
        }

        # Find {attributes} section in content
        attr_match = re.search(r'\{attributes\}(.*?)(?:\n\{|$)', content, re.DOTALL)
        if not attr_match:
            return attributes

        attr_section = attr_match.group(1)

        # Parse [sleep] 79 7.0 ~ ✓
        match = re.search(r'\[sleep\]\s+(\d+)\s+([\d.]+)', attr_section)
        if match:
            attributes['sleep_score'] = int(match.group(1))
            attributes['sleep_hours'] = float(match.group(2))

        # Parse [dep] value1 value2 value3 ... = computed_avg ✓
        # Format: [dep] -0.5 0 -0.5 = -0.3 ✓
        # Extract the list of values before the = sign and compute our own min/max/avg
        match = re.search(r'\[dep\]\s+([\d.\s-]+?)\s*=', attr_section)
        if match:
            # Parse all numeric values before the = sign
            values_str = match.group(1)
            dep_values = [float(x) for x in re.findall(r'[\d.-]+', values_str)]
            if dep_values:
                attributes['dep_min'] = min(dep_values)
                attributes['dep_max'] = max(dep_values)
                attributes['dep_avg'] = sum(dep_values) / len(dep_values)

        # Parse other single-value attributes
        for attr_name in ['dist', 'soc', 'out', 'exe', 'alc', 'xmx', 'wea']:
            match = re.search(rf'\[{attr_name}\]\s+([\d.-]+)', attr_section)
            if match:
                value = match.group(1)
                # Integer fields: soc, out, exe, xmx
                if attr_name in ['soc', 'out', 'exe', 'xmx']:
                    attributes[attr_name] = int(float(value))
                else:
                    # Decimal fields: dist, alc, wea
                    attributes[attr_name] = float(value)

        return attributes

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
