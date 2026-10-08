<script setup lang="ts">
import { computed } from 'vue'
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import Text from '@/components/ui/Text.vue'
import PomodoroSettingsPanel from '@/components/pomodoro/PomodoroSettingsPanel.vue'
import { usePomodoroStore } from '@/stores/pomodoro'
import { formatRemainingTime, getPhaseDurationMs, getProgressFraction } from '@/lib/pomodoro'

const pomodoro = usePomodoroStore()

const phaseLabel = computed(() => {
  if (pomodoro.session.phase === 'shortBreak') return 'Descanso corto'
  if (pomodoro.session.phase === 'longBreak') return 'Descanso largo'
  return 'Enfoque'
})
const durationMs = computed(() => getPhaseDurationMs(pomodoro.session.phase, pomodoro.settings))
const progress = computed(() => getProgressFraction(pomodoro.remainingMs, durationMs.value))
const progressPercent = computed(() => Math.round(progress.value * 100))

const cycleDots = computed(() =>
  Array.from({ length: pomodoro.settings.longBreakInterval }, (_, index) => index)
)

function start() {
  void pomodoro.prepareAudio().catch(() => {})
  void pomodoro.start()
}
</script>

<template>
  <main data-testid="pomodoro-view" class="h-full overflow-y-auto lg:overflow-hidden">
    <div
      class="mx-auto flex h-full max-w-6xl flex-col gap-6 px-6 py-12 lg:flex-row lg:items-center lg:justify-center lg:gap-10 lg:overflow-hidden"
    >
      <div class="flex w-full flex-1 justify-center lg:max-w-[30rem]">
        <Card
          variant="featured"
          class="flex w-full flex-col items-center gap-6 py-10"
          data-testid="pomodoro-card"
        >
          <Text data-testid="pomodoro-phase" variant="eyebrow" color="subtle" class="uppercase">
            {{ phaseLabel }}
          </Text>
          <div
            data-testid="pomodoro-progress"
            class="relative flex h-64 w-64 items-center justify-center rounded-full"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="progressPercent"
            :style="{
              background: `conic-gradient(rgb(var(--color-primary)) ${progressPercent}%, rgb(var(--color-surface-3)) 0)`,
            }"
          >
            <div
              class="flex h-[calc(100%-12px)] w-[calc(100%-12px)] items-center justify-center rounded-full bg-surface-1"
            >
              <span
                data-testid="pomodoro-countdown"
                class="font-mono text-5xl font-semibold tabular-nums tracking-tight"
              >
                {{ formatRemainingTime(pomodoro.remainingMs) }}
              </span>
            </div>
          </div>

          <div
            data-testid="pomodoro-cycle"
            class="flex items-center gap-2"
            aria-label="Ciclos completados"
          >
            <span
              v-for="dot in cycleDots"
              :key="dot"
              data-testid="cycle-dot"
              class="h-2.5 w-2.5 rounded-full transition-colors duration-150"
              :class="dot < pomodoro.session.completedFocusSessions ? 'bg-primary' : 'bg-surface-3'"
            />
          </div>
          <Text variant="body-sm" color="muted">
            {{ pomodoro.session.completedFocusSessions }} de
            {{ pomodoro.settings.longBreakInterval }} ciclos completados
          </Text>

          <div class="flex flex-wrap justify-center gap-2">
            <Button
              v-if="!pomodoro.session.isRunning"
              data-testid="pomodoro-start"
              size="lg"
              @click="start"
            >
              <template #icon-left><Play :size="16" /></template>
              Iniciar
            </Button>
            <Button
              v-else
              data-testid="pomodoro-pause"
              variant="secondary"
              size="lg"
              @click="pomodoro.pause()"
            >
              <template #icon-left><Pause :size="16" /></template>
              Pausar
            </Button>
            <Button
              data-testid="pomodoro-skip"
              variant="tertiary"
              size="lg"
              @click="pomodoro.skip()"
            >
              <template #icon-left><SkipForward :size="16" /></template>
              Saltar
            </Button>
            <Button
              data-testid="pomodoro-reset"
              variant="tertiary"
              size="lg"
              @click="pomodoro.reset()"
            >
              <template #icon-left><RotateCcw :size="16" /></template>
              Reiniciar
            </Button>
          </div>
        </Card>
      </div>

      <div class="w-full flex-1 lg:max-w-[30rem] lg:overflow-y-auto">
        <PomodoroSettingsPanel
          :settings="pomodoro.settings"
          @update:settings="pomodoro.saveSettings"
        />
      </div>
    </div>
  </main>
</template>
