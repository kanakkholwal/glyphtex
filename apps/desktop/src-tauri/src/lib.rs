mod compile;
mod engine;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      compile::compile_latex,
      compile::prefetch_packages,
      engine::list_tectonic_versions,
      engine::download_tectonic,
      engine::set_active_engine,
      engine::tectonic_cache_info,
      engine::clear_tectonic_cache
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
