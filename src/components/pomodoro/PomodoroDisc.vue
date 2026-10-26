<script setup lang="ts">
import { computed } from 'vue'
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-vue-next'
import { usePomodoroStore } from '@/stores/pomodoro'
import { formatRemainingTime, getPhaseDurationMs, getProgressFraction } from '@/lib/pomodoro'

const props = defineProps<{ testIdPrefix: string }>()

const pomodoro = usePomodoroStore()

const durationMs = computed(() => getPhaseDurationMs(pomodoro.session.phase, pomodoro.settings))
const progressPercent = computed(() =>
  Math.round(getProgressFraction(pomodoro.remainingMs, durationMs.value) * 100)
)
const ringToken = computed(() => (pomodoro.session.phase === 'focus' ? 'primary' : 'success'))
const toggleLabel = computed(() =>
  pomodoro.session.isRunning ? 'Pausar Pomodoro' : 'Iniciar Pomodoro'
)

function toggle() {
  if (pomodoro.session.isRunning) {
    void pomodoro.pause()
    return
  }
  void pomodoro.prepareAudio().catch(() => {})
  void pomodoro.start()
}

function testId(suffix: string): string {
  return `${props.testIdPrefix}-${suffix}`
}
</script>

<template>
  <div
    :data-testid="testId('progress')"
    class="pomodoro-circle relative flex aspect-square items-center justify-center rounded-full p-0"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="progressPercent"
    :style="{
      background: `conic-gradient(rgb(var(--color-${ringToken})) ${progressPercent}%, rgb(var(--color-surface-3)) 0)`,
    }"
  >
    <div
      :data-testid="testId('disc')"
      class="pomodoro-disc flex flex-col items-center justify-center gap-1.5 rounded-full bg-surface-1"
    >
      <span
        :data-testid="testId('countdown')"
        class="pomodoro-countdown font-mono font-semibold tracking-tight"
      >
        {{ formatRemainingTime(pomodoro.remainingMs) }}
      </span>
      <div
        :data-testid="testId('controls')"
        class="pomodoro-controls flex items-center justify-center"
      >
        <button
          :data-testid="testId('reset')"
          type="button"
          aria-label="Reiniciar Pomodoro"
          class="pomodoro-btn flex items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          @click="pomodoro.reset()"
        >
          <RotateCcw :size="14" aria-hidden="true" />
        </button>
        <button
          :data-testid="testId('toggle')"
          type="button"
          class="pomodoro-btn flex items-center justify-center rounded-full bg-surface-2 text-ink transition-colors hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          :aria-label="toggleLabel"
          @click="toggle"
        >
          <Play v-if="!pomodoro.session.isRunning" :size="14" aria-hidden="true" />
          <Pause v-else :size="14" aria-hidden="true" />
        </button>
        <button
          :data-testid="testId('skip')"
          type="button"
          aria-label="Saltar Pomodoro"
          class="pomodoro-btn flex items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          @click="pomodoro.skip()"
        >
          <SkipForward :size="14" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>
