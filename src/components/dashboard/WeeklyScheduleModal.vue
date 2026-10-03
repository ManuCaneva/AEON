<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import TimePicker from '@/components/ui/TimePicker.vue'
import { useWeeklyScheduleStore, minutesToHHMM, hhmmToMinutes } from '@/stores/weeklySchedule'
import { blockColorRgb } from '@/lib/scheduleColors'
import {
  BLOCK_COLOR_TOKENS,
  SCHEDULE_VALIDATION_ERRORS,
  type SaveScheduleSlotDraft,
  type ScheduleBlockWithSlots,
} from '@/schemas/weeklySchedule'

const props = defineProps<{ open: boolean; block: ScheduleBlockWithSlots | null }>()
const emit = defineEmits<{ close: [] }>()
const store = useWeeklyScheduleStore()

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const enabledDays = computed(() => store.enabledDays)

const title = ref('')
const color = ref<(typeof BLOCK_COLOR_TOKENS)[number]>('lavender')
const error = ref<string | null>(null)
const drafts = ref<SaveScheduleSlotDraft[]>([])

const slotDay = ref(0)
const slotStart = ref('06:00')
const slotEnd = ref('07:00')
const editingIndex = ref<number | null>(null)

function resetSlotForm() {
  slotDay.value = enabledDays.value[0] ?? 0
  slotStart.value = '06:00'
  slotEnd.value = '07:00'
  editingIndex.value = null
}

function resetAll() {
  error.value = null
  if (props.block) {
    title.value = props.block.title
    color.value = props.block.color
    drafts.value = props.block.slots.map((s) => ({
      id: s.id,
      day_of_week: s.day_of_week,
      start_minutes: s.start_minutes,
      end_minutes: s.end_minutes,
    }))
  } else {
    title.value = ''
    color.value = 'lavender'
    drafts.value = []
  }
  resetSlotForm()
}

watch(
  () => props.open,
  (o) => {
    if (o) resetAll()
  },
  { immediate: true }
)

function addOrUpdateSlot() {
  error.value = null
  const start = hhmmToMinutes(slotStart.value)
  const end = hhmmToMinutes(slotEnd.value)
  if (end <= start) {
    error.value = SCHEDULE_VALIDATION_ERRORS.endAfterStart
    return
  }
  const draft: SaveScheduleSlotDraft = {
    day_of_week: slotDay.value,
    start_minutes: start,
    end_minutes: end,
  }
  if (editingIndex.value !== null) {
    const existing = drafts.value[editingIndex.value]
    drafts.value[editingIndex.value] = existing?.id ? { ...existing, ...draft } : draft
  } else {
    drafts.value.push(draft)
  }
  resetSlotForm()
}

function startEditing(index: number) {
  const d = drafts.value[index]
  if (!d) return
  editingIndex.value = index
  slotDay.value = d.day_of_week
  slotStart.value = minutesToHHMM(d.start_minutes)
  slotEnd.value = minutesToHHMM(d.end_minutes)
}

function cancelSlotEdit() {
  resetSlotForm()
}

function removeDraft(index: number) {
  drafts.value.splice(index, 1)
  if (editingIndex.value === index) resetSlotForm()
  else if (editingIndex.value !== null && editingIndex.value > index) editingIndex.value--
}

async function save() {
  error.value = null
  try {
    if (props.block) {
      await store.saveBlock({
        blockId: props.block.id,
        title: title.value,
        color: color.value,
        slots: drafts.value,
      })
    } else {
      await store.saveBlock({
        title: title.value,
        color: color.value,
        slots: drafts.value,
      })
    }
    emit('close')
  } catch (e: unknown) {
    error.value = String(e instanceof Error ? e.message : e)
  }
}

async function deleteBlock() {
  if (!props.block) return
  try {
    await store.deleteBlock(props.block.id)
    emit('close')
  } catch (e: unknown) {
    error.value = String(e instanceof Error ? e.message : e)
  }
}
</script>

<template>
  <Modal :open="open" size="md" @close="emit('close')">
    <div class="p-4">
      <h3 class="mb-3 text-card-title font-semibold text-ink">
        {{ block ? 'Editar bloque' : 'Nuevo bloque' }}
      </h3>
      <label class="mb-1 block text-caption font-medium text-ink-muted">Título</label>
      <Input v-model="title" placeholder="Ej. Gimnasio" />

      <label class="mb-1.5 mt-3 block text-caption font-medium text-ink-muted">Color</label>
      <div class="flex gap-2">
        <button
          v-for="c in BLOCK_COLOR_TOKENS"
          :key="c"
          type="button"
          :class="[
            'h-6 w-6 rounded-md border-2 transition-all',
            c === color
              ? 'scale-110 border-ink ring-2 ring-primary/25'
              : 'border-transparent hover:scale-105',
          ]"
          :style="{ backgroundColor: blockColorRgb(c) }"
          :aria-label="c"
          @click="color = c"
        />
      </div>

      <div class="mt-4">
        <label class="mb-2 block text-caption font-medium text-ink-muted">Horarios</label>
        <div v-if="drafts.length === 0" class="mb-2 text-body-sm italic text-ink-subtle">
          Sin horarios asignados
        </div>
        <div
          v-for="(draft, index) in drafts"
          :key="index"
          :class="[
            'mb-2 flex items-center gap-2 rounded-md border bg-surface-2 p-2',
            editingIndex === index ? 'border-primary' : 'border-hairline',
          ]"
        >
          <div class="flex-1 text-body-sm">
            <span class="font-medium">{{ DAYS[draft.day_of_week] }}</span>
            <span class="ml-2 text-ink-subtle"
              >{{ minutesToHHMM(draft.start_minutes) }} -
              {{ minutesToHHMM(draft.end_minutes) }}</span
            >
          </div>
          <button
            type="button"
            class="px-2 py-1 text-caption text-primary hover:text-primary-hover"
            @click="startEditing(index)"
          >
            Editar
          </button>
          <button
            type="button"
            class="px-2 py-1 text-caption text-accent-red transition-colors hover:text-accent-red/80"
            @click="removeDraft(index)"
          >
            Eliminar
          </button>
        </div>
      </div>

      <div class="mt-4 rounded-lg border border-hairline bg-surface-2 p-3">
        <label class="mb-2 block text-caption font-medium text-ink-muted">
          {{ editingIndex !== null ? 'Editar horario' : 'Agregar horario' }}
        </label>
        <label class="mb-1 block text-caption font-medium text-ink-muted">Día</label>
        <select
          v-model="slotDay"
          class="mb-2 w-full rounded-md border border-hairline bg-surface-2 px-2 py-1.5 text-body"
        >
          <option v-for="i in enabledDays" :key="i" :value="i">{{ DAYS[i] }}</option>
        </select>
        <div class="flex gap-3">
          <div class="flex-1">
            <label class="mb-1.5 block text-center text-caption font-medium text-ink-muted"
              >Inicio</label
            >
            <TimePicker v-model="slotStart" />
          </div>
          <div class="flex-1">
            <label class="mb-1.5 block text-center text-caption font-medium text-ink-muted"
              >Fin</label
            >
            <TimePicker v-model="slotEnd" />
          </div>
        </div>
        <div class="mt-2 flex gap-2">
          <Button size="sm" @click="addOrUpdateSlot">
            {{ editingIndex !== null ? 'Actualizar' : 'Agregar' }}
          </Button>
          <Button v-if="editingIndex !== null" size="sm" variant="ghost" @click="cancelSlotEdit"
            >Cancelar</Button
          >
        </div>
      </div>

      <p v-if="error" class="mt-2 text-body-sm text-accent-red">{{ error }}</p>

      <div class="mt-5 flex justify-between">
        <Button v-if="block" variant="danger" @click="deleteBlock">Eliminar</Button>
        <div v-else />
        <div class="flex gap-2">
          <Button variant="ghost" @click="emit('close')">Cancelar</Button>
          <Button @click="save">Guardar</Button>
        </div>
      </div>
    </div>
  </Modal>
</template>
