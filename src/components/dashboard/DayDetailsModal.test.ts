import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, DOMWrapper } from '@vue/test-utils'
import DayDetailsModal from './DayDetailsModal.vue'
import { createPinia, setActivePinia } from 'pinia'
import { ref, reactive } from 'vue'
import TimePicker from '@/components/ui/TimePicker.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'

const hiddenCalendarIds = ref(new Set<string>())

const mockStore = {
  connected: ref(true),
  syncing: ref(false),
  syncError: ref<string | null>(null),
  events: ref<any[]>([]),
  calendars: ref<any[]>([]),
  hiddenCalendarIds,
  isCalendarHidden: (calendarId: string): boolean => hiddenCalendarIds.value.has(calendarId),
  createEvent: vi.fn().mockResolvedValue(undefined),
  updateEvent: vi.fn().mockResolvedValue(undefined),
  deleteEvent: vi.fn().mockResolvedValue(undefined),
}

const reactiveMockStore = reactive(mockStore)

vi.mock('@/stores/calendar', () => ({
  useCalendarStore: () => reactiveMockStore,
}))

const examsState = ref<
  {
    id: string
    title: string
    date: string
    status: string
    fallback_color: string
    event_link?: { calendarId: string; eventId: string } | null
  }[]
>([])

const examsMock = {
  get exams() {
    return examsState.value
  },
  colorFor: vi.fn().mockReturnValue('lavender'),
  blockFor: vi.fn().mockReturnValue(undefined),
}

const uiMock = {
  openEditExam: vi.fn(),
}

vi.mock('@/stores/exams', () => ({
  useExamsStore: () => examsMock,
}))
vi.mock('@/stores/ui', () => ({
  useUiStore: () => uiMock,
}))

function makeExam(id: string, title: string, date: string) {
  return {
    id,
    title,
    date,
    status: 'pendiente',
    fallback_color: 'lavender',
  }
}

describe('DayDetailsModal', () => {
  let wrapper: any

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    mockStore.events.value = [
      {
        id: 'evt1',
        date: '2026-07-22',
        title: 'Evento Test 1',
        description: 'Descripción Test 1',
        color: '#7986cb',
        calendarId: 'primary',
        start: '2026-07-22T10:00:00-03:00',
        end: '2026-07-22T11:00:00-03:00',
      },
    ]

    mockStore.calendars.value = [
      { id: 'primary', summary: 'Principal', primary: true, backgroundColor: '#7986cb' },
      { id: 'work', summary: 'Trabajo', backgroundColor: '#33b679' },
    ]

    mockStore.syncError.value = null
    hiddenCalendarIds.value = new Set<string>()
    examsState.value = []
    examsMock.colorFor.mockReturnValue('lavender')
    examsMock.blockFor.mockReturnValue(undefined)
    uiMock.openEditExam.mockReset()
    mockStore.createEvent.mockReset().mockResolvedValue(undefined)
    mockStore.updateEvent.mockReset().mockResolvedValue(undefined)
    mockStore.deleteEvent.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
    document.body.innerHTML = ''
  })

  const factory = (props = {}) => {
    wrapper = mount(DayDetailsModal, {
      props: {
        open: true,
        date: '2026-07-22',
        ...props,
      },
      attachTo: document.body,
    })
    return wrapper
  }

  it('renders when open and displays title date', () => {
    factory()
    const dialog = document.body.querySelector("[role='dialog']")
    expect(dialog).not.toBeNull()
    expect(dialog!.textContent!.toLowerCase()).toContain('22 de julio')
  })

  it('renders the list of events for the day', () => {
    factory()
    const dialog = document.body.querySelector("[role='dialog']")
    expect(dialog!.textContent).toContain('Evento Test 1')
    expect(dialog!.textContent).toContain('Descripción Test 1')
  })

  it('renders empty state message when no events on that day', () => {
    mockStore.events.value = []
    factory()
    const dialog = document.body.querySelector("[role='dialog']")
    expect(dialog!.textContent).toContain('No hay eventos')
  })

  it("toggles to create form when clicking 'Agregar Evento'", async () => {
    factory()
    const btn = document.body.querySelector("[data-testid='add-event-btn']") as HTMLElement
    expect(btn).not.toBeNull()
    await btn.click()

    expect(document.body.querySelector("[data-testid='event-title-input'] input")).not.toBeNull()
    expect(document.body.querySelector("[data-testid='calendar-select']")).not.toBeNull()
  })

  it('submits the create event form successfully', async () => {
    factory()

    // Toggle form
    const btn = document.body.querySelector("[data-testid='add-event-btn']") as HTMLElement
    await btn.click()
    await wrapper.vm.$nextTick()

    // Fill values
    const titleInput = document.body.querySelector(
      "[data-testid='event-title-input'] input"
    ) as HTMLInputElement
    const descInput = document.body.querySelector(
      "[data-testid='event-desc-input'] textarea"
    ) as HTMLTextAreaElement
    const calSelect = document.body.querySelector(
      "[data-testid='calendar-select']"
    ) as HTMLSelectElement

    await new DOMWrapper(titleInput).setValue('Nuevo Evento Creado')
    await new DOMWrapper(descInput).setValue('Desc Creada')
    await new DOMWrapper(calSelect).setValue('primary')

    const pickers = wrapper.findAllComponents(TimePicker)
    await pickers[0].vm.$emit('update:modelValue', '10:00')
    await pickers[1].vm.$emit('update:modelValue', '11:30')

    await wrapper.vm.$nextTick()

    // Save
    const saveBtn = document.body.querySelector("[data-testid='save-event-btn']") as HTMLElement
    await saveBtn.click()
    await wrapper.vm.$nextTick()

    expect(mockStore.createEvent).toHaveBeenCalledWith(
      'primary',
      expect.objectContaining({
        title: 'Nuevo Evento Creado',
        description: 'Desc Creada',
        colorId: undefined, // default
      })
    )
  })

  it('shows edit form with prepopulated values, updates, and deletes', async () => {
    factory()

    // Click edit on the event
    const editBtn = document.body.querySelector("[data-testid='edit-event-btn']") as HTMLElement
    await editBtn.click()
    await wrapper.vm.$nextTick()

    // Check values
    const titleInput = document.body.querySelector(
      "[data-testid='event-title-input'] input"
    ) as HTMLInputElement
    expect(titleInput.value).toBe('Evento Test 1')

    // Modify and update
    await new DOMWrapper(titleInput).setValue('Evento Modificado')
    await wrapper.vm.$nextTick()

    const saveBtn = document.body.querySelector("[data-testid='save-event-btn']") as HTMLElement
    await saveBtn.click()
    await wrapper.vm.$nextTick()

    expect(mockStore.updateEvent).toHaveBeenCalledWith(
      'primary',
      'evt1',
      expect.objectContaining({
        title: 'Evento Modificado',
      })
    )

    // Re-open and delete
    await editBtn.click()
    await wrapper.vm.$nextTick()

    const deleteBtn = document.body.querySelector("[data-testid='delete-event-btn']") as HTMLElement
    await deleteBtn.click()
    await wrapper.vm.$nextTick()

    expect(mockStore.deleteEvent).toHaveBeenCalledWith('primary', 'evt1')
  })

  it('el dropdown de destino incluye calendarios ocultos y el primario sigue por defecto', async () => {
    hiddenCalendarIds.value = new Set(['primary', 'work'])
    factory()

    const btn = document.body.querySelector("[data-testid='add-event-btn']") as HTMLElement
    await btn.click()
    await wrapper.vm.$nextTick()

    const calSelect = document.body.querySelector(
      "[data-testid='calendar-select']"
    ) as HTMLSelectElement
    const options = Array.from(calSelect.options).map((o) => o.value)
    expect(options).toContain('primary')
    expect(options).toContain('work')
    // El primario sigue siendo el destino por defecto aunque esté oculto
    expect(calSelect.value).toBe('primary')
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    factory()
    expect(hasRawPaletteColor(document.body.innerHTML)).toBe(false)
  })

  describe('exámenes en el detalle del día', () => {
    it('lista sólo los exámenes de la fecha mostrada', () => {
      examsState.value = [
        makeExam('exam-1', 'Parcial de Análisis', '2026-07-22'),
        makeExam('exam-2', 'Final de Física', '2026-07-23'),
      ]
      factory()

      const dialog = document.body.querySelector("[role='dialog']")
      expect(dialog!.textContent).toContain('Parcial de Análisis')
      expect(dialog!.textContent).not.toContain('Final de Física')
    })

    it('abre el examen al clickearlo sin editarlo como evento del calendario', async () => {
      examsState.value = [makeExam('exam-1', 'Parcial de Análisis', '2026-07-22')]
      factory()

      const item = document.body.querySelector("[data-testid='day-exam-item']") as HTMLElement
      expect(item).not.toBeNull()
      await item.click()
      await wrapper.vm.$nextTick()

      expect(uiMock.openEditExam).toHaveBeenCalledWith('exam-1')
      // El examen no entra en el CRUD del calendario: no se toca ningún evento.
      expect(mockStore.updateEvent).not.toHaveBeenCalled()
      expect(mockStore.deleteEvent).not.toHaveBeenCalled()
    })

    it('el punto del examen usa el color resuelto como variable CSS', () => {
      examsMock.colorFor.mockReturnValue('green')
      examsState.value = [makeExam('exam-1', 'Parcial de Análisis', '2026-07-22')]
      factory()

      const dot = document.body.querySelector("[data-testid='day-exam-dot']")
      expect(dot).not.toBeNull()
      expect((dot as HTMLElement).getAttribute('style')).toContain('rgb(var(--color-block-green))')
      expect(hasRawPaletteColor(document.body.innerHTML)).toBe(false)
    })

    it('no muestra la sección si no hay exámenes ese día', () => {
      examsState.value = []
      factory()
      expect(document.body.querySelector("[data-testid='day-exams']")).toBeNull()
    })

    it('oculta el examen vinculado a un evento del mismo día (sólo queda el evento)', () => {
      examsState.value = [
        {
          ...makeExam('exam-1', 'Parcial de Análisis', '2026-07-22'),
          event_link: { calendarId: 'primary', eventId: 'evt1' },
        },
      ]
      factory()

      const dialog = document.body.querySelector("[role='dialog']")
      // El evento de Google representa al examen: se lista el evento…
      expect(dialog!.textContent).toContain('Evento Test 1')
      // …y el examen no se duplica en la sección de exámenes.
      expect(dialog!.textContent).not.toContain('Parcial de Análisis')
      expect(document.body.querySelector("[data-testid='day-exams']")).toBeNull()
    })

    it('muestra el examen si su vínculo es huérfano (evento ausente)', () => {
      examsState.value = [
        {
          ...makeExam('exam-1', 'Parcial de Análisis', '2026-07-22'),
          event_link: { calendarId: 'primary', eventId: 'evt-ausente' },
        },
      ]
      factory()
      expect(document.body.querySelector("[data-testid='day-exam-item']")).not.toBeNull()
    })

    it('muestra el examen si su evento vinculado es de otro día', () => {
      examsState.value = [
        {
          ...makeExam('exam-1', 'Parcial de Análisis', '2026-07-22'),
          event_link: { calendarId: 'primary', eventId: 'evt-otro-dia' },
        },
      ]
      mockStore.events.value = [
        {
          id: 'evt-otro-dia',
          date: '2026-07-23',
          title: 'Evento de otro día',
          color: '#7986cb',
          calendarId: 'primary',
          start: '2026-07-23T10:00:00-03:00',
          end: '2026-07-23T11:00:00-03:00',
        },
      ]
      factory()
      expect(document.body.querySelector("[data-testid='day-exam-item']")).not.toBeNull()
    })
  })

  it('el aviso de permisos usa el acento rojo, no la paleta cruda', () => {
    mockStore.syncError.value = 'Error 403: permission denied'
    factory()

    const dialog = document.body.querySelector("[role='dialog']")
    expect(dialog!.textContent).toContain('Permisos requeridos')
    expect(hasRawPaletteColor(document.body.innerHTML)).toBe(false)
  })
})
