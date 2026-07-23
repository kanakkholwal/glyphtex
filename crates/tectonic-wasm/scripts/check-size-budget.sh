#!/usr/bin/env bash
# Enforce the engine download budget and write a summary. First-run download is
# engine + core bundle + every DEFAULT pack, because the worker fetches all of
# those on install.
set -euo pipefail

ENGINE_LIMIT=$((3 * 1024 * 1024))     # brotli engine
TOTAL_LIMIT=$((30 * 1024 * 1024))     # engine + core + default packs
# Relative to this script, not the caller: a missing artifact must fail the
# budget, never pass it silently because CWD made the path resolve to nothing.
OUT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../output" && pwd)"

for f in tectonic_wasm.wasm tectonic-bundle.tar.gz packs/packs-index.json; do
  [ -e "$OUT/$f" ] || { echo "::error::size budget: missing $OUT/$f — build first."; exit 1; }
done

RAW=$(stat -c%s "$OUT/tectonic_wasm.wasm")
BR=$(brotli -q 11 -c "$OUT/tectonic_wasm.wasm" | wc -c)
BUN=$(stat -c%s "$OUT/tectonic-bundle.tar.gz")
# Sum only non-optional packs — the default install set.
PACKS=$(node -e '
  const fs = require("fs");
  const out = process.argv[1];
  const idx = JSON.parse(fs.readFileSync(out + "/packs/packs-index.json"));
  let n = 0;
  for (const p of idx.packs) if (!p.optional) n += fs.statSync(out + "/packs/pack-" + p.id + ".tar.gz").size;
  process.stdout.write(String(n));' "$OUT")
TOTAL=$((BR + BUN + PACKS))

mb() { awk -v b="$1" 'BEGIN { printf "%.2f", b/1048576 }'; }

{
  echo "### Engine size"
  echo "| | bytes | MB | limit |"
  echo "|---|---:|---:|---:|"
  echo "| engine brotli -q11 | $BR | $(mb "$BR") | $(mb "$ENGINE_LIMIT") |"
  echo "| core bundle gz | $BUN | $(mb "$BUN") | — |"
  echo "| default packs gz | $PACKS | $(mb "$PACKS") | — |"
  echo "| **first-run download** | $TOTAL | $(mb "$TOTAL") | $(mb "$TOTAL_LIMIT") |"
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"

fail=0
if [ "$BR" -gt "$ENGINE_LIMIT" ]; then
  echo "::error::Compressed engine is $(mb "$BR") MB, over the $(mb "$ENGINE_LIMIT") MB budget."
  fail=1
fi
if [ "$TOTAL" -gt "$TOTAL_LIMIT" ]; then
  echo "::error::First-run download is $(mb "$TOTAL") MB, over the $(mb "$TOTAL_LIMIT") MB budget."
  fail=1
fi
exit $fail
