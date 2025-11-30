#!/bin/bash
# Compile the SXIVA tree-sitter parser

set -e

echo "Compiling SXIVA parser..."

cd grammar
npx tree-sitter generate
echo "✓ Generated parser from grammar.js"
gcc -o parser.so -shared src/parser.c -I./src -fPIC -O2
echo "✓ Compiled parser in grammar/"

cp parser.so ../parser.so
echo "✓ Copied parser.so to project root"

# Copy to nvim-treesitter if it exists
NVIM_PARSER_DIR="$HOME/.local/share/nvim/lazy/nvim-treesitter/parser"
if [ -d "$NVIM_PARSER_DIR" ]; then
  cp parser.so "$NVIM_PARSER_DIR/sxiva.so"
  echo "✓ Copied parser to nvim-treesitter: $NVIM_PARSER_DIR/sxiva.so"
fi

cd ..
echo ""
echo "Parser compiled successfully!"
echo "Restart Neovim to load the updated parser."
