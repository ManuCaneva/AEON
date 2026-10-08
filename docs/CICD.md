# CI/CD de AEON

Cómo se verifica y se publica AEON, y cómo enterarte del resultado sin abrir GitHub.

## Qué corre hoy

| Workflow  | Cuándo                       | Qué hace                                                                                                    |
| --------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `CI`      | push y PR a `main` y `dev`   | Dos jobs: `check` (tests, lint, format, build, cargo) y `perf` (presupuesto de rendimiento del dashboard).  |
| `Release` | push a `main`                | `test` (re-verifica) y después `publish`, que construye para Ubuntu y Windows y publica la release con tag. |
| `Notify`  | al terminar `CI` o `Release` | Manda el resultado a Telegram. No verifica nada, solo avisa.                                                |

La versión vive en `src-tauri/tauri.conf.json` y se publica con el tag `vX.Y.Z`. Si el tag ya existe, el merge no puede publicar nada: hay que correr `npm run release:bump -- <nueva-version>` antes de mergear.

## Notificaciones por Telegram

`Notify` escucha el resultado de `CI` y `Release` y manda un mensaje al grupo **AEON - builds**.

### Qué avisa y qué no

| Situación                                      | Mensaje                                                  |
| ---------------------------------------------- | -------------------------------------------------------- |
| CI en verde de un PR dirigido a `main`         | ✅ con el número de PR, título, autor y duración         |
| CI rojo de un PR dirigido a `main`             | ❌ con la lista de jobs que fallaron                     |
| Release publicada                              | 🚀 con la versión y el link al tag                       |
| Release fallida                                | 💥 avisando que main avanzó pero la app quedó sin update |
| Push a `dev`, corridas canceladas, PRs a `dev` | nada, en silencio                                        |

Las corridas canceladas se descartan a propósito: `CI` usa `cancel-in-progress`, así que cada push nuevo cancela la corrida anterior y avisar sería ruido.

Solo se avisa de PRs dirigidos a `main`. Si algún día querés ampliarlo a `dev`, el filtro está en una línea del script de `notify.yml`:

```yaml
--jq 'map(select(.base.ref == "main")) | .[0] // empty'
```

### Secrets

El workflow necesita dos secrets en el repo:

| Secret               | Valor                                    |
| -------------------- | ---------------------------------------- |
| `TELEGRAM_BOT_TOKEN` | el token que te dio @BotFather           |
| `TELEGRAM_CHAT_ID`   | el id del grupo, negativo en supergrupos |

Para setearlos desde la máquina:

```bash
gh secret set TELEGRAM_BOT_TOKEN --repo ManuCaneva/AEON
gh secret set TELEGRAM_CHAT_ID --repo ManuCaneva/AEON
```

## Cómo se armó el bot (para repetirlo desde cero)

1. Hablá con [@BotFather](https://t.me/BotFather), mandale `/newbot` y seguí las instrucciones. Te devuelve un token: ese es `TELEGRAM_BOT_TOKEN`.
2. Creá un grupo en Telegram y agregá el bot como miembro. No hace falta que sea admin.
3. Mandale cualquier comando al grupo, por ejemplo `/start`. **El bot no va a responder**: con la privacidad activada un bot no contesta dentro de un grupo, y eso es normal.
4. Leé el `chat_id`:

   ```bash
   curl -sS "https://api.telegram.org/bot<TOKEN>/getUpdates" \
     | jq -r '.result[].message.chat | "\(.title): \(.id)"'
   ```

   El id de un supergrupo es negativo y empieza con `-100`.

5. Verificá que llega antes de confiar en el pipeline:

   ```bash
   curl -sS -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
     -H 'Content-Type: application/json' \
     -d '{"chat_id":"<CHAT_ID>","text":"prueba"}'
   ```

## Probar el aviso sin mergear

`Notify` se puede correr a mano pasándole el id de una corrida existente, que es el número que aparece en la URL del run (`.../actions/runs/<id>`):

```bash
gh workflow run notify.yml --repo ManuCaneva/AEON -f run_id=<id>
```

Útil para probar el workflow después de un cambio sin tener que romper nada.

## Mantenimiento

- **Rotar el token**: @BotFather → `/revoke`, elegí el bot, y después actualizá el secret con el token nuevo. El anterior deja de funcionar en el acto.
- **El token se comparte por chat**: si lo pegaste en una conversación, tratalo como expuesto y rotalo.
- **Agregar otro workflow al aviso**: sumalo a la lista `workflows: [CI, Release]` y agregale una rama `elif` en el script.
- **El workflow debe estar en `main`**: `workflow_run` solo dispara si el archivo vive en la rama default. El PR que introduce `notify.yml` no se auto-notifica; arranca con el siguiente.

## Detalles de implementación

Dos costos de la API que el workflow evita a propósito:

- `GET /actions/runs/{id}/pull-requests` **no existe** (404). El camino documentado es buscar los PRs asociados al commit: `GET /commits/{sha}/pulls`.
- La corrida de CI del push a `main` después de un merge queda asociada al PR mergeado. Por eso el filtro es por `event == 'pull_request'` y no por "el PR apunta a main": así cada merge genera un solo aviso, y el push a `main` ya queda cubierto por `Release`.
