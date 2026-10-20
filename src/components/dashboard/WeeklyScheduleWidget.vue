<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import Container from '@/components/ui/Container.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Text from '@/components/ui/Text.vue'
import { Settings, Plus, Pencil } from 'lucide-vue-next'
import WeeklyScheduleGrid from './WeeklyScheduleGrid.vue'
import WeeklyScheduleModal from './WeeklyScheduleModal.vue'
import WeeklyScheduleSettingsModal from './WeeklyScheduleSettingsModal.vue'
import { useWeeklyScheduleStore } from '@/stores/weeklySchedule'
import { useUiStore } from '@/stores/ui'
import type { ScheduleBlockWithSlots } from '@/schemas/weeklySchedule'

const store = useWeeklyScheduleStore()
const ui = useUiStore()
const editingBlock = ref<ScheduleBlockWithSlots | null>(null)
const showCreate = ref(false)
const showSettings = ref(false)

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !ui.scheduleEditMode) return
  // Un modal abierto consume su propio Esc: el modo no se cierra a la vez.
  if (showCreate.value || showSettings.value || editingBlock.value) return
  ui.exitScheduleEditMode()
}

onMounted(() => {
  store.loadAll()
  // En captura para resolver antes que el Esc de los modales y poder
  // ignorarlo cuando hay uno abierto.
  document.addEventListener('keydown', onKeydown, { capture: true })
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown, { capture: true })
})

function openEdit(b: ScheduleBlockWithSlots) {
  editingBlock.value = b
}
</script>

<template>
  <Container
    variant="default"
    glass
    padding="none"
    class="container-widget h-full overflow-hidden"
    style="container-type: inline-size"
    data-testid="weekly-schedule-widget"
  >
    <div class="flex h-full min-h-0 flex-col">
      <header
        class="schedule-widget-header flex flex-shrink-0 items-center justify-between border-b border-hairline bg-surface-2 px-2 py-1"
      >
        <Text variant="card-title" weight="600" class="min-w-0 truncate text-left"
          >Cronograma Semanal</Text
        >
        <div class="flex items-center justify-end gap-1">
          <IconButton
            label="Editar cronograma"
            size="sm"
            data-testid="schedule-edit-toggle"
            :disabled="ui.editMode"
            :aria-pressed="ui.scheduleEditMode"
            @click="ui.toggleScheduleEditMode()"
          >
            <Pencil
              class="h-3.5 w-3.5"
              :class="ui.scheduleEditMode ? 'text-accent-purple' : 'text-ink-muted'"
            />
          </IconButton>
          <IconButton label="Ajustes" size="sm" @click="showSettings = true">
            <Settings class="h-3.5 w-3.5 text-ink-muted" />
          </IconButton>
          <IconButton label="Nuevo bloque" size="sm" @click="showCreate = true">
            <Plus class="h-3.5 w-3.5 text-ink-muted" />
          </IconButton>
        </div>
      </header>
      <div
        v-if="store.lastError"
        class="select-text whitespace-pre-wrap border-b border-accent-red/25 bg-accent-red-tint p-3 text-xs text-accent-red"
      >
        Error al cargar: {{ store.lastError }}
      </div>
      <div
        data-testid="schedule-edit-content"
        class="min-h-0 flex-1 overflow-hidden"
        :class="ui.scheduleEditMode && 'grayscale'"
      >
        <WeeklyScheduleGrid class="h-full" @edit="openEdit" />
      </div>
    </div>
    <WeeklyScheduleModal :open="showCreate" :block="null" @close="showCreate = false" />
    <WeeklyScheduleModal
      :open="!!editingBlock"
      :block="editingBlock"
      @close="editingBlock = null"
    />
    <WeeklyScheduleSettingsModal :open="showSettings" @close="showSettings = false" />
  </Container>
</template>
