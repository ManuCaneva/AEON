import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import Sidebar from './Sidebar.vue'
import {
  LAYOUT_TRANSITION_FALLBACK_MS,
  useLayoutTransition,
} from '@/composables/useLayoutTransition'

const setViewMode = vi.fn()
const toggleEditMode = vi.fn()
const toggleSidebar = vi.fn()

let uiState: Record<string, unknown>

vi.mock('@/stores/ui', () => ({
  useUiStore: () => uiState,
}))

function fireTransitionEnd(el: Element, propertyName = 'width') {
  const event = new Event('transitionend', { bubbles: true }) as Event & { propertyName: string }
  event.propertyName = propertyName
  el.dispatchEvent(event)
}

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

  it('renders the wordmark logo and the crossfading toggle icons', () => {
    const wrapper = mountSidebar()
    const header = wrapper.get('[data-testid="sidebar-header"]')
    expect(header.find('[data-testid="sidebar-logo"]').exists()).toBe(true)

    const toggle = header.get('[data-testid="sidebar-toggle"]')
    expect(toggle.find('[data-testid="toggle-icon-collapse"]').exists()).toBe(true)
    expect(toggle.find('[data-testid="toggle-icon-expand"]').exists()).toBe(true)
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

  it('anima el width del panel 300ms con la curva del snap, sin animar todo', () => {
    const wrapper = mountSidebar()
    const aside = wrapper.get('aside')
    expect(aside.classes()).toContain('transition-[width]')
    expect(aside.classes()).toContain('duration-300')
    expect(aside.classes()).toContain('ease-[cubic-bezier(0.16,1,0.3,1)]')
    expect(aside.classes()).not.toContain('transition-all')
  })

  it('labels y textos de sección funden 300ms; el logo 250ms', () => {
    const wrapper = mountSidebar()

    const label = wrapper.get('[data-testid="nav-label-dashboard"]')
    expect(label.classes()).toContain('transition-opacity')
    expect(label.classes()).toContain('duration-300')

    const eyebrow = wrapper.get('.text-eyebrow')
    expect(eyebrow.classes()).toContain('transition-opacity')
    expect(eyebrow.classes()).toContain('duration-300')

    const logo = wrapper.get('[data-testid="sidebar-logo"]')
    expect(logo.classes()).toContain('transition-opacity')
    expect(logo.classes()).toContain('duration-[250ms]')
  })

  it('el ícono del toggle hace crossfade de 150ms entre colapsar y expandir', async () => {
    const wrapper = mountWithReactiveUi(false)

    const collapseIcon = wrapper.get('[data-testid="toggle-icon-collapse"]')
    const expandIcon = wrapper.get('[data-testid="toggle-icon-expand"]')
    expect(collapseIcon.classes()).toContain('transition-opacity')
    expect(collapseIcon.classes()).toContain('duration-150')
    expect(collapseIcon.classes()).toContain('opacity-100')
    expect(expandIcon.classes()).toContain('opacity-0')

    uiState.sidebarCollapsed = true
    await nextTick()

    expect(collapseIcon.classes()).toContain('opacity-0')
    expect(expandIcon.classes()).toContain('opacity-100')
  })

  it('al montar ya colapsado, asienta el layout colapsado sin esperar', () => {
    uiState.sidebarCollapsed = true
    const wrapper = mountSidebar()
    expect(wrapper.get('[data-testid="nav-dashboard"]').classes()).toContain('justify-center')
    expect(wrapper.get('[data-testid="sidebar-logo"]').classes()).toContain('hidden')
  })

  it('colapsando: fadea labels sin centrar hasta el settle por transitionend', async () => {
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

    fireTransitionEnd(aside.element, 'width')
    await nextTick()

    expect(label.classes()).toContain('hidden')
    expect(row.classes()).toContain('justify-center')
    expect(wrapper.get('[data-testid="sidebar-header"]').classes()).toContain('justify-center')
  })

  it('colapsando: settle cae al fallback si transitionend no llega', async () => {
    vi.useFakeTimers()
    const wrapper = mountWithReactiveUi(false)

    uiState.sidebarCollapsed = true
    await nextTick()

    const label = wrapper.get('[data-testid="nav-label-pomodoro"]')
    expect(label.classes()).not.toContain('hidden')

    vi.advanceTimersByTime(LAYOUT_TRANSITION_FALLBACK_MS - 1)
    await nextTick()
    expect(label.classes()).not.toContain('hidden')

    vi.advanceTimersByTime(1)
    await nextTick()

    expect(label.classes()).toContain('hidden')
    expect(wrapper.get('[data-testid="nav-pomodoro"]').classes()).toContain('justify-center')
  })

  it('colapsando: ignora transitionend de propiedades que no son width', async () => {
    vi.useFakeTimers()
    const wrapper = mountWithReactiveUi(false)

    uiState.sidebarCollapsed = true
    await nextTick()

    fireTransitionEnd(wrapper.get('aside').element, 'opacity')
    await nextTick()
    expect(wrapper.get('[data-testid="nav-label-pomodoro"]').classes()).not.toContain('hidden')

    fireTransitionEnd(wrapper.get('aside').element, 'width')
    await nextTick()
    expect(wrapper.get('[data-testid="nav-label-pomodoro"]').classes()).toContain('hidden')

    vi.advanceTimersByTime(LAYOUT_TRANSITION_FALLBACK_MS * 2)
  })

  it('expandir hace fade-in de labels y logo en vez de aparecer de golpe', async () => {
    const wrapper = mountWithReactiveUi(true)
    const label = wrapper.get('[data-testid="nav-label-pomodoro"]')
    const logo = wrapper.get('[data-testid="sidebar-logo"]')
    expect(label.classes()).toContain('hidden')
    expect(logo.classes()).toContain('hidden')

    uiState.sidebarCollapsed = false
    await nextTick()

    // Primer cuadro: ya visibles (sin display:none) pero en opacidad 0.
    expect(label.classes()).not.toContain('hidden')
    expect(label.classes()).toContain('opacity-0')
    expect(logo.classes()).not.toContain('hidden')
    expect(logo.classes()).toContain('opacity-0')

    await nextTick()
    await nextTick()

    // Cuadro siguiente: opacidad 1, la transición corre.
    expect(label.classes()).not.toContain('opacity-0')
    expect(logo.classes()).not.toContain('opacity-0')
  })

  it('expandir revierte el layout y anima el ancho', async () => {
    const wrapper = mountWithReactiveUi(true)
    expect(wrapper.get('[data-testid="nav-pomodoro"]').classes()).toContain('justify-center')

    uiState.sidebarCollapsed = false
    await nextTick()

    const row = wrapper.get('[data-testid="nav-pomodoro"]')
    expect(wrapper.get('aside').classes()).toContain('w-44')
    expect(row.classes()).not.toContain('justify-center')
  })

  it('expandir antes del settle cancela el layout colapsado pendiente', async () => {
    const wrapper = mountWithReactiveUi(false)

    uiState.sidebarCollapsed = true
    await nextTick()
    uiState.sidebarCollapsed = false
    await nextTick()

    // Aunque llegue el transitionend tardío de la ida, la vuelta ya revirtió.
    fireTransitionEnd(wrapper.get('aside').element, 'width')
    await nextTick()

    const row = wrapper.get('[data-testid="nav-pomodoro"]')
    expect(row.classes()).not.toContain('justify-center')
    expect(wrapper.get('[data-testid="nav-label-pomodoro"]').classes()).not.toContain('hidden')
  })

  it('transitionend no llega y expandir después: el fallback no asienta el layout colapsado', async () => {
    vi.useFakeTimers()
    const wrapper = mountWithReactiveUi(false)

    uiState.sidebarCollapsed = true
    await nextTick()
    uiState.sidebarCollapsed = false
    await nextTick()

    vi.advanceTimersByTime(LAYOUT_TRANSITION_FALLBACK_MS * 2)
    await nextTick()

    const row = wrapper.get('[data-testid="nav-pomodoro"]')
    expect(row.classes()).not.toContain('justify-center')
    expect(wrapper.get('[data-testid="nav-label-pomodoro"]').classes()).not.toContain('hidden')
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
    const { onEnd } = useLayoutTransition()
    const layoutChanged = vi.fn()
    const unsubscribe = onEnd(layoutChanged)

    const wrapper = mountWithReactiveUi(false)
    uiState.sidebarCollapsed = true
    await nextTick()
    expect(layoutChanged).not.toHaveBeenCalled()

    fireTransitionEnd(wrapper.get('aside').element, 'width')
    await nextTick()
    expect(layoutChanged).toHaveBeenCalledTimes(1)

    unsubscribe()
    wrapper.unmount()
  })

  it('desmontar durante el settle no deja timers colgados', async () => {
    vi.useFakeTimers()
    const wrapper = mountWithReactiveUi(false)

    uiState.sidebarCollapsed = true
    await nextTick()
    wrapper.unmount()

    expect(() => vi.advanceTimersByTime(LAYOUT_TRANSITION_FALLBACK_MS * 2)).not.toThrow()
    await nextTick()
  })
})
