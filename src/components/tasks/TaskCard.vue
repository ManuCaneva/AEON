<script setup lang="ts">
import { ref, computed } from 'vue'
import { MoreHorizontal, Check } from 'lucide-vue-next'
import type { Task } from '@/schemas/tasks'
import { useTasksStore, daysUntilDue, urgencyLevel, deadlineProgress } from '@/stores/tasks'
import { useUiStore } from '@/stores/ui'
import Container from '@/components/ui/Container.vue'
import Text from '@/components/ui/Text.vue'
import TaskContextMenu from './TaskContextMenu.vue'

const props = defineProps<{
  task: Task
}>()

const store = useTasksStore()
const ui = useUiStore()

const isMenuOpen = computed(() => ui.menuOpenForTaskId === props.task.id)

const expanded = ref(false)

const completedSteps = computed(() => props.task.steps.filter((s) => s.done).length)
const totalSteps = computed(() => props.task.steps.length)
const hasSteps = computed(() => totalSteps.value > 0)
const hasDeadline = computed(() => props.task.due_date !== null)

const urgency = computed(() => urgencyLevel(props.task.due_date))

const urgencyLabel = computed(() => {
  if (!props.task.due_date) return ''
  const days = daysUntilDue(props.task.due_date)
  if (days < 0) return `Vencida hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? 's' : ''}`
  if (days === 0) return 'Vence hoy'
  return `Faltan ${days} día${days !== 1 ? 's' : ''}`
})

const urgencyPill = computed(() => {
  switch (urgency.value) {
    case 'overdue':
      return 'bg-accent-red-tint text-accent-red'
    case 'warning':
      return 'bg-accent-orange-tint text-accent-orange'
    default:
      return 'bg-surface-2 text-ink-muted'
  }
})

const progress = computed(() => {
  if (!props.task.due_date) return null
  return deadlineProgress(props.task.created_at, props.task.due_date)
})

const progressColor = computed(() => {
  if (urgency.value === 'overdue') return 'bg-accent-red'
  return 'bg-primary'
})

function toggleExpand() {
  expanded.value = !expanded.value
}

function handleToggleStep(stepId: string) {
  store.toggleStep(props.task.id, stepId)
}

function handleComplete() {
  if (props.task.status === 'done') {
    store.uncompleteTask(props.task.id)
  } else {
    store.completeTask(props.task.id)
  }
}
</script>

<template>
  <Container
    data-testid="task-card"
    variant="ghost"
    padding="sm"
    :class="['task-card-responsive group relative', isMenuOpen && 'z-10']"
  >
    <div class="flex items-start gap-3">
      <div
        data-testid="task-color-indicator"
        class="mt-0.5 h-10 w-1 shrink-0 rounded-full"
        :style="{ backgroundColor: store.colorFor(task) }"
      />

      <div class="min-w-0 flex-1 cursor-pointer" data-testid="task-card-body" @click="toggleExpand">
        <div class="mb-1 flex items-center gap-2">
          <Text
            as="div"
            variant="body"
            weight="500"
            :class="['truncate', task.status === 'done' && 'text-ink-muted line-through']"
          >
            {{ task.title }}
          </Text>
          <button
            data-testid="task-menu-button"
            :data-task-menu-trigger="task.id"
            class="ml-auto rounded-md p-1 text-ink-muted opacity-0 transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
            @click.stop="ui.toggleTaskMenu(task.id)"
          >
            <MoreHorizontal :size="16" />
          </button>
        </div>

        <Text
          v-if="task.description"
          data-testid="task-description"
          as="div"
          variant="body-sm"
          color="muted"
          class="mb-2 truncate"
        >
          {{ task.description }}
        </Text>

        <div class="flex items-center gap-3 text-caption">
          <div
            v-if="hasSteps"
            data-testid="task-steps"
            class="flex items-center gap-1 text-ink-muted"
          >
            <span>{{ completedSteps }}/{{ totalSteps }}</span>
          </div>

          <div
            v-if="hasDeadline"
            data-testid="task-deadline"
            class="flex items-center rounded-full px-2 py-0.5 font-medium"
            :class="urgencyPill"
          >
            <span>{{ urgencyLabel }}</span>
          </div>
        </div>

        <div
          v-if="hasDeadline && progress !== null"
          data-testid="task-progress-bar"
          class="mt-2 h-1 overflow-hidden rounded-full bg-surface-2"
        >
          <div
            :class="['h-full transition-all', progressColor]"
            :style="{ width: `${progress * 100}%` }"
          />
        </div>

        <div class="steps-expand mt-2" :class="{ open: expanded }">
          <div>
            <div v-if="expanded" data-testid="task-steps-list" class="flex flex-col gap-1 py-1">
              <div
                v-for="step in task.steps"
                :key="step.id"
                data-testid="task-step-item"
                class="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-surface-2"
              >
                <label
                  class="relative inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center"
                  @click.stop
                >
                  <input
                    type="checkbox"
                    :checked="step.done"
                    data-testid="task-step-checkbox"
                    class="peer absolute inset-0 cursor-pointer opacity-0"
                    @click.stop="handleToggleStep(step.id)"
                  />
                  <span
                    :class="[
                      'flex h-4 w-4 items-center justify-center rounded border transition-colors duration-150',
                      step.done
                        ? 'border-primary bg-primary'
                        : 'border-hairline-strong bg-surface-1',
                      'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-focus/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-canvas',
                    ]"
                  >
                    <Check v-if="step.done" :size="12" class="text-on-primary" stroke-width="3" />
                  </span>
                </label>
                <Text
                  as="span"
                  variant="body-sm"
                  :class="['truncate', step.done ? 'text-ink-muted line-through' : '']"
                >
                  {{ step.title }}
                </Text>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex shrink-0 items-center">
        <button
          data-testid="task-complete-btn"
          type="button"
          :aria-pressed="task.status === 'done'"
          :aria-label="task.status === 'done' ? 'Desmarcar tarea' : 'Completar tarea'"
          :class="[
            'flex h-5 w-5 cursor-pointer items-center justify-center rounded-md border transition-all duration-150',
            task.status === 'done'
              ? 'border-accent-green bg-accent-green-tint text-accent-green'
              : 'border-hairline-strong bg-surface-1 text-transparent hover:border-accent-green hover:bg-accent-green-tint hover:text-accent-green',
          ]"
          @click.stop="handleComplete"
        >
          <Check :size="14" stroke-width="3" />
        </button>
      </div>
    </div>
    <TaskContextMenu v-if="isMenuOpen" :task="task" />
  </Container>
</template>

<style scoped>
.steps-expand {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.25s ease;
  overflow: hidden;
}
.steps-expand.open {
  grid-template-rows: 1fr;
}
.steps-expand > div {
  min-height: 0;
}
</style>
