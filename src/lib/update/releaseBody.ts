/**
 * Composición del body de la release de GitHub.
 *
 * `releaseBody` → `latest.json.notes` → `Update.body` en la app. El
 * separador `---` es la frontera: `parseNotes` corta ahí, así el aviso de
 * SmartScreen nunca aparece como una "novedad" dentro de la app.
 */

export const SMARTSCREEN_NOTICE =
  'Descargá la versión para tu sistema operativo. La app no está firmada: Windows puede mostrar un aviso de SmartScreen y pedir confirmación la primera vez.'

export interface ReleaseBody {
  body: string
  generateReleaseNotes: boolean
}

/**
 * Arma el body de la release a partir de la sección del CHANGELOG.
 *
 * Con sección: resumen + separador + aviso, y sin auto-notas (para no
 * duplicar). Sin sección (hotfix sin changelog): solo el aviso, y GitHub
 * genera las notas desde los PRs.
 */
export function composeReleaseBody(notesBody: string | null): ReleaseBody {
  const trimmed = notesBody == null ? '' : notesBody.trim()
  if (trimmed === '') {
    return { body: SMARTSCREEN_NOTICE, generateReleaseNotes: true }
  }

  return {
    body: [trimmed, SMARTSCREEN_NOTICE].join('\n\n---\n\n'),
    generateReleaseNotes: false,
  }
}
