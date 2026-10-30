// =============================================================
// lib.rs — Entry point + setup de Tauri
// =============================================================

mod commands;
mod db;
#[cfg(target_os = "linux")]
mod linux_graphics;

use db::Db;
use std::path::PathBuf;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Infraestructura de arranque: debe ejecutarse antes de inicializar GTK.
    // DMABUF queda intacto; se conserva como override manual del usuario.
    #[cfg(target_os = "linux")]
    linux_graphics::prepare();

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
            commands::habits::delete_habit,
            commands::logs::delete_log,
            commands::logs::upsert_habit_log,
            commands::logs::list_logs_in_range,
            commands::tasks::create_task,
            commands::tasks::list_tasks,
            commands::tasks::update_task,
            commands::tasks::delete_task,
            commands::exams::create_exam,
            commands::exams::list_exams,
            commands::exams::update_exam,
            commands::exams::delete_exam,
            commands::notes::create_note,
            commands::notes::list_notes,
            commands::notes::update_note,
            commands::notes::delete_note,
            commands::goals::create_goal,
            commands::goals::list_goals,
            commands::goals::update_goal,
            commands::goals::delete_goal,
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
            commands::window_shape::set_pomodoro_mini_shape,
            commands::window_shape::watch_pomodoro_mini_pointer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
