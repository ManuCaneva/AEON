<script setup lang="ts">
import { computed } from 'vue'
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-vue-next'
import Container from '@/components/ui/Container.vue'
import Text from '@/components/ui/Text.vue'
import { usePomodoroStore } from '@/stores/pomodoro'
import { formatRemainingTime, getPhaseDurationMs, getProgressFraction } from '@/lib/pomodoro'

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
</script>

<template>
  <Container
    data-testid="pomodoro-widget"
    variant="default"
    glass
    padding="none"
    class="container-widget flex h-full flex-col overflow-hidden"
    style="container-type: inline-size"
  >
    <header
      data-testid="pomodoro-widget-header"
      class="flex shrink-0 items-center justify-start border-b border-hairline bg-surface-2 px-2 py-1"
    >
      <Text variant="card-title" weight="600" class="text-left">Pomodoro</Text>
    </header>

    <div
      data-testid="pomodoro-widget-circle-area"
      class="pomodoro-circle-area flex min-h-0 flex-1 items-center justify-center p-4"
      style="container-type: size"
    >
      <div
        data-testid="pomodoro-widget-progress"
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
          data-testid="pomodoro-widget-disc"
          class="pomodoro-disc flex flex-col items-center justify-center gap-1.5 rounded-full bg-surface-1"
        >
          <span
            data-testid="pomodoro-widget-countdown"
            class="pomodoro-countdown font-mono font-semibold tracking-tight"
          >
            {{ formatRemainingTime(pomodoro.remainingMs) }}
          </span>
          <div
            data-testid="pomodoro-widget-controls"
            class="flex items-center justify-center gap-1"
          >
            <button
              data-testid="pomodoro-widget-reset"
              type="button"
              aria-label="Reiniciar Pomodoro"
              class="flex h-7 w-7 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              @click="pomodoro.reset()"
            >
              <RotateCcw :size="14" aria-hidden="true" />
            </button>
            <button
              data-testid="pomodoro-widget-toggle"
              type="button"
              class="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-ink transition-colors hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              :aria-label="toggleLabel"
              @click="toggle"
            >
              <Play v-if="!pomodoro.session.isRunning" :size="14" aria-hidden="true" />
              <Pause v-else :size="14" aria-hidden="true" />
            </button>
            <button
              data-testid="pomodoro-widget-skip"
              type="button"
              aria-label="Saltar Pomodoro"
              class="flex h-7 w-7 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              @click="pomodoro.skip()"
            >
              <SkipForward :size="14" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </Container>
</template>
