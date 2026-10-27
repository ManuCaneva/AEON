// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // La mascota del pomodoro necesita hints de ventana que Wayland no puede
    // expresar para toplevels (always-on-top, fuera de la taskbar, posición por
    // API): GTK los ignora y KWin/GNOME nunca se enteran. Correr vía XWayland
    // (GDK_BACKEND=x11) hace que el WM honre esos hints. Un GDK_BACKEND
    // explícito del usuario se respeta (ADR 0011).
    #[cfg(target_os = "linux")]
    if std::env::var_os("GDK_BACKEND").is_none() {
        std::env::set_var("GDK_BACKEND", "x11");
    }
    aeon_lib::run()
}
