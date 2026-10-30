use super::ShapeRect;
use windows_sys::Win32::Foundation::HWND;
use windows_sys::Win32::Graphics::Gdi::{
    CombineRgn, CreateRectRgn, DeleteObject, SetWindowRgn, ERROR, HRGN, RGN_OR,
};

/// Win32 usa píxeles físicos; GTK recibe los mismos rectángulos en lógicos.
struct NativeRegion(HRGN);

impl NativeRegion {
    fn from_rects(rects: &[ShapeRect], scale: f64) -> Result<Self, String> {
        let region = Self::rectangle(0, 0, 0, 0)?;
        for rect in rects {
            if rect.width <= 0 || rect.height <= 0 {
                continue;
            }
            // Redondear los extremos, no el ancho, evita huecos entre filas a DPI fraccional.
            let row = Self::rectangle(
                (f64::from(rect.x) * scale).round() as i32,
                (f64::from(rect.y) * scale).round() as i32,
                ((f64::from(rect.x) + f64::from(rect.width)) * scale).round() as i32,
                ((f64::from(rect.y) + f64::from(rect.height)) * scale).round() as i32,
            )?;
            // SAFETY: ambos handles están vivos y son regiones creadas por GDI.
            if unsafe { CombineRgn(region.0, region.0, row.0, RGN_OR) } == ERROR {
                return Err("No se pudo combinar la región del pomodoro".into());
            }
        }
        Ok(region)
    }

    fn rectangle(left: i32, top: i32, right: i32, bottom: i32) -> Result<Self, String> {
        // SAFETY: GDI acepta rectángulos vacíos y devuelve null si no puede crearlos.
        let handle = unsafe { CreateRectRgn(left, top, right, bottom) };
        if handle.is_null() {
            return Err("No se pudo crear la región del pomodoro".into());
        }
        Ok(Self(handle))
    }
}

impl Drop for NativeRegion {
    fn drop(&mut self) {
        // SAFETY: este wrapper es dueño del handle hasta transferirlo a Windows.
        unsafe { DeleteObject(self.0) };
    }
}

/// SetWindowRgn limita tanto la pintura como el hit-test de la ventana opaca.
pub(super) fn apply(hwnd: HWND, rects: &[ShapeRect], scale: f64) -> Result<(), String> {
    let region = NativeRegion::from_rects(rects, scale)?;
    // SAFETY: Tauri conserva viva la ventana; la región aún pertenece al wrapper.
    if unsafe { SetWindowRgn(hwnd, region.0, 1) } == 0 {
        return Err("No se pudo aplicar la región del pomodoro".into());
    }
    // En éxito, Windows pasa a ser dueño y destruye la región al reemplazarla.
    std::mem::forget(region);
    Ok(())
}

#[cfg(test)]
#[path = "windows.test.rs"]
mod tests;
