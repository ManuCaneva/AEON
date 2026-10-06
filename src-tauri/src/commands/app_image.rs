// =============================================================
// app_image.rs — Ruta del AppImage en ejecución
// =============================================================

//! Infraestructura, no lógica de negocio: `$APPIMAGE` es la única fuente que
//! apunta al archivo `.AppImage` real. `current_exe` devuelve el binario del
//! payload montado en `/tmp/.mount_*`, no el AppImage, así que no sirve.
//! Devuelve `None` cuando no corre como AppImage (dev, .deb/.rpm, Windows).

#[tauri::command]
pub fn app_image_path() -> Option<String> {
    std::env::var("APPIMAGE")
        .ok()
        .filter(|path| !path.is_empty())
}
