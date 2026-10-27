import { describe, expect, it } from 'vitest'
import {
  buildVersionEntry,
  extractVersionBody,
  extractVersionEntry,
  upsertVersionEntry,
} from './changelog'
import { parseNotes, renderNotes, type ReleaseNotes } from './notes'

const notes: ReleaseNotes = {
  summary: 'Esta versión trae novedades de calendario.',
  items: [
    { category: 'nuevo', text: 'Cronograma semanal' },
    { category: 'arreglado', text: 'Se arregló el arranque en Wayland' },
  ],
}

describe('buildVersionEntry', () => {
  it('arma la sección con heading de versión + fecha y el markdown etiquetado', () => {
    const entry = buildVersionEntry('0.5.0', '2026-10-26', notes)

    expect(entry).toBe(['## 0.5.0 — 2026-10-26', '', renderNotes(notes)].join('\n'))
  })

  it('es legible por parseNotes (round-trip)', () => {
    const entry = buildVersionEntry('0.5.0', '2026-10-26', notes)

    expect(parseNotes(entry)).toEqual(notes)
  })
})

describe('extractVersionEntry', () => {
  const changelog = [
    '# Changelog',
    '',
    '## 0.5.0 — 2026-10-26',
    '',
    '- **Nuevo** — Cronograma semanal',
    '',
    '## 0.4.0 — 2026-10-20',
    '',
    '- **Arreglado** — Cosas viejas',
  ].join('\n')

  it('extrae la sección completa de la versión pedida', () => {
    expect(extractVersionEntry(changelog, '0.5.0')).toBe(
      ['## 0.5.0 — 2026-10-26', '', '- **Nuevo** — Cronograma semanal'].join('\n')
    )
    expect(extractVersionEntry(changelog, '0.4.0')).toBe(
      ['## 0.4.0 — 2026-10-20', '', '- **Arreglado** — Cosas viejas'].join('\n')
    )
  })

  it('devuelve null si la versión no está', () => {
    expect(extractVersionEntry(changelog, '0.9.9')).toBeNull()
  })

  it('no confunde versiones con prefijos o sufijos', () => {
    expect(extractVersionEntry(changelog, '0.5')).toBeNull()
    expect(extractVersionEntry(changelog, '0.5.0-rc1')).toBeNull()
    expect(extractVersionEntry('## 0.5.0-rc1 — 2026-10-26\n\ntexto', '0.5.0')).toBeNull()
  })

  it('toma hasta el final si es la última sección', () => {
    const single = ['## 0.5.0 — 2026-10-26', '', 'texto'].join('\n')
    expect(extractVersionEntry(single, '0.5.0')).toBe(single)
  })
})

describe('extractVersionBody', () => {
  const changelog = [
    '# Changelog',
    '',
    '## 0.5.0 — 2026-10-26',
    '',
    'Resumen de la versión.',
    '',
    '- **Nuevo** — Cronograma semanal',
    '',
    '## 0.4.0 — 2026-10-20',
    '',
    '- **Arreglado** — La app abre bien',
  ].join('\n')

  it('devuelve el cuerpo sin el heading de la versión', () => {
    expect(extractVersionBody(changelog, '0.5.0')).toBe(
      ['Resumen de la versión.', '', '- **Nuevo** — Cronograma semanal'].join('\n')
    )
  })

  it('devuelve el cuerpo de la última sección sin heading', () => {
    expect(extractVersionBody(changelog, '0.4.0')).toBe('- **Arreglado** — La app abre bien')
  })

  it('devuelve null si la versión no está', () => {
    expect(extractVersionBody(changelog, '0.6.0')).toBeNull()
    expect(extractVersionBody('', '0.5.0')).toBeNull()
  })
})

describe('upsertVersionEntry', () => {
  it('crea el changelog con título si no existe', () => {
    const result = upsertVersionEntry('', buildVersionEntry('0.5.0', '2026-10-26', notes))

    expect(result).toBe(
      ['# Changelog', '', buildVersionEntry('0.5.0', '2026-10-26', notes)].join('\n')
    )
  })

  it('inserta la versión nueva arriba de las viejas (orden descendente)', () => {
    const changelog = ['# Changelog', '', '## 0.5.0 — 2026-10-26'].join('\n')
    const entry = buildVersionEntry('0.6.0', '2026-11-01', notes)

    const result = upsertVersionEntry(changelog, entry)

    const atNew = result.indexOf('## 0.6.0')
    const atOld = result.indexOf('## 0.5.0')
    expect(atNew).toBeGreaterThanOrEqual(0)
    expect(atNew).toBeLessThan(atOld)
  })

  it('inserta entre versiones cuando corresponde', () => {
    const changelog = [
      '# Changelog',
      '',
      '## 0.5.0 — 2026-10-26',
      '',
      '## 0.3.0 — 2026-10-01',
    ].join('\n')
    const entry = buildVersionEntry('0.4.0', '2026-10-20', notes)

    const result = upsertVersionEntry(changelog, entry)

    const at5 = result.indexOf('## 0.5.0')
    const at4 = result.indexOf('## 0.4.0')
    const at3 = result.indexOf('## 0.3.0')
    expect(at5).toBeLessThan(at4)
    expect(at4).toBeLessThan(at3)
  })

  it('reemplaza la sección si la versión ya existe', () => {
    const changelog = ['# Changelog', '', buildVersionEntry('0.5.0', '2026-10-26', notes)].join(
      '\n'
    )
    const nueva: ReleaseNotes = {
      summary: null,
      items: [{ category: 'mejorado', text: 'Reescrita' }],
    }
    const entry = buildVersionEntry('0.5.0', '2026-10-27', nueva)

    const result = upsertVersionEntry(changelog, entry)

    expect(result.match(/## 0\.5\.0/g)).toHaveLength(1)
    expect(extractVersionEntry(result, '0.5.0')).toBe(entry)
  })
})
