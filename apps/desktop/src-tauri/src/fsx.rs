//! Atomic file writes.
//!
//! Files the app re-reads on the next launch (project `.tex` files, the engine
//! `active.txt` marker, the `.glyphx` manifest) must never be left half-written:
//! a crash or power-loss between truncate and write corrupts the file. The fix is
//! the standard temp-file dance — write a sibling temp file, flush + fsync, then
//! `rename` it over the target. `rename` is atomic on the same filesystem (and on
//! Windows Rust's `fs::rename` replaces an existing target), so a reader either
//! sees the old file or the fully-written new one, never a torn write.

use std::fs;
use std::io::Write as _;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

/// Per-process counter so two concurrent writes to the same target don't collide
/// on the temp name.
static SEQ: AtomicU64 = AtomicU64::new(0);

/// Atomically write `contents` to `path` (creating parent directories as needed).
/// Writes to a temp file in the *same* directory, fsyncs, then renames over the
/// target. On error the temp file is cleaned up best-effort.
pub fn atomic_write(path: &Path, contents: &[u8]) -> std::io::Result<()> {
    let parent = path.parent().filter(|p| !p.as_os_str().is_empty());
    if let Some(parent) = parent {
        fs::create_dir_all(parent)?;
    }
    let dir = parent.unwrap_or_else(|| Path::new("."));
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("glyphx");
    let seq = SEQ.fetch_add(1, Ordering::Relaxed);
    let tmp = dir.join(format!(".{file_name}.tmp-{}-{seq}", std::process::id()));

    let write_result = (|| {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(contents)?;
        f.flush()?;
        // Durably persist the bytes before the rename so a crash can't leave the
        // renamed file pointing at unflushed (zero-length) data.
        f.sync_all()?;
        Ok(())
    })();

    match write_result.and_then(|()| fs::rename(&tmp, path)) {
        Ok(()) => Ok(()),
        Err(e) => {
            let _ = fs::remove_file(&tmp); // best-effort: don't leak the temp file
            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atomic_write_creates_and_overwrites() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("nested").join("file.txt");
        atomic_write(&target, b"first").unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "first");
        // Overwriting replaces atomically and leaves no temp files behind.
        atomic_write(&target, b"second").unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "second");
        let leftovers: Vec<_> = fs::read_dir(target.parent().unwrap())
            .unwrap()
            .flatten()
            .filter(|e| e.file_name().to_string_lossy().contains(".tmp-"))
            .collect();
        assert!(leftovers.is_empty(), "temp files should be cleaned up");
    }
}
