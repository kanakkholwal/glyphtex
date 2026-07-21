#!/bin/sh
# Create a TeX package bundle from the tectonic cache.
# Run native tectonic on your document first to populate the cache.
#
# Usage: ./scripts/create-bundle.sh [output-dir]

set -e

OUTPUT_DIR="${1:-output}"
CACHE_DIR="$HOME/.cache/Tectonic"
FMT_DIR="$CACHE_DIR/formats"
BUNDLE_DIR=$(find "$CACHE_DIR/bundles/data" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | head -1)

if [ -z "$BUNDLE_DIR" ] || [ ! -d "$BUNDLE_DIR" ]; then
    echo "Error: No tectonic cache found. Run 'tectonic your-document.tex' first."
    exit 1
fi

FMT_FILE=$(find "$FMT_DIR" -name "*.fmt" 2>/dev/null | head -1)
if [ -z "$FMT_FILE" ]; then
    echo "Error: No format file found in $FMT_DIR"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

# Build bundle
TMPDIR=$(mktemp -d)
cp "$FMT_FILE" "$TMPDIR/latex.fmt"
cp "$BUNDLE_DIR"/* "$TMPDIR/"

FILE_COUNT=$(ls "$TMPDIR" | wc -l)
echo "Bundling $FILE_COUNT files..."

tar czf "$OUTPUT_DIR/tectonic-bundle.tar.gz" -C "$TMPDIR" .
rm -rf "$TMPDIR"

ls -lh "$OUTPUT_DIR/tectonic-bundle.tar.gz"
echo "✅ Bundle created: $FILE_COUNT files"
