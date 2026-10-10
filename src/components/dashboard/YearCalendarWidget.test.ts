import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import YearCalendarWidget from './YearCalendarWidget.vue'
import MonthMini from '@/components/calendar/MonthMini.vue'
import DayDetailsModal from '@/components/dashboard/DayDetailsModal.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'
import { useLayoutTransition } from '@/composables/useLayoutTransition'

function flushRaf() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
}

const mockStore: {
  connected: boolean
  currentYear: number
  syncing: boolean
  syncError: string | null
  events: unknown[]
  eventsByDate: Map<unknown, unknown>
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  syncYear: ReturnType<typeof vi.fn>
  goNextYear: ReturnType<typeof vi.fn>
  goPrevYear: ReturnType<typeof vi.fn>
  loadPersistedConfig: ReturnType<typeof vi.fn>
} = {
  connected: false,
  currentYear: 2026,
  syncing: false,
  syncError: null,
  events: [],
  eventsByDate: new Map(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  syncYear: vi.fn().mockResolvedValue(undefined),
  goNextYear: vi.fn(),
  goPrevYear: vi.fn(),
  loadPersistedConfig: vi.fn().mockResolvedValue(undefined),
}

vi.mock('@/stores/calendar', () => ({
  useCalendarStore: () => mockStore,
}))

describe('YearCalendarWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockStore.currentYear = 2026
    mockStore.connected = false
    mockStore.syncing = false
    mockStore.eventsByDate = new Map()
    mockStore.syncError = null
  })

  afterEach(() => {
    // El flag de transición de layout es global: si un test lo dejó activo,
    // lo cerramos para no contaminar el siguiente.
    const { end } = useLayoutTransition()
    end()
  })

  it('renderiza 12 meses', async () => {
    let resizeCallback: (() => void) | null = null
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resizeCallback = callback
        }
        observe() {}
        disconnect() {}
      }
    )

    const wrapper = mount(YearCalendarWidget, { attachTo: document.body })
    const bodyEl = wrapper.find('.ycw__body').element as HTMLElement
    Object.defineProperty(bodyEl, 'clientWidth', { value: 1200, configurable: true })
    Object.defineProperty(bodyEl, 'clientHeight', { value: 900, configurable: true })

    if (resizeCallback) {
      ;(resizeCallback as () => void)()
    }
    await flushRaf()
    await wrapper.vm.$nextTick()

    const months = wrapper.findAll("[data-testid='month-mini']")
    expect(months).toHaveLength(12)

    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it('llama syncYear al montarse', () => {
    mount(YearCalendarWidget)
    expect(mockStore.syncYear).toHaveBeenCalledWith(2026)
  })

  it('renderiza el año actual en el header', () => {
    const wrapper = mount(YearCalendarWidget)
    expect(wrapper.text()).toContain('2026')
  })

  it('goNextYear se llama al hacer click en next', () => {
    const wrapper = mount(YearCalendarWidget)
    wrapper.find("[data-testid='year-next']").trigger('click')
    expect(mockStore.goNextYear).toHaveBeenCalled()
  })

  it('goPrevYear se llama al hacer click en prev', () => {
    const wrapper = mount(YearCalendarWidget)
    wrapper.find("[data-testid='year-prev']").trigger('click')
    expect(mockStore.goPrevYear).toHaveBeenCalled()
  })

  it('no muestra indicador de sync si syncing=false', () => {
    const wrapper = mount(YearCalendarWidget)
    expect(wrapper.find("[data-testid='sync-spinner']").exists()).toBe(false)
  })

  it('muestra spinner si syncing=true', () => {
    mockStore.syncing = true
    const wrapper = mount(YearCalendarWidget)
    expect(wrapper.find("[data-testid='sync-spinner']").exists()).toBe(true)
  })

  it('mantiene visible un error de sync existente al montarse', () => {
    mockStore.syncError = 'No se pudieron sincronizar 1 calendario'

    const wrapper = mount(YearCalendarWidget)

    expect(wrapper.find("[data-testid='sync-error']").text()).toContain('1 calendario')
  })

  it('usa el componente Container (bg-surface-1 border-hairline)', () => {
    const wrapper = mount(YearCalendarWidget)
    const container = wrapper.find("[data-testid='year-calendar-widget']")
    expect(container.exists()).toBe(true)
    expect(container.classes()).toContain('glass-soft')
    expect(container.classes()).toContain('border-hairline')
  })

  it('al emitir select-day en un mes, se abre el modal de detalles con la fecha seleccionada', async () => {
    let resizeCallback: (() => void) | null = null
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resizeCallback = callback
        }
        observe() {}
        disconnect() {}
      }
    )

    const wrapper = mount(YearCalendarWidget, { attachTo: document.body })
    const bodyEl = wrapper.find('.ycw__body').element as HTMLElement
    Object.defineProperty(bodyEl, 'clientWidth', { value: 1200, configurable: true })
    Object.defineProperty(bodyEl, 'clientHeight', { value: 900, configurable: true })

    if (resizeCallback) {
      ;(resizeCallback as () => void)()
    }
    await flushRaf()
    await wrapper.vm.$nextTick()

    const month = wrapper.findComponent(MonthMini)

    // El modal de detalles del día debe estar cerrado inicialmente
    expect(wrapper.findComponent(DayDetailsModal).props('open')).toBe(false)

    // Simular que el mes emite select-day
    await month.vm.$emit('select-day', '2026-07-22')
    await wrapper.vm.$nextTick()

    const modal = wrapper.findComponent(DayDetailsModal)
    expect(modal.props('open')).toBe(true)
    expect(modal.props('date')).toBe('2026-07-22')

    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it("muestra el título 'Calendario Anual' en el header", () => {
    const wrapper = mount(YearCalendarWidget)
    expect(wrapper.text()).toContain('Calendario Anual')
  })

  it('tiene el título alineado a la izquierda y conserva el spinner (ALINEACIÓN)', () => {
    mockStore.syncing = true
    const wrapper = mount(YearCalendarWidget)
    const header = wrapper.get('.ycw__header')
    const title = header.get('.ycw__title')

    expect(header.classes()).not.toContain('justify-center')
    expect(header.classes()).toContain('justify-start')
    expect(title.classes()).not.toContain('text-center')
    expect(title.classes()).toContain('text-left')
    expect(header.element.firstElementChild?.textContent).toContain('Calendario Anual')
    expect(header.find("[data-testid='sync-spinner']").exists()).toBe(true)
  })

  it('el título iguala al resto de los widgets (card-title, sin tamaño pineado)', () => {
    const wrapper = mount(YearCalendarWidget)
    const title = wrapper.get('.ycw__title')
    expect(title.classes()).toContain('text-card-title')
    // Sin override inline: el tamaño lo da la regla de widgets × --text-scale.
    expect(wrapper.get('.ycw__header').attributes('style') ?? '').not.toContain('--title-font-size')
    expect(wrapper.get('[data-testid="year-calendar-widget"]').classes()).toContain(
      'container-widget'
    )
  })

  it('no muestra flechas de paginación cuando caben los 12 meses', () => {
    const wrapper = mount(YearCalendarWidget)
    expect(wrapper.find("[data-testid='month-up']").exists()).toBe(false)
    expect(wrapper.find("[data-testid='month-down']").exists()).toBe(false)
  })

  it('muestra flechas de paginación cuando no caben los 12 meses', async () => {
    let resizeCallback: (() => void) | null = null
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resizeCallback = callback
        }
        observe() {
          // Llamar al callback inmediatamente para simular el resize
          if (resizeCallback) {
            setTimeout(() => resizeCallback!(), 0)
          }
        }
        disconnect() {}
      }
    )

    const wrapper = mount(YearCalendarWidget, { attachTo: document.body })
    const bodyEl = wrapper.find('.ycw__body').element as HTMLElement
    Object.defineProperty(bodyEl, 'clientWidth', { value: 300, configurable: true })
    Object.defineProperty(bodyEl, 'clientHeight', { value: 300, configurable: true })

    // Esperar a que el callback del ResizeObserver se ejecute y el recompute corra en rAF
    await new Promise((resolve) => setTimeout(resolve, 10))
    await flushRaf()
    await wrapper.vm.$nextTick()

    expect(wrapper.find("[data-testid='month-up']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='month-down']").exists()).toBe(true)

    vi.unstubAllGlobals()
  })

  it('el viewport calculado entra en el cuerpo medido (el último mes no se corta)', async () => {
    let resizeCallback: (() => void) | null = null
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resizeCallback = callback
        }
        observe() {}
        disconnect() {}
      }
    )

    const wrapper = mount(YearCalendarWidget, { attachTo: document.body })
    const bodyEl = wrapper.find('.ycw__body').element as HTMLElement
    Object.defineProperty(bodyEl, 'clientWidth', { value: 300, configurable: true })
    Object.defineProperty(bodyEl, 'clientHeight', { value: 300, configurable: true })

    if (resizeCallback) {
      ;(resizeCallback as () => void)()
    }
    await flushRaf()
    await wrapper.vm.$nextTick()

    const style = wrapper.find('.ycw').attributes('style') ?? ''
    const match = style.match(/--viewport-h:\s*([\d.]+)px/)
    expect(match).not.toBeNull()
    // Cromado: padding 2x4 + fila de etiquetas + margen de seguridad.
    expect(parseFloat(match![1])).toBeLessThanOrEqual(300 - 8 - 17 - 4)

    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it('arranca en el semestre del mes actual (octubre -> jul-dic)', async () => {
    const getMonthSpy = vi.spyOn(Date.prototype, 'getMonth').mockReturnValue(9)
    const getFullYearSpy = vi.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2026)
    mockStore.currentYear = 2026
    let resizeCallback: (() => void) | null = null
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resizeCallback = callback
        }
        observe() {}
        disconnect() {}
      }
    )

    const wrapper = mount(YearCalendarWidget, { attachTo: document.body })
    const bodyEl = wrapper.find('.ycw__body').element as HTMLElement
    Object.defineProperty(bodyEl, 'clientWidth', { value: 300, configurable: true })
    Object.defineProperty(bodyEl, 'clientHeight', { value: 500, configurable: true })

    if (resizeCallback) {
      ;(resizeCallback as () => void)()
    }
    await flushRaf()
    await wrapper.vm.$nextTick()

    // Offset inicial 6/6: ya estamos al final, se puede subir pero no bajar.
    const up = wrapper.find("[data-testid='month-up']")
    const down = wrapper.find("[data-testid='month-down']")
    expect(up.exists()).toBe(true)
    expect(down.exists()).toBe(true)
    expect(up.attributes('disabled')).toBeUndefined()
    expect(down.attributes('disabled')).not.toBeUndefined()

    getMonthSpy.mockRestore()
    getFullYearSpy.mockRestore()
    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it('difiere el recompute a rAF y no vuelve a calcular en cada frame del resize', async () => {
    let resizeCallback: (() => void) | null = null
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resizeCallback = callback
        }
        observe() {}
        disconnect() {}
      }
    )

    const wrapper = mount(YearCalendarWidget, { attachTo: document.body })
    const bodyEl = wrapper.find('.ycw__body').element as HTMLElement
    Object.defineProperty(bodyEl, 'clientWidth', { value: 1200, configurable: true })
    Object.defineProperty(bodyEl, 'clientHeight', { value: 900, configurable: true })

    if (resizeCallback) {
      ;(resizeCallback as () => void)()
    }
    await wrapper.vm.$nextTick()

    // Sin que pase un frame, el layout aún no se aplicó al DOM
    expect(wrapper.findAll("[data-testid='month-mini']")).toHaveLength(0)

    // Al avanzar el frame, el recompute pendiente corre una sola vez
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll("[data-testid='month-mini']")).toHaveLength(12)

    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it('forces layout columns to match the dashboard item width', async () => {
    let resizeCallback: (() => void) | null = null
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resizeCallback = callback
        }
        observe() {
          if (resizeCallback) {
            setTimeout(() => resizeCallback!(), 0)
          }
        }
        disconnect() {}
      }
    )

    const item = {
      i: 'year-calendar',
      x: 0,
      y: 7,
      w: 2, // 2 columns
      h: 5,
    }

    const wrapper = mount(YearCalendarWidget, {
      props: { item },
      attachTo: document.body,
    })
    const bodyEl = wrapper.find('.ycw__body').element as HTMLElement
    Object.defineProperty(bodyEl, 'clientWidth', { value: 600, configurable: true })
    Object.defineProperty(bodyEl, 'clientHeight', { value: 800, configurable: true })

    await new Promise((resolve) => setTimeout(resolve, 10))
    await flushRaf()
    await wrapper.vm.$nextTick()

    const root = wrapper.find('.ycw')
    const style = root.attributes('style')
    expect(style).toContain('--cols:')
    // Algorithm chooses optimal column count based on available space
    const colsMatch = style!.match(/--cols:\s*(\d+)/)
    expect(colsMatch).not.toBeNull()
    const cols = parseInt(colsMatch![1])
    expect(cols).toBeGreaterThanOrEqual(1)
    expect(cols).toBeLessThanOrEqual(4)

    vi.unstubAllGlobals()
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const wrapper = mount(YearCalendarWidget)
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })

  it('difiere el recompute durante una transición de layout y lo corre una sola vez al terminar', async () => {
    let resizeCallback: (() => void) | null = null
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resizeCallback = callback
        }
        observe() {}
        disconnect() {}
      }
    )

    const { start, end } = useLayoutTransition()
    start()

    const fireResize = () => {
      if (resizeCallback) (resizeCallback as () => void)()
    }

    const wrapper = mount(YearCalendarWidget, { attachTo: document.body })
    const bodyEl = wrapper.find('.ycw__body').element as HTMLElement
    Object.defineProperty(bodyEl, 'clientWidth', { value: 1200, configurable: true })
    Object.defineProperty(bodyEl, 'clientHeight', { value: 900, configurable: true })

    // Resize durante la transición: el recompute queda deferido, el DOM no cambia
    fireResize()
    await flushRaf()
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll("[data-testid='month-mini']")).toHaveLength(0)

    // Varios resizes más durante la transición: siguen deferidos
    fireResize()
    fireResize()
    await flushRaf()
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll("[data-testid='month-mini']")).toHaveLength(0)

    // Al terminar la transición: un único recompute con el último tamaño
    end()
    await flushRaf()
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll("[data-testid='month-mini']")).toHaveLength(12)

    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it('no difiere el recompute cuando no hay transición de layout', async () => {
    let resizeCallback: (() => void) | null = null
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resizeCallback = callback
        }
        observe() {}
        disconnect() {}
      }
    )

    const wrapper = mount(YearCalendarWidget, { attachTo: document.body })
    const bodyEl = wrapper.find('.ycw__body').element as HTMLElement
    Object.defineProperty(bodyEl, 'clientWidth', { value: 1200, configurable: true })
    Object.defineProperty(bodyEl, 'clientHeight', { value: 900, configurable: true })

    if (resizeCallback) {
      ;(resizeCallback as () => void)()
    }
    await flushRaf()
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll("[data-testid='month-mini']")).toHaveLength(12)

    vi.unstubAllGlobals()
    wrapper.unmount()
  })
})
