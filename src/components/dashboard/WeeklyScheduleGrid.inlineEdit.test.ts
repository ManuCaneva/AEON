import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import WeeklyScheduleWidget from './WeeklyScheduleWidget.vue'
import WeeklyScheduleGrid from './WeeklyScheduleGrid.vue'
import { useWeeklyScheduleStore } from '@/stores/weeklySchedule'
import { useUiStore } from '@/stores/ui'
import * as db from '@/lib/db'
import { hasRawPaletteColor } from '@/test/colorGuard'

vi.mock('@/lib/db', () => ({
  listScheduleBlocks: vi.fn().mockResolvedValue([]),
  listScheduleSlots: vi.fn().mockResolvedValue([]),
  createScheduleBlock: vi.fn(),
  createScheduleSlot: vi.fn(),
  updateScheduleBlock: vi.fn(),
  updateScheduleSlot: vi.fn(),
  deleteScheduleBlock: vi.fn().mockResolvedValue(undefined),
  deleteScheduleSlot: vi.fn().mockResolvedValue(undefined),
  loadWeeklyScheduleSettings: vi.fn().mockResolvedValue({
    granularity_minutes: 30,
    week_starts_monday: true,
    enabled_days: [0, 1, 2, 3, 4, 5, 6],
  }),
  saveWeeklyScheduleSettings: vi.fn(),
}))

const TS = '2026-07-12T19:00:00.000Z'
const CONTAINER_HEIGHT = 400

function makeUuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

interface FixtureSlot {
  id: string
  block_id: string
  day_of_week: number
  start_minutes: number
  end_minutes: number
  created_at: string
  updated_at: string
}

function makeFixtureBlock(
  id: number,
  slots: { day: number; start: number; end: number }[]
): { block: ReturnType<typeof blockRow>; slots: FixtureSlot[] } {
  const block = blockRow(id)
  return {
    block,
    slots: slots.map((slot, index) => ({
      id: makeUuid(100 + id * 10 + index),
      block_id: block.id,
      day_of_week: slot.day,
      start_minutes: slot.start,
      end_minutes: slot.end,
      created_at: TS,
      updated_at: TS,
    })),
  }
}

function blockRow(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id: makeUuid(id),
    title: 'Gimnasio',
    color: 'lavender',
    sort_order: 0,
    created_at: TS,
    updated_at: TS,
    ...overrides,
  }
}

function stylePx(el: { attributes: (name: string) => string | undefined }, prop: string): number {
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

let store: ReturnType<typeof useWeeklyScheduleStore>

async function mountWidget(): Promise<VueWrapper> {
  const triggerResize = stubResizeObserver()
  const wrapper = mount(WeeklyScheduleWidget, { attachTo: document.body })
  await flushPromises()

  const gridEl = wrapper.findComponent(WeeklyScheduleGrid).element as HTMLElement
  vi.spyOn(gridEl, 'getBoundingClientRect').mockReturnValue({
    height: CONTAINER_HEIGHT,
    width: 900,
  } as DOMRect)
  const header = wrapper.find('.schedule-header').element as HTMLElement
  vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({
    height: 0,
    width: 900,
  } as DOMRect)
  triggerResize()
  await nextFrame()
  await nextTick()
  return wrapper
}

async function enableEditMode(wrapper: VueWrapper): Promise<void> {
  await wrapper.get('[data-testid="schedule-edit-toggle"]').trigger('click')
  await nextTick()
}

function mockColumnRect(column: { element: Element }) {
  vi.spyOn(column.element, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    height: CONTAINER_HEIGHT,
    width: 100,
    left: 0,
    right: 100,
    bottom: CONTAINER_HEIGHT,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)
}

async function doubleClickDay(wrapper: VueWrapper, day: number, clientY: number): Promise<void> {
  const column = wrapper.get(`[data-day="${day}"]`)
  mockColumnRect(column)
  await column.trigger('dblclick', { clientY })
  await flushPromises()
  await nextTick()
}

describe('Cronograma semanal — crear y renombrar en la grilla', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWeeklyScheduleStore()
    vi.clearAllMocks()
    vi.mocked(db.listScheduleBlocks).mockResolvedValue([])
    vi.mocked(db.listScheduleSlots).mockResolvedValue([])
    vi.mocked(db.createScheduleBlock).mockImplementation(
      async (draft, id, created_at, updated_at) => ({
        id,
        title: draft.title,
        color: draft.color,
        sort_order: draft.sort_order,
        created_at,
        updated_at,
      })
    )
    vi.mocked(db.createScheduleSlot).mockImplementation(
      async (draft, id, block_id, created_at, updated_at) => ({
        id,
        block_id,
        day_of_week: draft.day_of_week,
        start_minutes: draft.start_minutes,
        end_minutes: draft.end_minutes,
        created_at,
        updated_at,
      })
    )
    vi.mocked(db.updateScheduleBlock).mockImplementation(async (id, patch, updated_at) => {
      const current = store.blocksWithSlots.find((bw) => bw.id === id)
      if (!current) throw new Error('Bloque inexistente en el fixture')
      return {
        id,
        title: patch.title ?? current.title,
        color: patch.color ?? current.color,
        sort_order: patch.sort_order ?? current.sort_order,
        created_at: current.created_at,
        updated_at,
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('con doble click en un hueco crea una ocurrencia de una fila con nombre editable y color lavender', async () => {
    const wrapper = await mountWidget()
    await enableEditMode(wrapper)

    await doubleClickDay(wrapper, 1, 40) // 09:00 (fila 2 de la ventana 08:00–18:00)

    expect(db.createScheduleBlock).toHaveBeenCalledWith(
      { title: 'Sin título', color: 'lavender', sort_order: 0 },
      expect.any(String),
      expect.any(String),
      expect.any(String)
    )
    expect(db.createScheduleSlot).toHaveBeenCalledWith(
      { day_of_week: 1, start_minutes: 540, end_minutes: 570 },
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String)
    )
    expect(store.blocksWithSlots).toHaveLength(1)
    expect(store.blocksWithSlots[0].slots[0]).toMatchObject({
      day_of_week: 1,
      start_minutes: 540,
      end_minutes: 570,
    })

    // El nombre se edita ahí mismo, sin abrir el modal.
    const input = wrapper.get('[data-testid="schedule-name-input"]')
    expect((input.element as HTMLInputElement).value).toBe('Sin título')
    expect(document.activeElement).toBe(input.element)
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    // El editor del nombre es un control del modo: no se desatura.
    expect(input.element.closest('.grayscale')).toBeNull()

    // Alto de una fila, sin paleta de colores en la grilla.
    const block = wrapper.get('.schedule-block')
    const row = wrapper.findAll('.schedule-grid-row')[0]
    expect(stylePx(block, 'height')).toBeCloseTo(stylePx(row, 'height'), 5)
    expect(wrapper.find('input[type="color"]').exists()).toBe(false)
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)

    wrapper.unmount()
  })

  it('Enter confirma el nombre y lo persiste al instante', async () => {
    const wrapper = await mountWidget()
    await enableEditMode(wrapper)
    await doubleClickDay(wrapper, 1, 40)

    const input = wrapper.get('[data-testid="schedule-name-input"]')
    await input.setValue('Estudiar')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(db.updateScheduleBlock).toHaveBeenCalledWith(
      expect.any(String),
      { title: 'Estudiar' },
      expect.any(String)
    )
    expect(store.blocksWithSlots[0].title).toBe('Estudiar')
    expect(wrapper.find('[data-testid="schedule-name-input"]').exists()).toBe(false)
    expect(wrapper.get('.schedule-block-title').text()).toBe('Estudiar')

    wrapper.unmount()
  })

  it('Esc cancela y borra lo recién creado sin salir del modo edición', async () => {
    const wrapper = await mountWidget()
    await enableEditMode(wrapper)
    await doubleClickDay(wrapper, 2, 80) // 10:00

    const blockId = vi.mocked(db.createScheduleBlock).mock.calls[0]![1]
    const input = wrapper.get('[data-testid="schedule-name-input"]')
    await input.setValue('No va')
    await input.trigger('keydown', { key: 'Escape' })
    await flushPromises()

    expect(db.deleteScheduleBlock).toHaveBeenCalledWith(blockId)
    expect(store.blocksWithSlots).toHaveLength(0)
    expect(wrapper.find('[data-testid="schedule-name-input"]').exists()).toBe(false)
    expect(useUiStore().scheduleEditMode).toBe(true)

    wrapper.unmount()
  })

  it('click afuera confirma el nombre', async () => {
    const wrapper = await mountWidget()
    await enableEditMode(wrapper)
    await doubleClickDay(wrapper, 3, 0)

    const input = wrapper.get('[data-testid="schedule-name-input"]')
    await input.setValue('Yoga')
    await input.trigger('blur')
    await flushPromises()

    expect(store.blocksWithSlots[0].title).toBe('Yoga')
    expect(db.updateScheduleBlock).toHaveBeenCalledWith(
      expect.any(String),
      { title: 'Yoga' },
      expect.any(String)
    )
    expect(wrapper.find('[data-testid="schedule-name-input"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('un nombre vacío queda como "Sin título"', async () => {
    const wrapper = await mountWidget()
    await enableEditMode(wrapper)
    await doubleClickDay(wrapper, 4, 40)

    const input = wrapper.get('[data-testid="schedule-name-input"]')
    await input.setValue('   ')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(store.blocksWithSlots[0].title).toBe('Sin título')
    expect(wrapper.find('.schedule-block-title').text()).toBe('Sin título')
    expect(wrapper.find('[data-testid="schedule-name-input"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('doble click sobre un bloque separa solo esa ocurrencia al confirmar un nombre distinto', async () => {
    const fixture = makeFixtureBlock(1, [
      { day: 1, start: 540, end: 570 },
      { day: 3, start: 540, end: 570 },
      { day: 4, start: 540, end: 570 },
    ])
    vi.mocked(db.listScheduleBlocks).mockResolvedValue([fixture.block])
    vi.mocked(db.listScheduleSlots).mockResolvedValue(fixture.slots)

    const wrapper = await mountWidget()
    await enableEditMode(wrapper)

    const tuesday = wrapper.get('[data-day="1"]')
    await tuesday.get('.schedule-block').trigger('dblclick')

    const input = wrapper.get('[data-testid="schedule-name-input"]')
    expect((input.element as HTMLInputElement).value).toBe('Gimnasio')
    await input.setValue('Pesas')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // El bloque original conserva su nombre y sus otros dos horarios.
    expect(db.updateScheduleBlock).not.toHaveBeenCalled()
    expect(db.createScheduleBlock).toHaveBeenCalledTimes(1)
    expect(db.createScheduleBlock).toHaveBeenCalledWith(
      { title: 'Pesas', color: 'lavender', sort_order: 0 },
      expect.any(String),
      expect.any(String),
      expect.any(String)
    )
    const newBlockId = vi.mocked(db.createScheduleBlock).mock.calls[0][1]
    expect(db.createScheduleSlot).toHaveBeenCalledWith(
      { day_of_week: 1, start_minutes: 540, end_minutes: 570 },
      expect.any(String),
      newBlockId,
      expect.any(String),
      expect.any(String)
    )
    expect(db.deleteScheduleSlot).toHaveBeenCalledWith(fixture.slots[0].id)

    expect(store.blocksWithSlots).toHaveLength(2)
    const original = store.blocksWithSlots.find((bw) => bw.id === fixture.block.id)!
    expect(original.title).toBe('Gimnasio')
    expect(original.slots.map((s) => s.day_of_week)).toEqual([3, 4])
    const split = store.blocksWithSlots.find((bw) => bw.id === newBlockId)!
    expect(split.title).toBe('Pesas')
    expect(split.color).toBe('lavender')
    expect(split.slots.map((s) => s.day_of_week)).toEqual([1])

    const titles = wrapper.findAll('.schedule-block-title').map((t) => t.text())
    expect(titles).toEqual(['Pesas', 'Gimnasio', 'Gimnasio'])
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()

    wrapper.unmount()
  })

  it('con el nombre en edición, Esc cancela el nombre y no sale del modo edición', async () => {
    const fixture = makeFixtureBlock(1, [{ day: 1, start: 540, end: 570 }])
    vi.mocked(db.listScheduleBlocks).mockResolvedValue([fixture.block])
    vi.mocked(db.listScheduleSlots).mockResolvedValue(fixture.slots)

    const wrapper = await mountWidget()
    await enableEditMode(wrapper)

    await wrapper.get('[data-day="1"]').get('.schedule-block').trigger('dblclick')
    const input = wrapper.get('[data-testid="schedule-name-input"]')
    await input.setValue('Otro nombre')
    await input.trigger('keydown', { key: 'Escape' })
    await flushPromises()

    expect(wrapper.find('[data-testid="schedule-name-input"]').exists()).toBe(false)
    expect(store.blocksWithSlots[0].title).toBe('Gimnasio')
    expect(db.updateScheduleBlock).not.toHaveBeenCalled()
    expect(useUiStore().scheduleEditMode).toBe(true)

    wrapper.unmount()
  })

  it('con doble click en un hueco fuera del modo edición entra al modo y crea el bloque', async () => {
    const wrapper = await mountWidget()

    await doubleClickDay(wrapper, 1, 40)

    expect(useUiStore().scheduleEditMode).toBe(true)
    expect(db.createScheduleBlock).toHaveBeenCalledTimes(1)
    expect(store.blocksWithSlots[0].slots[0]).toMatchObject({
      day_of_week: 1,
      start_minutes: 540,
      end_minutes: 570,
    })
    const input = wrapper.get('[data-testid="schedule-name-input"]')
    expect((input.element as HTMLInputElement).value).toBe('Sin título')

    wrapper.unmount()
  })

  it('no crea un bloque encima de un horario ocupado', async () => {
    const fixture = makeFixtureBlock(1, [{ day: 1, start: 540, end: 570 }])
    vi.mocked(db.listScheduleBlocks).mockResolvedValue([fixture.block])
    vi.mocked(db.listScheduleSlots).mockResolvedValue(fixture.slots)

    const wrapper = await mountWidget()
    await enableEditMode(wrapper)

    await doubleClickDay(wrapper, 1, 40) // misma fila que el bloque existente

    expect(db.createScheduleBlock).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="schedule-name-input"]').exists()).toBe(false)

    wrapper.unmount()
  })
})
