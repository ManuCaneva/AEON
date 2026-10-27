// =============================================================
// src/lib/update/changelog.ts — Gramática del CHANGELOG
//
// Un solo formato para todos los consumidores: el script de CI que
// escribe la sección de una release, release.yml que arma el body del
// release, la app que muestra las novedades y (a futuro) la landing.
//
//   # Changelog
//
//   ## 0.5.0 — 2026-10-26
//
//   Resumen opcional.
//
//   - **Nuevo** — Texto para quien usa AEON
// =============================================================

import { isNewerVersion } from './semver.ts'
import { renderNotes, type ReleaseNotes } from './notes.ts'

/** Heading de sección: `## 0.5.0 — 2026-10-26` (la fecha es opcional). */
const SECTION_RE = /^##\s+(\S+)(?=\s|$)/

const TITLE = '# Changelog'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findSectionStarts(lines: string[]): number[] {
  return lines.reduce<number[]>((acc, line, index) => {
    if (SECTION_RE.test(line)) acc.push(index)
    return acc
  }, [])
}

function sectionEnd(lines: string[], start: number): number {
  for (let i = start + 1; i < lines.length; i += 1) {
    if (SECTION_RE.test(lines[i])) return i
  }
  return lines.length
}

/**
 * Construye la sección de una versión: heading + markdown etiquetado.
 * Es el único lugar donde se formatea el heading, para que el
 * extractor y el escritor no se desincronicen.
 */
export function buildVersionEntry(version: string, date: string, notes: ReleaseNotes): string {
  return [`## ${version} — ${date}`, '', renderNotes(notes)].join('\n')
}

/**
 * Extrae la sección completa de una versión (heading incluido), o null
 * si esa versión no está. La versión se compara completa: `0.5` no
 * matchea `0.5.0` y `0.5.0` no matchea `0.5.0-rc1`.
 */
export function extractVersionEntry(changelog: string, version: string): string | null {
  const lines = changelog.split(/\r?\n/)
  const headingRe = new RegExp(`^##\\s+${escapeRegExp(version)}(?=\\s|$)`)

  const start = lines.findIndex((line) => headingRe.test(line))
  if (start === -1) return null

  return lines.slice(start, sectionEnd(lines, start)).join('\n').trimEnd()
}

/**
 * Cuerpo de la sección de una versión: igual que `extractVersionEntry`
 * pero sin el heading. Es lo que la release pega en `releaseBody` (y por
 * ende en `latest.json.notes`). Devuelve null si la versión no está.
 */
export function extractVersionBody(changelog: string, version: string): string | null {
  const entry = extractVersionEntry(changelog, version)
  if (entry == null) return null

  return entry.split('\n').slice(1).join('\n').trim()
}

/**
 * Inserta o reemplaza la sección de una versión en el CHANGELOG,
 * manteniendo el orden descendente. Si el changelog está vacío, crea el
 * título. Devuelve el changelog completo modificado.
 */
export function upsertVersionEntry(changelog: string, entry: string): string {
  if (changelog.trim() === '') return [TITLE, '', entry].join('\n')

  const lines = changelog.split(/\r?\n/)
  const entryLines = entry.split(/\r?\n/)

  const entryVersion = SECTION_RE.exec(entry)?.[1]
  if (entryVersion == null) return changelog

  for (const start of findSectionStarts(lines)) {
    const match = SECTION_RE.exec(lines[start])
    if (match?.[1] !== entryVersion) continue

    lines.splice(start, sectionEnd(lines, start) - start, ...entryLines)
    return lines.join('\n')
  }

  const insertAt = findSectionStarts(lines).find((start) => {
    const match = SECTION_RE.exec(lines[start])
    return match != null && isNewerVersion(entryVersion, match[1])
  })

  if (insertAt != null) {
    lines.splice(insertAt, 0, ...entryLines, '')
    return lines.join('\n')
  }

  const result = [...lines]
  if (result[result.length - 1].trim() !== '') result.push('')
  result.push(...entryLines)
  return result.join('\n')
}
