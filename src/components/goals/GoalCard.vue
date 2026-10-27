<script setup lang="ts">
import { computed } from 'vue'
import { Plus, Minus, MoreHorizontal } from 'lucide-vue-next'
import {
  useGoalsStore,
  currentProgress,
  currentValue,
  progressPercent,
  isGoalComplete,
} from '@/stores/goals'
import { formatYyyyMmDd } from '@/lib/calendarDates'
import { useUiStore } from '@/stores/ui'
import type { Goal } from '@/schemas/goals'
import Container from '@/components/ui/Container.vue'
import Text from '@/components/ui/Text.vue'
import Badge from '@/components/ui/Badge.vue'
import IconButton from '@/components/ui/IconButton.vue'
import GoalContextMenu from './GoalContextMenu.vue'

const props = defineProps<{ goal: Goal }>()

const goals = useGoalsStore()
const ui = useUiStore()

const isMenuOpen = computed(() => ui.menuOpenForGoalId === props.goal.id)

const isDown = computed(() => props.goal.direction === 'down')

const progress = computed(() => {
  const today = formatYyyyMmDd(new Date())
  return currentProgress(props.goal, goals.logs, today)
})

const value = computed(() => currentValue(props.goal, progress.value))

const percent = computed(() => progressPercent(props.goal, progress.value) * 100)

const isComplete = computed(() => isGoalComplete(props.goal, progress.value))

function frequencyLabel(): string {
  switch (props.goal.frequency.type) {
    case 'daily':
      return 'Diario'
    case 'weekly':
      return 'Semanal'
    case 'interval':
      return `Cada ${props.goal.frequency.interval_days} días`
  }
}

async function handleIncrement() {
  await goals.incrementLog(props.goal.id, 1)
}
</script>

<template>
  <Container
    data-testid="goal-card"
    variant="ghost"
    padding="sm"
    :class="['goal-card-responsive group relative', isMenuOpen && 'z-10']"
  >
    <div class="flex items-start gap-3">
      <div
        data-testid="goal-color-indicator"
        :style="{ backgroundColor: goal.color }"
        class="mt-2 h-2 w-2 flex-shrink-0 rounded-full"
      />

      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <Text variant="body" weight="600" class="truncate">
              {{ goal.title }}
            </Text>
            <Text
              v-if="goal.description"
              data-testid="goal-description"
              variant="body-sm"
              color="muted"
              class="goal-card-description block truncate"
            >
              {{ goal.description }}
            </Text>
          </div>

          <IconButton
            data-testid="goal-menu-button"
            :data-goal-menu-trigger="goal.id"
            variant="ghost"
            size="sm"
            label="Menú"
            @click.stop="ui.toggleGoalMenu(goal.id)"
          >
            <MoreHorizontal :size="16" />
          </IconButton>
        </div>

        <div class="goal-card-progress mt-2 flex items-center gap-3">
          <div class="min-w-0 flex-1">
            <div class="mb-1 flex items-center justify-between gap-2">
              <Text variant="body-sm" weight="500" class="min-w-0 truncate">
                <template v-if="isDown"> {{ value }}/{{ goal.target }} restantes </template>
                <template v-else> {{ value }}/{{ goal.target }} </template>
                <span v-if="goal.unit" class="text-ink-muted">{{ goal.unit }}</span>
              </Text>
              <Badge :variant="isComplete ? 'success' : 'default'" dot>
                {{ frequencyLabel() }}
              </Badge>
            </div>
            <div
              data-testid="goal-progress-bar"
              class="h-1.5 overflow-hidden rounded-full bg-surface-2"
            >
              <div
                :style="{
                  width: `${percent}%`,
                  backgroundColor: isComplete ? undefined : goal.color,
                }"
                :class="[
                  'h-full rounded-full transition-all duration-300',
                  isComplete && 'bg-accent-green',
                ]"
              />
            </div>
          </div>

          <button
            data-testid="goal-increment-button"
            :aria-label="isDown ? 'Descontar 1' : 'Sumar 1'"
            :disabled="isComplete"
            :class="[
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
              isComplete
                ? 'cursor-not-allowed border-transparent bg-accent-green-tint text-accent-green'
                : 'border-hairline bg-surface-2 text-ink hover:bg-surface-3',
            ]"
            @click="handleIncrement"
          >
            <Minus v-if="isDown" :size="16" />
            <Plus v-else :size="16" />
          </button>
        </div>
      </div>
    </div>
    <GoalContextMenu v-if="isMenuOpen" :goal="goal" />
  </Container>
</template>
