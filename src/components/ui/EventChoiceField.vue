<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import { eventKey, type EventChoice } from '@/lib/entityEventLink'
import type { EntityEventLink } from '@/schemas/entityLink'
import Text from '@/components/ui/Text.vue'

// Apartado «Evento» compartido por el formulario de examen y el de tarea
// (spec 139): las cuatro opciones excluyentes, el selector de calendario y el
// de evento del día. Sólo cambian los textos y el prefijo de los data-testid.
// La fecha de la entidad es la fuente de verdad: sin fecha no hay evento.

const props = defineProps<{
  /** Elección vigente del formulario (v-model). */
  modelValue: EventChoice
  /** Fecha de la entidad; '' = sin fecha, el apartado queda deshabilitado. */
  date: string
  /** Vínculo actual de la entidad, para prefilar la opción de evento del día. */
  link: EntityEventLink | null
  /** Prefijo de los data-testid (p. ej. 'exam' o 'task'). */
  testIdPrefix: string
  /** Texto que se muestra cuando todavía no hay fecha. */
  disabledHint: string
  /** Error de calendario devuelto por el store, o null. */
  error?: string | null
}>()

const emit = defineEmits<{ 'update:modelValue': [EventChoice] }>()

const calendar = useCalendarStore()

const hasDate = computed(() => props.date !== '')
const googleConnected = computed(() => calendar.connected)

// Estado de UI del apartado; se siembra una sola vez desde el vínculo actual
// (el formulario se remonta cada vez que se abre el modal). La decisión
// resuelta viaja al padre por v-model.
const eventMode = ref<'none' | 'local' | 'new' | 'existing'>(props.link ? 'existing' : 'none')
const linkedEventKey = ref(props.link ? eventKey(props.link.calendarId, props.link.eventId) : '')
const newCalendarId = ref('')

const dayEvents = computed(() => calendar.events.filter((e) => e.date === props.date))

// El evento del vínculo actual se busca por clave (sin mirar el día): si sigue
// existiendo, se conserva su título aunque la fecha se acabe de cambiar. Sólo
// un vínculo huérfano se muestra como «Evento no disponible».
const linkedEvent = computed(() => {
  if (!linkedEventKey.value) return undefined
  const [calendarId, eventId] = linkedEventKey.value.split('\u0000')
  if (!calendarId || !eventId) return undefined
  return calendar.events.find((e) => e.calendarId === calendarId && e.id === eventId)
})

const eventOptions = computed(() => {
  const options = dayEvents.value.map((e) => ({
    key: eventKey(e.calendarId, e.id),
    label: e.title,
  }))
  if (linkedEventKey.value && !options.some((o) => o.key === linkedEventKey.value)) {
    options.unshift({
      key: linkedEventKey.value,
      label: linkedEvent.value?.title ?? 'Evento no disponible',
    })
  }
  return options
})

function defaultCalendarId(): string {
  const list = calendar.calendars
  return list.find((c) => c.primary)?.id ?? list[0]?.id ?? ''
}

// El calendario destino por defecto es el principal; el modelo cae a ese valor
// mientras el usuario no elija otro. La lista incluye el local además de los
// conectados, como pide la spec.
const selectedCalendarId = computed({
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

/** Traduce la opción de UI a la decisión que consume el store. */
const resolvedChoice = computed<EventChoice>(() => {
  if (!hasDate.value) return { mode: 'none' }
  if (eventMode.value === 'local') return { mode: 'local' }
  if (eventMode.value === 'new') return { mode: 'new', calendarId: selectedCalendarId.value }
  if (eventMode.value === 'existing') {
    const link = resolveEventLink()
    return link ? { mode: 'existing', link } : { mode: 'none' }
  }
  return { mode: 'none' }
})

watch(resolvedChoice, (choice) => emit('update:modelValue', choice), { immediate: true })

// El formulario puede cambiar de entidad sin desmontarse (p. ej. abrir la
// edición con el modal ya montado): al cambiar el vínculo se vuelve a sembrar
// el estado de UI.
watch(
  () => props.link,
  (link) => {
    eventMode.value = link ? 'existing' : 'none'
    linkedEventKey.value = link ? eventKey(link.calendarId, link.eventId) : ''
    newCalendarId.value = ''
  }
)

// Sin fecha no hay evento posible: el apartado vuelve a «No crear evento».
watch(
  () => props.date,
  (value) => {
    if (!value) eventMode.value = 'none'
  }
)

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
</script>

<template>
  <div class="flex flex-col gap-2">
    <Text variant="body-sm" color="muted">Evento</Text>

    <p
      v-if="!hasDate"
      :data-testid="`${testIdPrefix}-event-disabled-hint`"
      class="text-caption text-ink-subtle"
    >
      {{ disabledHint }}
    </p>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        :data-testid="`${testIdPrefix}-event-mode-none`"
        :aria-pressed="eventMode === 'none'"
        :disabled="!hasDate"
        :class="eventModeClass('none')"
        @click="eventMode = 'none'"
      >
        No crear evento
      </button>
      <button
        type="button"
        :data-testid="`${testIdPrefix}-event-mode-local`"
        :aria-pressed="eventMode === 'local'"
        :disabled="!hasDate"
        :class="eventModeClass('local')"
        @click="eventMode = 'local'"
      >
        Solo local
      </button>
      <button
        type="button"
        :data-testid="`${testIdPrefix}-event-mode-new`"
        :aria-pressed="eventMode === 'new'"
        :disabled="!hasDate || !googleConnected"
        :class="eventModeClass('new')"
        @click="eventMode = 'new'"
      >
        Evento nuevo
      </button>
      <button
        type="button"
        :data-testid="`${testIdPrefix}-event-mode-existing`"
        :aria-pressed="eventMode === 'existing'"
        :disabled="!hasDate"
        :class="eventModeClass('existing')"
        @click="eventMode = 'existing'"
      >
        Elegir un evento del día
      </button>
    </div>

    <p
      v-if="hasDate && !googleConnected"
      :data-testid="`${testIdPrefix}-event-new-hint`"
      class="text-caption text-ink-subtle"
    >
      Conectá Google Calendar para usar «Evento nuevo».
    </p>

    <select
      v-if="hasDate && eventMode === 'new'"
      v-model="selectedCalendarId"
      :data-testid="`${testIdPrefix}-event-calendar-select`"
      class="h-10 min-w-0 rounded-md border border-hairline bg-surface-1 px-3 text-body text-ink transition-colors duration-150 hover:border-hairline-strong focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
    >
      <option value="local">Local (solo esta app)</option>
      <option v-for="cal in calendar.calendars" :key="cal.id" :value="cal.id">
        {{ cal.summary }}
      </option>
    </select>

    <div v-if="hasDate && eventMode === 'existing'" class="flex flex-col gap-1">
      <select
        v-model="linkedEventKey"
        :data-testid="`${testIdPrefix}-event-select`"
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
      v-if="error"
      :data-testid="`${testIdPrefix}-calendar-error`"
      class="text-caption text-accent-red"
    >
      {{ error }}
    </p>
  </div>
</template>
