/**
 * Turn a raw gix / system-git error into a plain-language title + message,
 * keeping the original text as collapsible details for the curious.
 *
 * Pure: pattern-matches the lowercased error text against known failure modes
 * (auth, network, non-fast-forward, missing remote, …) so the UI can explain
 * what happened and what to do next, rather than dumping a stack trace.
 */
import type { GitErrorInfo } from "./types";

export function describeError(raw: string, op: string): GitErrorInfo {
  const e = raw.toLowerCase();
  const details = raw.trim() || undefined;
  if (/install git/.test(e))
    return {
      title: "Git isn’t installed",
      message:
        "Syncing with a remote needs Git installed on your computer. Install it from git-scm.com, then reopen GlyphX and try again.",
      details,
    };
  if (
    /no such remote|does not appear to be a git repository|no configured (push|fetch)|could not find remote|unknown remote|remote .*not found|find_remote/.test(
      e,
    )
  )
    return {
      title: "Remote not found",
      message:
        "This remote may have been removed or renamed. Add or pick a remote below, then try again.",
      details,
    };
  if (
    /permission to .*denied|\bforbidden\b|not authorized|do(es)?n.?t have (write |push )?(access|permission)|protected branch|read[- ]only|protected_ref/.test(
      e,
    )
  )
    return {
      title: "You don’t have push access",
      message:
        "You can’t push to this repository — it isn’t yours to write to. Fork it to your own account, then point the remote at your fork (Remote → edit) and push there.",
      details,
    };
  if (
    /authentication|could not read username|could not read password|\b401\b|\b403\b|invalid username or password|bad credentials|support for password authentication/.test(
      e,
    )
  )
    return {
      title: "Authentication failed",
      message:
        "Check your access token and that it has access to this repository.",
      details,
    };
  if (
    /could not resolve host|couldn.?t resolve|network|unreachable|timed out|timeout|failed to connect|connection refused/.test(
      e,
    )
  )
    return {
      title: "Can’t reach the remote",
      message:
        "Couldn’t connect. Check your internet connection and the remote URL.",
      details,
    };
  if (
    /non-fast-forward|fast-forward|\brejected\b|diverg|need to pull|tip of your current branch is behind/.test(
      e,
    )
  )
    return op === "Pull"
      ? {
          title: "Can’t fast-forward",
          message:
            "Your branch and the remote have moved apart, so this isn’t a simple update. Resolve the divergence before pulling.",
          details,
        }
      : {
          title: "Push rejected",
          message:
            "The remote has changes you don’t have yet. Pull the latest changes first, then push again.",
          details,
        };
  return {
    title: `${op} failed`,
    message: "Something went wrong with this Git operation.",
    details,
  };
}
