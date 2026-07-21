#!/usr/bin/env bash
# Rename the macOS updater bundle so the arm64 and x64 matrix legs don't collide.
#
# Tauri emits the macOS updater bundle as `GlyphX.app.tar.gz` (+ `.sig`) with no
# architecture in the name. When both the arm64 and x64 build legs upload to the
# same draft release — and both feed latest.json — they collide on the asset
# name and the manifest can't tell darwin-aarch64 from darwin-x86_64. This
# renames each to the DMG-style `GlyphX_<version>_<arch>.app.tar.gz` so the
# release carries both, distinguishable by filename (which is also what
# generate-latest-json.sh matches on).
#
# Inputs (env vars):
#   TAG          — release tag (e.g. v1.2.3)
#   RUST_TARGET  — Rust target triple (aarch64-apple-darwin | x86_64-apple-darwin)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

: "${TAG:?TAG is required}"
: "${RUST_TARGET:?RUST_TARGET is required}"

version="${TAG#v}"
case "$RUST_TARGET" in
  aarch64-*) arch=aarch64 ;;
  x86_64-*)  arch=x64 ;;
  *)
    echo "::error::Unknown macOS target $RUST_TARGET"
    exit 1
    ;;
esac

found=0
for base in \
  "apps/desktop/src-tauri/target/release/bundle/macos" \
  "apps/desktop/src-tauri/target/${RUST_TARGET}/release/bundle/macos"; do
  [ -d "$base" ] || continue
  for f in "$base"/*.app.tar.gz "$base"/*.app.tar.gz.sig; do
    [ -e "$f" ] || continue
    name="$(basename "$f")"
    # Skip if it already carries the arch (idempotent re-runs).
    case "$name" in *"_${arch}.app.tar.gz"*) continue ;; esac
    newname="${name/.app.tar.gz/_${version}_${arch}.app.tar.gz}"
    mv "$f" "$base/$newname"
    echo "Renamed $name -> $newname"
    found=1
  done
done

if [[ "$found" -ne 1 ]]; then
  echo "::warning::No macOS updater bundle found to rename — is createUpdaterArtifacts enabled?"
fi
