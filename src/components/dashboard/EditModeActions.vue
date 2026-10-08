<script setup lang="ts">
import { ref } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useUiStore } from '@/stores/ui'
import Button from '@/components/ui/Button.vue'
import Toast from '@/components/ui/Toast.vue'

const dashboard = useDashboardStore()
const ui = useUiStore()

const showSaved = ref(false)

function onSave() {
  dashboard.saveEdit()
  showSaved.value = true
}

function onDiscard() {
  dashboard.discardEdit()
}
</script>

<template>
  <div
    v-if="ui.editMode"
    data-testid="edit-actions"
    class="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center"
  >
    <div
      class="glass-strong pointer-events-auto flex items-center gap-1 rounded-full p-1.5 pl-3 shadow-xl"
    >
      <Button data-testid="edit-discard" variant="ghost" size="sm" @click="onDiscard">
        Deshacer cambios
      </Button>
      <Button data-testid="edit-save" variant="primary" size="sm" @click="onSave">Guardar</Button>
    </div>
  </div>
  <Toast v-model:open="showSaved" message="Cambios guardados" />
</template>
