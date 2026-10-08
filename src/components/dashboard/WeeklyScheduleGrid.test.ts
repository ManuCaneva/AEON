import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import WeeklyScheduleGrid from './WeeklyScheduleGrid.vue'
import WeeklyScheduleBlock from './WeeklyScheduleBlock.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'
import { useLayoutTransition } from '@/composables/useLayoutTransition'

function defaultBlocksWithSlots() {
  return [
    {
      id: '333e8400-e29b-41d4-a716-446655440000',
      title: 'Gimnasio',
      color: 'lavender',
      sort_order: 0,
      created_at: '2026-07-12T19:00:00.000Z',
      updated_at: '2026-07-12T19:00:00.000Z',
      slots: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          block_id: '333e8400-e29b-41d4-a716-446655440000',
          day_of_week: 1,
          start_minutes: 360,
          end_minutes: 420,
          created_at: '2026-07-12T19:00:00.000Z',
          updated_at: '2026-07-12T19:00:00.000Z',
        },
      ],
    },
  ]
}

const defaultSettings = () => ({
  granularity_minutes: 30,
  week_starts_monday: true,
  enabled_days: [0, 1, 2, 3, 4, 5, 6],
})

// Reactivo para que los tests puedan cambiar la Ventana visible con el
// componente montado y verificar el recálculo en vivo.
const mockStore = reactive({
  blocksWithSlots: defaultBlocksWithSlots(),
  settings: defaultSettings(),
  enabledDays: [0, 1, 2, 3, 4, 5, 6],
  visibleWindow: { start_minutes: 360, end_minutes: 1380 },
})

function stylePx(el: { attributes: (n: string) => string | undefined }, prop: string): number {
  const style = el.attributes('style') ?? ''
  const entry = style
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(prop + ':'))
  return Number.parseFloat(entry?.split(':')[1]?.trim() ?? '')
}

function nextFrame(): Promise<unknown> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
}

function stubResizeObserver() {
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
  return () => resizeCallback?.()
}

async function mountMeasured(
  containerHeight: number,
  headerHeight = 0,
  props: { now?: Date } = {}
) {
  const triggerResize = stubResizeObserver()
  const wrapper = mount(WeeklyScheduleGrid, { attachTo: document.body, props })
  const container = wrapper.element as HTMLElement
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
    height: containerHeight,
    width: 900,
  } as DOMRect)
  const header = wrapper.find('.schedule-header').element as HTMLElement
  vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({
    height: headerHeight,
    width: 900,
  } as DOMRect)
  triggerResize()
  await nextFrame()
  await wrapper.vm.$nextTick()
  return wrapper
}

vi.mock('@/stores/weeklySchedule', () => ({
  useWeeklyScheduleStore: () => mockStore,
  minutesToHHMM: (min: number) => {
    const h = Math.floor(min / 60)
    const m = min % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  },
}))

vi.mock('@/stores/ui', () => ({
  useUiStore: () => ({
    editMode: false,
  }),
}))

describe('WeeklyScheduleGrid', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockStore.blocksWithSlots = defaultBlocksWithSlots()
    mockStore.settings = defaultSettings()
    mockStore.visibleWindow = { start_minutes: 360, end_minutes: 1380 }
    mockStore.enabledDays = [0, 1, 2, 3, 4, 5, 6]
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    // El flag de transición de layout es global: si un test lo dejó activo,
    // lo cerramos para no contaminar el siguiente.
    useLayoutTransition().end()
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const wrapper = mount(WeeklyScheduleGrid)
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
    wrapper.unmount()
  })

  it('renderiza las columnas de los días de la semana', () => {
    const wrapper = mount(WeeklyScheduleGrid)
    expect(wrapper.text()).toContain('Lun')
    expect(wrapper.text()).toContain('Dom')
    wrapper.unmount()
  })

  it('renderiza las filas a partir de la Ventana visible derivada (no de settings)', () => {
    mockStore.visibleWindow = { start_minutes: 900, end_minutes: 960 }
    mockStore.settings.granularity_minutes = 30
    const wrapper = mount(WeeklyScheduleGrid)
    const labels = wrapper.findAll('.schedule-hour-label').map((w) => w.text())
    expect(labels).toEqual(['15:00', '15:30'])
    wrapper.unmount()
    mockStore.visibleWindow = { start_minutes: 360, end_minutes: 1380 }
  })

  it('difiere measure() a rAF: el resize del contenedor no vuelve a medir en cada frame', async () => {
    const triggerResize = stubResizeObserver()

    const wrapper = mount(WeeklyScheduleGrid, { attachTo: document.body })
    const el = wrapper.element
    const rect = { height: 500, width: 900 }
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect as DOMRect)

    // Llamadas repetidas del RO dentro del mismo frame: sin rAF, la medición
    // volvería a correr cada vez. Con rAF, se coalescen en una sola.
    triggerResize()
    triggerResize()
    triggerResize()
    await wrapper.vm.$nextTick()

    // Sin pasar un frame, la altura del container sigue siendo el valor por defecto
    const defaultHourHeight = wrapper.findAll('.schedule-hour-label')[0]?.attributes('style')
    expect(defaultHourHeight).toContain('height:')

    await nextFrame()
    await wrapper.vm.$nextTick()

    // Tras el rAF, las filas de hora se recalcularon con la altura real
    const hourHeight = wrapper.findAll('.schedule-hour-label')[0]?.attributes('style')
    expect(hourHeight).not.toBe(defaultHourHeight)
    wrapper.unmount()
  })

  it('difiere la medición durante una transición de layout y mide una sola vez al terminar', async () => {
    const triggerResize = stubResizeObserver()
    const { start, end } = useLayoutTransition()

    const wrapper = mount(WeeklyScheduleGrid, { attachTo: document.body })
    const el = wrapper.element
    const rect = { height: 500, width: 900 }
    const rectSpy = vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect as DOMRect)

    // Medición inicial sin transición: la grilla se acomoda a 500px
    triggerResize()
    await nextFrame()
    await wrapper.vm.$nextTick()
    const before = wrapper.findAll('.schedule-hour-label')[0]!.attributes('style')

    // Transición activa: resizes no miden (quedan deferidos)
    start()
    rectSpy.mockReturnValue({ height: 700, width: 900 } as DOMRect)
    triggerResize()
    triggerResize()
    await nextFrame()
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.schedule-hour-label')[0]!.attributes('style')).toBe(before)

    // Al terminar la transición: una única medición final con el último tamaño
    end()
    await nextFrame()
    await wrapper.vm.$nextTick()
    const after = wrapper.findAll('.schedule-hour-label')[0]!.attributes('style')
    expect(after).not.toBe(before)

    wrapper.unmount()
  })

  it('no difiere la medición cuando no hay transición de layout', async () => {
    const triggerResize = stubResizeObserver()

    const wrapper = mount(WeeklyScheduleGrid, { attachTo: document.body })
    const el = wrapper.element
    const rect = { height: 500, width: 900 }
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect as DOMRect)

    triggerResize()
    await nextFrame()
    await wrapper.vm.$nextTick()

    const hourHeight = wrapper.findAll('.schedule-hour-label')[0]?.attributes('style')
    expect(hourHeight).not.toContain('height: 400px')
    expect(hourHeight).toContain('height:')

    wrapper.unmount()
  })

  it('comprime la grilla a lo disponible sin piso mínimo: no scrollea con contenedor bajo', async () => {
    const rows = Math.floor(
      (mockStore.visibleWindow.end_minutes - mockStore.visibleWindow.start_minutes) /
        mockStore.settings.granularity_minutes
    )
    const containerHeight = 240
    const headerHeight = 32
    const wrapper = await mountMeasured(containerHeight, headerHeight)

    // La ventana visible no se recalcula al comprimir: siguen estando todas las filas
    expect(wrapper.findAll('.schedule-hour-label')).toHaveLength(rows)

    const first = wrapper.findAll('.schedule-hour-label')[0]!
    const rowHeight = stylePx(first, 'height')
    // Sin piso mínimo, cada fila mide exactamente (contenedor - header) / filas
    expect(rowHeight).toBeCloseTo((containerHeight - headerHeight) / rows, 5)
    // Header + grilla caben dentro del contenedor: no hay scroll posible
    expect(headerHeight + rowHeight * rows).toBeLessThanOrEqual(containerHeight + 0.01)
    expect(wrapper.find('.overflow-y-auto').exists()).toBe(false)

    wrapper.unmount()
  })

  it('centra el número de hora dentro de su celda', () => {
    mockStore.visibleWindow = { start_minutes: 900, end_minutes: 1200 }
    const wrapper = mount(WeeklyScheduleGrid)

    const labels = wrapper.findAll('.schedule-hour-label')
    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) {
      // El texto queda centrado verticalmente dentro de la franja horaria
      expect(label.classes()).toContain('items-center')
      expect(label.classes()).toContain('justify-center')
      const text = label.find('span')
      expect(text.exists()).toBe(true)
      expect(text.classes()).not.toContain('-translate-y-1/2')
    }

    wrapper.unmount()
  })

  it('usa la misma familia tipográfica que el resto en las etiquetas de hora', () => {
    const wrapper = mount(WeeklyScheduleGrid)
    const labels = wrapper.findAll('.schedule-hour-label')
    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) {
      expect(label.classes()).not.toContain('font-mono')
    }
    wrapper.unmount()
  })

  it('reserva un ancho mínimo para la columna de horas aunque el contenedor sea angosto', async () => {
    const triggerResize = stubResizeObserver()
    const wrapper = mount(WeeklyScheduleGrid, { attachTo: document.body })
    const container = wrapper.element as HTMLElement
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      height: 500,
      width: 500,
    } as DOMRect)
    triggerResize()
    await nextFrame()
    await wrapper.vm.$nextTick()

    const label = wrapper.find('.schedule-hour-label')
    const gutter = label.element.parentElement as HTMLElement
    const width = Number.parseFloat(gutter.style.width)
    // Mínimo legible para "15:00": con menos, el texto justificado a la
    // derecha desborda hacia la izquierda y queda pegado al borde.
    expect(width).toBeGreaterThanOrEqual(44)

    wrapper.unmount()
  })

  it('muestra un solo bloque con dos slots (lunes 15:50 y jueves 18:10) como un único título', () => {
    mockStore.blocksWithSlots = [
      {
        id: '333e8400-e29b-41d4-a716-446655440000',
        title: 'AACSW',
        color: 'cyan',
        sort_order: 0,
        created_at: '2026-07-12T19:00:00.000Z',
        updated_at: '2026-07-12T19:00:00.000Z',
        slots: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            block_id: '333e8400-e29b-41d4-a716-446655440000',
            day_of_week: 0,
            start_minutes: 950, // 15:50
            end_minutes: 1085, // 18:05
            created_at: '2026-07-12T19:00:00.000Z',
            updated_at: '2026-07-12T19:00:00.000Z',
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            block_id: '333e8400-e29b-41d4-a716-446655440000',
            day_of_week: 3,
            start_minutes: 1090, // 18:10
            end_minutes: 1225, // 20:25
            created_at: '2026-07-12T19:00:00.000Z',
            updated_at: '2026-07-12T19:00:00.000Z',
          },
        ],
      },
    ]
    mockStore.visibleWindow = { start_minutes: 900, end_minutes: 1260 } // 15:00-21:00
    const wrapper = mount(WeeklyScheduleGrid)

    const blocks = wrapper.findAll('.schedule-block')
    expect(blocks).toHaveLength(2)
    // Ambos slots son de la misma instancia AACSW
    blocks.forEach((b) => expect(b.text()).toContain('AACSW'))

    // Posicionamiento vertical por minutos: el slot de Lunes (15:50) empieza
    // antes que el de Jueves (18:10), por lo que su `top` es menor.
    const monday = blocks[0]
    const thursday = blocks[1]
    expect(stylePx(thursday, 'top')).toBeGreaterThan(stylePx(monday, 'top'))
    // Ambos duran 135' (15:50-18:05 y 18:10-20:25) → misma altura
    expect(stylePx(monday, 'height')).toBeGreaterThan(0)
    expect(stylePx(monday, 'height')).toBe(stylePx(thursday, 'height'))
    wrapper.unmount()
  })

  it('recorta en el borde un slot que cruza la Ventana visible en vez de ocultarlo', () => {
    mockStore.settings.granularity_minutes = 30
    mockStore.visibleWindow = { start_minutes: 900, end_minutes: 1200 } // 15:00-20:00
    mockStore.blocksWithSlots = [
      {
        id: '333e8400-e29b-41d4-a716-446655440000',
        title: 'Adentro',
        color: 'lavender',
        sort_order: 0,
        created_at: '2026-07-12T19:00:00.000Z',
        updated_at: '2026-07-12T19:00:00.000Z',
        slots: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            block_id: '333e8400-e29b-41d4-a716-446655440000',
            day_of_week: 0,
            start_minutes: 960, // 16:00
            end_minutes: 1020, // 17:00 (60' visibles, íntegro)
            created_at: '2026-07-12T19:00:00.000Z',
            updated_at: '2026-07-12T19:00:00.000Z',
          },
        ],
      },
      {
        id: '333e8400-e29b-41d4-a716-446655440001',
        title: 'Cruza abajo',
        color: 'green',
        sort_order: 0,
        created_at: '2026-07-12T19:00:00.000Z',
        updated_at: '2026-07-12T19:00:00.000Z',
        slots: [
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            block_id: '333e8400-e29b-41d4-a716-446655440001',
            day_of_week: 1,
            start_minutes: 1140, // 19:00
            end_minutes: 1260, // 21:00 (recortado a 20:00)
            created_at: '2026-07-12T19:00:00.000Z',
            updated_at: '2026-07-12T19:00:00.000Z',
          },
        ],
      },
      {
        id: '333e8400-e29b-41d4-a716-446655440002',
        title: 'Cruza arriba',
        color: 'red',
        sort_order: 0,
        created_at: '2026-07-12T19:00:00.000Z',
        updated_at: '2026-07-12T19:00:00.000Z',
        slots: [
          {
            id: '550e8400-e29b-41d4-a716-446655440003',
            block_id: '333e8400-e29b-41d4-a716-446655440002',
            day_of_week: 2,
            start_minutes: 840, // 14:00
            end_minutes: 960, // 16:00 (recortado a 15:00)
            created_at: '2026-07-12T19:00:00.000Z',
            updated_at: '2026-07-12T19:00:00.000Z',
          },
        ],
      },
    ]

    const wrapper = mount(WeeklyScheduleGrid)
    const blocks = wrapper.findAll('.schedule-block')
    expect(blocks).toHaveLength(3)

    const byTitle = new Map(
      blocks.map((b) => [b.text().trim(), b] as [string, (typeof blocks)[number]])
    )
    const inside = byTitle.get('Adentro')!
    const crossesBottom = byTitle.get('Cruza abajo')!
    const crossesTop = byTitle.get('Cruza arriba')!
    const insideHeight = stylePx(inside, 'height')
    expect(insideHeight).toBeGreaterThan(0)

    // El que cruza el borde inferior se dibuja recortado: misma altura que un
    // slot íntegro de 60' (visible 19:00-20:00 pese a durar hasta las 21:00).
    expect(stylePx(crossesBottom, 'height')).toBe(insideHeight)

    // El que cruza el borde superior se dibuja desde el borde (top 0) recortado
    expect(stylePx(crossesTop, 'top')).toBe(0)
    expect(stylePx(crossesTop, 'height')).toBe(insideHeight)
    wrapper.unmount()
  })

  describe('marca de hoy', () => {
    const TUESDAY = new Date(2026, 0, 6) // martes → índice 1

    function blocksOnDays(days: number[]) {
      return [
        {
          id: '333e8400-e29b-41d4-a716-446655440000',
          title: 'Bloque',
          color: 'lavender',
          sort_order: 0,
          created_at: '2026-07-12T19:00:00.000Z',
          updated_at: '2026-07-12T19:00:00.000Z',
          slots: days.map((day, i) => ({
            id: `550e8400-e29b-41d4-a716-44665544000${i}`,
            block_id: '333e8400-e29b-41d4-a716-446655440000',
            day_of_week: day,
            start_minutes: 600,
            end_minutes: 660,
            created_at: '2026-07-12T19:00:00.000Z',
            updated_at: '2026-07-12T19:00:00.000Z',
          })),
        },
      ]
    }

    it('marca header, columna y bloques solo del día de hoy con fecha inyectada', () => {
      mockStore.blocksWithSlots = blocksOnDays([0, 1])
      const wrapper = mount(WeeklyScheduleGrid, { props: { now: TUESDAY } })

      // (1) Header de hoy resaltado con accent tint; los demás, sin marcar
      const headers = wrapper.findAll('.schedule-day-label')
      expect(headers).toHaveLength(7)
      expect(wrapper.findAll('[data-testid="schedule-today-header"]')).toHaveLength(1)
      expect(headers[1].classes()).toContain('bg-accent-purple-tint')
      expect(headers[1].classes()).toContain('text-accent-purple')
      headers.forEach((h, i) => {
        if (i !== 1) expect(h.classes()).not.toContain('bg-accent-purple-tint')
      })

      // (2) Columna de hoy con fondo diferenciado; solo una marcada
      const todayCols = wrapper.findAll('[data-testid="schedule-today-column"]')
      expect(todayCols).toHaveLength(1)
      expect(todayCols[0].classes()).toContain('bg-accent-purple-tint/40')
      wrapper.findAll('.relative.border-r.border-hairline').forEach((col) => {
        if (!col.attributes('data-testid')) {
          expect(col.classes()).not.toContain('bg-accent-purple-tint/40')
        }
      })

      // (3) Los bloques de hoy reciben la prop today (hairline firme)
      const blocks = wrapper.findAllComponents(WeeklyScheduleBlock)
      expect(blocks).toHaveLength(2)
      const inToday = (b: (typeof blocks)[number]) =>
        b.element?.closest('[data-testid="schedule-today-column"]') !== null
      const todayBlock = blocks.find(inToday)!
      const otherBlock = blocks.find((b) => !inToday(b))!
      expect(todayBlock.props('today')).toBe(true)
      expect(otherBlock.props('today')).toBe(false)

      expect(hasRawPaletteColor(wrapper.html())).toBe(false)
      wrapper.unmount()
    })

    it('no marca nada cuando el día de hoy está deshabilitado', () => {
      mockStore.enabledDays = [0, 1, 2, 3, 4] // sin fin de semana
      const wrapper = mount(WeeklyScheduleGrid, { props: { now: new Date(2026, 0, 10) } }) // sábado

      expect(wrapper.findAll('.schedule-day-label')).toHaveLength(5)
      expect(wrapper.findAll('[data-testid="schedule-today-header"]')).toHaveLength(0)
      expect(wrapper.findAll('[data-testid="schedule-today-column"]')).toHaveLength(0)
      wrapper.findAll('.schedule-day-label').forEach((h) => {
        expect(h.classes()).not.toContain('bg-accent-purple-tint')
      })
      wrapper.unmount()
      mockStore.enabledDays = [0, 1, 2, 3, 4, 5, 6]
    })

    it('recalcula el marcaje al cambiar de día sin recargar la app', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
      try {
        vi.setSystemTime(new Date(2026, 0, 5, 23, 59)) // lunes 23:59
        const wrapper = mount(WeeklyScheduleGrid)
        expect(wrapper.findAll('[data-testid="schedule-today-header"]')[0]).toBeDefined()
        expect(wrapper.findAll('.schedule-day-label')[0].classes()).toContain(
          'bg-accent-purple-tint'
        )

        // Pasa la medianoche: el tick del intervalo actualiza el día marcado
        vi.advanceTimersByTime(60_000)
        await wrapper.vm.$nextTick()

        const headers = wrapper.findAll('.schedule-day-label')
        expect(headers[1].classes()).toContain('bg-accent-purple-tint')
        expect(headers[0].classes()).not.toContain('bg-accent-purple-tint')
        expect(wrapper.findAll('[data-testid="schedule-today-column"]')).toHaveLength(1)
        wrapper.unmount()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('línea de la hora actual', () => {
    const MORNING_WINDOW = { start_minutes: 480, end_minutes: 720 } // 08:00–12:00
    const MONDAY_9AM = new Date(2026, 0, 5, 9, 0) // lunes 09:00 → 540'

    beforeEach(() => {
      mockStore.visibleWindow = { ...MORNING_WINDOW }
      mockStore.settings.granularity_minutes = 30 // 8 filas de 30' sobre 600px → 2.5 px/min
    })

    it('cruza toda la grilla de días con una sola línea, sin marker', async () => {
      const wrapper = await mountMeasured(600, 0, { now: MONDAY_9AM })

      const line = wrapper.find('[data-testid="schedule-now-line"]')
      expect(line.exists()).toBe(true)
      expect(line.classes()).toContain('h-px')
      expect(line.classes()).toContain('bg-accent-purple/40')
      // De lado a lado: pegada a los bordes del contenedor de columnas
      expect(line.classes()).toContain('inset-x-0')
      expect(stylePx(line, 'top')).toBeCloseTo((540 - 480) * 2.5, 5)

      // Solo la línea: el marker sobre la columna de hoy no existe
      expect(wrapper.findAll('[data-testid="schedule-now-line"]')).toHaveLength(1)
      expect(wrapper.find('[data-testid="schedule-now-marker"]').exists()).toBe(false)

      expect(hasRawPaletteColor(wrapper.html())).toBe(false)
      wrapper.unmount()
    })

    it('no se dibuja cuando la hora actual queda fuera de la Ventana visible', async () => {
      const antes = await mountMeasured(600, 0, { now: new Date(2026, 0, 5, 7, 59) }) // 07:59
      expect(antes.find('[data-testid="schedule-now-line"]').exists()).toBe(false)
      antes.unmount()

      const despues = await mountMeasured(600, 0, { now: new Date(2026, 0, 5, 12, 0) }) // 12:00
      expect(despues.find('[data-testid="schedule-now-line"]').exists()).toBe(false)
      despues.unmount()
    })

    it('se dibuja en el borde superior cuando la hora es el inicio de la ventana', async () => {
      const wrapper = await mountMeasured(600, 0, { now: new Date(2026, 0, 5, 8, 0) }) // 08:00
      const line = wrapper.find('[data-testid="schedule-now-line"]')
      expect(line.exists()).toBe(true)
      expect(stylePx(line, 'top')).toBe(0)
      wrapper.unmount()
    })

    it('avanza sola cada 60 segundos sin interacción del usuario', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
      try {
        vi.setSystemTime(new Date(2026, 0, 5, 9, 0)) // lunes 09:00
        const wrapper = await mountMeasured(600, 0)
        const line = wrapper.find('[data-testid="schedule-now-line"]')
        expect(stylePx(line, 'top')).toBeCloseTo(150, 5)

        // El tick de 60 s refresca la hora y la línea desciende un minuto
        vi.advanceTimersByTime(60_000)
        await wrapper.vm.$nextTick()

        expect(stylePx(line, 'top')).toBeCloseTo(152.5, 5) // 09:01 → 61' × 2.5 px
        wrapper.unmount()
      } finally {
        vi.useRealTimers()
      }
    })

    it('recalcula la posición al cambiar la Ventana visible', async () => {
      const wrapper = await mountMeasured(600, 0, { now: MONDAY_9AM })
      const line = wrapper.find('[data-testid="schedule-now-line"]')
      expect(stylePx(line, 'top')).toBeCloseTo(150, 5)

      // 08:00–10:00: 4 filas de 30' sobre 600px → 5 px/min
      mockStore.visibleWindow = { start_minutes: 480, end_minutes: 600 }
      await wrapper.vm.$nextTick()
      expect(stylePx(line, 'top')).toBeCloseTo(300, 5) // 60' × 5 px

      // La hora queda fuera de la nueva ventana: la línea se oculta
      mockStore.visibleWindow = { start_minutes: 600, end_minutes: 720 }
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="schedule-now-line"]').exists()).toBe(false)
      wrapper.unmount()
    })
  })
})
