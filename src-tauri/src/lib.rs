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
    // Política del renderer DMABUF de WebKitGTK (Linux).
    //
    // Historial: a664665 lo desactivaba siempre (`=1`) para evitar bordes
    // fantasma en capas transformadas (NVIDIA/Wayland), pero eso deja la
    // composición 100% por CPU en TODOS los equipos: jank general (scroll,
    // drag, sidebar), CPU alta y ventiladores. Windows no se ve afectado
    // (WebView2 ignora la variable).
    //
    // Hoy la app no toca la variable: el compositing por GPU queda activo por
    // defecto y solo se respeta el override explícito del usuario como escape
    // hatch para el caso original (export WEBKIT_DISABLE_DMABUF_RENDERER=1).
    #[cfg(target_os = "linux")]
    {
        if should_disable_dmabuf_renderer(std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER")) {
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

/// Política del workaround del renderer DMABUF de WebKitGTK (Linux).
///
/// Retorna `true` si la app debe forzar `WEBKIT_DISABLE_DMABUF_RENDERER=1`.
/// Hoy: nunca por defecto (la app no toca el entorno); el override explícito
/// del usuario se respeta tal cual sin necesidad de forzarlo. Existe para
/// documentar la decisión y dar seam de test: si el caso original (bordes
/// fantasma en NVIDIA/Wayland) reaparece, se angosta acá con detección real
/// en vez de un set incondicional.
//
// Sin `cfg(target_os)`: es lógica pura y los tests corren en todos los OS.
#[allow(dead_code)]
fn should_disable_dmabuf_renderer(user_override: Option<std::ffi::OsString>) -> bool {
    let _ = user_override;
    false
}

#[cfg(test)]
mod tests {
    use super::should_disable_dmabuf_renderer;
    use std::ffi::OsString;

    #[test]
    fn no_fuerza_software_sin_override() {
        // Sin override del usuario la app no toca el renderer: forzar
        // WEBKIT_DISABLE_DMABUF_RENDERER=1 deja la composición 100% por CPU
        // (jank general + ventiladores en Linux).
        assert!(!should_disable_dmabuf_renderer(None));
    }

    #[test]
    fn no_pisa_override_explicito_del_usuario() {
        // El escape hatch se respeta tal cual: la app nunca escribe la variable.
        assert!(!should_disable_dmabuf_renderer(Some(OsString::from("1"))));
        assert!(!should_disable_dmabuf_renderer(Some(OsString::from("0"))));
    }
}
