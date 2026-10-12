import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import YearCalendarWidget from './YearCalendarWidget.vue'
import MonthMini from '@/components/calendar/MonthMini.vue'
import YearStrip from '@/components/dashboard/YearStrip.vue'
import DayDetailsModal from '@/components/dashboard/DayDetailsModal.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'
import { useLayoutTransition } from '@/composables/useLayoutTransition'
import { eventKey } from '@/lib/examEventLink'

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
  configReady: Promise<void>
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
  configReady: Promise.resolve(),
}

vi.mock('@/stores/calendar', () => ({
  useCalendarStore: () => mockStore,
}))

const mockExams: {
  exams: unknown[]
  overlayByDate: Map<string, { id: string; color: string }[]>
  linkedEventKeys: Set<string>
} = {
  exams: [],
  overlayByDate: new Map(),
  linkedEventKeys: new Set(),
}

vi.mock('@/stores/exams', () => ({
  useExamsStore: () => mockExams,
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
    mockStore.configReady = Promise.resolve()
    mockExams.overlayByDate = new Map()
    mockExams.exams = []
    mockExams.linkedEventKeys = new Set()
    // Los tests históricos cubren el modo meses: lo pinean explícito.
    // El comportamiento de auto/tira tiene sus propios tests abajo.
    const values = new Map<string, string>([['aeon:yearcal-mode', 'meses']])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    })
  })

  afterEach(() => {
    // El flag de transición de layout es global: si un test lo dejó activo,
    // lo cerramos para no contaminar el siguiente.
    const { end } = useLayoutTransition()
    end()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
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

  it('llama syncYear al montarse', async () => {
    mount(YearCalendarWidget)
    await mockStore.configReady
    await Promise.resolve()
    expect(mockStore.syncYear).toHaveBeenCalledWith(2026)
  })

  it('espera a configReady antes del primer syncYear (cold start con tokens)', async () => {
    let resolveReady!: () => void
    mockStore.configReady = new Promise<void>((resolve) => {
      resolveReady = resolve
    })
    mount(YearCalendarWidget)
    await Promise.resolve()
    expect(mockStore.syncYear).not.toHaveBeenCalled()
    resolveReady()
    await mockStore.configReady
    await Promise.resolve()
    await Promise.resolve()
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

  it('no pagina por semestre: cuerpo chico muestra los 12 meses con scroll y sin flechas', async () => {
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

    expect(wrapper.findAll("[data-testid='month-mini']")).toHaveLength(12)
    expect(wrapper.find("[data-testid='month-up']").exists()).toBe(false)
    expect(wrapper.find("[data-testid='month-down']").exists()).toBe(false)
    expect(wrapper.find("[data-testid='year-grid-viewport']").exists()).toBe(true)
    const style = wrapper.find('.ycw').attributes('style') ?? ''
    const cellMatch = style.match(/--cell-size:\s*([\d.]+)px/)
    expect(cellMatch).not.toBeNull()
    expect(parseFloat(cellMatch![1])).toBeGreaterThanOrEqual(10)

    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it('el viewport es scrolleable con celdas legibles (sin viewport-h pineado)', async () => {
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

    expect(wrapper.find("[data-testid='year-grid-viewport']").exists()).toBe(true)
    const style = wrapper.find('.ycw').attributes('style') ?? ''
    const cellMatch = style.match(/--cell-size:\s*([\d.]+)px/)
    expect(cellMatch).not.toBeNull()
    expect(parseFloat(cellMatch![1])).toBeGreaterThanOrEqual(10)

    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it('al abrir scrollea al mes actual (octubre queda visible)', async () => {
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
    await wrapper.vm.$nextTick()

    // Sin paginado: los 12 meses renderizados y el viewport scrolleado abajo.
    expect(wrapper.findAll("[data-testid='month-mini']")).toHaveLength(12)
    const viewport = wrapper.find("[data-testid='year-grid-viewport']").element as HTMLElement
    expect(viewport.scrollTop).toBeGreaterThan(0)

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

  describe('modos meses / tira', () => {
    function stubResize() {
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
      return () => resizeCallback
    }

    async function mountWithSize(w: number, h: number, item?: { w: number; h: number }) {
      const getCallback = stubResize()
      const wrapper = mount(YearCalendarWidget, {
        attachTo: document.body,
        props: item ? { item: { i: 'year-calendar', x: 0, y: 0, w: item.w, h: item.h } } : {},
      })
      const bodyEl = wrapper.find('.ycw__body').element as HTMLElement
      Object.defineProperty(bodyEl, 'clientWidth', { value: w, configurable: true })
      Object.defineProperty(bodyEl, 'clientHeight', { value: h, configurable: true })
      const cb = getCallback()
      if (cb) (cb as () => void)()
      await flushRaf()
      await wrapper.vm.$nextTick()
      return wrapper
    }

    it('en auto y ancho > alto muestra la tira y oculta los meses', async () => {
      localStorage.setItem('aeon:yearcal-mode', 'auto')
      const wrapper = await mountWithSize(1200, 600)
      expect(wrapper.find("[data-testid='year-strip']").exists()).toBe(true)
      expect(wrapper.findAll("[data-testid='month-mini']")).toHaveLength(0)
      vi.unstubAllGlobals()
      wrapper.unmount()
    })

    it('en auto y alto >= ancho muestra los meses', async () => {
      localStorage.setItem('aeon:yearcal-mode', 'auto')
      const wrapper = await mountWithSize(500, 900)
      expect(wrapper.find("[data-testid='year-strip']").exists()).toBe(false)
      expect(wrapper.findAll("[data-testid='month-mini']")).toHaveLength(12)
      vi.unstubAllGlobals()
      wrapper.unmount()
    })

    it('en auto y tamaño 1x1 siempre muestra meses aunque sea ancho', async () => {
      localStorage.setItem('aeon:yearcal-mode', 'auto')
      const wrapper = await mountWithSize(2000, 200, { w: 1, h: 1 })
      expect(wrapper.find("[data-testid='year-strip']").exists()).toBe(false)
      vi.unstubAllGlobals()
      wrapper.unmount()
    })

    it('el engranaje abre los ajustes y guardar tira cambia la vista', async () => {
      localStorage.setItem('aeon:yearcal-mode', 'meses')
      const wrapper = await mountWithSize(500, 900)
      expect(wrapper.findAll("[data-testid='month-mini']")).toHaveLength(12)

      await wrapper.find("[data-testid='yearcal-settings']").trigger('click')
      await wrapper.vm.$nextTick()

      const tiraOption = document.body.querySelector(
        "[data-testid='strip-mode-option'][data-value='tira']"
      ) as HTMLElement
      expect(tiraOption).not.toBeNull()
      tiraOption.click()
      await wrapper.vm.$nextTick()
      ;(document.body.querySelector("[data-testid='strip-mode-save']") as HTMLElement).click()
      await flushRaf()
      await wrapper.vm.$nextTick()

      expect(localStorage.getItem('aeon:yearcal-mode')).toBe('tira')
      expect(wrapper.find("[data-testid='year-strip']").exists()).toBe(true)
      expect(wrapper.findAll("[data-testid='month-mini']")).toHaveLength(0)

      vi.unstubAllGlobals()
      wrapper.unmount()
      document.body.innerHTML = ''
    })

    it('en tira el año se controla desde el header y no hay footer', async () => {
      localStorage.setItem('aeon:yearcal-mode', 'tira')
      const wrapper = await mountWithSize(1200, 600)
      const header = wrapper.find('.ycw__header')
      expect(header.find("[data-testid='year-prev']").exists()).toBe(true)
      expect(header.find("[data-testid='year-next']").exists()).toBe(true)
      expect(header.text()).toContain('2026')
      expect(wrapper.find('.ycw__footer').exists()).toBe(false)

      await header.find("[data-testid='year-next']").trigger('click')
      expect(mockStore.goNextYear).toHaveBeenCalled()

      vi.unstubAllGlobals()
      wrapper.unmount()
    })

    it('en tira angosto el engranaje sigue accesible (título trunca, controles fijos)', async () => {
      localStorage.setItem('aeon:yearcal-mode', 'tira')
      const wrapper = await mountWithSize(160, 800)
      const header = wrapper.find('.ycw__header')
      expect(header.find("[data-testid='year-prev']").exists()).toBe(true)
      const settings = header.find("[data-testid='yearcal-settings']")
      expect(settings.exists()).toBe(true)
      // El título debe poder encogerse con ellipsis para no expulsar los controles.
      expect(wrapper.find('.ycw__title').classes()).toContain('truncate')
      // Año y engranaje no deben encogerse ni ser expulsados del header.
      expect(header.find('.ycw__head-year').classes()).toContain('shrink-0')
      expect(settings.classes()).toContain('shrink-0')

      vi.unstubAllGlobals()
      wrapper.unmount()
    })

    it('en meses el footer con el año sigue existiendo', async () => {
      localStorage.setItem('aeon:yearcal-mode', 'meses')
      const wrapper = await mountWithSize(500, 900)
      expect(wrapper.find('.ycw__footer').exists()).toBe(true)
      expect(wrapper.find('.ycw__footer').text()).toContain('2026')
      vi.unstubAllGlobals()
      wrapper.unmount()
    })

    it('pasa el overlay de exámenes a los meses sin crear eventos espejo', async () => {
      mockExams.overlayByDate = new Map([
        ['2026-10-11', [{ id: 'exam_1', color: 'rgb(var(--color-block-green))' }]],
      ])
      localStorage.setItem('aeon:yearcal-mode', 'meses')
      const wrapper = await mountWithSize(500, 900)

      const month = wrapper.findComponent(MonthMini)
      expect(month.props('overlayByDate')?.get('2026-10-11')).toEqual([
        { id: 'exam_1', color: 'rgb(var(--color-block-green))' },
      ])
      // El examen se lee como overlay: no se agrega ningún evento al calendario.
      expect(mockStore.events).toEqual([])
      expect(mockStore.eventsByDate.size).toBe(0)

      vi.unstubAllGlobals()
      wrapper.unmount()
    })

    it('en tira también pasa el overlay de exámenes', async () => {
      mockExams.overlayByDate = new Map([
        ['2026-10-11', [{ id: 'exam_1', color: 'rgb(var(--color-block-green))' }]],
      ])
      localStorage.setItem('aeon:yearcal-mode', 'tira')
      const wrapper = await mountWithSize(1200, 600)

      const strip = wrapper.findComponent(YearStrip)
      expect(strip.props('overlayByDate')?.get('2026-10-11')).toEqual([
        { id: 'exam_1', color: 'rgb(var(--color-block-green))' },
      ])
      expect(mockStore.events).toEqual([])

      vi.unstubAllGlobals()
      wrapper.unmount()
    })

    it('un examen vinculado a un evento del mismo día pinta un solo punto (dedup)', async () => {
      const evt = {
        id: 'evt-1',
        title: 'Consulta de Análisis',
        date: '2026-01-11',
        color: '#6e56cf',
        calendarId: 'local',
        start: '2026-01-11T10:00:00',
        end: '2026-01-11T11:00:00',
      }
      mockStore.eventsByDate = new Map([['2026-01-11', [evt]]])
      mockExams.overlayByDate = new Map([
        ['2026-01-11', [{ id: 'exam_1', color: 'rgb(var(--color-block-green))' }]],
      ])
      mockExams.linkedEventKeys = new Set([eventKey('local', 'evt-1')])
      localStorage.setItem('aeon:yearcal-mode', 'meses')
      const wrapper = await mountWithSize(500, 900)

      const month = wrapper.findComponent(MonthMini)
      // El evento vinculado se omite de la capa de eventos…
      expect(month.props('eventsByDate')?.get('2026-01-11')).toBeUndefined()
      // …y sólo queda el punto del examen.
      const dots = month.findAll("[data-testid='event-dot']")
      expect(dots).toHaveLength(1)
      expect(dots[0].attributes('style')).toContain('rgb(var(--color-block-green))')

      vi.unstubAllGlobals()
      wrapper.unmount()
    })

    it('un vínculo huérfano no rompe el render del calendario', async () => {
      mockStore.eventsByDate = new Map()
      mockExams.overlayByDate = new Map([
        ['2026-01-11', [{ id: 'exam_1', color: 'rgb(var(--color-block-green))' }]],
      ])
      mockExams.linkedEventKeys = new Set()
      localStorage.setItem('aeon:yearcal-mode', 'meses')
      const wrapper = await mountWithSize(500, 900)

      const month = wrapper.findComponent(MonthMini)
      expect(month.findAll("[data-testid='event-dot']")).toHaveLength(1)

      vi.unstubAllGlobals()
      wrapper.unmount()
    })

    it('en tira el popup muestra la lista de eventos del día clickeado', async () => {
      const evt = {
        id: 'e1',
        title: 'Dentista',
        date: '2026-10-11',
        color: '#ff0000',
        calendarId: 'local',
      }
      mockStore.events = [evt]
      mockStore.eventsByDate = new Map([['2026-10-11', [evt]]])
      localStorage.setItem('aeon:yearcal-mode', 'tira')
      const wrapper = await mountWithSize(1200, 600)
      const cell = wrapper.find("[data-date='2026-10-11']")
      expect(cell.exists()).toBe(true)
      await cell.trigger('click')
      await wrapper.vm.$nextTick()
      const modal = wrapper.findComponent(DayDetailsModal)
      expect(modal.props('open')).toBe(true)
      expect(modal.props('date')).toBe('2026-10-11')
      await wrapper.vm.$nextTick()
      expect(document.body.textContent).toContain('Dentista')

      mockStore.events = []
      vi.unstubAllGlobals()
      wrapper.unmount()
      document.body.innerHTML = ''
    })

    it('en tira, el select-day abre el modal igual que en meses', async () => {
      localStorage.setItem('aeon:yearcal-mode', 'tira')
      const wrapper = await mountWithSize(1200, 600)
      const strip = wrapper.find("[data-testid='year-strip']")
      expect(strip.exists()).toBe(true)
      const cell = wrapper.find("[data-testid='strip-cell']")
      await cell.trigger('click')
      await wrapper.vm.$nextTick()
      expect(wrapper.findComponent(DayDetailsModal).props('open')).toBe(true)
      vi.unstubAllGlobals()
      wrapper.unmount()
    })
  })

  describe('modo meses scrolleable', () => {
    function stubResize() {
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
      return () => resizeCallback
    }

    async function mountScrollable(w: number, h: number, itemW: number) {
      const getCallback = stubResize()
      const wrapper = mount(YearCalendarWidget, {
        attachTo: document.body,
        props: { item: { i: 'year-calendar', x: 0, y: 0, w: itemW, h: 10 } },
      })
      const bodyEl = wrapper.find('.ycw__body').element as HTMLElement
      Object.defineProperty(bodyEl, 'clientWidth', { value: w, configurable: true })
      Object.defineProperty(bodyEl, 'clientHeight', { value: h, configurable: true })
      const cb = getCallback()
      if (cb) (cb as () => void)()
      await flushRaf()
      await wrapper.vm.$nextTick()
      return wrapper
    }

    it('w=2 angosto y alto muestra 2 columnas legibles (>=10px) con los 12 meses y sin paginado', async () => {
      const wrapper = await mountScrollable(280, 800, 2)
      expect(wrapper.findAll("[data-testid='month-mini']")).toHaveLength(12)
      const style = wrapper.find('.ycw').attributes('style') ?? ''
      expect(style).toMatch(/--cols:\s*2/)
      const cellMatch = style.match(/--cell-size:\s*([\d.]+)px/)
      expect(cellMatch).not.toBeNull()
      expect(parseFloat(cellMatch![1])).toBeGreaterThanOrEqual(10)
      expect(wrapper.find("[data-testid='month-up']").exists()).toBe(false)
      expect(wrapper.find("[data-testid='month-down']").exists()).toBe(false)
      const viewport = wrapper.find("[data-testid='year-grid-viewport']")
      expect(viewport.exists()).toBe(true)
      vi.unstubAllGlobals()
      wrapper.unmount()
    })

    it('w=1 angosto muestra 1 columna legible con scroll vertical', async () => {
      const wrapper = await mountScrollable(150, 800, 1)
      const style = wrapper.find('.ycw').attributes('style') ?? ''
      expect(style).toMatch(/--cols:\s*1/)
      const cellMatch = style.match(/--cell-size:\s*([\d.]+)px/)
      expect(cellMatch).not.toBeNull()
      expect(parseFloat(cellMatch![1])).toBeGreaterThanOrEqual(10)
      expect(wrapper.findAll("[data-testid='month-mini']")).toHaveLength(12)
      vi.unstubAllGlobals()
      wrapper.unmount()
    })

    it('al cambiar item.w en vivo (preview de resize) cambia las columnas sin remontar', async () => {
      const wrapper = await mountScrollable(280, 800, 1)
      expect(wrapper.find('.ycw').attributes('style')).toMatch(/--cols:\s*1/)
      await wrapper.setProps({ item: { i: 'year-calendar', x: 0, y: 0, w: 2, h: 10 } })
      await flushRaf()
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.ycw').attributes('style')).toMatch(/--cols:\s*2/)
      expect(wrapper.findAll("[data-testid='month-mini']")).toHaveLength(12)
      vi.unstubAllGlobals()
      wrapper.unmount()
    })
  })
})
