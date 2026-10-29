use super::*;
use std::collections::BTreeMap;
use std::sync::atomic::{AtomicUsize, Ordering};

#[derive(Default)]
struct TestEnvironment(BTreeMap<String, OsString>);

impl Environment for TestEnvironment {
    fn get(&self, key: &str) -> Option<OsString> {
        self.0.get(key).cloned()
    }

    fn set(&mut self, key: &str, value: &str) {
        self.0.insert(key.into(), value.into());
    }
}

struct DrmFixture(std::path::PathBuf);

impl DrmFixture {
    fn new(vendors: &[&str]) -> Self {
        static NEXT: AtomicUsize = AtomicUsize::new(0);
        let root = std::env::temp_dir().join(format!(
            "aeon-drm-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::create_dir(&root).unwrap();
        for (index, vendor) in vendors.iter().enumerate() {
            let device = root.join(format!("card{index}/device"));
            std::fs::create_dir_all(&device).unwrap();
            std::fs::write(device.join("vendor"), vendor).unwrap();
        }
        Self(root)
    }
}

impl Drop for DrmFixture {
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.0).unwrap();
    }
}

#[test]
fn wayland_con_nvidia_hibrida_desactiva_explicit_sync_sin_tocar_dmabuf() {
    let drm = DrmFixture::new(&["0x1002\n", "0x10de\n"]);
    let mut env = TestEnvironment::default();
    env.set("WAYLAND_DISPLAY", "wayland-test");

    configure(&mut env, &drm.0);

    assert_eq!(env.get("__NV_DISABLE_EXPLICIT_SYNC"), Some("1".into()));
    assert_eq!(env.get("WEBKIT_DISABLE_DMABUF_RENDERER"), None);
}

#[test]
fn respeta_overrides_de_explicit_sync_incluso_vacio_y_no_unicode() {
    use std::os::unix::ffi::OsStringExt;
    let drm = DrmFixture::new(&["0x10de"]);
    for value in [
        "0".into(),
        "1".into(),
        "".into(),
        OsString::from_vec(vec![0xff]),
    ] {
        let mut env = TestEnvironment::default();
        env.set("WAYLAND_DISPLAY", "wayland-test");
        env.0.insert("__NV_DISABLE_EXPLICIT_SYNC".into(), value);
        let before = env.0.clone();

        configure(&mut env, &drm.0);

        assert_eq!(env.0, before);
    }
}

#[test]
fn sin_display_wayland_no_modifica_el_entorno() {
    let drm = DrmFixture::new(&["0x10de"]);
    for display in [None, Some("")] {
        let mut env = TestEnvironment::default();
        env.set("XDG_SESSION_TYPE", "x11");
        if let Some(value) = display {
            env.set("WAYLAND_DISPLAY", value);
        }
        let before = env.0.clone();

        configure(&mut env, &drm.0);

        assert_eq!(env.0, before);
    }
}

#[test]
fn backend_x11_explicito_no_aplica_workaround_aunque_exista_wayland() {
    let drm = DrmFixture::new(&["0x10de"]);
    let mut env = TestEnvironment::default();
    env.set("WAYLAND_DISPLAY", "wayland-test");
    env.set("GDK_BACKEND", "x11");
    let before = env.0.clone();

    configure(&mut env, &drm.0);

    assert_eq!(env.0, before);
}

#[test]
fn sin_nvidia_o_con_datos_desconocidos_no_modifica_el_entorno() {
    for vendors in [&[][..], &["0x1002", "0x8086"][..], &["unknown", ""][..]] {
        let drm = DrmFixture::new(vendors);
        let mut env = TestEnvironment::default();
        env.set("WAYLAND_DISPLAY", "wayland-test");
        let before = env.0.clone();

        configure(&mut env, &drm.0);

        assert_eq!(env.0, before);
    }
}

#[test]
fn drm_ausente_o_vendor_ilegible_no_impide_el_arranque() {
    let drm = DrmFixture::new(&[]);
    std::fs::create_dir(drm.0.join("card0")).unwrap();
    let mut env = TestEnvironment::default();
    env.set("WAYLAND_DISPLAY", "wayland-test");
    let before = env.0.clone();

    configure(&mut env, &drm.0.join("missing"));
    configure(&mut env, &drm.0);

    assert_eq!(env.0, before);
}

#[test]
fn conserva_override_dmabuf_y_solo_agrega_explicit_sync() {
    let drm = DrmFixture::new(&["0x10de"]);
    for dmabuf in ["0", "1", ""] {
        let mut env = TestEnvironment::default();
        env.set("WAYLAND_DISPLAY", "wayland-test");
        env.set("WEBKIT_DISABLE_DMABUF_RENDERER", dmabuf);
        let mut expected = env.0.clone();
        expected.insert("__NV_DISABLE_EXPLICIT_SYNC".into(), "1".into());

        configure(&mut env, &drm.0);
        configure(&mut env, &drm.0);

        assert_eq!(env.0, expected);
    }
}
