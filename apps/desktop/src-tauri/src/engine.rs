//! Managed Tectonic engine versions.
//!
//! Lists and downloads Tectonic builds from GitHub releases into the app-data
//! directory, so users can choose / update the LaTeX engine at runtime without
//! rebuilding the app. The active engine is what `compile::find_tectonic`
//! prefers.

use std::io::Cursor;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::Manager;

const REPO: &str = "tectonic-typesetting/tectonic";
const USER_AGENT: &str = "glyphtex-editor";

#[derive(Serialize, Clone)]
pub struct EngineVersion {
    pub version: String,
    pub tag: String,
    pub installed: bool,
    pub active: bool,
}

fn bin_ext() -> &'static str {
    if cfg!(windows) {
        ".exe"
    } else {
        ""
    }
}

fn engines_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_data_dir().ok()?.join("engines");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

fn installed_path(dir: &Path, version: &str) -> PathBuf {
    dir.join(format!("tectonic-{version}{}", bin_ext()))
}

/// Versions currently installed in `dir` (parsed from `tectonic-<version>` files).
fn installed_versions(dir: &Path) -> Vec<String> {
    let mut out = Vec::new();
    if let Ok(rd) = std::fs::read_dir(dir) {
        for entry in rd.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if let Some(rest) = name.strip_prefix("tectonic-") {
                let v = rest.strip_suffix(".exe").unwrap_or(rest);
                if !v.is_empty() {
                    out.push(v.to_string());
                }
            }
        }
    }
    out
}

/// App-managed Tectonic cache dir. Deterministic (unlike Tectonic's default
/// per-user cache) so we can show its size, clear it, and pre-warm it.
pub fn cache_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_data_dir().ok()?.join("tectonic-cache");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

fn dir_size(path: &Path) -> u64 {
    let mut total = 0;
    if let Ok(rd) = std::fs::read_dir(path) {
        for entry in rd.flatten() {
            if let Ok(md) = entry.metadata() {
                total += if md.is_dir() {
                    dir_size(&entry.path())
                } else {
                    md.len()
                };
            }
        }
    }
    total
}

#[derive(Serialize)]
pub struct CacheInfo {
    pub path: String,
    pub bytes: u64,
}

/// Size + location of the managed Tectonic package cache.
#[tauri::command]
pub async fn tectonic_cache_info(app: tauri::AppHandle) -> Result<CacheInfo, String> {
    let dir = cache_dir(&app).ok_or("no app data directory")?;
    Ok(CacheInfo {
        path: dir.to_string_lossy().into_owned(),
        bytes: dir_size(&dir),
    })
}

/// Delete the managed package cache (packages re-download on the next compile).
#[tauri::command]
pub async fn clear_tectonic_cache(app: tauri::AppHandle) -> Result<(), String> {
    let dir = cache_dir(&app).ok_or("no app data directory")?;
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(())
}

fn active_marker(dir: &Path) -> PathBuf {
    dir.join("active.txt")
}

fn read_active(dir: &Path) -> Option<String> {
    std::fs::read_to_string(active_marker(dir))
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Path to the active managed engine, if one is installed. Used by the compiler.
pub fn active_engine_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = engines_dir(app)?;

    if let Some(version) = read_active(&dir) {
        let p = installed_path(&dir, &version);
        if p.exists() {
            return Some(p);
        }
    }

    // Otherwise fall back to any installed engine.
    for entry in std::fs::read_dir(&dir).ok()?.flatten() {
        let path = entry.path();
        let name = path.file_name()?.to_string_lossy().into_owned();
        if !name.starts_with("tectonic-") {
            continue;
        }
        let is_exe = name.ends_with(".exe");
        if cfg!(windows) == is_exe {
            return Some(path);
        }
    }
    None
}

/// Map a GitHub release tag to a user-facing engine version, or `None` to skip
/// it. `continuous` is the rolling nightly (newer xetex-layout — fixes the
/// fontawesome5 / icon-font crash); stable CLI releases are tagged `tectonic@X`.
fn tag_to_version(tag: &str) -> Option<String> {
    if tag == "continuous" {
        Some("nightly".to_string())
    } else {
        tag.strip_prefix("tectonic@").map(|v| v.to_string())
    }
}

/// Inverse of [`tag_to_version`] — the release tag to download for a version.
fn version_to_tag(version: &str) -> String {
    if version == "nightly" {
        "continuous".to_string()
    } else {
        format!("tectonic@{version}")
    }
}

/// Ordering for the version list: nightly first, then newest stable descending.
fn version_order(a: &str, b: &str) -> std::cmp::Ordering {
    match (a == "nightly", b == "nightly") {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => b.cmp(a),
    }
}

/// Whether a release asset matches the current platform.
fn asset_matches(name: &str) -> bool {
    let target: Option<(&str, &str)> = if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        Some(("x86_64-pc-windows-msvc", ".zip"))
    } else if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        Some(("aarch64-apple-darwin", ".tar.gz"))
    } else if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        Some(("x86_64-apple-darwin", ".tar.gz"))
    } else if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        Some(("x86_64-unknown-linux-gnu", ".tar.gz"))
    } else {
        None
    };

    match target {
        Some((triple, ext)) => name.contains(triple) && name.ends_with(ext),
        None => false,
    }
}

#[derive(Deserialize)]
struct GhRelease {
    tag_name: String,
    #[serde(default)]
    assets: Vec<GhAsset>,
}

#[derive(Deserialize, Clone)]
struct GhAsset {
    name: String,
    browser_download_url: String,
}

async fn fetch_releases() -> Result<Vec<GhRelease>, String> {
    let url = format!("https://api.github.com/repos/{REPO}/releases?per_page=40");
    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("GitHub API returned {}", resp.status()));
    }
    resp.json::<Vec<GhRelease>>()
        .await
        .map_err(|e| e.to_string())
}

/// List Tectonic versions that have a binary for this platform.
#[tauri::command]
pub async fn list_tectonic_versions(app: tauri::AppHandle) -> Result<Vec<EngineVersion>, String> {
    let dir = engines_dir(&app).ok_or("no app data directory")?;
    let active = read_active(&dir);
    let releases = fetch_releases().await?;

    let mut out = Vec::new();
    for rel in releases {
        let Some(version) = tag_to_version(&rel.tag_name) else {
            continue;
        };
        if !rel.assets.iter().any(|a| asset_matches(&a.name)) {
            continue;
        }
        out.push(EngineVersion {
            installed: installed_path(&dir, &version).exists(),
            active: active.as_deref() == Some(version.as_str()),
            version,
            tag: rel.tag_name,
        });
    }
    out.sort_by(|a, b| version_order(&a.version, &b.version));
    Ok(out)
}

/// Download a Tectonic version, extract its binary into app-data, make it active.
#[tauri::command]
pub async fn download_tectonic(app: tauri::AppHandle, version: String) -> Result<String, String> {
    let dir = engines_dir(&app).ok_or("no app data directory")?;
    let releases = fetch_releases().await?;
    let tag = version_to_tag(&version);

    let rel = releases
        .into_iter()
        .find(|r| r.tag_name == tag)
        .ok_or("version not found")?;
    let asset = rel
        .assets
        .into_iter()
        .find(|a| asset_matches(&a.name))
        .ok_or("no Tectonic build for this platform")?;

    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| e.to_string())?;
    let bytes = client
        .get(&asset.browser_download_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    let target = installed_path(&dir, &version);
    extract_binary(&bytes, &asset.name, &target)?;
    // Atomic: a torn write of the marker would silently change which engine compiles.
    crate::fsx::atomic_write(&active_marker(&dir), version.as_bytes())
        .map_err(|e| e.to_string())?;

    Ok(target.to_string_lossy().into_owned())
}

/// Switch the active engine to an already-installed version.
#[tauri::command]
pub async fn set_active_engine(app: tauri::AppHandle, version: String) -> Result<(), String> {
    let dir = engines_dir(&app).ok_or("no app data directory")?;
    if !installed_path(&dir, &version).exists() {
        return Err("that version is not installed".into());
    }
    crate::fsx::atomic_write(&active_marker(&dir), version.as_bytes()).map_err(|e| e.to_string())
}

/// Uninstall a downloaded engine binary to reclaim disk space. If it was the
/// active engine, re-point `active` at any other installed version (or clear the
/// marker, letting the compiler fall back to a bundled / PATH `tectonic`).
#[tauri::command]
pub async fn remove_tectonic(app: tauri::AppHandle, version: String) -> Result<(), String> {
    let dir = engines_dir(&app).ok_or("no app data directory")?;
    let path = installed_path(&dir, &version);
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    if read_active(&dir).as_deref() == Some(version.as_str()) {
        match installed_versions(&dir).into_iter().find(|v| v != &version) {
            Some(next) => crate::fsx::atomic_write(&active_marker(&dir), next.as_bytes())
                .map_err(|e| e.to_string())?,
            // best-effort: clearing the marker just lets the compiler fall back to
            // a bundled / PATH `tectonic`; a leftover marker is corrected on next set.
            None => {
                let _ = std::fs::remove_file(active_marker(&dir));
            }
        }
    }
    Ok(())
}

fn extract_binary(bytes: &[u8], asset_name: &str, target: &Path) -> Result<(), String> {
    if asset_name.ends_with(".zip") {
        let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| e.to_string())?;
        for i in 0..archive.len() {
            let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
            let name = entry.name().replace('\\', "/");
            if name.ends_with("tectonic.exe") || name.ends_with("tectonic") {
                let mut buf = Vec::new();
                std::io::copy(&mut entry, &mut buf).map_err(|e| e.to_string())?;
                // Atomic: a torn write would leave a corrupt, executable engine binary.
                crate::fsx::atomic_write(target, &buf).map_err(|e| e.to_string())?;
                return set_executable(target);
            }
        }
        Err("no Tectonic binary inside the archive".into())
    } else if asset_name.ends_with(".tar.gz") {
        let gz = flate2::read::GzDecoder::new(Cursor::new(bytes));
        let mut archive = tar::Archive::new(gz);
        for entry in archive.entries().map_err(|e| e.to_string())? {
            let mut entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path().map_err(|e| e.to_string())?.into_owned();
            if path.file_name().map(|n| n == "tectonic").unwrap_or(false) {
                let mut buf = Vec::new();
                std::io::copy(&mut entry, &mut buf).map_err(|e| e.to_string())?;
                // Atomic: a torn write would leave a corrupt, executable engine binary.
                crate::fsx::atomic_write(target, &buf).map_err(|e| e.to_string())?;
                return set_executable(target);
            }
        }
        Err("no Tectonic binary inside the archive".into())
    } else {
        Err("unknown archive format".into())
    }
}

#[cfg(unix)]
fn set_executable(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let mut perms = std::fs::metadata(path)
        .map_err(|e| e.to_string())?
        .permissions();
    perms.set_mode(0o755);
    std::fs::set_permissions(path, perms).map_err(|e| e.to_string())
}

#[cfg(not(unix))]
fn set_executable(_path: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tag_and_version_map_both_ways() {
        assert_eq!(tag_to_version("continuous").as_deref(), Some("nightly"));
        assert_eq!(tag_to_version("tectonic@0.16.9").as_deref(), Some("0.16.9"));
        assert_eq!(tag_to_version("tectonic@1.0.0").as_deref(), Some("1.0.0"));
        // Non-Tectonic / unrecognised tags are skipped.
        assert_eq!(tag_to_version("v1.2.3"), None);
        assert_eq!(tag_to_version("untagged-abc"), None);

        assert_eq!(version_to_tag("nightly"), "continuous");
        assert_eq!(version_to_tag("0.16.9"), "tectonic@0.16.9");
    }

    #[test]
    fn versions_sort_nightly_first_then_newest() {
        let mut v = vec!["0.15.0", "nightly", "0.16.9", "0.4.1", "0.16.10"];
        v.sort_by(|a, b| version_order(a, b));
        assert_eq!(v, vec!["nightly", "0.4.1", "0.16.9", "0.16.10", "0.15.0"]);
    }

    #[test]
    fn installed_versions_parses_only_engine_binaries() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path();
        std::fs::write(installed_path(p, "0.16.9"), b"x").unwrap();
        std::fs::write(installed_path(p, "nightly"), b"x").unwrap();
        // Noise that must be ignored.
        std::fs::write(p.join("active.txt"), b"nightly").unwrap();
        std::fs::write(p.join("notes.md"), b"x").unwrap();

        let mut got = installed_versions(p);
        got.sort();
        assert_eq!(got, vec!["0.16.9".to_string(), "nightly".to_string()]);
    }

    #[test]
    #[cfg(any(
        all(target_os = "windows", target_arch = "x86_64"),
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "macos", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "x86_64"),
    ))]
    fn asset_matches_host_platform() {
        #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
        let name = "tectonic-0.16.9-x86_64-pc-windows-msvc.zip";
        #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
        let name = "tectonic-0.16.9-aarch64-apple-darwin.tar.gz";
        #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
        let name = "tectonic-0.16.9-x86_64-apple-darwin.tar.gz";
        #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
        let name = "tectonic-0.16.9-x86_64-unknown-linux-gnu.tar.gz";

        assert!(asset_matches(name));
        assert!(!asset_matches("tectonic-0.16.9-some-other-triple.zip"));
        assert!(!asset_matches("tectonic-0.16.9.txt"));
    }
}
