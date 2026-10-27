<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Heading from '@/components/ui/Heading.vue'
import Modal from '@/components/ui/Modal.vue'
import ReleaseNotes from '@/components/layout/ReleaseNotes.vue'
import type { ReleaseNotes as Notes } from '@/lib/update/notes'

defineProps<{
  open: boolean
  version: string
  notes: Notes
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Modal :open="open" size="md" @close="emit('close')">
    <div class="flex flex-col gap-4 p-5">
      <Heading>Novedades de la versión {{ version }}</Heading>

      <ReleaseNotes :notes="notes" />

      <div class="flex justify-end">
        <Button @click="emit('close')">Listo</Button>
      </div>
    </div>
  </Modal>
</template>
