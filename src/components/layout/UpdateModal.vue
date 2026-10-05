<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import Heading from '@/components/ui/Heading.vue'
import Modal from '@/components/ui/Modal.vue'
import type { UpdateStatus } from '@/composables/useUpdater'

const props = defineProps<{
  open: boolean
  status: UpdateStatus
  progress?: number | null
}>()

const emit = defineEmits<{
  update: []
  dismiss: []
  'dismiss-forever': []
}>()

const dontAskAgain = ref(false)

const title = computed(() => {
  if (props.status === 'downloading') return 'Descargando actualización'
  if (props.status === 'error') return 'No se pudo actualizar'
  return 'Nueva versión disponible'
})

const percent = computed(() => {
  if (props.progress == null) return null
  return Math.round(props.progress * 100)
})

function close() {
  if (dontAskAgain.value) emit('dismiss-forever')
  else emit('dismiss')
}
</script>

<template>
  <Modal :open="open" size="sm" @close="close">
    <div class="flex flex-col gap-4 p-5">
      <Heading>{{ title }}</Heading>

      <p v-if="status === 'downloading'" class="text-body text-ink">
        <span v-if="percent == null">Descargando…</span>
        <span v-else>{{ percent }}% completado</span>
      </p>

      <p v-else-if="status === 'error'" class="text-body text-ink">
        Abrimos la página de descargas para que la bajes a mano.
      </p>

      <Checkbox
        v-if="status === 'available'"
        v-model="dontAskAgain"
        label="No volver a avisar de esta versión"
      />

      <div class="flex justify-end gap-2">
        <template v-if="status === 'available'">
          <Button variant="secondary" @click="close">Después</Button>
          <Button @click="emit('update')">Actualizar</Button>
        </template>
        <Button v-else-if="status === 'error'" variant="secondary" @click="emit('dismiss')">
          Cerrar
        </Button>
      </div>
    </div>
  </Modal>
</template>
