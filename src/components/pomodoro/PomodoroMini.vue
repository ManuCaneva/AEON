<script setup lang="ts">
import { ref } from 'vue'
import PomodoroDisc from '@/components/pomodoro/PomodoroDisc.vue'
import PomodoroPill from '@/components/pomodoro/PomodoroPill.vue'
import {
  choosePillPlacement,
  orbOffsetY,
  orbWindowRect,
  resizedDiameter,
  resizedOrbAroundCenter,
  POMODORO_PILL_GAP,
  POMODORO_PILL_HEIGHT,
  type OrbRect,
  type PillPlacement,
  type WindowRect,
} from '@/lib/pomodoroMiniLayout'
import {
  currentLogicalMonitorRect,
  getPomodoroMiniOrbRect,
  setPomodoroMiniGeometry,
  setPomodoroMiniOrbOffset,
  startDraggingPomodoroMiniWindow,
} from '@/lib/pomodoroMiniWindow'

/**
 * La mascota del pomodoro: solo el disco, flotando siempre arriba. La ventana
 * del sistema es el cuadrado del disco; la pastilla de opciones vive en una
 * franja que se expande bajo el disco al hacer hover (o sobre él si abajo no
 * entra en el monitor, y en ese caso la pastilla se dibuja encima con el disco
 * fijo) y se oculta al salir, con una gracia para poder entrar a la pastilla.
 * El disco entero arrastra la ventana; los botones del temporizador no. Todo
 * cambio de geometría pasa por `setPomodoroMiniGeometry` con el offset de la
 * pastilla ya publicado.
 */
const emit = defineEmits<{ go: []; close: [] }>()

/** Gracia al salir del disco: tiempo para entrar a la pastilla sin que se cierre. */
const PILL_HIDE_DELAY_MS = 300

const pillVisible = ref(false)
/** Colocación vigente de la pastilla: reactiva porque decide el orden de dibujo. */
const placement = ref<PillPlacement>('none')

let ocultarTimer: ReturnType<typeof setTimeout> | undefined
let resizing = false
let hovering = false

/** Disco actual: la geometría que la pastilla preserva al expandirse. */
let disco: OrbRect | null = null
/** Disco al inicio del gesto de resize: el delta se acumula desde acá. */
let gestoBase: OrbRect | null = null

/** Escrituras de resize acotadas: una en vuelo y solo la más nueva pendiente. */
let escribiendo = false
let pendiente: WindowRect | null = null

function cancelarOcultamiento(): void {
  if (ocultarTimer !== undefined) {
    clearTimeout(ocultarTimer)
    ocultarTimer = undefined
  }
}

function programarOcultamiento(): void {
  cancelarOcultamiento()
  if (resizing) return
  ocultarTimer = setTimeout(() => {
    ocultarTimer = undefined
    void ocultarPill()
  }, PILL_HIDE_DELAY_MS)
}

/**
 * Aplica una geometría sin encolar IPCs: mientras una escritura está en vuelo,
 * solo se recuerda la más nueva. Un gesto de resize a 60Hz escribe a la
 * velocidad de la ventana, no a la del mouse.
 */
function aplicarGeometria(rect: WindowRect): void {
  pendiente = rect
  if (escribiendo) return
  escribiendo = true
  void drenarGeometria()
}

async function drenarGeometria(): Promise<void> {
  try {
    while (pendiente !== null) {
      const objetivo = pendiente
      pendiente = null
      try {
        await setPomodoroMiniGeometry(objetivo)
      } catch {
        // Una escritura rechazada no bloquea las siguientes.
      }
    }
  } finally {
    escribiendo = false
  }
}

/** Vuelve la ventana al disco solo: estado primero, geometría best-effort. */
async function revertirExpansion(): Promise<void> {
  placement.value = 'none'
  setPomodoroMiniOrbOffset(0)
  if (disco === null) return
  try {
    await setPomodoroMiniGeometry(orbWindowRect(disco, 'none'))
  } catch {
    // Colapsar es best-effort: el estado ya quedó cerrado.
  }
}

async function mostrarPill(): Promise<void> {
  cancelarOcultamiento()
  if (pillVisible.value) return
  try {
    const rect = await getPomodoroMiniOrbRect()
    // El cursor pudo salirse mientras se leía la geometría.
    if (!hovering) return
    disco = rect
    placement.value = choosePillPlacement(disco, await currentLogicalMonitorRect())
    setPomodoroMiniOrbOffset(orbOffsetY(placement.value))
    await setPomodoroMiniGeometry(orbWindowRect(disco, placement.value))
    if (!hovering) {
      await revertirExpansion()
      return
    }
    pillVisible.value = true
  } catch {
    // Sin geometría confiable no hay pastilla que expandir: el estado queda
    // limpio (offset sin marcar) y el próximo hover vuelve a intentar.
    await revertirExpansion()
  }
}

async function ocultarPill(): Promise<void> {
  const estabaExpandido = placement.value !== 'none'
  pillVisible.value = false
  if (!estabaExpandido) return
  await revertirExpansion()
}

function onHoverStart(): void {
  hovering = true
  void mostrarPill()
}

function onHoverEnd(): void {
  hovering = false
  programarOcultamiento()
}

/** El disco arrastra la ventana; los botones del temporizador se quedan clickeables. */
function onOrbMouseDown(event: MouseEvent): void {
  if (event.button !== 0) return
  if ((event.target as HTMLElement).closest('button') !== null) return
  startDraggingPomodoroMiniWindow()
}

function onResizeStart(): void {
  resizing = true
  gestoBase = disco
}

function onResize(delta: { x: number; y: number }): void {
  if (gestoBase === null) return
  disco = resizedOrbAroundCenter(gestoBase, resizedDiameter(gestoBase.diameter, delta.x, delta.y))
  aplicarGeometria(orbWindowRect(disco, placement.value))
}

function onResizeEnd(): void {
  resizing = false
  gestoBase = null
}
</script>

<template>
  <div
    data-testid="pomodoro-mini"
    class="pomodoro-orb container-widget flex h-screen w-full select-none flex-col items-center overflow-hidden"
    :style="{
      'container-type': 'inline-size',
      flexDirection: placement === 'above' ? 'column-reverse' : 'column',
    }"
  >
    <div
      data-testid="pomodoro-mini-circle-area"
      class="pomodoro-circle-area relative aspect-square w-full shrink-0"
      style="container-type: size"
      @mouseenter="onHoverStart"
      @mouseleave="onHoverEnd"
      @mousedown="onOrbMouseDown"
    >
      <PomodoroDisc test-id-prefix="pomodoro-mini" />
    </div>
    <div
      v-if="pillVisible"
      data-testid="pomodoro-mini-pill-area"
      class="flex w-full shrink-0 items-end justify-center"
      :style="{
        height: `${POMODORO_PILL_GAP + POMODORO_PILL_HEIGHT}px`,
        paddingTop: placement === 'above' ? 0 : `${POMODORO_PILL_GAP}px`,
        paddingBottom: placement === 'above' ? `${POMODORO_PILL_GAP}px` : 0,
      }"
      @mouseenter="onHoverStart"
      @mouseleave="onHoverEnd"
    >
      <PomodoroPill
        @resize-start="onResizeStart"
        @resize="onResize"
        @resize-end="onResizeEnd"
        @go="emit('go')"
        @close="emit('close')"
      />
    </div>
  </div>
</template>
