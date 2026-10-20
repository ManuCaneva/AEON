import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import WeeklyScheduleWidget from './WeeklyScheduleWidget.vue'
import WeeklyScheduleGrid from './WeeklyScheduleGrid.vue'
import { useUiStore } from '@/stores/ui'
import { useLayoutTransition } from '@/composables/useLayoutTransition'
import * as db from '@/lib/db'

const gestureHarness = vi.hoisted(() => ({
  callbacks: null as null | {
    onStart: () => void
    onMove: (point: { day: number; minutes: number; clientX: number; clientY: number }) => void
    onEnd: () => void
    onCancel: () => void
  },
  beginCount: 0,
}))

vi.mock('@/composables/useScheduleDrag', () => ({
  useScheduleDrag: (
    _grid: unknown,
    _enabled: unknown,
    _geometry: unknown,
    callbacks: {
      onStart: () => void
      onMove: (point: { day: number; minutes: number; clientX: number; clientY: number }) => void
      onEnd: () => void
      onCancel: () => void
    }
  ) => {
    gestureHarness.callbacks = callbacks
    return {
      begin: () => {
        gestureHarness.beginCount += 1
      },
    }
  },
}))

vi.mock('@/lib/db', () => ({
  listScheduleBlocks: vi.fn(),
  listScheduleSlots: vi.fn(),
  createScheduleBlock: vi.fn(),
  createScheduleSlot: vi.fn(),
  updateScheduleBlock: vi.fn(),
  updateScheduleSlot: vi.fn(),
  deleteScheduleBlock: vi.fn(),
  deleteScheduleSlot: vi.fn(),
  loadWeeklyScheduleSettings: vi.fn(),
  saveWeeklyScheduleSettings: vi.fn(),
}))

const GYM_BLOCK_ID = '333e8400-e29b-41d4-a716-446655440000'
const STUDY_BLOCK_ID = '333e8400-e29b-41d4-a716-446655440002'
const GYM_SLOT_ID = '550e8400-e29b-41d4-a716-446655440001'
const STUDY_SLOT_ID = '550e8400-e29b-41d4-a716-446655440003'
const ISO = '2026-07-12T19:00:00.000Z'

const GYM_BLOCK = {
  id: GYM_BLOCK_ID,
  title: 'Gimnasio',
  color: 'lavender',
  sort_order: 0,
  created_at: ISO,
  updated_at: ISO,
}
const STUDY_BLOCK = {
  id: STUDY_BLOCK_ID,
  title: 'Estudio',
  color: 'green',
  sort_order: 1,
  created_at: ISO,
  updated_at: ISO,
}
const GYM_SLOT = {
  id: GYM_SLOT_ID,
  block_id: GYM_BLOCK_ID,
  day_of_week: 0, // lunes
  start_minutes: 960, // 16:00
  end_minutes: 1005, // 16:45
  created_at: ISO,
  updated_at: ISO,
}
const STUDY_SLOT = {
  id: STUDY_SLOT_ID,
  block_id: STUDY_BLOCK_ID,
  day_of_week: 3, // jueves
  start_minutes: 960, // 16:00
  end_minutes: 1080, // 18:00
  created_at: ISO,
  updated_at: ISO,
}

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

async function mountEditor() {
  vi.mocked(db.loadWeeklyScheduleSettings).mockResolvedValue({
    granularity_minutes: 30,
    week_starts_monday: true,
    enabled_days: [0, 1, 2, 3, 4, 5, 6],
  })
  vi.mocked(db.listScheduleBlocks).mockResolvedValue([GYM_BLOCK, STUDY_BLOCK])
  vi.mocked(db.listScheduleSlots).mockResolvedValue([GYM_SLOT, STUDY_SLOT])
  const ui = useUiStore()
  ui.scheduleEditMode = true

  const triggerResize = stubResizeObserver()
  const wrapper = mount(WeeklyScheduleWidget, { attachTo: document.body })
  await flushPromises()

  const gridEl = wrapper.findComponent(WeeklyScheduleGrid).element as HTMLElement
  vi.spyOn(gridEl, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 700,
    height: 600,
  } as DOMRect)
  const daysGridEl = wrapper.get('[data-testid="schedule-days-grid"]').element as HTMLElement
  vi.spyOn(daysGridEl, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 700,
    bottom: 600,
    width: 700,
    height: 600,
  } as DOMRect)
  const headerEl = wrapper.get('.schedule-header').element as HTMLElement
  vi.spyOn(headerEl, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 700,
    height: 0,
  } as DOMRect)

  triggerResize()
  await nextFrame()
  await wrapper.vm.$nextTick()

  return { wrapper, ui }
}

function blockByTitle(
  wrapper: ReturnType<typeof mount>,
  title: string
): ReturnType<ReturnType<typeof mount>['findAll']>[number] {
  const block = wrapper.findAll('.schedule-block').find((b) => b.text().includes(title))
  if (!block) throw new Error(`No se encontró el bloque ${title}`)
  return block
}

async function startDrag(wrapper: ReturnType<typeof mount>, title: string) {
  const block = blockByTitle(wrapper, title)
  await block.trigger('pointerdown', { button: 0, clientX: 10, clientY: 10 })
  expect(gestureHarness.beginCount).toBe(1)
  gestureHarness.callbacks!.onStart()
  await wrapper.vm.$nextTick()
}

async function startResize(
  wrapper: ReturnType<typeof mount>,
  slotId: string,
  edge: 'top' | 'bottom'
) {
  const handle = wrapper.get(
    `[data-testid="schedule-resize-handle-${edge}"][data-slot-id="${slotId}"]`
  )
  await handle.trigger('pointerdown', { button: 0, clientX: 10, clientY: 10 })
  expect(gestureHarness.beginCount).toBe(1)
  gestureHarness.callbacks!.onStart()
  await wrapper.vm.$nextTick()
}

async function moveTo(
  wrapper: ReturnType<typeof mount>,
  minutes: number,
  clientY: number,
  day = 0
) {
  // La columna del puntero coincide con el día pedido (7 columnas de 100 px).
  gestureHarness.callbacks!.onMove({ day, minutes, clientX: day * 100 + 10, clientY })
  await wrapper.vm.$nextTick()
}

async function endGesture(wrapper: ReturnType<typeof mount>) {
  gestureHarness.callbacks!.onEnd()
  await flushPromises()
  await wrapper.vm.$nextTick()
}

function hourLabels(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper.findAll('.schedule-hour-label').map((label) => label.text())
}

describe('WeeklyScheduleWidget · bordes que crecen durante los gestos', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    gestureHarness.callbacks = null
    gestureHarness.beginCount = 0

    vi.mocked(db.updateScheduleSlot).mockImplementation(async (id, patch, updatedAt) => {
      const base = [GYM_SLOT, STUDY_SLOT].find((slot) => slot.id === id)!
      return { ...base, ...patch, updated_at: updatedAt }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useLayoutTransition().end()
    document.body.innerHTML = ''
  })

  it('mover cerca de arriba crece una hora y el bloque sigue al puntero', async () => {
    const { wrapper } = await mountEditor()
    expect(hourLabels(wrapper)[0]).toBe('16:00')

    await startDrag(wrapper, 'Gimnasio')
    await moveTo(wrapper, 1000, 10) // el puntero, no el minuto crudo, manda

    // La ventana se extiende de 16:00 a 15:00: una hora más, sin saltos.
    expect(hourLabels(wrapper)[0]).toBe('15:00')
    expect(hourLabels(wrapper)).toHaveLength(6)

    // El mismo puntero a 10 px del borde ahora cae en 15:03: el fantasma queda
    // a 10 px del borde (600 px / 180 min = 3,33 px/min), no despegado.
    const ghost = wrapper.find('[data-testid="schedule-drag-ghost"]')
    expect(stylePx(ghost, 'top')).toBeCloseTo(10, 5)

    await endGesture(wrapper)

    expect(db.updateScheduleSlot).toHaveBeenCalledWith(
      GYM_SLOT_ID,
      { day_of_week: 0, start_minutes: 903, end_minutes: 948 },
      expect.any(String)
    )
    expect(wrapper.find('[data-testid="schedule-drag-ghost"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('mover cerca de abajo crece una hora y el bloque sigue al puntero', async () => {
    const { wrapper } = await mountEditor()

    await startDrag(wrapper, 'Gimnasio')
    await moveTo(wrapper, 1000, 590)

    const labels = hourLabels(wrapper)
    expect(labels[labels.length - 1]).toBe('18:30')
    expect(labels).toHaveLength(6)

    const ghost = wrapper.find('[data-testid="schedule-drag-ghost"]')
    expect(stylePx(ghost, 'top')).toBeCloseTo(590, 5)

    await endGesture(wrapper)

    expect(db.updateScheduleSlot).toHaveBeenCalledWith(
      GYM_SLOT_ID,
      { day_of_week: 0, start_minutes: 1137, end_minutes: 1182 },
      expect.any(String)
    )

    wrapper.unmount()
  })

  it('crece de a una hora por acercamiento, no achica mientras se arrastra y al soltar vuelve al rango derivado', async () => {
    const { wrapper } = await mountEditor()

    await startDrag(wrapper, 'Gimnasio')

    await moveTo(wrapper, 1000, 10)
    expect(hourLabels(wrapper)[0]).toBe('15:00')

    await moveTo(wrapper, 1000, 20)
    // Dos acercamientos: dos horas, nunca más de una por vez.
    expect(hourLabels(wrapper)[0]).toBe('14:00')
    expect(hourLabels(wrapper)).toHaveLength(8)

    // Alejarse del borde no achica la ventana durante el gesto.
    await moveTo(wrapper, 960, 300)
    expect(hourLabels(wrapper)[0]).toBe('14:00')

    await endGesture(wrapper)

    // Al soltar, la ventana se deriva otra vez de los horarios (16:00–18:00).
    expect(hourLabels(wrapper)[0]).toBe('16:00')
    expect(hourLabels(wrapper)).toHaveLength(4)
    expect(db.updateScheduleSlot).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('estirar desde arriba cerca del borde superior crece una hora', async () => {
    const { wrapper } = await mountEditor()

    await startResize(wrapper, GYM_SLOT_ID, 'top')
    await moveTo(wrapper, 1000, 10)

    expect(hourLabels(wrapper)[0]).toBe('15:00')

    const ghost = wrapper.find('[data-testid="schedule-drag-ghost"]')
    expect(stylePx(ghost, 'top')).toBeCloseTo(10, 5)
    // La arista de abajo sigue anclada en 16:45.
    expect(stylePx(ghost, 'height')).toBeCloseTo((1005 - 903) * (600 / 180), 5)

    await endGesture(wrapper)

    expect(db.updateScheduleSlot).toHaveBeenCalledWith(
      GYM_SLOT_ID,
      { start_minutes: 903, end_minutes: 1005 },
      expect.any(String)
    )

    wrapper.unmount()
  })

  it('estirar desde abajo cerca del borde inferior crece una hora', async () => {
    const { wrapper } = await mountEditor()

    await startResize(wrapper, GYM_SLOT_ID, 'bottom')
    await moveTo(wrapper, 1000, 590)

    const labels = hourLabels(wrapper)
    expect(labels[labels.length - 1]).toBe('18:30')

    const ghost = wrapper.find('[data-testid="schedule-drag-ghost"]')
    expect(stylePx(ghost, 'top')).toBeCloseTo(0, 5)
    expect(stylePx(ghost, 'height')).toBeCloseTo((1137 - 960) * (600 / 180), 5)

    await endGesture(wrapper)

    expect(db.updateScheduleSlot).toHaveBeenCalledWith(
      GYM_SLOT_ID,
      { start_minutes: 960, end_minutes: 1137 },
      expect.any(String)
    )

    wrapper.unmount()
  })

  it('las filas animan el alto para que el crecimiento no sea un salto', async () => {
    const { wrapper } = await mountEditor()

    const rows = wrapper.findAll('.schedule-hour-label')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.classes()).toContain('transition-[height]')
    }

    wrapper.unmount()
  })
})
