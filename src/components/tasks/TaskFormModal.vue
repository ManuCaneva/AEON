<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useTasksStore } from '@/stores/tasks'
import { useWeeklyScheduleStore } from '@/stores/weeklySchedule'
import { useCalendarStore } from '@/stores/calendar'
import { HABIT_COLORS } from '@/lib/habitColors'
import { blockColorRgb } from '@/lib/scheduleColors'
import { eventKey, type EventChoice } from '@/lib/entityEventLink'
import type { EntityEventLink } from '@/schemas/entityLink'
import type { TaskStep } from '@/schemas/tasks'
import Modal from '@/components/ui/Modal.vue'
import Input from '@/components/ui/Input.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Button from '@/components/ui/Button.vue'
import Text from '@/components/ui/Text.vue'
import { X } from 'lucide-vue-next'

const ui = useUiStore()
const tasks = useTasksStore()
const weekly = useWeeklyScheduleStore()
const calendar = useCalendarStore()

const editing = computed(() => {
  if (!ui.editingTaskId) return null
  return tasks.tasks.find((t) => t.id === ui.editingTaskId) ?? null
})

const isEdit = computed(() => editing.value !== null)

const title = ref('')
const description = ref('')
const color = ref<string>(HABIT_COLORS[0].value)
const due_date = ref<string>('')
const blockId = ref('')
const steps = ref<TaskStep[]>([])
const error = ref<string | null>(null)
const calendarError = ref<string | null>(null)
const saving = ref(false)

// Id de la tarea ya persistida cuando la creación del evento falló: un
// reintento edita en vez de crear una tarea duplicada.
const savedTaskId = ref<string | null>(null)

// Opción de evento elegida (cuatro excluyentes; ver EventChoice).
const eventMode = ref<'none' | 'local' | 'new' | 'existing'>('none')
const newCalendarId = ref('')
// Vínculo a un evento del día codificado como clave del par. '' = sin vínculo.
const linkedEventKey = ref('')

const blocks = computed(() => weekly.blocksWithSlots)

// Color de la vista previa: el del bloque elegido; si no, el manual.
const previewColor = computed(() => {
  const block = blocks.value.find((b) => b.id === blockId.value)
  return block ? blockColorRgb(block.color) : color.value
})

const hasDueDate = computed(() => due_date.value !== '')
const googleConnected = computed(() => calendar.connected)

// Eventos del día elegido. Si el vínculo actual no está entre ellos (huérfano,
// p.ej. el evento se borró) se conserva como "Evento no disponible" para poder
// limpiarlo sin perderlo en silencio.
const dayEvents = computed(() => calendar.events.filter((e) => e.date === due_date.value))
const eventOptions = computed(() => {
  const options = dayEvents.value.map((e) => ({
    key: eventKey(e.calendarId, e.id),
    label: e.title,
  }))
  if (linkedEventKey.value && !options.some((o) => o.key === linkedEventKey.value)) {
    options.unshift({ key: linkedEventKey.value, label: 'Evento no disponible' })
  }
  return options
})

function defaultCalendarId(): string {
  const list = calendar.calendars
  return list.find((c) => c.primary)?.id ?? list[0]?.id ?? ''
}

// El calendario destino por defecto es el principal; el modelo cae a ese
// valor mientras el usuario no elija otro.
const newCalendarIdModel = computed({
  get: () => newCalendarId.value || defaultCalendarId(),
  set: (value: string) => {
    newCalendarId.value = value
  },
})

/** Traduce la clave elegida al par persistible (o null si no hay vínculo). */
function resolveEventLink(): EntityEventLink | null {
  if (!linkedEventKey.value) return null
  const [calendarId, eventId] = linkedEventKey.value.split('\u0000')
  if (!calendarId || !eventId) return null
  return { calendarId, eventId }
}

/** Traduce la opción elegida a la decisión que consume el store. */
function resolveEventChoice(): EventChoice {
  if (!hasDueDate.value) return { mode: 'none' }
  if (eventMode.value === 'local') return { mode: 'local' }
  if (eventMode.value === 'new') return { mode: 'new', calendarId: newCalendarIdModel.value }
  if (eventMode.value === 'existing') {
    const link = resolveEventLink()
    return link ? { mode: 'existing', link } : { mode: 'none' }
  }
  return { mode: 'none' }
}

watch(
  () => [ui.createTaskOpen, ui.editingTaskId] as const,
  ([open]) => {
    if (open) {
      // Asegura que el selector liste los bloques aunque el widget del
      // Cronograma semanal no esté montado en el dashboard.
      void weekly.loadAll()
      if (editing.value) {
        title.value = editing.value.title
        description.value = editing.value.description ?? ''
        color.value = editing.value.color
        due_date.value = editing.value.due_date ?? ''
        blockId.value = editing.value.block_id ?? ''
        steps.value = [...editing.value.steps]
        linkedEventKey.value = editing.value.event_link
          ? eventKey(editing.value.event_link.calendarId, editing.value.event_link.eventId)
          : ''
        eventMode.value = editing.value.event_link ? 'existing' : 'none'
      } else {
        title.value = ''
        description.value = ''
        color.value = HABIT_COLORS[0].value
        due_date.value = ''
        blockId.value = ''
        steps.value = []
        linkedEventKey.value = ''
        eventMode.value = 'none'
      }
      savedTaskId.value = null
      newCalendarId.value = defaultCalendarId()
      error.value = null
      calendarError.value = null
    }
  }
)

// Sin fecha no hay evento posible: el apartado vuelve a «No crear evento».
watch(due_date, (value) => {
  if (!value) eventMode.value = 'none'
})

function addStep() {
  steps.value.push({
    id: crypto.randomUUID(),
    title: '',
    done: false,
  })
}

function removeStep(index: number) {
  steps.value.splice(index, 1)
}

function updateStepTitle(index: number, newTitle: string) {
  steps.value[index].title = newTitle
}

/** Estilo de los botones de opción de evento (excluyentes). */
function eventModeClass(mode: 'none' | 'local' | 'new' | 'existing'): string {
  const base =
    'rounded-md px-3 py-1.5 text-body-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'
  const active =
    eventMode.value === mode
      ? 'bg-primary text-on-primary shadow-sm'
      : 'bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink'
  return `${base} ${active}`
}

async function handleSubmit(e: Event) {
  e.preventDefault()
  const trimmedTitle = title.value.trim()
  if (!trimmedTitle) {
    error.value = 'El título no puede estar vacío.'
    return
  }

  // Las filas sin título se descartan: no bloquean el guardado de la tarea.
  const validSteps = steps.value.filter((s) => s.title.trim())

  saving.value = true
  error.value = null
  calendarError.value = null
  const desc = description.value.trim() || null
  const dueDate = due_date.value || undefined
  const blockIdValue = blockId.value || null
  const choice = resolveEventChoice()

  try {
    if (editing.value) {
      const { eventError } = await tasks.updateTaskWithEvent(
        editing.value.id,
        {
          title: trimmedTitle,
          description: desc,
          color: color.value,
          due_date: dueDate,
          block_id: blockIdValue,
          steps: validSteps,
        },
        choice
      )
      if (eventError) {
        calendarError.value = eventError
        return
      }
    } else if (savedTaskId.value) {
      // Reintento tras un fallo al crear el evento: la tarea ya existe.
      const { eventError } = await tasks.updateTaskWithEvent(
        savedTaskId.value,
        {
          title: trimmedTitle,
          description: desc,
          color: color.value,
          due_date: dueDate,
          block_id: blockIdValue,
          steps: validSteps,
        },
        choice
      )
      if (eventError) {
        calendarError.value = eventError
        return
      }
    } else {
      const { task, eventError } = await tasks.createTaskWithEvent(
        {
          title: trimmedTitle,
          description: desc,
          color: color.value,
          status: 'todo' as const,
          due_date: dueDate,
          block_id: blockIdValue,
          steps: validSteps,
        },
        choice
      )
      if (eventError) {
        savedTaskId.value = task.id
        calendarError.value = eventError
        return
      }
    }
    ui.closeTaskModal()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Modal :open="ui.createTaskOpen" size="md" @close="ui.closeTaskModal()">
    <form @submit="handleSubmit">
      <div class="border-b border-hairline px-5 py-4">
        <Text variant="card-title" as="h2">
          {{ isEdit ? 'Editar tarea' : 'Nueva tarea' }}
        </Text>
      </div>

      <div class="flex flex-col gap-5 px-5 py-5">
        <Input
          v-model="title"
          data-testid="task-title-input"
          label="Título"
          placeholder="Ej: Terminar informe"
          :error="error ?? undefined"
          maxlength="100"
          required
        />

        <Textarea
          v-model="description"
          label="Descripción"
          placeholder="Ej: Incluir datos de ventas del Q4"
          maxlength="500"
          :rows="2"
        />

        <Input
          v-model="due_date"
          data-testid="task-due-date-input"
          type="date"
          label="Fecha de vencimiento"
          :min="new Date().toISOString().split('T')[0]"
        />

        <div class="flex flex-col gap-1.5">
          <label for="task-block-select" class="select-none text-body-sm text-ink-muted">
            Bloque (materia)
          </label>
          <div class="flex items-center gap-2">
            <select
              id="task-block-select"
              v-model="blockId"
              data-testid="task-block-select"
              class="h-10 min-w-0 flex-1 rounded-md border border-hairline bg-surface-1 px-3 text-body text-ink transition-colors duration-150 hover:border-hairline-strong focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Sin bloque</option>
              <option v-for="block in blocks" :key="block.id" :value="block.id">
                {{ block.title }}
              </option>
            </select>
            <span
              data-testid="task-color-preview"
              class="h-6 w-6 shrink-0 rounded-md border border-hairline"
              :style="{ backgroundColor: previewColor }"
            />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <Text variant="body-sm" color="muted">Evento</Text>

          <p
            v-if="!hasDueDate"
            data-testid="task-event-disabled-hint"
            class="text-caption text-ink-subtle"
          >
            Agregá una fecha de vencimiento para poder agendar un evento.
          </p>

          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="task-event-mode-none"
              :aria-pressed="eventMode === 'none'"
              :disabled="!hasDueDate"
              :class="eventModeClass('none')"
              @click="eventMode = 'none'"
            >
              No crear evento
            </button>
            <button
              type="button"
              data-testid="task-event-mode-local"
              :aria-pressed="eventMode === 'local'"
              :disabled="!hasDueDate"
              :class="eventModeClass('local')"
              @click="eventMode = 'local'"
            >
              Solo local
            </button>
            <button
              type="button"
              data-testid="task-event-mode-new"
              :aria-pressed="eventMode === 'new'"
              :disabled="!hasDueDate || !googleConnected"
              :class="eventModeClass('new')"
              @click="eventMode = 'new'"
            >
              Evento nuevo
            </button>
            <button
              type="button"
              data-testid="task-event-mode-existing"
              :aria-pressed="eventMode === 'existing'"
              :disabled="!hasDueDate"
              :class="eventModeClass('existing')"
              @click="eventMode = 'existing'"
            >
              Elegir un evento del día
            </button>
          </div>

          <p
            v-if="hasDueDate && !googleConnected"
            data-testid="task-event-new-hint"
            class="text-caption text-ink-subtle"
          >
            Conectá Google Calendar para usar «Evento nuevo».
          </p>

          <select
            v-if="hasDueDate && eventMode === 'new'"
            v-model="newCalendarIdModel"
            data-testid="task-event-calendar-select"
            class="h-10 min-w-0 rounded-md border border-hairline bg-surface-1 px-3 text-body text-ink transition-colors duration-150 hover:border-hairline-strong focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option v-for="cal in calendar.calendars" :key="cal.id" :value="cal.id">
              {{ cal.summary }}
            </option>
          </select>

          <div v-if="hasDueDate && eventMode === 'existing'" class="flex flex-col gap-1">
            <select
              v-model="linkedEventKey"
              data-testid="task-event-select"
              class="h-10 min-w-0 rounded-md border border-hairline bg-surface-1 px-3 text-body text-ink transition-colors duration-150 hover:border-hairline-strong focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Elegí un evento del día</option>
              <option v-for="option in eventOptions" :key="option.key" :value="option.key">
                {{ option.label }}
              </option>
            </select>
            <p v-if="dayEvents.length === 0" class="text-caption text-ink-subtle">
              No hay eventos ese día.
            </p>
          </div>

          <p
            v-if="calendarError"
            data-testid="task-calendar-error"
            class="text-caption text-accent-red"
          >
            {{ calendarError }}
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <Text variant="body-sm" color="muted">Color</Text>
          <div class="grid grid-cols-8 gap-2">
            <button
              v-for="c in HABIT_COLORS"
              :key="c.value"
              data-testid="color-option"
              type="button"
              :title="c.name"
              :aria-label="c.name"
              :aria-pressed="color === c.value"
              :style="{ backgroundColor: c.value }"
              :class="[
                'h-8 w-8 rounded-full transition-all duration-150',
                'hover:scale-110 active:scale-95',
                color === c.value ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface-1' : '',
              ]"
              @click="color = c.value"
            />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Text variant="body-sm" color="muted">Pasos</Text>
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              data-testid="add-step-button"
              @click="addStep"
            >
              + Agregar paso
            </Button>
          </div>

          <div v-if="steps.length > 0" class="flex flex-col gap-2">
            <div v-for="(step, index) in steps" :key="step.id" class="flex items-center gap-2">
              <Input
                v-model="step.title"
                data-testid="step-input"
                :placeholder="`Paso ${index + 1}`"
                maxlength="100"
                @update:model-value="(val) => updateStepTitle(index, val)"
              />
              <button
                type="button"
                data-testid="remove-step-button"
                class="rounded p-2 text-ink-muted hover:bg-surface-2"
                @click="removeStep(index)"
              >
                <X :size="16" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-hairline px-5 py-4">
        <Button
          type="button"
          variant="tertiary"
          size="md"
          :disabled="saving"
          @click="ui.closeTaskModal()"
        >
          Cancelar
        </Button>
        <Button type="submit" variant="primary" size="md" :loading="saving">
          {{ isEdit ? 'Guardar' : 'Crear' }}
        </Button>
      </div>
    </form>
  </Modal>
</template>
