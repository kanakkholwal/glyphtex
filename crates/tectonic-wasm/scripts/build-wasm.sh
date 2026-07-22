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

# Exception handling has to be the SAME scheme in every object in the link, and
# the choice is forced by Emscripten's prebuilt ports.
#
# HarfBuzz and ICU are C++, they use exceptions, and Emscripten only ever ships
# them built with the JS-based scheme. That is not a caching artifact: building
# a probe with -fwasm-exceptions produces no wasm-EH variant of libharfbuzz.a or
# libicu_common.a at all. Only freetype and png even have variants.
#
# rustc defaults to the *other* scheme (wasm EH) on this target. Mixing them
# fails at the very last step with a message that describes the opposite of the
# problem:
#   AssertionError: invoke_ functions exported but exceptions and longjmp are
#   both disabled
# The invoke_* trampolines are present precisely *because* the C++ ports use the
# JS scheme; the assert only means emcc could not reconcile the two.
#
# So: everything uses the JS scheme. That is also the configuration the one
# known-good build of this engine used — its module imports invoke_* and
# emscripten_longjmp, which is what @glyphx/tex-engine's host shim implements.
#
# Empty on purpose: the C is compiled with Emscripten's defaults, which is the
# JS scheme, matching the ports.
EH_FLAGS=""

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
  # This tarball is compiled into the shipped engine, so verify it: it is the
  # one build input fetched from a third party at build time.
  GRAPHITE_SHA256=f99d1c13aa5fa296898a181dff9b82fb25f6cc0933dbaa7a475d8109bd54209d
  WORK="${TMPDIR:-/tmp}/glyphx-graphite2"
  mkdir -p "$WORK" && cd "$WORK"
  if [ ! -f "graphite2-$GRAPHITE_VERSION.tgz" ]; then
    curl -sSLO "https://github.com/silnrsi/graphite/releases/download/$GRAPHITE_VERSION/graphite2-$GRAPHITE_VERSION.tgz"
  fi
  echo "$GRAPHITE_SHA256  graphite2-$GRAPHITE_VERSION.tgz" | sha256sum -c - || {
    echo "error: graphite2 tarball failed checksum; refusing to build it." >&2
    rm -f "graphite2-$GRAPHITE_VERSION.tgz"
    exit 1
  }
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

# setjmp/longjmp uses Emscripten's default (JS) mode, to match the exception
# scheme chosen above. Do not pass -sSUPPORT_LONGJMP=wasm: that is only valid
# alongside wasm exceptions, and emcc rejects the mismatched pair with
# "SUPPORT_LONGJMP=emscripten is not compatible with -fwasm-exceptions".
#
# Consequence for hosts: the module imports `emscripten_longjmp` and the
# `invoke_*` trampolines, which packages/tex-engine/src/imports.ts implements.
if [ -n "$EH_FLAGS" ]; then
  export CFLAGS="$EH_FLAGS"
  export CXXFLAGS="$EH_FLAGS"
fi

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

# -Zemscripten-wasm-eh=no is the whole fix for the exception mismatch described
# at the top: it stops rustc emitting -fwasm-exceptions, putting Rust on the
# same JS scheme as the C++ ports.
#
# It is an unstable flag, hence RUSTC_BOOTSTRAP. That is a real (if blunt)
# escape hatch and the alternative is worse: a custom target JSON, which then
# drags in -Zbuild-std to rebuild the standard library. Both are unstable; this
# one is a single flag. Revisit if the option ever stabilises or if the ports
# gain wasm-EH builds.
#
# Do NOT add -sWASM_EXCEPTIONS: emcc rejects it ("WASM_EXCEPTIONS is an internal
# setting and cannot be set from command line").
export RUSTC_BOOTSTRAP=1
export RUSTFLAGS="-L $SYSROOT/lib/wasm32-emscripten $LIBS \
 -Z emscripten-wasm-eh=no \
 -C link-args=-sEXPORTED_FUNCTIONS=$EXPORTS \
 -C link-args=-sSTANDALONE_WASM=1 \
 -C link-args=-sUSE_FREETYPE \
 -C link-args=-sUSE_ZLIB \
 -C link-args=-sUSE_LIBPNG \
 -C link-args=-sUSE_ICU \
 -C link-args=-sERROR_ON_UNDEFINED_SYMBOLS=0 \
 -C link-args=-sALLOW_MEMORY_GROWTH=1 \
 -C link-args=-sINITIAL_MEMORY=${GLYPHX_INITIAL_MEMORY:-268435456} \
 -C link-args=-sMAXIMUM_MEMORY=2147483648"

cd "$REPO"

# Reference point for the freshness check after the build.
STAMP="$(mktemp)"
trap 'rm -f "$STAMP"' EXIT

# std must be rebuilt, not just our crate: -Zemscripten-wasm-eh=no only affects
# what rustc compiles now, and the precompiled libstd was built for wasm EH. It
# references __cpp_exception, which does not exist once the rest of the link is
# on the JS scheme, and the failure surfaces at the very last step.
#
# Overridable, but the default has to be correct — the build does not link
# without it, and a caller who has to know that is a trap.
# shellcheck disable=SC2086
cargo build --target "$TARGET" --release ${GLYPHX_BUILD_STD:--Z build-std=std,panic_abort}

ARTIFACT="${CARGO_TARGET_DIR:-$REPO/target}/$TARGET/release/tectonic_wasm.wasm"

# Freshness, not just existence. Checking `-f` alone means a stale artifact from
# an earlier successful build satisfies the check, so a failed run copies the
# old binary to output/ and exits 0 — reporting success while shipping
# something that was never built from the current source. That actually
# happened during development, and it is the worst kind of failure: silent.
if [ ! -f "$ARTIFACT" ]; then
  echo "error: no artifact at $ARTIFACT" >&2
  exit 1
fi
if [ ! "$ARTIFACT" -nt "$STAMP" ]; then
  echo "error: $ARTIFACT is older than this build started — cargo did not"  >&2
  echo "       produce a new binary, so the previous one would have been"   >&2
  echo "       published as if it were fresh. Treating as a failure."       >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
cp "$ARTIFACT" "$OUT_DIR/tectonic_wasm.wasm"

step "done"
ls -lh "$OUT_DIR/tectonic_wasm.wasm"
