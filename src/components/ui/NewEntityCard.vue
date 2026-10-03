<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import Text from '@/components/ui/Text.vue'

defineProps<{
  label: string
  cssClass?: string
}>()

const emit = defineEmits<{ create: [] }>()

function onClick() {
  emit('create')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    emit('create')
  }
}
</script>

<template>
  <div
    role="button"
    tabindex="0"
    class="flex min-h-[44px] cursor-pointer flex-col items-center justify-center gap-1.5 py-2 text-ink-muted transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    :class="cssClass"
    @click="onClick"
    @keydown="onKeydown"
  >
    <Plus :size="16" :stroke-width="2" aria-hidden="true" />
    <Text variant="body-sm" weight="500">{{ label }}</Text>
  </div>
</template>
