//! Git version control via gitoxide (`gix`) — pure Rust, no system `git` or C
//! deps, so the client is OS-agnostic and can cross-compile to mobile later.
//!
//! v1 is local-first: detect/init a repo, read branch + history, the working-tree
//! status (staged vs unstaged), stage/unstage via the real index, and commit.
//! Remotes (clone/fetch/push + auth) are a later phase.

use std::process::Command;
use std::sync::atomic::AtomicBool;

use serde::Serialize;

use gix::bstr::{BString, ByteSlice};
use gix::index::entry::{Flags, Mode, Stat};

use crate::subprocess::CommandExt as _;

fn open(root: &str) -> Result<gix::Repository, String> {
    gix::open(root).map_err(|e| e.to_string())
}

/// Spawn a system `git` subcommand in `root` and return the raw `Output`. This is
/// the single choke point for shelling out to git — the one place that explains a
/// missing Git install — so callers that need stdout/stderr/status (e.g. the sync
/// merge-conflict check) don't open-code their own spawn (AGENTS.md §3).
fn run_git_raw<I, S>(root: &str, args: I) -> Result<std::process::Output, String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<std::ffi::OsStr>,
{
    Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .no_window()
        .output()
        .map_err(|e| {
            format!("Could not run git — Git needs to be installed to sync with a remote. ({e})")
        })
}

/// Run a system `git` subcommand in `root`, returning trimmed stdout on success.
/// Used for operations gitoxide can't do yet (push) or where its worktree apply
/// is immature (pull --ff-only).
fn run_git<I, S>(root: &str, args: I) -> Result<String, String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<std::ffi::OsStr>,
{
    let out = run_git_raw(root, args)?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        let err = String::from_utf8_lossy(&out.stderr);
        Err(if err.trim().is_empty() {
            format!("git exited with code {:?}", out.status.code())
        } else {
            err.trim().to_string()
        })
    }
}

/// Whether a usable system `git` is on PATH. The remote half of the client
/// (push / pull / sync / remote management / ahead-behind) shells out to `git`,
/// so the UI calls this up front to show a friendly "Git isn't installed" state
/// instead of letting each action fail with a raw spawn error. `async` because it
/// spawns a process (the macOS rule, §4).
#[tauri::command]
pub async fn git_available() -> bool {
    tauri::async_runtime::spawn_blocking(|| {
        Command::new("git")
            .arg("--version")
            .no_window()
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    })
    .await
    .unwrap_or(false)
}

/// Open the repo's index for mutation, or an empty in-memory one (pointing at the
/// repo's index path) when none exists yet — so the first `git add` works.
///
/// The fallback also covers a missing index file (the common unborn-repo case). A
/// genuinely corrupt index would likewise start empty here; the subsequent
/// stage/commit rewrites it, so we don't propagate that as a hard error.
fn open_index_mut(repo: &gix::Repository) -> gix::index::File {
    repo.open_index().unwrap_or_else(|_| {
        gix::index::File::from_state(
            gix::index::State::new(repo.object_hash()),
            repo.git_dir().join("index"),
        )
    })
}

/// True while a merge is in progress (a `MERGE_HEAD` is present) — the working
/// tree may contain conflicts that need resolving before the merge can commit.
fn merge_in_progress(repo: &gix::Repository) -> bool {
    repo.git_dir().join("MERGE_HEAD").exists()
}

/// Whether `root` is the top of a Git repository.
#[tauri::command]
pub async fn git_is_repo(root: String) -> bool {
    gix::open(&root).is_ok()
}

/// Initialize a new Git repository at `root`.
#[tauri::command]
pub async fn git_init(root: String) -> Result<(), String> {
    gix::init(&root).map(|_| ()).map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct GitHead {
    /// Short branch name (e.g. `main`), or `None` when detached / unborn.
    pub branch: Option<String>,
    /// True before the first commit (HEAD points at an unborn branch).
    pub unborn: bool,
    /// Upstream tracking branch (e.g. `origin/main`), if one is configured.
    pub upstream: Option<String>,
    /// Commits the local branch is ahead of its upstream (`None` if no upstream).
    pub ahead: Option<u32>,
    /// Commits the local branch is behind its upstream.
    pub behind: Option<u32>,
    /// True while a merge is in progress (working tree may have conflicts).
    pub merging: bool,
}

/// `<remote>/<current-branch>` if such a remote-tracking ref exists (prefers
/// `origin`). Used to measure "behind" when no upstream is configured.
fn tracking_ref(root: &str) -> Option<String> {
    let branch = run_git(root, ["rev-parse", "--abbrev-ref", "HEAD"])
        .ok()
        .filter(|s| !s.is_empty() && s != "HEAD")?;
    let remotes = run_git(root, ["remote"]).ok()?;
    let remote = remotes
        .lines()
        .find(|r| r.trim() == "origin")
        .or_else(|| remotes.lines().next())?
        .trim()
        .to_string();
    let candidate = format!("{remote}/{branch}");
    let full = format!("refs/remotes/{candidate}");
    run_git(root, ["rev-parse", "--verify", "--quiet", full.as_str()])
        .ok()
        .map(|_| candidate)
}

/// Upstream + ahead/behind, via system git (best-effort: all `None` when git
/// isn't installed or there's nothing to compare against).
///
/// `ahead` counts local commits not present on **any** remote-tracking branch
/// (`HEAD --not --remotes`), so unpushed commits show even when no upstream is
/// configured — the common case after a local `init` + `remote add` (our
/// token-in-URL push never sets tracking). `behind` is measured against the
/// upstream, else the matching `origin/<branch>` ref, else left unknown.
fn ahead_behind(root: &str) -> (Option<String>, Option<u32>, Option<u32>) {
    // No commits yet → nothing to compare.
    if run_git(root, ["rev-parse", "--verify", "--quiet", "HEAD"]).is_err() {
        return (None, None, None);
    }
    // No remotes configured → ahead/behind are meaningless (use "Publish" UX later).
    let has_remote = run_git(root, ["remote"])
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    if !has_remote {
        return (None, None, None);
    }

    let upstream = run_git(
        root,
        ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
    )
    .ok()
    .filter(|s| !s.is_empty());

    // "behind" target: the upstream, else origin/<branch> if it exists.
    let target = upstream.clone().or_else(|| tracking_ref(root));
    let behind = target.as_ref().and_then(|t| {
        let range = format!("HEAD..{t}");
        run_git(root, ["rev-list", "--count", range.as_str()])
            .ok()
            .and_then(|s| s.trim().parse().ok())
    });

    // "ahead" = local commits not on any remote — robust without an upstream.
    let ahead = run_git(root, ["rev-list", "--count", "HEAD", "--not", "--remotes"])
        .ok()
        .and_then(|s| s.trim().parse().ok());

    (upstream, ahead, behind)
}

/// The repository's current branch / HEAD state (plus ahead/behind vs upstream).
#[tauri::command]
pub async fn git_head(root: String) -> Result<GitHead, String> {
    let repo = open(&root)?;
    let branch = repo
        .head_name()
        .map_err(|e| e.to_string())?
        .map(|name| name.shorten().to_string());
    let unborn = repo.head_id().is_err();
    let (upstream, ahead, behind) = ahead_behind(&root);
    Ok(GitHead {
        branch,
        unborn,
        upstream,
        ahead,
        behind,
        merging: merge_in_progress(&repo),
    })
}

#[derive(Serialize)]
pub struct GitChange {
    /// Path relative to the repository root (forward slashes).
    pub path: String,
    /// `modified` | `added` | `deleted` | `renamed` | `untracked`.
    pub status: String,
    /// True when the change is staged in the index (HEAD↔index).
    pub staged: bool,
}

/// Working-tree status: staged changes (HEAD↔index) and unstaged / untracked
/// changes (index↔worktree). A file may appear in both lists.
#[tauri::command]
pub async fn git_status(root: String) -> Result<Vec<GitChange>, String> {
    let repo = open(&root)?;
    let mut out = Vec::new();

    let iter = repo
        .status(gix::progress::Discard)
        .map_err(|e| e.to_string())?
        .untracked_files(gix::status::UntrackedFiles::Files)
        .into_iter(Vec::<BString>::new())
        .map_err(|e| e.to_string())?;

    for item in iter {
        let item = item.map_err(|e| e.to_string())?;
        let path = item.location().to_string();
        match item {
            gix::status::Item::IndexWorktree(change) => {
                use gix::status::index_worktree::Item as IW;
                let status = match change {
                    IW::DirectoryContents { .. } => "untracked",
                    IW::Rewrite { .. } => "renamed",
                    IW::Modification { .. } => "modified",
                };
                out.push(GitChange {
                    path,
                    status: status.into(),
                    staged: false,
                });
            }
            gix::status::Item::TreeIndex(change) => {
                use gix::diff::index::Change as C;
                let status = match change {
                    C::Addition { .. } => "added",
                    C::Deletion { .. } => "deleted",
                    C::Rewrite { .. } => "renamed",
                    C::Modification { .. } => "modified",
                };
                out.push(GitChange {
                    path,
                    status: status.into(),
                    staged: true,
                });
            }
        }
    }

    // During a merge, surface conflicted (unmerged) files distinctly. This is the
    // only time we shell out from status; the common (non-merge) path stays pure.
    if merge_in_progress(&repo) {
        if let Ok(list) = run_git(&root, ["diff", "--name-only", "--diff-filter=U"]) {
            let conflicted: std::collections::BTreeSet<String> = list
                .lines()
                .map(|l| l.trim().to_string())
                .filter(|l| !l.is_empty())
                .collect();
            if !conflicted.is_empty() {
                out.retain(|c| !conflicted.contains(&c.path));
                for path in conflicted {
                    out.push(GitChange {
                        path,
                        status: "conflicted".into(),
                        staged: false,
                    });
                }
            }
        }
    }
    Ok(out)
}

/// Stage paths into the index (`git add`). A missing file stages its deletion.
#[tauri::command]
pub async fn git_stage(root: String, paths: Vec<String>) -> Result<(), String> {
    let repo = open(&root)?;
    let work_dir = repo
        .work_dir()
        .ok_or("Cannot stage in a bare repository.")?
        .to_owned();
    let mut index = open_index_mut(&repo);

    // Replace any existing entries for these paths, then re-add present files.
    let targets: std::collections::BTreeSet<&str> = paths.iter().map(|s| s.as_str()).collect();
    index.remove_entries(|_, p, _| p.to_str().map(|p| targets.contains(p)).unwrap_or(false));

    for rel in &paths {
        let abs = work_dir.join(rel);
        if abs.exists() {
            let bytes = std::fs::read(&abs).map_err(|e| e.to_string())?;
            let oid = repo.write_blob(bytes).map_err(|e| e.to_string())?.detach();
            index.dangerously_push_entry(
                Stat::default(),
                oid,
                Flags::empty(),
                Mode::FILE,
                rel.as_str().into(),
            );
        }
        // Missing file → leave it removed from the index (staged deletion).
    }
    index.sort_entries();
    index
        .write(gix::index::write::Options::default())
        .map_err(|e| e.to_string())
}

/// Unstage paths (`git reset <path>`): reset the index entry to HEAD's version,
/// or drop it entirely when the path isn't in HEAD (so it returns to untracked).
#[tauri::command]
pub async fn git_unstage(root: String, paths: Vec<String>) -> Result<(), String> {
    let repo = open(&root)?;
    // `None` here means an unborn HEAD (no commits yet) — the expected case where
    // unstaging just drops the index entry below. (A genuinely broken HEAD would
    // also surface as a later op failing loudly, not as silent data loss.)
    let head_tree = repo.head_tree().ok();
    let mut index = open_index_mut(&repo);

    let targets: std::collections::BTreeSet<&str> = paths.iter().map(|s| s.as_str()).collect();
    index.remove_entries(|_, p, _| p.to_str().map(|p| targets.contains(p)).unwrap_or(false));

    if let Some(tree) = head_tree {
        for rel in &paths {
            if let Ok(Some(entry)) = tree.lookup_entry_by_path(std::path::Path::new(rel)) {
                let kind = entry.mode().kind();
                let mode = match kind {
                    gix::objs::tree::EntryKind::BlobExecutable => Mode::FILE_EXECUTABLE,
                    gix::objs::tree::EntryKind::Link => Mode::SYMLINK,
                    gix::objs::tree::EntryKind::Commit => Mode::COMMIT,
                    _ => Mode::FILE,
                };
                index.dangerously_push_entry(
                    Stat::default(),
                    entry.oid().to_owned(),
                    Flags::empty(),
                    mode,
                    rel.as_str().into(),
                );
            }
        }
    }
    index.sort_entries();
    index
        .write(gix::index::write::Options::default())
        .map_err(|e| e.to_string())
}

/// Discard working-tree changes for `paths` (`git restore <path>`): rewrite each
/// file from its staged (index) version, or HEAD if it isn't in the index, and
/// delete it when it's untracked (present in neither). Pure Rust — does not touch
/// the index, so a staged change stays staged; only the worktree is reverted.
#[tauri::command]
pub async fn git_discard(root: String, paths: Vec<String>) -> Result<(), String> {
    let repo = open(&root)?;
    let work_dir = repo
        .work_dir()
        .ok_or("No working tree in a bare repository.")?
        .to_owned();
    let index = open_index_mut(&repo);
    // `None` = unborn HEAD (no commits): discard then falls back to the index blob.
    let head_tree = repo.head_tree().ok();

    for rel in &paths {
        // Restore source: index blob first, then HEAD blob.
        let blob = index
            .entry_by_path(rel.as_str().into())
            .and_then(|e| repo.find_object(e.id).ok())
            .map(|o| o.data.clone())
            .or_else(|| {
                head_tree.as_ref().and_then(|t| {
                    t.lookup_entry_by_path(std::path::Path::new(rel))
                        .ok()
                        .flatten()
                        .and_then(|e| e.object().ok())
                        .map(|o| o.data.clone())
                })
            });
        let abs = work_dir.join(rel);
        match blob {
            // Tracked: rewrite the file with its committed/staged content.
            Some(data) => {
                if let Some(parent) = abs.parent() {
                    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                std::fs::write(&abs, data).map_err(|e| e.to_string())?;
            }
            // Untracked: remove it from disk.
            None => {
                if abs.exists() {
                    std::fs::remove_file(&abs).map_err(|e| e.to_string())?;
                }
            }
        }
    }
    Ok(())
}

/// Commit the staged index. Returns the short hash.
#[tauri::command]
pub async fn git_commit(root: String, message: String) -> Result<String, String> {
    if message.trim().is_empty() {
        return Err("Commit message is empty.".into());
    }
    let mut repo = open(&root)?;
    let index = open_index_mut(&repo);
    // Detach to an owned id so it doesn't hold a borrow across the config edit below.
    let head_id = repo.head_id().ok().map(|id| id.detach());

    if index.entries().is_empty() && head_id.is_none() {
        return Err("Nothing staged to commit.".into());
    }

    let merging = merge_in_progress(&repo);

    // Identity: repo config, else a sensible default.
    let (name, email) = {
        let snap = repo.config_snapshot();
        (
            snap.string("user.name")
                .map(|s| s.to_string())
                .unwrap_or_else(|| "GlyphX".to_string()),
            snap.string("user.email")
                .map(|s| s.to_string())
                .unwrap_or_else(|| "glyphx@localhost".to_string()),
        )
    };
    // gix stamps the reflog with the *configured* committer (not the signature
    // passed to commit_as), so on a machine with no git identity (e.g. CI) the
    // commit would fail with "The reflog could not be created or updated". Seed
    // the in-memory config with our identity so the reflog can be written.
    {
        let mut cfg = repo.config_snapshot_mut();
        cfg.set_value(&gix::config::tree::User::NAME, name.as_str())
            .map_err(|e| e.to_string())?;
        cfg.set_value(&gix::config::tree::User::EMAIL, email.as_str())
            .map_err(|e| e.to_string())?;
        cfg.commit().map_err(|e| e.to_string())?;
    }

    // Build the commit tree from the index entries.
    let mut editor = repo
        .edit_tree(repo.empty_tree().id().detach())
        .map_err(|e| e.to_string())?;
    for entry in index.entries() {
        let path = entry.path(&index);
        let p = path.to_str().map_err(|e| e.to_string())?;
        let m = entry.mode;
        let kind = if m == Mode::DIR {
            continue;
        } else if m == Mode::SYMLINK {
            gix::objs::tree::EntryKind::Link
        } else if m == Mode::COMMIT {
            gix::objs::tree::EntryKind::Commit
        } else if m == Mode::FILE_EXECUTABLE {
            gix::objs::tree::EntryKind::BlobExecutable
        } else {
            gix::objs::tree::EntryKind::Blob
        };
        editor
            .upsert(p, kind, entry.id)
            .map_err(|e| e.to_string())?;
    }
    let tree_id = editor.write().map_err(|e| e.to_string())?.detach();

    // A merge commit is legitimate even if its tree matches HEAD's, so only
    // reject empty commits when we're NOT completing a merge.
    if !merging {
        if let Ok(head_tree) = repo.head_tree_id() {
            if head_tree.detach() == tree_id {
                return Err("Nothing staged to commit.".into());
            }
        }
    }

    let sig = gix::actor::Signature {
        name: name.into(),
        email: email.into(),
        time: gix::date::Time::now_utc(),
    };
    let sig_ref = sig.to_ref();

    // Parents: HEAD, plus any MERGE_HEAD(s) so resolving + committing finishes
    // the merge with the correct two-parent history.
    let mut parents: Vec<gix::ObjectId> = head_id.into_iter().collect();
    if merging {
        if let Ok(content) = std::fs::read_to_string(repo.git_dir().join("MERGE_HEAD")) {
            for line in content.lines() {
                let line = line.trim();
                if !line.is_empty() {
                    if let Ok(oid) = gix::ObjectId::from_hex(line.as_bytes()) {
                        parents.push(oid);
                    }
                }
            }
        }
    }
    let commit_id = repo
        .commit_as(sig_ref, sig_ref, "HEAD", &message, tree_id, parents)
        .map_err(|e| e.to_string())?;

    // Clear the merge state once the merge commit lands.
    if merging {
        let gd = repo.git_dir();
        for f in ["MERGE_HEAD", "MERGE_MSG", "MERGE_MODE"] {
            let _ = std::fs::remove_file(gd.join(f));
        }
    }

    Ok(commit_id.to_hex_with_len(7).to_string())
}

/// Unified diff for a single path. `staged` selects HEAD↔index (the staged
/// change) vs index↔worktree (the unstaged change). Empty string when identical.
#[tauri::command]
pub async fn git_diff(root: String, path: String, staged: bool) -> Result<String, String> {
    let repo = open(&root)?;
    let (old, new) = file_sides(&repo, &path, staged)?;

    let old_s = String::from_utf8_lossy(&old);
    let new_s = String::from_utf8_lossy(&new);
    if old_s == new_s {
        return Ok(String::new());
    }

    let diff = similar::TextDiff::from_lines(old_s.as_ref(), new_s.as_ref());
    Ok(diff
        .unified_diff()
        .context_radius(3)
        .header(&format!("a/{path}"), &format!("b/{path}"))
        .to_string())
}

/// The two sides of a change for `path`: `(old, new)` raw bytes. `staged` selects
/// HEAD↔index; otherwise (index|HEAD)↔worktree. Shared by the unified diff and
/// the side-by-side / inline diff editor.
fn file_sides(
    repo: &gix::Repository,
    path: &str,
    staged: bool,
) -> Result<(Vec<u8>, Vec<u8>), String> {
    let work_dir = repo
        .work_dir()
        .ok_or("No working tree in a bare repository.")?
        .to_owned();

    let head_blob = repo
        .head_tree()
        .ok()
        .and_then(|t| {
            t.lookup_entry_by_path(std::path::Path::new(path))
                .ok()
                .flatten()
        })
        .and_then(|e| e.object().ok())
        .map(|o| o.data.clone());

    let index = open_index_mut(repo);
    let index_blob = index
        .entry_by_path(path.into())
        .and_then(|e| repo.find_object(e.id).ok())
        .map(|o| o.data.clone());

    Ok(if staged {
        (
            head_blob.unwrap_or_default(),
            index_blob.unwrap_or_default(),
        )
    } else {
        let worktree = std::fs::read(work_dir.join(path)).unwrap_or_default();
        (index_blob.or(head_blob).unwrap_or_default(), worktree)
    })
}

/// The full text of both sides of a change, for the diff editor (side-by-side /
/// inline). `binary` is set when either side contains a NUL byte, so the UI can
/// show a "binary file" placeholder instead of mojibake.
#[derive(Serialize)]
pub struct FileVersions {
    pub original: String,
    pub modified: String,
    pub binary: bool,
}

#[tauri::command]
pub async fn git_file_versions(
    root: String,
    path: String,
    staged: bool,
) -> Result<FileVersions, String> {
    let repo = open(&root)?;
    let (old, new) = file_sides(&repo, &path, staged)?;
    let binary = old.contains(&0) || new.contains(&0);
    Ok(FileVersions {
        original: String::from_utf8_lossy(&old).into_owned(),
        modified: String::from_utf8_lossy(&new).into_owned(),
        binary,
    })
}

#[derive(Serialize)]
pub struct GitCommit {
    /// Abbreviated commit hash.
    pub hash: String,
    /// First line of the commit message.
    pub summary: String,
    pub author: String,
    /// Author time, seconds since the Unix epoch.
    pub time: i64,
}

/// Recent commits reachable from HEAD (newest first), up to `limit`.
#[tauri::command]
pub async fn git_log(root: String, limit: Option<usize>) -> Result<Vec<GitCommit>, String> {
    let repo = open(&root)?;
    let Ok(head_id) = repo.head_id() else {
        return Ok(Vec::new());
    };
    let limit = limit.unwrap_or(50);

    let mut out = Vec::new();
    let infos = head_id.ancestors().all().map_err(|e| e.to_string())?;
    for info in infos.take(limit) {
        let info = info.map_err(|e| e.to_string())?;
        let commit = info.object().map_err(|e| e.to_string())?;
        let author = commit.author().map_err(|e| e.to_string())?;
        let summary = commit
            .message()
            .map_err(|e| e.to_string())?
            .summary()
            .to_string();
        out.push(GitCommit {
            hash: commit.id().to_hex_with_len(7).to_string(),
            summary,
            author: author.name.to_string(),
            time: author.time.seconds,
        });
    }
    Ok(out)
}

// --- Remotes ---------------------------------------------------------------
// clone + fetch use gitoxide (pure Rust, reqwest+rustls). pull + push use the
// system `git` (gitoxide can't push, and its fast-forward worktree apply is
// immature). Auth is HTTPS token-in-URL, e.g.
// `https://x-access-token:<TOKEN>@github.com/owner/repo.git`.

/// Clone `url` into `dest` (token may be embedded in the URL). Returns the
/// cloned working-tree path.
#[tauri::command]
pub async fn git_clone(url: String, dest: String) -> Result<String, String> {
    let interrupt = AtomicBool::new(false);
    let mut prepare = gix::prepare_clone(url.as_str(), &dest).map_err(|e| e.to_string())?;
    let (mut checkout, _) = prepare
        .fetch_then_checkout(gix::progress::Discard, &interrupt)
        .map_err(|e| e.to_string())?;
    let (repo, _) = checkout
        .main_worktree(gix::progress::Discard, &interrupt)
        .map_err(|e| e.to_string())?;
    Ok(repo
        .work_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or(dest))
}

#[derive(Serialize)]
pub struct GitRemote {
    pub name: String,
    pub url: String,
}

/// List configured remotes (name + fetch URL).
#[tauri::command]
pub async fn git_remotes(root: String) -> Result<Vec<GitRemote>, String> {
    let repo = open(&root)?;
    let mut out = Vec::new();
    for name in repo.remote_names() {
        let name = name.to_string();
        if let Ok(remote) = repo.find_remote(name.as_str()) {
            if let Some(url) = remote.url(gix::remote::Direction::Fetch) {
                out.push(GitRemote {
                    name,
                    url: url.to_bstring().to_string(),
                });
            }
        }
    }
    Ok(out)
}

/// Add a new remote (`git remote add`). Uses system git so the config is written
/// exactly as the CLI would (gitoxide's config write surface is limited).
#[tauri::command]
pub async fn git_remote_add(root: String, name: String, url: String) -> Result<(), String> {
    run_git(&root, ["remote", "add", name.as_str(), url.as_str()]).map(|_| ())
}

/// Change a remote's URL (`git remote set-url`).
#[tauri::command]
pub async fn git_remote_set_url(root: String, name: String, url: String) -> Result<(), String> {
    run_git(&root, ["remote", "set-url", name.as_str(), url.as_str()]).map(|_| ())
}

/// Rename a remote (`git remote rename`), moving its tracking refs too.
#[tauri::command]
pub async fn git_remote_rename(root: String, from: String, to: String) -> Result<(), String> {
    run_git(&root, ["remote", "rename", from.as_str(), to.as_str()]).map(|_| ())
}

/// Remove a remote (`git remote remove`).
#[tauri::command]
pub async fn git_remote_remove(root: String, name: String) -> Result<(), String> {
    run_git(&root, ["remote", "remove", name.as_str()]).map(|_| ())
}

/// Fetch from origin (or `url` if given, with token), updating tracking refs.
#[tauri::command]
pub async fn git_fetch(root: String, url: Option<String>) -> Result<(), String> {
    let repo = open(&root)?;
    let interrupt = AtomicBool::new(false);
    let remote = match url {
        Some(u) => repo
            .remote_at(u.as_str())
            .map_err(|e| e.to_string())?
            .with_refspecs(
                Some("+refs/heads/*:refs/remotes/origin/*"),
                gix::remote::Direction::Fetch,
            )
            .map_err(|e| e.to_string())?,
        None => repo.find_remote("origin").map_err(|e| e.to_string())?,
    };
    remote
        .connect(gix::remote::Direction::Fetch)
        .map_err(|e| e.to_string())?
        .prepare_fetch(gix::progress::Discard, Default::default())
        .map_err(|e| e.to_string())?
        .receive(gix::progress::Discard, &interrupt)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Pull with fast-forward only (system git). `url` carries token auth if given.
#[tauri::command]
pub async fn git_pull(root: String, url: Option<String>) -> Result<String, String> {
    let mut args: Vec<String> = vec!["pull".into(), "--ff-only".into()];
    if let Some(u) = url {
        args.push(u);
    }
    run_git(&root, args)
}

/// After a push to a *URL* (which, unlike a named remote, doesn't move the local
/// remote-tracking ref), point `refs/remotes/<remote>/<branch>` at HEAD so
/// ahead/behind reflects reality — otherwise pushed commits still read as ahead.
fn sync_tracking_ref(root: &str, remote: &Option<String>, branch: &Option<String>) {
    let Some(remote) = remote else { return };
    let branch = branch.clone().filter(|b| !b.is_empty()).or_else(|| {
        run_git(root, ["rev-parse", "--abbrev-ref", "HEAD"])
            .ok()
            .filter(|b| !b.is_empty() && b != "HEAD")
    });
    if let Some(b) = branch {
        let refname = format!("refs/remotes/{remote}/{b}");
        let _ = run_git(root, ["update-ref", refname.as_str(), "HEAD"]);
    }
}

/// Push the current branch (system git). `url` carries token auth if given;
/// `branch` sets the destination ref (defaults to the current upstream);
/// `remote` is the remote name, used only to refresh its tracking ref.
#[tauri::command]
pub async fn git_push(
    root: String,
    url: Option<String>,
    branch: Option<String>,
    remote: Option<String>,
) -> Result<String, String> {
    let mut args: Vec<String> = vec!["push".into()];
    if let Some(u) = &url {
        args.push(u.clone());
        args.push(format!(
            "HEAD:{}",
            branch.clone().unwrap_or_else(|| "HEAD".into())
        ));
    }
    let out = run_git(&root, args)?;
    sync_tracking_ref(&root, &remote, &branch);
    Ok(out)
}

/// Outcome of a sync (pull-then-push). `conflicts` is true when the merge
/// stopped on conflicts that the user must resolve before the merge can commit.
#[derive(Serialize)]
pub struct SyncOutcome {
    pub conflicts: bool,
    pub message: String,
}

/// Sync = pull (merge, not fast-forward-only) then push — VS Code's "Sync
/// Changes". On a merge conflict it stops after the pull and reports it so the
/// UI can guide the user to resolve; otherwise it pushes and updates tracking.
#[tauri::command]
pub async fn git_sync(
    root: String,
    url: Option<String>,
    branch: Option<String>,
    remote: Option<String>,
) -> Result<SyncOutcome, String> {
    // Pull with a real merge so a diverged branch reconciles.
    let mut pull_args: Vec<String> = vec!["pull".into(), "--no-edit".into()];
    if let Some(u) = &url {
        pull_args.push(u.clone());
        if let Some(b) = branch.clone().filter(|b| !b.is_empty()) {
            pull_args.push(b);
        }
    }
    // Use the shared spawn helper (not an open-coded Command) but keep the raw
    // Output — we need stdout *and* stderr to tell a merge conflict from a failure.
    let pull = run_git_raw(&root, &pull_args)?;
    if !pull.status.success() {
        // Conflict text goes to stdout; other failures to stderr — check both.
        let combined = format!(
            "{}{}",
            String::from_utf8_lossy(&pull.stdout),
            String::from_utf8_lossy(&pull.stderr)
        );
        let low = combined.to_lowercase();
        if low.contains("conflict")
            || low.contains("automatic merge failed")
            || low.contains("fix conflicts")
        {
            return Ok(SyncOutcome {
                conflicts: true,
                message: "Pulled the remote changes, but there are merge conflicts. Resolve the conflicted files, stage them, then commit to finish the merge.".into(),
            });
        }
        return Err(if combined.trim().is_empty() {
            format!("git pull exited with code {:?}", pull.status.code())
        } else {
            combined.trim().to_string()
        });
    }

    // Pull succeeded → push the (possibly newly-merged) HEAD.
    let mut push_args: Vec<String> = vec!["push".into()];
    if let Some(u) = &url {
        push_args.push(u.clone());
        push_args.push(format!(
            "HEAD:{}",
            branch.clone().unwrap_or_else(|| "HEAD".into())
        ));
    }
    run_git(&root, push_args)?;
    sync_tracking_ref(&root, &remote, &branch);
    Ok(SyncOutcome {
        conflicts: false,
        message: "Synced with remote.".into(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::async_runtime::block_on;

    #[test]
    fn stage_commit_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().to_string_lossy().to_string();

        block_on(git_init(root.clone())).unwrap();
        assert!(block_on(git_head(root.clone())).unwrap().unborn);

        std::fs::write(dir.path().join("main.tex"), b"\\documentclass{article}").unwrap();
        // Untracked + unstaged until added.
        let st = block_on(git_status(root.clone())).unwrap();
        assert!(st
            .iter()
            .any(|c| c.path == "main.tex" && !c.staged && c.status == "untracked"));

        // Stage → now appears as staged.
        block_on(git_stage(root.clone(), vec!["main.tex".into()])).unwrap();
        let staged = block_on(git_status(root.clone())).unwrap();
        assert!(staged.iter().any(|c| c.path == "main.tex" && c.staged));

        // Unstage → back to untracked, no longer staged.
        block_on(git_unstage(root.clone(), vec!["main.tex".into()])).unwrap();
        let unstaged = block_on(git_status(root.clone())).unwrap();
        assert!(unstaged.iter().all(|c| !(c.path == "main.tex" && c.staged)));

        // Commit with nothing staged fails; stage then commit succeeds.
        assert!(block_on(git_commit(root.clone(), "x".into())).is_err());
        block_on(git_stage(root.clone(), vec!["main.tex".into()])).unwrap();
        let hash = block_on(git_commit(root.clone(), "initial commit".into())).unwrap();
        assert_eq!(hash.len(), 7);

        // Clean tree + history after commit.
        let after = block_on(git_status(root.clone())).unwrap();
        assert!(!after.iter().any(|c| c.path == "main.tex"));
        let log = block_on(git_log(root.clone(), Some(10))).unwrap();
        assert_eq!(log.len(), 1);
        assert_eq!(log[0].summary, "initial commit");

        // Edit → unstaged modified, and the diff reflects the new content.
        std::fs::write(dir.path().join("main.tex"), b"changed").unwrap();
        let edited = block_on(git_status(root.clone())).unwrap();
        assert!(edited
            .iter()
            .any(|c| c.path == "main.tex" && !c.staged && c.status == "modified"));

        let diff = block_on(git_diff(root.clone(), "main.tex".into(), false)).unwrap();
        assert!(diff.contains("+changed"));

        // Discard the modification → file reverts to the committed content, clean tree.
        block_on(git_discard(root.clone(), vec!["main.tex".into()])).unwrap();
        let reverted = std::fs::read(dir.path().join("main.tex")).unwrap();
        assert_eq!(reverted, b"\\documentclass{article}");
        let clean = block_on(git_status(root.clone())).unwrap();
        assert!(!clean.iter().any(|c| c.path == "main.tex"));

        // Discard an untracked file → it is deleted from disk.
        std::fs::write(dir.path().join("scratch.tex"), b"temp").unwrap();
        block_on(git_discard(root.clone(), vec!["scratch.tex".into()])).unwrap();
        assert!(!dir.path().join("scratch.tex").exists());
    }

    /// `git_file_versions` returns the right two sides for staged vs unstaged,
    /// and flags binary content.
    #[test]
    fn file_versions_sides_and_binary() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().to_string_lossy().to_string();
        block_on(git_init(root.clone())).unwrap();

        std::fs::write(dir.path().join("f.txt"), b"line1\nline2\n").unwrap();
        block_on(git_stage(root.clone(), vec!["f.txt".into()])).unwrap();
        block_on(git_commit(root.clone(), "add f".into())).unwrap();

        // Unstaged edit: original = committed, modified = worktree.
        std::fs::write(dir.path().join("f.txt"), b"line1\nCHANGED\n").unwrap();
        let v = block_on(git_file_versions(root.clone(), "f.txt".into(), false)).unwrap();
        assert!(v.original.contains("line2"));
        assert!(v.modified.contains("CHANGED"));
        assert!(!v.binary);

        // Stage it: now staged side compares HEAD ↔ index.
        block_on(git_stage(root.clone(), vec!["f.txt".into()])).unwrap();
        let s = block_on(git_file_versions(root.clone(), "f.txt".into(), true)).unwrap();
        assert!(s.original.contains("line2"));
        assert!(s.modified.contains("CHANGED"));

        // A NUL byte marks the file binary.
        std::fs::write(dir.path().join("bin.dat"), [0u8, 1, 2, 3]).unwrap();
        block_on(git_stage(root.clone(), vec!["bin.dat".into()])).unwrap();
        let b = block_on(git_file_versions(root.clone(), "bin.dat".into(), true)).unwrap();
        assert!(b.binary);
    }

    /// Committing while a `MERGE_HEAD` is present produces a two-parent merge
    /// commit and clears the merge state.
    #[test]
    fn merge_commit_has_two_parents_and_clears_state() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().to_string_lossy().to_string();
        block_on(git_init(root.clone())).unwrap();

        std::fs::write(dir.path().join("a.txt"), b"a").unwrap();
        block_on(git_stage(root.clone(), vec!["a.txt".into()])).unwrap();
        block_on(git_commit(root.clone(), "c1".into())).unwrap();
        let c1 = open(&root).unwrap().head_id().unwrap().detach().to_string();

        std::fs::write(dir.path().join("b.txt"), b"b").unwrap();
        block_on(git_stage(root.clone(), vec!["b.txt".into()])).unwrap();
        block_on(git_commit(root.clone(), "c2".into())).unwrap();

        // Simulate a merge in progress: MERGE_HEAD points at c1, with a staged
        // resolution. git_commit should record both parents and clear the state.
        let merge_head = open(&root).unwrap().git_dir().join("MERGE_HEAD");
        std::fs::write(&merge_head, format!("{c1}\n")).unwrap();
        assert!(merge_in_progress(&open(&root).unwrap()));

        std::fs::write(dir.path().join("c.txt"), b"resolved").unwrap();
        block_on(git_stage(root.clone(), vec!["c.txt".into()])).unwrap();
        block_on(git_commit(root.clone(), "merge".into())).unwrap();

        let parents = open(&root)
            .unwrap()
            .head_commit()
            .unwrap()
            .parent_ids()
            .count();
        assert_eq!(parents, 2);
        assert!(!merge_head.exists());
    }
}
