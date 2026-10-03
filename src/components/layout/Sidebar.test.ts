import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import Sidebar from './Sidebar.vue'
import { useLayoutTransition } from '@/composables/useLayoutTransition'

const setViewMode = vi.fn()
const toggleEditMode = vi.fn()
const toggleSidebar = vi.fn()

let uiState: Record<string, unknown>

vi.mock('@/stores/ui', () => ({
  useUiStore: () => uiState,
}))

function mountSidebar() {
  return mount(Sidebar)
}

function mountWithReactiveUi(sidebarCollapsed: boolean) {
  uiState = reactive({
    viewMode: 'dashboard',
    sidebarCollapsed,
    editMode: false,
    setViewMode,
    toggleEditMode,
    toggleSidebar,
  }) as unknown as Record<string, unknown>
  return mount(Sidebar)
}

beforeEach(() => {
  vi.clearAllMocks()
  uiState = {
    viewMode: 'dashboard',
    sidebarCollapsed: false,
    editMode: false,
    setViewMode,
    toggleEditMode,
    toggleSidebar,
  }
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Sidebar', () => {
  it('offers Pomodoro navigation', async () => {
    const wrapper = mountSidebar()
    const button = wrapper.get('[data-testid="nav-pomodoro"]')
    expect(button.text()).toContain('Pomodoro')
    await button.trigger('click')
    expect(setViewMode).toHaveBeenCalledWith('pomodoro')
  })

  it('renders a section eyebrow per group and no decorative dots', () => {
    const wrapper = mountSidebar()
    const eyebrows = wrapper.findAll('.text-eyebrow')
    expect(eyebrows.map((e) => e.text())).toEqual(['Navegación', 'Sistema'])

    for (const key of ['dashboard', 'archived', 'pomodoro', 'edit-mode', 'settings']) {
      const row = wrapper.get(`[data-testid="nav-${key}"]`)
      expect(row.find('span.rounded-full').exists()).toBe(false)
    }
  })

  it('marks the active view row distinctly from idle rows', () => {
    uiState.viewMode = 'pomodoro'
    const wrapper = mountSidebar()
    const active = wrapper.get('[data-testid="nav-pomodoro"]')
    const idle = wrapper.get('[data-testid="nav-archived"]')

    const activeBg = active.classes().find((c) => c.startsWith('bg-'))
    const idleBg = idle.classes().find((c) => c.startsWith('bg-'))
    expect(activeBg).toBeTruthy()
    expect(activeBg).not.toBe(idleBg)
    expect(idle.classes()).toContain('hover:bg-surface-2')
  })

  it('toggles edit mode from the system section', async () => {
    const wrapper = mountSidebar()
    await wrapper.get('[data-testid="nav-edit-mode"]').trigger('click')
    expect(toggleEditMode).toHaveBeenCalled()
  })

  it('collapsed settled: oculta labels y centra las filas', () => {
    uiState.sidebarCollapsed = true
    const wrapper = mountSidebar()

    expect(wrapper.get('[data-testid="sidebar-logo"]').classes()).toContain('hidden')
    expect(wrapper.findAll('.text-eyebrow').every((e) => e.classes().includes('hidden'))).toBe(true)

    for (const key of ['dashboard', 'archived', 'pomodoro', 'edit-mode', 'settings']) {
      const row = wrapper.get(`[data-testid="nav-${key}"]`)
      expect(row.classes()).toContain('justify-center')
    }
  })

  it('renders the wordmark logo instead of a text title in the header', () => {
    const wrapper = mountSidebar()
    const header = wrapper.get('[data-testid="sidebar-header"]')
    expect(header.find('[data-testid="sidebar-logo"]').exists()).toBe(true)
    expect(header.findAll('svg')).toHaveLength(2)
    expect(header.get('[data-testid="sidebar-toggle"]').find('svg').exists()).toBe(true)
  })

  it('anchors the collapse toggle to the right when expanded', async () => {
    const wrapper = mountSidebar()
    const header = wrapper.get('[data-testid="sidebar-header"]')
    const toggle = header.get('[data-testid="sidebar-toggle"]')
    expect(header.element.lastElementChild).toBe(toggle.element)
    await toggle.trigger('click')
    expect(toggleSidebar).toHaveBeenCalled()
  })

  it('collapsed: keeps only the collapse toggle inside the panel', async () => {
    uiState.sidebarCollapsed = true
    const wrapper = mountSidebar()
    expect(wrapper.get('[data-testid="sidebar-logo"]').classes()).toContain('hidden')

    const header = wrapper.get('[data-testid="sidebar-header"]')
    expect(header.findAll('button')).toHaveLength(1)
    await header.get('[data-testid="sidebar-toggle"]').trigger('click')
    expect(toggleSidebar).toHaveBeenCalled()
  })

  it('collapsed: centra el toggle y las filas de navegación horizontalmente', () => {
    uiState.sidebarCollapsed = true
    const wrapper = mountSidebar()

    const header = wrapper.get('[data-testid="sidebar-header"]')
    expect(header.classes()).toContain('justify-center')

    const toggle = header.get('[data-testid="sidebar-toggle"]')
    expect(toggle.classes()).toContain('justify-center')

    for (const key of ['dashboard', 'archived', 'pomodoro', 'edit-mode', 'settings']) {
      const row = wrapper.get(`[data-testid="nav-${key}"]`)
      expect(row.classes()).toContain('justify-center')
    }
  })

  it('el toggle usa el mismo tamaño de ícono que las filas de navegación', () => {
    const wrapper = mountSidebar()
    const toggleIcon = wrapper.get('[data-testid="sidebar-toggle"] svg')
    const navIcon = wrapper.get('[data-testid="nav-dashboard"] svg')
    expect(toggleIcon.attributes('width')).toBe(navIcon.attributes('width'))
    expect(toggleIcon.attributes('height')).toBe(navIcon.attributes('height'))
  })

  it('keeps the collapsed and expanded widths unchanged', () => {
    const expanded = mountSidebar()
    expect(expanded.get('aside').classes()).toContain('w-44')
    expect(expanded.get('aside').classes()).not.toContain('w-56')
    expect(expanded.get('aside').classes()).not.toContain('w-14')

    uiState.sidebarCollapsed = true
    const collapsed = mountSidebar()
    expect(collapsed.get('aside').classes()).toContain('w-14')
    expect(collapsed.get('aside').classes()).not.toContain('w-56')
    expect(collapsed.get('aside').classes()).not.toContain('w-44')
  })

  it('el ancho salta sin transición: solo los labels y textos funden opacidad', () => {
    const wrapper = mountSidebar()
    const aside = wrapper.get('aside')
    expect(aside.classes()).not.toContain('transition-[width]')
    expect(aside.classes()).not.toContain('transition-all')

    const label = wrapper.get('[data-testid="nav-label-dashboard"]')
    expect(label.classes()).toContain('transition-opacity')
    expect(label.classes()).toContain('duration-150')
  })

  it('al montar ya colapsado, asienta el layout colapsado sin esperar', () => {
    uiState.sidebarCollapsed = true
    const wrapper = mountSidebar()
    expect(wrapper.get('[data-testid="nav-dashboard"]').classes()).toContain('justify-center')
    expect(wrapper.get('[data-testid="sidebar-logo"]').classes()).toContain('hidden')
  })

  it('colapsando: funde los labels y asienta el layout al terminar el fundido', async () => {
    vi.useFakeTimers()
    const wrapper = mountWithReactiveUi(false)

    uiState.sidebarCollapsed = true
    await nextTick()

    const aside = wrapper.get('aside')
    const row = wrapper.get('[data-testid="nav-pomodoro"]')
    const label = row.get('[data-testid="nav-label-pomodoro"]')

    expect(aside.classes()).toContain('w-14')
    expect(label.classes()).toContain('opacity-0')
    expect(label.classes()).not.toContain('hidden')
    expect(row.classes()).not.toContain('justify-center')
    expect(wrapper.get('[data-testid="sidebar-header"]').classes()).not.toContain('justify-center')

    vi.advanceTimersByTime(149)
    await nextTick()
    expect(label.classes()).not.toContain('hidden')
    expect(row.classes()).not.toContain('justify-center')

    vi.advanceTimersByTime(1)
    await nextTick()

    expect(label.classes()).toContain('hidden')
    expect(row.classes()).toContain('justify-center')
    expect(wrapper.get('[data-testid="sidebar-header"]').classes()).toContain('justify-center')
  })

  it('colapsado asentado: los labels ocultos no reciben foco ni se anuncian', () => {
    uiState.sidebarCollapsed = true
    const wrapper = mountSidebar()

    for (const key of ['dashboard', 'archived', 'pomodoro', 'edit-mode', 'settings']) {
      const label = wrapper.get(`[data-testid="nav-label-${key}"]`)
      // display:none (clase hidden) los saca del orden de tabulación y del
      // árbol de accesibilidad; el span nunca es focusable por sí mismo.
      expect(label.classes()).toContain('hidden')
      expect(label.attributes('tabindex')).toBeUndefined()
    }
  })

  it('al asentar el colapso emite una única señal de que el layout cambió', async () => {
    vi.useFakeTimers()
    const { onEnd } = useLayoutTransition()
    const layoutChanged = vi.fn()
    const unsubscribe = onEnd(layoutChanged)

    const wrapper = mountWithReactiveUi(false)
    uiState.sidebarCollapsed = true
    await nextTick()
    expect(layoutChanged).not.toHaveBeenCalled()

    vi.advanceTimersByTime(150)
    await nextTick()
    expect(layoutChanged).toHaveBeenCalledTimes(1)

    unsubscribe()
    wrapper.unmount()
  })

  it('expandir revierte el layout inmediatamente', async () => {
    const wrapper = mountWithReactiveUi(true)
    expect(wrapper.get('[data-testid="nav-pomodoro"]').classes()).toContain('justify-center')

    uiState.sidebarCollapsed = false
    await nextTick()

    const row = wrapper.get('[data-testid="nav-pomodoro"]')
    expect(wrapper.get('aside').classes()).toContain('w-44')
    expect(row.classes()).not.toContain('justify-center')
  })

  it('expandir antes del fundido cancela el asentamiento colapsado pendiente', async () => {
    vi.useFakeTimers()
    const wrapper = mountWithReactiveUi(false)

    uiState.sidebarCollapsed = true
    await nextTick()
    uiState.sidebarCollapsed = false
    await nextTick()

    vi.advanceTimersByTime(1000)
    await nextTick()

    const row = wrapper.get('[data-testid="nav-pomodoro"]')
    expect(row.classes()).not.toContain('justify-center')
    expect(wrapper.get('[data-testid="nav-label-pomodoro"]').classes()).not.toContain('hidden')
  })

  it('desmontar durante el fundido no deja timers colgados', async () => {
    vi.useFakeTimers()
    const wrapper = mountWithReactiveUi(false)

    uiState.sidebarCollapsed = true
    await nextTick()
    wrapper.unmount()

    expect(() => vi.advanceTimersByTime(1000)).not.toThrow()
    await nextTick()
  })
})
