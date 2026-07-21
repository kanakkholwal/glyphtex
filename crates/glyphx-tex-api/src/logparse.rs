//! Turns a TeX log into structured [`Diagnostic`]s.
//!
//! TeX logs are a stream of prose, not a machine format, so this is necessarily
//! heuristic. It aims to catch the messages users act on — errors, warnings,
//! and over/underfull boxes — and to attach a file and line where TeX gives one.
//!
//! Two quirks drive the design:
//!
//! - TeX hard-wraps output at ~79 columns, so a single message can span several
//!   physical lines and must be rejoined before it can be matched.
//! - The current file is tracked by balanced `(`/`)` around file names. This is
//!   genuinely ambiguous — file names may contain parentheses — so the file
//!   attribution is best-effort and never blocks emitting the diagnostic.

use crate::api::{Diagnostic, Severity};

/// Longest run of continuation lines to fold into one message. Bounded so a
/// pathological log cannot produce an unbounded string.
const MAX_CONTINUATION_LINES: usize = 12;

/// Parse a TeX log into diagnostics, in the order they appear.
pub fn parse(log: &str) -> Vec<Diagnostic> {
    let lines: Vec<&str> = log.lines().collect();
    let mut out = Vec::new();
    let mut files = FileStack::default();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i];
        files.observe(line);

        if let Some(rest) = line.strip_prefix("! ") {
            let (message, consumed) = fold(&lines, i, rest);
            // TeX prints the offending source line as `l.<n> <context>` a few
            // lines after the error itself.
            let line_no = (i..=(i + consumed + 4).min(lines.len().saturating_sub(1)))
                .find_map(|j| parse_l_line(lines[j]));
            out.push(Diagnostic {
                severity: Severity::Error,
                file: files.current(),
                line: line_no,
                message: clean(&message),
                package: None,
            });
            i += consumed + 1;
            continue;
        }

        if let Some(d) = parse_warning(&lines, i, &files) {
            let consumed = d.1;
            out.push(d.0);
            i += consumed + 1;
            continue;
        }

        if let Some(d) = parse_box(line, &files) {
            out.push(d);
        }

        i += 1;
    }

    out
}

/// Rejoin TeX's hard-wrapped continuation lines into one message.
///
/// Returns the folded text and how many *extra* lines were consumed.
fn fold(lines: &[&str], start: usize, first: &str) -> (String, usize) {
    let mut message = first.to_owned();
    let mut consumed = 0;
    for line in lines.iter().skip(start + 1).take(MAX_CONTINUATION_LINES) {
        // A blank line, a new message, or the source-context marker all end it.
        if line.trim().is_empty() || line.starts_with("! ") || line.starts_with("l.") {
            break;
        }
        // TeX only wraps at the full width; a short line is a new statement.
        if message.len() < 79 && !message.ends_with(',') {
            break;
        }
        message.push_str(line);
        consumed += 1;
    }
    (message, consumed)
}

/// `l.42 \somecommand` -> 42
fn parse_l_line(line: &str) -> Option<u32> {
    let rest = line.strip_prefix("l.")?;
    let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();
    digits.parse().ok()
}

/// `... on input line 42.` -> 42
fn trailing_input_line(text: &str) -> Option<u32> {
    let idx = text.rfind("on input line ")?;
    let rest = &text[idx + "on input line ".len()..];
    let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();
    digits.parse().ok()
}

/// Match `LaTeX Warning:` and `Package <name> Warning:` forms.
fn parse_warning(lines: &[&str], i: usize, files: &FileStack) -> Option<(Diagnostic, usize)> {
    let line = lines[i];
    let (package, body) = if let Some(rest) = line.strip_prefix("LaTeX Warning: ") {
        (None, rest)
    } else if let Some(rest) = line.strip_prefix("Package ") {
        let (name, after) = rest.split_once(" Warning: ")?;
        (Some(name.to_owned()), after)
    } else if let Some(rest) = line.strip_prefix("Class ") {
        let (name, after) = rest.split_once(" Warning: ")?;
        (Some(name.to_owned()), after)
    } else {
        return None;
    };

    let (message, consumed) = fold(lines, i, body);
    Some((
        Diagnostic {
            severity: Severity::Warning,
            file: files.current(),
            line: trailing_input_line(&message),
            message: clean(&message),
            package,
        },
        consumed,
    ))
}

/// Over/underfull boxes — noisy but frequently what a user is looking for.
fn parse_box(line: &str, files: &FileStack) -> Option<Diagnostic> {
    let is_box = line.starts_with("Overfull \\")
        || line.starts_with("Underfull \\")
        || line.starts_with("Loose \\")
        || line.starts_with("Tight \\");
    if !is_box {
        return None;
    }
    // `... at lines 10--12` — report the first.
    let line_no = line.rfind("at lines ").and_then(|idx| {
        let rest = &line[idx + "at lines ".len()..];
        let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();
        digits.parse().ok()
    });
    Some(Diagnostic {
        severity: Severity::Info,
        file: files.current(),
        line: line_no,
        message: clean(line),
        package: None,
    })
}

fn clean(text: &str) -> String {
    text.trim().replace("  ", " ")
}

/// Tracks the file TeX is currently reading, via balanced parens.
#[derive(Default)]
struct FileStack {
    stack: Vec<String>,
}

impl FileStack {
    fn observe(&mut self, line: &str) {
        let bytes = line.as_bytes();
        let mut i = 0;
        while i < bytes.len() {
            match bytes[i] {
                b'(' => {
                    // `(./main.tex` — a path follows the paren immediately.
                    let rest = &line[i + 1..];
                    let name: String = rest
                        .chars()
                        .take_while(|c| !c.is_whitespace() && *c != '(' && *c != ')')
                        .collect();
                    if looks_like_path(&name) {
                        self.stack.push(name.trim_start_matches("./").to_owned());
                    } else {
                        // Push a placeholder so the matching ')' still balances.
                        self.stack.push(String::new());
                    }
                    i += 1;
                }
                b')' => {
                    self.stack.pop();
                    i += 1;
                }
                _ => i += 1,
            }
        }
    }

    fn current(&self) -> Option<String> {
        self.stack.iter().rev().find(|s| !s.is_empty()).cloned()
    }
}

fn looks_like_path(name: &str) -> bool {
    !name.is_empty()
        && name.contains('.')
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "./_-+:\\".contains(c))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_latex_error() {
        let log = "! LaTeX Error: Missing \\begin{document}.\n\nl.5 \\section";
        let d = parse(log);
        assert_eq!(d.len(), 1);
        assert_eq!(d[0].severity, Severity::Error);
    }

    #[test]
    fn attaches_line_number_from_l_marker() {
        let log = "! Undefined control sequence.\nl.42 \\foo";
        let d = parse(log);
        assert_eq!(d[0].line, Some(42));
    }

    #[test]
    fn parses_a_latex_warning_with_input_line() {
        let log = "LaTeX Warning: Reference `sec:x' undefined on input line 17.";
        let d = parse(log);
        assert_eq!(d.len(), 1);
        assert_eq!(d[0].severity, Severity::Warning);
        assert_eq!(d[0].line, Some(17));
    }

    #[test]
    fn parses_package_warning_and_captures_package_name() {
        let log = "Package hyperref Warning: Token not allowed on input line 9.";
        let d = parse(log);
        assert_eq!(d[0].package.as_deref(), Some("hyperref"));
    }

    #[test]
    fn parses_class_warning() {
        let log = "Class article Warning: Unused float on input line 3.";
        let d = parse(log);
        assert_eq!(d[0].package.as_deref(), Some("article"));
    }

    #[test]
    fn parses_overfull_box_as_info() {
        let log = "Overfull \\hbox (12.0pt too wide) in paragraph at lines 10--12";
        let d = parse(log);
        assert_eq!(d[0].severity, Severity::Info);
        assert_eq!(d[0].line, Some(10));
    }

    #[test]
    fn tracks_current_file_across_parens() {
        let log = "(./main.tex\n! Undefined control sequence.\nl.3 \\x";
        let d = parse(log);
        assert_eq!(d[0].file.as_deref(), Some("main.tex"));
    }

    #[test]
    fn pops_file_stack_on_close_paren() {
        let log = "(./main.tex (./sub.tex)\nLaTeX Warning: something on input line 1.";
        let d = parse(log);
        assert_eq!(d[0].file.as_deref(), Some("main.tex"));
    }

    #[test]
    fn ignores_lines_that_are_not_diagnostics() {
        let log = "This is pdfTeX, Version 3.14\nEntering extended mode\n";
        assert!(parse(log).is_empty());
    }

    #[test]
    fn empty_log_yields_no_diagnostics() {
        assert!(parse("").is_empty());
    }
}
