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
    // Sobre X11 el renderer DMA-BUF de WebKitGTK falla al crear buffers
    // ("Failed to create GBM buffer... Invalid argument") en GPUs híbridas
    // NVIDIA/AMD y el webview no pinta: la ventana queda gris (WebKit bug
    // 280210). Desactivarlo fuerza el renderer por software/OpenGL clásico,
    // que pinta bien bajo XWayland. Un valor externo se respeta (ADR 0011).
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
    aeon_lib::run()
}
