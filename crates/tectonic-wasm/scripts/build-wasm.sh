#!/usr/bin/env bash
#
# Build the GlyphX TeX engine to wasm32-unknown-emscripten.
#
# The single source of truth for how this is built: CI calls it, and so should
# you. Requires a Linux environment with the Emscripten SDK activated (emcc on
# PATH) and a Rust toolchain with the wasm32-unknown-emscripten target.
#
#   ./scripts/build-wasm.sh [output-dir]
#
# Each non-obvious step below cost a failed build to discover; the comments say
# which, so nobody has to rediscover them.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$REPO/output}"
TARGET=wasm32-unknown-emscripten

if ! command -v emcc >/dev/null 2>&1; then
  echo "error: emcc not found. Activate the Emscripten SDK first:" >&2
  echo "  source /path/to/emsdk/emsdk_env.sh" >&2
  exit 1
fi

SYSROOT="$(dirname "$(command -v emcc)")/cache/sysroot"
[ -d "$SYSROOT" ] || SYSROOT="$(em-config CACHE)/sysroot"
echo "sysroot: $SYSROOT"

step() { echo; echo "=== $* ==="; }

# Exception handling must be consistent across every object in the link, and
# the mode is not ours to choose: rustc hardcodes -fwasm-exceptions in the
# wasm32-unknown-emscripten target spec. It is not removable via
# panic = "abort" — that was tried, and rustc still passes it.
#
# So the vendored C and the Emscripten ports have to be built for wasm EH too.
# Otherwise they emit the JS-based invoke_* trampolines and the link dies on:
#   AssertionError: invoke_ functions exported but exceptions and longjmp are
#   both disabled
#
# The catch is that Emscripten builds these as *variant* libraries with a
# name suffix (e.g. libfreetype-legacysjlj.a) rather than overwriting the
# defaults, so -lfreetype stops resolving. The suffix depends on the flag
# combination and on the Emscripten version, so it is discovered below rather
# than hardcoded.
EH_FLAGS="-fwasm-exceptions -sSUPPORT_LONGJMP=wasm"

# Resolve the actual -l name for a port, preferring an exact match and falling
# back to whatever variant Emscripten produced.
resolve_lib() {
  local base="$1" libdir="$SYSROOT/lib/wasm32-emscripten" match
  if [ -f "$libdir/lib$base.a" ]; then
    echo "$base"
    return
  fi
  match="$(find "$libdir" -maxdepth 1 -name "lib$base-*.a" | head -1)"
  if [ -n "$match" ]; then
    basename "$match" | sed 's/^lib//; s/\.a$//'
    return
  fi
  echo "error: no library found for -l$base in $libdir" >&2
  return 1
}

step "Emscripten ports"
# Building a trivial program with the port flags makes emscripten fetch and
# compile each port into its sysroot cache, which is what the real link needs.
# Emscripten caches a separate variant per settings combination, so passing the
# EH flags here is what produces wasm-EH builds of the ports.
echo 'int main(){return 0;}' > /tmp/glyphx-probe.c
emcc /tmp/glyphx-probe.c $EH_FLAGS \
  -sUSE_FREETYPE=1 -sUSE_HARFBUZZ=1 -sUSE_LIBPNG=1 -sUSE_ZLIB=1 -sUSE_ICU=1 \
  -o /tmp/glyphx-probe.js

step "graphite2"
# Not optional, despite the engine never using Graphite shaping in practice:
# Tectonic's vendored HarfBuzz compiles hb-graphite2.cc unconditionally, and
# that #includes <graphite2/Font.h>.
if [ ! -f "$SYSROOT/lib/wasm32-emscripten/libgraphite2.a" ]; then
  GRAPHITE_VERSION=1.3.14
  WORK="${TMPDIR:-/tmp}/glyphx-graphite2"
  mkdir -p "$WORK" && cd "$WORK"
  if [ ! -f "graphite2-$GRAPHITE_VERSION.tgz" ]; then
    curl -sSLO "https://github.com/silnrsi/graphite/releases/download/$GRAPHITE_VERSION/graphite2-$GRAPHITE_VERSION.tgz"
  fi
  tar xzf "graphite2-$GRAPHITE_VERSION.tgz"
  SRC="$WORK/graphite2-$GRAPHITE_VERSION"
  mkdir -p "$SRC/build-wasm" && cd "$SRC/build-wasm"
  # CMAKE_POLICY_VERSION_MINIMUM: cmake 4.x refuses projects declaring
  # cmake_minimum_required below 3.5, which graphite2 1.3.14 does.
  emcmake cmake "$SRC" \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_POLICY_VERSION_MINIMUM=3.5 \
    -DBUILD_SHARED_LIBS=OFF \
    -DGRAPHITE2_NFILEFACE=ON \
    -DCMAKE_C_FLAGS="$EH_FLAGS" \
    -DCMAKE_CXX_FLAGS="$EH_FLAGS" >/dev/null
  emmake make -j"$(nproc)" graphite2 >/dev/null
  mkdir -p "$SYSROOT/lib/wasm32-emscripten" "$SYSROOT/include/graphite2"
  cp "$(find "$SRC/build-wasm" -name libgraphite2.a | head -1)" "$SYSROOT/lib/wasm32-emscripten/"
  cp "$SRC"/include/graphite2/*.h "$SYSROOT/include/graphite2/"
  cd "$REPO"
fi
echo "graphite2 ok"

step "fontconfig stub"
# XeTeX includes <fontconfig/fontconfig.h> unconditionally. There is no system
# font discovery in a browser, so a stub header plus a no-op library is enough.
"$REPO/scripts/create-fontconfig-stub.sh" "$SYSROOT"

step "pkg-config stubs"
# Every tectonic bridge_* crate insists on locating its library through
# pkg-config, including graphite2 and fontconfig.
PCDIR="$REPO/pkgconfig"
mkdir -p "$PCDIR"
for lib in graphite2 freetype2 icu-uc icu-i18n harfbuzz libpng fontconfig; do
  case "$lib" in
    freetype2) incdir='${prefix}/include/freetype2' ;;
    harfbuzz)  incdir='${prefix}/include/harfbuzz' ;;
    *)         incdir='${prefix}/include' ;;
  esac
  cat > "$PCDIR/$lib.pc" <<PC
prefix=$SYSROOT
libdir=\${prefix}/lib/wasm32-emscripten
includedir=$incdir

Name: $lib
Description: $lib (emscripten sysroot stub)
Version: 1.0
Libs: -L\${libdir}
Cflags: -I\${includedir}
PC
done

step "cargo build"
export CC=emcc CXX=em++ AR=emar RANLIB=emranlib
export PKG_CONFIG_PATH="$PCDIR"
export PKG_CONFIG_ALLOW_CROSS=1
export PKG_CONFIG_SYSROOT_DIR="$SYSROOT"

# The crate builds as a binary (a main module), so objects need not be PIC —
# see the note in Cargo.toml. Nothing to set here; PIC would only cost size and
# speed, and Emscripten's own ports are non-PIC regardless.

# setjmp/longjmp mode must agree between compile and link, and the choice is
# forced: rustc passes -fwasm-exceptions on this target, and emcc rejects
# "SUPPORT_LONGJMP=emscripten is not compatible with -fwasm-exceptions". So both
# sides use the wasm mode.
#
# Getting this wrong fails in two distinct ways, neither of which names the real
# cause. Omitting it entirely leaves longjmp disabled while the C still emits
# invoke_* trampolines:
#   AssertionError: invoke_ functions exported but exceptions and longjmp are
#   both disabled
# and setting it only at link time produces the same assertion, because cc-rs
# compiled the C without it.
#
# Consequence for hosts: the module uses native wasm exception handling, so it
# does NOT import `emscripten_longjmp` or the `invoke_*` trampolines the way an
# older JS-longjmp build did.
export CFLAGS="$EH_FLAGS"
export CXXFLAGS="$EH_FLAGS"
# Emscripten only understands the empty case as "unset"; an empty string in
# CFLAGS is harmless, but keep the intent explicit.
[ -n "$EH_FLAGS" ] || { unset CFLAGS; unset CXXFLAGS; }

# Without this, wasm-ld garbage-collects the FFI entry points: nothing inside
# the module calls them, since the host is the only caller.
EXPORTS='["_main","_malloc","_free"'
for f in abi_version alloc dealloc add_file remove_file file_count \
         clear_files clear_outputs compile result_ptr result_len \
         output_len output_copy; do
  EXPORTS="$EXPORTS,\"_glyphx_$f\""
done
EXPORTS="$EXPORTS]"

LIBS=""
for base in graphite2 freetype harfbuzz png z icu_common icu_i18n fontconfig; do
  LIBS="$LIBS -l $(resolve_lib "$base")"
done
echo "linking against:$LIBS"

export RUSTFLAGS="-L $SYSROOT/lib/wasm32-emscripten $LIBS \
 -C link-args=-sEXPORTED_FUNCTIONS=$EXPORTS \
 -C link-args=-sSUPPORT_LONGJMP=wasm \
 -C link-args=-sUSE_FREETYPE \
 -C link-args=-sUSE_ZLIB \
 -C link-args=-sUSE_LIBPNG \
 -C link-args=-sUSE_ICU \
 -C link-args=-sERROR_ON_UNDEFINED_SYMBOLS=0 \
 -C link-args=-sALLOW_MEMORY_GROWTH=1 \
 -C link-args=-sINITIAL_MEMORY=268435456 \
 -C link-args=-sMAXIMUM_MEMORY=2147483648"

cd "$REPO"
cargo build --target "$TARGET" --release

ARTIFACT="${CARGO_TARGET_DIR:-$REPO/target}/$TARGET/release/tectonic_wasm.wasm"
if [ ! -f "$ARTIFACT" ]; then
  echo "error: no artifact at $ARTIFACT" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
cp "$ARTIFACT" "$OUT_DIR/tectonic_wasm.wasm"

step "done"
ls -lh "$OUT_DIR/tectonic_wasm.wasm"
