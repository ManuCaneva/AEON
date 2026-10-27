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

## Novedades de cada release

Las novedades se generan solas en el PR a `main`:

1. **`release-notes.yml`** junta los commits `feat`/`fix`/`perf` del PR (lo interno —
   chore, docs, test, refactor — ni llega al prompt) y le pide a la IA que redacte el
   resumen. Las reglas de estilo viven en `scripts/release-notes-prompt.md`
   (máx 5 bullets de una línea, lenguaje de usuario, voseo, categoría
   nuevo/arreglado/mejorado). La validación dura es `validateNotes` en
   `src/lib/update/notes.ts`.

   La IA corre sobre cualquier endpoint compatible con OpenAI. Por defecto usa
   Gemini (`gemini-2.5-flash`) con la API key del secret **`RELEASE_NOTES_API_KEY`**
   (una key de Google AI Studio alcanza). Se cambia de proveedor con los envs
   `RELEASE_NOTES_API` y `RELEASE_NOTES_MODEL`. **Sin secret, el paso se omite y la
   release cae en auto-notas de GitHub** — la app igual muestra novedades, solo que
   con los títulos de PR.

2. El resultado queda en **`docs/CHANGELOG.md`** como una sección
   `## <versión> — <fecha>`, commiteada a la rama del PR. **El único paso humano es
   mirar ese diff** (y editarlo si querés). Se regenera en cada push al PR; las
   ediciones finales se hacen después del último push.
3. Al mergear, **`release.yml`** arma el body de la release con esa sección + el aviso
   de SmartScreen (`scripts/release-notes.mjs extract`). Eso viaja a `latest.json.notes`
   y de ahí a `Update.body` en la app.

Si la IA falla, comenta el problema en el PR y no bloquea el merge. Si el merge entra
sin sección en el changelog, la release sale con auto-notas de GitHub (fallback).

### Qué ve el usuario

- **Antes de actualizar**: la sección "Qué hay de nuevo" del modal de actualización.
- **Después de actualizar**: el modal "Novedades de la versión X" al abrir la app, una
  sola vez por versión.

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
