<script setup lang="ts">
import { computed } from 'vue'
import { useHabitsStore } from '@/stores/habits'
import HabitCard from '@/components/habits/HabitCard.vue'
import NewHabitCard from '@/components/habits/NewHabitCard.vue'
import EmptyState from '@/components/habits/EmptyState.vue'
import HabitSection from '@/components/habits/HabitSection.vue'
import EntityListing from '@/components/ui/EntityListing.vue'
import type { HabitLog } from '@/schemas/habits'

withDefaults(
  defineProps<{
    showEyebrow?: boolean
  }>(),
  {
    showEyebrow: true,
  }
)

// Referencia estable para hábitos sin logs: evita re-render de la tarjeta por un array nuevo.
const EMPTY_LOGS: HabitLog[] = []

const habits = useHabitsStore()

const list = computed(() => habits.activeHabits)
const logsByHabit = computed(() => habits.logsByHabit)
</script>

<template>
  <EntityListing
    title="Hábitos"
    eyebrow="Hoy"
    :show-eyebrow="showEyebrow"
    panel-test-id="habits-panel"
    entity-class="habits"
  >
    <HabitSection variant="flat">
      <EmptyState v-if="list.length === 0" />
      <div v-else class="flex flex-col gap-1">
        <HabitCard
          v-for="habit in list"
          :key="habit.id"
          :habit="habit"
          :logs="logsByHabit.get(habit.id) ?? EMPTY_LOGS"
        />
      </div>
    </HabitSection>
    <template #footer>
      <NewHabitCard />
    </template>
  </EntityListing>
</template>
