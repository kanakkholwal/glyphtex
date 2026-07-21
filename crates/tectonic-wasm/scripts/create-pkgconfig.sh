#!/bin/sh
set -e
SYSROOT=${1:-/work/emsdk/upstream/emscripten/cache/sysroot}
PCDIR=${2:-/work/tectonic/wasm-pkgconfig}
mkdir -p $PCDIR

for lib in graphite2 freetype2 icu-uc harfbuzz libpng fontconfig; do
  case $lib in
    freetype2) incdir="\${prefix}/include/freetype2" ;;
    harfbuzz)  incdir="\${prefix}/include/harfbuzz" ;;
    *)         incdir="\${prefix}/include" ;;
  esac
  cat > $PCDIR/$lib.pc << PC
prefix=$SYSROOT
libdir=\${prefix}/lib/wasm32-emscripten
includedir=$incdir

Name: $lib
Description: $lib (WASM)
Version: 1.0
Libs: -L\${libdir}
Cflags: -I\${includedir}
PC
done
echo "pkg-config files created in $PCDIR"
