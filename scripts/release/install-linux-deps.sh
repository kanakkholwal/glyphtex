#!/usr/bin/env bash
# System packages required to compile + bundle the Tauri desktop app on Linux.
#
# Tauri 2 links WebKitGTK / GTK / libsoup and uses librsvg for icon rendering;
# the bundler needs `patchelf` (AppImage) and the appindicator lib for the tray.
# Shared by ci-desktop.yml (compile gate) and release-desktop.yml (full bundle).
#
# Unlike the upstream project this was forked from, GlyphTeX has no screen-capture
# stack — there is no PipeWire / x11 / ashpd dependency here. Tectonic ships as a
# prebuilt sidecar binary (downloaded separately), so no TeX/native libs are
# needed to build; fontconfig is pulled in only so the bundled engine can find
# system fonts at runtime.
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

sudo apt-get update

sudo apt-get install -y --no-install-recommends \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libsoup-3.0-dev \
  librsvg2-dev \
  libayatana-appindicator3-dev \
  libssl-dev \
  libfontconfig1-dev \
  patchelf \
  build-essential \
  file \
  curl \
  wget

echo "✓ Linux build dependencies installed"
