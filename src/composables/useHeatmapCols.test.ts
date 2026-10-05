import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, ref, nextTick, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useHeatmapCols } from './useHeatmapCols'

type ResizeCb = (entries?: ResizeObserverEntry[]) => void

let resizeCallbacks: ResizeCb[] = []

function mockResizeObserver() {
  resizeCallbacks = []
  class MockResizeObserver {
    constructor(cb: ResizeCb) {
      resizeCallbacks.push(cb)
    }
    observe = vi.fn()
    disconnect = vi.fn()
  }
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
}

function createTestComponent(
  width: number,
  options: Omit<Parameters<typeof useHeatmapCols>[0], 'containerRef'>
) {
  const el = document.createElement('div')
  let reads = 0
  Object.defineProperty(el, 'clientWidth', {
    get: () => {
      reads++
      return width
    },
    configurable: true,
  })
  document.body.appendChild(el)

  let colsRef: Ref<number> | undefined
  let sizeRef: Ref<number> | undefined

  const wrapper = mount(
    defineComponent({
      setup() {
        const containerRef = ref<HTMLElement | null>(el)
        const result = useHeatmapCols({ ...options, containerRef })
        colsRef = result.cols
        sizeRef = result.actualCellSize
        return () => h('div')
      },
    })
  )

  return {
    get cols() {
      return colsRef?.value
    },
    get actualCellSize() {
      return sizeRef?.value
    },
    get reads() {
      return reads
    },
    unmount: () => wrapper.unmount(),
  }
}

function observerEntry(width: number): ResizeObserverEntry[] {
  return [{ contentRect: { width } } as unknown as ResizeObserverEntry]
}

describe('useHeatmapCols', () => {
  beforeEach(() => {
    mockResizeObserver()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('con ancho amplio: mantiene 52 cols y cellSize 10', async () => {
    const vm = createTestComponent(700, { dataCols: 52, cellSize: 10, gap: 2 })
    await nextTick()
    expect(vm.cols).toBe(52)
    expect(vm.actualCellSize).toBe(10)
  })

  it('con ancho insuficiente: reduce cols en lugar de cellSize', async () => {
    const vm = createTestComponent(200, { dataCols: 52, cellSize: 10, gap: 2 })
    await nextTick()
    expect(vm.cols).toBeLessThan(52)
    expect(vm.cols).toBeGreaterThan(0)
    expect(vm.actualCellSize).toBe(10)
  })

  it('cols nunca excede dataCols (aunque sobre ancho)', async () => {
    const vm = createTestComponent(5000, { dataCols: 52, cellSize: 10, gap: 2 })
    await nextTick()
    expect(vm.cols).toBe(52)
  })

  it('con ancho insuficiente: mantiene cellSize y reduce cols', async () => {
    const vm = createTestComponent(5, {
      dataCols: 52,
      cellSize: 10,
      gap: 2,
    })
    await nextTick()
    expect(vm.actualCellSize).toBe(10)
    expect(vm.cols).toBe(1)
  })

  it('siempre usa cellSize fijo (sin fallback a minCellSize)', async () => {
    const vm = createTestComponent(50, { dataCols: 52, cellSize: 10, gap: 2 })
    await nextTick()
    expect(vm.actualCellSize).toBe(10)
    expect(vm.cols).toBeGreaterThan(0)
  })

  it('con contenedor muy chico: muestra al menos 1 columna', async () => {
    const vm = createTestComponent(5, { dataCols: 52, cellSize: 10, gap: 2 })
    await nextTick()
    expect(vm.cols).toBe(1)
    expect(vm.actualCellSize).toBe(10)
  })

  it('calcula columnas dinámicamente según el ancho', async () => {
    // 200px / (10px + 2px gap) = 16.66 → 16 columnas
    const vm = createTestComponent(200, { dataCols: 52, cellSize: 10, gap: 2 })
    await nextTick()
    expect(vm.cols).toBe(16)
  })
})

describe('useHeatmapCols: observador agrupado en un cuadro', () => {
  let frameCallbacks: FrameRequestCallback[] = []

  function flushFrame() {
    const cbs = frameCallbacks
    frameCallbacks = []
    cbs.forEach((cb) => cb(0))
  }

  beforeEach(() => {
    mockResizeObserver()
    frameCallbacks = []
    vi.stubGlobal('requestAnimationFrame', ((cb: FrameRequestCallback) => {
      frameCallbacks.push(cb)
      return frameCallbacks.length
    }) as typeof requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', vi.fn() as unknown as typeof cancelAnimationFrame)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('aplica varios avisos del ResizeObserver en un solo cuadro', async () => {
    const vm = createTestComponent(700, { dataCols: 52 })
    await nextTick()
    expect(vm.cols).toBe(52)

    resizeCallbacks[0]?.(observerEntry(100))
    resizeCallbacks[0]?.(observerEntry(120))
    resizeCallbacks[0]?.(observerEntry(140))

    expect(frameCallbacks.length).toBe(1)
    expect(vm.cols).toBe(52)

    flushFrame()
    await nextTick()
    expect(vm.cols).toBe(11)
  })

  it('los avisos del observador no vuelven a leer clientWidth (sin layout forzado)', async () => {
    const vm = createTestComponent(700, { dataCols: 52 })
    await nextTick()
    expect(vm.reads).toBe(1)

    resizeCallbacks[0]?.(observerEntry(100))
    flushFrame()
    await nextTick()

    expect(vm.reads).toBe(1)
    expect(vm.cols).toBe(8)
  })

  it('al desmontar cancela el cuadro pendiente del observador', async () => {
    const vm = createTestComponent(700, { dataCols: 52 })
    await nextTick()

    resizeCallbacks[0]?.(observerEntry(100))
    expect(frameCallbacks.length).toBe(1)

    vm.unmount()
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1)

    flushFrame()
  })
})
