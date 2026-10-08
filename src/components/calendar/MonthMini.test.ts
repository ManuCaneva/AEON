import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MonthMini from './MonthMini.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'
import type { CalendarEvent } from '@/schemas/calendar'

const dummyEvents: CalendarEvent[] = [
  {
    id: 'e1',
    date: '2026-01-15',
    title: 'Standup',
    color: '#7986cb',
    calendarId: 'primary',
    start: '2026-01-15T10:00:00Z',
    end: '2026-01-15T10:30:00Z',
  },
  {
    id: 'e2',
    date: '2026-01-15',
    title: 'Review',
    color: '#33b679',
    calendarId: 'primary',
    start: '2026-01-15T14:00:00Z',
    end: '2026-01-15T15:00:00Z',
  },
]

const eventsByDate = new Map<string, CalendarEvent[]>()
eventsByDate.set('2026-01-15', dummyEvents)

describe('MonthMini', () => {
  afterEach(() => {
    // El test de fecha por defecto usa timers fake: nunca se filtran al resto
    vi.useRealTimers()
  })

  it('renderiza 42 celdas (6 semanas × 7 días), pero solo las reales tienen data-testid', () => {
    const wrapper = mount(MonthMini, {
      props: { year: 2026, month: 0, eventsByDate },
    })
    const allCells = wrapper.findAll('.day-cell')
    expect(allCells).toHaveLength(42)
    const realDays = wrapper.findAll("[data-testid='day-cell']")
    expect(realDays.length).toBe(31) // enero tiene 31 días
  })

  it('no muestra el nombre del mes en el tooltip principal', () => {
    const wrapper = mount(MonthMini, {
      props: { year: 2026, month: 0, eventsByDate, monthName: 'enero' },
    })
    const monthEl = wrapper.find("[data-testid='month-mini']")
    expect(monthEl.attributes('title')).toBeUndefined()
  })

  it('muestra el día exacto formateado en el tooltip de la celda de día', () => {
    const wrapper = mount(MonthMini, {
      props: { year: 2026, month: 0, eventsByDate },
    })
    const cells = wrapper.findAll("[data-testid='day-cell']")
    const cell15 = cells[14] // 15 de Enero
    expect(cell15.attributes('title')).toBe('15 de Enero')
  })

  it('emite select-day al hacer clic en una celda con fecha', async () => {
    const wrapper = mount(MonthMini, {
      props: { year: 2026, month: 0, eventsByDate },
    })
    const cells = wrapper.findAll("[data-testid='day-cell']")
    const cell15 = cells[14]
    await cell15.trigger('click')
    expect(wrapper.emitted('select-day')).toBeTruthy()
    expect(wrapper.emitted('select-day')![0]).toEqual(['2026-01-15'])
  })

  it('renderiza el nombre del mes como texto cuando se pasa monthName', () => {
    const wrapper = mount(MonthMini, {
      props: { year: 2026, month: 0, eventsByDate, monthName: 'enero' },
    })
    expect(wrapper.find('.month-mini__name').text()).toBe('enero')
  })

  it('no muestra header D-L-M-M-J-V-S por defecto', () => {
    const wrapper = mount(MonthMini, {
      props: { year: 2026, month: 0, eventsByDate },
    })
    expect(wrapper.findAll("[data-testid='day-header']").length).toBe(0)
  })

  it('muestra header D-L-M-M-J-V-S cuando showHeader=true', () => {
    const wrapper = mount(MonthMini, {
      props: { year: 2026, month: 0, eventsByDate, showHeader: true },
    })
    const headers = wrapper.findAll("[data-testid='day-header']")
    expect(headers).toHaveLength(7)
    expect(headers[0].text()).toBe('D')
    expect(headers[6].text()).toBe('S')
  })

  it('muestra cuadrados con dots de color para días con eventos', () => {
    const wrapper = mount(MonthMini, {
      props: { year: 2026, month: 0, eventsByDate },
    })
    const dots = wrapper.findAll("[data-testid='event-dot']")
    expect(dots).toHaveLength(2)
    expect(dots[0].attributes('style')).toContain('#7986cb')
    expect(dots[1].attributes('style')).toContain('#33b679')
  })

  it('celdas sin eventos muestran cuadrado vacío', () => {
    const wrapper = mount(MonthMini, {
      props: { year: 2026, month: 0, eventsByDate },
    })
    const cells = wrapper.findAll("[data-testid='day-cell']")
    const cellsWithDots = cells.filter((c) => c.findAll("[data-testid='event-dot']").length > 0)
    expect(cellsWithDots.length).toBe(1)
    expect(cells.length - cellsWithDots.length).toBe(30)
  })

  it('celdas padding (fuera del mes) tienen clase day-cell--empty', () => {
    const wrapper = mount(MonthMini, {
      props: { year: 2026, month: 0, eventsByDate },
    })
    const emptyCells = wrapper.findAll('.day-cell--empty')
    expect(emptyCells.length).toBe(11) // 42 - 31 = 11 celdas vacías
  })

  it('muestra hasta 4 dots y +N cuando hay más de 4 eventos en un día', () => {
    const manyEvents: CalendarEvent[] = Array.from({ length: 6 }, (_, i) => ({
      id: `e${i}`,
      date: '2026-01-20',
      title: `Event ${i}`,
      color: '#e67c73',
      calendarId: 'primary',
      start: `2026-01-20T${i + 9}:00:00Z`,
      end: `2026-01-20T${i + 10}:00:00Z`,
    }))
    const map = new Map<string, CalendarEvent[]>()
    map.set('2026-01-20', manyEvents)

    const wrapper = mount(MonthMini, {
      props: { year: 2026, month: 0, eventsByDate: map },
    })
    const dots = wrapper.findAll("[data-testid='event-dot']")
    expect(dots).toHaveLength(4)
    expect(wrapper.text()).toContain('+2')
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const wrapper = mount(MonthMini, {
      props: { year: 2026, month: 0, eventsByDate, showHeader: true },
    })
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })

  it('marca con halo la celda de la fecha exacta inyectada como hoy', () => {
    const wrapper = mount(MonthMini, {
      props: { year: 2026, month: 0, eventsByDate, today: '2026-01-15' },
    })

    const todayCells = wrapper.findAll('.day-cell--today')
    expect(todayCells).toHaveLength(1)
    // El marcaje cae en la celda cuya fecha es exactamente la de hoy
    expect(todayCells[0].attributes('title')).toBe('15 de Enero')
    // Halo: fondo tint del acento + borde fino del acento (1–2px)
    expect(todayCells[0].classes()).toContain('bg-accent-purple-tint')
    expect(todayCells[0].classes()).toContain('ring-2')
    expect(todayCells[0].classes()).toContain('ring-inset')
    expect(todayCells[0].classes()).toContain('ring-accent-purple')
  })

  it('no marca el mismo día de la semana ni el mismo número en otros meses (fecha exacta contra día de la semana)', () => {
    const enero = mount(MonthMini, {
      props: { year: 2026, month: 0, eventsByDate, today: '2026-01-15' },
    })
    // Solo la celda del 15 de enero se marca: ni el mismo día de la semana
    // (jueves 22), ni las celdas de padding (febrero visto como relleno)
    const marked = enero.findAll('.day-cell--today')
    expect(marked).toHaveLength(1)
    expect(marked[0].attributes('title')).toBe('15 de Enero')
    for (const cell of enero.findAll('.day-cell')) {
      if (cell.attributes('title') !== '15 de Enero') {
        expect(cell.classes()).not.toContain('day-cell--today')
      }
    }

    // Febrero 2026 tiene un día 15 y varios jueves (5, 12, 19, 26): ninguno
    // se marca porque hoy sigue siendo el 15 de enero
    const febrero = mount(MonthMini, {
      props: { year: 2026, month: 1, eventsByDate, today: '2026-01-15' },
    })
    expect(febrero.findAll('.day-cell--today')).toHaveLength(0)
  })

  it('muestra el número del día en negrita en la celda marcada', () => {
    const wrapper = mount(MonthMini, {
      props: { year: 2026, month: 0, eventsByDate, today: '2026-01-15' },
    })
    const cell = wrapper.get('.day-cell--today')
    const number = cell.get("[data-testid='today-number']")
    expect(number.text()).toBe('15')
    expect(number.classes()).toContain('font-bold')
  })

  it('usa la fecha del sistema cuando no se inyecta today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 15, 9, 30, 0))

    const wrapper = mount(MonthMini, {
      props: { year: 2026, month: 0, eventsByDate },
    })

    const marked = wrapper.findAll('.day-cell--today')
    expect(marked).toHaveLength(1)
    expect(marked[0].attributes('title')).toBe('15 de Enero')
  })

  it('los puntos de eventos del día siguen visibles en la celda marcada', () => {
    const wrapper = mount(MonthMini, {
      props: { year: 2026, month: 0, eventsByDate, today: '2026-01-15' },
    })
    const cell = wrapper.get('.day-cell--today')
    expect(cell.findAll("[data-testid='event-dot']")).toHaveLength(2)
  })

  it('el marcaje usa tokens del design system, sin colores inline ni de la paleta cruda', () => {
    const wrapper = mount(MonthMini, {
      props: { year: 2026, month: 0, eventsByDate, today: '2026-01-15' },
    })
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)

    const cell = wrapper.get('.day-cell--today')
    const number = cell.get("[data-testid='today-number']")
    // tint (fondo) y solid (borde y número) del acento: los tokens se definen
    // por tema, así que el marcaje se distingue en claro y en oscuro
    expect(cell.classes()).toEqual(
      expect.arrayContaining(['bg-accent-purple-tint', 'ring-accent-purple'])
    )
    expect(number.classes()).toContain('text-accent-purple')
    expect(cell.attributes('style')).toBeUndefined()
    expect(number.attributes('style')).toBeUndefined()
  })
})
