"""Tree-sitter parser for SXIVA files."""

import ctypes
from pathlib import Path
from tree_sitter import Language, Parser


class SxivaParser:
    """Wrapper for Tree-sitter SXIVA parser."""

    def __init__(self):
        """Initialize the parser with the SXIVA grammar."""
        # Find the parser.so relative to this file
        # sxiva-tools/sxiva/parser.py -> ../../parser.so
        parser_path = Path(__file__).parent.parent.parent / "parser.so"

        if not parser_path.exists():
            raise FileNotFoundError(
                f"SXIVA parser not found at {parser_path}. "
                "Please compile it with: gcc -o parser.so -shared src/parser.c -I./src -fPIC -O2"
            )

        # Load the language using ctypes (new tree-sitter API)
        lib = ctypes.CDLL(str(parser_path))
        lang_func = lib.tree_sitter_sxiva
        lang_func.restype = ctypes.c_void_p
        lang_ptr = lang_func()

        self.language = Language(lang_ptr)

        # Create parser with language (new API)
        self.parser = Parser(self.language)

    def parse(self, source_code: str):
        """Parse SXIVA source code and return the syntax tree.

        Args:
            source_code: The .sxiva file contents as a string

        Returns:
            Tree: The parsed syntax tree
        """
        if isinstance(source_code, str):
            source_code = source_code.encode('utf-8')

        tree = self.parser.parse(source_code)
        return tree

    def parse_file(self, file_path: str):
        """Parse a .sxiva file and return the syntax tree.

        Args:
            file_path: Path to the .sxiva file

        Returns:
            tuple: (tree, source_code) - The parsed syntax tree and original source
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            source_code = f.read()

        tree = self.parse(source_code)
        return tree, source_code


def node_text(node, source_bytes):
    """Extract text for a tree-sitter node.

    Args:
        node: Tree-sitter node
        source_bytes: Source code as bytes

    Returns:
        str: The text content of the node
    """
    return source_bytes[node.start_byte:node.end_byte].decode('utf-8')


def walk_tree(node, visit_fn, source_bytes, depth=0):
    """Walk the syntax tree and call visit_fn for each node.

    Args:
        node: Current tree-sitter node
        visit_fn: Function(node, text, depth) to call for each node
        source_bytes: Source code as bytes
        depth: Current depth in the tree
    """
    text = node_text(node, source_bytes)
    visit_fn(node, text, depth)

    for child in node.children:
        walk_tree(child, visit_fn, source_bytes, depth + 1)
