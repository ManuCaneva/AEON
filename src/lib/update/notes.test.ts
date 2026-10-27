import { describe, expect, it } from 'vitest'
import { NOTE_CATEGORIES, parseNotes, renderNotes, validateNotes, type ReleaseNotes } from './notes'

describe('parseNotes', () => {
  it('devuelve null con body vacío o ausente', () => {
    expect(parseNotes(null)).toBeNull()
    expect(parseNotes(undefined)).toBeNull()
    expect(parseNotes('')).toBeNull()
    expect(parseNotes('   \n\n  ')).toBeNull()
  })

  it('devuelve null cuando no hay bullets etiquetados', () => {
    expect(parseNotes('Solo texto suelto sin formato.')).toBeNull()
    expect(parseNotes('- bullet sin etiqueta\n- otro')).toBeNull()
  })

  it('parsea bullets de las tres categorías', () => {
    const body = [
      '- **Nuevo** — Cronograma semanal',
      '- **Arreglado** — Se arregló el arranque en Wayland',
      '- **Mejorado** — El dashboard responde más rápido',
    ].join('\n')

    expect(parseNotes(body)).toEqual({
      summary: null,
      items: [
        { category: 'nuevo', text: 'Cronograma semanal' },
        { category: 'arreglado', text: 'Se arregló el arranque en Wayland' },
        { category: 'mejorado', text: 'El dashboard responde más rápido' },
      ],
    })
  })

  it('tolera variantes de viñeta, separador y mayúsculas de categoría', () => {
    const body = '* **nuevo** — Con asterisco\n* **ARREGLADO**: Con dos puntos'

    expect(parseNotes(body)).toEqual({
      summary: null,
      items: [
        { category: 'nuevo', text: 'Con asterisco' },
        { category: 'arreglado', text: 'Con dos puntos' },
      ],
    })
  })

  it('toma como resumen el párrafo previo a los bullets e ignora headings', () => {
    const body = [
      '## 0.5.0 — 2026-10-26',
      '',
      'Esta versión trae novedades de calendario.',
      '',
      '- **Nuevo** — Cronograma semanal',
    ].join('\n')

    expect(parseNotes(body)).toEqual({
      summary: 'Esta versión trae novedades de calendario.',
      items: [{ category: 'nuevo', text: 'Cronograma semanal' }],
    })
  })

  it('ignora todo lo que venga después del separador --- (aviso estático)', () => {
    const body = [
      '- **Nuevo** — Cronograma semanal',
      '',
      '---',
      '',
      'La app no está firmada: Windows puede mostrar un aviso de SmartScreen.',
    ].join('\n')

    expect(parseNotes(body)).toEqual({
      summary: null,
      items: [{ category: 'nuevo', text: 'Cronograma semanal' }],
    })
  })

  it('acepta bullets sin em-dash cuando el texto está pegado al separador simple', () => {
    const body = '- **Mejorado** - Arranque más rápido'

    expect(parseNotes(body)).toEqual({
      summary: null,
      items: [{ category: 'mejorado', text: 'Arranque más rápido' }],
    })
  })
})

describe('renderNotes', () => {
  it('renderiza bullets en orden nuevo → arreglado → mejorado', () => {
    const notes: ReleaseNotes = {
      summary: 'Resumen.',
      items: [
        { category: 'mejorado', text: 'Tercero' },
        { category: 'nuevo', text: 'Primero' },
        { category: 'arreglado', text: 'Segundo' },
      ],
    }

    expect(renderNotes(notes)).toBe(
      [
        'Resumen.',
        '',
        '- **Nuevo** — Primero',
        '- **Arreglado** — Segundo',
        '- **Mejorado** — Tercero',
      ].join('\n')
    )
  })

  it('mantiene el orden original dentro de una misma categoría y omite resumen nulo', () => {
    const notes: ReleaseNotes = {
      summary: null,
      items: [
        { category: 'nuevo', text: 'Primero' },
        { category: 'nuevo', text: 'Segundo' },
      ],
    }

    expect(renderNotes(notes)).toBe('- **Nuevo** — Primero\n- **Nuevo** — Segundo')
  })
})

describe('validateNotes', () => {
  const valid = {
    summary: 'Resumen de la versión.',
    items: [
      { category: 'nuevo', text: 'Cronograma semanal' },
      { category: 'arreglado', text: 'Se arregló el arranque' },
    ],
  }

  it('acepta un objeto bien formado y normaliza la categoría a minúsculas', () => {
    const result = validateNotes({
      summary: 'Resumen.',
      items: [{ category: 'Nuevo', text: 'Cronograma semanal' }],
    })

    expect(result).toEqual({
      ok: true,
      notes: { summary: 'Resumen.', items: [{ category: 'nuevo', text: 'Cronograma semanal' }] },
    })
  })

  it('acepta resumen ausente', () => {
    expect(validateNotes({ items: [{ category: 'nuevo', text: 'Algo' }] }).ok).toBe(true)
  })

  it('rechaza valores que no son objeto', () => {
    for (const bad of [null, 'texto', 42, []]) {
      expect(validateNotes(bad).ok).toBe(false)
    }
  })

  it('rechaza sin items o con más de 5', () => {
    expect(validateNotes({ items: [] }).ok).toBe(false)

    const many = {
      items: Array.from({ length: 6 }, (_, i) => ({ category: 'nuevo', text: `Item ${i}` })),
    }
    expect(validateNotes(many).ok).toBe(false)
  })

  it('rechaza categoría fuera del set', () => {
    expect(validateNotes({ items: [{ category: 'roto', text: 'Algo' }] }).ok).toBe(false)
  })

  it('rechaza texto vacío, multilínea o demasiado largo', () => {
    const make = (text: string) => ({ items: [{ category: 'nuevo', text }] })

    expect(validateNotes(make('   ')).ok).toBe(false)
    expect(validateNotes(make('una\nlínea')).ok).toBe(false)
    expect(validateNotes(make('x'.repeat(121))).ok).toBe(false)
    expect(validateNotes(make('x'.repeat(120))).ok).toBe(true)
  })

  it('rechaza resumen multilíneo o demasiado largo', () => {
    expect(validateNotes({ ...valid, summary: 'a\nb' }).ok).toBe(false)
    expect(validateNotes({ ...valid, summary: 'x'.repeat(201) }).ok).toBe(false)
  })

  it('rechaza vocabulario interno prohibido', () => {
    for (const text of [
      'Refactorizamos el store de Pinia',
      'Se actualizaron los tests del módulo',
      'Nuevo pipeline de CI',
      'Commits del release',
    ]) {
      const result = validateNotes({ items: [{ category: 'nuevo', text }] })
      expect(result.ok).toBe(false)
    }
  })

  it('cada error explica qué está mal', () => {
    const result = validateNotes({ items: [{ category: 'roto', text: '' }] })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
      expect(result.errors.join('\n')).toMatch(/categoría/i)
      expect(result.errors.join('\n')).toMatch(/texto/i)
    }
  })

  it('NOTA_CATEGORIES cubre exactamente las tres categorías del diseño', () => {
    expect([...NOTE_CATEGORIES]).toEqual(['nuevo', 'arreglado', 'mejorado'])
  })
})
