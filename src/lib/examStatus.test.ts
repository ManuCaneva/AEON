import { describe, it, expect } from 'vitest'
import { examStatusLabel, examStatusVariant, shouldShowGrade, formatGrade } from './examStatus'

describe('examStatusLabel', () => {
  it('traduce cada estado a su etiqueta legible', () => {
    expect(examStatusLabel('pendiente')).toBe('Pendiente')
    expect(examStatusLabel('estudiando')).toBe('Estudiando')
    expect(examStatusLabel('rendido')).toBe('Rendido')
  })
})

describe('examStatusVariant', () => {
  it('asigna una variante de insignia distinta por estado', () => {
    expect(examStatusVariant('pendiente')).toBe('default')
    expect(examStatusVariant('estudiando')).toBe('primary')
    expect(examStatusVariant('rendido')).toBe('success')
  })
})

describe('shouldShowGrade', () => {
  it('muestra la nota sólo si el examen está rendido y hay nota', () => {
    expect(shouldShowGrade('rendido', 8.5)).toBe(true)
    expect(shouldShowGrade('rendido', 0)).toBe(true)
    expect(shouldShowGrade('rendido', null)).toBe(false)
    expect(shouldShowGrade('pendiente', 8.5)).toBe(false)
    expect(shouldShowGrade('estudiando', 8.5)).toBe(false)
  })
})

describe('formatGrade', () => {
  it('formatea la nota sin ceros de más', () => {
    expect(formatGrade(8)).toBe('8')
    expect(formatGrade(10)).toBe('10')
    expect(formatGrade(0)).toBe('0')
    expect(formatGrade(8.5)).toBe('8.5')
    expect(formatGrade(7.25)).toBe('7.25')
  })
})
