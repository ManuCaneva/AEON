import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWhatsNew, PENDING_KEY, SEEN_KEY } from './useWhatsNew'

describe('useWhatsNew', () => {
  const values = new Map<string, string>()

  beforeEach(() => {
    values.clear()
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    })
  })

  function seedPending(version = '0.5.0'): void {
    values.set(
      PENDING_KEY,
      JSON.stringify({
        version,
        notes: {
          summary: 'Resumen.',
          items: [{ category: 'nuevo', text: 'Cronograma semanal' }],
        },
      })
    )
  }

  it('no muestra nada sin novedades pendientes', () => {
    const whatsNew = useWhatsNew()

    whatsNew.checkPending()

    expect(whatsNew.visible.value).toBe(false)
    expect(whatsNew.notes.value).toBeNull()
  })

  it('muestra las novedades de la versión recién instalada', () => {
    seedPending()
    const whatsNew = useWhatsNew()

    whatsNew.checkPending()

    expect(whatsNew.visible.value).toBe(true)
    expect(whatsNew.version.value).toBe('0.5.0')
    expect(whatsNew.notes.value).toEqual({
      summary: 'Resumen.',
      items: [{ category: 'nuevo', text: 'Cronograma semanal' }],
    })
  })

  it('al cerrar marca la versión como vista y limpia el pendiente', () => {
    seedPending()
    const whatsNew = useWhatsNew()
    whatsNew.checkPending()

    whatsNew.close()

    expect(whatsNew.visible.value).toBe(false)
    expect(values.get(SEEN_KEY)).toBe('0.5.0')
    expect(values.has(PENDING_KEY)).toBe(false)
  })

  it('no vuelve a mostrar la misma versión', () => {
    seedPending()
    values.set(SEEN_KEY, '0.5.0')
    const whatsNew = useWhatsNew()

    whatsNew.checkPending()

    expect(whatsNew.visible.value).toBe(false)
    expect(values.has(PENDING_KEY)).toBe(false)
  })

  it('muestra una versión más nueva que la vista', () => {
    values.set(SEEN_KEY, '0.5.0')
    seedPending('0.6.0')
    const whatsNew = useWhatsNew()

    whatsNew.checkPending()

    expect(whatsNew.visible.value).toBe(true)
    expect(whatsNew.version.value).toBe('0.6.0')
  })

  it('ignora un pendiente corrupto sin romper', () => {
    values.set(PENDING_KEY, '{esto no es json')
    const whatsNew = useWhatsNew()

    expect(() => whatsNew.checkPending()).not.toThrow()
    expect(whatsNew.visible.value).toBe(false)

    values.set(PENDING_KEY, JSON.stringify({ version: '0.5.0', notes: null }))
    whatsNew.checkPending()

    expect(whatsNew.visible.value).toBe(false)
    expect(values.has(PENDING_KEY)).toBe(false)
  })
})
