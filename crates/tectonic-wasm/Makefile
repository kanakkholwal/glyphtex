# Tectonic WASM Build
# Compiles Tectonic TeX engine to WebAssembly using Emscripten
#
# Prerequisites: git, curl
#
# Usage:
#   make setup    # One-time: install Rust, Emscripten
#   make deps     # One-time: compile WASM dependencies
#   make build    # Build tectonic WASM
#   make bundle   # Create TeX package bundle
#   make check    # Validate output
#   make clean    # Clean build artifacts
#   make all      # Full build from scratch

ROOT        := $(shell pwd)
EMSDK_DIR   := $(ROOT)/emsdk
TECTONIC    := $(ROOT)/tectonic
SYSROOT     := $(EMSDK_DIR)/upstream/emscripten/cache/sysroot
PCDIR       := $(ROOT)/pkgconfig
TARGET      := wasm32-unknown-emscripten
OUTPUT_DIR  := $(ROOT)/output
WASM_OUT    := $(ROOT)/target/$(TARGET)/release/tectonic_wasm.wasm

export PATH            := $(EMSDK_DIR):$(EMSDK_DIR)/upstream/emscripten:$(HOME)/.cargo/bin:$(PATH)
export EMSDK           := $(EMSDK_DIR)
export CC              := emcc
export CXX             := em++
export AR              := emar
export RANLIB          := emranlib
export PKG_CONFIG_PATH := $(PCDIR)
export PKG_CONFIG_ALLOW_CROSS := 1
export PKG_CONFIG_SYSROOT_DIR := $(SYSROOT)
export RUSTFLAGS       := -L $(SYSROOT)/lib/wasm32-emscripten \
	-l graphite2 -l freetype -l harfbuzz -l png -l z \
	-l icu_common -l icu_i18n -l fontconfig \
	-C link-args=-sSUPPORT_LONGJMP=wasm \
	-C link-args=-sUSE_FREETYPE \
	-C link-args=-sUSE_ZLIB \
	-C link-args=-sUSE_LIBPNG \
	-C link-args=-sUSE_ICU \
	-C link-args=-sERROR_ON_UNDEFINED_SYMBOLS=0 \
	-C link-args=-sALLOW_MEMORY_GROWTH=1 \
	-C link-args=-sINITIAL_MEMORY=536870912 \
	-C link-args=-sMAXIMUM_MEMORY=1073741824

.PHONY: all setup deps build bundle format check clean distclean

all: setup deps build format check

# ── Setup ─────────────────────────────────────────────────────
setup: setup-rust setup-submodules

setup-rust:
	@echo "=== Installing Rust ==="
	@which rustup > /dev/null 2>&1 || \
		curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal
	@rustup target add $(TARGET) 2>/dev/null || true

setup-submodules:
	@echo "=== Initializing submodules ==="
	git submodule update --init --recursive --depth 1

# ── Dependencies ──────────────────────────────────────────────
deps: deps-ports deps-graphite2 deps-fontconfig deps-pkgconfig

deps-ports:
	@echo "=== Compiling Emscripten ports (freetype, harfbuzz, ICU, zlib, libpng) ==="
	@echo 'int main(){return 0;}' | emcc -x c - \
		-sUSE_FREETYPE -sUSE_HARFBUZZ=1 -sUSE_LIBPNG -sUSE_ZLIB -sUSE_ICU \
		-o /dev/null 2>&1 | tail -1
	@echo "Done"

deps-graphite2:
	@echo "=== Compiling Graphite2 to WASM ==="
	@if [ ! -f "$(SYSROOT)/lib/wasm32-emscripten/libgraphite2.a" ]; then \
		test -f "/usr/include/graphite2/Font.h" || apt-get install -y -qq libgraphite2-dev; \
		cp -rn /usr/include/graphite2 $(SYSROOT)/include/ 2>/dev/null || true; \
		echo "deb-src http://deb.debian.org/debian bookworm main" >> /etc/apt/sources.list 2>/dev/null || true; \
		apt-get update -qq 2>/dev/null; \
		cd /tmp && apt-get source graphite2 2>/dev/null; \
		cd /tmp/graphite2-*/ && mkdir -p build-wasm && cd build-wasm && \
		emcmake cmake .. -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF 2>&1 | tail -1 && \
		emmake make -j$$(nproc) 2>&1 | tail -1 && \
		cp src/libgraphite2.a $(SYSROOT)/lib/wasm32-emscripten/; \
	fi
	@echo "Done"

deps-fontconfig:
	@echo "=== Creating fontconfig stub ==="
	@./scripts/create-fontconfig-stub.sh $(SYSROOT)

deps-pkgconfig:
	@echo "=== Creating pkg-config files ==="
	@./scripts/create-pkgconfig.sh $(SYSROOT) $(PCDIR)

# ── Build ─────────────────────────────────────────────────────
build: $(WASM_OUT)
	@mkdir -p $(OUTPUT_DIR)
	@cp $(WASM_OUT) $(OUTPUT_DIR)/tectonic_wasm.wasm
	@echo ""
	@echo "✅ Build complete!"
	@ls -lh $(OUTPUT_DIR)/tectonic_wasm.wasm

$(WASM_OUT): src/lib.rs Cargo.toml
	@echo "=== Building Tectonic WASM ==="
	cargo build --target $(TARGET) --release

# ── Bundle ────────────────────────────────────────────────────
bundle:
	@echo "=== Creating TeX package bundle ==="
	@echo "Compile a test document with native tectonic to populate cache:"
	@echo "  tectonic test.tex"
	@echo "Then run: ./scripts/create-bundle.sh"

# ── Format ────────────────────────────────────────────────────
# Generate latex.fmt using the WASM engine (INITEX mode)
# This ensures the format is compatible with the WASM build
format: build
	@echo "=== Generating WASM-native latex.fmt ==="
	@./scripts/generate-format.sh $(OUTPUT_DIR)/tectonic_wasm.wasm $(OUTPUT_DIR)

# ── Validate ──────────────────────────────────────────────────
check:
	@echo "=== Validating WASM ==="
	@node -e "const fs=require('fs'),w=fs.readFileSync('$(OUTPUT_DIR)/tectonic_wasm.wasm');\
		WebAssembly.compile(w).then(m=>{const e=WebAssembly.Module.exports(m);\
		console.log('✅ Valid WASM:',e.length,'exports,',w.length,'bytes')\
		}).catch(e=>console.error('❌ Invalid:',e.message))" 2>/dev/null || \
	$(EMSDK_DIR)/node/*/bin/node -e "const fs=require('fs'),w=fs.readFileSync('$(OUTPUT_DIR)/tectonic_wasm.wasm');\
		WebAssembly.compile(w).then(m=>{const e=WebAssembly.Module.exports(m);\
		console.log('✅ Valid WASM:',e.length,'exports,',w.length,'bytes')\
		}).catch(e=>console.error('❌ Invalid:',e.message))"

# ── Clean ─────────────────────────────────────────────────────
clean:
	cargo clean 2>/dev/null || true
	rm -rf $(OUTPUT_DIR)

distclean: clean
	rm -rf $(EMSDK_DIR) pkgconfig
