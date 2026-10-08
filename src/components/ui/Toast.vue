<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    message: string
    duration?: number
  }>(),
  { duration: 1500 }
)

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

let timer: ReturnType<typeof setTimeout> | undefined

function clear() {
  if (timer !== undefined) {
    clearTimeout(timer)
    timer = undefined
  }
}

watch(
  () => props.open,
  (open) => {
    clear()
    if (open) {
      timer = setTimeout(() => emit('update:open', false), props.duration)
    }
  },
  { immediate: true }
)

onBeforeUnmount(clear)
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        data-testid="toast"
        role="status"
        class="glass-overlay pointer-events-none fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-body-sm text-ink shadow-xl"
      >
        {{ message }}
      </div>
    </Transition>
  </Teleport>
</template>
