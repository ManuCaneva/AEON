<script setup lang="ts">
import { computed } from 'vue'
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-vue-next'
import PomodoroRing from '@/components/pomodoro/PomodoroRing.vue'
import { usePomodoroStore } from '@/stores/pomodoro'
import { formatRemainingTime, getPhaseDurationMs, getProgressFraction } from '@/lib/pomodoro'

const props = defineProps<{ testIdPrefix: string }>()

const pomodoro = usePomodoroStore()

const durationMs = computed(() => getPhaseDurationMs(pomodoro.session.phase, pomodoro.settings))
const progress = computed(() => getProgressFraction(pomodoro.remainingMs, durationMs.value))
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
  <PomodoroRing
    :data-testid="testId('progress')"
    class="pomodoro-circle aspect-square p-0"
    :phase="pomodoro.session.phase"
    :progress="progress"
  >
    <div
      :data-testid="testId('disc')"
      class="pomodoro-disc flex flex-col items-center justify-center gap-1.5 rounded-full bg-surface-1"
    >
      <span
        :key="pomodoro.session.phase"
        :data-testid="testId('countdown')"
        class="pomodoro-countdown pomodoro-fade-in font-mono font-semibold tracking-tight"
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
  </PomodoroRing>
</template>
