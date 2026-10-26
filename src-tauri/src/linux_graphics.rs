//! Configuración del entorno gráfico antes de que GTK cree la webview.

use std::ffi::OsString;
use std::path::Path;

trait Environment {
    fn get(&self, key: &str) -> Option<OsString>;
    fn set(&mut self, key: &str, value: &str);
}

struct ProcessEnvironment;

impl Environment for ProcessEnvironment {
    fn get(&self, key: &str) -> Option<OsString> {
        std::env::var_os(key)
    }

    fn set(&mut self, key: &str, value: &str) {
        std::env::set_var(key, value);
    }
}

pub(super) fn prepare() {
    configure(&mut ProcessEnvironment, Path::new("/sys/class/drm"));
}

fn configure(env: &mut impl Environment, drm_root: &Path) {
    // Tauri recomienda este workaround para Error 71 sin desactivar DMABUF:
    // https://tauri.app/develop/debug/linux-graphics/
    // Solo antes de inicializar GTK, sin hilos ni webviews creados todavía.
    if env.get("__NV_DISABLE_EXPLICIT_SYNC").is_some()
        || env.get("WAYLAND_DISPLAY").is_none_or(|v| v.is_empty())
        || env.get("GDK_BACKEND").is_some_and(|v| v == "x11")
    {
        return;
    }

    let Ok(devices) = std::fs::read_dir(drm_root) else {
        return;
    };
    let has_nvidia = devices.filter_map(Result::ok).any(|device| {
        std::fs::read_to_string(device.path().join("device/vendor"))
            .is_ok_and(|vendor| vendor.trim() == "0x10de")
    });
    if has_nvidia {
        env.set("__NV_DISABLE_EXPLICIT_SYNC", "1");
    }
}

#[cfg(test)]
#[path = "linux_graphics_tests.rs"]
mod tests;
