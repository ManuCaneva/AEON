<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  PanelLeftClose,
  PanelLeftOpen,
  CheckSquare,
  Archive,
  Settings,
  Pencil,
  Timer,
} from 'lucide-vue-next'
import { useUiStore, type ViewMode } from '@/stores/ui'
import { useLayoutTransition } from '@/composables/useLayoutTransition'
import Text from '@/components/ui/Text.vue'
import logoWordmark from '@/assets/logo/logo-wordmark-current.svg?raw'

const ui = useUiStore()
const { transitioning, start, end, onEnd } = useLayoutTransition()

// El panel anima su ancho (176px ↔ 56px) en 300ms con la curva del snap de
// widgets; los fundidos de opacidad acompañan (labels/textos 300ms, logo
// 250ms, ícono del botón 150ms). El estado asentado (labels ocultos + filas
// centradas) se aplica cuando la transición de ancho termina de verdad
// (transitionend), con el fallback del composable como red.
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
  { id: 'archived', label: 'Archivados', icon: Archive },
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
    label: 'Settings',
    icon: Settings,
    active: ui.viewMode === 'settings',
    select: () => ui.setViewMode('settings'),
  },
])

const fadeClass = computed(() =>
  (ui.sidebarCollapsed && !settled.value) || expanding.value ? 'opacity-0' : ''
)
const hideClass = computed(() => (ui.sidebarCollapsed && settled.value ? 'hidden' : ''))
const textFade = computed(() => [fadeClass.value, hideClass.value])
const logoFade = computed(() => [fadeClass.value, hideClass.value, 'text-ink'])
const centered = computed(() => ui.sidebarCollapsed && settled.value)

const rowBase = computed(
  () =>
    `group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-caption font-medium transition-colors duration-150${
      centered.value ? ' justify-center' : ''
    }`
)
const rowIdle = 'text-ink-muted hover:bg-surface-2 hover:text-ink'
const rowActive = 'bg-surface-3 text-ink'
</script>

<template>
  <aside
    :class="[
      'glass-strong flex h-full flex-col rounded-xl transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
      ui.sidebarCollapsed ? 'w-14' : 'w-44',
    ]"
    @transitionend="handleTransitionEnd"
  >
    <div
      data-testid="sidebar-header"
      class="relative flex items-center gap-2 px-2 py-2.5"
      :class="centered ? 'justify-center' : 'justify-end'"
    >
      <span
        data-testid="sidebar-logo"
        aria-hidden="true"
        class="pointer-events-none absolute left-1/2 top-1/2 h-5 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-[250ms] [&>svg]:h-full [&>svg]:w-auto"
        :class="logoFade"
        v-html="logoWordmark"
      />
      <button
        type="button"
        data-testid="sidebar-toggle"
        class="flex shrink-0 items-center justify-center rounded-md px-2 py-1.5 text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
        aria-label="Colapsar sidebar"
        title="Colapsar sidebar"
        @click="ui.toggleSidebar()"
      >
        <span class="grid shrink-0 place-items-center">
          <PanelLeftClose
            data-testid="toggle-icon-collapse"
            :size="18"
            class="transition-opacity duration-150 [grid-area:1/1]"
            :class="ui.sidebarCollapsed ? 'opacity-0' : 'opacity-100'"
          />
          <PanelLeftOpen
            data-testid="toggle-icon-expand"
            :size="18"
            class="transition-opacity duration-150 [grid-area:1/1]"
            :class="ui.sidebarCollapsed ? 'opacity-100' : 'opacity-0'"
          />
        </span>
      </button>
    </div>

    <nav class="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-1">
      <Text
        variant="eyebrow"
        color="subtle"
        class="px-2 pb-1 pt-2 transition-opacity duration-300"
        :class="textFade"
      >
        Navegación
      </Text>
      <button
        v-for="row in navRows"
        :key="row.key"
        type="button"
        :class="[rowBase, row.active ? rowActive : rowIdle]"
        :data-testid="`nav-${row.key}`"
        @click="row.select()"
      >
        <component :is="row.icon" :size="18" class="shrink-0" />
        <span
          :data-testid="`nav-label-${row.key}`"
          class="min-w-0 flex-1 truncate text-left transition-opacity duration-300"
          :class="textFade"
        >
          {{ row.label }}
        </span>
      </button>
    </nav>

    <div class="flex flex-col gap-1 border-t border-hairline px-2 py-2">
      <Text
        variant="eyebrow"
        color="subtle"
        class="px-2 pb-1 pt-1 transition-opacity duration-300"
        :class="textFade"
      >
        Sistema
      </Text>
      <button
        v-for="row in systemRows"
        :key="row.key"
        type="button"
        :class="[rowBase, row.active ? rowActive : rowIdle]"
        :data-testid="`nav-${row.key}`"
        :aria-label="row.label"
        :title="row.label"
        @click="row.select()"
      >
        <component :is="row.icon" :size="18" class="shrink-0" />
        <span
          :data-testid="`nav-label-${row.key}`"
          class="min-w-0 flex-1 truncate text-left transition-opacity duration-300"
          :class="textFade"
        >
          {{ row.label }}
        </span>
      </button>
    </div>
  </aside>
</template>
