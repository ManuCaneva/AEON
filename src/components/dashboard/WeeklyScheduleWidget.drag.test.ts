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

const dragHarness = vi.hoisted(() => ({
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
    dragHarness.callbacks = callbacks
    return {
      begin: () => {
        dragHarness.beginCount += 1
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

async function mountEditor(enabledDays = [0, 1, 2, 3, 4, 5, 6]) {
  vi.mocked(db.loadWeeklyScheduleSettings).mockResolvedValue({
    granularity_minutes: 30,
    week_starts_monday: true,
    enabled_days: enabledDays,
  })
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

async function startDrag(wrapper: ReturnType<typeof mount>, title: string) {
  const block = blockByTitle(wrapper, title)
  await block.trigger('pointerdown', { button: 0, clientX: 10, clientY: 10 })
  expect(dragHarness.beginCount).toBe(1)
  dragHarness.callbacks!.onStart()
  await wrapper.vm.$nextTick()
  return block
}

async function moveTo(wrapper: ReturnType<typeof mount>, day: number, minutes: number) {
  dragHarness.callbacks!.onMove({ day, minutes, clientX: 120, clientY: 330 })
  await wrapper.vm.$nextTick()
}

async function endDrag(wrapper: ReturnType<typeof mount>) {
  dragHarness.callbacks!.onEnd()
  await flushPromises()
  await wrapper.vm.$nextTick()
}

describe('WeeklyScheduleWidget · mover ocurrencias en modo edición', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    dragHarness.callbacks = null
    dragHarness.beginCount = 0

    vi.mocked(db.listScheduleBlocks).mockResolvedValue([GYM_BLOCK, STUDY_BLOCK])
    vi.mocked(db.listScheduleSlots).mockResolvedValue([GYM_SLOT, STUDY_SLOT])
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

  it('mueve a otro día y a un minuto exacto, y persiste al instante', async () => {
    const { wrapper } = await mountEditor()
    const original = await startDrag(wrapper, 'Gimnasio')
    expect(stylePx(original, 'top')).toBe(0)

    await moveTo(wrapper, 2, 995) // miércoles 16:35

    const ghost = wrapper.find('[data-testid="schedule-drag-ghost"]')
    expect(ghost.exists()).toBe(true)
    expect(ghost.text()).toContain('Gimnasio')
    // La posición sigue al puntero por minutos (16:35 → 35' × 5 px/min).
    expect(stylePx(ghost, 'top')).toBeCloseTo(175, 5)
    // La duración se conserva: 45'.
    expect(stylePx(ghost, 'height')).toBeCloseTo(225, 5)

    const badge = document.body.querySelector('[data-testid="schedule-drag-badge"]')
    expect(badge?.textContent?.trim()).toBe('16:35 → 17:20')

    await endDrag(wrapper)

    expect(db.updateScheduleSlot).toHaveBeenCalledTimes(1)
    expect(db.updateScheduleSlot).toHaveBeenCalledWith(
      GYM_SLOT_ID,
      { day_of_week: 2, start_minutes: 995, end_minutes: 1040 },
      expect.any(String)
    )
    expect(wrapper.find('[data-testid="schedule-drag-ghost"]').exists()).toBe(false)
    expect(document.body.querySelector('[data-testid="schedule-drag-badge"]')).toBeNull()

    const store = useWeeklyScheduleStore()
    const gym = store.blocksWithSlots.find((b) => b.id === GYM_BLOCK_ID)!
    expect(gym.slots[0]).toMatchObject({ day_of_week: 2, start_minutes: 995, end_minutes: 1040 })

    wrapper.unmount()
  })

  it('desaparece el cartelito al salir del modo edición', async () => {
    const { wrapper, ui } = await mountEditor()
    await startDrag(wrapper, 'Gimnasio')
    await moveTo(wrapper, 2, 995)
    expect(document.body.querySelector('[data-testid="schedule-drag-badge"]')).not.toBeNull()

    ui.exitScheduleEditMode()
    await nextTick()

    expect(document.body.querySelector('[data-testid="schedule-drag-badge"]')).toBeNull()
    expect(wrapper.find('[data-testid="schedule-drag-ghost"]').exists()).toBe(false)
    expect(db.updateScheduleSlot).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('si el destino está ocupado vuelve a su lugar, avisa con qué bloque chocó y no persiste', async () => {
    const { wrapper } = await mountEditor()
    const original = await startDrag(wrapper, 'Gimnasio')
    expect(stylePx(original, 'top')).toBe(0)

    await moveTo(wrapper, 3, 995) // jueves 16:35–17:20, choca con Estudio (16:00–18:00)
    await endDrag(wrapper)

    expect(db.updateScheduleSlot).not.toHaveBeenCalled()
    const toast = document.body.querySelector('[data-testid="toast"]')
    expect(toast?.textContent).toContain('Estudio')
    expect(wrapper.find('[data-testid="schedule-drag-ghost"]').exists()).toBe(false)

    // El bloque vuelve a su lugar original (lunes 16:00) sin persistir.
    const restored = blockByTitle(wrapper, 'Gimnasio')
    expect(stylePx(restored, 'top')).toBe(0)
    const store = useWeeklyScheduleStore()
    const gym = store.blocksWithSlots.find((b) => b.id === GYM_BLOCK_ID)!
    expect(gym.slots[0]).toMatchObject({ day_of_week: 0, start_minutes: 960, end_minutes: 1005 })

    wrapper.unmount()
  })

  it('no acepta un día deshabilitado como destino', async () => {
    const { wrapper } = await mountEditor([0, 1, 2, 3, 4]) // sin fin de semana
    await startDrag(wrapper, 'Gimnasio')

    await moveTo(wrapper, 5, 995) // sábado
    await endDrag(wrapper)

    expect(db.updateScheduleSlot).not.toHaveBeenCalled()
    const store = useWeeklyScheduleStore()
    const gym = store.blocksWithSlots.find((b) => b.id === GYM_BLOCK_ID)!
    expect(gym.slots[0]).toMatchObject({ day_of_week: 0, start_minutes: 960 })

    wrapper.unmount()
  })

  it('sin modo edición no se inicia el arrastre', async () => {
    const { wrapper, ui } = await mountEditor()
    ui.scheduleEditMode = false
    await nextTick()

    await blockByTitle(wrapper, 'Gimnasio').trigger('pointerdown', {
      button: 0,
      clientX: 10,
      clientY: 10,
    })

    expect(dragHarness.beginCount).toBe(0)

    wrapper.unmount()
  })
})
