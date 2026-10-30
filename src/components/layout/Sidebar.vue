<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ChevronsLeft, ChevronsRight, CheckSquare, Settings, Pencil, Timer } from 'lucide-vue-next'
import { useUiStore, type ViewMode } from '@/stores/ui'
import { useLayoutTransition } from '@/composables/useLayoutTransition'
import logoWordmark from '@/assets/logo/logo-wordmark-current.svg?raw'
import logoMark from '@/assets/logo/logo-mark.svg?raw'
import { version } from '../../../package.json'

const ui = useUiStore()
const { transitioning, start, end, onEnd } = useLayoutTransition()

// El panel anima su ancho (192px ↔ 64px) en 300ms con la curva del snap de
// widgets; los fundidos de opacidad acompañan (labels/textos 300ms, ícono del
// botón 150ms). El logo fadea rápido al colapsar (100ms, para que no se lo
// vea viajar a la izquierda) y suave al expandir (250ms). El estado asentado
// (labels ocultos + filas centradas) se aplica cuando la transición de ancho
// termina de verdad (transitionend), con el fallback del composable como red.
const settled = ref(ui.sidebarCollapsed)
// Al expandir, los labels vuelven de `display:none`. Los mostramos un cuadro
// en opacidad 0 y recién en el siguiente la subimos a 1, para que la
// transición de opacidad corra en vez de aparecer de golpe.
const expanding = ref(false)
let stopSettle: (() => void) | undefined
let revealToken = 0

watch(
  () => ui.sidebarCollapsed,
  (collapsed) => {
    stopSettle?.()
    stopSettle = undefined
    settled.value = false
    expanding.value = !collapsed
    // Invalida cualquier reveal pendiente de un toggle anterior.
    const token = ++revealToken
    // Señal única de "el layout cambió": los widgets del dashboard se miden
    // una sola vez por toggle, al asentarse.
    start()
    stopSettle = onEnd(() => {
      settled.value = collapsed
      stopSettle = undefined
    })
    if (!collapsed) {
      nextTick(() => {
        if (token !== revealToken) return
        expanding.value = false
      })
    }
  }
)

function handleTransitionEnd(event: TransitionEvent) {
  if (event.target !== event.currentTarget) return
  if (event.propertyName !== 'width') return
  if (!transitioning.value) return
  end()
}

onBeforeUnmount(() => {
  // Solo cancelamos el settle local: la transición global sigue su curso y
  // termina sola (transitionend o fallback), sin cerrar la de otros consumidores.
  stopSettle?.()
  stopSettle = undefined
})

interface NavRow {
  key: string
  label: string
  icon: typeof CheckSquare
  active: boolean
  select: () => void
}

const navItems: readonly { id: ViewMode; label: string; icon: typeof CheckSquare }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: CheckSquare },
  { id: 'pomodoro', label: 'Pomodoro', icon: Timer },
] as const

const navRows = computed<NavRow[]>(() =>
  navItems.map((item) => ({
    key: item.id,
    label: item.label,
    icon: item.icon,
    active: ui.viewMode === item.id,
    select: () => ui.setViewMode(item.id),
  }))
)

const systemRows = computed<NavRow[]>(() => [
  {
    key: 'edit-mode',
    label: 'Modo Edición',
    icon: Pencil,
    active: ui.editMode,
    select: () => ui.toggleEditMode(),
  },
  {
    key: 'settings',
    label: 'Configuración',
    icon: Settings,
    active: ui.viewMode === 'settings',
    select: () => ui.setViewMode('settings'),
  },
])

const sections = computed(() => [
  { label: 'Navegación', rows: navRows.value },
  { label: 'Sistema', rows: systemRows.value },
])

const fadeClass = computed(() =>
  (ui.sidebarCollapsed && !settled.value) || expanding.value ? 'opacity-0' : ''
)
// Ocultar los labels al asentar permite centrar los íconos sin cambiar el alto.
const labelHide = computed(() => (ui.sidebarCollapsed && settled.value ? 'hidden' : ''))
const textFade = computed(() => [fadeClass.value, labelHide.value])
const logoDuration = computed(() =>
  // Colapsando el logo fadea rápido (100ms) para que no se lo vea viajar a
  // la izquierda mientras el ancho aún se anima; en reposo y al expandir el
  // fade es suave (250ms).
  ui.sidebarCollapsed && !settled.value ? 'duration-100' : 'duration-[250ms]'
)
const logoFade = computed(() => [fadeClass.value, labelHide.value, 'text-ink', logoDuration.value])
const centered = computed(() => ui.sidebarCollapsed && settled.value)

const rowBase = computed(
  () =>
    `flex w-full items-center gap-3 rounded-lg px-2 py-2 text-caption transition-colors duration-150${
      centered.value ? ' justify-center' : ''
    }`
)
const rowIdle = 'text-ink-muted hover:bg-surface-2/50 hover:text-ink'
const rowActive = 'bg-surface-2/70 font-medium text-ink'
</script>

<template>
  <aside
    :class="[
      'glass-strong flex h-full flex-col overflow-hidden rounded-xl transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
      ui.sidebarCollapsed ? 'w-16' : 'w-48',
    ]"
    @transitionend="handleTransitionEnd"
  >
    <div
      data-testid="sidebar-header"
      class="relative flex shrink-0 items-center bg-gradient-to-b from-surface-2/60 to-transparent px-3 pb-4 pt-3"
      :class="centered ? 'justify-center' : 'justify-end'"
    >
      <span
        data-testid="sidebar-logo"
        aria-hidden="true"
        class="pointer-events-none absolute left-3 h-6 origin-left scale-[0.85] transition-opacity [&>svg]:h-full [&>svg]:w-auto"
        :class="logoFade"
        v-html="logoWordmark"
      />
      <button
        type="button"
        data-testid="sidebar-toggle"
        class="flex shrink-0 items-center justify-center rounded-lg px-2 py-1.5 text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
        :aria-label="ui.sidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'"
        :title="ui.sidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'"
        :aria-expanded="!ui.sidebarCollapsed"
        @click="ui.toggleSidebar()"
      >
        <span class="grid shrink-0 place-items-center">
          <ChevronsLeft
            data-testid="toggle-icon-collapse"
            :size="16"
            class="transition-opacity duration-150 [grid-area:1/1]"
            :class="ui.sidebarCollapsed ? 'opacity-0' : 'opacity-100'"
          />
          <ChevronsRight
            data-testid="toggle-icon-expand"
            :size="16"
            class="transition-opacity duration-150 [grid-area:1/1]"
            :class="ui.sidebarCollapsed ? 'opacity-100' : 'opacity-0'"
          />
        </span>
      </button>
    </div>

    <nav class="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-2">
      <div v-for="section in sections" :key="section.label">
        <div
          role="separator"
          :aria-label="section.label"
          class="relative flex h-10 items-center gap-2 px-2"
        >
          <span class="h-px flex-1 bg-hairline" />
          <span
            data-testid="section-label"
            :aria-hidden="ui.sidebarCollapsed"
            class="overflow-hidden whitespace-nowrap text-caption text-ink-subtle transition-all duration-300"
            :class="ui.sidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-32 opacity-100'"
          >
            {{ section.label }}
          </span>
          <span
            data-testid="section-dot"
            aria-hidden="true"
            class="absolute left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-hairline-strong transition-opacity duration-300"
            :class="ui.sidebarCollapsed ? 'opacity-100' : 'opacity-0'"
          />
          <span class="h-px flex-1 bg-hairline" />
        </div>
        <button
          v-for="row in section.rows"
          :key="row.key"
          type="button"
          :class="[rowBase, row.active ? rowActive : rowIdle]"
          :data-testid="`nav-${row.key}`"
          :aria-label="row.label"
          :title="row.label"
          @click="row.select()"
        >
          <span
            class="grid h-7 w-7 shrink-0 place-items-center transition-colors duration-150"
            :class="row.active ? 'text-primary' : 'text-ink-muted'"
          >
            <component :is="row.icon" :size="16" />
          </span>
          <span
            :data-testid="`nav-label-${row.key}`"
            class="min-w-0 flex-1 truncate text-left transition-opacity duration-300"
            :class="textFade"
          >
            {{ row.label }}
          </span>
        </button>
      </div>
    </nav>

    <div
      data-testid="sidebar-footer"
      class="flex shrink-0 items-center justify-between gap-2 border-t border-hairline/60 px-3 py-3"
    >
      <span
        data-testid="sidebar-mark"
        role="img"
        aria-label="AEON"
        class="h-4 w-4 shrink-0 opacity-80 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none [&>svg]:h-full [&>svg]:w-full"
        :class="ui.sidebarCollapsed ? 'translate-x-3' : 'translate-x-0'"
        v-html="logoMark"
      />
      <span
        data-testid="sidebar-version"
        class="font-mono text-[10px] text-ink-tertiary transition-opacity duration-300"
        :class="textFade"
      >
        v{{ version }}
      </span>
    </div>
  </aside>
</template>
