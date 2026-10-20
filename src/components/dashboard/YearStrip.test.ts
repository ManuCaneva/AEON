import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import YearStrip from './YearStrip.vue'
import { eventKey } from '@/lib/entityEventLink'
import type { CalendarEvent } from '@/schemas/calendar'

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function mountStrip(year = 2026) {
  return mount(YearStrip, {
    props: {
      year,
      eventsByDate: new Map(),
      monthNames: MONTH_NAMES,
      cellSize: 10,
      highlightMonth: 9,
      today: '2026-10-10',
    },
  })
}

describe('YearStrip', () => {
  it('renderiza los 12 headers de mes abreviados a 3 letras', () => {
    const wrapper = mountStrip()
    const headers = wrapper.findAll("[data-testid='strip-month']")
    expect(headers).toHaveLength(12)
    expect(headers.map((h) => h.text())).toEqual([
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ])
    for (const h of headers) {
      expect(h.attributes('style') ?? '').toContain('grid-column')
    }
  })

  it('renderiza 7 etiquetas de día Dom-Sáb', () => {
    const wrapper = mountStrip()
    const labels = wrapper.findAll("[data-testid='strip-day-label']")
    expect(labels).toHaveLength(7)
    expect(labels.map((l) => l.text())).toEqual(['D', 'L', 'M', 'M', 'J', 'V', 'S'])
  })

  it('cubre los 365 días del 2026 como celdas clicables', () => {
    const wrapper = mountStrip()
    const cells = wrapper.findAll("[data-testid='strip-cell']")
    expect(cells).toHaveLength(365)
  })

  it('emite select-day al clickear una celda', async () => {
    const wrapper = mountStrip()
    const first = wrapper.find("[data-testid='strip-cell']")
    await first.trigger('click')
    expect(wrapper.emitted('select-day')).toBeTruthy()
    expect(wrapper.emitted('select-day')![0]).toEqual([first.attributes('data-date')])
  })

  it('renderiza 11 divisores escalonados y destaca los del mes actual', () => {
    const wrapper = mountStrip()
    const dividers = wrapper.findAll("[data-testid='strip-divider']")
    expect(dividers).toHaveLength(11)
    const highlighted = dividers.filter((d) => d.attributes('data-highlight') === 'true')
    // Octubre (9) toca los divisores Sep|Oct (8) y Oct|Nov (9)
    expect(highlighted).toHaveLength(2)
  })

  it('pinta el overlay de exámenes como un punto extra idéntico al de un evento', () => {
    const overlayByDate = new Map([
      ['2026-06-04', [{ id: 'exam_1', title: 'Parcial 1', color: 'rgb(var(--color-block-cyan))' }]],
    ])
    const wrapper = mount(YearStrip, {
      props: {
        year: 2026,
        eventsByDate: new Map(),
        overlayByDate,
        monthNames: MONTH_NAMES,
        cellSize: 10,
      },
    })
    const cell = wrapper.find("[data-date='2026-06-04']")
    expect(cell.exists()).toBe(true)
    const dots = cell.findAll("[data-testid='event-dot']")
    expect(dots).toHaveLength(1)
    // Mismo markup que un evento: misma clase y mismo testid.
    expect(dots[0].classes()).toContain('ys__dot')
    expect(dots[0].attributes('style')).toContain('rgb(var(--color-block-cyan))')
  })

  it('sin overlay la tira no agrega puntos', () => {
    const wrapper = mountStrip()
    expect(wrapper.findAll("[data-testid='event-dot']")).toHaveLength(0)
  })

  it('muestra dots de eventos igual que el modo meses', async () => {
    const eventsByDate = new Map([
      [
        '2026-01-05',
        [
          { id: 'a', color: '#ff0000' },
          { id: 'b', color: '#00ff00' },
        ],
      ],
    ])
    const wrapper = mount(YearStrip, {
      props: {
        year: 2026,
        eventsByDate: eventsByDate as never,
        monthNames: MONTH_NAMES,
        cellSize: 10,
      },
    })
    const cell = wrapper.find("[data-date='2026-01-05']")
    expect(cell.exists()).toBe(true)
    expect(cell.findAll("[data-testid='event-dot']")).toHaveLength(2)
  })

  it('el header deja el mismo gap que la grilla para que el divisor quede centrado', () => {
    const wrapper = mount(YearStrip, {
      props: {
        year: 2026,
        eventsByDate: new Map(),
        monthNames: MONTH_NAMES,
        cellSize: 30,
      },
    })
    // gap = max(2, round(30*0.40)) = 12: el margen bajo el header debe igualarlo,
    // si no el SVG se desplaza y los escalones cortan celdas.
    const months = wrapper.find('.ys__months')
    expect(months.attributes('style') ?? '').toContain('margin-bottom: 12px')
  })

  it('el gap respira con la celda: visible para el divisor en celdas grandes', () => {
    const wrapper = mount(YearStrip, {
      props: {
        year: 2026,
        eventsByDate: new Map(),
        monthNames: MONTH_NAMES,
        cellSize: 30,
      },
    })
    // gap = max(2, round(30*0.40)) = 12 -> ancho 18+12+53*30+52*12 = 2244
    const content = wrapper.find('.ys__content')
    expect(content.attributes('style') ?? '').toContain('width: 2244px')
  })

  it('el scroller permite scroll horizontal', () => {
    const wrapper = mountStrip()
    expect(wrapper.find("[data-testid='tira-scroller']").exists()).toBe(true)
  })

  it('en modo auto calcula la celda desde el tamaño real y respeta el tope', () => {
    const wrapper = mount(YearStrip, {
      props: {
        year: 2026,
        eventsByDate: new Map(),
        monthNames: MONTH_NAMES,
      },
    })
    // Sin cellSize explícito usa el auto-size (fallbacks 800x400 en jsdom):
    // celda 9 con gap 4 (sobre la celda final) -> ancho 18+4+53*9+52*4 = 707.
    expect(wrapper.findAll("[data-testid='strip-cell']")).toHaveLength(365)
    const content = wrapper.find('.ys__content')
    expect(content.attributes('style') ?? '').toContain('width: 707px')
  })

  describe('tooltip de día al hover (igual que en meses)', () => {
    afterEach(() => {
      document.body.innerHTML = ''
    })

    function dayEvents(date: string, n: number): CalendarEvent[] {
      return Array.from({ length: n }, (_, i) => ({
        id: `${date}-${i}`,
        date,
        title: `Evento ${i}`,
        color: '#ff0000',
        calendarId: 'primary',
        start: `${date}T10:00:00Z`,
        end: `${date}T11:00:00Z`,
      }))
    }

    function mountTira(events: Map<string, CalendarEvent[]>) {
      return mount(YearStrip, {
        attachTo: document.body,
        props: {
          year: 2026,
          eventsByDate: events,
          monthNames: MONTH_NAMES,
          cellSize: 10,
        },
      })
    }

    it('las celdas no usan title nativo (el tooltip rico lo reemplaza)', () => {
      const wrapper = mountTira(new Map())
      for (const cell of wrapper.findAll("[data-testid='strip-cell']")) {
        expect(cell.attributes('title')).toBeUndefined()
      }
      wrapper.unmount()
    })

    it('muestra fecha exacta y títulos con dots al hacer hover en un día con eventos', async () => {
      const events = new Map([['2026-06-04', dayEvents('2026-06-04', 2)]])
      const wrapper = mountTira(events)
      await wrapper.find("[data-date='2026-06-04']").trigger('mouseenter')
      const tooltip = document.body.querySelector("[data-testid='day-tooltip']")
      expect(tooltip).not.toBeNull()
      expect(tooltip!.textContent).toContain('4 de junio de 2026')
      expect(tooltip!.textContent).toContain('Evento 0')
      expect(tooltip!.querySelectorAll("[data-testid='day-tooltip-dot']")).toHaveLength(2)
      wrapper.unmount()
    })

    it('muestra fecha y "Sin eventos" al hacer hover en un día vacío', async () => {
      const wrapper = mountTira(new Map())
      await wrapper.find("[data-date='2026-06-05']").trigger('mouseenter')
      const tooltip = document.body.querySelector("[data-testid='day-tooltip']")
      expect(tooltip).not.toBeNull()
      expect(tooltip!.textContent).toContain('5 de junio de 2026')
      expect(tooltip!.textContent).toContain('Sin eventos')
      wrapper.unmount()
    })

    it('el tooltip omite el evento ya representado por un examen (dedup)', async () => {
      const events = new Map([['2026-06-04', dayEvents('2026-06-04', 2)]])
      const overlayByDate = new Map([
        [
          '2026-06-04',
          [
            {
              id: 'exam_1',
              title: 'Parcial 1 de Análisis',
              color: 'rgb(var(--color-block-green))',
            },
          ],
        ],
      ])
      const wrapper = mount(YearStrip, {
        attachTo: document.body,
        props: {
          year: 2026,
          eventsByDate: events,
          monthNames: MONTH_NAMES,
          cellSize: 10,
          overlayByDate,
          linkedEventKeys: new Set([eventKey('primary', '2026-06-04-0')]),
        },
      })
      const cell = wrapper.find("[data-date='2026-06-04']")
      expect(cell.findAll("[data-testid='event-dot']")).toHaveLength(2)
      await cell.trigger('mouseenter')
      const tooltip = document.body.querySelector("[data-testid='day-tooltip']")
      // El examen aparece una sola vez: el evento de Google no se lista.
      expect(tooltip!.textContent).not.toContain('Evento 0')
      expect(tooltip!.textContent).toContain('Evento 1')
      expect(tooltip!.textContent).toContain('Parcial 1 de Análisis')
      expect(tooltip!.querySelectorAll("[data-testid='day-tooltip-item']")).toHaveLength(2)
      wrapper.unmount()
    })

    it('el tooltip muestra el examen del día (overlay) aunque no tenga eventos', async () => {
      const overlayByDate = new Map([
        [
          '2026-06-05',
          [
            {
              id: 'exam_1',
              title: 'Parcial 1 de Análisis',
              color: 'rgb(var(--color-block-green))',
            },
          ],
        ],
      ])
      const wrapper = mount(YearStrip, {
        attachTo: document.body,
        props: {
          year: 2026,
          eventsByDate: new Map(),
          monthNames: MONTH_NAMES,
          cellSize: 10,
          overlayByDate,
        },
      })
      await wrapper.find("[data-date='2026-06-05']").trigger('mouseenter')
      const tooltip = document.body.querySelector("[data-testid='day-tooltip']")
      expect(tooltip).not.toBeNull()
      expect(tooltip!.textContent).toContain('5 de junio de 2026')
      expect(tooltip!.textContent).toContain('Parcial 1 de Análisis')
      expect(tooltip!.textContent).not.toContain('Sin eventos')
      wrapper.unmount()
    })

    it('oculta el tooltip al salir el mouse de la celda', async () => {
      const wrapper = mountTira(new Map())
      const cell = wrapper.find("[data-date='2026-06-04']")
      await cell.trigger('mouseenter')
      expect(document.body.querySelector("[data-testid='day-tooltip']")).not.toBeNull()
      await cell.trigger('mouseleave')
      expect(document.body.querySelector("[data-testid='day-tooltip']")).toBeNull()
      wrapper.unmount()
    })

    it('limita el tooltip a 5 títulos y muestra +N más', async () => {
      const events = new Map([['2026-06-04', dayEvents('2026-06-04', 7)]])
      const wrapper = mountTira(events)
      await wrapper.find("[data-date='2026-06-04']").trigger('mouseenter')
      const tooltip = document.body.querySelector("[data-testid='day-tooltip']")
      expect(tooltip).not.toBeNull()
      expect(tooltip!.querySelectorAll("[data-testid='day-tooltip-item']")).toHaveLength(5)
      expect(tooltip!.textContent).toContain('+2 más')
      wrapper.unmount()
    })

    it('oculta el tooltip al scrollear la tira', async () => {
      const wrapper = mountTira(new Map())
      await wrapper.find("[data-date='2026-06-04']").trigger('mouseenter')
      expect(document.body.querySelector("[data-testid='day-tooltip']")).not.toBeNull()
      await wrapper.find("[data-testid='tira-scroller']").trigger('scroll')
      expect(document.body.querySelector("[data-testid='day-tooltip']")).toBeNull()
      wrapper.unmount()
    })
  })
})
