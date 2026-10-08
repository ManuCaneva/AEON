<script setup lang="ts">
import { Volume2 } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import Input from '@/components/ui/Input.vue'
import Switch from '@/components/ui/Switch.vue'
import Text from '@/components/ui/Text.vue'
import { usePomodoroStore } from '@/stores/pomodoro'
import type { PomodoroSettings } from '@/schemas/pomodoro'

defineProps<{
  settings: PomodoroSettings
}>()

const emit = defineEmits<{
  'update:settings': [patch: Partial<PomodoroSettings>]
}>()

const pomodoro = usePomodoroStore()

async function playTestSound(): Promise<void> {
  await pomodoro.prepareAudio().catch(() => {})
  pomodoro.playTestSound()
}

function saveNumber(
  key: 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'longBreakInterval',
  value: string
) {
  const parsed = Number(value)
  if (Number.isInteger(parsed) && parsed > 0) emit('update:settings', { [key]: parsed })
}

function saveVolume(value: string) {
  const parsed = Number(value)
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1)
    emit('update:settings', { volume: parsed })
}
</script>

<template>
  <Card data-testid="pomodoro-settings" variant="featured" padding="md">
    <div class="mb-5">
      <Text variant="card-title" as="h2">Configuración</Text>
      <Text variant="body-sm" color="muted">Ajustá la duración y los avisos del temporizador.</Text>
    </div>

    <Text variant="eyebrow" color="subtle" class="mb-3">Duraciones</Text>
    <div class="grid gap-4 sm:grid-cols-2">
      <Input
        :model-value="String(settings.focusMinutes)"
        type="number"
        min="1"
        label="Enfoque (minutos)"
        data-testid="setting-focus-minutes"
        @update:model-value="saveNumber('focusMinutes', $event)"
      />
      <Input
        :model-value="String(settings.shortBreakMinutes)"
        type="number"
        min="1"
        label="Descanso corto (minutos)"
        data-testid="setting-short-break-minutes"
        @update:model-value="saveNumber('shortBreakMinutes', $event)"
      />
      <Input
        :model-value="String(settings.longBreakMinutes)"
        type="number"
        min="1"
        label="Descanso largo (minutos)"
        data-testid="setting-long-break-minutes"
        @update:model-value="saveNumber('longBreakMinutes', $event)"
      />
      <Input
        :model-value="String(settings.longBreakInterval)"
        type="number"
        min="1"
        label="Descanso largo cada (sesiones)"
        data-testid="setting-long-break-interval"
        @update:model-value="saveNumber('longBreakInterval', $event)"
      />
    </div>

    <Text variant="eyebrow" color="subtle" class="mb-3 mt-5 border-t border-hairline pt-5">
      Automatización
    </Text>
    <div class="flex flex-col gap-4">
      <Switch
        :model-value="settings.autoStartBreak"
        label="Iniciar descansos automáticamente"
        data-testid="setting-auto-start-break"
        @update:model-value="emit('update:settings', { autoStartBreak: $event })"
      />
      <Switch
        :model-value="settings.autoStartFocus"
        label="Iniciar enfoque automáticamente"
        data-testid="setting-auto-start-focus"
        @update:model-value="emit('update:settings', { autoStartFocus: $event })"
      />
    </div>

    <Text variant="eyebrow" color="subtle" class="mb-3 mt-5 border-t border-hairline pt-5">
      Sonido
    </Text>
    <div class="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
      <div>
        <label for="pomodoro-volume" class="mb-1.5 block text-body-sm text-ink-muted">
          Volumen ({{ Math.round(settings.volume * 100) }}%)
        </label>
        <input
          id="pomodoro-volume"
          data-testid="setting-volume"
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="settings.volume"
          class="h-2 w-full cursor-pointer accent-primary"
          @input="saveVolume(($event.target as HTMLInputElement).value)"
        />
      </div>
      <Switch
        :model-value="settings.muted"
        label="Silenciar"
        data-testid="setting-mute"
        @update:model-value="emit('update:settings', { muted: $event })"
      />
    </div>
    <div class="mt-4 flex flex-col items-start gap-1.5">
      <Button variant="secondary" size="sm" data-testid="setting-test-sound" @click="playTestSound">
        <template #icon-left><Volume2 :size="14" /></template>
        Probar sonido
      </Button>
    </div>
  </Card>
</template>
