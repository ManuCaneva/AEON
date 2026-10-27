import { describe, expect, it } from 'vitest'
import { composeReleaseBody, SMARTSCREEN_NOTICE } from './releaseBody'
import { parseNotes } from './notes'

describe('composeReleaseBody', () => {
  const seccion = ['Resumen.', '', '- **Nuevo** — Cronograma semanal'].join('\n')

  it('sin sección: solo el aviso y deja que GitHub genere las notas', () => {
    const result = composeReleaseBody(null)

    expect(result.body).toBe(SMARTSCREEN_NOTICE)
    expect(result.generateReleaseNotes).toBe(true)
  })

  it('sección vacía cuenta como sin sección', () => {
    expect(composeReleaseBody('   ')).toEqual(composeReleaseBody(null))
  })

  it('con sección: resumen + separador + aviso, sin auto-notas', () => {
    const result = composeReleaseBody(seccion)

    expect(result.body).toBe([seccion, SMARTSCREEN_NOTICE].join('\n\n---\n\n'))
    expect(result.generateReleaseNotes).toBe(false)
  })

  it('las notas de la app ignoran el aviso (round-trip con parseNotes)', () => {
    const { body } = composeReleaseBody(seccion)

    expect(parseNotes(body)).toEqual({
      summary: 'Resumen.',
      items: [{ category: 'nuevo', text: 'Cronograma semanal' }],
    })
  })
})
