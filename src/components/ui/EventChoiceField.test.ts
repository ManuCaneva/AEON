import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import EventChoiceField from './EventChoiceField.vue'
import type { EventChoice } from '@/lib/entityEventLink'
import { eventKey } from '@/lib/entityEventLink'
import type { EntityEventLink } from '@/schemas/entityLink'

const calendarEvents = ref<{ id: string; date: string; title: string; calendarId: string }[]>([])
const calendarConnected = ref(false)
const calendarCalendars = ref<{ id: string; summary: string; primary?: boolean }[]>([])
const calendarMock = {
  get events() {
    return calendarEvents.value
  },
  get connected() {
    return calendarConnected.value
  },
  get calendars() {
    return calendarCalendars.value
  },
}
vi.mock('@/stores/calendar', () => ({
  useCalendarStore: () => calendarMock,
}))

function makeEvent(
  id: string,
  date: string,
  title: string,
  calendarId = 'local'
): { id: string; date: string; title: string; calendarId: string } {
  return { id, date, title, calendarId }
}

function mountField(props: Partial<Record<string, unknown>> = {}) {
  return mount(EventChoiceField, {
    props: {
      modelValue: { mode: 'none' } as EventChoice,
      date: '2026-07-01',
      link: null as EntityEventLink | null,
      testIdPrefix: 'exam',
      disabledHint: 'Elegí una fecha.',
      error: null,
      ...props,
    },
  })
}

function lastChoice(wrapper: ReturnType<typeof mountField>): EventChoice {
  const emitted = wrapper.emitted('update:modelValue')
  return emitted![emitted!.length - 1][0] as EventChoice
}

function selectByTestId(wrapper: ReturnType<typeof mountField>, testid: string) {
  return wrapper.find(`[data-testid='${testid}']`)
}

describe('EventChoiceField', () => {
  beforeEach(() => {
    calendarEvents.value = []
    calendarConnected.value = false
    calendarCalendars.value = []
  })

  it('renderiza las cuatro opciones excluyentes con el prefijo de testid', () => {
    const wrapper = mountField()
    for (const mode of ['none', 'local', 'new', 'existing']) {
      expect(selectByTestId(wrapper, `exam-event-mode-${mode}`).exists()).toBe(true)
    }
  })

  it('sin elección emite mode none', () => {
    const wrapper = mountField()
    expect(lastChoice(wrapper)).toEqual({ mode: 'none' })
  })

  it('elegir un tema local emite mode local', async () => {
    const wrapper = mountField()
    await selectByTestId(wrapper, 'exam-event-mode-local').trigger('click')
    expect(lastChoice(wrapper)).toEqual({ mode: 'local' })
  })

  it('elegir evento nuevo emite el calendario principal por defecto', async () => {
    calendarConnected.value = true
    calendarCalendars.value = [
      { id: 'primary', summary: 'Principal', primary: true },
      { id: 'work', summary: 'Trabajo' },
    ]
    const wrapper = mountField()
    await selectByTestId(wrapper, 'exam-event-mode-new').trigger('click')

    expect(selectByTestId(wrapper, 'exam-event-calendar-select').exists()).toBe(true)
    expect(lastChoice(wrapper)).toEqual({ mode: 'new', calendarId: 'primary' })
  })

  it('el selector de calendario ofrece el local además de los conectados', async () => {
    calendarConnected.value = true
    calendarCalendars.value = [{ id: 'primary', summary: 'Principal', primary: true }]
    const wrapper = mountField()
    await selectByTestId(wrapper, 'exam-event-mode-new').trigger('click')

    const values = Array.from(
      selectByTestId(wrapper, 'exam-event-calendar-select').element.querySelectorAll('option')
    ).map((o) => (o as HTMLOptionElement).value)
    expect(values).toEqual(['local', 'primary'])
  })

  it('un vínculo huérfano se muestra como «Evento no disponible»', () => {
    const wrapper = mountField({ link: { calendarId: 'local', eventId: 'evt-ausente' } })
    const select = selectByTestId(wrapper, 'exam-event-select')
    expect(select.text()).toContain('Evento no disponible')
    expect(lastChoice(wrapper)).toEqual({
      mode: 'existing',
      link: { calendarId: 'local', eventId: 'evt-ausente' },
    })
  })

  it('conserva el título del evento vinculado aunque cambie la fecha (vigente)', async () => {
    calendarEvents.value = [makeEvent('evt-1', '2026-07-01', 'Consulta')]
    const wrapper = mountField({ link: { calendarId: 'local', eventId: 'evt-1' } })

    // Antes de cambiar la fecha se ve el título real.
    expect(selectByTestId(wrapper, 'exam-event-select').text()).toContain('Consulta')

    await wrapper.setProps({ date: '2026-07-10' })

    const select = selectByTestId(wrapper, 'exam-event-select')
    expect(select.text()).toContain('Consulta')
    expect(select.text()).not.toContain('Evento no disponible')
  })

  it('un vínculo a otro día ya sin evento se sigue viendo como no disponible', async () => {
    const wrapper = mountField({ link: { calendarId: 'local', eventId: 'evt-ausente' } })
    await wrapper.setProps({ date: '2026-07-10' })
    expect(selectByTestId(wrapper, 'exam-event-select').text()).toContain('Evento no disponible')
  })

  it('seleccionar un evento del día emite el vínculo elegido', async () => {
    calendarEvents.value = [makeEvent('evt-1', '2026-07-01', 'Consulta')]
    const wrapper = mountField({ link: { calendarId: 'local', eventId: 'evt-1' } })
    await selectByTestId(wrapper, 'exam-event-select').setValue(eventKey('local', 'evt-1'))
    expect(lastChoice(wrapper)).toEqual({
      mode: 'existing',
      link: { calendarId: 'local', eventId: 'evt-1' },
    })
  })

  it('limpiar el evento elegido vuelve a mode none', async () => {
    calendarEvents.value = [makeEvent('evt-1', '2026-07-01', 'Consulta')]
    const wrapper = mountField({ link: { calendarId: 'local', eventId: 'evt-1' } })
    await selectByTestId(wrapper, 'exam-event-select').setValue('')
    expect(lastChoice(wrapper)).toEqual({ mode: 'none' })
  })

  it('sin fecha deshabilita las opciones y muestra el hint', async () => {
    const wrapper = mountField({ date: '' })
    expect(selectByTestId(wrapper, 'exam-event-disabled-hint').exists()).toBe(true)
    expect(
      (selectByTestId(wrapper, 'exam-event-mode-local').element as HTMLButtonElement).disabled
    ).toBe(true)
  })

  it('limpiar la fecha vuelve a mode none', async () => {
    calendarEvents.value = [makeEvent('evt-1', '2026-07-01', 'Consulta')]
    const wrapper = mountField({ link: { calendarId: 'local', eventId: 'evt-1' } })
    await wrapper.setProps({ date: '' })
    expect(lastChoice(wrapper)).toEqual({ mode: 'none' })
  })

  it('respeta el prefijo de testid y el error recibidos', () => {
    const wrapper = mountField({
      testIdPrefix: 'task',
      error: 'No se pudo crear el evento',
    })
    expect(selectByTestId(wrapper, 'task-event-mode-none').exists()).toBe(true)
    expect(selectByTestId(wrapper, 'task-calendar-error').text()).toContain(
      'No se pudo crear el evento'
    )
  })
})
