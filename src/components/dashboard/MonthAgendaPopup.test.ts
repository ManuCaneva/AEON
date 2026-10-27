import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MonthAgendaPopup from './MonthAgendaPopup.vue'
import Modal from '@/components/ui/Modal.vue'
import type { MonthAgendaItem } from '@/lib/monthAgenda'
import { hasRawPaletteColor } from '@/test/colorGuard'

const WEEKDAYS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

function item(id: string, title: string, color: string): MonthAgendaItem {
  return { id, title, color, kind: 'event' }
}

function factory(props: Record<string, unknown> = {}) {
  return mount(MonthAgendaPopup, {
    props: {
      open: true,
      year: 2025,
      month: 0,
      agendaByDate: new Map<string, MonthAgendaItem[]>(),
      today: '2025-01-15',
      ...props,
    },
    global: { stubs: { teleport: true } },
  })
}

function cellWithDate(wrapper: ReturnType<typeof factory>, date: string) {
  return wrapper
    .findAll("[data-testid='month-agenda-cell']")
    .find((c) => c.attributes('data-date') === date)!
}

describe('MonthAgendaPopup', () => {
  it('cerrado: no renderiza la grilla', () => {
    const wrapper = factory({ open: false })
    expect(wrapper.findAll("[data-testid='month-agenda-cell']")).toHaveLength(0)
  })

  it('renderiza 42 celdas (6 semanas × 7 días) y el header DOM..SÁB', () => {
    const wrapper = factory()
    expect(wrapper.findAll("[data-testid='month-agenda-cell']")).toHaveLength(42)
    const labels = wrapper.findAll("[data-testid='month-agenda-weekday']")
    expect(labels.map((l) => l.text())).toEqual(WEEKDAYS)
  })

  it('el título muestra el mes capitalizado del año, en español', () => {
    const wrapper = factory()
    expect(wrapper.find("[data-testid='month-agenda-title']").text()).toBe('Enero de 2025')
  })

  it('la flecha siguiente avanza un mes', async () => {
    const wrapper = factory()
    await wrapper.find("[data-testid='month-agenda-next']").trigger('click')
    expect(wrapper.find("[data-testid='month-agenda-title']").text()).toBe('Febrero de 2025')
  })

  it('la flecha anterior desde enero va a diciembre del año anterior', async () => {
    const wrapper = factory()
    await wrapper.find("[data-testid='month-agenda-prev']").trigger('click')
    expect(wrapper.find("[data-testid='month-agenda-title']").text()).toBe('Diciembre de 2024')
  })

  it("'Hoy' vuelve al mes de hoy después de navegar", async () => {
    const wrapper = factory()
    await wrapper.find("[data-testid='month-agenda-next']").trigger('click')
    await wrapper.find("[data-testid='month-agenda-next']").trigger('click')
    await wrapper.find("[data-testid='month-agenda-hoy']").trigger('click')
    expect(wrapper.find("[data-testid='month-agenda-title']").text()).toBe('Enero de 2025')
  })

  it('al reabrir el popup vuelve al mes de las props', async () => {
    const wrapper = factory()
    await wrapper.find("[data-testid='month-agenda-next']").trigger('click')
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    expect(wrapper.find("[data-testid='month-agenda-title']").text()).toBe('Enero de 2025')
  })

  it('muestra máximo 4 ítems por celda y el desborde como "+N más"', () => {
    const items = Array.from({ length: 7 }, (_, i) => item(`e${i}`, `Evento ${i}`, '#e55e54'))
    const wrapper = factory({ agendaByDate: new Map([['2025-01-10', items]]) })
    const cell = cellWithDate(wrapper, '2025-01-10')
    expect(cell.findAll("[data-testid='month-agenda-item']")).toHaveLength(4)
    expect(cell.find("[data-testid='month-agenda-overflow']").text()).toBe('+3 más')
  })

  it('las celdas de otros meses se atenúan pero muestran sus eventos', () => {
    const wrapper = factory({
      agendaByDate: new Map([['2024-12-29', [item('e1', 'Cierre de año', '#e55e54')]]]),
    })
    const cell = cellWithDate(wrapper, '2024-12-29')
    expect(cell.classes()).toContain('opacity-40')
    expect(cell.findAll("[data-testid='month-agenda-item']")).toHaveLength(1)
  })

  it('hacer click en una celda emite select-day con su fecha', async () => {
    const wrapper = factory()
    await cellWithDate(wrapper, '2025-01-15').trigger('click')
    expect(wrapper.emitted('select-day')).toBeTruthy()
    expect(wrapper.emitted('select-day')![0]).toEqual(['2025-01-15'])
  })

  it('hacer click en una celda de otro mes emite su fecha real', async () => {
    const wrapper = factory()
    await cellWithDate(wrapper, '2024-12-29').trigger('click')
    expect(wrapper.emitted('select-day')![0]).toEqual(['2024-12-29'])
  })

  it('el día de hoy se resalta', () => {
    const wrapper = factory()
    const cell = cellWithDate(wrapper, '2025-01-15')
    expect(cell.classes()).toContain('bg-accent-purple-tint/60')
    expect(cell.find("[data-testid='month-agenda-daynum']").classes()).toContain(
      'text-accent-purple'
    )
  })

  it('los ítems muestran nombre y color, sin horas', () => {
    const wrapper = factory({
      agendaByDate: new Map([
        [
          '2025-01-05',
          [
            item('e1', 'Examen de Álgebra', '#e55e54'),
            item('e2', 'Entrega TP', 'rgb(var(--color-block-green))'),
          ],
        ],
      ]),
    })
    const cell = cellWithDate(wrapper, '2025-01-05')
    const bars = cell.findAll("[data-testid='month-agenda-item']")
    expect(bars[0].text()).toBe('Examen de Álgebra')
    expect(bars[1].text()).toBe('Entrega TP')
    for (const bar of bars) expect(bar.text()).not.toMatch(/\d{2}:\d{2}/)
    expect(bars[0].attributes('style')).toContain('background-color: rgba(229, 94, 84, 0.26)')
    expect(bars[0].attributes('style')).toContain('border-left-color: #e55e54')
    expect(bars[1].attributes('style')).toContain(
      'border-left-color: rgb(var(--color-block-green))'
    )
  })

  it('el cierre del modal (Esc / backdrop) se propaga como close', async () => {
    const wrapper = factory()
    wrapper.findComponent(Modal).vm.$emit('close')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const wrapper = factory({
      agendaByDate: new Map([['2025-01-05', [item('e1', 'Examen', '#e55e54')]]]),
    })
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })
})
