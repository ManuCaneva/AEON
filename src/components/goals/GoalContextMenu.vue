<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import { useGoalsStore } from '@/stores/goals'
import type { Goal } from '@/schemas/goals'
import EntityContextMenu from '@/components/ui/EntityContextMenu.vue'

const props = defineProps<{ goal: Goal }>()

const ui = useUiStore()
const goals = useGoalsStore()

function handleEdit() {
  ui.openEditGoal(props.goal.id)
}

async function handleDelete() {
  try {
    await goals.deleteGoal(props.goal.id)
  } finally {
    ui.closeGoalMenu()
  }
}
</script>

<template>
  <EntityContextMenu
    :entity-id="goal.id"
    trigger-data-attr="data-goal-menu-trigger"
    confirm-title="¿Eliminar objetivo?"
    @edit="handleEdit"
    @delete="handleDelete"
    @close="ui.closeGoalMenu()"
  />
</template>
