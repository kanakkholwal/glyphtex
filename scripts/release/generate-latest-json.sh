#!/usr/bin/env bash
# Assemble the Tauri updater manifest (`latest.json`) from the signed bundle
# signatures produced across the release matrix.
#
# GlyphX builds each platform on its own runner so it can control the Tectonic
# sidecar download + caching, so it does NOT use `tauri-action` — which is what
# would normally emit this manifest. We build it here from the `.sig` files.
#
# Each `.sig` is named `<bundle><ext>.sig`; the bundle the updater installs is
# the filename with `.sig` stripped (and is the release asset the updater
# downloads). The manifest references bundles by their GitHub release-asset URL —
# it does not embed them — so only the signatures are read here.
#
# Updater bundle per platform (what `<key>` installs):
#   windows-x86_64 → NSIS `*-setup.exe`   (falls back to `*.msi`)
#   linux-x86_64   → `*.AppImage`
#   darwin-aarch64 → arch-tagged `*_aarch64.app.tar.gz`  (see rename-macos-updater-bundle.sh)
#   darwin-x86_64  → arch-tagged `*_x64.app.tar.gz`
#
# Usage:
#   scripts/release/generate-latest-json.sh \
#     --tag v1.2.3 --repo owner/name --dir <sig-dir> --out latest.json \
#     [--require windows-x86_64,linux-x86_64,darwin-aarch64,darwin-x86_64]
#
# `--require` lists platform keys that MUST be present: a missing one is a hard
# error instead of a skipped-with-warning, so a release can't silently publish a
# manifest that omits a platform (a build leg that failed, or a target that
# produced no updater artifact). Leave unset for partial / single-platform runs.

set -euo pipefail

tag=""
repo=""
dir="."
out="latest.json"
require_csv=""

while [ $# -gt 0 ]; do
  case "$1" in
    --tag) tag="${2:-}"; shift 2 ;;
    --repo) repo="${2:-}"; shift 2 ;;
    --dir) dir="${2:-}"; shift 2 ;;
    --out) out="${2:-}"; shift 2 ;;
    --require) require_csv="${2:-}"; shift 2 ;;
    *) echo "::error::Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$tag" ] || [ -z "$repo" ]; then
  echo "Usage: generate-latest-json.sh --tag <tag> --repo <owner/name> --dir <dir> --out <file> [--require k1,k2]" >&2
  exit 1
fi
command -v jq >/dev/null 2>&1 || { echo "::error::jq is required but not installed."; exit 1; }

version="${tag#v}"

# First `.sig` basename in $dir matching the extended-regex, or empty. Portable
# (no GNU-only find flags); nullglob so a no-match loop body simply never runs.
pick() {
  local re="$1" f b
  shopt -s nullglob
  for f in "$dir"/*.sig; do
    b="$(basename "$f")"
    # `-e` so a pattern starting with `-` (e.g. `-setup\.exe…`) isn't read as a flag.
    if printf '%s\n' "$b" | grep -Eq -e "$re"; then
      printf '%s\n' "$b"
      return 0
    fi
  done
  return 0
}

declare -A SIG
SIG[windows-x86_64]="$(pick '-setup\.exe\.sig$')"
[ -n "${SIG[windows-x86_64]}" ] || SIG[windows-x86_64]="$(pick '\.msi\.sig$')"
SIG[linux-x86_64]="$(pick '\.AppImage\.sig$')"
# The macOS bundles are arch-tagged by rename-macos-updater-bundle.sh, so the
# arch token appears in the filename. "aarch64" never contains "x64"/"x86_64"
# and vice-versa, so these two patterns are mutually exclusive.
SIG[darwin-aarch64]="$(pick '(aarch64|arm64).*\.app\.tar\.gz\.sig$')"
SIG[darwin-x86_64]="$(pick '(x64|x86_64).*\.app\.tar\.gz\.sig$')"

platforms="{}"
for key in windows-x86_64 linux-x86_64 darwin-aarch64 darwin-x86_64; do
  sig="${SIG[$key]:-}"
  if [ -z "$sig" ]; then
    echo "::warning::No updater signature found for ${key} — skipping."
    continue
  fi
  bundle="${sig%.sig}"
  platforms="$(jq \
    --arg key "$key" \
    --rawfile sig "$dir/$sig" \
    --arg repo "$repo" \
    --arg tag "$tag" \
    --arg bundle "$bundle" \
    '. + {($key): {
        signature: ($sig | gsub("^\\s+|\\s+$"; "")),
        url: ("https://github.com/" + $repo + "/releases/download/" + $tag + "/" + ($bundle | @uri))
      }}' \
    <<<"$platforms")"
  echo "  + ${key} → ${bundle}"
done

if [ "$(jq 'length' <<<"$platforms")" -eq 0 ]; then
  echo "::error::No signed updater bundles found — refusing to write an empty latest.json. Are the TAURI_SIGNING_PRIVATE_KEY secrets configured?" >&2
  exit 1
fi

# Enforce required platforms (a partial manifest means a build leg failed).
if [ -n "$require_csv" ]; then
  missing=""
  IFS=',' read -ra req <<<"$require_csv"
  for k in "${req[@]}"; do
    k="$(printf '%s' "$k" | tr -d '[:space:]')"
    [ -z "$k" ] && continue
    if [ "$(jq --arg k "$k" 'has($k)' <<<"$platforms")" != "true" ]; then
      missing="${missing:+$missing, }$k"
    fi
  done
  if [ -n "$missing" ]; then
    echo "::error::latest.json is missing required platform(s): ${missing}. Refusing to publish a partial updater manifest — a build leg likely failed or produced no updater artifact (check that every matrix leg succeeded and that signing secrets are set)." >&2
    exit 1
  fi
fi

# `date -u` (UTC, ISO-8601) — the build runner clock; the manifest is generated
# at release time so a fixed timestamp isn't needed.
pub_date="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

jq -n \
  --arg version "$version" \
  --arg notes "See the full release notes at https://github.com/${repo}/releases/tag/${tag}" \
  --arg pub_date "$pub_date" \
  --argjson platforms "$platforms" \
  '{version: $version, notes: $notes, pub_date: $pub_date, platforms: $platforms}' \
  > "$out"

echo "Wrote ${out} for ${tag} — platforms: $(jq -r '.platforms | keys | join(", ")' "$out")"
