<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Container from '@/components/ui/Container.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Text from '@/components/ui/Text.vue'
import { Settings, Plus } from 'lucide-vue-next'
import WeeklyScheduleGrid from './WeeklyScheduleGrid.vue'
import WeeklyScheduleModal from './WeeklyScheduleModal.vue'
import WeeklyScheduleSettingsModal from './WeeklyScheduleSettingsModal.vue'
import { useWeeklyScheduleStore } from '@/stores/weeklySchedule'
import type { ScheduleBlockWithSlots } from '@/schemas/weeklySchedule'

const store = useWeeklyScheduleStore()
const editingBlock = ref<ScheduleBlockWithSlots | null>(null)
const showCreate = ref(false)
const showSettings = ref(false)

onMounted(() => store.loadAll())

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
      <WeeklyScheduleGrid class="min-h-0 flex-1 overflow-hidden" @edit="openEdit" />
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
