<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import Container from '@/components/ui/Container.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Text from '@/components/ui/Text.vue'
import { Settings, Plus, Pencil } from 'lucide-vue-next'
import WeeklyScheduleGrid from './WeeklyScheduleGrid.vue'
import WeeklyScheduleModal from './WeeklyScheduleModal.vue'
import WeeklyScheduleSettingsModal from './WeeklyScheduleSettingsModal.vue'
import { useWeeklyScheduleStore } from '@/stores/weeklySchedule'
import { useUiStore } from '@/stores/ui'
import { MINUTES_PER_DAY } from '@/lib/scheduleTime'
import type { ScheduleBlockWithSlots, ScheduleClipboardPayload } from '@/schemas/weeklySchedule'

const store = useWeeklyScheduleStore()
const ui = useUiStore()
const editingBlock = ref<ScheduleBlockWithSlots | null>(null)
const showCreate = ref(false)
const showSettings = ref(false)
// Ocurrencia elegida en la grilla: sobre ella actúan la × y `Supr`.
const selectedSlotId = ref<string | null>(null)
// La grilla avisa cuando hay un nombre editándose inline: ese Esc cancela el
// nombre, no cierra el modo edición.
const inlineNameEditing = ref(false)
// Copia de una ocurrencia: título, color y duración para pegar como bloque
// nuevo independiente. El pegado sigue al puntero hasta que se coloca o se
// termina con Esc.
const clipboard = ref<ScheduleClipboardPayload | null>(null)
const pasting = ref(false)

// Salir del modo no deja una selección colgada para la próxima entrada, ni un
// pegado activo ni una copia vieja.
watch(
  () => ui.scheduleEditMode,
  (active) => {
    if (active) return
    selectedSlotId.value = null
    pasting.value = false
    clipboard.value = null
  }
)

async function removeOccurrence(slotId: string) {
  await store.deleteSlot(slotId)
  if (selectedSlotId.value === slotId) selectedSlotId.value = null
}

function copyOccurrence(slotId: string) {
  const block = store.blockForSlot(slotId)
  if (!block) return
  const slot = block.slots.find((s) => s.id === slotId)
  if (!slot) return
  clipboard.value = {
    title: block.title,
    color: block.color,
    durationMinutes: slot.end_minutes - slot.start_minutes,
  }
}

function startPaste() {
  if (!clipboard.value) return
  pasting.value = true
}

async function pasteOccurrence(day: number, startMinutes: number) {
  const clip = clipboard.value
  if (!clip || !store.enabledDays.includes(day)) return
  // La grilla ya rechazó los destinos que no entran en el día: acá no se
  // reubica la copia en silencio.
  if (startMinutes < 0 || startMinutes + clip.durationMinutes > MINUTES_PER_DAY) return
  try {
    await store.createBlock({ title: clip.title, color: clip.color, sort_order: 0 }, [
      {
        day_of_week: day,
        start_minutes: startMinutes,
        end_minutes: startMinutes + clip.durationMinutes,
      },
    ])
  } catch (e) {
    console.error('No se pudo pegar el bloque en la grilla:', e)
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.tagName !== 'string') return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable
}

function onKeydown(event: KeyboardEvent) {
  if (!ui.scheduleEditMode) return
  // Un modal abierto consume sus propias teclas: el modo no actúa por detrás.
  if (showCreate.value || showSettings.value || editingBlock.value) return
  if (event.key === 'Escape') {
    // Un nombre en edición inline consume su propio Esc: cancela el nombre.
    if (inlineNameEditing.value) return
    // Con el pegado activo, Esc termina el pegado antes que salir del modo.
    if (pasting.value) {
      pasting.value = false
      return
    }
    ui.exitScheduleEditMode()
    return
  }
  if (isEditableTarget(event.target)) return
  if ((event.ctrlKey || event.metaKey) && !event.altKey) {
    const key = event.key.toLowerCase()
    if (key === 'c' && selectedSlotId.value !== null) {
      event.preventDefault()
      copyOccurrence(selectedSlotId.value)
      return
    }
    if (key === 'v' && clipboard.value !== null) {
      event.preventDefault()
      startPaste()
      return
    }
  }
  if (event.key !== 'Delete') return
  if (selectedSlotId.value === null) return
  event.preventDefault()
  void removeOccurrence(selectedSlotId.value)
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
      <div data-testid="schedule-edit-content" class="min-h-0 flex-1 overflow-hidden">
        <WeeklyScheduleGrid
          class="h-full"
          :selected-slot-id="selectedSlotId"
          :clipboard="clipboard"
          :pasting="pasting"
          @select="selectedSlotId = $event"
          @remove="removeOccurrence"
          @copy="copyOccurrence"
          @paste-start="startPaste"
          @paste="pasteOccurrence"
          @edit="openEdit"
          @name-edit-state="inlineNameEditing = $event"
        />
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
