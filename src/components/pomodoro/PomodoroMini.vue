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
 * entra en el monitor) y se oculta al salir, con una gracia para poder entrar
 * a la pastilla. El disco entero arrastra la ventana; los botones del
 * temporizador no. Todo cambio de geometría pasa por `setPomodoroMiniGeometry`
 * con el offset de la pastilla ya publicado.
 */
const emit = defineEmits<{ go: []; close: [] }>()

/** Gracia al salir del disco: tiempo para entrar a la pastilla sin que se cierre. */
const PILL_HIDE_DELAY_MS = 300

const pillVisible = ref(false)

let ocultarTimer: ReturnType<typeof setTimeout> | undefined
let resizing = false
let hovering = false

/** Disco actual: la geometría que la pastilla preserva al expandirse. */
let disco: OrbRect | null = null
let placement: PillPlacement = 'none'
/** Disco al inicio del gesto de resize: el delta se acumula desde acá. */
let gestoBase: OrbRect | null = null

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

async function mostrarPill(): Promise<void> {
  cancelarOcultamiento()
  if (pillVisible.value) return
  const rect = await getPomodoroMiniOrbRect()
  // El cursor pudo salirse mientras se leía la geometría.
  if (!hovering) return
  disco = rect
  placement = choosePillPlacement(disco, await currentLogicalMonitorRect())
  setPomodoroMiniOrbOffset(orbOffsetY(placement))
  await setPomodoroMiniGeometry(orbWindowRect(disco, placement))
  if (!hovering) return
  pillVisible.value = true
}

async function ocultarPill(): Promise<void> {
  if (!pillVisible.value) return
  pillVisible.value = false
  placement = 'none'
  setPomodoroMiniOrbOffset(0)
  if (disco !== null) await setPomodoroMiniGeometry(orbWindowRect(disco, 'none'))
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
  void setPomodoroMiniGeometry(orbWindowRect(disco, placement))
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
    style="container-type: inline-size"
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
        paddingTop: `${POMODORO_PILL_GAP}px`,
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
