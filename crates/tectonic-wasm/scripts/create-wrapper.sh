#!/bin/sh
set -e
WRAPPER_DIR=/work/tectonic-wasm
mkdir -p $WRAPPER_DIR/src

cat > $WRAPPER_DIR/Cargo.toml << 'TOML'
[package]
name = "tectonic-wasm"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
tectonic_engine_xetex = { path = "/work/tectonic/crates/engine_xetex", default-features = false }
tectonic_engine_xdvipdfmx = { path = "/work/tectonic/crates/engine_xdvipdfmx", default-features = false }
tectonic_engine_bibtex = { path = "/work/tectonic/crates/engine_bibtex", default-features = false }
tectonic_bridge_core = { path = "/work/tectonic/crates/bridge_core", default-features = false }
tectonic_io_base = { path = "/work/tectonic/crates/io_base", default-features = false }
tectonic_status_base = { path = "/work/tectonic/crates/status_base", default-features = false }
tectonic_errors = { path = "/work/tectonic/crates/errors", default-features = false }

[workspace]
resolver = "2"

[workspace.lints.rust]
unexpected_cfgs = { level = "warn", check-cfg = ['cfg(web_sys_unstable_apis)'] }
TOML

cat > $WRAPPER_DIR/src/lib.rs << 'RS'
use tectonic_engine_xetex as _xetex;
use tectonic_engine_xdvipdfmx as _xdvipdfmx;
use tectonic_bridge_core as _bridge;

#[no_mangle]
pub extern "C" fn tectonic_wasm_version() -> i32 { 1 }
RS
echo "Wrapper crate created"
