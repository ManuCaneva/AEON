import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HeatmapGrid from './HeatmapGrid.vue'

function todayLocalStr(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

function cellAlphas(w: ReturnType<typeof mount>): number[] {
  return w
    .findAll("[data-testid='heat-cell']")
    .map((el) => (el.element as HTMLElement).style.background)
    .filter((bg) => bg.startsWith('rgba('))
    .map((bg) => Number(bg.slice(bg.lastIndexOf(',') + 1, -1)))
}

describe('HeatmapGrid (column-major)', () => {
  it('usa repeat(cols, 10px) en grid-template-columns', () => {
    const w = mount(HeatmapGrid, { props: { logs: [], color: '#5e6ad2', days: 364 } })
    const grid = w.find("[data-testid='heat-grid-inner']")
    expect((grid.element as HTMLElement).style.gridTemplateColumns).toContain('repeat(52')
    expect((grid.element as HTMLElement).style.gridTemplateColumns).toContain('10px')
  })

  it('usa repeat(7, 10px) en grid-template-rows', () => {
    const w = mount(HeatmapGrid, { props: { logs: [], color: '#5e6ad2', days: 364 } })
    const grid = w.find("[data-testid='heat-grid-inner']")
    expect((grid.element as HTMLElement).style.gridTemplateRows).toContain('repeat(7')
    expect((grid.element as HTMLElement).style.gridTemplateRows).toContain('10px')
  })

  it('usa gap de 2px (separación entre celdas)', () => {
    const w = mount(HeatmapGrid, { props: { logs: [], color: '#5e6ad2', days: 364 } })
    expect((w.find("[data-testid='heat-grid-inner']").element as HTMLElement).style.gap).toBe('2px')
  })

  it('celdas usan rounded-[2px] (estilo GitHub)', () => {
    const w = mount(HeatmapGrid, { props: { logs: [], color: '#5e6ad2', days: 364 } })
    const cell = w.find("[data-testid='heat-cell']")
    expect(cell.classes()).toContain('rounded-[2px]')
  })

  it('celdas usan transition-colors duration-200', () => {
    const w = mount(HeatmapGrid, { props: { logs: [], color: '#5e6ad2', days: 364 } })
    const cell = w.find("[data-testid='heat-cell']")
    expect(cell.classes()).toContain('transition-colors')
    expect(cell.classes()).toContain('duration-200')
  })

  it('rendera cols*rows celdas basado en columnas visibles', () => {
    const w = mount(HeatmapGrid, { props: { logs: [], color: '#5e6ad2', days: 364 } })
    expect(w.findAll("[data-testid='heat-cell']")).toHaveLength(364)
  })

  it('celda completada usa shadeFor al 100%', () => {
    const today = todayLocalStr()
    const w = mount(HeatmapGrid, {
      props: {
        logs: [
          {
            id: '1',
            habit_id: 'h',
            log_date: today,
            completed_at: today,
            note: null,
            count: 1,
            created_at: today,
          },
        ],
        color: '#5e6ad2',
        days: 364,
      },
    })
    const filled = w
      .findAll("[data-testid='heat-cell']")
      .find((el) => (el.element as HTMLElement).style.background === 'rgba(94, 106, 210, 1)')
    expect(filled).toBeTruthy()
  })

  it('actualiza las celdas cuando cambian los logs', async () => {
    const today = todayLocalStr()
    const w = mount(HeatmapGrid, {
      props: {
        logs: [
          {
            id: '1',
            habit_id: 'h',
            log_date: today,
            completed_at: today,
            note: null,
            count: 1,
            created_at: today,
          },
        ],
        color: '#5e6ad2',
        days: 364,
      },
    })
    const hasFilled = () =>
      w
        .findAll("[data-testid='heat-cell']")
        .some((el) => (el.element as HTMLElement).style.background === 'rgba(94, 106, 210, 1)')

    expect(hasFilled()).toBe(true)

    await w.setProps({ logs: [] })
    expect(hasFilled()).toBe(false)
  })

  it('celda no completada usa shadeFor al 15%', () => {
    const w = mount(HeatmapGrid, { props: { logs: [], color: '#5e6ad2', days: 364 } })
    const off = w
      .findAll("[data-testid='heat-cell']")
      .find((el) => (el.element as HTMLElement).style.background === 'rgba(94, 106, 210, 0.15)')
    expect(off).toBeTruthy()
  })

  it('celda con progreso parcial usa escala anclada a la base (4/8 → 57.5%)', () => {
    const today = todayLocalStr()
    const w = mount(HeatmapGrid, {
      props: {
        logs: [
          {
            id: '1',
            habit_id: 'h',
            log_date: today,
            completed_at: today,
            note: null,
            count: 4,
            created_at: today,
          },
        ],
        color: '#5e6ad2',
        days: 364,
        target: 8,
      },
    })
    const alphas = cellAlphas(w)
    const partial = alphas.filter((a) => a > 0.15)
    expect(partial).toHaveLength(1)
    expect(partial[0]).toBeCloseTo(0.575)
  })

  it('celda con progreso parcial arranca desde la tonalidad base (1/20 → ≈0.19, nunca más oscura que 0.15)', () => {
    const today = todayLocalStr()
    const w = mount(HeatmapGrid, {
      props: {
        logs: [
          {
            id: '1',
            habit_id: 'h',
            log_date: today,
            completed_at: today,
            note: null,
            count: 1,
            created_at: today,
          },
        ],
        color: '#5e6ad2',
        days: 364,
        target: 20,
      },
    })
    const alphas = cellAlphas(w)
    expect(alphas).toContain(0.15)
    const partial = alphas.filter((a) => a > 0.15)
    expect(partial).toHaveLength(1)
    expect(partial[0]).toBeCloseTo(0.1925)
  })

  it('con target=1 la intensidad colapsa al comportamiento binario (count 1 → 100%)', () => {
    const today = todayLocalStr()
    const w = mount(HeatmapGrid, {
      props: {
        logs: [
          {
            id: '1',
            habit_id: 'h',
            log_date: today,
            completed_at: today,
            note: null,
            count: 1,
            created_at: today,
          },
        ],
        color: '#5e6ad2',
        days: 364,
      },
    })
    const filled = w
      .findAll("[data-testid='heat-cell']")
      .find((el) => (el.element as HTMLElement).style.background === 'rgba(94, 106, 210, 1)')
    expect(filled).toBeTruthy()
  })

  it('hoy completado tiene ring (box-shadow)', () => {
    const today = todayLocalStr()
    const w = mount(HeatmapGrid, {
      props: {
        logs: [
          {
            id: '1',
            habit_id: 'h',
            log_date: today,
            completed_at: today,
            note: null,
            count: 1,
            created_at: today,
          },
        ],
        color: '#5e6ad2',
        days: 364,
      },
    })
    const ringed = w
      .findAll("[data-testid='heat-cell']")
      .find((el) => (el.element as HTMLElement).style.boxShadow !== '')
    expect(ringed).toBeTruthy()
  })

  it('hoy con progreso parcial no tiene ring (4/8 → sin box-shadow)', () => {
    const today = todayLocalStr()
    const w = mount(HeatmapGrid, {
      props: {
        logs: [
          {
            id: '1',
            habit_id: 'h',
            log_date: today,
            completed_at: today,
            note: null,
            count: 4,
            created_at: today,
          },
        ],
        color: '#5e6ad2',
        days: 364,
        target: 8,
      },
    })
    const ringed = w
      .findAll("[data-testid='heat-cell']")
      .find((el) => (el.element as HTMLElement).style.boxShadow !== '')
    expect(ringed).toBeUndefined()
  })

  it('usa grid-auto-flow: column para renderizado column-major', () => {
    const w = mount(HeatmapGrid, { props: { logs: [], color: '#5e6ad2', days: 364 } })
    const grid = w.find("[data-testid='heat-grid-inner']")
    expect((grid.element as HTMLElement).style.gridAutoFlow).toBe('column')
  })

  it('el contenedor recorta el overflow de la ventana visible', () => {
    const w = mount(HeatmapGrid, { props: { logs: [], color: '#5e6ad2', days: 364 } })
    const container = w.find("[data-testid='heat-grid']")
    expect(container.classes()).toContain('w-full')
    expect(container.classes()).toContain('overflow-hidden')
  })

  it('el grid interno tiene ancho intrínseco y se alinea a la derecha (DOM constante)', () => {
    const w = mount(HeatmapGrid, { props: { logs: [], color: '#5e6ad2', days: 364 } })
    const inner = w.find("[data-testid='heat-grid-inner']")
    expect(inner.classes()).toContain('w-max')
    expect(inner.classes()).toContain('ml-auto')
    // Sin transform: el grid no se reposiciona por cuadro durante la animación.
    expect((inner.element as HTMLElement).style.transform).toBe('')
    // El grid interno es el que porta las plantillas de grilla; el contenedor no.
    expect((inner.element as HTMLElement).style.gridTemplateColumns).toContain('repeat(52')
    expect(
      (w.find("[data-testid='heat-grid']").element as HTMLElement).style.gridTemplateColumns
    ).toBe('')
  })

  it('renderiza todas las columnas de dataCols (DOM constante, sin columnas visibles)', () => {
    const w = mount(HeatmapGrid, { props: { logs: [], color: '#5e6ad2', days: 364 } })
    const inner = w.find("[data-testid='heat-grid-inner']")
    expect((inner.element as HTMLElement).style.gridTemplateColumns).toBe('repeat(52, 10px)')
  })
})
