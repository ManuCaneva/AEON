/**
 * Selección de commits que le importan al usuario en una release.
 *
 * El resumen de novedades se redacta a partir de commits convencionales
 * (feat/fix/perf). Todo lo demás (chore, docs, test, refactor, ci, merges)
 * es ruido interno: ni siquiera llega al prompt de la IA.
 */

const RELEASE_COMMIT_RE = /^\s*(feat|fix|perf)(\([^)]*\))?!?:/

/**
 * Devuelve solo los subjects de commits feat/fix/perf, en el mismo orden.
 * El texto se devuelve tal cual vino (con espacios incluidos).
 */
export function filterReleaseCommits(subjects: readonly string[]): string[] {
  return subjects.filter((subject) => RELEASE_COMMIT_RE.test(subject))
}
