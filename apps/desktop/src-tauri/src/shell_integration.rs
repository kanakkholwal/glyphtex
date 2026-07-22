//! OS shell integration.
//!
//! `.tex` and `.glyx` *file* associations are declared in `tauri.conf.json`
//! (`bundle.fileAssociations`) and registered by the installer. Folder
//! association ("Open with GlyphTeX" on a directory) is non-standard and not
//! covered by Tauri, so we register it ourselves on Windows via a per-user
//! registry entry (HKCU — no admin prompt). Best-effort: a failure is reported
//! but never fatal.

/// Register a "Open with GlyphTeX" entry on the folder right-click menu (Windows).
/// No-op (with an explanatory message) on other platforms.
#[tauri::command]
pub fn register_shell_integration() -> Result<String, String> {
    #[cfg(windows)]
    {
        register_windows_folder_menu()
    }
    #[cfg(not(windows))]
    {
        Ok(
            "Folder association is only set up on Windows; .tex / .glyx files are \
            associated via the installer on this platform."
                .to_string(),
        )
    }
}

#[cfg(windows)]
fn reg_escape(s: &str) -> String {
    // In .reg string values, backslashes are doubled and quotes are backslash-escaped.
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

#[cfg(windows)]
fn register_windows_folder_menu() -> Result<String, String> {
    use std::process::Command;

    use crate::subprocess::CommandExt as _;

    let exe = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .into_owned();
    let exe_esc = reg_escape(&exe);
    // `%V` resolves to the clicked folder (or the background folder).
    let command_value = format!("\\\"{exe_esc}\\\" \\\"%V\\\"");

    let reg = format!(
        "Windows Registry Editor Version 5.00\r\n\r\n\
         [HKEY_CURRENT_USER\\Software\\Classes\\Directory\\shell\\GlyphTeXOpen]\r\n\
         @=\"Open with GlyphTeX\"\r\n\
         \"Icon\"=\"{exe_esc}\"\r\n\r\n\
         [HKEY_CURRENT_USER\\Software\\Classes\\Directory\\shell\\GlyphTeXOpen\\command]\r\n\
         @=\"{command_value}\"\r\n\r\n\
         [HKEY_CURRENT_USER\\Software\\Classes\\Directory\\Background\\shell\\GlyphTeXOpen]\r\n\
         @=\"Open with GlyphTeX\"\r\n\
         \"Icon\"=\"{exe_esc}\"\r\n\r\n\
         [HKEY_CURRENT_USER\\Software\\Classes\\Directory\\Background\\shell\\GlyphTeXOpen\\command]\r\n\
         @=\"{command_value}\"\r\n"
    );

    let mut tmp = std::env::temp_dir();
    tmp.push("glyphtex-folder-assoc.reg");
    std::fs::write(&tmp, reg).map_err(|e| e.to_string())?;

    let status = Command::new("reg")
        .arg("import")
        .arg(&tmp)
        .no_window()
        .status()
        .map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&tmp);

    if status.success() {
        Ok("Added \"Open with GlyphTeX\" to the folder right-click menu.".to_string())
    } else {
        Err(format!("reg import failed (exit {:?})", status.code()))
    }
}

/// Whether the "Open with GlyphTeX" folder entry is currently registered.
/// Always `false` off Windows (nothing is registered there).
#[tauri::command]
pub fn shell_integration_registered() -> Result<bool, String> {
    #[cfg(windows)]
    {
        query_windows_folder_menu()
    }
    #[cfg(not(windows))]
    {
        Ok(false)
    }
}

#[cfg(windows)]
fn query_windows_folder_menu() -> Result<bool, String> {
    use std::process::Command;

    use crate::subprocess::CommandExt as _;

    // `reg query` exits 0 when the key exists, non-zero when it doesn't. Output
    // is captured (and dropped) so nothing flashes to a console.
    let out = Command::new("reg")
        .arg("query")
        .arg("HKCU\\Software\\Classes\\Directory\\shell\\GlyphTeXOpen")
        .no_window()
        .output()
        .map_err(|e| e.to_string())?;
    Ok(out.status.success())
}

/// Remove the "Open with GlyphTeX" folder entry (Windows). Idempotent — removing
/// an entry that isn't there still succeeds. No-op off Windows.
#[tauri::command]
pub fn unregister_shell_integration() -> Result<String, String> {
    #[cfg(windows)]
    {
        unregister_windows_folder_menu()
    }
    #[cfg(not(windows))]
    {
        Ok("Nothing to remove on this platform.".to_string())
    }
}

#[cfg(windows)]
fn unregister_windows_folder_menu() -> Result<String, String> {
    use std::process::Command;

    use crate::subprocess::CommandExt as _;

    // Deleting each parent key also drops its `\command` subkey. `/f` skips the
    // confirmation prompt; a "key not found" result is fine (already removed).
    for key in [
        "HKCU\\Software\\Classes\\Directory\\shell\\GlyphTeXOpen",
        "HKCU\\Software\\Classes\\Directory\\Background\\shell\\GlyphTeXOpen",
    ] {
        Command::new("reg")
            .arg("delete")
            .arg(key)
            .arg("/f")
            .no_window()
            .output()
            .map_err(|e| e.to_string())?;
    }
    Ok("Removed \"Open with GlyphTeX\" from the folder right-click menu.".to_string())
}
