<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import { useHabitsStore } from '@/stores/habits'
import type { Habit } from '@/schemas/habits'
import EntityContextMenu from '@/components/ui/EntityContextMenu.vue'

const props = defineProps<{ habit: Habit }>()

const ui = useUiStore()
const habits = useHabitsStore()

function handleEdit() {
  ui.openEdit(props.habit.id)
}

async function handleDelete() {
  try {
    await habits.deleteHabit(props.habit.id)
  } finally {
    ui.closeMenu()
  }
}
</script>

<template>
  <EntityContextMenu
    :entity-id="habit.id"
    trigger-data-attr="data-habit-menu-trigger"
    confirm-title="¿Eliminar hábito?"
    @edit="handleEdit"
    @delete="handleDelete"
    @close="ui.closeMenu()"
  />
</template>
