import { describe, expect, it } from 'vitest'
import {
  defaultPomodoroMiniWindowState,
  parsePomodoroMiniWindowStateJson,
} from './pomodoroMiniWindow'

describe('schema del estado persistido de la ventana mini', () => {
  it('primera ejecución: la mini queda cerrada y sin posición guardada', () => {
    expect(defaultPomodoroMiniWindowState).toEqual({ isOpen: false, x: null, y: null })
  })

  it('parsea el flag de apertura y la posición guardada', () => {
    const raw = JSON.stringify({ isOpen: true, x: 1620, y: 1120 })
    expect(parsePomodoroMiniWindowStateJson(raw)).toEqual({ isOpen: true, x: 1620, y: 1120 })
  })

  it('acepta posiciones fraccionarias de pantallas con escala no entera', () => {
    const raw = JSON.stringify({ isOpen: true, x: 66.5, y: -10.25 })
    expect(parsePomodoroMiniWindowStateJson(raw)).toEqual({ isOpen: true, x: 66.5, y: -10.25 })
  })

  it('JSON corrupto cae al estado por defecto sin lanzar', () => {
    expect(parsePomodoroMiniWindowStateJson('{roto')).toEqual(defaultPomodoroMiniWindowState)
    expect(parsePomodoroMiniWindowStateJson('null')).toEqual(defaultPomodoroMiniWindowState)
  })

  it('valores con tipos inválidos caen al estado por defecto sin lanzar', () => {
    const raw = JSON.stringify({ isOpen: 'sí', x: 'cien', y: false })
    expect(parsePomodoroMiniWindowStateJson(raw)).toEqual(defaultPomodoroMiniWindowState)
  })

  it('sin dato persistido devuelve el estado por defecto', () => {
    expect(parsePomodoroMiniWindowStateJson(null)).toEqual(defaultPomodoroMiniWindowState)
    expect(parsePomodoroMiniWindowStateJson(undefined)).toEqual(defaultPomodoroMiniWindowState)
    expect(parsePomodoroMiniWindowStateJson('')).toEqual(defaultPomodoroMiniWindowState)
  })
})
