import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import GridItemVue from './GridItemVue.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'
import type { LayoutItem } from '@/stores/dashboard'

let dragCallbacks: Record<string, (...args: number[]) => void> = {}

vi.mock('@/composables/useDashDrag', () => ({
  useDashDrag: (
    _elRef: { value: HTMLElement | null },
    _editMode: unknown,
    callbacks: {
      onDragStart: () => void
      onDragMove: (dx: number, dy: number) => void
      onDragEnd: () => void
      onResizeStart: () => void
      onResizeMove: (dw: number, dh: number, dl?: number, dt?: number) => void
      onResizeEnd: () => void
    }
  ) => {
    dragCallbacks = callbacks as never
    return vi.fn()
  },
}))

const mockFlipTransform = vi.fn((..._args: unknown[]) => 'translate(50px, 30px) scale(1, 1)')
const mockFlipNeedsAnimation = vi.fn((..._args: unknown[]) => true)

vi.mock('@/composables/flip', () => ({
  flipTransform: (...args: unknown[]) => mockFlipTransform(...args),
  flipNeedsAnimation: (...args: unknown[]) => mockFlipNeedsAnimation(...args),
  FLIP_DURATION_MS: 180,
  FLIP_EASING: 'cubic-bezier(0.16, 1, 0.3, 1)',
}))

function makeItem(overrides: Partial<LayoutItem> = {}): LayoutItem {
  return { i: 'habits', x: 0, y: 0, w: 6, h: 4, minW: 1, minH: 1, ...overrides }
}

/**
 * Monta un item en modo edición con un contenedor de 1200×800 (col=100px,
 * row=80px) para poder razonar el snap en celdas enteras sin depender de
 * getBoundingClientRect (que happy-dom devuelve en cero).
 */
function mountResizable(item: Partial<LayoutItem> = {}) {
  const wrapper = mount(GridItemVue, {
    props: { item: makeItem(item), editMode: true },
  })
  const el = wrapper.element as HTMLElement
  const container = el.parentElement as HTMLElement
  Object.defineProperty(container, 'clientWidth', { value: 1200, configurable: true })
  Object.defineProperty(container, 'clientHeight', { value: 800, configurable: true })
  return { wrapper, el }
}

async function resize(
  wrapper: ReturnType<typeof mountResizable>['wrapper'],
  move: [dw: number, dh: number, dl: number, dt: number]
) {
  dragCallbacks.onResizeStart?.()
  dragCallbacks.onResizeMove?.(...move)
  dragCallbacks.onResizeEnd?.()
  await wrapper.vm.$nextTick()
}

describe('GridItemVue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dragCallbacks = {}
  })
  it('renderiza con grid-column/grid-row derivados de x/y/w/h', () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem({ x: 2, y: 3, w: 6, h: 4 }), editMode: false },
    })
    const el = wrapper.element as HTMLElement
    const style = el.getAttribute('style') ?? ''
    expect(style).toContain('grid-column: 3 / span 6')
    expect(style).toContain('grid-row: 4 / span 4')
  })

  it('no aplica position: absolute en reposo (lo posiciona la grilla)', () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem(), editMode: false },
    })
    const style = wrapper.element.getAttribute('style') ?? ''
    expect(style).not.toContain('position: absolute')
  })

  it('permite encoger el item para que el contenido se ajuste a lo disponible', () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem(), editMode: false },
    })
    expect(wrapper.classes()).toContain('min-w-0')
    expect(wrapper.classes()).toContain('min-h-0')
  })

  it('en modo edición apila por encima del vecino de su derecha para que la cruz no se recorte', () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem({ x: 3, y: 2, w: 6, h: 4 }), editMode: true },
    })
    const el = wrapper.element as HTMLElement
    const z = Number(el.style.zIndex)
    expect(z).toBeGreaterThan(0)
    const right = mount(GridItemVue, {
      props: { item: makeItem({ i: 'tasks', x: 9, y: 2, w: 3, h: 4 }), editMode: true },
    })
    expect(z).toBeGreaterThan(Number((right.element as HTMLElement).style.zIndex))
  })

  it('en reposo no crea stacking context por z-index ni cambia el flujo de la grilla', () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem({ x: 3, y: 2, w: 6, h: 4 }), editMode: false },
    })
    const el = wrapper.element as HTMLElement
    expect(el.style.zIndex).toBe('')
    expect(el.style.position).toBe('')
  })

  it('eleva el z-index mientras se arrastra para quedar por encima de los vecinos', async () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem({ x: 3, y: 2, w: 6, h: 4 }), editMode: true },
    })
    const el = wrapper.element as HTMLElement
    const restingZ = Number(el.style.zIndex)

    dragCallbacks.onDragStart()
    await wrapper.vm.$nextTick()

    expect(Number(el.style.zIndex)).toBeGreaterThan(restingZ)
    expect(wrapper.classes()).toContain('grid-item--dragging')

    dragCallbacks.onDragEnd()
    await wrapper.vm.$nextTick()

    expect(Number(el.style.zIndex)).toBe(restingZ)
  })

  it('emite moved en enteros tras un drag con snap', async () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem({ x: 0, y: 0, w: 6, h: 4 }), editMode: true },
    })
    const el = wrapper.element as HTMLElement
    Object.defineProperty(el, 'clientWidth', { value: 600, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: 400, configurable: true })
    const container = el.parentElement as HTMLElement
    Object.defineProperty(container, 'clientWidth', { value: 1200, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })

    dragCallbacks.onDragStart?.()
    dragCallbacks.onDragMove?.(100, 60)
    dragCallbacks.onDragEnd?.()
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('moved') as unknown[][]
    expect(emitted).toHaveLength(1)
    // Con el gap de 4px el paso es ~100.33px por col y ~60.4px por fila:
    // 100px cruza a la col 1 y 60px a la fila 1.
    expect(emitted[0]).toEqual(['habits', 1, 1])
  })

  it('emite resized en enteros tras un resize con snap (incluye posición)', async () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem({ x: 0, y: 0, w: 6, h: 4 }), editMode: true },
    })
    const el = wrapper.element as HTMLElement
    Object.defineProperty(el, 'clientWidth', { value: 600, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: 400, configurable: true })
    const container = el.parentElement as HTMLElement
    Object.defineProperty(container, 'clientWidth', { value: 1200, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })

    dragCallbacks.onResizeStart?.()
    dragCallbacks.onResizeMove?.(150, 60)
    dragCallbacks.onResizeEnd?.()
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('resized') as unknown[][]
    expect(emitted).toHaveLength(1)
    // x/y intactos: la arista opuesta (izquierda/arriba) queda anclada.
    // Con gap, el paso es ~100.33×60.4: 6 + 150/100.33 ≈ 7.5 → 7; 4 + 60/60.4 ≈ 5.
    expect(emitted[0]).toEqual(['habits', 0, 0, 7, 5])
  })

  it('emite preview con las celdas de destino en vivo durante el drag', async () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem({ x: 0, y: 0, w: 6, h: 4 }), editMode: true },
    })
    const el = wrapper.element as HTMLElement
    const container = el.parentElement as HTMLElement
    Object.defineProperty(container, 'clientWidth', { value: 1200, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })

    dragCallbacks.onDragStart?.()
    dragCallbacks.onDragMove?.(100, 60)
    await wrapper.vm.$nextTick()

    const previews = wrapper.emitted('preview') as unknown[][]
    // El gesto abre con la geometría actual y sigue con la celda redondeada.
    expect(previews[0]).toEqual(['habits', 0, 0, 6, 4])
    expect(previews[previews.length - 1]).toEqual(['habits', 1, 1, 6, 4])
  })

  it('clampa la zona de destino al borde de la grilla', async () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem({ x: 0, y: 0, w: 6, h: 4 }), editMode: true },
    })
    const el = wrapper.element as HTMLElement
    const container = el.parentElement as HTMLElement
    Object.defineProperty(container, 'clientWidth', { value: 1200, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })

    dragCallbacks.onDragStart?.()
    dragCallbacks.onDragMove?.(1000, 1000)
    await wrapper.vm.$nextTick()

    const previews = wrapper.emitted('preview') as unknown[][]
    // COLS - w = 12 - 6 = 6; ROWS - h = 10 - 4 = 6.
    expect(previews[previews.length - 1]).toEqual(['habits', 6, 6, 6, 4])
  })

  it('el preview y el movimiento comparten la misma zona (se suelta donde se previsualizó)', async () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem({ x: 0, y: 0, w: 6, h: 4 }), editMode: true },
    })
    const el = wrapper.element as HTMLElement
    const container = el.parentElement as HTMLElement
    Object.defineProperty(container, 'clientWidth', { value: 1200, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })

    dragCallbacks.onDragStart?.()
    dragCallbacks.onDragMove?.(250, 90)
    const previews = wrapper.emitted('preview') as unknown[][]
    const lastPreview = previews[previews.length - 1]
    dragCallbacks.onDragEnd?.()
    await wrapper.vm.$nextTick()

    const moved = wrapper.emitted('moved') as unknown[][]
    expect(moved[0]).toEqual(['habits', lastPreview[1], lastPreview[2]])
  })

  it('emite preview del fantasma con el tamaño resultante durante el resize', async () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem({ x: 0, y: 0, w: 6, h: 3 }), editMode: true },
    })
    const el = wrapper.element as HTMLElement
    const container = el.parentElement as HTMLElement
    Object.defineProperty(container, 'clientWidth', { value: 1200, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 800, configurable: true })

    dragCallbacks.onResizeStart?.()
    dragCallbacks.onResizeMove?.(100, 80)
    await wrapper.vm.$nextTick()

    const previews = wrapper.emitted('preview') as unknown[][]
    expect(previews[0]).toEqual(['habits', 0, 0, 6, 3])
    expect(previews[previews.length - 1]).toEqual(['habits', 0, 0, 7, 4])
  })

  it('el fantasma de resize desde la arista izquierda refleja la nueva posición', async () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem({ x: 6, y: 0, w: 4, h: 3 }), editMode: true },
    })
    const el = wrapper.element as HTMLElement
    const container = el.parentElement as HTMLElement
    Object.defineProperty(container, 'clientWidth', { value: 1200, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 800, configurable: true })

    dragCallbacks.onResizeStart?.()
    dragCallbacks.onResizeMove?.(100, 0, -100, 0)
    await wrapper.vm.$nextTick()

    const previews = wrapper.emitted('preview') as unknown[][]
    expect(previews[previews.length - 1]).toEqual(['habits', 5, 0, 5, 3])
  })

  it('cierra la previsualización al soltar (drag y resize)', async () => {
    const dragWrapper = mount(GridItemVue, { props: { item: makeItem(), editMode: true } })
    dragCallbacks.onDragStart?.()
    dragCallbacks.onDragMove?.(10, 10)
    dragCallbacks.onDragEnd?.()
    await dragWrapper.vm.$nextTick()
    expect(dragWrapper.emitted('preview-end')).toHaveLength(1)

    const resizeWrapper = mount(GridItemVue, { props: { item: makeItem(), editMode: true } })
    dragCallbacks.onResizeStart?.()
    dragCallbacks.onResizeMove?.(10, 10)
    dragCallbacks.onResizeEnd?.()
    await resizeWrapper.vm.$nextTick()
    expect(resizeWrapper.emitted('preview-end')).toHaveLength(1)
  })

  it('no emite preview en vivo si el contenedor no tiene dimensiones medibles', async () => {
    const wrapper = mount(GridItemVue, { props: { item: makeItem(), editMode: true } })
    dragCallbacks.onDragStart?.()
    // El start emite la geometría conocida; el move no puede calcular sin contenedor.
    const before = (wrapper.emitted('preview') as unknown[][]).length
    dragCallbacks.onDragMove?.(50, 30)
    const after = wrapper.emitted('preview') as unknown[][]
    expect(after.length).toBe(before)
  })

  it('no re-emite preview de drag mientras el puntero sigue en la misma celda y sí al cruzar a otra', async () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem({ x: 0, y: 0, w: 6, h: 4 }), editMode: true },
    })
    const el = wrapper.element as HTMLElement
    const container = el.parentElement as HTMLElement
    Object.defineProperty(container, 'clientWidth', { value: 1200, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })

    dragCallbacks.onDragStart?.()
    dragCallbacks.onDragMove?.(2, 2)
    const baseline = (wrapper.emitted('preview') as unknown[][]).length

    // Un segundo movimiento que cae en la misma celda snappeada no re-emite.
    dragCallbacks.onDragMove?.(2, 2)
    expect((wrapper.emitted('preview') as unknown[][]).length).toBe(baseline)

    // Al cruzar a otra celda la previsualización vuelve a emitirse.
    dragCallbacks.onDragMove?.(200, 200)
    expect((wrapper.emitted('preview') as unknown[][]).length).toBeGreaterThan(baseline)
  })

  it('no re-emite preview de resize mientras las celdas no cambian y sí al cruzar', async () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem({ x: 0, y: 0, w: 6, h: 4 }), editMode: true },
    })
    const el = wrapper.element as HTMLElement
    const container = el.parentElement as HTMLElement
    Object.defineProperty(container, 'clientWidth', { value: 1200, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 800, configurable: true })

    dragCallbacks.onResizeStart?.()
    dragCallbacks.onResizeMove?.(2, 2)
    const baseline = (wrapper.emitted('preview') as unknown[][]).length

    dragCallbacks.onResizeMove?.(2, 2)
    expect((wrapper.emitted('preview') as unknown[][]).length).toBe(baseline)

    dragCallbacks.onResizeMove?.(200, 200)
    expect((wrapper.emitted('preview') as unknown[][]).length).toBeGreaterThan(baseline)
  })

  it('mide el contenedor una sola vez por gesto de drag (no en cada movimiento)', () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem({ x: 0, y: 0, w: 6, h: 4 }), editMode: true },
    })
    const el = wrapper.element as HTMLElement
    const container = el.parentElement as HTMLElement
    const width = vi.fn(() => 1200)
    const height = vi.fn(() => 600)
    Object.defineProperty(container, 'clientWidth', { get: width, configurable: true })
    Object.defineProperty(container, 'clientHeight', { get: height, configurable: true })

    dragCallbacks.onDragStart?.()
    dragCallbacks.onDragMove?.(50, 30)
    dragCallbacks.onDragMove?.(50, 30)
    dragCallbacks.onDragMove?.(50, 30)

    expect(width).toHaveBeenCalledTimes(1)
    expect(height).toHaveBeenCalledTimes(1)
  })

  it('mide el contenedor una sola vez por gesto de resize (no en cada movimiento)', () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem({ x: 0, y: 0, w: 6, h: 4 }), editMode: true },
    })
    const el = wrapper.element as HTMLElement
    const container = el.parentElement as HTMLElement
    const width = vi.fn(() => 1200)
    const height = vi.fn(() => 800)
    Object.defineProperty(container, 'clientWidth', { get: width, configurable: true })
    Object.defineProperty(container, 'clientHeight', { get: height, configurable: true })

    dragCallbacks.onResizeStart?.()
    dragCallbacks.onResizeMove?.(100, 80)
    dragCallbacks.onResizeMove?.(100, 80)

    expect(width).toHaveBeenCalledTimes(1)
    expect(height).toHaveBeenCalledTimes(1)
  })

  // Cada caso parte de un contenedor 1200×800 (col=100px, row=80px) y mueve
  // una arista o esquina. El deltaRect de interactjs es per-evento: dw/dh son
  // el crecimiento y dl/dt el desplazamiento del borde opuesto.
  const RESIZE_CASES: Array<{
    name: string
    item: Partial<LayoutItem>
    move: [number, number, number, number]
    expected: [string, number, number, number, number]
  }> = [
    {
      name: 'arista derecha',
      item: { x: 0, y: 0, w: 6, h: 3 },
      move: [100, 0, 0, 0],
      expected: ['habits', 0, 0, 7, 3],
    },
    {
      name: 'arista izquierda',
      item: { x: 6, y: 0, w: 4, h: 3 },
      move: [100, 0, -100, 0],
      expected: ['habits', 5, 0, 5, 3],
    },
    {
      name: 'arista inferior',
      item: { x: 0, y: 0, w: 6, h: 3 },
      move: [0, 80, 0, 0],
      expected: ['habits', 0, 0, 6, 4],
    },
    {
      name: 'arista superior',
      item: { x: 0, y: 5, w: 6, h: 3 },
      move: [0, 80, 0, -80],
      expected: ['habits', 0, 4, 6, 4],
    },
    {
      name: 'esquina inferior derecha',
      item: { x: 0, y: 0, w: 4, h: 3 },
      move: [100, 80, 0, 0],
      expected: ['habits', 0, 0, 5, 4],
    },
    {
      name: 'esquina superior izquierda',
      item: { x: 6, y: 6, w: 4, h: 3 },
      move: [100, 80, -100, -80],
      expected: ['habits', 5, 5, 5, 4],
    },
    {
      name: 'esquina superior derecha',
      item: { x: 0, y: 6, w: 4, h: 3 },
      move: [100, 80, 0, -80],
      expected: ['habits', 0, 5, 5, 4],
    },
    {
      name: 'esquina inferior izquierda',
      item: { x: 6, y: 0, w: 4, h: 3 },
      move: [100, 80, -100, 0],
      expected: ['habits', 5, 0, 5, 4],
    },
  ]

  it.each(RESIZE_CASES)(
    'redimensiona desde la $name con snap y anclaje',
    async ({ item, move, expected }) => {
      const { wrapper } = mountResizable(item)
      await resize(wrapper, move)
      const emitted = wrapper.emitted('resized') as unknown[][]
      expect(emitted).toHaveLength(1)
      expect(emitted[0]).toEqual(expected)
    }
  )

  it('achicar desde la izquierda un widget en su mínimo no lo desliza', async () => {
    // Pomodoro 2×3 en (6,0): tirar la arista izquierda hacia adentro mantiene
    // x=6 y w=2 (la arista derecha queda anclada); antes se deslizaba a x=7.
    const { wrapper } = mountResizable({ x: 6, y: 0, w: 2, h: 3, minW: 2, minH: 3 })
    await resize(wrapper, [-100, 0, 100, 0])
    const emitted = wrapper.emitted('resized') as unknown[][]
    expect(emitted[0]).toEqual(['habits', 6, 0, 2, 3])
  })

  it('achicar desde arriba un widget en su mínimo no lo desliza', async () => {
    const { wrapper } = mountResizable({ x: 0, y: 3, w: 6, h: 3, minW: 2, minH: 3 })
    await resize(wrapper, [0, -60, 0, 60])
    const emitted = wrapper.emitted('resized') as unknown[][]
    expect(emitted[0]).toEqual(['habits', 0, 3, 6, 3])
  })

  it('desde la arista izquierda el preview se desplaza con transform (borde opuesto anclado)', () => {
    const { el } = mountResizable({ x: 6, y: 0, w: 4, h: 3 })
    dragCallbacks.onResizeStart?.()
    dragCallbacks.onResizeMove?.(100, 0, -100, 0)
    // La grilla posiciona el item; el preview crece hacia la izquierda vía transform.
    expect(el.style.left).toBe('')
    expect(el.style.top).toBe('')
    expect(el.style.width).toBe('500px')
    expect(el.style.transform).toContain('translate(-100px, 0px)')
    dragCallbacks.onResizeEnd?.()
    expect(el.style.transform).toBe('')
  })

  it('desde la arista superior el preview se desplaza en vertical con transform', () => {
    const { el } = mountResizable({ x: 0, y: 5, w: 6, h: 3 })
    dragCallbacks.onResizeStart?.()
    dragCallbacks.onResizeMove?.(0, 80, 0, -80)
    expect(el.style.height).toBe('320px')
    expect(el.style.transform).toContain('translate(0px, -80px)')
    dragCallbacks.onResizeEnd?.()
  })

  it('rechaza el crecimiento que se saldría del borde izquierdo clampeando la posición', async () => {
    // x=1, se tira 200px a la izquierda: el left resultante sería -100 → clamp a 0.
    const { wrapper } = mountResizable({ x: 1, y: 0, w: 4, h: 3 })
    await resize(wrapper, [200, 0, -200, 0])
    const emitted = wrapper.emitted('resized') as unknown[][]
    expect(emitted[0]).toEqual(['habits', 0, 0, 6, 3])
  })

  it('en modo edición expone handles de resize con el cursor correspondiente en cada arista y esquina', () => {
    const wrapper = mount(GridItemVue, { props: { item: makeItem(), editMode: true } })
    const expectedCursors: Record<string, string> = {
      n: 'cursor-ns-resize',
      s: 'cursor-ns-resize',
      e: 'cursor-ew-resize',
      w: 'cursor-ew-resize',
      ne: 'cursor-nesw-resize',
      sw: 'cursor-nesw-resize',
      nw: 'cursor-nwse-resize',
      se: 'cursor-nwse-resize',
    }
    for (const [position, cursor] of Object.entries(expectedCursors)) {
      const handle = wrapper.find(`[data-testid="resize-handle-${position}"]`)
      expect(handle.exists()).toBe(true)
      expect(handle.classes()).toContain(cursor)
    }
  })

  it('fuera del modo edición no renderiza handles de resize', () => {
    const wrapper = mount(GridItemVue, { props: { item: makeItem(), editMode: false } })
    expect(wrapper.find('[data-testid="resize-handle-n"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="resize-handle-se"]').exists()).toBe(false)
  })

  it('en modo edición los grips de esquina aparecen con hover y se van al salir', async () => {
    const wrapper = mount(GridItemVue, { props: { item: makeItem(), editMode: true } })
    expect(wrapper.find('[data-testid="corner-grip-nw"]').exists()).toBe(false)

    await wrapper.trigger('mouseenter')
    for (const position of ['nw', 'ne', 'se', 'sw']) {
      const grip = wrapper.find(`[data-testid="corner-grip-${position}"]`)
      expect(grip.exists()).toBe(true)
      // Cada grip son dos líneas (una horizontal y una vertical).
      expect(grip.findAll('[data-testid="corner-grip-line"]')).toHaveLength(2)
    }

    await wrapper.trigger('mouseleave')
    expect(wrapper.find('[data-testid="corner-grip-nw"]').exists()).toBe(false)
  })

  it('en reposo no renderiza grips de esquina aunque haya hover', async () => {
    const wrapper = mount(GridItemVue, { props: { item: makeItem(), editMode: false } })
    await wrapper.trigger('mouseenter')
    expect(wrapper.find('[data-testid="corner-grip-nw"]').exists()).toBe(false)
  })

  it('agrega clase grid-item--dragging durante el gesto', async () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem(), editMode: true },
    })
    dragCallbacks.onDragStart?.()
    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).toContain('grid-item--dragging')
    dragCallbacks.onDragEnd?.()
    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).not.toContain('grid-item--dragging')
  })

  it('escribe transform translate durante el drag (no left/top)', async () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem(), editMode: true },
    })
    const el = wrapper.element as HTMLElement
    dragCallbacks.onDragStart?.()
    dragCallbacks.onDragMove?.(25, 10)
    expect(el.style.transform).toContain('translate')
    expect(el.style.left).toBe('')
    dragCallbacks.onDragEnd?.()
  })

  it('el preview de resize permanece anclado: no altera position/left/top (solo width/height)', async () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem({ x: 6, y: 7, w: 4, h: 3 }), editMode: true },
    })
    const el = wrapper.element as HTMLElement
    const container = el.parentElement as HTMLElement
    Object.defineProperty(container, 'clientWidth', { value: 1200, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 800, configurable: true })
    Object.defineProperty(el, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 600,
        top: 560,
        width: 400,
        height: 240,
        right: 1000,
        bottom: 800,
        x: 600,
        y: 560,
        toJSON() {
          return {}
        },
      }),
    })
    dragCallbacks.onResizeStart?.()
    // Anclaje: no debe desplazarse (sin position/left/top)
    expect(el.style.position).toBe('')
    expect(el.style.left).toBe('')
    expect(el.style.top).toBe('')
    expect(el.style.width).toContain('px')
    expect(el.style.height).toContain('px')
    // Al mover, sigue anclado y solo crece width/height
    dragCallbacks.onResizeMove?.(50, 20)
    expect(el.style.position).toBe('')
    expect(el.style.left).toBe('')
    expect(el.style.top).toBe('')
    expect(el.style.width).toContain('px')
    expect(el.style.height).toContain('px')
    // El ancho refleja el delta acumulado sobre el rect medido (sin salto inicial)
    expect(el.style.width).toBe('450px')
    expect(el.style.height).toBe('260px')
    dragCallbacks.onResizeEnd?.()
    expect(el.style.width).toBe('')
    expect(el.style.height).toBe('')
  })

  it('al soltar un drag aplica FLIP: llama flipTransform/flipNeedsAnimation e inyecta grid-item--flip', async () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem({ x: 0, y: 0, w: 6, h: 4 }), editMode: true },
    })
    const el = wrapper.element as HTMLElement
    Object.defineProperty(el, 'clientWidth', { value: 600, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: 400, configurable: true })
    const container = el.parentElement as HTMLElement
    Object.defineProperty(container, 'clientWidth', { value: 1200, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
    Object.defineProperty(el, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 100, top: 60, width: 600, height: 240 }),
    })
    Object.defineProperty(el.parentElement!, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 1200, height: 600 }),
    })

    dragCallbacks.onDragStart?.()
    dragCallbacks.onDragMove?.(50, 30)
    dragCallbacks.onDragEnd?.()
    await flushPromises()
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(mockFlipNeedsAnimation).toHaveBeenCalled()
    expect(mockFlipTransform).toHaveBeenCalled()
    expect(wrapper.classes()).toContain('grid-item--flip')
    expect(wrapper.classes()).not.toContain('grid-item--dragging')
    // Anima solo transform: nunca left/top/width/height.
    expect(el.style.left).toBe('')
    expect(el.style.top).toBe('')
    expect(el.style.width).toBe('')
    expect(el.style.height).toBe('')
  })

  it('al soltar un resize aplica FLIP con escala (transición de transform + clase)', async () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem({ x: 0, y: 0, w: 6, h: 4 }), editMode: true },
    })
    const el = wrapper.element as HTMLElement
    Object.defineProperty(el, 'clientWidth', { value: 600, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: 400, configurable: true })
    const container = el.parentElement as HTMLElement
    Object.defineProperty(container, 'clientWidth', { value: 1200, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
    Object.defineProperty(el, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 750, height: 300 }),
    })
    Object.defineProperty(el.parentElement!, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 1200, height: 600 }),
    })

    dragCallbacks.onResizeStart?.()
    dragCallbacks.onResizeMove?.(50, 0)
    dragCallbacks.onResizeEnd?.()
    await flushPromises()
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(mockFlipNeedsAnimation).toHaveBeenCalled()
    expect(mockFlipTransform).toHaveBeenCalled()
    expect(wrapper.classes()).toContain('grid-item--flip')
    expect(el.style.position).toBe('')
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem(), editMode: true },
      slots: { default: '<div>contenido</div>' },
    })
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })

  it('en modo edición el contenido se desatura, se atenúa y deja de recibir punteros', () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem(), editMode: true },
      slots: { default: '<div>contenido</div>' },
    })
    const content = wrapper.find('[data-testid="widget-content"]')
    expect(content.exists()).toBe(true)
    const style = content.attributes('style') ?? ''
    expect(style).toContain('grayscale(1)')
    expect(style).toContain('opacity: 0.6')
    expect(style).toContain('pointer-events: none')
  })

  it('en reposo el contenido se ve normal y recibe punteros', () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem(), editMode: false },
      slots: { default: '<div>contenido</div>' },
    })
    const content = wrapper.find('[data-testid="widget-content"]')
    expect(content.exists()).toBe(true)
    const style = content.attributes('style') ?? ''
    expect(style).not.toContain('grayscale')
    expect(style).not.toContain('pointer-events')
  })

  it('los controles de edición viven fuera de la capa desactivada', () => {
    const wrapper = mount(GridItemVue, {
      props: { item: makeItem(), editMode: true },
      slots: {
        default: '<div>contenido</div>',
        controls: '<button data-testid="widget-control">quitar</button>',
      },
    })
    const content = wrapper.find('[data-testid="widget-content"]')
    const control = wrapper.find('[data-testid="widget-control"]')
    expect(control.exists()).toBe(true)
    expect(content.element.contains(control.element)).toBe(false)
  })
})
