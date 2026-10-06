// =============================================================
// lib.rs — Entry point + setup de Tauri
// =============================================================

mod commands;
mod db;

use db::Db;
use std::path::PathBuf;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Workaround: el renderer DMABUF de WebKitGTK deja bordes fantasma al mover
    // widgets (capas transformadas) en Linux con NVIDIA/Wayland. Se desactiva
    // solo si el usuario no lo configuró explícitamente.
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Persistir la DB en el app_data_dir multiplataforma.
            let dir: PathBuf = app
                .path()
                .app_data_dir()
                .expect("no se pudo resolver app_data_dir");
            let db_path = dir.join("aeon.sqlite");
            let database = Db::open(&db_path).expect("error inicializando SQLite");
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_image::app_image_path,
            commands::config::save_config,
            commands::config::load_config,
            commands::data::clear_all_data,
            commands::habits::create_habit,
            commands::habits::list_habits,
            commands::habits::update_habit,
            commands::habits::archive_habit,
            commands::habits::restore_habit,
            commands::logs::delete_log,
            commands::logs::upsert_habit_log,
            commands::logs::list_logs_in_range,
            commands::tasks::create_task,
            commands::tasks::list_tasks,
            commands::tasks::update_task,
            commands::tasks::delete_task,
            commands::tasks::archive_task,
            commands::tasks::restore_task,
            commands::notes::create_note,
            commands::notes::list_notes,
            commands::notes::update_note,
            commands::notes::delete_note,
            commands::goals::create_goal,
            commands::goals::list_goals,
            commands::goals::update_goal,
            commands::goals::delete_goal,
            commands::goals::archive_goal,
            commands::goals::restore_goal,
            commands::goal_logs::upsert_goal_log,
            commands::goal_logs::delete_goal_log,
            commands::goal_logs::list_goal_logs_in_range,
            commands::weekly_schedule::list_schedule_blocks,
            commands::weekly_schedule::list_schedule_slots,
            commands::weekly_schedule::create_schedule_block,
            commands::weekly_schedule::create_schedule_slot,
            commands::weekly_schedule::update_schedule_block,
            commands::weekly_schedule::update_schedule_slot,
            commands::weekly_schedule::delete_schedule_block,
            commands::weekly_schedule::delete_schedule_slot,
            commands::oauth::start_oauth_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
