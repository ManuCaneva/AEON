<script setup lang="ts">
import PomodoroDisc from './PomodoroDisc.vue'
import PomodoroPill from './PomodoroPill.vue'
import {
  POMODORO_MINI_RING_WIDTH,
  POMODORO_PILL_GAP,
  POMODORO_PILL_HEIGHT,
  POMODORO_PILL_SHADOW_ROOM,
} from '@/lib/pomodoroMiniLayout'
import { closePomodoroMiniWindow, startDraggingPomodoroMiniWindow } from '@/lib/pomodoroMiniWindow'
import { showPomodoroInMainWindow } from '@/lib/pomodoroMainWindow'
import { usePomodoroMiniPill } from '@/composables/usePomodoroMiniPill'

/**
 * La mascota del pomodoro: disco y pastilla viven en la **misma ventana**, así
 * el arrastre nativo mueve las dos piezas en lockstep. Solo la máscara de la
 * pastilla cambia al entrar/salir; la ventana nunca cambia de tamaño.
 */
const { visible: pillVisible, onEnter, onLeave, onFocusIn, onFocusOut } = usePomodoroMiniPill()

/** El disco arrastra la ventana; los botones del temporizador se quedan clickeables. */
function onOrbMouseDown(event: MouseEvent): void {
  if (event.button !== 0) return
  const target = event.target as HTMLElement | null
  if (target?.closest('button, .pomodoro-controls, .pomodoro-countdown')) return

  startDraggingPomodoroMiniWindow()
}

function onGo(): void {
  void showPomodoroInMainWindow()
}

function onClose(): void {
  void closePomodoroMiniWindow()
}
</script>

<template>
  <div
    data-testid="pomodoro-mini"
    class="pomodoro-mini-orb pomodoro-orb flex h-screen w-full select-none flex-col items-center"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <div
      data-testid="pomodoro-mini-circle-area"
      class="pomodoro-mini-orb-area relative shrink-0"
      @mousedown="onOrbMouseDown"
    >
      <PomodoroDisc test-id-prefix="pomodoro-mini" :ring-width="POMODORO_MINI_RING_WIDTH" />
    </div>

    <div
      data-testid="pomodoro-mini-pill-area"
      class="pomodoro-mini-pill-area flex w-full shrink-0 justify-center"
      :style="{
        height: `${POMODORO_PILL_GAP + POMODORO_PILL_HEIGHT + POMODORO_PILL_SHADOW_ROOM}px`,
        paddingTop: `${POMODORO_PILL_GAP}px`,
      }"
    >
      <div
        data-testid="pomodoro-mini-pill"
        class="pomodoro-mini-pill"
        :aria-hidden="!pillVisible"
        :inert="!pillVisible"
      >
        <PomodoroPill @go="onGo" @close="onClose" />
      </div>
    </div>
  </div>
</template>
