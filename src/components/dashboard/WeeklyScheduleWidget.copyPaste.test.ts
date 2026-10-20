import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import WeeklyScheduleWidget from './WeeklyScheduleWidget.vue'
import WeeklyScheduleGrid from './WeeklyScheduleGrid.vue'
import { useUiStore } from '@/stores/ui'
import { useWeeklyScheduleStore } from '@/stores/weeklySchedule'
import { useLayoutTransition } from '@/composables/useLayoutTransition'
import * as db from '@/lib/db'

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
// La Ventana visible derivada va de 16:00 a 18:00: 4 filas de 30' a 150 px.
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

const DAY_RECT = {
  left: 0,
  top: 0,
  width: 100,
  height: 600,
  right: 100,
  bottom: 600,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as DOMRect

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

async function mountEditor(enabledDays = [0, 1, 2, 3, 4, 5, 6], editMode = true) {
  vi.mocked(db.listScheduleBlocks).mockResolvedValue([GYM_BLOCK, STUDY_BLOCK])
  vi.mocked(db.listScheduleSlots).mockResolvedValue([GYM_SLOT, STUDY_SLOT])
  vi.mocked(db.loadWeeklyScheduleSettings).mockResolvedValue({
    granularity_minutes: 30,
    week_starts_monday: true,
    enabled_days: enabledDays,
  })

  const ui = useUiStore()
  ui.scheduleEditMode = editMode

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

  for (const day of enabledDays) {
    const column = wrapper.get(`[data-day="${day}"]`)
    vi.spyOn(column.element, 'getBoundingClientRect').mockReturnValue(DAY_RECT)
  }

  return { wrapper, ui, store: useWeeklyScheduleStore() }
}

function blockAt(wrapper: VueWrapper, day: number) {
  return wrapper.get(`[data-day="${day}"]`).get('.schedule-block')
}

function press(key: string, init: KeyboardEventInit = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, ...init }))
}

async function hoverDay(wrapper: VueWrapper, day: number, clientX: number, clientY: number) {
  await wrapper.get(`[data-day="${day}"]`).trigger('pointermove', { clientX, clientY })
  await nextTick()
}

async function clickDay(wrapper: VueWrapper, day: number, clientX: number, clientY: number) {
  await wrapper.get(`[data-day="${day}"]`).trigger('click', { clientX, clientY })
  await flushPromises()
  await nextTick()
}

async function copyFromHover(wrapper: VueWrapper) {
  await blockAt(wrapper, 0).trigger('mouseenter')
  await wrapper.get('[data-testid="schedule-slot-copy"]').trigger('click')
  await nextTick()
}

async function copyFromShortcut(wrapper: VueWrapper) {
  await blockAt(wrapper, 0).trigger('click')
  press('c', { ctrlKey: true })
  await nextTick()
}

function ghost(): HTMLElement | null {
  return document.body.querySelector('[data-testid="schedule-paste-ghost"]')
}

function badgeText(): string | null {
  return (
    document.body.querySelector('[data-testid="schedule-drag-badge"]')?.textContent?.trim() ?? null
  )
}

function stylePx(el: HTMLElement, prop: string): number {
  const entry = (el.getAttribute('style') ?? '')
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(prop + ':'))
  return Number.parseFloat(entry?.split(':')[1]?.trim() ?? '')
}

describe('Cronograma semanal — copiar y pegar ocurrencias en modo edición', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
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
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useLayoutTransition().end()
    document.body.innerHTML = ''
  })

  it('el botón al hover copia y Ctrl/Cmd+V pega con un fantasma que sigue al mouse', async () => {
    const { wrapper } = await mountEditor()
    await blockAt(wrapper, 0).trigger('mouseenter')

    await copyFromHover(wrapper)
    press('v', { ctrlKey: true })
    await nextTick()

    await hoverDay(wrapper, 2, 300, 175) // miércoles 16:35

    const ghostEl = ghost()
    expect(ghostEl).not.toBeNull()
    expect(ghostEl!.textContent).toContain('Gimnasio')
    // El fantasma es translúcido y está enganchado al puntero.
    expect(ghostEl!.className).toContain('opacity-50')
    expect(stylePx(ghostEl!, 'left')).toBe(314)
    expect(stylePx(ghostEl!, 'top')).toBe(193)
    expect(badgeText()).toBe('16:35 → 17:20')

    await hoverDay(wrapper, 2, 400, 250)
    expect(stylePx(ghost()!, 'left')).toBe(414)
    expect(stylePx(ghost()!, 'top')).toBe(268)

    wrapper.unmount()
  })

  it('Ctrl/Cmd+C copia la ocurrencia elegida y el botón al hover inicia el pegado', async () => {
    const { wrapper } = await mountEditor()

    await copyFromShortcut(wrapper)
    await blockAt(wrapper, 0).trigger('mouseenter')
    const pasteButton = wrapper.get('[data-testid="schedule-slot-paste"]')
    expect(pasteButton.attributes('disabled')).toBeUndefined()

    await pasteButton.trigger('click')
    await hoverDay(wrapper, 4, 300, 175) // viernes 16:35

    expect(ghost()?.textContent).toContain('Gimnasio')
    expect(badgeText()).toBe('16:35 → 17:20')

    wrapper.unmount()
  })

  it('un click coloca un bloque nuevo independiente con el mismo título y color, id propio y un horario', async () => {
    const { wrapper, store } = await mountEditor()

    await copyFromShortcut(wrapper)
    press('v', { ctrlKey: true })
    await nextTick()
    await clickDay(wrapper, 2, 300, 175) // miércoles 16:35

    expect(db.createScheduleBlock).toHaveBeenCalledTimes(1)
    expect(db.createScheduleSlot).toHaveBeenCalledTimes(1)

    const pasted = store.blocksWithSlots.find(
      (bw) => bw.id !== GYM_BLOCK_ID && bw.id !== STUDY_BLOCK_ID
    )
    expect(pasted).toBeDefined()
    expect(pasted!.title).toBe('Gimnasio')
    expect(pasted!.color).toBe('lavender')
    expect(pasted!.id).not.toBe(GYM_BLOCK_ID)
    expect(pasted!.slots).toHaveLength(1)
    expect(pasted!.slots[0]).toMatchObject({
      day_of_week: 2,
      start_minutes: 995,
      end_minutes: 1040,
    })
    expect(pasted!.slots[0].id).not.toBe(GYM_SLOT_ID)

    // El bloque original queda intacto: borrar uno no afecta al otro.
    const original = store.blocksWithSlots.find((bw) => bw.id === GYM_BLOCK_ID)!
    expect(original.slots.map((s) => s.id)).toEqual([GYM_SLOT_ID])

    wrapper.unmount()
  })

  it('permite pegar varias veces seguidas hasta Esc, que termina el pegado antes que el modo', async () => {
    const { wrapper, store, ui } = await mountEditor()

    await copyFromShortcut(wrapper)
    press('v', { ctrlKey: true })
    await nextTick()

    await hoverDay(wrapper, 2, 300, 175)
    await clickDay(wrapper, 2, 300, 175) // miércoles 16:35
    expect(ghost()).not.toBeNull()
    await hoverDay(wrapper, 4, 300, 175)
    await clickDay(wrapper, 4, 300, 175) // viernes 16:35
    expect(ghost()).not.toBeNull()

    expect(db.createScheduleBlock).toHaveBeenCalledTimes(2)
    const pasted = store.blocksWithSlots.filter(
      (bw) => bw.id !== GYM_BLOCK_ID && bw.id !== STUDY_BLOCK_ID
    )
    expect(
      pasted
        .map((bw) => bw.slots[0])
        .map((s) => s.day_of_week)
        .sort()
    ).toEqual([2, 4])

    press('Escape')
    await nextTick()
    expect(ui.scheduleEditMode).toBe(true)
    expect(ghost()).toBeNull()
    expect(badgeText()).toBeNull()

    // El pegado ya terminó: un click solo selecciona, no persiste otra copia.
    await clickDay(wrapper, 2, 300, 175)
    expect(db.createScheduleBlock).toHaveBeenCalledTimes(2)

    wrapper.unmount()
  })

  it('destino ocupado: no persiste, avisa con el bloque que chocó y el fantasma sigue vivo', async () => {
    const { wrapper } = await mountEditor()

    await copyFromShortcut(wrapper)
    press('v', { ctrlKey: true })
    await nextTick()
    await hoverDay(wrapper, 3, 300, 175) // jueves 16:35, ocupado por Estudio

    await clickDay(wrapper, 3, 300, 175)

    expect(db.createScheduleBlock).not.toHaveBeenCalled()
    expect(db.createScheduleSlot).not.toHaveBeenCalled()
    const toast = document.body.querySelector('[data-testid="toast"]')
    expect(toast?.textContent).toContain('Estudio')
    expect(ghost()).not.toBeNull()

    // La copia sigue disponible para pegar en otro lado.
    await hoverDay(wrapper, 2, 300, 175)
    await clickDay(wrapper, 2, 300, 175)
    expect(db.createScheduleBlock).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('los días deshabilitados no son destino del pegado', async () => {
    const { wrapper } = await mountEditor([0, 1, 2, 3, 4]) // sin fin de semana

    await copyFromShortcut(wrapper)
    press('v', { ctrlKey: true })
    await nextTick()

    // Sábado y domingo ni siquiera existen como columnas de destino.
    expect(wrapper.find('[data-day="5"]').exists()).toBe(false)
    expect(wrapper.find('[data-day="6"]').exists()).toBe(false)

    await wrapper.get('[data-testid="schedule-days-grid"]').trigger('click', {
      clientX: 650,
      clientY: 175,
    })
    await flushPromises()
    expect(db.createScheduleBlock).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('el cartelito de horas acompaña el pegado y desaparece al salir del modo', async () => {
    const { wrapper, ui } = await mountEditor()

    await copyFromShortcut(wrapper)
    press('v', { ctrlKey: true })
    await nextTick()
    await hoverDay(wrapper, 2, 300, 175)
    expect(badgeText()).toBe('16:35 → 17:20')

    ui.exitScheduleEditMode()
    await nextTick()

    expect(ghost()).toBeNull()
    expect(badgeText()).toBeNull()
    expect(db.createScheduleBlock).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('sin una ocurrencia copiada no hay fantasma ni pegado', async () => {
    const { wrapper } = await mountEditor()
    await blockAt(wrapper, 0).trigger('mouseenter')
    expect(wrapper.get('[data-testid="schedule-slot-paste"]').attributes('disabled')).toBeDefined()

    press('v', { ctrlKey: true })
    await nextTick()
    await hoverDay(wrapper, 2, 300, 175)

    expect(ghost()).toBeNull()
    await clickDay(wrapper, 2, 300, 175)
    expect(db.createScheduleBlock).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('copiar y pegar solo viven en el modo edición del cronograma', async () => {
    const { wrapper, ui } = await mountEditor([0, 1, 2, 3, 4, 5, 6], false)

    await blockAt(wrapper, 0).trigger('mouseenter')
    expect(wrapper.find('[data-testid="schedule-slot-copy"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="schedule-slot-paste"]').exists()).toBe(false)

    press('c', { ctrlKey: true })
    press('v', { ctrlKey: true })
    ui.scheduleEditMode = true
    await nextTick()
    await hoverDay(wrapper, 2, 300, 175)

    expect(ghost()).toBeNull()

    wrapper.unmount()
  })

  it('los atajos no interfieren cuando el foco está en un campo de texto', async () => {
    const { wrapper } = await mountEditor()
    await copyFromShortcut(wrapper)

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true }))
    await nextTick()
    input.remove()

    await hoverDay(wrapper, 2, 300, 175)
    expect(ghost()).toBeNull()

    wrapper.unmount()
  })
})
