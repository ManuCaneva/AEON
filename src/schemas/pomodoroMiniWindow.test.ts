import { describe, expect, it } from 'vitest'
import {
  defaultPomodoroMiniWindowState,
  parsePomodoroMiniWindowStateJson,
} from './pomodoroMiniWindow'

describe('schema del estado persistido de la ventana mini', () => {
  it('primera ejecución: la mini queda cerrada y sin posición ni tamaño guardados', () => {
    expect(defaultPomodoroMiniWindowState).toEqual({
      isOpen: false,
      x: null,
      y: null,
      width: null,
      height: null,
    })
  })

  it('un estado viejo sin tamaño sigue siendo válido y conserva la posición', () => {
    const raw = JSON.stringify({ isOpen: true, x: 1620, y: 1120 })
    expect(parsePomodoroMiniWindowStateJson(raw)).toEqual({
      isOpen: true,
      x: 1620,
      y: 1120,
      width: null,
      height: null,
    })
  })

  it('parsea el tamaño guardado junto a la posición', () => {
    const raw = JSON.stringify({ isOpen: true, x: 10, y: 20, width: 160, height: 180 })
    expect(parsePomodoroMiniWindowStateJson(raw)).toEqual({
      isOpen: true,
      x: 10,
      y: 20,
      width: 160,
      height: 180,
    })
  })

  it('acepta posiciones fraccionarias de pantallas con escala no entera', () => {
    const raw = JSON.stringify({ isOpen: true, x: 66.5, y: -10.25 })
    expect(parsePomodoroMiniWindowStateJson(raw)).toEqual({
      isOpen: true,
      x: 66.5,
      y: -10.25,
      width: null,
      height: null,
    })
  })

  it('JSON corrupto cae al estado por defecto sin lanzar', () => {
    expect(parsePomodoroMiniWindowStateJson('{roto')).toEqual(defaultPomodoroMiniWindowState)
    expect(parsePomodoroMiniWindowStateJson('null')).toEqual(defaultPomodoroMiniWindowState)
  })

  it('valores con tipos inválidos caen al estado por defecto sin lanzar', () => {
    const raw = JSON.stringify({ isOpen: 'sí', x: 'cien', y: false })
    expect(parsePomodoroMiniWindowStateJson(raw)).toEqual(defaultPomodoroMiniWindowState)
  })

  it('un tamaño imposible (cero o negativo) corrompe el estado y cae al default', () => {
    expect(parsePomodoroMiniWindowStateJson(JSON.stringify({ width: 0, height: 180 }))).toEqual(
      defaultPomodoroMiniWindowState
    )
    expect(parsePomodoroMiniWindowStateJson(JSON.stringify({ width: 160, height: -5 }))).toEqual(
      defaultPomodoroMiniWindowState
    )
  })

  it('sin dato persistido devuelve el estado por defecto', () => {
    expect(parsePomodoroMiniWindowStateJson(null)).toEqual(defaultPomodoroMiniWindowState)
    expect(parsePomodoroMiniWindowStateJson(undefined)).toEqual(defaultPomodoroMiniWindowState)
    expect(parsePomodoroMiniWindowStateJson('')).toEqual(defaultPomodoroMiniWindowState)
  })
})
