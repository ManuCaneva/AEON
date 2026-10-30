use super::*;
use windows_sys::Win32::Graphics::Gdi::PtInRegion;

#[test]
fn native_region_scales_and_releases_the_area_outside_the_shape() {
    // Una fila lógica, con DPI 150%: los extremos compartidos deben coincidir.
    let rects = [
        ShapeRect {
            x: 23,
            y: 0,
            width: 100,
            height: 1,
        },
        ShapeRect {
            x: 23,
            y: 1,
            width: 100,
            height: 1,
        },
        ShapeRect {
            x: 5,
            y: 5,
            width: 0,
            height: 1,
        },
    ];
    let region = NativeRegion::from_rects(&rects, 1.5).unwrap();
    unsafe {
        assert_ne!(PtInRegion(region.0, 35, 0), 0);
        assert_ne!(PtInRegion(region.0, 35, 2), 0);
        assert_eq!(PtInRegion(region.0, 34, 0), 0);
        assert_eq!(PtInRegion(region.0, 185, 0), 0);
        assert_eq!(PtInRegion(region.0, 35, 3), 0);
        assert_eq!(PtInRegion(region.0, 8, 8), 0);
    }
}
