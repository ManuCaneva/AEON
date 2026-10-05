# Releases

Las releases se publican solas al mergear a `main`. El gate es la aprobación del PR.

## Cómo sacar una versión

```bash
npm run release:bump -- 0.1.1
```

Commit, PR a `main`, y mergealo. Con eso alcanza: no hay que pushear tags a mano.

## Qué hace el CI

1. Corre `npm run test`, `npm run build` y `cargo check`.
2. Falla el merge si el tag `v<versión>` ya existe.
3. Builda Windows (NSIS) y Linux (AppImage).
4. Publica la release `v<versión>` con los instaladores y `latest.json` firmado.

`latest.json` es lo que consulta la app instalada para ofrecerse la actualización.

## Reglas

- La versión vive en **tres archivos** (`package.json`, `src-tauri/Cargo.toml`,
  `src-tauri/tauri.conf.json`) y el script los mueve juntos o ninguno. No los edites a mano.
- Formato semver de tres números: `0.1.0`, `0.1.1`, `0.2.0`. `0.1` no es válido.
- **No mergees a `main` sin bumpear.** El CI falla con ese mensaje.
- El `identifier: com.aeon` no se toca nunca: cambiarlo mueve la base de datos y los
  usuarios ven la app vacía.

## Si una versión sale mal

Reinstalá el instalador de la versión anterior desde la página de releases. Los datos no se
tocan: viven en el app data dir, fuera del instalador.

## Actualizaciones en la app

Quien instaló AEON una vez ya tiene el updater adentro: al abrir, si hay una versión nueva,
la app la ofrece y se actualiza sola. No hay que hacer nada más.
