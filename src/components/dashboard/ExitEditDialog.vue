<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import Modal from '@/components/ui/Modal.vue'
import Button from '@/components/ui/Button.vue'
import Heading from '@/components/ui/Heading.vue'

const ui = useUiStore()
</script>

<template>
  <Modal :open="ui.exitDialogOpen" size="sm" @close="ui.cancelExitDialog()">
    <div data-testid="exit-edit-dialog" class="flex flex-col gap-4 p-5">
      <Heading>Cambios sin guardar</Heading>
      <p class="text-body text-ink-muted">
        Tenés cambios sin guardar en el dashboard. ¿Querés guardarlos antes de salir?
      </p>
      <div class="flex flex-wrap justify-end gap-2">
        <Button
          data-testid="exit-keep-editing"
          variant="ghost"
          @click="ui.resolveExitDialog('cancel')"
        >
          Seguir editando
        </Button>
        <Button
          data-testid="exit-discard"
          variant="secondary"
          @click="ui.resolveExitDialog('discard')"
        >
          Descartar cambios
        </Button>
        <Button data-testid="exit-save" @click="ui.resolveExitDialog('save')"
          >Guardar y salir</Button
        >
      </div>
    </div>
  </Modal>
</template>
