import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import WeeklyScheduleWidget from './WeeklyScheduleWidget.vue'
import WeeklyScheduleGrid from './WeeklyScheduleGrid.vue'
import { useUiStore } from '@/stores/ui'
import { useWeeklyScheduleStore } from '@/stores/weeklySchedule'
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
const STUDY_MONDAY_SLOT_ID = '550e8400-e29b-41d4-a716-446655440004'
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
  start_minutes: 975, // 16:15
  end_minutes: 1020, // 17:00
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
// Estudio también los lunes 17:00–18:00: bloque compartido con varios horarios.
const STUDY_MONDAY_SLOT = {
  id: STUDY_MONDAY_SLOT_ID,
  block_id: STUDY_BLOCK_ID,
  day_of_week: 0,
  start_minutes: 1020, // 17:00
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

async function mountEditor(slots = [GYM_SLOT, STUDY_SLOT]) {
  vi.mocked(db.loadWeeklyScheduleSettings).mockResolvedValue({
    granularity_minutes: 30,
    week_starts_monday: true,
    enabled_days: [0, 1, 2, 3, 4, 5, 6],
  })
  vi.mocked(db.listScheduleBlocks).mockResolvedValue([GYM_BLOCK, STUDY_BLOCK])
  vi.mocked(db.listScheduleSlots).mockResolvedValue(slots)
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

async function moveTo(wrapper: ReturnType<typeof mount>, minutes: number, day = 0) {
  gestureHarness.callbacks!.onMove({ day, minutes, clientX: 120, clientY: 330 })
  await wrapper.vm.$nextTick()
}

async function endGesture(wrapper: ReturnType<typeof mount>) {
  gestureHarness.callbacks!.onEnd()
  await flushPromises()
  await wrapper.vm.$nextTick()
}

function badgeText(): string | null {
  return (
    document.body.querySelector('[data-testid="schedule-drag-badge"]')?.textContent?.trim() ?? null
  )
}

describe('WeeklyScheduleWidget · estirar ocurrencias en modo edición', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    gestureHarness.callbacks = null
    gestureHarness.beginCount = 0

    vi.mocked(db.updateScheduleSlot).mockImplementation(async (id, patch, updatedAt) => {
      const base = [GYM_SLOT, STUDY_SLOT, STUDY_MONDAY_SLOT].find((slot) => slot.id === id)!
      return { ...base, ...patch, updated_at: updatedAt }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useLayoutTransition().end()
    document.body.innerHTML = ''
  })

  it('ofrece manijas solo en los bordes superior e inferior de cada ocurrencia', async () => {
    const { wrapper } = await mountEditor()

    const tops = wrapper.findAll('[data-testid="schedule-resize-handle-top"]')
    const bottoms = wrapper.findAll('[data-testid="schedule-resize-handle-bottom"]')
    expect(tops).toHaveLength(2)
    expect(bottoms).toHaveLength(2)
    expect(tops.map((h) => h.attributes('data-slot-id'))).toEqual([GYM_SLOT_ID, STUDY_SLOT_ID])
    expect(bottoms.map((h) => h.attributes('data-slot-id'))).toEqual([GYM_SLOT_ID, STUDY_SLOT_ID])

    wrapper.unmount()
  })

  it('sin modo edición no hay manijas ni se inicia el gesto', async () => {
    const { wrapper, ui } = await mountEditor()
    ui.scheduleEditMode = false
    await nextTick()

    expect(wrapper.find('[data-testid="schedule-resize-handle-top"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="schedule-resize-handle-bottom"]').exists()).toBe(false)
    expect(gestureHarness.beginCount).toBe(0)

    wrapper.unmount()
  })

  it('estirar desde arriba mantiene fijo el borde de abajo y persiste los minutos exactos', async () => {
    const { wrapper } = await mountEditor()
    const original = blockByTitle(wrapper, 'Gimnasio')
    expect(stylePx(original, 'top')).toBe(75)
    expect(stylePx(original, 'height')).toBe(225)

    await startResize(wrapper, GYM_SLOT_ID, 'top')
    await moveTo(wrapper, 990) // 16:30

    const ghost = wrapper.find('[data-testid="schedule-drag-ghost"]')
    expect(ghost.exists()).toBe(true)
    // Arranca en 16:30 (30' × 5 px/min) y el borde de abajo sigue en 17:00.
    expect(stylePx(ghost, 'top')).toBeCloseTo(150, 5)
    expect(stylePx(ghost, 'height')).toBeCloseTo(150, 5)
    expect(badgeText()).toBe('16:30 → 17:00')

    await endGesture(wrapper)

    expect(db.updateScheduleSlot).toHaveBeenCalledTimes(1)
    expect(db.updateScheduleSlot).toHaveBeenCalledWith(
      GYM_SLOT_ID,
      { start_minutes: 990, end_minutes: 1020 },
      expect.any(String)
    )
    const store = useWeeklyScheduleStore()
    const gym = store.blocksWithSlots.find((b) => b.id === GYM_BLOCK_ID)!
    expect(gym.slots[0]).toMatchObject({ start_minutes: 990, end_minutes: 1020 })

    wrapper.unmount()
  })

  it('estirar desde abajo mantiene fijo el borde de arriba y persiste los minutos exactos', async () => {
    const { wrapper } = await mountEditor()

    await startResize(wrapper, GYM_SLOT_ID, 'bottom')
    await moveTo(wrapper, 1055) // 17:35

    const ghost = wrapper.find('[data-testid="schedule-drag-ghost"]')
    // El borde de arriba sigue en 16:15 y el de abajo cae en 17:35.
    expect(stylePx(ghost, 'top')).toBeCloseTo(75, 5)
    expect(stylePx(ghost, 'height')).toBeCloseTo(400, 5)
    expect(badgeText()).toBe('16:15 → 17:35')

    await endGesture(wrapper)

    expect(db.updateScheduleSlot).toHaveBeenCalledTimes(1)
    expect(db.updateScheduleSlot).toHaveBeenCalledWith(
      GYM_SLOT_ID,
      { start_minutes: 975, end_minutes: 1055 },
      expect.any(String)
    )

    wrapper.unmount()
  })

  it('no deja achicar por debajo de 5 minutos de duración', async () => {
    const { wrapper } = await mountEditor()

    await startResize(wrapper, GYM_SLOT_ID, 'top')
    await moveTo(wrapper, 1200) // muy por debajo del borde de abajo

    expect(badgeText()).toBe('16:55 → 17:00')

    await endGesture(wrapper)

    expect(db.updateScheduleSlot).toHaveBeenCalledWith(
      GYM_SLOT_ID,
      { start_minutes: 1015, end_minutes: 1020 },
      expect.any(String)
    )

    wrapper.unmount()
  })

  it('si el rango estirado se superpone vuelve a su lugar, avisa con qué bloque chocó y no persiste', async () => {
    const { wrapper } = await mountEditor([GYM_SLOT, STUDY_SLOT, STUDY_MONDAY_SLOT])
    const original = blockByTitle(wrapper, 'Gimnasio')
    expect(stylePx(original, 'height')).toBe(225)

    await startResize(wrapper, GYM_SLOT_ID, 'bottom')
    await moveTo(wrapper, 1030) // 17:10: invade el Estudio de las 17:00
    await endGesture(wrapper)

    expect(db.updateScheduleSlot).not.toHaveBeenCalled()
    const toast = document.body.querySelector('[data-testid="toast"]')
    expect(toast?.textContent).toContain('Estudio')

    const restored = blockByTitle(wrapper, 'Gimnasio')
    expect(stylePx(restored, 'top')).toBe(75)
    expect(stylePx(restored, 'height')).toBe(225)
    const store = useWeeklyScheduleStore()
    const gym = store.blocksWithSlots.find((b) => b.id === GYM_BLOCK_ID)!
    expect(gym.slots[0]).toMatchObject({ start_minutes: 975, end_minutes: 1020 })

    wrapper.unmount()
  })

  it('el cartelito de horas desaparece al salir del modo edición', async () => {
    const { wrapper, ui } = await mountEditor()
    await startResize(wrapper, GYM_SLOT_ID, 'bottom')
    await moveTo(wrapper, 1055)
    expect(badgeText()).not.toBeNull()

    ui.exitScheduleEditMode()
    await nextTick()

    expect(badgeText()).toBeNull()
    expect(wrapper.find('[data-testid="schedule-drag-ghost"]').exists()).toBe(false)
    expect(db.updateScheduleSlot).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})
