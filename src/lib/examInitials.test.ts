import { describe, it, expect } from 'vitest'
import { examInitials, MAX_EXAM_INITIALS } from './examInitials'

describe('examInitials', () => {
  it('toma la inicial de cada palabra significativa', () => {
    expect(examInitials('Aspectos avanzados de calidad de software')).toBe('AACS')
  })

  it('cuenta números y numerales romanos como palabra', () => {
    expect(examInitials('Análisis Matemático II')).toBe('AMI')
    expect(examInitials('Física I')).toBe('FI')
    expect(examInitials('Historia 2 de América')).toBe('H2A')
  })

  it('ignora los conectores', () => {
    expect(examInitials('Introducción a los Sistemas')).toBe('IS')
  })

  it('normaliza acentos y la eñe', () => {
    expect(examInitials('Ñandú Épico')).toBe('NE')
  })

  it('una sola palabra da una sola inicial en mayúscula', () => {
    expect(examInitials('Programación')).toBe('P')
  })

  it('recorta a un máximo de 7 caracteres', () => {
    const long = 'Álgebra Cálculo Diferencial Ecuaciones Física Geometría Historia Integrales'
    expect(examInitials(long)).toHaveLength(MAX_EXAM_INITIALS)
  })

  it('un título sólo de conectores no rompe: devuelve un fallback no vacío', () => {
    expect(examInitials('de la').length).toBeGreaterThan(0)
  })

  it('un nombre vacío o sólo espacios devuelve cadena vacía', () => {
    expect(examInitials('   ')).toBe('')
    expect(examInitials('')).toBe('')
  })
})
