<script setup lang="ts">
import { ref } from 'vue'
import { Trash2, Upload } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'
import { validateImageFile, fileToDataUrl, MAX_WALLPAPER_MB } from '@/lib/wallpaper'
import { PRESET_WALLPAPERS } from '@/lib/presetWallpapers'
import Card from '@/components/ui/Card.vue'
import Text from '@/components/ui/Text.vue'
import Button from '@/components/ui/Button.vue'

const ui = useUiStore()

const fileInput = ref<HTMLInputElement | null>(null)
const error = ref<string | null>(null)

function pickFile() {
  fileInput.value?.click()
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const validation = validateImageFile(file)
  if (!validation.ok) {
    error.value =
      validation.reason === 'type'
        ? 'El archivo debe ser una imagen.'
        : `La imagen supera el máximo de ${MAX_WALLPAPER_MB} MB.`
    return
  }

  try {
    const dataUrl = await fileToDataUrl(file)
    await ui.setWallpaper(dataUrl)
    error.value = null
  } catch {
    error.value = 'No se pudo guardar el fondo. Intentá de nuevo.'
  }
}

async function onSelectPreset(presetId: string) {
  try {
    await ui.setWallpaperPreset(presetId)
    error.value = null
  } catch {
    error.value = 'No se pudo guardar el fondo. Intentá de nuevo.'
  }
}

async function onRemove() {
  error.value = null
  await ui.removeWallpaper()
}

function onAlphaChange(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isNaN(value)) return
  ui.setWidgetGlassAlpha(value).catch(() => {
    error.value = 'No se pudo guardar la translucidez. Intentá de nuevo.'
  })
}
</script>

<template>
  <Card variant="default" padding="md" data-testid="wallpaper-card">
    <div class="flex items-start justify-between gap-3">
      <div class="flex flex-col gap-1">
        <Text variant="card-title" as="h2">Fondo</Text>
        <Text variant="body-sm" color="muted">
          Tu imagen se muestra desenfocada y atenuada para no competir con el contenido.
        </Text>
      </div>
    </div>

    <div class="mt-4 flex flex-col gap-3">
      <div class="grid grid-cols-[1fr_auto] items-start gap-3">
        <div
          data-testid="wallpaper-preview"
          class="wallpaper-image-blur relative h-28 overflow-hidden rounded-md border border-hairline bg-cover bg-center"
          :class="!ui.wallpaperUrl && 'wallpaper-fallback'"
          :style="ui.wallpaperUrl ? `background-image: url('${ui.wallpaperUrl}')` : undefined"
        >
          <div class="wallpaper-scrim absolute inset-0" />
          <div
            data-testid="wallpaper-preview-mock"
            aria-hidden="true"
            class="absolute inset-0 flex gap-1.5 p-2"
          >
            <div class="w-6 shrink-0 rounded bg-surface-1/70" />
            <div class="flex min-w-0 flex-1 flex-col gap-1.5">
              <div class="h-4 rounded bg-surface-1/70" />
              <div class="flex min-h-0 flex-1 gap-1.5">
                <div class="min-h-0 flex-1 rounded bg-surface-1/70" />
                <div class="min-h-0 flex-1 rounded bg-surface-1/70" />
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <Button
            variant="secondary"
            size="sm"
            data-testid="wallpaper-upload-btn"
            @click="pickFile"
          >
            <template #icon-left><Upload :size="14" /></template>
            Subir archivo
          </Button>
          <div
            data-testid="wallpaper-preset-group"
            role="radiogroup"
            aria-label="Fondos disponibles"
            class="flex items-center gap-1.5"
          >
            <button
              v-for="preset in PRESET_WALLPAPERS"
              :key="preset.id"
              type="button"
              role="radio"
              :aria-checked="ui.wallpaperPresetId === preset.id"
              :aria-label="preset.label"
              :title="preset.label"
              :data-testid="`wallpaper-preset-${preset.id}`"
              class="h-8 w-8 shrink-0 cursor-pointer rounded-full border border-hairline bg-cover bg-center transition-shadow duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              :class="
                ui.wallpaperPresetId === preset.id
                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-canvas'
                  : 'hover:border-hairline-strong'
              "
              :style="`background-image: url('${preset.url}')`"
              @click="onSelectPreset(preset.id)"
            />
          </div>
          <Button
            v-if="ui.wallpaperUrl"
            variant="ghost"
            size="sm"
            data-testid="wallpaper-remove-btn"
            class="self-start"
            @click="onRemove"
          >
            <template #icon-left><Trash2 :size="14" /></template>
            Quitar
          </Button>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="flex items-center justify-between gap-2" for="glass-alpha">
          <Text variant="body-sm" color="muted">Translucidez de los widgets</Text>
          <Text variant="body-sm" color="muted" class="tabular-nums">
            {{ Math.round(ui.widgetGlassAlpha * 100) }}%
          </Text>
        </label>
        <input
          id="glass-alpha"
          type="range"
          min="0.5"
          max="1"
          step="0.05"
          :value="ui.widgetGlassAlpha"
          data-testid="glass-alpha-slider"
          @change="onAlphaChange"
        />
      </div>

      <Text v-if="error" variant="caption" color="subtle" data-testid="wallpaper-error">
        {{ error }}
      </Text>

      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden"
        data-testid="wallpaper-input"
        @change="onFileChange"
      />
    </div>
  </Card>
</template>
