// =============================================================
// window_shape.rs — Recorte nativo de la mascota del pomodoro
// =============================================================

use serde::Deserialize;

#[cfg(target_os = "windows")]
mod windows;

/// Reenvía cruces nativos que WebKitGTK no entrega al DOM de ventanas recortadas.
/// El frontend decide visibilidad y tiempos; GTK solo informa entrada/salida.
#[cfg(target_os = "linux")]
#[tauri::command]
pub fn watch_pomodoro_mini_pointer(window: tauri::Window) -> Result<(), String> {
    use gtk::prelude::*;
    use tauri::{Emitter, Manager};

    let gtk_window = window.gtk_window().map_err(|error| error.to_string())?;
    gtk_window.add_events(
        gtk::gdk::EventMask::ENTER_NOTIFY_MASK | gtk::gdk::EventMask::LEAVE_NOTIFY_MASK,
    );
    let enter_app = window.app_handle().clone();
    let leave_app = enter_app.clone();
    let enter_label = window.label().to_owned();
    let leave_label = enter_label.clone();
    gtk_window.connect_enter_notify_event(move |_, event| {
        if event.detail() != gtk::gdk::NotifyType::Inferior {
            let _ = enter_app.emit_to(&enter_label, "pomodoro-mini-pointer", true);
        }
        gtk::glib::Propagation::Proceed
    });
    gtk_window.connect_leave_notify_event(move |_, event| {
        if event.detail() != gtk::gdk::NotifyType::Inferior {
            let _ = leave_app.emit_to(&leave_label, "pomodoro-mini-pointer", false);
        }
        gtk::glib::Propagation::Proceed
    });
    Ok(())
}

#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub fn watch_pomodoro_mini_pointer(_window: tauri::Window) -> Result<(), String> {
    Ok(())
}

/// Rectángulo en píxeles lógicos, relativo a la ventana.
#[derive(Debug, Clone, Copy, Deserialize)]
pub struct ShapeRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

/// Aplica la forma visible y de entrada a la ventana actual.
///
/// WebKitGTK no pinta una superficie transparente más alta que el disco, así
/// que la mascota se crea como ventana opaca y se recorta con la forma que
/// calcula el frontend (círculo + cápsula). La geometría vive en TypeScript;
/// este comando solo la traduce a una región nativa.
#[cfg(target_os = "linux")]
#[tauri::command]
pub fn set_pomodoro_mini_shape(window: tauri::Window, rects: Vec<ShapeRect>) -> Result<(), String> {
    use gtk::cairo::{RectangleInt, Region};
    use gtk::prelude::*;

    let gtk_window = window.gtk_window().map_err(|error| error.to_string())?;
    let region = Region::create();

    for rect in rects {
        if rect.width <= 0 || rect.height <= 0 {
            continue;
        }
        region
            .union_rectangle(&RectangleInt::new(rect.x, rect.y, rect.width, rect.height))
            .map_err(|error| error.to_string())?;
    }

    gtk_window.shape_combine_region(Some(&region));
    gtk_window.input_shape_combine_region(Some(&region));
    gtk_window.queue_draw();
    Ok(())
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn set_pomodoro_mini_shape(window: tauri::Window, rects: Vec<ShapeRect>) -> Result<(), String> {
    let hwnd = window.hwnd().map_err(|error| error.to_string())?;
    let scale = window.scale_factor().map_err(|error| error.to_string())?;
    windows::apply(hwnd.0, &rects, scale)
}

/// Fuera de Linux y Windows la ventana conserva su forma rectangular.
#[cfg(not(any(target_os = "linux", target_os = "windows")))]
#[tauri::command]
pub fn set_pomodoro_mini_shape(
    _window: tauri::Window,
    _rects: Vec<ShapeRect>,
) -> Result<(), String> {
    Ok(())
}
