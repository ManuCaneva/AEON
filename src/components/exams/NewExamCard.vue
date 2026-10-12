<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import NewEntityCard from '@/components/ui/NewEntityCard.vue'

const ui = useUiStore()
</script>

<template>
  <NewEntityCard
    label="Nuevo examen"
    aria-label="Crear nuevo examen"
    data-testid="new-exam-card"
    css-class="exam-card-responsive new-exam-card"
    @create="ui.openCreateExam()"
  />
</template>
