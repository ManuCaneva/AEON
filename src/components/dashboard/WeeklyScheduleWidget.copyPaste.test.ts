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
    show_block_times: true,
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

  it('el botón al hover copia y Ctrl/Cmd+V pega con un fantasma en el hueco libre', async () => {
    const { wrapper } = await mountEditor()
    await hoverDay(wrapper, 0, 300, 175)
    await blockAt(wrapper, 0).trigger('mouseenter')

    await copyFromHover(wrapper)
    press('v', { ctrlKey: true })
    await nextTick()

    // El fantasma aparece ya enganchado donde estaba el puntero.
    expect(ghost()).not.toBeNull()

    await hoverDay(wrapper, 2, 300, 175) // miércoles 16:35

    const ghostEl = ghost()
    expect(ghostEl).not.toBeNull()
    expect(ghostEl!.textContent).toContain('Gimnasio')
    // El fantasma es translúcido, mide una fila y cae en la celda 16:30.
    expect(ghostEl!.className).toContain('opacity-50')
    expect(stylePx(ghostEl!, 'left')).toBeCloseTo(200 / 7)
    expect(stylePx(ghostEl!, 'width')).toBeCloseTo(100 / 7)
    expect(stylePx(ghostEl!, 'top')).toBe(150)
    expect(stylePx(ghostEl!, 'height')).toBe(150)
    expect(badgeText()).toBe('16:30 → 17:00')

    await hoverDay(wrapper, 2, 400, 350)
    expect(stylePx(ghost()!, 'top')).toBe(300)

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
    expect(badgeText()).toBe('16:30 → 17:00')

    wrapper.unmount()
  })

  it('un click suma la copia al bloque de origen con el mismo título y color, sin crear otro bloque', async () => {
    const { wrapper, store } = await mountEditor()

    await copyFromShortcut(wrapper)
    press('v', { ctrlKey: true })
    await nextTick()
    await clickDay(wrapper, 2, 300, 175) // miércoles 16:35

    expect(db.createScheduleBlock).not.toHaveBeenCalled()
    expect(db.createScheduleSlot).toHaveBeenCalledTimes(1)
    expect(db.createScheduleSlot).toHaveBeenCalledWith(
      { day_of_week: 2, start_minutes: 990, end_minutes: 1020 },
      expect.any(String),
      GYM_BLOCK_ID,
      expect.any(String),
      expect.any(String)
    )

    // La ocurrencia pegada es otro horario del mismo bloque, no un bloque aparte.
    expect(store.blocksWithSlots).toHaveLength(2)
    const gym = store.blocksWithSlots.find((bw) => bw.id === GYM_BLOCK_ID)!
    expect(gym.title).toBe('Gimnasio')
    expect(gym.color).toBe('lavender')
    expect(gym.slots).toHaveLength(2)
    expect(gym.slots[0].id).toBe(GYM_SLOT_ID)
    expect(gym.slots[1]).toMatchObject({
      day_of_week: 2,
      start_minutes: 990,
      end_minutes: 1020,
    })

    wrapper.unmount()
  })

  it('pega una sola vez por activación pero conserva la copia para volver a pegar sin salir del modo', async () => {
    const { wrapper, store, ui } = await mountEditor()

    await copyFromShortcut(wrapper)
    press('v', { ctrlKey: true })
    await nextTick()

    await hoverDay(wrapper, 2, 300, 175)
    await clickDay(wrapper, 2, 300, 175) // miércoles 16:35
    // El pegado terminó: ya no hay fantasma.
    expect(ghost()).toBeNull()

    // Un click sin volver a activar el pegado no persiste otra copia.
    await hoverDay(wrapper, 4, 300, 175)
    await clickDay(wrapper, 4, 300, 175) // viernes 16:35
    expect(db.createScheduleSlot).toHaveBeenCalledTimes(1)

    // La copia sigue en el portapapeles: Ctrl+V vuelve a activar el pegado.
    press('v', { ctrlKey: true })
    await nextTick()
    expect(ghost()).not.toBeNull()

    await hoverDay(wrapper, 4, 300, 175)
    await clickDay(wrapper, 4, 300, 175) // viernes 16:35
    expect(ghost()).toBeNull()

    expect(db.createScheduleBlock).not.toHaveBeenCalled()
    expect(db.createScheduleSlot).toHaveBeenCalledTimes(2)
    const gym = store.blocksWithSlots.find((bw) => bw.id === GYM_BLOCK_ID)!
    expect(gym.slots.map((s) => s.day_of_week).sort()).toEqual([0, 2, 4])

    // Un Escape con el pegado inactivo sí sale del modo.
    expect(ui.scheduleEditMode).toBe(true)
    press('Escape')
    await nextTick()
    expect(ui.scheduleEditMode).toBe(false)

    await clickDay(wrapper, 2, 300, 175)
    expect(db.createScheduleSlot).toHaveBeenCalledTimes(2)

    wrapper.unmount()
  })

  it('click sobre otro bloque cancela el pegado y permite copiarlo sin salir del modo', async () => {
    const { wrapper, store, ui } = await mountEditor()

    await copyFromShortcut(wrapper)
    press('v', { ctrlKey: true })
    await nextTick()
    await hoverDay(wrapper, 2, 300, 175)
    expect(ghost()).not.toBeNull()

    // Click sobre Estudio (jueves): cancela el pegado y lo selecciona.
    await wrapper.get(`.schedule-block[data-slot-id="${STUDY_SLOT_ID}"]`).trigger('click')
    await flushPromises()
    await nextTick()
    expect(ghost()).toBeNull()

    // Ctrl+C copia el bloque recién seleccionado, no la copia anterior.
    press('c', { ctrlKey: true })
    await nextTick()
    press('v', { ctrlKey: true })
    await nextTick()
    await hoverDay(wrapper, 2, 300, 175)
    expect(ghost()?.textContent).toContain('Estudio')

    await clickDay(wrapper, 2, 300, 175)

    expect(db.createScheduleBlock).not.toHaveBeenCalled()
    expect(db.createScheduleSlot).toHaveBeenCalledWith(
      { day_of_week: 2, start_minutes: 990, end_minutes: 1020 },
      expect.any(String),
      STUDY_BLOCK_ID,
      expect.any(String),
      expect.any(String)
    )
    const study = store.blocksWithSlots.find((bw) => bw.id === STUDY_BLOCK_ID)!
    expect(study.slots).toHaveLength(2)
    expect(ui.scheduleEditMode).toBe(true)

    wrapper.unmount()
  })

  it('si el bloque copiado ya no existe, el pegado lo recrea y los siguientes pegados se suman a esa copia', async () => {
    const { wrapper, store } = await mountEditor()

    await copyFromShortcut(wrapper)
    press('v', { ctrlKey: true })
    await nextTick()

    // Se borra la última ocurrencia del bloque copiado: el bloque desaparece.
    await store.deleteSlot(GYM_SLOT_ID)
    await flushPromises()
    expect(store.blocksWithSlots.find((bw) => bw.id === GYM_BLOCK_ID)).toBeUndefined()

    await hoverDay(wrapper, 2, 300, 175)
    await clickDay(wrapper, 2, 300, 175)

    expect(db.createScheduleBlock).toHaveBeenCalledTimes(1)
    expect(db.createScheduleSlot).toHaveBeenCalledTimes(1)
    const recreated = store.blocksWithSlots.find(
      (bw) => bw.title === 'Gimnasio' && bw.id !== STUDY_BLOCK_ID
    )!
    expect(recreated).toBeDefined()
    expect(recreated.color).toBe('lavender')
    expect(recreated.slots).toHaveLength(1)
    expect(recreated.slots[0]).toMatchObject({
      day_of_week: 2,
      start_minutes: 990,
      end_minutes: 1020,
    })

    // El portapapeles ahora apunta al bloque recreado: el segundo pegado se le suma.
    press('v', { ctrlKey: true })
    await nextTick()
    await hoverDay(wrapper, 4, 300, 175)
    await clickDay(wrapper, 4, 300, 175)

    expect(db.createScheduleBlock).toHaveBeenCalledTimes(1)
    expect(db.createScheduleSlot).toHaveBeenCalledTimes(2)
    expect(vi.mocked(db.createScheduleSlot).mock.calls[1][2]).toBe(recreated.id)
    const updated = store.blocksWithSlots.find((bw) => bw.id === recreated.id)!
    expect(updated.slots).toHaveLength(2)

    wrapper.unmount()
  })

  it('sin hueco en el día: no persiste, avisa y el pegado sigue activo para reintentar', async () => {
    const { wrapper } = await mountEditor()

    await copyFromShortcut(wrapper)
    press('v', { ctrlKey: true })
    await nextTick()
    await hoverDay(wrapper, 3, 300, 175) // jueves lleno de 16:00 a 18:00

    // No hay dónde ubicar una unidad: ni fantasma ni rango.
    expect(ghost()).toBeNull()
    expect(badgeText()).toBeNull()

    await clickDay(wrapper, 3, 300, 175)

    expect(db.createScheduleBlock).not.toHaveBeenCalled()
    expect(db.createScheduleSlot).not.toHaveBeenCalled()
    const toast = document.body.querySelector('[data-testid="toast"]')
    expect(toast?.textContent).toContain('No hay espacio libre en este día')

    // El pegado sigue activo: no hace falta volver a presionar Ctrl+V.
    await hoverDay(wrapper, 2, 300, 175)
    expect(ghost()).not.toBeNull()
    await clickDay(wrapper, 2, 300, 175)
    expect(db.createScheduleSlot).toHaveBeenCalledTimes(1)
    expect(db.createScheduleSlot).toHaveBeenCalledWith(
      { day_of_week: 2, start_minutes: 990, end_minutes: 1020 },
      expect.any(String),
      GYM_BLOCK_ID,
      expect.any(String),
      expect.any(String)
    )

    wrapper.unmount()
  })

  it('la copia entra en el último hueco del día aunque el puntero quede fuera', async () => {
    const { wrapper, store } = await mountEditor()

    // Un horario tarde estira la Ventana visible hasta 24:00: el puntero puede
    // pedir un destino que se pasa del fin del día.
    store.blocksWithSlots = [
      ...store.blocksWithSlots,
      {
        id: '333e8400-e29b-41d4-a716-446655440009',
        title: 'Trasnoche',
        color: 'cyan',
        sort_order: 2,
        created_at: ISO,
        updated_at: ISO,
        slots: [
          {
            id: '550e8400-e29b-41d4-a716-446655440009',
            block_id: '333e8400-e29b-41d4-a716-446655440009',
            day_of_week: 0,
            start_minutes: 1380, // 23:00
            end_minutes: 1410, // 23:30
            created_at: ISO,
            updated_at: ISO,
          },
        ],
      },
    ]
    await nextTick()

    await copyFromShortcut(wrapper)
    press('v', { ctrlKey: true })
    await nextTick()

    await hoverDay(wrapper, 0, 300, 590) // 23:52
    // La unidad entra en el hueco 23:30–00:00, el único que queda.
    expect(badgeText()).toBe('23:30 → 00:00')

    await clickDay(wrapper, 0, 300, 590)

    expect(db.createScheduleBlock).not.toHaveBeenCalled()
    expect(db.createScheduleSlot).toHaveBeenCalledTimes(1)
    const gym = store.blocksWithSlots.find((bw) => bw.id === GYM_BLOCK_ID)!
    expect(gym.slots[gym.slots.length - 1]).toMatchObject({
      day_of_week: 0,
      start_minutes: 1410,
      end_minutes: 1440,
    })
    expect(document.body.querySelector('[data-testid="toast"]')).toBeNull()

    wrapper.unmount()
  })

  it('el fantasma se engancha al hueco libre más cercano de la columna', async () => {
    const { wrapper, store } = await mountEditor()

    await copyFromShortcut(wrapper)
    press('v', { ctrlKey: true })
    await nextTick()

    // Lunes 16:35: la fila 16:30 está ocupada por Gimnasio (16:00–16:45).
    await hoverDay(wrapper, 0, 300, 175)
    expect(badgeText()).toBe('16:45 → 17:15')
    expect(stylePx(ghost()!, 'top')).toBe(225)
    expect(stylePx(ghost()!, 'height')).toBe(150)

    await clickDay(wrapper, 0, 300, 175)

    expect(db.createScheduleBlock).not.toHaveBeenCalled()
    expect(db.createScheduleSlot).toHaveBeenCalledTimes(1)
    const gym = store.blocksWithSlots.find((bw) => bw.id === GYM_BLOCK_ID)!
    expect(gym.slots[gym.slots.length - 1]).toMatchObject({
      day_of_week: 0,
      start_minutes: 1005,
      end_minutes: 1035,
    })

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
    expect(badgeText()).toBe('16:30 → 17:00')

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
