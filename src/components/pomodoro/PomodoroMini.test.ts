import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import type { Component } from 'vue'

const h = vi.hoisted(() => ({
  startDragging: vi.fn(),
  closeWindow: vi.fn(),
  showInMain: vi.fn(),
  applyShape: vi.fn(async () => {}),
  pointer: null as ((inside: boolean) => void) | null,
  scaleChanged: null as (() => void) | null,
  unlisten: vi.fn(),
  unlistenScale: vi.fn(),
}))

vi.mock('@/lib/pomodoroMiniWindow', () => ({
  startDraggingPomodoroMiniWindow: h.startDragging,
  closePomodoroMiniWindow: h.closeWindow,
  applyPomodoroMiniWindowShape: h.applyShape,
  listenPomodoroMiniPointer: async (handler: (inside: boolean) => void) => {
    h.pointer = handler
    return h.unlisten
  },
  listenPomodoroMiniScaleChanged: async (handler: () => void) => {
    h.scaleChanged = handler
    return h.unlistenScale
  },
}))

vi.mock('@/lib/pomodoroMainWindow', () => ({
  showPomodoroInMainWindow: h.showInMain,
}))

import PomodoroMini from './PomodoroMini.vue'

enableAutoUnmount(afterEach)

const DiscStub: Component = {
  template: `
    <div data-testid="disc-stub">
      <div class="pomodoro-countdown" data-testid="pomodoro-mini-countdown">25:00</div>
      <div class="pomodoro-controls" data-testid="pomodoro-mini-controls">
        <button data-testid="pomodoro-mini-reset">reset</button>
        <button data-testid="pomodoro-mini-toggle">toggle</button>
      </div>
    </div>
  `,
}

const PillStub: Component = {
  emits: ['go', 'close'],
  template: `
    <div data-testid="pill-stub">
      <button data-testid="pill-go" @click="$emit('go')">go</button>
      <button data-testid="pill-close" @click="$emit('close')">close</button>
    </div>
  `,
}

function montar() {
  return mount(PomodoroMini, {
    global: { stubs: { PomodoroDisc: DiscStub, PomodoroPill: PillStub } },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  h.startDragging.mockReset()
  h.closeWindow.mockReset().mockResolvedValue(undefined)
  h.showInMain.mockReset().mockResolvedValue(undefined)
  h.applyShape.mockReset().mockResolvedValue(undefined)
  h.pointer = null
  h.scaleChanged = null
  h.unlisten.mockReset()
  h.unlistenScale.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('PomodoroMini', () => {
  it('reaplica el recorte al cambiar el DPI sin revelar la pastilla oculta', async () => {
    montar()
    await vi.advanceTimersByTimeAsync(0)
    h.applyShape.mockClear()
    h.scaleChanged?.()
    await vi.advanceTimersByTimeAsync(200)
    expect(h.applyShape).toHaveBeenLastCalledWith(0)
  })

  it('monta el disco y deja la pastilla inactiva y oculta en reposo', () => {
    const wrapper = montar()

    expect(wrapper.get('[data-testid="pomodoro-mini"]').classes()).toContain('pomodoro-orb')
    expect(wrapper.find('[data-testid="pomodoro-mini-circle-area"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="disc-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pill-stub"]').exists()).toBe(true)

    const pill = wrapper.get('[data-testid="pomodoro-mini-pill"]')
    expect(pill.attributes('aria-hidden')).toBe('true')
    expect(pill.attributes('inert')).toBeDefined()
  })

  it('mantiene la pastilla mientras hay hover y la oculta un segundo después de salir', async () => {
    const wrapper = montar()
    const root = wrapper.get('[data-testid="pomodoro-mini"]')
    const pill = wrapper.get('[data-testid="pomodoro-mini-pill"]')
    await root.trigger('mouseenter')
    expect(pill.attributes('aria-hidden')).toBe('false')
    await vi.advanceTimersByTimeAsync(2000)
    expect(pill.attributes('aria-hidden')).toBe('false')
    expect(h.applyShape).toHaveBeenLastCalledWith(1)
    await root.trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(999)
    expect(pill.attributes('aria-hidden')).toBe('false')
    await vi.advanceTimersByTimeAsync(1)
    expect(pill.attributes('aria-hidden')).toBe('true')
    await vi.advanceTimersByTimeAsync(250)
    expect(h.applyShape).toHaveBeenLastCalledWith(0)
    wrapper.unmount()
  })

  it('permite cruzar el espacio entre disco y pastilla sin ocultarla', async () => {
    const wrapper = montar()
    const root = wrapper.get('[data-testid="pomodoro-mini"]')
    await root.trigger('mouseenter')
    await root.trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(400)
    await root.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(1200)
    expect(wrapper.get('[data-testid="pomodoro-mini-pill"]').attributes('aria-hidden')).toBe(
      'false'
    )
    wrapper.unmount()
  })

  it('no oculta los controles mientras el teclado tiene foco dentro', async () => {
    const wrapper = montar()
    const root = wrapper.get('[data-testid="pomodoro-mini"]')
    await root.trigger('focusin')
    await root.trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.get('[data-testid="pomodoro-mini-pill"]').attributes('inert')).toBeUndefined()
    await root.trigger('focusout')
    await vi.advanceTimersByTimeAsync(1250)
    expect(wrapper.get('[data-testid="pomodoro-mini-pill"]').attributes('aria-hidden')).toBe('true')
    wrapper.unmount()
  })

  it('oculta la pastilla al salir y cambiar de aplicación aunque el control conserve foco DOM', async () => {
    const wrapper = montar()
    const root = wrapper.get('[data-testid="pomodoro-mini"]')
    await root.trigger('focusin')
    await root.trigger('mouseleave')
    window.dispatchEvent(new Event('blur'))
    await vi.advanceTimersByTimeAsync(1300)
    expect(wrapper.get('[data-testid="pomodoro-mini-pill"]').attributes('inert')).toBeDefined()
    expect(h.applyShape).toHaveBeenLastCalledWith(0)
  })

  it('cancela el ocultamiento y la animación al desmontar', async () => {
    const wrapper = montar()
    const root = wrapper.get('[data-testid="pomodoro-mini"]')
    await root.trigger('mouseenter')
    await root.trigger('mouseleave')
    wrapper.unmount()
    h.applyShape.mockClear()
    await vi.advanceTimersByTimeAsync(2000)
    expect(h.applyShape).not.toHaveBeenCalled()
  })

  it('usa la salida nativa cuando WebKitGTK no emite mouseleave', async () => {
    const wrapper = montar()
    await wrapper.get('[data-testid="pomodoro-mini"]').trigger('mouseenter')
    h.pointer?.(false)
    await vi.advanceTimersByTimeAsync(1300)
    expect(wrapper.get('[data-testid="pomodoro-mini-pill"]').attributes('aria-hidden')).toBe('true')
    wrapper.unmount()
    expect(h.unlisten).toHaveBeenCalledTimes(1)
    expect(h.unlistenScale).toHaveBeenCalledTimes(1)
  })

  it('respeta movimiento reducido sin frames de animación', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )
    const wrapper = montar()
    await wrapper.get('[data-testid="pomodoro-mini"]').trigger('mouseenter')
    expect(h.applyShape).toHaveBeenLastCalledWith(1)
    const calls = h.applyShape.mock.calls.length
    await vi.advanceTimersByTimeAsync(300)
    expect(h.applyShape).toHaveBeenCalledTimes(calls)
  })

  it('usa un anillo más grueso para que el borde se vea en el disco chico', () => {
    const wrapper = montar()

    expect(wrapper.get('[data-testid="disc-stub"]').attributes('ring-width')).toBe('4')
  })

  it('inicia el arrastre nativo desde el disco sin ocultar la pastilla', async () => {
    const wrapper = montar()

    await wrapper
      .get('[data-testid="pomodoro-mini-circle-area"]')
      .trigger('mousedown', { button: 0 })
    window.dispatchEvent(new MouseEvent('mouseup'))

    expect(h.startDragging).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="pill-stub"]').exists()).toBe(true)
  })

  it('no inicia el arrastre desde botones, controles ni el contador', async () => {
    const wrapper = montar()

    for (const testid of [
      'pomodoro-mini-reset',
      'pomodoro-mini-toggle',
      'pomodoro-mini-countdown',
    ]) {
      await wrapper.get(`[data-testid="${testid}"]`).trigger('mousedown', { button: 0 })
    }

    expect(h.startDragging).not.toHaveBeenCalled()
  })

  it('ignora botones que no son el principal', async () => {
    const wrapper = montar()

    await wrapper
      .get('[data-testid="pomodoro-mini-circle-area"]')
      .trigger('mousedown', { button: 2 })

    expect(h.startDragging).not.toHaveBeenCalled()
  })

  it('conecta los controles de la pastilla con ir a la app y cerrar', async () => {
    const wrapper = montar()

    await wrapper.get('[data-testid="pill-go"]').trigger('click')
    await wrapper.get('[data-testid="pill-close"]').trigger('click')

    expect(h.showInMain).toHaveBeenCalledTimes(1)
    expect(h.closeWindow).toHaveBeenCalledTimes(1)
  })
})
