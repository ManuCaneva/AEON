import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import WeeklyScheduleWidget from './WeeklyScheduleWidget.vue'
import { useUiStore } from '@/stores/ui'
import { hasRawPaletteColor } from '@/test/colorGuard'

let lastErrorValue: string | null = null

vi.mock('@/stores/weeklySchedule', () => ({
  useWeeklyScheduleStore: () => ({
    blocksWithSlots: [],
    settings: {
      granularity_minutes: 30,
      week_starts_monday: true,
      enabled_days: [0, 1, 2, 3, 4, 5, 6],
    },
    enabledDays: [0, 1, 2, 3, 4, 5, 6],
    loading: false,
    get lastError() {
      return lastErrorValue
    },
    blocksByDay: new Map(),
    visibleWindow: { start_minutes: 360, end_minutes: 1380 },
    loadAll: vi.fn(),
  }),
  minutesToHHMM: (min: number) => {
    const h = Math.floor(min / 60)
    const m = min % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  },
  BLOCK_COLOR_TOKENS: ['lavender', 'green'] as const,
}))

describe('WeeklyScheduleWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    lastErrorValue = null
  })

  it('renderiza el widget de cronograma semanal', () => {
    const wrapper = mount(WeeklyScheduleWidget)
    expect(wrapper.find("[data-testid='weekly-schedule-widget']").exists()).toBe(true)
    expect(wrapper.text()).toContain('Cronograma Semanal')
  })

  it('tiene el título alineado a la izquierda y conserva los controles (ALINEACIÓN)', () => {
    const wrapper = mount(WeeklyScheduleWidget)
    const header = wrapper.get('.schedule-widget-header')
    const title = header.get('.text-card-title')

    expect(header.classes()).not.toContain('justify-center')
    expect(header.classes()).toContain('justify-between')
    expect(title.classes()).not.toContain('text-center')
    expect(title.classes()).toContain('text-left')
    expect(header.element.firstElementChild?.textContent).toContain('Cronograma Semanal')
    expect(header.find('[aria-label="Ajustes"]').exists()).toBe(true)
    expect(header.find('[aria-label="Nuevo bloque"]').exists()).toBe(true)
  })

  it('el header usa el mismo fondo que los demás widgets (bg-surface-2)', () => {
    const wrapper = mount(WeeklyScheduleWidget)
    const header = wrapper.get('.schedule-widget-header')
    expect(header.classes()).toContain('bg-surface-2')
    expect(header.classes()).not.toContain('bg-transparent')
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const wrapper = mount(WeeklyScheduleWidget)
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })

  it('el banner de error usa el acento rojo, no la paleta cruda', () => {
    lastErrorValue = 'boom'
    const wrapper = mount(WeeklyScheduleWidget)
    expect(wrapper.text()).toContain('boom')
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })

  describe('modo edición del cronograma', () => {
    function mountWidget() {
      const ui = useUiStore()
      const wrapper = mount(WeeklyScheduleWidget)
      return { wrapper, ui }
    }

    it('el botón del cronograma alterna el modo edición del cronograma', async () => {
      const { wrapper, ui } = mountWidget()
      const toggle = wrapper.get('[data-testid="schedule-edit-toggle"]')

      expect(toggle.attributes('aria-pressed')).toBe('false')
      await toggle.trigger('click')
      expect(ui.scheduleEditMode).toBe(true)
      expect(toggle.attributes('aria-pressed')).toBe('true')

      await toggle.trigger('click')
      expect(ui.scheduleEditMode).toBe(false)
      expect(toggle.attributes('aria-pressed')).toBe('false')
      wrapper.unmount()
    })

    it('al activarlo solo el contenido del cronograma se desatura', async () => {
      const { wrapper, ui } = mountWidget()
      expect(wrapper.find('.grayscale').exists()).toBe(false)

      await wrapper.get('[data-testid="schedule-edit-toggle"]').trigger('click')
      expect(ui.scheduleEditMode).toBe(true)

      // Cada columna desatura solo su contenido (días y bloques)...
      const contents = wrapper.findAll('[data-testid="schedule-day-content"]')
      expect(contents).toHaveLength(7)
      for (const content of contents) {
        expect(content.classes()).toContain('grayscale')
      }
      // ...y el resto del widget y del dashboard sigue a color: la
      // desaturación no envuelve a los controles del modo.
      expect(wrapper.get('[data-testid="schedule-edit-content"]').classes()).not.toContain(
        'grayscale'
      )
      expect(wrapper.get('[data-testid="weekly-schedule-widget"]').classes()).not.toContain(
        'grayscale'
      )
      wrapper.unmount()
    })

    it('los controles del modo quedan fuera del contenido desaturado', async () => {
      const { wrapper, ui } = mountWidget()
      await wrapper.get('[data-testid="schedule-edit-toggle"]').trigger('click')
      expect(ui.scheduleEditMode).toBe(true)

      const toggle = wrapper.get('[data-testid="schedule-edit-toggle"]')
      expect(toggle.element.closest('[data-testid="schedule-edit-content"]')).toBeNull()
      expect(toggle.attributes('disabled')).toBeUndefined()
      wrapper.unmount()
    })

    it('con el modo edición general activo el botón no está disponible', async () => {
      const { wrapper, ui } = mountWidget()
      ui.editMode = true
      await nextTick()

      const toggle = wrapper.get('[data-testid="schedule-edit-toggle"]')
      expect(toggle.attributes('disabled')).toBeDefined()
      await toggle.trigger('click')
      expect(ui.scheduleEditMode).toBe(false)
      wrapper.unmount()
    })

    it('Esc cierra el modo edición del cronograma', async () => {
      const { wrapper, ui } = mountWidget()
      await wrapper.get('[data-testid="schedule-edit-toggle"]').trigger('click')
      expect(ui.scheduleEditMode).toBe(true)

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await nextTick()
      expect(ui.scheduleEditMode).toBe(false)
      wrapper.unmount()
    })
  })
})
