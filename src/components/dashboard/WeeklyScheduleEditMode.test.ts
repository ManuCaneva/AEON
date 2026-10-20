import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import WeeklyScheduleWidget from './WeeklyScheduleWidget.vue'
import { useUiStore } from '@/stores/ui'
import { useWeeklyScheduleStore } from '@/stores/weeklySchedule'
import * as db from '@/lib/db'
import type { ScheduleBlockWithSlots } from '@/schemas/weeklySchedule'

vi.mock('@/lib/db', () => ({
  listScheduleBlocks: vi.fn().mockResolvedValue([]),
  listScheduleSlots: vi.fn().mockResolvedValue([]),
  createScheduleBlock: vi.fn(),
  createScheduleSlot: vi.fn(),
  updateScheduleBlock: vi.fn(),
  updateScheduleSlot: vi.fn(),
  deleteScheduleBlock: vi.fn(),
  deleteScheduleSlot: vi.fn(),
  loadWeeklyScheduleSettings: vi.fn().mockResolvedValue({
    granularity_minutes: 30,
    week_starts_monday: true,
    enabled_days: [0, 1, 2, 3, 4, 5, 6],
  }),
  saveWeeklyScheduleSettings: vi.fn(),
}))

const TS = '2026-07-12T19:00:00.000Z'
const BLOCK_ID = '333e8400-e29b-41d4-a716-446655440000'
const TUESDAY_SLOT_ID = '550e8400-e29b-41d4-a716-446655440001'
const THURSDAY_SLOT_ID = '550e8400-e29b-41d4-a716-446655440002'

function slot(id: string, day: number) {
  return {
    id,
    block_id: BLOCK_ID,
    day_of_week: day,
    start_minutes: 1080, // 18:00
    end_minutes: 1140, // 19:00
    created_at: TS,
    updated_at: TS,
  }
}

function gimnasio(
  slotIds: string[] = [TUESDAY_SLOT_ID, THURSDAY_SLOT_ID]
): ScheduleBlockWithSlots[] {
  return [
    {
      id: BLOCK_ID,
      title: 'Gimnasio',
      color: 'lavender',
      sort_order: 0,
      created_at: TS,
      updated_at: TS,
      slots: [slot(slotIds[0], 1), ...(slotIds[1] ? [slot(slotIds[1], 3)] : [])],
    },
  ]
}

async function mountWidget(blocks: ScheduleBlockWithSlots[] = gimnasio()) {
  const wrapper = mount(WeeklyScheduleWidget, { attachTo: document.body })
  // loadAll() vacía el store con la persistencia mockeada: los bloques del
  // caso se cargan después, que es lo que ve el usuario al abrir el widget.
  await flushPromises()
  const store = useWeeklyScheduleStore()
  store.blocksWithSlots = blocks
  await nextTick()
  return { wrapper, store, ui: useUiStore() }
}

async function enterEditMode(
  wrapper: Awaited<ReturnType<typeof mountWidget>>['wrapper'],
  ui: ReturnType<typeof useUiStore>
) {
  await wrapper.get('[data-testid="schedule-edit-toggle"]').trigger('click')
  expect(ui.scheduleEditMode).toBe(true)
  await nextTick()
}

function dayColumn(wrapper: Awaited<ReturnType<typeof mountWidget>>['wrapper'], day: number) {
  return wrapper.get(`[data-day="${day}"]`)
}

function deleteButton(wrapper: Awaited<ReturnType<typeof mountWidget>>['wrapper'], day: number) {
  return dayColumn(wrapper, day).find('[data-testid="schedule-slot-delete"]')
}

describe('cronograma: selección y borrado en el modo edición', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('la × de una ocurrencia aparece al pasar el mouse, solo dentro del modo edición', async () => {
    const { wrapper, ui } = await mountWidget()
    const tuesdayBlock = dayColumn(wrapper, 1).get('.schedule-block')

    await tuesdayBlock.trigger('mouseenter')
    expect(deleteButton(wrapper, 1).exists()).toBe(false)

    await enterEditMode(wrapper, ui)
    expect(deleteButton(wrapper, 1).exists()).toBe(false)

    await tuesdayBlock.trigger('mouseenter')
    expect(deleteButton(wrapper, 1).exists()).toBe(true)

    // El puntero pasa del bloque a su propia ×: la × sigue a mano.
    await tuesdayBlock.trigger('mouseleave', { relatedTarget: deleteButton(wrapper, 1).element })
    expect(deleteButton(wrapper, 1).exists()).toBe(true)

    await deleteButton(wrapper, 1).trigger('mouseleave')
    expect(deleteButton(wrapper, 1).exists()).toBe(false)

    wrapper.unmount()
  })

  it('la × borra solo la ocurrencia del día apuntado y persiste al instante', async () => {
    const { wrapper, store, ui } = await mountWidget()
    await enterEditMode(wrapper, ui)

    await dayColumn(wrapper, 1).get('.schedule-block').trigger('mouseenter')
    await deleteButton(wrapper, 1).trigger('click')
    await flushPromises()

    expect(db.deleteScheduleSlot).toHaveBeenCalledTimes(1)
    expect(db.deleteScheduleSlot).toHaveBeenCalledWith(TUESDAY_SLOT_ID)
    expect(db.deleteScheduleBlock).not.toHaveBeenCalled()
    expect(store.blocksWithSlots[0].slots.map((s) => s.id)).toEqual([THURSDAY_SLOT_ID])
    // El horario del jueves sigue dibujado; el del martes ya no.
    expect(dayColumn(wrapper, 1).find('.schedule-block').exists()).toBe(false)
    expect(dayColumn(wrapper, 3).find('.schedule-block').exists()).toBe(true)

    wrapper.unmount()
  })

  it('la × del último horario borra el bloque entero (cascada)', async () => {
    const { wrapper, ui } = await mountWidget(gimnasio([TUESDAY_SLOT_ID]))
    await enterEditMode(wrapper, ui)

    await dayColumn(wrapper, 1).get('.schedule-block').trigger('mouseenter')
    await deleteButton(wrapper, 1).trigger('click')
    await flushPromises()

    expect(db.deleteScheduleSlot).toHaveBeenCalledWith(TUESDAY_SLOT_ID)
    expect(db.deleteScheduleBlock).toHaveBeenCalledWith(BLOCK_ID)
    expect(wrapper.findAll('.schedule-block')).toHaveLength(0)

    wrapper.unmount()
  })

  it('click sobre una ocurrencia la selecciona con un borde fino y un click en el hueco la deselecciona', async () => {
    const { wrapper, ui } = await mountWidget()
    await enterEditMode(wrapper, ui)
    const tuesdayBlock = dayColumn(wrapper, 1).get('.schedule-block')

    expect(tuesdayBlock.attributes('aria-pressed')).toBe('false')

    await tuesdayBlock.trigger('click')
    const selected = dayColumn(wrapper, 1).get('.schedule-block')
    expect(selected.attributes('aria-pressed')).toBe('true')
    expect(selected.classes().join(' ')).toMatch(/ring-1.*ring-accent-purple/)
    // La selección es de una ocurrencia: el jueves del mismo bloque no se marca.
    expect(dayColumn(wrapper, 3).get('.schedule-block').attributes('aria-pressed')).toBe('false')

    await dayColumn(wrapper, 1).trigger('click')
    expect(dayColumn(wrapper, 1).get('.schedule-block').attributes('aria-pressed')).toBe('false')

    wrapper.unmount()
  })

  it('Supr borra la ocurrencia seleccionada y persiste al instante', async () => {
    const { wrapper, store, ui } = await mountWidget()
    await enterEditMode(wrapper, ui)
    await dayColumn(wrapper, 1).get('.schedule-block').trigger('click')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    await flushPromises()

    expect(db.deleteScheduleSlot).toHaveBeenCalledWith(TUESDAY_SLOT_ID)
    expect(store.blocksWithSlots[0].slots.map((s) => s.id)).toEqual([THURSDAY_SLOT_ID])
    // La selección se limpia con la ocurrencia que ya no está: un segundo
    // Supr no se lleva por delante otro horario.
    expect(dayColumn(wrapper, 3).get('.schedule-block').attributes('aria-pressed')).toBe('false')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    await flushPromises()
    expect(db.deleteScheduleSlot).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('Supr no borra sin el modo edición del cronograma, ni con el modo edición general activo', async () => {
    const { wrapper, ui } = await mountWidget()
    await dayColumn(wrapper, 1).get('.schedule-block').trigger('click')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    await flushPromises()
    expect(db.deleteScheduleSlot).not.toHaveBeenCalled()

    ui.editMode = true
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    await flushPromises()
    expect(db.deleteScheduleSlot).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('Supr no borra mientras el foco está en un campo de texto', async () => {
    const { wrapper, ui } = await mountWidget()
    await enterEditMode(wrapper, ui)
    await dayColumn(wrapper, 1).get('.schedule-block').trigger('click')

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    await flushPromises()

    expect(db.deleteScheduleSlot).not.toHaveBeenCalled()
    input.remove()

    wrapper.unmount()
  })

  it('salir del modo edición limpia la selección', async () => {
    const { wrapper, ui } = await mountWidget()
    await enterEditMode(wrapper, ui)
    await dayColumn(wrapper, 1).get('.schedule-block').trigger('click')
    expect(dayColumn(wrapper, 1).get('.schedule-block').attributes('aria-pressed')).toBe('true')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(ui.scheduleEditMode).toBe(false)

    await enterEditMode(wrapper, ui)
    expect(dayColumn(wrapper, 1).get('.schedule-block').attributes('aria-pressed')).toBe('false')

    wrapper.unmount()
  })
})
