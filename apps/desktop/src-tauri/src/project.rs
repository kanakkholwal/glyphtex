//! Folder-based LaTeX projects: filesystem access, zip import, zip export.
//!
//! A GlyphTeX project is just a folder on disk (like Overleaf / a normal LaTeX
//! project). The frontend picks a folder via the native dialog, then drives
//! these commands to read the file tree, load/save files, and create / rename /
//! delete entries. Import accepts a `.zip` (extracted to a user-chosen folder);
//! export bundles the project back into a `.zip`.
//!
//! These use `std::fs` directly (rather than the scoped fs plugin) so an
//! arbitrary user-chosen folder is fully accessible — access is gated by the
//! user explicitly picking the folder in a native dialog.

use std::fs;
use std::io::{Read as _, Write as _};
use std::path::{Path, PathBuf};

use serde::Serialize;
use zip::write::SimpleFileOptions;

/// Directories never shown in the Explorer or included in an export — version
/// control, dependency caches, and build artifacts.
const SKIP_DIRS: [&str; 5] = [".git", ".svn", "node_modules", ".glyphtex-build", "_minted"];

/// A file inside a project, with its absolute path (stable id) and a forward
/// slash relative path (display name; the frontend nests folders by splitting on `/`).
#[derive(Serialize)]
pub struct ProjectFile {
    pub abs: String,
    pub rel: String,
}

fn rel_path(base: &Path, path: &Path) -> String {
    path.strip_prefix(base)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn walk(base: &Path, dir: &Path, out: &mut Vec<ProjectFile>) -> std::io::Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        let ft = entry.file_type()?;
        if ft.is_dir() {
            // Skip junk + hidden dirs, but keep walking real project folders.
            if SKIP_DIRS.contains(&name.as_str()) || name.starts_with('.') {
                continue;
            }
            walk(base, &path, out)?;
        } else if ft.is_file() {
            if name.starts_with('.') && name != ".latexmkrc" {
                continue;
            }
            out.push(ProjectFile {
                abs: path.to_string_lossy().into_owned(),
                rel: rel_path(base, &path),
            });
        }
    }
    Ok(())
}

/// List every file in a project folder (recursive), as `{abs, rel}`. Folders are
/// implied by the relative paths, so the frontend can build the tree.
///
/// `async` + `spawn_blocking`: a recursive walk is blocking I/O and must not run
/// on the main thread (it freezes the macOS WKWebView) nor occupy an async worker
/// (AGENTS.md §4, the macOS rule + heavy-work-off-the-event-loop).
#[tauri::command]
pub async fn read_project_files(root: String) -> Result<Vec<ProjectFile>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let base = PathBuf::from(&root);
        if !base.is_dir() {
            return Err(format!("Not a folder: {root}"));
        }
        let mut out = Vec::new();
        walk(&base, &base, &mut out).map_err(|e| e.to_string())?;
        out.sort_by(|a, b| a.rel.to_lowercase().cmp(&b.rel.to_lowercase()));
        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Read a text file. Returns an error for binary / non-UTF-8 files so the editor
/// can show a friendly "binary file" notice instead of garbled content.
#[tauri::command]
pub async fn read_file_text(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bytes = fs::read(&path).map_err(|e| e.to_string())?;
        String::from_utf8(bytes).map_err(|_| "binary or non-UTF-8 file".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Write (or overwrite) a text file, creating parent folders as needed.
/// Written atomically (temp + rename) so a crash mid-write can't corrupt a file
/// the editor reopens on next launch.
#[tauri::command]
pub async fn write_file_text(path: String, content: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::fsx::atomic_write(&PathBuf::from(&path), content.as_bytes())
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Create a new empty file (or folder when `dir` is true), making parents.
#[tauri::command]
pub async fn create_path(path: String, dir: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = PathBuf::from(&path);
        if p.exists() {
            return Err("a file or folder with that name already exists".into());
        }
        if dir {
            fs::create_dir_all(&p).map_err(|e| e.to_string())
        } else {
            if let Some(parent) = p.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::write(&p, "").map_err(|e| e.to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Rename / move a file or folder.
#[tauri::command]
pub async fn rename_path(from: String, to: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let to_path = PathBuf::from(&to);
        if let Some(parent) = to_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::rename(&from, &to_path).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Delete a file or folder (folders are removed recursively).
#[tauri::command]
pub async fn delete_path(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = PathBuf::from(&path);
        if p.is_dir() {
            fs::remove_dir_all(&p).map_err(|e| e.to_string())
        } else {
            fs::remove_file(&p).map_err(|e| e.to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Whether a path exists. A single `stat` — cheap enough to stay a sync getter.
#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

/// Starter document for a brand-new project.
const STARTER_TEX: &str = r#"% New document
\documentclass{article}
\usepackage{amsmath}
\usepackage{graphicx} % \includegraphics for figures

\title{Untitled}
\author{}
\date{}

\begin{document}
\maketitle

Start writing here.

\end{document}
"#;

/// Make a string safe as a folder name (strip characters Windows/macOS reject,
/// and leading/trailing dots/spaces), falling back to a default.
fn sanitize_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| {
            if matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') || c.is_control() {
                '-'
            } else {
                c
            }
        })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.').trim();
    if trimmed.is_empty() {
        "Untitled project".to_string()
    } else {
        trimmed.to_string()
    }
}

/// Create a brand-new project folder in the app's own data directory (no save
/// prompt — projects live here by default; the user can still Import or Open a
/// folder elsewhere). Writes a starter `main.tex` and returns the project root.
#[tauri::command]
pub async fn create_local_project(app: tauri::AppHandle, name: String) -> Result<String, String> {
    use tauri::Manager;
    // Resolve the app dir on the async thread (cheap), then do the blocking FS work
    // off the event loop.
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("projects");
    tauri::async_runtime::spawn_blocking(move || {
        fs::create_dir_all(&base).map_err(|e| e.to_string())?;
        let root = unique_dir(&base, &sanitize_name(&name));
        fs::create_dir_all(&root).map_err(|e| e.to_string())?;
        crate::fsx::atomic_write(&root.join("main.tex"), STARTER_TEX.as_bytes())
            .map_err(|e| e.to_string())?;
        Ok(root.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// A project folder living in the app's own data directory, with its display
/// name and last-modified time (ms). Drives the home page's local-projects list.
#[derive(Serialize)]
pub struct LocalProject {
    pub root: String,
    pub name: String,
    pub modified: u64,
}

/// List the project folders GlyphTeX manages in its own data directory. Returns an
/// empty list when that directory doesn't exist yet (fresh install). Imported /
/// externally-opened folders are tracked by the frontend, not here.
#[tauri::command]
pub async fn list_local_projects(app: tauri::AppHandle) -> Result<Vec<LocalProject>, String> {
    use tauri::Manager;
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("projects");
    tauri::async_runtime::spawn_blocking(move || {
        let mut out = Vec::new();
        let entries = match fs::read_dir(&base) {
            Ok(e) => e,
            Err(_) => return Ok(out),
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("project")
                .to_string();
            let modified = entry
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            out.push(LocalProject {
                root: path.to_string_lossy().into_owned(),
                name,
                modified,
            });
        }
        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Choose a non-colliding folder name inside `parent` based on `stem`.
fn unique_dir(parent: &Path, stem: &str) -> PathBuf {
    let mut candidate = parent.join(stem);
    let mut n = 2;
    while candidate.exists() {
        candidate = parent.join(format!("{stem} ({n})"));
        n += 1;
    }
    candidate
}

/// Import a `.zip` archive as a project: extract it into a fresh folder under
/// `dest_parent` (named after the archive). Returns the project root to open.
/// If the archive has a single top-level folder wrapping everything, that inner
/// folder becomes the root (avoids a redundant nesting level).
#[tauri::command]
pub async fn import_zip(zip_path: String, dest_parent: String) -> Result<String, String> {
    // Reading + extracting the whole archive is heavy blocking work — run it off
    // the event loop (AGENTS.md §4, macOS rule + heavy work off the UI thread).
    tauri::async_runtime::spawn_blocking(move || {
        let zip_file = PathBuf::from(&zip_path);
        let stem = zip_file
            .file_stem()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| "imported-project".to_string());
        let parent = PathBuf::from(&dest_parent);
        if !parent.is_dir() {
            return Err(format!("Not a folder: {dest_parent}"));
        }
        let root = unique_dir(&parent, &stem);
        fs::create_dir_all(&root).map_err(|e| e.to_string())?;

        let bytes = fs::read(&zip_file).map_err(|e| e.to_string())?;
        let mut archive =
            zip::ZipArchive::new(std::io::Cursor::new(bytes)).map_err(|e| e.to_string())?;

        for i in 0..archive.len() {
            let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
            // `enclosed_name` rejects path traversal (`..`, absolute paths).
            let Some(rel) = entry.enclosed_name() else {
                continue;
            };
            let out_path = root.join(&rel);
            if entry.is_dir() {
                fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
            } else {
                if let Some(parent) = out_path.parent() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                let mut buf = Vec::new();
                entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
                fs::write(&out_path, &buf).map_err(|e| e.to_string())?;
            }
        }

        // Unwrap a single wrapping folder (e.g. archives of `my-paper/...`).
        let mut top: Vec<PathBuf> = fs::read_dir(&root)
            .map_err(|e| e.to_string())?
            .flatten()
            .map(|e| e.path())
            .collect();
        if top.len() == 1 && top[0].is_dir() {
            return Ok(top.remove(0).to_string_lossy().into_owned());
        }
        Ok(root.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| e.to_string())?
}

fn zip_dir(base: &Path, dir: &Path, zip: &mut zip::ZipWriter<fs::File>) -> Result<(), String> {
    let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        let ft = entry.file_type().map_err(|e| e.to_string())?;
        if ft.is_dir() {
            if SKIP_DIRS.contains(&name.as_str()) || name.starts_with('.') {
                continue;
            }
            zip_dir(base, &path, zip)?;
        } else if ft.is_file() {
            let rel = rel_path(base, &path);
            zip.start_file(rel, opts).map_err(|e| e.to_string())?;
            let bytes = fs::read(&path).map_err(|e| e.to_string())?;
            zip.write_all(&bytes).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Export a project folder to a `.zip` at `out_path` (build artifacts / VCS dirs
/// excluded). Paths inside the archive are relative to the project root.
#[tauri::command]
pub async fn export_zip(root: String, out_path: String) -> Result<(), String> {
    // Recursively reading + compressing the project is heavy blocking work — run
    // it off the event loop (AGENTS.md §4, macOS rule).
    tauri::async_runtime::spawn_blocking(move || {
        let base = PathBuf::from(&root);
        if !base.is_dir() {
            return Err(format!("Not a folder: {root}"));
        }
        let file = fs::File::create(&out_path).map_err(|e| e.to_string())?;
        let mut zip = zip::ZipWriter::new(file);
        zip_dir(&base, &base, &mut zip)?;
        zip.finish().map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_name_keeps_plain_and_strips_illegal() {
        assert_eq!(sanitize_name("My Project"), "My Project");
        // Illegal filename characters become '-'.
        assert_eq!(sanitize_name("a/b:c*?"), "a-b-c--");
        // Trailing dots / spaces (Windows-hostile) are trimmed.
        assert_eq!(sanitize_name("  notes..  "), "notes");
        // Empty / all-whitespace falls back to a default.
        assert_eq!(sanitize_name("   "), "Untitled project");
    }

    #[test]
    fn unique_dir_avoids_collisions() {
        let dir = tempfile::tempdir().unwrap();
        let base = dir.path();
        let first = unique_dir(base, "proj");
        assert_eq!(first, base.join("proj"));
        fs::create_dir_all(&first).unwrap();
        // The name is taken now → next candidate is suffixed.
        assert_eq!(unique_dir(base, "proj"), base.join("proj (2)"));
    }
}
