<script setup lang="ts">
import { ref, computed, watch, unref } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import { CALENDAR_COLORS, type CalendarEvent } from '@/schemas/calendar'
import Modal from '@/components/ui/Modal.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Textarea from '@/components/ui/Textarea.vue'
import TimePicker from '@/components/ui/TimePicker.vue'
import { Plus, Edit2, Trash2, X, AlertTriangle } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  date: string // YYYY-MM-DD
}>()

const emit = defineEmits<{
  close: []
}>()

const store = useCalendarStore()

const isFormMode = ref(false)
const editingEvent = ref<CalendarEvent | null>(null)

// Form Fields
const title = ref('')
const description = ref('')
const calendarId = ref('')
const startTime = ref('10:00')
const endTime = ref('11:00')
const selectedColorId = ref<string | undefined>(undefined)
const localError = ref<string | null>(null)
const loading = ref(false)

const filteredEvents = computed(() => {
  return store.events.filter((e) => e.date === props.date)
})

const formattedDateTitle = computed(() => {
  if (!props.date) return ''
  const [y, m, d] = props.date.split('-').map(Number)
  const dateObj = new Date(y, m - 1, d)
  const formatted = dateObj.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
})

const showPermissionWarning = computed(() => {
  const err = localError.value || unref(store.syncError) || ''
  return (
    err.includes('403') ||
    err.toLowerCase().includes('permission') ||
    err.toLowerCase().includes('scope')
  )
})

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    isFormMode.value = false
    editingEvent.value = null
    localError.value = null
  }
)

function enterCreateMode() {
  localError.value = null
  editingEvent.value = null
  title.value = ''
  description.value = ''

  // Default to first primary calendar or just the first calendar, or "local" if not connected
  if (store.connected) {
    const primaryCal = store.calendars.find((c) => c.primary) || store.calendars[0]
    calendarId.value = primaryCal ? primaryCal.id : 'local'
  } else {
    calendarId.value = 'local'
  }

  startTime.value = '10:00'
  endTime.value = '11:00'
  selectedColorId.value = undefined
  isFormMode.value = true
}

function enterEditMode(evt: CalendarEvent) {
  localError.value = null
  editingEvent.value = evt
  title.value = evt.title
  description.value = evt.description ?? ''
  calendarId.value = evt.calendarId

  // Parse hours from start and end
  startTime.value = parseTimeFromIso(evt.start)
  endTime.value = parseTimeFromIso(evt.end)

  // Find colorId matching the color hex (or default)
  const foundColorId = Object.keys(CALENDAR_COLORS).find(
    (key) => CALENDAR_COLORS[key].toLowerCase() === evt.color.toLowerCase()
  )
  selectedColorId.value = foundColorId

  isFormMode.value = true
}

function parseTimeFromIso(isoStr: string): string {
  if (!isoStr) return '10:00'
  if (isoStr.includes('T')) {
    return isoStr.split('T')[1].substring(0, 5)
  }
  return '00:00'
}

async function saveEvent() {
  if (!title.value.trim()) {
    localError.value = 'El título es obligatorio'
    return
  }

  localError.value = null
  loading.value = true

  try {
    const [hStart, mStart] = startTime.value.split(':').map(Number)
    const [hEnd, mEnd] = endTime.value.split(':').map(Number)
    const [y, m, d] = props.date.split('-').map(Number)

    // Construct local Date objects and get ISO string
    const startDate = new Date(y, m - 1, d, hStart, mStart)
    const endDate = new Date(y, m - 1, d, hEnd, mEnd)

    if (endDate <= startDate) {
      localError.value = 'La hora de fin debe ser mayor a la hora de inicio'
      loading.value = false
      return
    }

    const payload = {
      title: title.value,
      description: description.value || undefined,
      colorId: selectedColorId.value,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    }

    if (editingEvent.value) {
      await store.updateEvent(editingEvent.value.calendarId, editingEvent.value.id, payload)
    } else {
      await store.createEvent(calendarId.value, payload)
    }

    isFormMode.value = false
    editingEvent.value = null
  } catch (e: unknown) {
    localError.value = e instanceof Error ? e.message : 'Error al guardar el evento'
  } finally {
    loading.value = false
  }
}

async function deleteEvent() {
  if (!editingEvent.value) return
  localError.value = null
  loading.value = true
  try {
    await store.deleteEvent(editingEvent.value.calendarId, editingEvent.value.id)
    isFormMode.value = false
    editingEvent.value = null
  } catch (e: unknown) {
    localError.value = e instanceof Error ? e.message : 'Error al eliminar el evento'
  } finally {
    loading.value = false
  }
}

function cancelEdit() {
  isFormMode.value = false
  editingEvent.value = null
}
</script>

<template>
  <Modal :open="open" size="lg" @close="emit('close')">
    <div class="flex h-[550px] max-h-[90vh] flex-col bg-surface-1 p-6 text-ink">
      <!-- Header -->
      <header class="flex flex-shrink-0 items-start justify-between border-b border-hairline pb-4">
        <div>
          <h2 class="mb-1 text-headline font-semibold leading-tight text-ink">
            {{ isFormMode ? (editingEvent ? 'Editar Evento' : 'Nuevo Evento') : 'Agenda del Día' }}
          </h2>
          <p class="text-body-sm text-ink-muted">
            {{ formattedDateTitle }}
          </p>
        </div>
        <button
          class="rounded-sm p-1 text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Cerrar modal"
          @click="emit('close')"
        >
          <X :size="20" />
        </button>
      </header>

      <!-- Scrollable content area -->
      <div class="min-h-0 flex-1 overflow-y-auto py-4">
        <!-- Error Banner / Permissions warning -->
        <div
          v-if="localError || store.syncError"
          class="mb-4 flex gap-3 rounded-lg border p-3 text-body-sm"
          :class="
            showPermissionWarning
              ? 'border-accent-red/25 bg-accent-red-tint text-accent-red'
              : 'border-hairline bg-surface-2 text-ink-muted'
          "
        >
          <AlertTriangle :size="18" class="flex-shrink-0 text-accent-red" />
          <div>
            <p v-if="showPermissionWarning" class="font-medium text-accent-red">
              Permisos requeridos:
            </p>
            <p>
              {{
                showPermissionWarning
                  ? 'Para guardar cambios en tu Google Calendar, por favor ve a la pestaña de Ajustes y reconectá tu cuenta de Google para otorgar permisos de escritura.'
                  : localError || store.syncError
              }}
            </p>
          </div>
        </div>

        <!-- VIEW MODE: EVENTS LIST -->
        <div v-if="!isFormMode" class="flex flex-col gap-4">
          <div
            v-if="filteredEvents.length === 0"
            class="flex flex-col items-center justify-center py-12 text-center"
          >
            <p class="mb-4 text-body-sm text-ink-muted">No hay eventos agendados para este día.</p>
            <Button
              variant="secondary"
              size="sm"
              data-testid="add-event-btn"
              @click="enterCreateMode"
            >
              <Plus :size="14" class="mr-1.5" /> Agregar Evento
            </Button>
          </div>

          <div v-else class="flex flex-col gap-3">
            <div
              v-for="evt in filteredEvents"
              :key="evt.id"
              class="flex items-start justify-between rounded-lg border border-hairline bg-surface-2 p-3 transition-colors hover:border-hairline-strong"
            >
              <div class="flex gap-3">
                <span
                  class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded-full"
                  :style="{ backgroundColor: evt.color }"
                />
                <div class="flex min-w-0 flex-col gap-1">
                  <h4 class="truncate text-body-sm font-medium leading-normal text-ink">
                    {{ evt.title }}
                  </h4>
                  <p class="text-caption font-medium text-ink-muted">
                    {{ parseTimeFromIso(evt.start) }} - {{ parseTimeFromIso(evt.end) }}
                  </p>
                  <p
                    v-if="evt.description"
                    class="mt-1 whitespace-pre-wrap text-caption leading-relaxed text-ink-subtle"
                  >
                    {{ evt.description }}
                  </p>
                </div>
              </div>

              <div class="ml-2 flex flex-shrink-0 gap-1.5">
                <button
                  class="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
                  data-testid="edit-event-btn"
                  title="Editar evento"
                  @click="enterEditMode(evt)"
                >
                  <Edit2 :size="14" />
                </button>
              </div>
            </div>

            <div class="mt-4 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                data-testid="add-event-btn"
                @click="enterCreateMode"
              >
                <Plus :size="14" class="mr-1.5" /> Agregar Evento
              </Button>
            </div>
          </div>
        </div>

        <!-- EDIT/CREATE MODE: FORM -->
        <div v-else class="flex flex-col gap-4">
          <!-- Title -->
          <div>
            <label
              class="mb-1.5 block text-caption font-semibold uppercase tracking-wider text-ink-muted"
              >Título</label
            >
            <Input
              v-model="title"
              placeholder="Título del evento"
              data-testid="event-title-input"
            />
          </div>

          <!-- Description -->
          <div>
            <label
              class="mb-1.5 block text-caption font-semibold uppercase tracking-wider text-ink-muted"
              >Descripción</label
            >
            <Textarea
              v-model="description"
              placeholder="Descripción del evento (opcional)"
              data-testid="event-desc-input"
              :rows="3"
            />
          </div>

          <!-- Calendar Selector -->
          <div v-if="!editingEvent">
            <label
              class="mb-1.5 block text-caption font-semibold uppercase tracking-wider text-ink-muted"
              >Calendario de Destino</label
            >
            <select
              v-model="calendarId"
              class="w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
              data-testid="calendar-select"
            >
              <option value="local">Local (Solo esta app)</option>
              <option v-for="cal in store.calendars" :key="cal.id" :value="cal.id">
                Google: {{ cal.summary }} {{ cal.primary ? '(Principal)' : '' }}
              </option>
            </select>
          </div>

          <!-- Times (Start / End) -->
          <div class="flex gap-4">
            <div class="flex-1">
              <label
                class="mb-1.5 block text-center text-caption font-semibold uppercase tracking-wider text-ink-muted"
                >Inicio</label
              >
              <TimePicker v-model="startTime" data-testid="event-start-picker" />
            </div>
            <div class="flex-1">
              <label
                class="mb-1.5 block text-center text-caption font-semibold uppercase tracking-wider text-ink-muted"
                >Fin</label
              >
              <TimePicker v-model="endTime" data-testid="event-end-picker" />
            </div>
          </div>

          <!-- Google Calendar Color Picker -->
          <div>
            <label
              class="mb-1.5 block text-caption font-semibold uppercase tracking-wider text-ink-muted"
              >Color del Evento</label
            >
            <div
              class="flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-surface-2 p-3"
            >
              <button
                type="button"
                class="flex h-6 w-6 items-center justify-center rounded-full border-2 text-caption font-medium transition-all"
                :class="
                  selectedColorId === undefined
                    ? 'scale-110 border-ink bg-transparent text-ink ring-2 ring-primary/25'
                    : 'border-transparent text-ink-muted hover:scale-105'
                "
                title="Color predeterminado del calendario"
                @click="selectedColorId = undefined"
              >
                Def
              </button>
              <button
                v-for="(hex, id) in CALENDAR_COLORS"
                :key="id"
                type="button"
                class="h-6 w-6 rounded-full border-2 transition-all"
                :class="
                  selectedColorId === id
                    ? 'scale-110 border-ink ring-2 ring-primary/25'
                    : 'border-transparent hover:scale-105'
                "
                :style="{ backgroundColor: hex }"
                :aria-label="`Color ${id}`"
                @click="selectedColorId = String(id)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <footer class="flex flex-shrink-0 items-center justify-between border-t border-hairline pt-4">
        <div>
          <Button
            v-if="isFormMode && editingEvent"
            variant="danger"
            size="sm"
            :loading="loading"
            data-testid="delete-event-btn"
            @click="deleteEvent"
          >
            <Trash2 :size="14" class="mr-1.5" /> Eliminar
          </Button>
        </div>
        <div class="flex gap-2">
          <Button v-if="isFormMode" variant="ghost" size="sm" @click="cancelEdit">
            Cancelar
          </Button>
          <Button
            v-if="isFormMode"
            variant="primary"
            size="sm"
            :loading="loading"
            data-testid="save-event-btn"
            @click="saveEvent"
          >
            Guardar
          </Button>
          <Button v-else variant="ghost" size="sm" @click="emit('close')"> Cerrar </Button>
        </div>
      </footer>
    </div>
  </Modal>
</template>
